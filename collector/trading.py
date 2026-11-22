"""Paper-trading loop + demo-account portfolio sync.

paper trades  : simulated, settled from the market's official `result` field,
                fees per the official schedule, no exchange access needed.
portfolio sync: reads the *demo account* (balance + positions) through signed
                REST calls when KALSHI_DEMO_API_KEY_ID / KALSHI_DEMO_PRIVATE_KEY
                are configured; otherwise records that it is unconfigured rather
                than substituting made-up numbers.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

try:
    from .kalshi import as_float, read_json, write_json
    from .strategy import STRATEGIES, STRATEGY_INDEX, build_trade, settle_trade, summarise
except ImportError:  # direct execution
    from kalshi import as_float, read_json, write_json  # type: ignore
    from strategy import STRATEGIES, STRATEGY_INDEX, build_trade, settle_trade, summarise  # type: ignore

MAX_OPEN_PER_STRATEGY = 6
MAX_TRADES = 4000


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_history(data_dir: str, ticker: str) -> list[dict]:
    doc = read_json(os.path.join(data_dir, "history", f"{ticker}.json"), {}) or {}
    return doc.get("points") or []


def run(data_dir: str, markets: list[dict]) -> dict:
    path = os.path.join(data_dir, "paper_trades.json")
    trades: list[dict] = (read_json(path, {}) or {}).get("trades", [])
    by_ticker_market = {m["ticker"]: m for m in markets}

    # 1. Settle anything whose market now carries an official result.
    resolutions = (read_json(os.path.join(data_dir, "resolutions.json"), {}) or {}).get("records", [])
    res_by_ticker = {r["ticker"]: r for r in resolutions}
    for t in trades:
        if t.get("status") != "open":
            continue
        r = res_by_ticker.get(t["ticker"])
        if r and r.get("result") in ("yes", "no"):
            settle_trade(t, r["result"], r.get("settlement_value_dollars"), r.get("settlement_ts") or utc_now())
        else:
            m = by_ticker_market.get(t["ticker"])
            if m and m.get("result") in ("yes", "no"):
                settle_trade(t, m["result"], m.get("settlement_value_dollars"), m.get("settlement_ts") or utc_now())

    # 2. Open new simulated trades where a strategy's rule fires.
    orderbooks = (read_json(os.path.join(data_dir, "orderbooks.json"), {}) or {}).get("orderbooks", {})
    open_counts: dict[str, int] = {}
    for t in trades:
        if t.get("status") == "open":
            open_counts[t["strategy_id"]] = open_counts.get(t["strategy_id"], 0) + 1
    opened = 0
    for m in markets:
        if m.get("result") in ("yes", "no") or m.get("status") not in ("active", "open", None):
            continue
        points = load_history(data_dir, m["ticker"])
        if not points:
            continue
        ob = orderbooks.get(m["ticker"])
        for s in STRATEGIES:
            if open_counts.get(s["id"], 0) >= MAX_OPEN_PER_STRATEGY:
                continue
            if any(t["status"] == "open" and t["strategy_id"] == s["id"] and t["ticker"] == m["ticker"]
                   for t in trades):
                continue
            trade = build_trade(s, m, ob, points, trigger="scheduled cycle")
            if trade:
                trades.append(trade)
                open_counts[s["id"]] = open_counts.get(s["id"], 0) + 1
                opened += 1
                break  # one position per market per cycle

    trades = trades[-MAX_TRADES:]
    analytics = summarise(trades, STRATEGIES)
    analytics["opened_this_cycle"] = opened
    analytics["counts"] = {
        "open": sum(1 for t in trades if t.get("status") == "open"),
        "settled": sum(1 for t in trades if t.get("status") == "settled"),
        "total": len(trades),
    }
    return {"trades": trades, "analytics": analytics}


def sync_demo_portfolio(data_dir: str) -> dict:
    """Read the demo account's balance and positions via signed REST calls."""
    key_id = os.environ.get("KALSHI_DEMO_API_KEY_ID", "").strip()
    pem = os.environ.get("KALSHI_DEMO_PRIVATE_KEY", "").strip()
    path = os.path.join(data_dir, "portfolio.json")
    prev = read_json(path, {}) or {}
    if not key_id or not pem:
        doc = {
            "generated_at": utc_now(),
            "configured": False,
            "note": ("No demo API credentials configured. Set repository secrets "
                     "KALSHI_DEMO_API_KEY_ID and KALSHI_DEMO_PRIVATE_KEY to enable live "
                     "demo-account balance, positions and order execution."),
            "docs": "https://docs.kalshi.com/getting_started/quick_start_authenticated_requests",
            "history": prev.get("history", []),
        }
        write_json(path, doc)
        return doc

    try:
        from .kalshi_auth import signed_get
    except ImportError:
        from kalshi_auth import signed_get  # type: ignore

    balance = signed_get(key_id, pem, "/portfolio/balance")
    positions = signed_get(key_id, pem, "/portfolio/positions", {"settlement_status": "all", "limit": 200})
    doc: dict[str, Any] = {
        "generated_at": utc_now(),
        "configured": True,
        "environment": "demo",
        "balance": balance.get("balance"),
        "balance_dollars": balance.get("balance_dollars"),
        "portfolio_value": balance.get("portfolio_value"),
        "updated_ts": balance.get("updated_ts"),
        "balance_source_url": "https://demo-api.kalshi.co/trade-api/v2/portfolio/balance",
        "market_positions": positions.get("market_positions", []),
        "event_positions": positions.get("event_positions", []),
        "positions_source_url": ("https://demo-api.kalshi.co/trade-api/v2/portfolio/positions"
                                 "?settlement_status=all&limit=200"),
    }
    history = prev.get("history", [])
    if doc.get("balance") is not None:
        history.append({"ts": doc["updated_ts"] or utc_now(), "balance_cents": doc["balance"],
                        "portfolio_value": doc.get("portfolio_value")})
    doc["history"] = history[-2000:]
    write_json(path, doc)
    return doc
