"""Swing detection: flags price moves of at least $0.10 in either direction.

Two outputs, matching the two scrolling chats on the dashboard:

  all_feed      every detected move >= $0.10, newest first (cap 400)
  high_roi_feed only moves that also pass the model's ROI filter (cap 200)

The alert threshold is $0.10 in absolute contract price, compared against the
move measured over the alert window.  Nothing is inferred: if the window does not
contain two observed prices, no alert is emitted.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

try:
    from .strategy import STRATEGY_INDEX, fee_dollars
except ImportError:  # direct execution
    from strategy import STRATEGY_INDEX, fee_dollars  # type: ignore

THRESHOLD = 0.10
DEFAULT_WINDOW_POINTS = 6          # snapshots back to measure a swing
MAX_ALERTS = 400
MAX_ROI_ALERTS = 200


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def price_of(point: dict) -> float | None:
    for key in ("mid", "last", "bid", "ask"):
        v = point.get(key)
        if v is not None:
            return float(v)
    return None


def detect(market: dict, points: list[dict], window: int = DEFAULT_WINDOW_POINTS,
           rearm_dollars: float = 0.02) -> list[dict]:
    """Return the >= $0.10 window moves for one market, oldest first.

    Alerting is *stateful*: once a move fires, a second alert for the same market
    is only emitted after the price has come back to within `rearm_dollars` of the
    price the first alert was measured from.  Without this, a market that jumps
    $0.10 and sits there would re-alert on every cycle forever, because the
    comparison price stays in the lookback window.
    """
    if len(points) < 2:
        return []
    out: list[dict] = []
    armed_level: float | None = None  # pre-alert price; cleared once a retrace is seen
    for i in range(1, len(points)):
        j = max(0, i - window)
        a, b = points[j], points[i]
        pa, pb = price_of(a), price_of(b)
        if pa is None or pb is None:
            continue
        # Re-arm only after a real retrace: the comparison price `pa` must come
        # back within `rearm_dollars` of the price the market was at BEFORE the
        # last alert (`armed_level`).  A market that keeps trending in the same
        # direction therefore does not re-alert on every snapshot, while a market
        # that jumps, retraces, and jumps again alerts twice.
        if armed_level is not None and abs(pa - armed_level) <= rearm_dollars:
            armed_level = None
        move = round(pb - pa, 4)
        if abs(move) + 1e-12 >= THRESHOLD and armed_level is None:
            armed_level = pa      # the pre-alert level this alert is measured from
            out.append({
                "ticker": market["ticker"],
                "topic": market.get("topic"),
                "title": market.get("title"),
                "subtitle": market.get("subtitle"),
                "from_ts": a.get("ts"), "to_ts": b.get("ts"),
                "from_time": a.get("t"), "to_time": b.get("t"),
                "from_price": pa, "to_price": pb,
                "move_dollars": move,
                "move_pct": round(move / pa * 100, 2) if pa else None,
                "direction": "up" if move > 0 else "down",
                "window_points": i - j,
                "close_time": market.get("close_time"),
                "status": market.get("status"),
                "source_url": market.get("api_url"),
                "rule": f"|{pb:.4f} - {pa:.4f}| >= $0.10",
                "rearm_rule": (f"re-arms after the price returns within ${rearm_dollars:.2f} "
                               f"of the pre-alert level {pa:.4f}"),
            })
    return out


def roi_view(alert: dict) -> dict:
    """Attach the model's ROI evaluation to an alert.

    The model's reference trade is the mean-reversion entry (buy the side the
    move moved away from, i.e. fade the move) sized 10 contracts at the alert
    price; ROI on risk is computed with the official fee formula, so the number
    shown is derived, not assumed.
    """
    side = "no" if alert["direction"] == "up" else "yes"
    entry = alert["to_price"] if side == "yes" else round(1.0 - alert["to_price"], 4)
    contracts = 10.0
    fee = fee_dollars(entry, contracts, taker=True)
    cost = entry * contracts + fee
    max_profit = (1.0 - entry) * contracts - fee
    roi = round(max_profit / cost * 100, 2) if cost > 0 else None
    alert["model"] = {
        "side": side, "entry_dollars": round(entry, 4), "contracts": contracts,
        "fee_dollars": round(fee, 4), "cost_dollars": round(cost, 4),
        "max_profit_dollars": round(max_profit, 4),
        "roi_on_risk_pct": roi,
        "strategy_id": "S2_MEAN_REVERT",
        "strategy_name": STRATEGY_INDEX["S2_MEAN_REVERT"]["name"],
    }
    return alert


def qualifies(alert: dict, min_roi: float = 25.0) -> bool:
    """The "high ROI" filter used by the selective chat.

    A move qualifies when the model's ROI on risk is >= 25% AND the entry price is
    in the $0.10-$0.90 band, so a single contract cannot lose more than $0.90 and
    the capped-profit arithmetic is meaningful.  Both conditions are stated on
    the site next to the feed.
    """
    roi = (alert.get("model") or {}).get("roi_on_risk_pct")
    entry = (alert.get("model") or {}).get("entry_dollars")
    return bool(roi is not None and entry is not None and roi >= min_roi and 0.10 <= entry <= 0.90)


def build(data_dir: str, markets: list[dict], window: int = DEFAULT_WINDOW_POINTS) -> dict:
    history_dir = os.path.join(data_dir, "history")
    alerts: list[dict] = []
    for m in markets:
        path = os.path.join(history_dir, f"{m['ticker']}.json")
        if not os.path.exists(path):
            continue
        try:
            import json
            with open(path, "r", encoding="utf-8") as fh:
                doc = json.load(fh)
        except (OSError, ValueError):
            continue
        alerts.extend(detect(m, doc.get("points") or [], window))
    alerts.sort(key=lambda a: (a["to_ts"] or 0), reverse=True)
    for a in alerts:
        roi_view(a)
    roi_alerts = [a for a in alerts if qualifies(a)]
    return {
        "generated_at": utc_now(),
        "threshold_dollars": THRESHOLD,
        "window_points": window,
        "window_semantics": ("window_points = number of snapshots back that each price is compared "
                             "against; the collector runs every 5 minutes, so 6 points = 30 minutes."),
        "rearm_dollars": 0.02,
        "all_feed": alerts[:MAX_ALERTS],
        "high_roi_feed": roi_alerts[:MAX_ROI_ALERTS],
        "counts": {"all": len(alerts), "high_roi": len(roi_alerts),
                   "up": sum(1 for a in alerts if a["direction"] == "up"),
                   "down": sum(1 for a in alerts if a["direction"] == "down")},
        "high_roi_rule": ("model ROI on risk >= 25% and entry price between $0.10 and $0.90 "
                          "(mean-reversion reference trade, 10 contracts, taker fee)"),
    }
