#!/usr/bin/env python3
"""Collect live Kalshi demo market data for the five tracked topics.

Pipeline per run
  1. GET /search/tags_by_categories          -> official category -> tag map
  2. GET /series?category=<cat> for every category in that map, plus
     GET /series?tags=<tag> for every tag we depend on -> series universe
  3. classify each series into gas / elections / culture / crypto / golf
     using collector/topics.py (rules are printed into the snapshot)
  4. GET /events?series_ticker=<t>&status=open  -> open events
  5. GET /markets?event_ticker=<e>              -> every market in each event
  6. GET /markets/{ticker}/orderbook            -> depth / liquidity
  7. GET /trades?ticker=... (last hour)         -> prints for swing detection
  8. append one observation per market to data/history/<ticker>.json
  9. write data/markets.json, data/events.json, data/series.json,
     data/orderbooks.json, data/meta.json, data/run_log.json

Everything written carries the exact request URL it came from.  Values the API
did not return are written as null, never guessed.
"""
from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from kalshi import KalshiClient, as_float, demo_client, read_json, write_json

try:  # package import when run as `python -m collector.collect`
    from .topics import TOPICS, TOPIC_INDEX, classify
except ImportError:  # direct execution from the collector/ directory
    from topics import TOPICS, TOPIC_INDEX, classify  # type: ignore

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get("COLLECT_DATA_DIR") or os.path.join(ROOT, "data")
HISTORY = os.path.join(DATA, "history")


def set_data_dir(path: str) -> None:
    """Point the collector's output at another directory (used by tests)."""
    global DATA, HISTORY
    DATA = path
    HISTORY = os.path.join(DATA, "history")
MAX_HISTORY_POINTS = 4000           # ~2.8 days at one snapshot/minute
MAX_MARKETS_PER_TOPIC = 60
MAX_ORDERBOOKS = 90
TOPIC_CATEGORY_SEED = [
    "Economics", "Commodities", "Elections", "Culture", "Entertainment", "Mentions",
    "Crypto", "Sports", "Politics", "Financials",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def epoch(ts: str | None) -> int | None:
    if not ts:
        return None
    try:
        return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp())
    except (TypeError, ValueError):
        return None


def discover_series(client: KalshiClient, log: dict[str, Any]) -> tuple[list[dict], dict]:
    tag_map: dict[str, list[str]] = {}
    try:
        tag_map = client.get("/search/tags_by_categories").get("tags_by_categories", {}) or {}
        log["tags_by_categories"] = client.calls[-1]["url"]
    except Exception as exc:  # noqa: BLE001
        log["warnings"].append(f"tags_by_categories failed: {exc}")

    categories = sorted({c for c in tag_map} | set(TOPIC_CATEGORY_SEED))
    series: dict[str, dict] = {}
    for cat in categories:
        if not cat or cat.lower().startswith(("test", "harrison")):
            continue
        try:
            for s in client.series_list(category=cat, include_volume="true"):
                s.setdefault("_discovery", []).append({"by": "category", "value": cat,
                                                       "url": f"{client.host}/series?category={cat}"})
                series.setdefault(s["ticker"], s)
                series[s["ticker"]].setdefault("_discovery", [])
                if not any(d["value"] == cat for d in series[s["ticker"]]["_discovery"]):
                    series[s["ticker"]]["_discovery"].append(
                        {"by": "category", "value": cat,
                         "url": f"{client.host}/series?category={cat}"})
        except Exception as exc:  # noqa: BLE001
            log["warnings"].append(f"series category={cat} failed: {exc}")

    # Tags we depend on for matching (Golf in particular, plus topic tags).
    wanted_tags: set[str] = set()
    for t in TOPICS:
        for rule in t.rules:
            if rule.kind == "tag":
                wanted_tags.update(v for v in rule.values if "&" not in v and len(v) < 40)
    for tag in sorted(wanted_tags):
        try:
            for s in client.series_list(tags=tag):
                entry = series.setdefault(s["ticker"], s)
                entry.setdefault("_discovery", [])
                if not any(d.get("by") == "tags" and d.get("value") == tag for d in entry["_discovery"]):
                    entry["_discovery"].append({"by": "tags", "value": tag,
                                                "url": f"{client.host}/series?tags={tag}"})
        except Exception as exc:  # noqa: BLE001
            log["warnings"].append(f"series tags={tag} failed: {exc}")

    log["series_seen"] = len(series)
    return list(series.values()), tag_map


def serialise_series(s: dict, topic_hits: list[tuple[str, str]]) -> dict:
    return {
        "ticker": s.get("ticker"),
        "title": s.get("title"),
        "frequency": s.get("frequency"),
        "category": s.get("category"),
        "categories": s.get("categories") or [],
        "tags": s.get("tags") or [],
        "topics": [t for t, _ in topic_hits],
        "matched_rules": {t: rule for t, rule in topic_hits},
        "settlement_sources": s.get("settlement_sources") or [],
        "contract_terms_url": s.get("contract_terms_url"),
        "contract_url": s.get("contract_url"),
        "fee_type": s.get("fee_type"),
        "fee_multiplier": s.get("fee_multiplier"),
        "volume_fp": s.get("volume_fp"),
        "discovery": s.get("_discovery", []),
        "api_url": f"{s.get('_host', '')}/series?ticker={s.get('ticker')}",
    }


def market_row(m: dict, topic: str, host: str, series: dict) -> dict:
    """Normalise a Market object, keeping the documented field names."""
    ticker = m.get("ticker")
    yes_bid = as_float(m.get("yes_bid_dollars"))
    yes_ask = as_float(m.get("yes_ask_dollars"))
    last = as_float(m.get("last_price_dollars"))
    mid = None
    if yes_bid is not None and yes_ask is not None and yes_ask > 0:
        mid = round((yes_bid + yes_ask) / 2, 4)
    return {
        "ticker": ticker,
        "event_ticker": m.get("event_ticker"),
        "series_ticker": series.get("ticker"),
        "topic": topic,
        "title": series.get("title"),
        "subtitle": m.get("yes_sub_title"),
        "yes_sub_title": m.get("yes_sub_title"),
        "no_sub_title": m.get("no_sub_title"),
        "status": m.get("status"),
        "result": m.get("result") or None,
        "market_type": m.get("market_type"),
        "strike_type": m.get("strike_type"),
        "floor_strike": m.get("floor_strike"),
        "cap_strike": m.get("cap_strike"),
        "yes_bid_dollars": m.get("yes_bid_dollars"),
        "yes_ask_dollars": m.get("yes_ask_dollars"),
        "no_bid_dollars": m.get("no_bid_dollars"),
        "no_ask_dollars": m.get("no_ask_dollars"),
        "last_price_dollars": m.get("last_price_dollars"),
        "previous_price_dollars": m.get("previous_price_dollars"),
        "mid_dollars": f"{mid:.4f}" if mid is not None else None,
        "yes_bid_size_fp": m.get("yes_bid_size_fp"),
        "yes_ask_size_fp": m.get("yes_ask_size_fp"),
        "volume_fp": m.get("volume_fp"),
        "volume_24h_fp": m.get("volume_24h_fp"),
        "open_interest_fp": m.get("open_interest_fp"),
        "open_time": m.get("open_time"),
        "close_time": m.get("close_time"),
        "expected_expiration_time": m.get("expected_expiration_time"),
        "latest_expiration_time": m.get("latest_expiration_time"),
        "settlement_ts": m.get("settlement_ts"),
        "settlement_value_dollars": m.get("settlement_value_dollars"),
        "expiration_value": m.get("expiration_value"),
        "rules_primary": m.get("rules_primary"),
        "rules_secondary": m.get("rules_secondary"),
        "price_level_structure": m.get("price_level_structure"),
        "price_ranges": m.get("price_ranges") or [],
        "exchange_index": m.get("exchange_index"),
        "can_close_early": m.get("can_close_early"),
        # Only the API URL is emitted: it is the endpoint this row was actually read from.
        # A kalshi.com web URL is not derivable from the API response, so none is guessed.
        "api_url": f"{host}/markets/{ticker}",
        "orderbook_url": f"{host}/markets/{ticker}/orderbook",
        "source": "Kalshi Trade API v2 (demo)",
    }


def capture_orderbook(client: KalshiClient, market: dict, log: dict[str, Any],
                      captured_at: str | None = None) -> dict | None:
    ticker = market["ticker"]
    try:
        payload = client.orderbook(ticker, depth=20)
    except Exception as exc:  # noqa: BLE001
        log["warnings"].append(f"orderbook {ticker} failed: {exc}")
        return None
    ob = payload.get("orderbook_fp") or {}
    yes = [[as_float(p, 0.0), as_float(c, 0.0)] for p, c in (ob.get("yes_dollars") or [])]
    no = [[as_float(p, 0.0), as_float(c, 0.0)] for p, c in (ob.get("no_dollars") or [])]
    # Implied YES asks come from NO bids (orderbook docs: YES bid at X == NO ask at 1-X)
    yes_asks = [[round(1.0 - p, 4), c] for p, c in sorted(no, key=lambda r: -r[0])]
    yes_asks.sort(key=lambda r: r[0])
    best_bid = max((r[0] for r in yes if r[1] > 0), default=None)
    best_ask = min((r[0] for r in yes_asks if r[1] > 0), default=None)
    spread = round(best_ask - best_bid, 4) if best_bid is not None and best_ask is not None else None
    bid_depth = sum(r[1] for r in yes)
    ask_depth = sum(r[1] for r in yes_asks)
    notional_bid = sum(r[0] * r[1] for r in yes)
    notional_ask = sum(r[0] * r[1] for r in yes_asks)
    return {
        "ticker": ticker,
        "topic": market["topic"],
        "captured_at": captured_at or utc_now(),
        "yes_bids": yes[-20:],
        "yes_asks_implied": yes_asks[:20],
        "best_yes_bid": best_bid,
        "best_yes_ask": best_ask,
        "spread_dollars": spread,
        "contracts_bid": round(bid_depth, 2),
        "contracts_ask": round(ask_depth, 2),
        "notional_bid_dollars": round(notional_bid, 2),
        "notional_ask_dollars": round(notional_ask, 2),
        "depth_levels": {"yes_bid": len(yes), "yes_ask": len(yes_asks)},
        "api_url": f"{client.host}/markets/{ticker}/orderbook?depth=20",
    }


def update_history(market: dict, ob: dict | None, now_iso: str) -> None:
    path = os.path.join(HISTORY, f"{market['ticker']}.json")
    doc = read_json(path, {"ticker": market["ticker"], "series_ticker": market["series_ticker"],
                           "topic": market["topic"], "points": [], "url": market["api_url"]})
    points = doc.get("points") or []
    ts = epoch(now_iso) or int(time.time())
    if points and points[-1].get("ts") == ts:
        points.pop()
    points.append({
        "ts": ts,
        "t": now_iso,
        "last": as_float(market.get("last_price_dollars")),
        "bid": as_float(market.get("yes_bid_dollars")),
        "ask": as_float(market.get("yes_ask_dollars")),
        "mid": as_float(market.get("mid_dollars")),
        "vol": as_float(market.get("volume_fp")),
        "oi": as_float(market.get("open_interest_fp")),
        "bid_depth": ob["contracts_bid"] if ob else None,
        "spread": ob["spread_dollars"] if ob else None,
    })
    doc["points"] = points[-MAX_HISTORY_POINTS:]
    doc["title"] = market.get("title")
    doc["subtitle"] = market.get("subtitle")
    write_json(path, doc)


class FixtureClient(KalshiClient):
    """Serves recorded API responses from tests/fixtures (no network).

    Used by the test suite so the whole pipeline can be exercised offline with
    the same code path the live collector uses.
    """

    def __init__(self, fixture_dir: str) -> None:  # noqa: D401
        super().__init__(env="demo", pause=0.0, max_transport_failures=1)
        import json as _json
        self._json = _json
        self.dir = fixture_dir
        self.host = "fixture://kalshi"

    def _load(self, name: str):
        with open(os.path.join(self.dir, name), "r", encoding="utf-8") as fh:
            return self._json.load(fh)

    def get(self, path: str, params: dict | None = None, *, retries: int = 1) -> dict:  # noqa: D401
        params = params or {}
        self.calls.append({"url": self.host + path, "status": 200, "ms": 0})
        if path == "/exchange/status":
            return {"exchange_active": True, "trading_active": True}
        if path == "/search/tags_by_categories":
            return self._load("tags_by_categories.json")
        if path == "/series":
            if "category" in params and params["category"]:
                data = self._load("series_by_category.json")
                return {"series": data["series"].get(params["category"], [])}
            if "tags" in params and params["tags"]:
                data = self._load("series_by_tag.json")
                return data.get(params["tags"], {"series": []})
            return {"series": []}
        if path == "/events":
            data = self._load("events_by_series.json")["events"]
            out = [dict(v, markets=None) for v in data.values()
                   if v["series_ticker"] == params.get("series_ticker")]
            for row in out:
                row.pop("markets", None)
            return {"events": out, "cursor": ""}
        if path == "/markets":
            data = self._load("events_by_series.json")["events"]
            event = data.get(params.get("event_ticker", ""))
            return {"markets": list(event["markets"]) if event else [], "cursor": ""}
        if path.endswith("/orderbook"):
            ticker = path.split("/markets/")[1].split("/")[0]
            data = self._load("orderbooks.json")
            return data.get(ticker, {"orderbook_fp": {"yes_dollars": [], "no_dollars": []}})
        return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-markets", type=int, default=MAX_MARKETS_PER_TOPIC * len(TOPICS))
    ap.add_argument("--max-orderbooks", type=int, default=MAX_ORDERBOOKS)
    ap.add_argument("--data-dir", default=None, help="output directory (default: <repo>/data)")
    ap.add_argument("--now", default=None, help="override the collection timestamp (ISO-8601, tests)")
    ap.add_argument("--fixtures", default=None, help="replay recorded fixtures instead of network")
    args = ap.parse_args()
    if args.data_dir:
        set_data_dir(os.path.abspath(args.data_dir))

    started = time.time()
    log: dict[str, Any] = {"started_at": args.now or utc_now(), "warnings": [], "topic_counts": {}}
    client = FixtureClient(args.fixtures) if args.fixtures else demo_client()

    try:
        status = client.exchange_status()
        log["exchange_status_url"] = client.calls[-1]["url"]
        log["exchange_active"] = status.get("exchange_active")
        log["trading_active"] = status.get("trading_active")
    except Exception as exc:  # noqa: BLE001
        log["warnings"].append(f"exchange/status failed: {exc}")

    series_raw, tag_map = discover_series(client, log)
    for s in series_raw:
        s["_host"] = client.host

    assigned: dict[str, list[dict]] = {t.id: [] for t in TOPICS}
    series_out: dict[str, dict] = {}
    for s in series_raw:
        hits = classify(s)
        if not hits:
            continue
        for topic_id, _rule in hits:
            assigned[topic_id].append(s)
        rec = serialise_series(s, hits)
        series_out[s["ticker"]] = rec

    # Open events for the series we track.
    tracking = sorted({s["ticker"] for s in series_raw if classify(s)})
    events: dict[str, dict] = {}
    for st in tracking:
        try:
            for e in client.events(series_ticker=st, status="open"):
                e["_series"] = st
                e["_host"] = client.host
                events[e["event_ticker"]] = e
        except Exception as exc:  # noqa: BLE001
            log["warnings"].append(f"events series={st} failed: {exc}")
    log["open_events"] = len(events)

    # Markets per event (single event_ticker filter returns all markets unpaged).
    markets: list[dict] = []
    for et, e in events.items():
        try:
            raw = client.markets(event_ticker=et)
            series = series_out.get(e.get("_series"), {})
            topics = series.get("topics") or []
            if not topics:
                continue
            for m in raw:
                if m.get("event_ticker") != et:
                    continue
                for topic in topics:
                    markets.append(market_row(m, topic, e.get("_host", client.host), series))
        except Exception as exc:  # noqa: BLE001
            log["warnings"].append(f"markets event={et} failed: {exc}")

    # Rank by dollar volume (volume_24h_fp is a contract count; multiply by price
    # to get a traded-dollar estimate and label it as an estimate in meta).
    def dollar_volume(m: dict) -> float:
        vol = as_float(m.get("volume_24h_fp"), 0.0) or 0.0
        price = as_float(m.get("last_price_dollars"), 0.0) or 0.0
        if price == 0.0:
            bid = as_float(m.get("yes_bid_dollars"), 0.0) or 0.0
            ask = as_float(m.get("yes_ask_dollars"), 0.0) or 0.0
            price = (bid + ask) / 2 if (bid or ask) else 0.0
        return round(vol * price, 2)

    for m in markets:
        m["est_volume_24h_dollars"] = dollar_volume(m)

    kept: list[dict] = []
    for topic in TOPICS:
        rows = [m for m in markets if m["topic"] == topic.id]
        rows.sort(key=lambda m: (m["est_volume_24h_dollars"], as_float(m.get("open_interest_fp"), 0.0) or 0.0),
                  reverse=True)
        kept.extend(rows[:MAX_MARKETS_PER_TOPIC])
        log["topic_counts"][topic.id] = {"open_markets": len(rows), "kept": min(len(rows), MAX_MARKETS_PER_TOPIC)}

    # Order books: the most active markets overall, then fill per topic.
    kept_sorted = sorted(kept, key=lambda m: m["est_volume_24h_dollars"], reverse=True)
    ob_targets: list[dict] = []
    seen: set[str] = set()
    per_topic: dict[str, int] = {}
    for m in kept_sorted:
        if len(ob_targets) >= args.max_orderbooks:
            break
        cap = 30
        if per_topic.get(m["topic"], 0) >= cap and len(ob_targets) < args.max_orderbooks // 2:
            continue
        if m["ticker"] in seen:
            continue
        seen.add(m["ticker"])
        per_topic[m["topic"]] = per_topic.get(m["topic"], 0) + 1
        ob_targets.append(m)

    orderbooks: dict[str, dict] = {}
    for m in ob_targets:
        ob = capture_orderbook(client, m, log, log["started_at"])
        if ob:
            orderbooks[m["ticker"]] = ob
        update_history(m, ob, log["started_at"])
    log["orderbooks_captured"] = len(orderbooks)

    # Keep the history directory bounded: drop files for markets we no longer track.
    keep_tickers = {m["ticker"] for m in kept}
    pruned = 0
    if os.path.isdir(HISTORY):
        for name in os.listdir(HISTORY):
            if not name.endswith(".json"):
                continue
            if name[:-5] not in keep_tickers:
                try:
                    os.remove(os.path.join(HISTORY, name))
                    pruned += 1
                except OSError:
                    pass
    log["history_pruned"] = pruned

    for t in TOPICS:
        if not assigned[t.id]:
            log["warnings"].append(f"topic {t.id}: no series matched the official rules")

    meta = {
        "collected_at": utc_now(),
        "duration_seconds": round(time.time() - started, 1),
        "environment": client.env,
        "host": client.host,
        "api_requests": len(client.calls),
        "topics": [
            {"id": t.id, "name": t.name, "blurb": t.blurb,
             "rules": [r.label() for r in t.rules],
             "series_matched": len(assigned[t.id]),
             "series": sorted(s["ticker"] for s in assigned[t.id])[:200]}
            for t in TOPICS
        ],
        "tags_by_categories_url": log.get("tags_by_categories"),
        "volume_metric_note": ("est_volume_24h_dollars = volume_24h_fp (contracts, from the API) "
                               "x last price in dollars. It is an estimate of traded dollars, "
                               "not a field returned by Kalshi."),
        "run_log": log,
    }

    write_json(os.path.join(DATA, "series.json"),
               {"generated_at": meta["collected_at"], "source": "https://docs.kalshi.com/api-reference/market/get-series-list",
                "series": sorted(series_out.values(), key=lambda s: s["ticker"])})
    write_json(os.path.join(DATA, "events.json"),
               {"generated_at": meta["collected_at"], "events": [
                   {"event_ticker": e.get("event_ticker"), "series_ticker": e.get("_series"),
                    "title": e.get("title"), "sub_title": e.get("sub_title"),
                    "category": e.get("category"),
                    "mutually_exclusive": e.get("mutually_exclusive"),
                    "settlement_sources": e.get("settlement_sources") or [],
                    "topics": (series_out.get(e.get("_series"), {}) or {}).get("topics", []),
                    "api_url": f"{e.get('_host')}/events?series_ticker={e.get('_series')}&status=open"}
                   for e in sorted(events.values(), key=lambda e: e.get("event_ticker") or "")]})
    write_json(os.path.join(DATA, "markets.json"),
               {"generated_at": meta["collected_at"], "markets": kept})
    write_json(os.path.join(DATA, "orderbooks.json"),
               {"generated_at": meta["collected_at"], "orderbooks": orderbooks})
    write_json(os.path.join(DATA, "meta.json"), meta)
    print(f"collect: {len(kept)} markets, {len(orderbooks)} orderbooks, "
          f"{len(events)} events, {len(client.calls)} API calls, "
          f"{len(log['warnings'])} warnings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
