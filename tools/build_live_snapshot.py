#!/usr/bin/env python3
"""Small, source-linked bootstrap for /live/; never a substitute for live quotes.

Without --verify-live this only projects fields already in data/snapshot.json.
With --verify-live it re-reads every selected ticker from the official demo REST
API and retains only allowlisted public fields. Missing fields stay null. The
source hash and optional Actions run URL make the dated capture reproducible.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://external-api.demo.kalshi.co/trade-api/v2"
HOSTS = {"external-api.demo.kalshi.co", "demo-api.kalshi.co"}
TOPICS = {"gas_prices": "gas", "elections": "elections", "culture": "culture", "crypto": "crypto", "golf": "golf"}
FIELDS = (
    "ticker event_ticker title yes_sub_title market_type status result close_time "
    "expected_expiration_time latest_expiration_time settlement_ts settlement_value_dollars "
    "yes_bid_dollars yes_ask_dollars no_bid_dollars no_ask_dollars yes_bid_size_fp yes_ask_size_fp "
    "last_price_dollars previous_price_dollars volume_fp volume_24h_fp open_interest_fp "
    "notional_value_dollars rules_primary rules_secondary price_level_structure can_close_early"
).split()


def official_url(url: str, ticker: str) -> str:
    parsed = urlparse(url)
    if (parsed.scheme != "https" or parsed.netloc not in HOSTS
            or parsed.path != f"/trade-api/v2/markets/{quote(ticker, safe='')}"
            or parsed.query or parsed.fragment):
        raise ValueError(f"{ticker}: missing or non-official exact market source: {url!r}")
    return url


def project(row: dict, captured_at: str) -> dict:
    """Renaming, not estimation: no $1 notional, status or size defaults."""
    ticker = row["ticker"]
    source = official_url((row.get("links") or {}).get("market_api", ""), ticker)
    p, v = row.get("prices") or {}, row.get("volume") or {}
    out = {key: None for key in FIELDS}
    for key in FIELDS:
        if key in row and key not in {"volume_fp", "volume_24h_fp"}:
            out[key] = row[key]
    mapping = {"yes_bid_dollars": "yes_bid", "yes_ask_dollars": "yes_ask",
               "no_bid_dollars": "no_bid", "no_ask_dollars": "no_ask",
               "last_price_dollars": "last", "previous_price_dollars": "previous"}
    for dest, src in mapping.items():
        out[dest] = p.get(src)
    out.update(volume_fp=v.get("total_contracts"), volume_24h_fp=v.get("last_24h_contracts"),
               open_interest_fp=v.get("open_interest_contracts"),
               series_ticker=row.get("series_ticker"), topic=TOPICS[row["topic"]],
               event_title=row.get("event_title") or None,
               settlement_sources=(row.get("links") or {}).get("settlement_sources", []),
               source_url=source, observed_at=captured_at,
               candles={k: cells[-120:] for k, cells in (row.get("candles") or {}).items() if k in {"1m", "1h"}})
    return out


def build(snapshot: dict, raw: dict | None = None, *, checked_at: str | None = None,
          source_hash: str | None = None, events: dict | None = None) -> dict:
    if urlparse(snapshot.get("api_base", "")).netloc not in HOSTS:
        raise ValueError("only official demo captures are accepted")
    if not snapshot.get("generated_at"):
        raise ValueError("capture time is required")
    selected = snapshot.get("markets", [])
    tickers = [r["ticker"] for r in selected]
    if len(set(tickers)) != len(tickers):
        raise ValueError("duplicate selected tickers")
    if raw is not None and set(tickers) - raw.keys():
        raise ValueError(f"selected tickers not re-verified: {sorted(set(tickers) - raw.keys())}")
    markets = []
    for row in selected:
        m = project(row, snapshot["generated_at"])
        if raw is not None:
            current = raw[row["ticker"]]
            if current.get("ticker") != row["ticker"] or current.get("event_ticker") != row.get("event_ticker"):
                raise ValueError(f"identity mismatch: {row['ticker']}")
            for field in FIELDS:
                m[field] = current.get(field)
            m["observed_at"] = current.get("_capture_read_at") or checked_at
        event = (events or {}).get(m["event_ticker"], {})
        if event:
            m["event_title"] = event.get("title") or None
            m["settlement_sources"] = event.get("settlement_sources") or m["settlement_sources"]
        markets.append(m)
    # A bounded, per-topic sample for quick page loads. The full sourced archive
    # remains in data/snapshot.json; no count below is represented as exhaustive.
    resolutions = []
    seen = set(tickers)
    for topic in TOPICS:
        rows = sorted((r for r in snapshot.get("resolutions", []) if r.get("topic") == topic),
                      key=lambda r: r.get("close_time") or "", reverse=True)
        kept = 0
        for row in rows:
            if row["ticker"] in seen:
                continue
            if row.get("result") not in {"yes", "no"}:
                raise ValueError(f"invalid binary result: {row['ticker']}")
            resolutions.append(project(row, snapshot["generated_at"]))
            seen.add(row["ticker"])
            kept += 1
            if kept == 40:
                break
    run_url = None
    if os.environ.get("GITHUB_RUN_ID"):
        run_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    return {
        "schema_version": 2, "environment": "demo", "snapshotTs": checked_at or snapshot["generated_at"],
        "source": snapshot["api_base"],
        "_README": "Dated official demo capture, not a live tape. Browser quotes must be re-fetched before alerts or paper fills. Missing fields stay null.",
        "provenance": {"input": "data/snapshot.json", "sha256": source_hash,
                       "selection_at": snapshot["generated_at"], "reverified_at": checked_at,
                       "mode": "official REST re-read" if raw is not None else "projection of committed official capture",
                       "actions_run": run_url},
        "coverage": {"selected_markets": len(markets), "resolved_sample": len(resolutions),
                     "full_capture_stats": snapshot.get("stats", {}), "topics": snapshot.get("topics", []),
                     "selection": (snapshot.get("meta") or {}).get("selection"),
                     "note": "Selected contracts only, not the whole exchange or complete event books. Rank is 24h face notional where supplied; otherwise contracts. Counts from the full capture are dated, not live counts."},
        "markets": markets, "resolutions": resolutions,
    }


def verify_public(snapshot: dict) -> tuple[dict, dict, str]:
    import requests
    session = requests.Session()
    session.headers["Accept"] = "application/json"

    def get(path: str, params=None):
        for attempt in range(5):
            response = session.get(BASE + path, params=params, timeout=25)
            if response.status_code in {429, 500, 502, 503, 504} and attempt < 4:
                time.sleep(min(2 ** attempt, 12))
                continue
            response.raise_for_status()
            time.sleep(0.10)
            return response.json()
        raise RuntimeError("unreachable")

    raw, events = {}, {}
    tickers = [r["ticker"] for r in snapshot["markets"]]
    for offset in range(0, len(tickers), 60):
        # tickers-only query is unpaged per the official Get Markets docs.
        batch = tickers[offset:offset + 60]
        data = get("/markets", {"tickers": ",".join(batch)})
        for m in data.get("markets", []):
            if m.get("ticker") in batch:
                raw[m["ticker"]] = dict(m, _capture_read_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"))
    for ticker in set(tickers) - raw.keys():
        # An old cohort can have moved behind the historical cutoff.
        try:
            raw[ticker] = get(f"/markets/{quote(ticker, safe='')}")["market"]
        except requests.HTTPError as exc:
            if exc.response.status_code != 404:
                raise
            raw[ticker] = get(f"/historical/markets/{quote(ticker, safe='')}")["market"]
    for event_ticker in sorted({m.get("event_ticker") for m in raw.values()} - {None}):
        try:
            events[event_ticker] = get(f"/events/{quote(event_ticker, safe='')}").get("event", {})
        except requests.HTTPError as exc:
            if exc.response.status_code != 404:
                raise
            # Event title is optional, never invented from the ticker.
            events[event_ticker] = {}
    return raw, events, datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "data/snapshot.json")
    parser.add_argument("--out", type=Path, default=ROOT / "live/data/fallback-snapshot.json")
    parser.add_argument("--verify-live", action="store_true")
    args = parser.parse_args()
    blob = args.input.read_bytes()
    snapshot = json.loads(blob)
    raw, events, checked = verify_public(snapshot) if args.verify_live else (None, None, None)
    output = build(snapshot, raw, checked_at=checked, events=events, source_hash=hashlib.sha256(blob).hexdigest())
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temp = args.out.with_suffix(".tmp")
    temp.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temp.replace(args.out)
    print(f"{args.out}: {len(output['markets'])} selected, {len(output['resolutions'])} sampled resolutions; {args.out.stat().st_size:,} bytes; {output['provenance']['mode']}")


if __name__ == "__main__":
    main()
