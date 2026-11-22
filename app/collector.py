"""Build the dashboard snapshot from the public Kalshi demo API.

No synthetic prices are ever generated. If an endpoint fails, the corresponding
field is left null and the failure is recorded in ``meta.errors`` so the site can
show "unavailable" instead of a plausible-looking number.
"""

from __future__ import annotations

import math
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from .alerts import SwingDetector, swings_from_candles
from .config import DEMO_REST, TOPIC_KEYS
from .kalshi import KalshiClient, KalshiError
from .topics import TOPIC_DESCRIPTIONS, TOPIC_LABELS, classify

SITE_ORIGIN = "https://kanlerxz87-cyber.github.io"
MARKET_LIMIT = 1000

KNOWN_TOPIC_SERIES: dict[str, tuple[str, ...]] = {
    "gas_prices": ("KXAAAGASM", "KXAAAGASW"),
    "elections": (
        "KXPRESPERSON",
        "KXPRESNOMD",
        "KXSENMAJ",
        "KXCONTROLH",
        "KXSENATEIAD",
        "KXNEXTNATOSECGEN",
        "KXGA14",
    ),
    "culture": (
        "KXOSCARPIC",
        "KXGTAONLINE",
        "KXNETFLIXRANKSHOWGLOBAL",
        "KXELONMARS",
        "NOBELLIT",
    ),
    "crypto": ("KXBTCY", "KXBTCMAXY", "KXBTC15M", "KXDEMOFUTHOURLY"),
    # Verified against GET /series/{ticker} and /series?category=Sports&tags=Golf
    # on 2026-11-22: KXPGATOUR, KXLPGATOUR, KXPGAMAKECUT, KXPGATOP10, KXPGA,
    # KXPRESCUP, etc. are all official Sports/Golf series.
    "golf": (
        "KXPGATOUR",
        "KXLPGATOUR",
        "KXPGAMAKECUT",
        "KXPGA",
        "KXPRESCUP",
        "KXPGATOP10",
        "KXLPGAR2LEAD",
        "KXLIVH2H",
        "KXGOLFMAJORS",
        "KXCHAMPTOURR1LEAD",
        "KXPGARYDERCUPD3",
        "KXPGARYDERTOP3",
    ),
}


def _iso(ts: float | int | None = None) -> str:
    when = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(tz=timezone.utc)
    return when.isoformat().replace("+00:00", "Z")


def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        out = float(value)
    except (TypeError, ValueError):
        return None
    return out if math.isfinite(out) else None


def _dollars(market: dict[str, Any], field: str) -> float | None:
    value = _num(market.get(f"{field}_dollars"))
    if value is not None:
        return round(value, 4)
    legacy = _num(market.get(field))
    if legacy is not None:
        return round(legacy / 100.0, 4)
    return None


def series_from_event(event_ticker: str, events: dict[str, dict[str, Any]]) -> str:
    meta = events.get(event_ticker) or {}
    if meta.get("series_ticker"):
        return str(meta["series_ticker"])
    if event_ticker and "-" in event_ticker:
        return event_ticker.rsplit("-", 1)[0]
    return event_ticker


def series_url(series_ticker: str) -> str:
    return f"https://kalshi.com/markets/{series_ticker.lower()}"


def api_url(ticker: str, base: str = DEMO_REST) -> str:
    return f"{base}/markets/{ticker}"


def news_search_url(title: str) -> str:
    from urllib.parse import quote_plus

    return "https://news.google.com/search?q=" + quote_plus(title)


def collect_events(client: KalshiClient, errors: list[str]) -> dict[str, dict[str, Any]]:
    events: dict[str, dict[str, Any]] = {}
    for status in ("open", "settled"):
        cursor: str | None = None
        for _ in range(15):
            try:
                page = client.get_events(status=status, limit=200, cursor=cursor)
            except KalshiError as exc:
                errors.append(f"GET /events?status={status}: {exc}")
                break
            for event in page.get("events", []):
                events[str(event.get("event_ticker"))] = event
            cursor = page.get("cursor") or ""
            if not cursor:
                break
            time.sleep(0.05)
    return events


def normalize_market(
    market: dict[str, Any],
    *,
    topic: str,
    series_ticker: str,
    series_meta: dict[str, Any] | None,
    base: str,
    event_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    yes_bid = _dollars(market, "yes_bid")
    yes_ask = _dollars(market, "yes_ask")
    last = _dollars(market, "last_price")
    mid = None
    if yes_bid is not None and yes_ask is not None and 0 < yes_bid <= yes_ask <= 1:
        mid = round((yes_bid + yes_ask) / 2, 4)
    elif last is not None:
        mid = last

    volume_24h = _num(market.get("volume_24h_fp"))
    open_interest = _num(market.get("open_interest_fp"))
    volume = _num(market.get("volume_fp"))

    settlement_sources = []
    if series_meta:
        for source in series_meta.get("settlement_sources") or []:
            if isinstance(source, dict) and source.get("url"):
                settlement_sources.append({"name": source.get("name"), "url": source.get("url")})

    title = str(market.get("title") or market.get("yes_sub_title") or market.get("ticker"))
    return {
        "ticker": market.get("ticker"),
        "topic": topic,
        "event_ticker": market.get("event_ticker"),
        "series_ticker": series_ticker,
        "event_title": (event_meta or {}).get("title") or "",
        "title": title,
        "yes_sub_title": market.get("yes_sub_title") or "",
        "status": market.get("status"),
        "close_time": market.get("close_time"),
        "expected_expiration_time": market.get("expected_expiration_time"),
        "result": market.get("result") or None,
        "expiration_value": market.get("expiration_value") or None,
        "prices": {
            "yes_bid": yes_bid,
            "yes_ask": yes_ask,
            "last": last,
            "mid": mid,
            "no_bid": round(1 - yes_ask, 4) if yes_ask is not None else None,
            "no_ask": round(1 - yes_bid, 4) if yes_bid is not None else None,
            "previous": _dollars(market, "previous_price"),
        },
        "volume": {
            "total_contracts": volume,
            "last_24h_contracts": volume_24h,
            "open_interest_contracts": open_interest,
            # Computed, clearly labelled: contracts x price is a notional proxy,
            # not an official dollar-volume figure.
            "notional_24h_est": round(volume_24h * mid, 2)
            if volume_24h is not None and mid is not None
            else None,
            "open_interest_notional_est": round(open_interest * mid, 2)
            if open_interest is not None and mid is not None
            else None,
        },
        "links": {
            "kalshi": series_url(series_ticker),
            "market_api": api_url(str(market.get("ticker")), base),
            "series_api": f"{base}/series/{series_ticker}" if series_ticker else None,
            "settlement_sources": settlement_sources,
            "news_search": news_search_url(title),
        },
        "rules_primary": market.get("rules_primary") or "",
        "updated_time": market.get("updated_time"),
        "exchange_index": market.get("exchange_index"),
        "is_provisional": bool(market.get("is_provisional")),
    }


def fetch_candles(
    client: KalshiClient,
    *,
    series_ticker: str,
    ticker: str,
    hours: int = 12,
    errors: list[str],
) -> dict[str, Any]:
    now = int(time.time())
    out: dict[str, Any] = {"1m": [], "60m": [], "_raw_1m": [], "_raw_60m": []}
    try:
        payload = client.get_candlesticks(
            series_ticker=series_ticker,
            ticker=ticker,
            start_ts=now - hours * 3600,
            end_ts=now,
            period_interval=1,
        )
        raw_1m = payload.get("candlesticks", []) or []
        out["_raw_1m"] = raw_1m
        out["1m"] = compact_candles(raw_1m)
    except KalshiError as exc:
        errors.append(f"candlesticks 1m {ticker}: {exc}")
    try:
        payload = client.get_candlesticks(
            series_ticker=series_ticker,
            ticker=ticker,
            start_ts=now - 7 * 24 * 3600,
            end_ts=now,
            period_interval=60,
        )
        raw_60m = payload.get("candlesticks", []) or []
        out["_raw_60m"] = raw_60m
        out["60m"] = compact_candles(raw_60m)
    except KalshiError as exc:
        errors.append(f"candlesticks 60m {ticker}: {exc}")
    return out


def compact_candles(candles: list[dict[str, Any]]) -> list[list[float | None]]:
    rows: list[list[float | None]] = []
    for candle in candles:
        price = candle.get("price") or {}
        bid = candle.get("yes_bid") or {}
        ask = candle.get("yes_ask") or {}
        ts = _num(candle.get("end_period_ts"))
        if ts is None:
            continue
        rows.append(
            [
                int(ts),
                _num(price.get("close_dollars")),
                _num(bid.get("close_dollars")),
                _num(ask.get("close_dollars")),
                _num(candle.get("volume_fp")),
                _num(candle.get("open_interest_fp")),
            ]
        )
    return rows


def summarize_liquidity(book: dict[str, Any] | None) -> dict[str, Any]:
    if not book:
        return {"status": "unavailable"}
    fp = book.get("orderbook_fp") or book.get("orderbook") or {}
    yes = fp.get("yes_dollars") or fp.get("yes") or []
    no = fp.get("no_dollars") or fp.get("no") or []

    def parse(levels: list[Any]) -> list[dict[str, float]]:
        rows = []
        for item in levels:
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            price, count = _num(item[0]), _num(item[1])
            if price is None or count is None:
                continue
            if price > 1:
                price /= 100.0
            rows.append({"price": round(price, 4), "contracts": round(count, 2)})
        rows.sort(key=lambda r: r["price"])
        return rows

    yes_levels = parse(yes)
    no_levels = parse(no)
    best_yes_bid = yes_levels[-1]["price"] if yes_levels else None
    best_no_bid = no_levels[-1]["price"] if no_levels else None
    best_yes_ask = round(1 - best_no_bid, 4) if best_no_bid is not None else None
    spread = (
        round(best_yes_ask - best_yes_bid, 4)
        if best_yes_ask is not None and best_yes_bid is not None
        else None
    )
    return {
        "status": "ok",
        "best_yes_bid": best_yes_bid,
        "best_yes_ask": best_yes_ask,
        "best_no_bid": best_no_bid,
        "best_no_ask": round(1 - best_yes_bid, 4) if best_yes_bid is not None else None,
        "spread": spread,
        "yes_levels": yes_levels[-8:],
        "no_levels": no_levels[-8:],
        "yes_depth_at_best": yes_levels[-1]["contracts"] if yes_levels else None,
        "no_depth_at_best": no_levels[-1]["contracts"] if no_levels else None,
        "yes_depth_total": round(sum(level["contracts"] for level in yes_levels), 2),
        "no_depth_total": round(sum(level["contracts"] for level in no_levels), 2),
        "source": "GET /markets/{ticker}/orderbook?depth=10",
    }


def select_tracked(markets: list[dict[str, Any]], per_topic: int = 8) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for topic in TOPIC_KEYS:
        pool = [m for m in markets if m["topic"] == topic and m["status"] in {"active", "open"}]
        pool.sort(
            key=lambda m: (
                m["volume"].get("last_24h_contracts") or 0,
                m["volume"].get("open_interest_contracts") or 0,
                m["volume"].get("total_contracts") or 0,
            ),
            reverse=True,
        )
        # First pass: diversify across distinct series/events (up to 3 per series)
        # so a single multi-outcome event does not crowd out other active series.
        chosen: list[dict[str, Any]] = []
        per_series_count: dict[str, int] = {}
        for market in pool:
            if len(chosen) >= per_topic:
                break
            st = str(market.get("series_ticker") or market.get("event_ticker") or "")
            if per_series_count.get(st, 0) >= 3:
                continue
            chosen.append(market)
            per_series_count[st] = per_series_count.get(st, 0) + 1
        for market in pool:
            if len(chosen) >= per_topic:
                break
            if market not in chosen:
                chosen.append(market)
        # Add the largest open-interest markets that are not already included.
        by_oi = sorted(
            pool,
            key=lambda m: m["volume"].get("open_interest_contracts") or 0,
            reverse=True,
        )[:2]
        for market in by_oi:
            if market not in chosen:
                chosen.append(market)
        selected.extend(chosen)
    return selected


def collect(
    *,
    environment: str = "demo",
    per_topic: int = 8,
    candle_hours: int = 12,
    max_series_lookups: int = 100,
) -> dict[str, Any]:
    base = DEMO_REST
    client = KalshiClient(base_url=base)
    errors: list[str] = []

    try:
        exchange = client.exchange_status()
    except KalshiError as exc:
        exchange = {}
        errors.append(f"GET /exchange/status: {exc}")

    # Official series enumeration. Keyword matching alone missed entire sports
    # series whose titles are player names ("The RSM Classic: Bill Haas wins"),
    # so golf reported zero in-scope markets even though the demo API had 200+.
    # These filters are exact values from /search/tags_by_categories.
    series_topic: dict[str, str] = {}
    for topic, (category, tag) in (
        ("golf", ("Sports", "Golf")),
        ("gas_prices", ("Commodities", "Oil & Gas")),
    ):
        cursor = None
        for _ in range(5):
            try:
                page = client.get_series_list(category=category, tags=tag, limit=200, cursor=cursor)
            except KalshiError as exc:
                errors.append(f"GET /series?category={category}&tags={tag}: {exc}")
                break
            for series in page.get("series", []):
                ticker = str(series.get("ticker") or "")
                if ticker:
                    series_topic.setdefault(ticker, topic)
            cursor = page.get("cursor") or ""
            if not cursor:
                break

    raw_markets: list[dict[str, Any]] = []
    raw_settled: list[dict[str, Any]] = []
    try:
        # The API caps a page at 200 rows; with ~8k open markets a 10-page scan only
        # ever saw the first ~2k (crypto-heavy) markets, so culture and golf came
        # back empty. 60 pages covers the whole open book.
        raw_markets = list(client.iter_markets(status="open", limit=MARKET_LIMIT, max_pages=60))
    except KalshiError as exc:
        errors.append(f"GET /markets?status=open: {exc}")
    try:
        cutoff = int((datetime.now(tz=timezone.utc) - timedelta(days=30)).timestamp())
        raw_settled = list(
            client.iter_markets(
                status="settled", limit=MARKET_LIMIT, max_pages=60, min_settled_ts=cutoff
            )
        )
    except KalshiError as exc:
        errors.append(f"GET /markets?status=settled: {exc}")

    events = collect_events(client, errors)

    # Supplement paginated discovery with targeted queries for known in-scope series
    # across all 5 topics so older high-OI series (Gas, Culture, Golf, Elections, Crypto)
    # are never missed behind newest-first pagination of short-dated contracts.
    seen_open_tickers = {str(m.get("ticker") or "") for m in raw_markets}
    seen_settled_tickers = {str(m.get("ticker") or "") for m in raw_settled}
    for topic_series in KNOWN_TOPIC_SERIES.values():
        for st in topic_series:
            try:
                resp_open = client.get_markets(series_ticker=st, status="open", limit=200)
                for m in resp_open.get("markets", []) or []:
                    tk = str(m.get("ticker") or "")
                    if tk and tk not in seen_open_tickers:
                        raw_markets.append(m)
                        seen_open_tickers.add(tk)
            except KalshiError as exc:
                errors.append(f"GET /markets?series_ticker={st}&status=open: {exc}")
            try:
                resp_settled = client.get_markets(series_ticker=st, status="settled", limit=100)
                for m in resp_settled.get("markets", []) or []:
                    tk = str(m.get("ticker") or "")
                    if tk and tk not in seen_settled_tickers:
                        raw_settled.append(m)
                        seen_settled_tickers.add(tk)
            except KalshiError as exc:
                errors.append(f"GET /markets?series_ticker={st}&status=settled: {exc}")
            time.sleep(0.04)

    def is_mve(market: dict[str, Any]) -> bool:
        ticker = str(market.get("ticker") or "")
        return ticker.startswith("KXMVE") or bool(market.get("mve_collection_ticker"))

    raw_markets = [m for m in raw_markets if not is_mve(m)]
    raw_settled = [m for m in raw_settled if not is_mve(m)]

    # Series metadata cache (official settlement sources / category / title).
    # Prioritize known in-scope series first so their settlement sources are always fetched.
    series_cache: dict[str, dict[str, Any]] = {}
    priority_series = [st for group in KNOWN_TOPIC_SERIES.values() for st in group]
    for series in priority_series:
        if series in series_cache:
            continue
        try:
            payload = client.get_series(series)
            series_cache[series] = payload.get("series", {}) or {}
        except KalshiError as exc:
            errors.append(f"GET /series/{series}: {exc}")
            series_cache[series] = {}
        time.sleep(0.04)

    for market in raw_markets + raw_settled:
        series = series_from_event(str(market.get("event_ticker") or ""), events)
        if not series or series in series_cache or len(series_cache) >= max_series_lookups:
            continue
        try:
            payload = client.get_series(series)
            series_cache[series] = payload.get("series", {}) or {}
        except KalshiError as exc:
            errors.append(f"GET /series/{series}: {exc}")
            series_cache[series] = {}
        time.sleep(0.05)

    def prepare(market: dict[str, Any]) -> dict[str, Any] | None:
        event_ticker = str(market.get("event_ticker") or "")
        series = series_from_event(event_ticker, events)
        series_meta = series_cache.get(series) or {}
        event_meta = events.get(event_ticker) or {}
        found = classify(
            title=str(market.get("title") or ""),
            subtitle=str(market.get("yes_sub_title") or ""),
            event_title=str(event_meta.get("title") or ""),
            series_title=str(series_meta.get("title") or ""),
            rules=str(market.get("rules_primary") or "") + "\n" + str(market.get("rules_secondary") or ""),
            category=str(event_meta.get("category") or series_meta.get("category") or ""),
            tags=series_meta.get("tags"),
            market_ticker=str(market.get("ticker") or ""),
            event_ticker=event_ticker,
            series_ticker=series,
        )
        if not found.topic and series in series_topic:
            import dataclasses

            found = dataclasses.replace(
                found,
                topic=series_topic[series],
                reason=f"series listed under the official {series_topic[series]} category/tag filter",
            )
        if not found.topic:
            return None
        return normalize_market(
            market,
            topic=found.topic,
            series_ticker=series,
            series_meta=series_meta,
            base=base,
            event_meta=event_meta,
        )

    open_markets = [m for m in (prepare(m) for m in raw_markets) if m]
    settled_markets = [m for m in (prepare(m) for m in raw_settled) if m]

    tracked = select_tracked(open_markets, per_topic=per_topic)

    # Enrich tracked markets with orderbook + candles.
    for market in tracked:
        ticker = str(market["ticker"])
        try:
            book = client.get_orderbook(ticker, depth=10)
            market["liquidity"] = summarize_liquidity(book)
        except KalshiError as exc:
            market["liquidity"] = {"status": "error", "error": str(exc)}
            errors.append(f"orderbook {ticker}: {exc}")
        market["candles"] = fetch_candles(
            client,
            series_ticker=str(market["series_ticker"]),
            ticker=ticker,
            hours=candle_hours,
            errors=errors,
        )
        time.sleep(0.08)

    # Seed alerts from real candle closes (history, explicitly labelled).
    seed_alerts: list[dict[str, Any]] = []
    for market in tracked:
        c_obj = market.get("candles") or {}
        candles_1m = c_obj.pop("_raw_1m", None) or [
            {"end_period_ts": row[0], "price": {"close_dollars": row[1]}}
            for row in c_obj.get("1m", [])
            if row[1] is not None
        ]
        candles_60m = c_obj.pop("_raw_60m", None) or [
            {"end_period_ts": row[0], "price": {"close_dollars": row[1]}}
            for row in c_obj.get("60m", [])
            if row[1] is not None
        ]
        alerts = swings_from_candles(
            candles_1m,
            ticker=str(market["ticker"]),
            topic=str(market["topic"]),
            title=str(market["title"]),
            threshold=0.10,
            limit=6,
        )
        if candles_60m:
            hourly_alerts = swings_from_candles(
                candles_60m,
                ticker=str(market["ticker"]),
                topic=str(market["topic"]),
                title=str(market["title"]),
                threshold=0.10,
                limit=6,
            )
            seen_hours = {int(a.ts // 3600) for a in alerts}
            for ha in hourly_alerts:
                dup = any(
                    round(ha.before, 3) == round(a.before, 3)
                    and round(ha.after, 3) == round(a.after, 3)
                    and abs(ha.ts - a.ts) <= 3600
                    for a in alerts
                )
                if not dup and int(ha.ts // 3600) not in seen_hours:
                    alerts.append(ha)
                    seen_hours.add(int(ha.ts // 3600))
            alerts.sort(key=lambda a: a.ts, reverse=True)
            alerts = alerts[:6]
        for alert in alerts:
            payload = alert.to_dict()
            payload["links"] = market["links"]
            payload["yes_sub_title"] = market.get("yes_sub_title")
            seed_alerts.append(payload)
    seed_alerts.sort(key=lambda a: a["ts"], reverse=True)
    seed_alerts = seed_alerts[:120]

    # Resolutions: settled markets in the last 30 days, per topic.
    resolutions: list[dict[str, Any]] = []
    for market in settled_markets:
        result = (market.get("result") or "").lower()
        if result not in {"yes", "no"}:
            continue
        resolutions.append(
            {
                "ticker": market["ticker"],
                "topic": market["topic"],
                "title": market["title"],
                "yes_sub_title": market.get("yes_sub_title"),
                "result": result,
                "close_time": market.get("close_time"),
                "expiration_value": market.get("expiration_value"),
                "event_ticker": market.get("event_ticker"),
                "series_ticker": market.get("series_ticker"),
                "links": market["links"],
            }
        )
    resolutions.sort(key=lambda r: r.get("close_time") or "", reverse=True)
    per_topic_res: dict[str, list[dict[str, Any]]] = {}
    for row in resolutions:
        bucket = per_topic_res.setdefault(row["topic"], [])
        if len(bucket) < 40:
            bucket.append(row)

    # Per-topic aggregates.
    topics = []
    for topic in TOPIC_KEYS:
        pool = [m for m in open_markets if m["topic"] == topic]
        topic_markets = [m for m in tracked if m["topic"] == topic]
        topics.append(
            {
                "key": topic,
                "label": TOPIC_LABELS[topic],
                "description": TOPIC_DESCRIPTIONS[topic],
                "open_markets": len(pool),
                "tracked_markets": len(topic_markets),
                "volume_24h_contracts": round(
                    sum(m["volume"].get("last_24h_contracts") or 0 for m in pool), 2
                ),
                "open_interest_contracts": round(
                    sum(m["volume"].get("open_interest_contracts") or 0 for m in pool), 2
                ),
                "resolved_markets_30d": len(per_topic_res.get(topic, [])),
                "tickers": [m["ticker"] for m in topic_markets],
            }
        )

    stats = {
        "open_markets_total": len(raw_markets),
        "open_markets_in_scope": len(open_markets),
        "settled_markets_30d_total": len(raw_settled),
        "settled_markets_in_scope": len(settled_markets),
        "tracked_markets": len(tracked),
        "resolutions": len(resolutions),
        "seed_alerts": len(seed_alerts),
        "events_indexed": len(events),
        "series_indexed": len(series_cache),
    }

    return {
        "schema_version": 1,
        "generated_at": _iso(),
        "environment": environment,
        "api_base": base,
        "site_origin": SITE_ORIGIN,
        "exchange_status": exchange,
        "threshold": 0.10,
        "topics": topics,
        "markets": tracked,
        "resolutions": resolutions,
        "resolutions_by_topic": per_topic_res,
        "alerts_seed": seed_alerts,
        "stats": stats,
        "meta": {
            "errors": errors,
            "error_count": len(errors),
            "selection": (
                f"Top {per_topic} open markets per topic by 24h volume (contracts), plus the top 2 "
                "by open interest; multivariate (KXMVE*) markets excluded."
            ),
            "notional_note": (
                "notional_24h_est and open_interest_notional_est are computed as contracts x "
                "mid price and are estimates, not official Kalshi dollar-volume fields."
            ),
            "alert_basis": (
                "YES mid ((best bid + best ask)/2), or last traded price when no two-sided "
                "quote exists; threshold >= $0.10."
            ),
            "unverified": [
                "Demo API key/private key were not provided, so portfolio balance and order "
                "placement are unverified.",
                "Fee rounding for settlement is not modelled.",
                "Demo prices/behaviour may not reflect production markets (Kalshi demo warning).",
            ],
            "docs": {
                "api_environments": "https://docs.kalshi.com/getting_started/api_environments.md",
                "demo_env": "https://docs.kalshi.com/getting_started/demo_env.md",
                "market_data": "https://docs.kalshi.com/getting_started/quick_start_market_data.md",
                "orderbook": "https://docs.kalshi.com/api-reference/market/get-market-orderbook.md",
                "candlesticks": "https://docs.kalshi.com/api-reference/market/get-market-candlesticks.md",
                "websockets": "https://docs.kalshi.com/getting_started/quick_start_websockets.md",
                "fees": "https://docs.kalshi.com/getting_started/fee_rounding.md",
            },
        },
    }
