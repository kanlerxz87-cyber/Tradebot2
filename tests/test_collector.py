import json
import sys

import pytest

from app.collector import DEMO_REST, normalize_market, trim_resolutions
from collector.collect import market_row, main as collector_main


def test_normalize_market_wide_book_uses_last_or_none():
    wide = {
        "ticker": "KXBTC-WIDE",
        "event_ticker": "KXBTC",
        "title": "Bitcoin wide book test",
        "yes_bid_dollars": "0.0100",
        "yes_ask_dollars": "0.9900",
        "last_price_dollars": "0.1800",
        "volume_24h_fp": "100.00",
        "open_interest_fp": "50.00",
    }
    row = normalize_market(wide, topic="crypto", series_ticker="KXBTC", series_meta=None, base=DEMO_REST)
    assert row["prices"]["mid"] == pytest.approx(0.18)

    wide_no_last = dict(wide, last_price_dollars="0.0000")
    row2 = normalize_market(wide_no_last, topic="crypto", series_ticker="KXBTC", series_meta=None, base=DEMO_REST)
    assert row2["prices"]["mid"] is None
    assert row2["volume"]["notional_24h_est"] is None


def test_collector_market_row_wide_book_parity():
    wide = {
        "ticker": "KXBTC-WIDE",
        "event_ticker": "KXBTC",
        "title": "Bitcoin wide book test",
        "yes_bid_dollars": "0.0500",
        "yes_ask_dollars": "0.9500",
        "last_price_dollars": "0.0000",
        "volume_24h_fp": "10.00",
        "open_interest_fp": "5.00",
    }
    row = market_row(wide, "crypto", DEMO_REST, {})
    assert row["mid_dollars"] is None


def test_trim_resolutions_preserves_full_30d_counts():
    rows = [
        {"ticker": f"KXBTC-{i}", "topic": "crypto", "close_time": f"2026-11-{(i % 27) + 1:02d}T00:00:00Z", "result": "yes"}
        for i in range(120)
    ]
    rows.append({"ticker": "KXPRES-1", "topic": "elections", "close_time": "2026-11-26T00:00:00Z", "result": "no"})
    trimmed, by_topic, totals = trim_resolutions(rows, limit_per_topic=50)
    assert totals == {"crypto": 120, "elections": 1}
    assert len(by_topic["crypto"]) == 50
    assert len(by_topic["elections"]) == 1
    assert len(trimmed) == 51


def test_fixture_collector_runs_cleanly(tmp_path, monkeypatch):
    out_dir = tmp_path / "data"
    monkeypatch.setattr(
        sys,
        "argv",
        ["collect.py", "--fixtures", "tests/fixtures", "--data-dir", str(out_dir)],
    )
    assert collector_main() == 0
    markets = json.loads((out_dir / "markets.json").read_text(encoding="utf-8"))
    assert len(markets["markets"]) == 10
