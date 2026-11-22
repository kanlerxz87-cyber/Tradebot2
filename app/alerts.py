"""Swing detection.

Definition used throughout this project (the brief's rule):

    An alert fires when a contract's observed price changes by **at least
    $0.10** from the previous observation, in either direction.

Price basis:
  * ``mid`` — the midpoint of the YES bid and YES ask when both are present and
    the book is not crossed. This is the primary basis.
  * ``last`` — the last traded YES price, used only when no two-sided quote is
    available.

The detector is deterministic and side-effect free apart from its own state, so
it can run identically in the browser, in CI (seeded from candlesticks) and in
the Python server.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

EPS = 1e-9


def _num(value: Any) -> float | None:
    """Parse Kalshi's dollar/fixed-point fields without inventing values."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def quote_price(market: dict[str, Any]) -> tuple[float | None, str]:
    """Return (price, basis) for a market payload.

    Accepts both the current ``*_dollars`` fields and the legacy cent fields.
    Never guesses: if no usable price exists the result is ``(None, "none")``.
    """

    bid = _num(market.get("yes_bid_dollars"))
    ask = _num(market.get("yes_ask_dollars"))
    if bid is None:
        legacy = _num(market.get("yes_bid"))
        bid = None if legacy is None else legacy / 100.0
    if ask is None:
        legacy = _num(market.get("yes_ask"))
        ask = None if legacy is None else legacy / 100.0

    if bid is not None and ask is not None and 0.0 < bid <= ask <= 1.0:
        return round((bid + ask) / 2.0, 6), "mid"

    last = _num(market.get("last_price_dollars"))
    if last is None:
        legacy_last = _num(market.get("last_price"))
        last = None if legacy_last is None else legacy_last / 100.0
    if last is not None and 0.0 <= last <= 1.0:
        return round(last, 6), "last"

    # A one-sided book still tells us something, but not a fair mid. Using the
    # one available side would overstate certainty, so report no price.
    return None, "none"


def _iso(ts: float | int | None) -> str:
    if ts is None:
        return ""
    return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class Alert:
    ticker: str
    topic: str
    title: str
    ts: float
    before: float
    after: float
    basis: str
    source: str = "poll"
    event_ticker: str = ""
    volume_24h: float | None = None
    open_interest: float | None = None
    liquidity: dict[str, Any] = field(default_factory=dict)
    context: dict[str, Any] = field(default_factory=dict)

    @property
    def delta(self) -> float:
        return round(self.after - self.before, 6)

    @property
    def direction(self) -> str:
        return "up" if self.delta > 0 else "down"

    @property
    def abs_delta(self) -> float:
        return abs(self.delta)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ticker": self.ticker,
            "topic": self.topic,
            "title": self.title,
            "ts": int(self.ts),
            "time": _iso(self.ts),
            "before": round(self.before, 4),
            "after": round(self.after, 4),
            "delta": round(self.delta, 4),
            "abs_delta": round(self.abs_delta, 4),
            "direction": self.direction,
            "basis": self.basis,
            "source": self.source,
            "event_ticker": self.event_ticker,
            "volume_24h": self.volume_24h,
            "open_interest": self.open_interest,
            "liquidity": self.liquidity,
            "context": self.context,
        }


@dataclass
class SwingDetector:
    threshold: float = 0.10
    #: Ignore re-observations of the same market within this window when the
    #: price is unchanged (prevents duplicate chat lines from duplicate polls).
    dedupe_seconds: float = 1.0
    _last: dict[str, tuple[float, float]] = field(default_factory=dict)
    _seen: set[tuple[str, float, float, float]] = field(default_factory=set)

    def reset(self) -> None:
        self._last.clear()
        self._seen.clear()

    def observe(
        self,
        market: dict[str, Any],
        *,
        topic: str = "",
        title: str = "",
        ts: float | None = None,
        source: str = "poll",
    ) -> Alert | None:
        ticker = str(market.get("ticker") or "")
        if not ticker:
            return None
        price, basis = quote_price(market)
        if price is None:
            return None
        now = float(ts if ts is not None else _now())
        previous = self._last.get(ticker)
        self._last[ticker] = (price, now)
        if previous is None:
            return None

        before, before_ts = previous
        delta = price - before
        if abs(delta) + EPS < self.threshold:
            return None
        if now - before_ts < self.dedupe_seconds and abs(delta) < EPS:
            return None

        # Fingerprint includes the rounded move so a genuine second leg in the
        # same direction still alerts, while a repeated poll does not.
        fingerprint = (ticker, round(now, 3), round(before, 4), round(price, 4))
        if fingerprint in self._seen:
            return None
        self._seen.add(fingerprint)
        if len(self._seen) > 5000:
            self._seen = set(list(self._seen)[-2500:])

        return Alert(
            ticker=ticker,
            topic=topic or str(market.get("topic") or ""),
            title=title or str(market.get("title") or market.get("yes_sub_title") or ticker),
            ts=now,
            before=before,
            after=price,
            basis=basis,
            source=source,
            event_ticker=str(market.get("event_ticker") or ""),
            volume_24h=_num(market.get("volume_24h_fp")),
            open_interest=_num(market.get("open_interest_fp")),
        )


def _now() -> float:
    return datetime.now(tz=timezone.utc).timestamp()


def candle_close(candle: dict[str, Any]) -> float | None:
    price = candle.get("price") or {}
    value = _num(price.get("close_dollars"))
    if value is None:
        legacy = _num(price.get("close"))
        value = None if legacy is None else legacy / 100.0
    if value is None:
        # A period with no trades can have null OHLC; fall back to the previous
        # price field (documented as "previous_price" on the synthetic candle).
        prev = _num(price.get("previous_dollars"))
        value = prev
    return value


def swings_from_candles(
    candles: Iterable[dict[str, Any]],
    *,
    ticker: str,
    topic: str,
    title: str,
    threshold: float = 0.10,
    limit: int = 40,
    source: str = "candle",
) -> list[Alert]:
    """Derive historical swing alerts from consecutive candle closes.

    This is used to seed the alert feed with real, timestamped moves observed in
    the 24h before a snapshot is built. It is explicitly labelled
    ``source="candle"`` on the site: it is history, not a live notification.
    """

    alerts: list[Alert] = []
    previous: tuple[float, float] | None = None
    for candle in candles:
        ts = _num(candle.get("end_period_ts"))
        close = candle_close(candle)
        if ts is None or close is None:
            continue
        if previous is not None:
            before, before_ts = previous
            delta = close - before
            if abs(delta) + EPS >= threshold:
                alerts.append(
                    Alert(
                        ticker=ticker,
                        topic=topic,
                        title=title,
                        ts=ts,
                        before=before,
                        after=close,
                        basis="candle_close",
                        source=source,
                        context={"previous_candle_ts": int(before_ts)},
                    )
                )
        previous = (close, ts)
    alerts.sort(key=lambda a: a.ts, reverse=True)
    return alerts[:limit]
