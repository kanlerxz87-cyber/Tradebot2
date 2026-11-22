"""Alert detection: the >= $0.10 rule, expressed once and reused everywhere.

Official facts used here
------------------------
* Prices arrive as fixed-point dollar strings (``*_dollars``), so comparisons
  are done in ``Decimal`` and never in binary floats
  (https://docs.kalshi.com/getting_started/fixed_point_migration.md).
* The book gives bids only; the YES ask is ``1 - best NO bid``
  (https://docs.kalshi.com/getting_started/orderbook_responses.md).

The threshold is a parameter (default ``0.10``) because the requirement is
"$0.10 in either direction"; moving the constant changes both feeds at once.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from decimal import Decimal

THRESHOLD = Decimal("0.10")


@dataclass
class PricePoint:
    ts: int  # unix seconds
    price: Decimal
    basis: str  # "mid" | "last" | "bid"
    bid: Decimal | None = None
    ask: Decimal | None = None
    depth_contracts: Decimal | None = None  # contracts bid within 1c of best
    spread: Decimal | None = None

    def iso(self) -> str:
        return datetime.fromtimestamp(self.ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class Alert:
    ts: int
    ticker: str
    event_ticker: str
    topic: str
    title: str
    before: str
    after: str
    delta: str
    direction: str  # "up" | "down"
    basis: str
    basis_before: str
    liquidity_before: str | None
    liquidity_after: str | None
    spread_after: str | None
    roi_score: float
    high_roi: bool
    source_url: str
    evidence_url: str | None
    note: str

    def iso(self) -> str:
        return datetime.fromtimestamp(self.ts, tz=timezone.utc).strftime("%H:%M:%SZ")


def roi_score(delta: Decimal, liquidity: Decimal | None, spread: Decimal | None,
              volume: Decimal | None, minutes_to_close: float | None) -> float:
    """Transparent 0-100 heuristic used only to split the two chat feeds.

    Deliberately simple and published in full so a reader can disagree with it:

        score = 45 * min(|move| / 0.25, 1)          move size, saturating at 25c
              + 25 * min(liq / 2000, 1)             contracts bid within 1c
              + 15 * (1 - min(spread / 0.10, 1))    tight book is tradeable
              + 10 * min(log10(1 + volume) / 4, 1)  activity
              +  5 * urgency                        < 60 min to close

    It is a *ranking aid*, not a forecast, and it never claims to predict a
    resolution. `high_roi` in the UI means "scored >= 55 here".
    """
    move = min(abs(float(delta)) / 0.25, 1.0)
    liq = min(float(liquidity or 0) / 2000.0, 1.0)
    tight = 1.0 if spread is None else 1.0 - min(float(spread) / 0.10, 1.0)
    act = min(math.log10(1 + float(volume or 0)) / 4.0, 1.0)
    urgency = 1.0 if (minutes_to_close is not None and 0 <= minutes_to_close <= 60) else 0.0
    return round(45 * move + 25 * liq + 15 * tight + 10 * act + 5 * urgency, 1)


def detect_alerts(series_by_ticker: dict[str, list[PricePoint]],
                  meta: dict[str, dict],
                  threshold: Decimal = THRESHOLD,
                  min_high_roi: float = 55.0) -> list[Alert]:
    """Walk each ticker's price path and emit one alert per threshold crossing.

    ``meta[ticker]`` needs: event_ticker, topic, title, source_url, evidence_url,
    volume, minutes_to_close. Missing keys degrade to blanks, never to guesses.
    """
    out: list[Alert] = []
    for ticker, points in series_by_ticker.items():
        info = meta.get(ticker, {})
        for prev, cur in zip(points, points[1:]):
            delta = cur.price - prev.price
            if abs(delta) < threshold:
                continue
            score = roi_score(delta, cur.depth_contracts, cur.spread,
                              info.get("volume"), info.get("minutes_to_close"))
            out.append(Alert(
                ts=cur.ts,
                ticker=ticker,
                event_ticker=info.get("event_ticker", ""),
                topic=info.get("topic", ""),
                title=info.get("title", ticker),
                before=str(prev.price),
                after=str(cur.price),
                delta=str(delta.copy_abs()),
                direction="up" if delta > 0 else "down",
                basis=cur.basis,
                basis_before=prev.basis,
                liquidity_before=None if prev.depth_contracts is None else str(prev.depth_contracts),
                liquidity_after=None if cur.depth_contracts is None else str(cur.depth_contracts),
                spread_after=None if cur.spread is None else str(cur.spread),
                roi_score=score,
                high_roi=score >= min_high_roi,
                source_url=info.get("source_url", ""),
                evidence_url=info.get("evidence_url"),
                note=info.get("note", "price move measured from the demo API snapshots"),
            ))
    out.sort(key=lambda a: a.ts, reverse=True)
    return out


def alert_dict(alert: Alert) -> dict:
    d = asdict(alert)
    return d


def summarize(alerts: list[Alert]) -> dict:
    if not alerts:
        return {"count": 0, "up": 0, "down": 0, "high_roi": 0, "threshold": str(THRESHOLD)}
    return {
        "count": len(alerts),
        "up": sum(1 for a in alerts if a.direction == "up"),
        "down": sum(1 for a in alerts if a.direction == "down"),
        "high_roi": sum(1 for a in alerts if a.high_roi),
        "threshold": str(THRESHOLD),
        "largest": max(alerts, key=lambda a: Decimal(a.delta)).delta,
    }
