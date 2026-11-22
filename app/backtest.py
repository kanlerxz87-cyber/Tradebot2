"""Backtest the paper strategies on real Kalshi candles.

What this is: a deterministic simulation over the 1-minute candles collected for
the tracked markets, using the same detector, scoring and paper broker as the
live dashboard.

What this is not: a latency-accurate execution simulator. Entries are filled at
the ask of the candle in which the move completed, exits at the opposing quote
of a later candle. No queue position, no partial fills beyond the depth cap, no
market impact. Those limits are published on the site with every result.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from .alerts import SwingDetector
from .paper import PaperBroker
from .strategies import STRATEGIES, evaluate

SCORE_FLOOR = 50.0
MAX_HOLD_HOURS = 24.0


def _iso(ts: float | int | None) -> str:
    if not ts:
        return ""
    return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _market_from_candle(market: dict[str, Any], row: list[Any]) -> dict[str, Any] | None:
    ts, close, bid, ask, volume, oi = (list(row) + [None] * 6)[:6]
    if bid is None or ask is None or ask <= 0 or bid <= 0 or ask >= 1 or bid >= 1 or ask < bid:
        return None
    return {
        "ticker": market["ticker"],
        "title": market["title"],
        "topic": market["topic"],
        "yes_bid_dollars": f"{bid:.4f}",
        "yes_ask_dollars": f"{ask:.4f}",
        "last_price_dollars": f"{close:.4f}" if close is not None else "",
        "yes_bid_size_fp": "",
        "yes_ask_size_fp": "",
        "volume_24h_fp": f"{volume or 0:.2f}",
        "open_interest_fp": f"{oi or 0:.2f}",
        "close_time": market.get("close_time"),
        "_ts": ts,
    }


def run_backtest(
    markets: list[dict[str, Any]],
    *,
    threshold: float = 0.10,
    starting_cash: float = 10_000.0,
    max_markets: int = 40,
) -> dict[str, Any]:
    broker = PaperBroker(starting_cash=starting_cash, strategies=tuple(STRATEGIES))
    tested = 0
    cells = 0
    skipped = 0
    open_tickers: dict[tuple[str, str], str] = {}

    for market in markets[:max_markets]:
        candles = market.get("candles", {}).get("1m") or []
        if len(candles) < 20:
            skipped += 1
            continue
        detector = SwingDetector(threshold=threshold)
        resolved = (market.get("result") or "").lower()
        used = False

        for row in candles:
            fake = _market_from_candle(market, row)
            if fake is None:
                continue
            used = True
            cells += 1
            ts = float(fake["_ts"])
            alert = detector.observe(
                fake,
                topic=market["topic"],
                title=market["title"],
                ts=ts,
                source="backtest",
            )

            if alert is not None:
                for strategy in STRATEGIES:
                    key = (market["ticker"], strategy)
                    if key in open_tickers:
                        continue
                    opp = evaluate(fake, alert=alert, book=None, strategy=strategy)
                    if opp is None or opp.score < SCORE_FLOOR:
                        continue
                    pos = broker.open(opp, ts=ts, market=fake)
                    if pos is not None:
                        open_tickers[key] = pos.id

            # Manage exits for this ticker with this candle's quotes.
            for strategy in STRATEGIES:
                key = (market["ticker"], strategy)
                pos_id = open_tickers.get(key)
                if not pos_id:
                    continue
                acct = broker.account(strategy)
                pos = acct.positions.get(pos_id)
                if pos is None:
                    open_tickers.pop(key, None)
                    continue
                yes_bid = float(fake["yes_bid_dollars"])
                yes_ask = float(fake["yes_ask_dollars"])
                mark = yes_bid if pos.side == "yes" else round(1 - yes_ask, 4)
                holding_hours = (ts - pos.opened_ts) / 3600.0
                gain = mark - pos.entry_price
                if gain >= 0.15:
                    broker.close(strategy, pos.id, mark, "take profit", ts=ts)
                    open_tickers.pop(key, None)
                elif gain <= -0.10:
                    broker.close(strategy, pos.id, mark, "stop loss", ts=ts)
                    open_tickers.pop(key, None)
                elif holding_hours >= MAX_HOLD_HOURS:
                    broker.close(strategy, pos.id, mark, "time stop", ts=ts)
                    open_tickers.pop(key, None)

        if used:
            tested += 1
        if resolved in {"yes", "no"}:
            broker.settle_resolved({market["ticker"]: resolved})

    marks = {}
    for market in markets[:max_markets]:
        price = (market.get("prices") or {}).get("mid")
        if price is not None:
            marks[market["ticker"]] = float(price)
    snapshot = broker.snapshot(marks)

    return {
        "schema_version": 1,
        "generated_at": _iso(datetime.now(tz=timezone.utc).timestamp()),
        "method": {
            "threshold": threshold,
            "score_floor": SCORE_FLOOR,
            "max_hold_hours": MAX_HOLD_HOURS,
            "starting_cash_per_strategy": starting_cash,
            "entry": "ask at the close of the candle in which the >= $0.10 move completed",
            "exit": "take profit +$0.15, stop -$0.10, time stop 24h, otherwise settlement",
            "fees": "0.07 x contracts x price x (1-price), rounded up to 1e-6",
            "limitations": [
                "1-minute candle granularity; intra-minute path is unknown",
                "no latency, queue position or market impact",
                "fills capped by visible depth when an orderbook was available",
                "settlement fees are not modelled",
            ],
        },
        "coverage": {
            "markets_tested": tested,
            "markets_skipped": skipped,
            "candle_cells": cells,
            "tracked_markets": len(markets),
        },
        "portfolio": snapshot,
    }
