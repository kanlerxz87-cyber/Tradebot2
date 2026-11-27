"""Transparent, heuristic opportunity scoring for the "high ROI" feed.

There is no claim of predictive accuracy here. Every number the model produces
is derived from observable inputs (quote, spread, recent swing, depth, time to
close) using the fixed formulas below, and every model trade is recorded so its
realised performance can be measured on the portfolio page. Inputs that are not
available are treated as missing, not imputed.

Scoring (0-100) is a weighted sum of:
  * edge:   model probability minus the price paid, normalised by the price paid
  * depth:  contracts available at the best opposing level (capped)
  * spread: tighter is better
  * time:   more time before close is better, with a penalty very close to close
  * volume: 24h volume (contracts) as a sanity check
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .alerts import Alert, _num, quote_price

#: Kalshi's general (quadratic) trading fee is 0.07 x contracts x price x
#: (1 - price). The worked example in the official fee-rounding page
#: (price $0.055 -> model fee $0.00363825) reproduces this formula exactly:
#: https://docs.kalshi.com/getting_started/fee_rounding
#: The fee is rounded up to 1e-6 per fill; settlement fees are zero for simple
#: YES/NO determinations per https://docs.kalshi.com/getting_started/market_settlement#fees.
FEE_RATE = 0.07

STRATEGIES = {
    "momentum": {
        "label": "Momentum continuation",
        "description": "Follow a >= $0.10 move when the book and volume confirm it.",
        "edge_weight": 0.25,
    },
    "mean_reversion": {
        "label": "Mean reversion",
        "description": "Fade an outsized move (>= $0.15) back toward the pre-move price.",
        "edge_weight": 0.18,
    },
    "favorite_drift": {
        "label": "Favorite drift near close",
        "description": "In the final 24h, buy strong favourites (>= $0.85) if depth supports it.",
        "edge_weight": 0.10,
    },
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def fee_per_contract(price: float, multiplier: float = 1.0) -> float:
    """Unrounded model fee for one contract, in dollars."""
    return max(0.0, FEE_RATE * multiplier * price * (1.0 - price))


def order_fee(contracts: float, price: float, multiplier: float = 1.0) -> float:
    """Whole-order model fee, rounded up to 1e-6 (the granularity documented
    on Kalshi's fee-rounding page)."""
    raw = FEE_RATE * multiplier * max(0.0, contracts) * price * (1.0 - price)
    return math.ceil(raw * 1_000_000.0 - 1e-9) / 1_000_000.0


def _book_metrics(book: dict[str, Any] | None) -> dict[str, Any]:
    """Summarise an orderbook payload.

    Supports the current ``orderbook_fp`` shape (``yes_dollars``/``no_dollars``
    arrays of [price, count]) and the legacy ``orderbook`` shape.
    """

    out = {
        "best_yes_bid": None,
        "best_yes_ask": None,
        "best_no_bid": None,
        "best_no_ask": None,
        "yes_depth": None,
        "no_depth": None,
        "yes_levels": [],
        "no_levels": [],
        "spread": None,
    }
    if not book:
        return out

    fp = book.get("orderbook_fp") if isinstance(book.get("orderbook_fp"), dict) else book
    yes_raw = fp.get("yes_dollars") or fp.get("yes") or []
    no_raw = fp.get("no_dollars") or fp.get("no") or []

    def levels(raw: list[Any]) -> list[list[float]]:
        parsed: list[list[float]] = []
        for item in raw:
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            price = _num(item[0])
            count = _num(item[1])
            if price is None or count is None:
                continue
            if price > 1.0:  # legacy cents
                price = price / 100.0
            parsed.append([round(price, 4), round(count, 2)])
        parsed.sort(key=lambda x: x[0])
        return parsed

    yes_levels = levels(yes_raw)
    no_levels = levels(no_raw)
    out["yes_levels"] = yes_levels[-8:]
    out["no_levels"] = no_levels[-8:]
    if yes_levels:
        out["best_yes_bid"] = yes_levels[-1][0]
        out["yes_depth"] = yes_levels[-1][1]
    if no_levels:
        out["best_no_bid"] = no_levels[-1][0]
        out["no_depth"] = no_levels[-1][1]
    # Binary book: only bids are returned. A NO bid at p implies a YES ask at
    # 1-p; a YES bid at q implies a NO ask at 1-q.
    if out["best_no_bid"] is not None:
        out["best_yes_ask"] = round(1.0 - out["best_no_bid"], 4)
    if out["best_yes_bid"] is not None:
        out["best_no_ask"] = round(1.0 - out["best_yes_bid"], 4)
    if out["best_yes_bid"] is not None and out["best_yes_ask"] is not None:
        out["spread"] = round(out["best_yes_ask"] - out["best_yes_bid"], 4)
    return out


def _hours_to_close(market: dict[str, Any], now: datetime | None = None) -> float | None:
    raw = market.get("close_time") or market.get("expiration_time")
    if not raw:
        return None
    try:
        text = str(raw).replace("Z", "+00:00")
        close = datetime.fromisoformat(text)
        if close.tzinfo is None:
            close = close.replace(tzinfo=timezone.utc)
        now = now or datetime.now(tz=timezone.utc)
        return (close - now).total_seconds() / 3600.0
    except (TypeError, ValueError):
        return None


def _quote_fields(market: dict[str, Any]) -> dict[str, float | None]:
    bid = _num(market.get("yes_bid_dollars"))
    ask = _num(market.get("yes_ask_dollars"))
    last = _num(market.get("last_price_dollars"))
    if bid is None and _num(market.get("yes_bid")) is not None:
        bid = _num(market.get("yes_bid")) / 100.0  # type: ignore[operator]
    if ask is None and _num(market.get("yes_ask")) is not None:
        ask = _num(market.get("yes_ask")) / 100.0  # type: ignore[operator]
    if last is None and _num(market.get("last_price")) is not None:
        last = _num(market.get("last_price")) / 100.0  # type: ignore[operator]
    return {"bid": bid, "ask": ask, "last": last}


@dataclass
class Opportunity:
    ticker: str
    topic: str
    title: str
    strategy: str
    side: str  # "yes" | "no"
    entry_price: float
    model_prob: float
    market_prob: float
    edge: float
    est_roi: float
    score: float
    reasons: list[str] = field(default_factory=list)
    liquidity: dict[str, Any] = field(default_factory=dict)
    target_price: float | None = None
    stop_price: float | None = None
    hours_to_close: float | None = None
    alert_ts: float | None = None

    @property
    def label(self) -> str:
        return STRATEGIES.get(self.strategy, {}).get("label", self.strategy)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ticker": self.ticker,
            "topic": self.topic,
            "title": self.title,
            "strategy": self.strategy,
            "strategy_label": self.label,
            "side": self.side,
            "entry_price": round(self.entry_price, 4),
            "model_prob": round(self.model_prob, 4),
            "market_prob": round(self.market_prob, 4),
            "edge": round(self.edge, 4),
            "est_roi": round(self.est_roi, 4),
            "score": round(self.score, 1),
            "reasons": self.reasons,
            "liquidity": self.liquidity,
            "target_price": None if self.target_price is None else round(self.target_price, 4),
            "stop_price": None if self.stop_price is None else round(self.stop_price, 4),
            "hours_to_close": None if self.hours_to_close is None else round(self.hours_to_close, 2),
            "alert_ts": self.alert_ts,
        }


def evaluate(
    market: dict[str, Any],
    *,
    alert: Alert | None = None,
    book: dict[str, Any] | None = None,
    strategy: str = "momentum",
) -> Opportunity | None:
    """Score one market for one strategy. Returns ``None`` if unusable."""

    if strategy not in STRATEGIES:
        raise ValueError(f"unknown strategy: {strategy}")
    cfg = STRATEGIES[strategy]
    ticker = str(market.get("ticker") or "")
    if not ticker:
        return None
    topic = str(market.get("topic") or (alert.topic if alert else ""))
    title = str(market.get("title") or (alert.title if alert else ticker))

    quotes = _quote_fields(market)
    bid, ask, last = quotes["bid"], quotes["ask"], quotes["last"]
    liq = _book_metrics(book)
    if liq["best_yes_bid"] is not None:
        bid = liq["best_yes_bid"]
    if liq["best_yes_ask"] is not None:
        ask = liq["best_yes_ask"]
    if bid is None or ask is None or bid <= 0.0 or ask <= 0.0 or ask >= 1.0 or ask < bid:
        return None
    mid = (bid + ask) / 2.0
    spread = ask - bid

    delta = alert.delta if alert else 0.0
    abs_delta = abs(delta)

    # --- heuristic model probability ----------------------------------------
    if strategy == "momentum":
        if alert is None or abs_delta < 0.10:
            return None
        drift = cfg["edge_weight"] * math.tanh(delta / 0.20)
        model_prob = clamp(mid + drift, 0.01, 0.99)
        side = "yes" if delta > 0 else "no"
    elif strategy == "mean_reversion":
        if alert is None or abs_delta < 0.15:
            return None
        drift = -cfg["edge_weight"] * math.tanh(delta / 0.20)
        model_prob = clamp(mid + drift, 0.01, 0.99)
        side = "no" if delta > 0 else "yes"
    else:  # favorite_drift
        hours = _hours_to_close(market)
        if hours is None or hours < 0 or hours > 24:
            return None
        if mid < 0.85:
            return None
        model_prob = clamp(mid + cfg["edge_weight"], 0.01, 0.99)
        side = "yes"

    entry = ask if side == "yes" else round(1.0 - bid, 4)
    if side == "no":
        model_prob = 1.0 - model_prob
        if entry <= 0 or entry >= 1:
            return None
    market_prob = mid if side == "yes" else 1.0 - mid
    edge = model_prob - entry
    fee = fee_per_contract(entry)
    est_roi = (edge - fee) / entry if entry > 0 else 0.0

    if edge <= 0:
        return None

    # --- score ---------------------------------------------------------------
    # Binary bid-only orderbook: buying YES lifts the implied YES ask (resting NO
    # bids = no_depth); buying NO lifts the implied NO ask (resting YES bids = yes_depth).
    depth = liq["no_depth"] if side == "yes" else liq["yes_depth"]
    if depth is None:
        # Fall back to the quoted size on the side we would trade against.
        size_raw = market.get("yes_ask_size_fp") if side == "yes" else market.get("yes_bid_size_fp")
        depth = _num(size_raw)
    depth = float(depth or 0.0)
    depth_score = clamp(math.log10(depth + 1) / 2.0, 0.0, 1.0)  # 100 contracts -> 1.0
    spread_score = clamp(1.0 - spread / 0.20, 0.0, 1.0)
    volume = _num(market.get("volume_24h_fp")) or 0.0
    volume_score = clamp(math.log10(volume + 1) / 3.0, 0.0, 1.0)  # 1000 contracts -> 1.0
    hours = _hours_to_close(market)
    if hours is None:
        time_score = 0.4
        time_reason = "close time unavailable"
    elif hours < 0:
        time_score = 0.0
        time_reason = "past close time"
    else:
        time_score = clamp(hours / 72.0, 0.0, 1.0)
        if hours < 1:
            time_score *= 0.5
        time_reason = f"{hours:.1f}h to close"
    edge_score = clamp(est_roi / 0.25, 0.0, 1.0)

    score = 100.0 * (
        0.40 * edge_score
        + 0.20 * depth_score
        + 0.15 * spread_score
        + 0.15 * volume_score
        + 0.10 * time_score
    )

    target = round(clamp(entry + max(0.05, 1.5 * abs_delta), 0.01, 0.99), 4) if side == "yes" else round(clamp(entry + max(0.05, 1.5 * abs_delta), 0.01, 0.99), 4)
    stop = round(clamp(entry - max(0.05, 0.75 * abs_delta), 0.01, 0.99), 4)

    reasons = [
        f"{'YES' if side == 'yes' else 'NO'} entry ${entry:.2f}, model probability {model_prob:.2f}",
        f"heuristic edge ${edge:.2f}/contract, est. ROI {est_roi * 100:.1f}% before slippage",
        f"{depth:.0f} contracts at the touch, spread ${spread:.2f}",
        time_reason,
    ]
    if alert:
        reasons.insert(0, f"swing {alert.delta:+.2f} ({alert.before:.2f} -> {alert.after:.2f})")

    return Opportunity(
        ticker=ticker,
        topic=topic,
        title=title,
        strategy=strategy,
        side=side,
        entry_price=entry,
        model_prob=model_prob,
        market_prob=market_prob,
        edge=edge,
        est_roi=est_roi,
        score=score,
        reasons=reasons,
        liquidity=liq,
        target_price=target,
        stop_price=stop,
        hours_to_close=hours,
        alert_ts=alert.ts if alert else None,
    )


def best_opportunity(
    market: dict[str, Any],
    *,
    alert: Alert | None = None,
    book: dict[str, Any] | None = None,
    strategies: tuple[str, ...] = ("momentum", "mean_reversion", "favorite_drift"),
) -> Opportunity | None:
    scored = [evaluate(market, alert=alert, book=book, strategy=s) for s in strategies]
    valid = [item for item in scored if item is not None]
    if not valid:
        return None
    valid.sort(key=lambda item: item.score, reverse=True)
    return valid[0]


def position_size(
    opportunity: Opportunity,
    *,
    bankroll: float,
    risk_pct: float = 0.02,
    max_contracts: int = 250,
    depth_fraction: float = 0.25,
) -> int:
    """Fractional-Kelly-free, fixed-risk sizing.

    Risk per contract is the distance to the stop (floored at $0.02), so this is
    a fixed-risk model, not a Kelly claim. Size is also capped by visible depth.
    """

    if opportunity.entry_price <= 0:
        return 0
    stop_distance = max(0.02, opportunity.entry_price - (opportunity.stop_price or 0.0))
    risk_budget = max(0.0, bankroll) * risk_pct
    by_risk = int(risk_budget / stop_distance)
    depth = 0.0
    if opportunity.side == "yes":
        depth = float(opportunity.liquidity.get("no_depth") or 0.0)
    else:
        depth = float(opportunity.liquidity.get("yes_depth") or 0.0)
    # No visible depth is not treated as unlimited depth: cap a bookless fill
    # at 25 contracts and let the paper broker record the assumption.
    by_depth = int(depth * depth_fraction) if depth > 0 else 25
    by_cash = int((bankroll * 0.25) / opportunity.entry_price)
    return max(0, min(by_risk, by_cash, max_contracts, by_depth))
