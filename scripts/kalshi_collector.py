#!/usr/bin/env python3
"""Kalshi public-data collector for the Tradebot2 dashboard.

Standard library only. Uses ONLY unauthenticated, documented, read-only endpoints:
  GET /series            (filters: category, tags, include_volume, cursor)
  GET /events            (filters: series_ticker, status, with_nested_markets, limit, cursor)
  GET /markets/{ticker}  (result / status for resolution tracking)
  GET /markets/{ticker}/orderbook (depth, query: depth)

Every value written to site/data/*.json carries the API URL it came from, so each
table row can link to its official source.

Only active child markets are tracked. Resolution is recorded only when the
market status is finalized and the result is yes/no. resolved_at mirrors the
exchange's settlement_ts; resolution_observed_at is when this collector saw it.

Paper trades are SIMULATED. No orders are placed. Kalshi fees are not modelled.
Authenticated demo-account (portfolio) tracking is NOT implemented here: it needs
API-key credentials that must not be committed or pasted into chat.

Sources (verified by the agent, see site/sources.html):
  https://docs.kalshi.com/api-reference/events/get-events
  https://docs.kalshi.com/api-reference/market/get-series-list
  https://docs.kalshi.com/api-reference/market/get-market-orderbook
  https://docs.kalshi.com/getting_started/market_lifecycle
  https://docs.kalshi.com/getting_started/rate_limits
"""
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# The brief asks for the Kalshi DEMO environment, so the demo REST host is the
# default. Kalshi documents this host in
# https://docs.kalshi.com/getting_started/demo_env .
# Demo prices are simulated ("may not be reflective of those in real markets").
BASE = os.environ.get("KALSHI_BASE", "https://external-api.demo.kalshi.co/trade-api/v2").rstrip("/")

# Keep demo state isolated from state collected against another API host. The
# api_base stored inside the state file is checked again by load_state().
_DEMO_API_HOSTS = {"external-api.demo.kalshi.co", "demo-api.kalshi.co"}


def _default_state_path(base: str) -> str:
    host = urllib.parse.urlparse(base).hostname or ""
    environment = "demo" if host in _DEMO_API_HOSTS else "custom"
    return f"state/{environment}-state.json"


STATE_PATH = os.environ.get("STATE_PATH", _default_state_path(BASE))
OUT_DIR = os.environ.get("OUT_DIR", "site/data")
REQ_DELAY = float(os.environ.get("REQ_DELAY", "0.25"))
MAX_SERIES_PER_TOPIC = int(os.environ.get("MAX_SERIES_PER_TOPIC", "40"))
MAX_RESOLUTION_CHECKS = int(os.environ.get("MAX_RESOLUTION_CHECKS", "60"))
ORDERBOOK_TOP_N = int(os.environ.get("ORDERBOOK_TOP_N", "25"))
# The demo exchange lists >18k open markets at a time. Only markets that have
# traded in the last 24h or that carry open interest are published, capped per
# topic by activity, so the published JSON stays small and the tables stay usable.
MAX_MARKETS_PER_TOPIC = int(os.environ.get("MAX_MARKETS_PER_TOPIC", "300"))
# Real price history straight from the API: 1-minute candles (minutes/hours
# ranges) and the trade tape (second-level points) for the most active markets.
CANDLE_MARKETS = int(os.environ.get("CANDLE_MARKETS", "12"))
TRADE_MARKETS = int(os.environ.get("TRADE_MARKETS", "12"))
CANDLE_MINUTES = int(os.environ.get("CANDLE_MINUTES", "360"))     # 6h of 1-minute candles
CANDLE_HOURS = int(os.environ.get("CANDLE_HOURS", "720"))         # 30d of 1-hour candles
TAPE_HOURS = int(os.environ.get("TAPE_HOURS", "6"))               # trade tape window
EVENT_ROWS = int(os.environ.get("EVENT_ROWS", "150"))

ALERT_THRESHOLD = 0.10          # dollars per contract (prices are 0.00-1.00)
HISTORY_CAP = 384               # snapshots kept per market (~4 days at 15-min runs)
HISTORY_PRUNE_DAYS = 7          # drop history of markets not seen live for this long
ALERT_CAP = 1000
TRADE_QTY = 10                  # paper contracts per trade
TARGET_MOVE = 0.05              # paper take-profit / stop-loss distance
TIME_STOP_HOURS = 48
# High-ROI screen (rule-based, NOT a validated model; see findings page)
SCREEN_MAX_SPREAD = 0.03
SCREEN_MIN_ASK_SIZE = 50
SCREEN_MIN_VOLUME_24H = 100
SCREEN_PRICE_MIN, SCREEN_PRICE_MAX = 0.05, 0.95

# Topic -> series discovery filter. Values are exact strings from the official
# /search/tags_by_categories response and the /series filters.
TOPICS = {
    "gas": {
        "label": "Gas prices",
        "params": {"category": "Commodities", "tags": "Oil & Gas"},
        "note": "Kalshi tag 'Oil & Gas' (category Commodities). Includes oil/natural-gas/heating-oil futures; retail gasoline is NOT separated by the API (flagged).",
    },
    "elections": {
        "label": "Elections",
        "params": {"category": "Elections"},
        "note": "Kalshi category 'Elections'.",
    },
    "culture": {
        "label": "Culture",
        "params": {"category": "Entertainment"},
        "note": "No 'Culture' category exists in the verified taxonomy; mapped to 'Entertainment' (inference, flagged).",
    },
    "crypto": {
        "label": "Crypto",
        "params": {"category": "Crypto"},
        "note": "Kalshi category 'Crypto'.",
    },
    "golf": {
        "label": "Golf",
        "params": {"category": "Sports", "tags": "Golf"},
        "note": "Kalshi category 'Sports' with tag 'Golf'.",
    },
}


def utc_now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def num(x):
    if x in (None, ""):
        return None
    try:
        return round(float(x), 4)
    except (TypeError, ValueError):
        return None


def api_get(path, params=None, retries=4):
    query = ("?" + urllib.parse.urlencode(params)) if params else ""
    url = BASE + path + query
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"Accept": "application/json", "User-Agent": "Tradebot2-dashboard/1.0"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            time.sleep(REQ_DELAY)
            return body, url
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 404:
                return None, url
            if e.code == 429 or e.code >= 500:
                time.sleep(2 ** attempt * 2)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = e
            time.sleep(2 ** attempt * 2)
    raise RuntimeError(f"GET {url} failed after {retries} attempts: {last_err}")


def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, encoding="utf-8") as f:
            state = json.load(f)
        if not isinstance(state, dict):
            raise ValueError("Collector state must be a JSON object; existing state was not modified.")
        if state.get("api_base") != BASE:
            raise ValueError(
                "Collector state has no matching API base; use a separate STATE_PATH "
                "rather than mixing demo and other-environment data. Existing state was not modified."
            )
        return state
    return {"api_base": BASE, "history": {}, "markets": {}, "alerts": [],
            "processed_alerts": [], "trades": [], "runs": 0, "first_run": None}


def save_json(path, data, compact=False):
    """Write JSON. Large data files are compact so a Pages load stays small."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(data, f, separators=(",", ":"), sort_keys=False)
        else:
            json.dump(data, f, indent=1, sort_keys=False)


def discover_series(topic_key, cfg, errors):
    """Paginate /series with the topic filter; keep the top-N by volume."""
    out, cursor = [], None
    for _ in range(50):
        params = dict(cfg["params"], include_volume="true", limit=200)
        if cursor:
            params["cursor"] = cursor
        body, url = api_get("/series", params)
        if not body:
            errors.append({"where": "series", "topic": topic_key, "url": url})
            break
        for s in body.get("series", []):
            out.append({
                "ticker": s.get("ticker"),
                "title": s.get("title"),
                "category": s.get("category"),
                "tags": s.get("tags") or [],
                "volume": num(s.get("volume_fp")) or 0.0,
                "source_url": url,
            })
        cursor = body.get("cursor")
        if not cursor:
            break
    out = [s for s in out if s["ticker"]]
    out.sort(key=lambda s: s["volume"], reverse=True)
    return out[:MAX_SERIES_PER_TOPIC]


def fetch_open_events(series_ticker, errors):
    events, cursor = [], None
    for _ in range(20):
        params = {"series_ticker": series_ticker, "status": "open",
                  "with_nested_markets": "true", "limit": 200}
        if cursor:
            params["cursor"] = cursor
        body, url = api_get("/events", params)
        if not body:
            errors.append({"where": "events", "series": series_ticker, "url": url})
            break
        events.extend(body.get("events", []))
        cursor = body.get("cursor")
        if not cursor:
            break
    return events


def screen_high_roi(m, direction):
    """Rule-based screen. Returns (passes, entry_price, roi_proxy, reasons)."""
    bid, ask = m["yes_bid"], m["yes_ask"]
    reasons = []
    if bid is None or ask is None or ask <= 0:
        return False, None, None, ["bid/ask missing from API (unverified)"]
    spread = round(ask - bid, 4)
    entry = ask  # paper entry is always a buy of YES at the ask
    roi = round((1 - entry) / entry, 4) if entry > 0 else None
    ok = True
    if spread <= SCREEN_MAX_SPREAD:
        reasons.append(f"spread {spread:.2f} <= {SCREEN_MAX_SPREAD:.2f}")
    else:
        ok = False
        reasons.append(f"spread {spread:.2f} > {SCREEN_MAX_SPREAD:.2f}")
    if m["yes_ask_size"] is not None and m["yes_ask_size"] >= SCREEN_MIN_ASK_SIZE:
        reasons.append(f"ask size {m['yes_ask_size']:.0f} >= {SCREEN_MIN_ASK_SIZE}")
    else:
        ok = False
        reasons.append(f"ask size {m['yes_ask_size']} < {SCREEN_MIN_ASK_SIZE}")
    if m["volume_24h"] is not None and m["volume_24h"] >= SCREEN_MIN_VOLUME_24H:
        reasons.append(f"24h volume {m['volume_24h']:.0f} >= {SCREEN_MIN_VOLUME_24H}")
    else:
        ok = False
        reasons.append(f"24h volume {m['volume_24h']} < {SCREEN_MIN_VOLUME_24H}")
    if SCREEN_PRICE_MIN <= entry <= SCREEN_PRICE_MAX:
        reasons.append(f"entry {entry:.2f} within {SCREEN_PRICE_MIN}-{SCREEN_PRICE_MAX}")
    else:
        ok = False
        reasons.append(f"entry {entry:.2f} outside {SCREEN_PRICE_MIN}-{SCREEN_PRICE_MAX}")
    return ok, entry, roi, reasons


def main():
    started = utc_now()
    ts = iso(started)
    errors = []
    state = load_state()
    state["runs"] = state.get("runs", 0) + 1
    state.setdefault("first_run", ts)

    # ---- 1. Discover live markets per topic -------------------------------
    live = {}          # ticker -> market record
    series_seen = {}
    for topic_key, cfg in TOPICS.items():
        try:
            series_list = discover_series(topic_key, cfg, errors)
        except Exception as e:  # keep going; record the failure
            errors.append({"where": "series", "topic": topic_key, "error": str(e)})
            continue
        series_seen[topic_key] = len(series_list)
        for s in series_list:
            try:
                events = fetch_open_events(s["ticker"], errors)
            except Exception as e:
                errors.append({"where": "events", "series": s["ticker"], "error": str(e)})
                continue
            for ev in events:
                ev_sources = [{"name": x.get("name"), "url": x.get("url")}
                              for x in ev.get("settlement_sources", []) if x.get("url")]
                for mk in ev.get("markets", []):
                    t = mk.get("ticker")
                    # An open event may contain closed, settled, or paused children.
                    # The lifecycle docs map status=open to market status=active.
                    if not t or t in live or mk.get("status") != "active":
                        continue
                    live[t] = {
                        "ticker": t,
                        "topic": topic_key,
                        "topic_label": cfg["label"],
                        "series_ticker": ev.get("series_ticker") or s["ticker"],
                        "event_ticker": ev.get("event_ticker"),
                        "event_title": ev.get("title"),
                        "title": mk.get("title"),
                        "yes_sub_title": mk.get("yes_sub_title"),
                        "status": mk.get("status"),
                        "close_time": mk.get("close_time"),
                        "last": num(mk.get("last_price_dollars")),
                        "yes_bid": num(mk.get("yes_bid_dollars")),
                        "yes_ask": num(mk.get("yes_ask_dollars")),
                        "no_bid": num(mk.get("no_bid_dollars")),
                        "no_ask": num(mk.get("no_ask_dollars")),
                        "yes_bid_size": num(mk.get("yes_bid_size_fp")),
                        "yes_ask_size": num(mk.get("yes_ask_size_fp")),
                        "volume": num(mk.get("volume_fp")),
                        "volume_24h": num(mk.get("volume_24h_fp")),
                        "open_interest": num(mk.get("open_interest_fp")),
                        "settlement_sources": ev_sources,
                        "source_url": f"{BASE}/markets/{t}",
                        "events_source_url": f"{BASE}/events?series_ticker={s['ticker']}&status=open",
                        "fetched_at": ts,
                    }
    # ---- 2. Snapshots, alerts, history ----------------------------------
    cutoff = iso(started - dt.timedelta(days=HISTORY_PRUNE_DAYS))
    for t in list(state["history"].keys()):
        h = state["history"][t]
        if t not in live and (not h or h[-1][0] < cutoff):
            del state["history"][t]
    alerts_new = []
    processed = set(state.get("processed_alerts", []))
    for t, m in live.items():
        hist = state["history"].setdefault(t, [])
        prev = hist[-1] if hist else None
        if m["last"] is not None:
            hist.append([ts, m["last"], m["yes_bid"], m["yes_ask"], m["volume_24h"], m["open_interest"]])
            del hist[:-HISTORY_CAP]
        if prev and m["last"] is not None and prev[1] is not None:
            delta = round(m["last"] - prev[1], 4)
            if abs(delta) + 1e-9 >= ALERT_THRESHOLD:
                direction = "up" if delta > 0 else "down"
                ok, entry, roi, reasons = screen_high_roi(m, direction)
                alert_id = f"{t}|{ts}"
                if alert_id not in processed:
                    processed.add(alert_id)
                    a = {
                        "id": alert_id,
                        "ts": ts,
                        "ticker": t,
                        "title": m["title"],
                        "event_title": m["event_title"],
                        "topic": m["topic"],
                        "topic_label": m["topic_label"],
                        "direction": direction,
                        "from": prev[1],
                        "to": m["last"],
                        "delta": delta,
                        "prev_ts": prev[0],
                        "spread": round(m["yes_ask"] - m["yes_bid"], 4) if (m["yes_ask"] is not None and m["yes_bid"] is not None) else None,
                        "ask_size": m["yes_ask_size"],
                        "volume_24h": m["volume_24h"],
                        "high_roi": bool(ok),
                        "screen_reasons": reasons,
                        "entry_price": entry,
                        "roi_proxy": roi,
                        "cause": "UNVERIFIED: the API does not report what caused the move",
                        "reference_links": m["settlement_sources"],
                        "source_url": m["source_url"],
                    }
                    alerts_new.append(a)
    state["processed_alerts"] = sorted(processed)[-5000:]
    state["alerts"] = (state.get("alerts", []) + alerts_new)[-ALERT_CAP:]

    # ---- 3. Remember markets, check resolutions ----------------------------
    for t, m in live.items():
        rec = state["markets"].setdefault(t, {})
        rec.update({k: m[k] for k in (
            "ticker", "topic", "topic_label", "series_ticker", "event_ticker", "event_title",
            "title", "yes_sub_title", "status", "close_time", "settlement_sources", "source_url")})
        rec["last_seen"] = ts
        rec.setdefault("resolved", False)

    # Rotate through pending markets by their last attempted check. Recording an
    # attempt before the request also prevents a failing first batch from
    # permanently starving later markets when the per-run limit is reached.
    pending = [(t, rec) for t, rec in state["markets"].items()
               if t not in live and not rec.get("resolved")]
    pending.sort(key=lambda item: (item[1].get("api_status_checked_at") or "", item[0]))
    for t, rec in pending[:MAX_RESOLUTION_CHECKS]:
        rec["api_status_checked_at"] = ts
        try:
            body, url = api_get(f"/markets/{t}")
        except Exception as e:
            errors.append({"where": "market", "ticker": t, "error": str(e)})
            continue
        if not body or "market" not in body:
            rec["api_note"] = "market not returned by API"
            continue
        mk = body["market"]
        rec["status"] = mk.get("status")
        rec["api_source_url"] = url
        rec["settlement_ts"] = mk.get("settlement_ts")
        # A determined result can still be disputed or amended. Only the
        # finalized state means settlement is complete in Kalshi's REST API.
        if mk.get("status") == "finalized" and mk.get("result") in ("yes", "no"):
            rec["result"] = mk["result"]
            rec["resolved"] = True
            # Keep the exchange's timestamp separate from when this collector
            # first observed final settlement; don't invent a settlement time.
            rec["resolved_at"] = mk.get("settlement_ts")
            rec["resolution_observed_at"] = ts
            rec["settlement_value"] = num(mk.get("settlement_value_dollars"))
            rec["last_observed_while_active"] = (state["history"].get(t) or [[None, None]])[-1][1]
    # ---- 4. Paper trades (simulated) --------------------------------------
    trades = state.get("trades", [])
    open_trades = [tr for tr in trades if tr["status"] == "open"]
    for a in alerts_new:
        if not a["high_roi"] or a["entry_price"] is None:
            continue
        strategy = "fade_drop" if a["direction"] == "down" else "follow_rise"
        if any(tr["ticker"] == a["ticker"] and tr["strategy"] == strategy and tr["status"] == "open"
               for tr in trades):
            continue
        entry = a["entry_price"]
        trades.append({
            "id": f"{a['ticker']}|{strategy}|{ts}",
            "opened_at": ts, "ticker": a["ticker"], "title": a["title"],
            "topic": a["topic"], "topic_label": a["topic_label"], "strategy": strategy,
            "alert_direction": a["direction"], "side": "YES", "qty": TRADE_QTY,
            "entry": entry, "target": round(min(entry + TARGET_MOVE, 0.99), 4),
            "stop": round(max(entry - TARGET_MOVE, 0.01), 4), "status": "open",
            "exit": None, "exit_at": None, "exit_reason": None, "pnl": None,
            "source_url": a["source_url"],
        })
    now_dt = started
    for tr in trades:
        if tr["status"] != "open":
            continue
        t = tr["ticker"]
        m = live.get(t)
        mrec = state["markets"].get(t, {})
        if mrec.get("resolved"):
            exit_px = 1.0 if mrec.get("result") == "yes" else 0.0
            tr.update(status="closed", exit=exit_px, exit_at=mrec.get("resolved_at"),
                      exit_observed_at=ts, exit_reason="settled")
        elif m and m["yes_bid"] is not None:
            bid = m["yes_bid"]
            opened = dt.datetime.strptime(tr["opened_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
            if bid >= tr["target"]:
                tr.update(status="closed", exit=bid, exit_at=ts, exit_reason="target")
            elif bid <= tr["stop"]:
                tr.update(status="closed", exit=bid, exit_at=ts, exit_reason="stop")
            elif (now_dt - opened).total_seconds() >= TIME_STOP_HOURS * 3600:
                tr.update(status="closed", exit=bid, exit_at=ts, exit_reason="time_stop")
            tr["mark"] = bid
        if tr["status"] == "closed":
            tr["pnl"] = round((tr["exit"] - tr["entry"]) * tr["qty"], 4)
        elif m and m["yes_bid"] is not None:
            tr["unrealized_pnl"] = round((m["yes_bid"] - tr["entry"]) * tr["qty"], 4)
            tr["mark"] = m["yes_bid"]
    state["trades"] = trades[-5000:]

    # ---- 5. Order-book depth for the most active live markets -------------
    books = {}
    top = sorted(live.values(), key=lambda m: m["volume_24h"] or 0, reverse=True)[:ORDERBOOK_TOP_N]
    for m in top:
        try:
            body, url = api_get(f"/markets/{m['ticker']}/orderbook", {"depth": 10})
        except Exception as e:
            errors.append({"where": "orderbook", "ticker": m["ticker"], "error": str(e)})
            continue
        if not body:
            continue
        ob = body.get("orderbook_fp", {})
        def levels(side):
            out = []
            for lv in ob.get(side) or []:
                if len(lv) >= 2:
                    out.append({"price": num(lv[0]), "contracts": num(lv[1]), "contracts_cumulative": None})
            cum = 0.0
            for lv in out:
                cum += lv["contracts"] or 0
                lv["contracts_cumulative"] = round(cum, 2)
            return out
        books[m["ticker"]] = {"ts": ts, "yes_bids": levels("yes_dollars"), "no_bids": levels("no_dollars"),
                              "source_url": url}

    # ---- 5b. Real price history: 1-minute/1-hour candles + trade tape -------
    by_activity = sorted(live.values(), key=lambda m: (m["volume_24h"] or 0, m["open_interest"] or 0), reverse=True)
    candle_targets = by_activity[:CANDLE_MARKETS]
    tape_targets = by_activity[:TRADE_MARKETS]
    now_ts = int(started.timestamp())
    candles_out = {"generated_at": ts, "interval_1m": {}, "interval_60m": {}}
    for m in candle_targets:
        for interval, seconds, key in ((1, CANDLE_MINUTES * 60, "interval_1m"), (60, CANDLE_HOURS * 3600, "interval_60m")):
            try:
                body, url = api_get(f"/series/{m['series_ticker']}/markets/{m['ticker']}/candlesticks",
                                    {"start_ts": now_ts - seconds, "end_ts": now_ts, "period_interval": interval})
            except Exception as e:  # noqa: BLE001 - one market must not stop the run
                errors.append({"where": "candlesticks", "ticker": m["ticker"], "error": str(e)})
                continue
            if not body:
                continue
            rows = []
            for c in body.get("candlesticks") or []:
                price = c.get("price") or {}
                bid = c.get("yes_bid") or {}
                ask = c.get("yes_ask") or {}
                rows.append({
                    "ts": c.get("end_period_ts"),
                    "open": num(price.get("open_dollars")), "high": num(price.get("high_dollars")),
                    "low": num(price.get("low_dollars")), "close": num(price.get("close_dollars")),
                    "mean": num(price.get("mean_dollars")), "previous": num(price.get("previous_dollars")),
                    "bid": num(bid.get("close_dollars")), "ask": num(ask.get("close_dollars")),
                    "volume": num(c.get("volume_fp")), "open_interest": num(c.get("open_interest_fp")),
                })
            candles_out[key][m["ticker"]] = {"series_ticker": m["series_ticker"], "topic": m["topic"],
                                             "source_url": url, "candles": rows}

    ticks_out = {"generated_at": ts, "markets": {}}
    for m in tape_targets:
        try:
            body, url = api_get("/markets/trades", {"ticker": m["ticker"], "limit": 1000,
                                                    "min_ts": now_ts - TAPE_HOURS * 3600})
        except Exception as e:  # noqa: BLE001
            errors.append({"where": "trades", "ticker": m["ticker"], "error": str(e)})
            continue
        if not body:
            continue
        rows = []
        for tr in body.get("trades") or []:
            rows.append({"ts": tr.get("created_time"), "price": num(tr.get("yes_price_dollars")),
                         "count": num(tr.get("count_fp")), "taker_side": tr.get("taker_side"),
                         "is_block": tr.get("is_block_trade")})
        rows.sort(key=lambda r: r["ts"] or "")
        ticks_out["markets"][m["ticker"]] = {"topic": m["topic"], "source_url": url, "trades": rows}

    # ---- 6. Write site data ------------------------------------------------
    # Publish only markets with activity, capped per topic by activity.
    published, omitted = [], {}
    for topic_key in TOPICS:
        rows = [m for m in live.values() if m["topic"] == topic_key]
        active = [m for m in rows if (m["volume_24h"] or 0) > 0 or (m["open_interest"] or 0) > 0]
        keep = active if active else rows[:25]
        keep.sort(key=lambda m: (m["volume_24h"] or 0, m["open_interest"] or 0), reverse=True)
        published.extend(keep[:MAX_MARKETS_PER_TOPIC])
        omitted[topic_key] = max(0, len(rows) - len(keep[:MAX_MARKETS_PER_TOPIC]))
    published_tickers = {m["ticker"] for m in published}

    markets_out = []
    for m in published:
        t = m["ticker"]
        h = state["history"].get(t, [])
        prev_last = h[-2][1] if len(h) >= 2 else None
        vol24 = m["volume_24h"]
        last = m["last"]
        computed_dollar_volume = round(vol24 * last, 2) if (vol24 is not None and last) else None
        markets_out.append({
            **{k: m[k] for k in ("ticker", "topic", "topic_label", "series_ticker", "event_ticker",
                                  "event_title", "title", "yes_sub_title", "status", "close_time",
                                  "last", "yes_bid", "yes_ask", "no_bid", "no_ask", "yes_bid_size",
                                  "yes_ask_size", "volume", "volume_24h", "open_interest",
                                  "settlement_sources", "source_url", "events_source_url", "fetched_at")},
            "change_since_prev": round(m["last"] - prev_last, 4) if (prev_last is not None and m["last"] is not None) else None,
            # Computed by this collector from two API fields, NOT an API field itself:
            "dollar_volume_24h_computed": computed_dollar_volume,
            "notional_open_interest_computed": round(m["open_interest"] * last, 2) if (m["open_interest"] and last) else None,
            "ask_depth_dollars_computed": round(m["yes_ask_size"] * m["yes_ask"], 2) if (m["yes_ask_size"] and m["yes_ask"]) else None,
            "has_traded": bool(vol24),
            "resolved": False,
            "result": None,
        })
    resolved_out = [
        {"ticker": t, **{k: r.get(k) for k in ("topic", "topic_label", "title", "event_title", "status", "result",
                                              "resolved_at", "settlement_ts", "resolution_observed_at",
                                              "settlement_value", "last_observed_while_active", "close_time",
                                              "source_url", "api_source_url")}}
        for t, r in state["markets"].items() if r.get("resolved")
    ]
    for r in resolved_out:
        r["source_url"] = r.get("api_source_url") or r.get("source_url")
    # Summary statistics for simulated trades
    closed = [t for t in state["trades"] if t["status"] == "closed"]
    opened = [t for t in state["trades"] if t["status"] == "open"]

    def summarise(rows, key):
        groups = {}
        for tr in rows:
            groups.setdefault(tr[key], []).append(tr)
        out = []
        for g, items in sorted(groups.items()):
            pnls = [i["pnl"] for i in items if i.get("pnl") is not None]
            wins = [p for p in pnls if p > 0]
            total = round(sum(pnls), 4)
            n_contracts = sum(i["qty"] for i in items if i.get("pnl") is not None)
            out.append({"group": g, "closed_trades": len(pnls), "wins": len(wins),
                        "win_rate": round(len(wins) / len(pnls), 4) if pnls else None,
                        "total_pnl": total,
                        "avg_pnl_per_contract": round(total / n_contracts, 4) if n_contracts else None})
        return out

    START_CASH = 10000.0  # paper bankroll, NOT the Kalshi demo account balance
    realized = round(sum(t["pnl"] for t in closed if t.get("pnl") is not None), 4)
    unrealized = round(sum(t.get("unrealized_pnl") or 0 for t in opened), 4)
    trades_out = {
        "generated_at": ts,
        "portfolio": {
            "mode": "SIMULATED paper portfolio (no Kalshi account is connected)",
            "starting_cash": START_CASH,
            "realized_pnl": realized,
            "unrealized_pnl": unrealized,
            "equity": round(START_CASH + realized + unrealized, 4),
            "open_positions": len(opened),
            "closed_trades": len(closed),
            "win_rate": round(len([t for t in closed if (t.get("pnl") or 0) > 0]) / len(closed), 4) if closed else None,
        },
        "mode": "SIMULATED (paper) - no orders are placed",
        "assumptions": {"qty_per_trade": TRADE_QTY, "target_move": TARGET_MOVE,
                        "time_stop_hours": TIME_STOP_HOURS, "exit_price": "YES bid (conservative)",
                        "fees": "not modelled", "entry": "YES ask at alert time"},
        "by_strategy": summarise(closed, "strategy"),
        "by_topic": summarise(closed, "topic"),
        "by_alert_direction": summarise(closed, "alert_direction"),
        "open_trades": opened,
        "closed_trades": closed[-500:],
    }
    meta = {
        "generated_at": ts,
        "api_base": BASE,
        "runs": state["runs"],
        "first_run": state["first_run"],
        "alert_threshold_dollars": ALERT_THRESHOLD,
        "environment": "demo" if urllib.parse.urlparse(BASE).hostname in _DEMO_API_HOSTS else "custom/override",
        "live_market_count": len(markets_out),
        "open_markets_seen": len(live),
        "markets_omitted_per_topic": omitted,
        "candle_markets": len(candles_out["interval_1m"]),
        "tape_markets": len(ticks_out["markets"]),
        "series_per_topic": series_seen,
        "topics": {k: {"label": v["label"], "note": v["note"], "filter": v["params"]} for k, v in TOPICS.items()},
        "orderbook_markets": len(books),
        "errors": errors[-200:],
        "error_count": len(errors),
        "snapshot_interval_note": "Snapshots happen once per scheduled run (about every 15 min), so a 'sudden' move is measured between runs.",
        "resolution_rule": "Only status=finalized with result=yes/no is a resolution; resolved_at/settlement_ts is the API time and resolution_observed_at is the collector observation time.",
        "screen": {"max_spread": SCREEN_MAX_SPREAD, "min_ask_size": SCREEN_MIN_ASK_SIZE,
                   "min_volume_24h": SCREEN_MIN_VOLUME_24H, "entry_range": [SCREEN_PRICE_MIN, SCREEN_PRICE_MAX]},
    }
    alerts_out = list(reversed(state["alerts"]))[:500]
    history_out = {t: [{"ts": p[0], "last": p[1], "bid": p[2], "ask": p[3], "vol24": p[4], "oi": p[5]}
                       for p in state["history"].get(t, [])] for t in live}
    # Event-level rollup (one row per event) for the "highest dollar amount" ranking.
    events_map = {}
    for m in markets_out:
        key = (m["topic"], m["event_ticker"] or m["ticker"])
        ev = events_map.setdefault(key, {
            "topic": m["topic"], "topic_label": m["topic_label"],
            "event_ticker": m["event_ticker"], "title": m["event_title"] or m["title"],
            "markets": 0, "contracts_24h": 0.0, "dollar_volume_24h_computed": 0.0,
            "open_interest": 0.0, "has_traded": False,
            "source_url": m["events_source_url"], "close_time": m["close_time"],
        })
        ev["markets"] += 1
        ev["contracts_24h"] += m["volume_24h"] or 0
        ev["dollar_volume_24h_computed"] += m["dollar_volume_24h_computed"] or 0
        ev["open_interest"] += m["open_interest"] or 0
        ev["has_traded"] = ev["has_traded"] or m["has_traded"]
        if m["close_time"] and (not ev["close_time"] or m["close_time"] < ev["close_time"]):
            ev["close_time"] = m["close_time"]
    events_out = sorted(events_map.values(),
                        key=lambda e: (e["dollar_volume_24h_computed"], e["contracts_24h"]), reverse=True)[:EVENT_ROWS]
    for i, e in enumerate(events_out):
        e["rank_by_dollar_volume"] = i + 1
        e["contracts_24h"] = round(e["contracts_24h"], 2)
        e["dollar_volume_24h_computed"] = round(e["dollar_volume_24h_computed"], 2)
        e["open_interest"] = round(e["open_interest"], 2)

    save_json(os.path.join(OUT_DIR, "markets.json"), {"generated_at": ts, "markets": markets_out}, compact=True)
    save_json(os.path.join(OUT_DIR, "events.json"), {"generated_at": ts, "events": events_out,
        "rank_note": "Ranked by dollar_volume_24h_computed = sum over the event's published markets of "
                     "volume_24h_fp x last_price_dollars. Both inputs are API fields; the product is computed here."}, compact=True)
    save_json(os.path.join(OUT_DIR, "candles.json"), candles_out, compact=True)
    save_json(os.path.join(OUT_DIR, "ticks.json"), ticks_out, compact=True)
    save_json(os.path.join(OUT_DIR, "alerts.json"), {"generated_at": ts, "threshold": ALERT_THRESHOLD, "alerts": alerts_out})
    save_json(os.path.join(OUT_DIR, "history.json"), {"generated_at": ts, "series": history_out}, compact=True)
    save_json(os.path.join(OUT_DIR, "orderbooks.json"), {"generated_at": ts, "books": books}, compact=True)
    save_json(os.path.join(OUT_DIR, "resolved.json"), {"generated_at": ts, "resolved": resolved_out})
    save_json(os.path.join(OUT_DIR, "trades.json"), trades_out)
    save_json(os.path.join(OUT_DIR, "meta.json"), meta)

    os.makedirs(os.path.dirname(STATE_PATH) or ".", exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f)

    print(f"[{ts}] live markets={len(markets_out)} new_alerts={len(alerts_new)} "
          f"high_roi_alerts={sum(1 for a in alerts_new if a['high_roi'])} "
          f"resolved_total={len(resolved_out)} open_trades={len(opened)} "
          f"orderbooks={len(books)} errors={len(errors)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
