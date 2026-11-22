#!/usr/bin/env python3
"""Read-only probe of the Kalshi DEMO public API.

Purpose: gather verifiable facts about the demo environment (what exists per
topic, whether candlesticks/trades/orderbook work, and the CORS headers a
browser would see) and write the raw evidence to a JSON file.

No credentials. No order placement. Standard library only.

Official sources for every endpoint used here:
  https://docs.kalshi.com/getting_started/demo_env
  https://docs.kalshi.com/api-reference/market/get-series-list
  https://docs.kalshi.com/api-reference/events/get-events
  https://docs.kalshi.com/api-reference/market/get-market
  https://docs.kalshi.com/api-reference/market/get-market-orderbook
  https://docs.kalshi.com/api-reference/market/get-market-candlesticks
  https://docs.kalshi.com/api-reference/market/get-trades
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("KALSHI_BASE", "https://external-api.demo.kalshi.co/trade-api/v2").rstrip("/")
OUT = os.environ.get("PROBE_OUT", "probe/demo_probe.json")
TOPICS = {
    "gas": {"category": "Commodities", "tags": "Oil & Gas"},
    "elections": {"category": "Elections"},
    "culture": {"category": "Entertainment"},
    "crypto": {"category": "Crypto"},
    "golf": {"category": "Sports", "tags": "Golf"},
}


def get(path, params=None):
    url = BASE + path + (("?" + urllib.parse.urlencode(params)) if params else "")
    req = urllib.request.Request(url, headers={"Accept": "application/json",
                                               "User-Agent": "Tradebot2-probe/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            headers = dict(r.getheaders())
            body = json.loads(r.read().decode("utf-8"))
        return {"url": url, "status": 200, "headers": headers, "body": body}
    except urllib.error.HTTPError as e:
        return {"url": url, "status": e.code, "headers": dict(e.headers or {}), "error": e.read()[:400].decode("utf-8", "replace")}
    except Exception as e:  # noqa: BLE001 - probe must not abort on one failure
        return {"url": url, "status": 0, "error": str(e)}


def main():
    started = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    out = {"generated_at": started, "api_base": BASE, "topics": {}, "cors": {}, "samples": {}, "errors": []}

    # 1. Exchange status (documents that the environment is live)
    st = get("/exchange/status")
    out["exchange_status"] = {k: st.get(k) for k in ("url", "status", "error")}

    # 2. Per-topic series catalog + counts
    for key, flt in TOPICS.items():
        params = dict(flt, include_volume="true", limit=200)
        r = get("/series", params)
        series = (r.get("body") or {}).get("series") or []
        rows = []
        for s in series:
            rows.append({"ticker": s.get("ticker"), "title": s.get("title"),
                         "category": s.get("category"), "tags": s.get("tags"),
                         "volume": s.get("volume_fp"), "frequency": s.get("frequency"),
                         "last_updated_ts": s.get("last_updated_ts")})
        rows.sort(key=lambda x: float(x["volume"] or 0), reverse=True)
        out["topics"][key] = {"filter": flt, "url": r.get("url"), "status": r.get("status"),
                              "series_count": len(rows), "series": rows}
        if r.get("error"):
            out["errors"].append({"where": "series", "topic": key, "status": r.get("status"), "error": r["error"]})
        time.sleep(0.4)

    # 3. Open events with nested markets for the top series of each topic
    out["events"] = {}
    for key, info in out["topics"].items():
        picked = info["series"][:12]
        ev_rows = []
        for s in picked:
            r = get("/events", {"series_ticker": s["ticker"], "status": "open",
                                "with_nested_markets": "true", "limit": 200})
            events = (r.get("body") or {}).get("events") or []
            if r.get("error"):
                out["errors"].append({"where": "events", "series": s["ticker"], "status": r.get("status")})
            for ev in events:
                ev_rows.append({"event_ticker": ev.get("event_ticker"), "series_ticker": ev.get("series_ticker"),
                                "title": ev.get("title"), "category": ev.get("category"),
                                "markets": [{
                                    "ticker": m.get("ticker"), "title": m.get("title"),
                                    "yes_sub_title": m.get("yes_sub_title"), "status": m.get("status"),
                                    "yes_bid": m.get("yes_bid_dollars"), "yes_ask": m.get("yes_ask_dollars"),
                                    "last": m.get("last_price_dollars"),
                                    "volume": m.get("volume_fp"), "volume_24h": m.get("volume_24h_fp"),
                                    "open_interest": m.get("open_interest_fp"),
                                    "liquidity": m.get("liquidity_dollars"),
                                    "close_time": m.get("close_time"),
                                } for m in ev.get("markets") or []],
                                "source_url": r["url"]})
            time.sleep(0.3)
        out["events"][key] = {"events": ev_rows, "count": len(ev_rows)}

    # 4. Pick the busiest market overall and sample orderbook / candles / trades / CORS
    best = None
    for key, blob in out["events"].items():
        for ev in blob["events"]:
            for m in ev["markets"]:
                v = float(m.get("volume_24h") or 0)
                if m.get("ticker") and (best is None or v > best[0]):
                    best = (v, key, ev, m)
    if best:
        _, key, ev, m = best
        t = m["ticker"]
        series = ev["series_ticker"]
        now = int(time.time())
        book = get(f"/markets/{t}/orderbook", {"depth": 20})
        candles = get(f"/series/{series}/markets/{t}/candlesticks",
                      {"start_ts": now - 3600, "end_ts": now, "period_interval": 1})
        trades = get("/markets/trades", {"ticker": t, "limit": 200})
        market = get(f"/markets/{t}")
        out["samples"] = {
            "ticker": t, "series_ticker": series, "topic": key,
            "orderbook": {"url": book.get("url"), "status": book.get("status"),
                          "headers": book.get("headers"), "body": book.get("body"), "error": book.get("error")},
            "candlesticks": {"url": candles.get("url"), "status": candles.get("status"),
                             "body": candles.get("body"), "error": candles.get("error")},
            "trades": {"url": trades.get("url"), "status": trades.get("status"),
                       "body": trades.get("body"), "error": trades.get("error")},
            "market": {"url": market.get("url"), "status": market.get("status"),
                       "body": market.get("body"), "error": market.get("error")},
        }
        # CORS: the browser-facing question is whether Access-Control-Allow-Origin is returned.
        ob_h = {k.lower(): v for k, v in (book.get("headers") or {}).items()}
        out["cors"] = {k: ob_h.get(k) for k in
                       ("access-control-allow-origin", "access-control-allow-methods",
                        "access-control-allow-headers", "content-type")}

    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print("probe written:", OUT)
    print("series counts:", {k: v["series_count"] for k, v in out["topics"].items()})
    print("open events:", {k: v["count"] for k, v in out["events"].items()})
    print("cors:", out["cors"])
    print("errors:", len(out["errors"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
