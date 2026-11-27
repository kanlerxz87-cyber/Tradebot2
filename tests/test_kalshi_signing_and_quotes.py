"""Regression tests for Trade API v2 request signing, Order V2 payload rules,
NO-side paper mark-to-market valuation, opposing orderbook depth, and server
source-link retention.

Verified against official Kalshi documentation:
  * https://docs.kalshi.com/getting_started/api_environments#request-signing
  * https://docs.kalshi.com/getting_started/api_keys
  * https://docs.kalshi.com/api-reference/orders/create-order-v2
  * https://docs.kalshi.com/api-reference/orders/cancel-order-v2
  * https://docs.kalshi.com/api-reference/market/get-market-orderbook
  * https://docs.kalshi.com/getting_started/market_settlement#fees
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import MagicMock

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.alerts import Alert
from app.config import DEMO_REST, DEMO_REST_ALT, Settings
from app.kalshi import KalshiClient
from app.paper import PaperBroker
from app.server import LiveEngine
from app.strategies import Opportunity, evaluate, position_size


class _FakeResponse:
    def __init__(self, status_code: int = 200, payload: dict[str, Any] | None = None) -> None:
        self.status_code = status_code
        self._payload = payload if payload is not None else {"ok": True}
        self.content = json.dumps(self._payload).encode("utf-8")
        self.text = self.content.decode("utf-8")

    def json(self) -> dict[str, Any]:
        return self._payload


def test_demo_rest_base_signs_full_trade_api_v2_path_ed25519():
    """Calling client.get_orders() on DEMO_REST must sign /trade-api/v2/portfolio/orders."""
    key = Ed25519PrivateKey.generate()
    session = MagicMock()
    session.request.return_value = _FakeResponse(200, {"orders": []})
    client = KalshiClient(
        base_url=DEMO_REST, api_key_id="demo-key", private_key=key, session=session
    )

    client.get_orders(limit=5, status="resting")

    _, kwargs = session.request.call_args
    headers = kwargs["headers"]
    ts = headers["KALSHI-ACCESS-TIMESTAMP"]
    sig = base64.b64decode(headers["KALSHI-ACCESS-SIGNATURE"])
    expected_msg = f"{ts}GET/trade-api/v2/portfolio/orders".encode("utf-8")
    key.public_key().verify(sig, expected_msg)


def test_demo_rest_alt_signs_full_path_rsa_pss_and_create_order_v2_body():
    """POST /portfolio/events/orders must sign /trade-api/v2/portfolio/events/orders
    and include the required self_trade_prevention_type field."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    session = MagicMock()
    session.request.return_value = _FakeResponse(
        201,
        {
            "order_id": "ord-1",
            "fill_count": "0.00",
            "remaining_count": "2.00",
            "ts_ms": 1700000000000,
        },
    )
    client = KalshiClient(
        base_url=DEMO_REST_ALT, api_key_id="demo-rsa", private_key=key, session=session
    )

    resp = client.create_event_order(
        ticker="KXAAAGASM-26NOV30-4.80",
        side="bid",
        price=0.05,
        count=2,
        time_in_force="good_till_canceled",
        self_trade_prevention_type="taker_at_cross",
        client_order_id="cid-123",
    )
    assert resp["order_id"] == "ord-1"

    args, kwargs = session.request.call_args
    assert args == ("POST", f"{DEMO_REST_ALT}/portfolio/events/orders")
    sent_body = json.loads(kwargs["data"])
    assert sent_body == {
        "ticker": "KXAAAGASM-26NOV30-4.80",
        "client_order_id": "cid-123",
        "side": "bid",
        "count": "2.00",
        "price": "0.0500",
        "time_in_force": "good_till_canceled",
        "self_trade_prevention_type": "taker_at_cross",
    }

    headers = kwargs["headers"]
    ts = headers["KALSHI-ACCESS-TIMESTAMP"]
    sig = base64.b64decode(headers["KALSHI-ACCESS-SIGNATURE"])
    key.public_key().verify(
        sig,
        f"{ts}POST/trade-api/v2/portfolio/events/orders".encode("utf-8"),
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
        hashes.SHA256(),
    )


def test_create_order_rejects_undocumented_gtt_and_invalid_stp():
    client = KalshiClient(base_url=DEMO_REST)
    with pytest.raises(ValueError, match="time_in_force"):
        client.create_event_order(
            ticker="KXAAAGASM-26NOV30-4.80",
            side="bid",
            price=0.25,
            count=1,
            time_in_force="GTT",
        )
    with pytest.raises(ValueError, match="self_trade_prevention_type"):
        client.create_event_order(
            ticker="KXAAAGASM-26NOV30-4.80",
            side="bid",
            price=0.25,
            count=1,
            self_trade_prevention_type="cancel_both",
        )


def test_cancel_order_forwards_shard_routing_params_and_signs_clean_path():
    key = Ed25519PrivateKey.generate()
    session = MagicMock()
    session.request.return_value = _FakeResponse(200, {"order_id": "ord-9", "reduced_by": "1.00"})
    client = KalshiClient(
        base_url=DEMO_REST, api_key_id="demo-key", private_key=key, session=session
    )

    client.cancel_order("ord-9", market_ticker="KXAAAGASM-26NOV30-4.80", exchange_index=1)

    _, kwargs = session.request.call_args
    assert kwargs["params"] == {"market_ticker": "KXAAAGASM-26NOV30-4.80", "exchange_index": 1}
    headers = kwargs["headers"]
    ts = headers["KALSHI-ACCESS-TIMESTAMP"]
    sig = base64.b64decode(headers["KALSHI-ACCESS-SIGNATURE"])
    key.public_key().verify(
        sig, f"{ts}DELETE/trade-api/v2/portfolio/events/orders/ord-9".encode("utf-8")
    )


def test_paper_broker_marks_open_no_positions_at_one_minus_yes_mid():
    """marks maps ticker -> YES mid; an open NO contract must mark at 1 - YES mid."""
    broker = PaperBroker(starting_cash=1_000.0, strategies=["mean_reversion"])
    no_opp = Opportunity(
        ticker="KXBTC-TEST",
        topic="crypto",
        title="BTC test",
        strategy="mean_reversion",
        side="no",
        entry_price=0.40,
        model_prob=0.55,
        market_prob=0.40,
        edge=0.15,
        est_roi=0.35,
        score=75.0,
        liquidity={"yes_depth": 200, "no_depth": 200},
        target_price=0.55,
        stop_price=0.30,
    )
    pos = broker.open(no_opp, ts=100)
    assert pos is not None

    # YES drops to $0.20 -> NO contract is now worth $0.80 (profitable, not -$0.20 loss!).
    snap = broker.snapshot({"KXBTC-TEST": 0.20})
    acct_row = snap["accounts"][0]
    open_row = acct_row["open_positions"][0]
    expected_equity = broker.account("mean_reversion").cash + pos.contracts * 0.80
    assert acct_row["equity"] == pytest.approx(round(expected_equity, 2))
    assert open_row["pnl"] == pytest.approx(round(pos.contracts * 0.80 - pos.cost, 4))
    assert open_row["pnl"] > 0

    # Zero YES mark ($0.00) must value YES at $0.00 and NO at $1.00, not fall back to entry_price.
    snap_zero = broker.snapshot({"KXBTC-TEST": 0.0})
    assert snap_zero["accounts"][0]["open_positions"][0]["pnl"] == pytest.approx(
        round(pos.contracts * 1.0 - pos.cost, 4)
    )


def test_strategy_rejects_zero_yes_bid_sentinel_with_non_unit_ask():
    """Live demo API returns yes_bid_dollars='0.0000' when no YES bid rests."""
    close = (datetime.now(tz=timezone.utc) + timedelta(hours=12)).isoformat().replace("+00:00", "Z")
    one_sided_market = {
        "ticker": "KXAAAGASM-26NOV30-5.00",
        "title": "Gas above $5.00",
        "topic": "gas_prices",
        "yes_bid_dollars": "0.0000",
        "yes_ask_dollars": "0.5000",
        "yes_bid_size_fp": "0.00",
        "yes_ask_size_fp": "25.00",
        "volume_24h_fp": "100.00",
        "close_time": close,
    }
    swing = Alert(
        ticker="KXAAAGASM-26NOV30-5.00",
        topic="gas_prices",
        title="Gas above $5.00",
        ts=1000,
        before=0.35,
        after=0.50,
        basis="last",
    )
    assert evaluate(one_sided_market, alert=swing, book=None, strategy="momentum") is None
    assert evaluate(one_sided_market, alert=swing, book=None, strategy="mean_reversion") is None


def test_asymmetric_orderbook_uses_opposing_side_depth_for_sizing():
    """Buying YES takes the implied YES ask (resting NO bids = no_depth).
    Buying NO takes the implied NO ask (resting YES bids = yes_depth)."""
    close = (datetime.now(tz=timezone.utc) + timedelta(hours=24)).isoformat().replace("+00:00", "Z")
    mkt = {
        "ticker": "ASYM-1",
        "title": "Asymmetric book",
        "topic": "elections",
        "yes_bid_dollars": "0.4800",
        "yes_ask_dollars": "0.5200",
        "volume_24h_fp": "500.00",
        "close_time": close,
    }
    # 400 resting YES bids, but only 12 resting NO bids -> implied YES ask has 12 contracts!
    asym_book = {
        "orderbook_fp": {
            "yes_dollars": [["0.4800", "400.00"]],
            "no_dollars": [["0.4800", "12.00"]],
        }
    }
    up_alert = Alert(
        ticker="ASYM-1",
        topic="elections",
        title="Asymmetric book",
        ts=1000,
        before=0.36,
        after=0.50,
        basis="mid",
    )
    yes_opp = evaluate(mkt, alert=up_alert, book=asym_book, strategy="momentum")
    assert yes_opp is not None
    assert yes_opp.side == "yes"
    # 25% of 12 opposing NO-bid contracts = 3 contracts max (not 25% of 400 = 100!).
    assert position_size(yes_opp, bankroll=10_000.0) == 3

    down_alert = Alert(
        ticker="ASYM-1",
        topic="elections",
        title="Asymmetric book",
        ts=1000,
        before=0.64,
        after=0.50,
        basis="mid",
    )
    no_opp = evaluate(mkt, alert=down_alert, book=asym_book, strategy="momentum")
    assert no_opp is not None
    assert no_opp.side == "no"
    # Buying NO takes the 400 resting YES bids -> 25% of 400 = 100 contracts (capped by risk/cash).
    assert position_size(no_opp, bankroll=10_000.0) > 3


def test_live_engine_poll_preserves_snapshot_source_links(tmp_path, monkeypatch):
    """poll_once() must retain snapshot source links on quotes and emitted alerts."""
    snap_file = tmp_path / "snapshot.json"
    state_file = tmp_path / "paper_state.json"
    links = {
        "kalshi": "https://kalshi.com/markets/kxaaagasm",
        "market_api": f"{DEMO_REST}/markets/KXAAAGASM-26NOV30-3.50",
    }
    snap_file.write_text(
        json.dumps(
            {
                "generated_at": "2026-11-27T19:00:00Z",
                "markets": [
                    {
                        "ticker": "KXAAAGASM-26NOV30-3.50",
                        "title": "Gas > $3.50",
                        "topic": "gas_prices",
                        "prices": {"mid": 0.40},
                        "volume": {},
                        "links": links,
                    }
                ],
                "resolutions": [],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr("app.server.SNAPSHOT_PATH", snap_file)
    monkeypatch.setattr("app.server.STATE_PATH", state_file)

    engine = LiveEngine(Settings(environment="demo"))
    batches = [
        [
            {
                "ticker": "KXAAAGASM-26NOV30-3.50",
                "title": "Gas > $3.50",
                "yes_bid_dollars": "0.3900",
                "yes_ask_dollars": "0.4100",
                "last_price_dollars": "0.4000",
                "volume_24h_fp": "50.00",
                "open_interest_fp": "100.00",
            }
        ],
        [
            {
                "ticker": "KXAAAGASM-26NOV30-3.50",
                "title": "Gas > $3.50",
                "yes_bid_dollars": "0.5400",
                "yes_ask_dollars": "0.5600",
                "last_price_dollars": "0.5500",
                "volume_24h_fp": "80.00",
                "open_interest_fp": "120.00",
            }
        ],
    ]
    engine.client.get_markets_by_tickers = MagicMock(side_effect=batches)  # type: ignore[method-assign]

    engine.poll_once()
    engine.poll_once()

    assert engine.quotes["KXAAAGASM-26NOV30-3.50"]["links"] == links
    assert len(engine.alerts) == 1
    assert engine.alerts[0]["links"] == links
