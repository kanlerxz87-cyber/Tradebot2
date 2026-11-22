#!/usr/bin/env python3
"""Check, topic by topic, that the demo API actually returns open markets.

The dashboard's per-topic counts come from a scan of `/markets?status=open`.
When a topic reports zero the site shows an empty state, so this probe separates
"the API has no such markets" from "our scan did not see them" by querying one
known series per topic directly.

Writes probe/coverage.json and prints a table. Network required.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request

HOSTS = ("https://external-api.demo.kalshi.co", "https://demo-api.kalshi.co")
SERIES = {
    "gas_prices": ["KXAAAGASW", "KXWTI"],
    "elections": ["KXPRESPERSON", "KXSENATEIAD"],
    "culture": ["KXTIME"],
    "crypto": ["KXBTCD"],
    "golf": ["KXPGATOUR", "KXMASTERS"],
}


def get(base: str, path: str, params: dict[str, str] | None = None) -> tuple[int, object]:
    url = base + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers={"User-Agent": "tradebot2-coverage-probe"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except Exception as exc:  # noqa: BLE001 - report, never raise
        return 0, {"error": str(exc), "url": url}


def main() -> int:
    out: dict[str, object] = {"series": {}, "totals": {}}
    base = None
    for host in HOSTS:
        status, payload = get(host, "/trade-api/v2/exchange/status")
        if status == 200:
            base = host + "/trade-api/v2"
            out["exchange_status"] = {"host": host, "status": status, "body": payload}
            break
    if not base:
        print("no demo host reachable")
        return 1
    out["api_base"] = base

    for topic, series_list in SERIES.items():
        rows = {}
        for series in series_list:
            status, payload = get(base, "/markets", {"status": "open", "series_ticker": series, "limit": "200"})
            markets = (payload or {}).get("markets", []) if isinstance(payload, dict) else []
            rows[series] = {
                "url": f"{base}/markets?status=open&series_ticker={series}&limit=200",
                "http_status": status,
                "open_markets": len(markets),
                "cursor_truncated": bool((payload or {}).get("cursor")) if isinstance(payload, dict) else None,
                "sample": [
                    {"ticker": m.get("ticker"), "title": m.get("title"),
                     "category": m.get("category"), "event_ticker": m.get("event_ticker")}
                    for m in markets[:3]
                ],
            }
        out["series"][topic] = rows
        out["totals"][topic] = sum(r["open_markets"] for r in rows.values())

    # Golf chain: does /series list golf, and do its markets' events point back
    # at those series tickers? This is what the collector relies on.
    chain: dict[str, object] = {}
    status, series_page = get(base, "/series", {"category": "Sports", "tags": "Golf", "limit": "200"})
    series_rows = (series_page or {}).get("series", []) if isinstance(series_page, dict) else []
    chain["series_http"] = status
    chain["series_count"] = len(series_rows)
    chain["series_tickers"] = [r.get("ticker") for r in series_rows[:5]]
    if series_rows:
        first = str(series_rows[0].get("ticker"))
        status, markets_page = get(base, "/markets", {"status": "open", "series_ticker": first, "limit": "2"})
        markets = (markets_page or {}).get("markets", []) if isinstance(markets_page, dict) else []
        chain["markets_http"] = status
        chain["markets_seen"] = len(markets)
        chain["market"] = [
            {"ticker": m.get("ticker"), "event_ticker": m.get("event_ticker"),
             "series_ticker": m.get("series_ticker"), "title": m.get("title")}
            for m in markets[:2]
        ]
        if markets:
            event_ticker = str(markets[0].get("event_ticker"))
            status, events_page = get(base, "/events", {"event_ticker": event_ticker, "limit": "2"})
            events = (events_page or {}).get("events", []) if isinstance(events_page, dict) else []
            chain["event_http"] = status
            chain["event"] = [
                {"event_ticker": e.get("event_ticker"), "series_ticker": e.get("series_ticker"),
                 "category": e.get("category"), "title": e.get("title")}
                for e in events[:2]
            ]
    out["golf_chain"] = chain
    print(json.dumps(chain, indent=1)[:1200])

    print(json.dumps(out["totals"], indent=1))
    for topic, rows in out["series"].items():
        for series, row in rows.items():
            print(f"{topic:11s} {series:16s} HTTP {row['http_status']} open={row['open_markets']} "
                  f"truncated={row['cursor_truncated']} sample={row['sample'][:1]}")

    os.makedirs("probe", exist_ok=True)
    with open("probe/coverage.json", "w", encoding="utf-8") as handle:
        json.dump(out, handle, indent=1, sort_keys=True)
    print("wrote probe/coverage.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
