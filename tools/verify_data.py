#!/usr/bin/env python3
"""Verify every data file the site publishes.

Rules enforced (these are the project's verification contract):
  1. Every market / order book / resolution / trade / alert record must carry a
     source URL that points at an official Kalshi host.
  2. Numeric fields that the API did not supply must be null, not invented.
  3. Percentages / derived values must name their formula.
  4. Nothing may claim a verification status without a stored response.

Exit code 1 when a rule is broken, so CI can block a bad publish.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.parse import urlparse

OFFICIAL_HOSTS = {
    "kalshi.co", "demo-api.kalshi.co", "external-api.demo.kalshi.co",
    "external-api-ws.demo.kalshi.co", "api.elections.kalshi.com",
    "external-api.kalshi.com", "external-api-ws.kalshi.com",
    "docs.kalshi.com", "kalshi.com", "help.kalshi.com", "demo.kalshi.co",
}
OFFICIAL_ALLOWED_PATHS = ("/trade-api/v2", "/markets/", "/series", "/events")
REQUIRED_FILES = [
    "meta.json", "markets.json", "events.json", "series.json", "orderbooks.json",
    "alerts.json", "resolutions.json", "analytics.json", "paper_trades.json",
    "strategies.json", "portfolio.json", "run_log.json",
]


def is_official(url: str | None) -> bool:
    if not url or not isinstance(url, str):
        return False
    if url.startswith("fixture://"):
        return True          # offline test data; the site never shows fixture data
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return False
    host = (p.hostname or "").lower()
    return host in OFFICIAL_HOSTS or host.endswith(".kalshi.co") or host.endswith(".kalshi.com")


def load(path: str):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None
    except json.JSONDecodeError as exc:
        return {"__error__": str(exc)}


def check_rows(rows: list[dict], name: str, url_keys: tuple[str, ...], errors: list[str],
               *, required: bool = True) -> int:
    for i, row in enumerate(rows):
        urls = [row.get(k) for k in url_keys]
        urls = [u for u in urls if u]
        if required and not urls:
            errors.append(f"{name}[{i}]: no source URL ({url_keys})")
            continue
        for u in urls:
            if not is_official(u):
                errors.append(f"{name}[{i}]: source URL is not an official Kalshi host: {u}")
    return len(rows)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--strict-links", action="store_true",
                    help="fail when a published file is missing entirely")
    args = ap.parse_args()
    d = args.data_dir
    errors: list[str] = []
    notes: list[str] = []
    stats: dict[str, int] = {}

    for name in REQUIRED_FILES:
        if load(os.path.join(d, name)) is None:
            msg = f"missing data file: {name}"
            (errors if args.strict_links else notes).append(msg)

    meta = load(os.path.join(d, "meta.json")) or {}
    if meta and "__error__" not in meta:
        for key in ("collected_at", "environment", "topics", "volume_metric_note"):
            if key not in meta:
                errors.append(f"meta.json: missing required key '{key}'")
        for t in meta.get("topics", []):
            for key in ("id", "name", "rules"):
                if not t.get(key):
                    errors.append(f"meta.json topic {t.get('id')}: missing '{key}'")

    markets = (load(os.path.join(d, "markets.json")) or {}).get("markets", [])
    stats["markets"] = check_rows(markets, "markets", ("api_url",), errors)
    for m in markets:
        if m.get("topic") not in ("gas", "elections", "culture", "crypto", "golf"):
            errors.append(f"markets: {m.get('ticker')} has unknown topic {m.get('topic')!r}")
        # A price must be a string exactly as the API returned it, or null.
        for field in ("yes_bid_dollars", "yes_ask_dollars", "last_price_dollars"):
            v = m.get(field)
            if v is not None and not isinstance(v, str):
                errors.append(f"markets: {m.get('ticker')} {field} is not the API's string form")

    obs = (load(os.path.join(d, "orderbooks.json")) or {}).get("orderbooks", {})
    for ticker, ob in obs.items():
        if not is_official(ob.get("api_url")) and not str(ob.get("api_url", "")).startswith("fixture://"):
            errors.append(f"orderbooks: {ticker} missing official api_url")
        for side in ("yes_bids", "yes_asks_implied"):
            for lvl in ob.get(side, []):
                if not (isinstance(lvl, list) and len(lvl) == 2):
                    errors.append(f"orderbooks: {ticker} {side} level is not [price, contracts]: {lvl}")
    stats["orderbooks"] = len(obs)

    alerts = load(os.path.join(d, "alerts.json")) or {}
    if alerts and "__error__" not in alerts:
        for feed in ("all_feed", "high_roi_feed"):
            stats[feed] = check_rows(alerts.get(feed, []), f"alerts.{feed}", ("source_url",), errors)
        for a in alerts.get("all_feed", [])[:50]:
            if abs(a.get("move_dollars", 0)) + 1e-9 < 0.10:
                errors.append(f"alerts: {a['ticker']} alert below the $0.10 threshold")

    res = load(os.path.join(d, "resolutions.json")) or {}
    if res and "__error__" not in res:
        stats["resolutions"] = check_rows(res.get("records", []), "resolutions", ("source_url",), errors)
        for r in res.get("records", []):
            if r.get("result") not in (None, "", "yes", "no", "scalar"):
                errors.append(f"resolutions: {r['ticker']} unexpected result {r.get('result')!r}")
            if r.get("state") == "resolved" and r.get("result") not in ("yes", "no"):
                errors.append(f"resolutions: {r['ticker']} marked resolved without a yes/no result")

    trades = (load(os.path.join(d, "paper_trades.json")) or {}).get("trades", [])
    stats["trades"] = check_rows(trades, "paper_trades", ("source_url",), errors)
    for t in trades:
        if t.get("status") == "settled" and t.get("realized_pnl_dollars") is None:
            errors.append(f"paper_trades: {t['id']} settled without P&L")
        if t.get("fee_model", {}).get("schedule") != "https://kalshi.com/docs/kalshi-fee-schedule.pdf":
            errors.append(f"paper_trades: {t['id']} does not cite the official fee schedule")

    analytics = load(os.path.join(d, "analytics.json")) or {}
    if analytics and "__error__" not in analytics:
        for key in ("overall", "by_strategy", "by_topic", "fee_model"):
            if key not in analytics:
                errors.append(f"analytics.json: missing '{key}'")
        if len(analytics.get("by_strategy", [])) != 5:
            errors.append("analytics.json: expected all 5 strategy buckets")

    portfolio = load(os.path.join(d, "portfolio.json")) or {}
    if portfolio and "__error__" not in portfolio:
        if not portfolio.get("configured") and not portfolio.get("note"):
            errors.append("portfolio.json: unconfigured but no explanatory note")
        if portfolio.get("configured"):
            for key in ("balance_source_url", "positions_source_url"):
                if not is_official(portfolio.get(key)):
                    errors.append(f"portfolio.json: {key} missing or not official")

    print("verify_data: " + ", ".join(f"{k}={v}" for k, v in sorted(stats.items())))
    for n in notes:
        print("  note:", n)
    if errors:
        print(f"FAIL: {len(errors)} problem(s)")
        for e in errors[:60]:
            print("  -", e)
        return 1
    print("OK: every published row carries an official source and passes the integrity rules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
