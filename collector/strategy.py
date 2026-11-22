"""Simulated-trade engine: strategies, trade construction, P&L and analytics.

Nothing here talks to Kalshi.  It reads the collector's snapshots and
*proposes/books* simulated trades, each tagged with the strategy that created it
so performance can be grouped by trade type.

Fee model (official), https://kalshi.com/docs/kalshi-fee-schedule.pdf
    taker fee = round_up(M x 0.07 x C x P x (1 - P))
    maker fee = round_up(M x 0.0175 x C x P x (1 - P))   (M defaults to 0)

Rounding: the PDF's formula note says "round up such that the fee + positionCost
is rounded to a centicent", but every row of the PDF's own General Trading Fees
Table is reproduced by rounding the fee UP TO THE NEXT WHOLE CENT. This module
therefore defaults to cent rounding (it reproduces all 42 printed table values,
see tests/test_fees.py) and exposes `rounding="centicent"` for the formula-text
reading. The discrepancy is published on the Flagged for Review page.
Settlement payout: YES pays $1.00 per contract on a 'yes' result, else $0.00
  https://docs.kalshi.com/getting_started/market_settlement
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

TAKER_MULTIPLIER = 0.07
MAKER_MULTIPLIER = 0.0175
FEE_SCHEDULE_URL = "https://kalshi.com/docs/kalshi-fee-schedule.pdf"

STRATEGIES = [
    {
        "id": "S1_MOMENTUM",
        "name": "Swing momentum",
        "kind": "momentum",
        "rule": ("When the observed price moves >= $0.10 within the lookback window in either "
                 "direction, buy the side the move points to (YES after an up-move, NO after a down-move)."),
        "rationale": "Large single-window repricings on thin books tend to continue briefly.",
        "size_contracts": 10,
        "lookback_points": 6,
        "min_move": 0.10,
    },
    {
        "id": "S2_MEAN_REVERT",
        "name": "Overreaction fade",
        "kind": "mean_reversion",
        "rule": ("When the observed price moves >= $0.10 in the window, take the opposite side "
                 "of the move (buy NO after an up-move, YES after a down-move)."),
        "rationale": "Sharp spikes on low-volume demo markets often retrace.",
        "size_contracts": 10,
        "lookback_points": 6,
        "min_move": 0.10,
    },
    {
        "id": "S3_CHEAP_TAIL",
        "name": "Cheap-tail value",
        "kind": "value",
        "rule": ("Buy YES only when the best YES ask is <= $0.10 and the market has open interest, "
                 "so the maximum loss per contract is capped at the price paid."),
        "rationale": "Long-shot contracts with real liquidity; the payoff is bounded and known.",
        "size_contracts": 20,
        "max_ask": 0.10,
        "min_open_interest": 1.0,
    },
    {
        "id": "S4_RICH_FAVOURITE",
        "name": "Rich favourite fade",
        "kind": "value",
        "rule": ("Buy NO when the best YES bid is >= $0.90, i.e. fade a near-certain outcome that is "
                 "priced at or above $0.90."),
        "rationale": "Capped upside on the opposite side; tests whether favourites are overpriced.",
        "size_contracts": 10,
        "min_bid": 0.90,
    },
    {
        "id": "S5_LIQUID_MID",
        "name": "Liquid mid-range",
        "kind": "liquidity",
        "rule": ("Buy YES at $0.35-$0.65 only when both sides of the book hold >= 100 contracts "
                 "and the spread is <= $0.04."),
        "rationale": "Tradable two-sided markets; avoids paying wide spreads.",
        "size_contracts": 10,
        "min_bid": 0.35,
        "max_bid": 0.65,
        "min_book_contracts": 100.0,
        "max_spread": 0.04,
    },
]

STRATEGY_INDEX = {s["id"]: s for s in STRATEGIES}


def fee_dollars(price: float, contracts: float, taker: bool = True, multiplier: float = 1.0,
                rounding: str = "cent") -> float:
    """Official fee formula.

    rounding="cent"      -> round the fee up to the next whole cent. This matches
                            every value printed in the fee schedule's table.
    rounding="centicent" -> round up to $0.0001, the literal reading of the
                            PDF's function note.
    """
    m = TAKER_MULTIPLIER if taker else MAKER_MULTIPLIER
    raw = multiplier * m * contracts * price * (1.0 - price)
    step = 100.0 if rounding == "cent" else 10000.0
    return math.ceil(raw * step - 1e-9) / step


# Backwards-compatible name used by the trade builder.
def fee_cents(price: float, contracts: float, taker: bool = True, multiplier: float = 1.0) -> float:
    return fee_dollars(price, contracts, taker=taker, multiplier=multiplier, rounding="cent")


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _mode_price(point: dict) -> float | None:
    for key in ("mid", "last", "bid", "ask"):
        v = point.get(key)
        if v is not None:
            return float(v)
    return None


def _cost(side: str, price: float, contracts: float) -> dict[str, float]:
    cost = price * contracts
    fee = fee_cents(price, contracts, taker=True)
    return {"entry_price": round(price, 4), "contracts": contracts,
            "cost_dollars": round(cost, 4), "fee_dollars": round(fee, 4),
            "cash_out_dollars": round(cost + fee, 4)}


def build_trade(strategy: dict, market: dict, ob: dict | None, points: list[dict],
                trigger: str) -> dict | None:
    """Construct a simulated trade, or None when the strategy's rule does not fire."""
    sid = strategy["id"]
    contracts = float(strategy["size_contracts"])
    bid = float(ob["best_yes_bid"]) if ob and ob.get("best_yes_bid") is not None else None
    ask = float(ob["best_yes_ask"]) if ob and ob.get("best_yes_ask") is not None else None
    oi = float(market.get("open_interest_fp") or 0) if market.get("open_interest_fp") else 0.0

    if sid in ("S1_MOMENTUM", "S2_MEAN_REVERT"):
        window = points[-int(strategy["lookback_points"]):]
        prices = [p for p in (_mode_price(pt) for pt in window) if p is not None]
        if len(prices) < 2:
            return None
        move = round(prices[-1] - prices[0], 4)
        if abs(move) < strategy["min_move"]:
            return None
        up = move > 0
        if sid == "S1_MOMENTUM":
            side = "yes" if up else "no"
        else:
            side = "no" if up else "yes"
        if side == "yes":
            if ask is None:
                return None
            leg = _cost("yes", ask, contracts)
        else:
            if bid is None:
                return None
            leg = _cost("no", round(1.0 - bid, 4), contracts)
        leg.update({"side": side, "trigger": trigger, "observed_move": move})
        return _finish(strategy, market, leg)

    if sid == "S3_CHEAP_TAIL":
        if ask is None or ask > strategy["max_ask"] or oi < strategy["min_open_interest"]:
            return None
        leg = _cost("yes", ask, contracts)
        leg.update({"side": "yes", "trigger": trigger})
        return _finish(strategy, market, leg)

    if sid == "S4_RICH_FAVOURITE":
        if bid is None or bid < strategy["min_bid"]:
            return None
        leg = _cost("no", round(1.0 - bid, 4), contracts)
        leg.update({"side": "no", "trigger": trigger})
        return _finish(strategy, market, leg)

    if sid == "S5_LIQUID_MID":
        if bid is None or ask is None:
            return None
        if not (strategy["min_bid"] <= bid <= strategy["max_bid"]):
            return None
        if (ob.get("contracts_bid") or 0) < strategy["min_book_contracts"]:
            return None
        if (ob.get("contracts_ask") or 0) < strategy["min_book_contracts"]:
            return None
        if (ob.get("spread_dollars") or 1) > strategy["max_spread"]:
            return None
        leg = _cost("yes", ask, contracts)
        leg.update({"side": "yes", "trigger": trigger})
        return _finish(strategy, market, leg)

    return None


def _finish(strategy: dict, market: dict, leg: dict) -> dict:
    entry = leg["entry_price"]
    contracts = leg["contracts"]
    # Max profit / max loss at settlement for a long contract position.
    leg["max_profit_dollars"] = round((1.0 - entry) * contracts - leg["fee_dollars"], 4)
    leg["max_loss_dollars"] = round(-(entry * contracts) - leg["fee_dollars"], 4)
    leg["roi_on_risk_pct"] = (round(leg["max_profit_dollars"] /
                                   abs(leg["max_loss_dollars"]) * 100, 2)
                              if leg["max_loss_dollars"] else None)
    return {
        "id": f"{strategy['id']}::{market['ticker']}::{iso_now()}",
        "strategy_id": strategy["id"],
        "strategy_name": strategy["name"],
        "strategy_kind": strategy["kind"],
        "topic": market.get("topic"),
        "ticker": market["ticker"],
        "title": market.get("title"),
        "subtitle": market.get("subtitle"),
        "opened_at": iso_now(),
        "status": "open",
        "source": "paper",
        "entry": leg,
        "fee_model": {"schedule": FEE_SCHEDULE_URL, "multiplier": TAKER_MULTIPLIER,
                      "rounding": "round up to next whole cent (reproduces the fee schedule table)",
                      "role": "taker"},
        "market_at_entry": {
            "yes_bid": market.get("yes_bid_dollars"), "yes_ask": market.get("yes_ask_dollars"),
            "last": market.get("last_price_dollars"), "open_interest_fp": market.get("open_interest_fp"),
            "volume_fp": market.get("volume_fp"), "close_time": market.get("close_time"),
        },
        "source_url": market.get("api_url"),
    }


def settle_trade(trade: dict, result: str, settlement_value: str | None,
                 settled_at: str | None) -> dict:
    """Settle a simulated trade from the market's official `result` field."""
    side = trade["entry"]["side"]
    contracts = trade["entry"]["contracts"]
    entry = trade["entry"]["entry_price"]
    if result not in ("yes", "no"):  # scalar or unknown -> not settled, stays open
        trade["status"] = "open"
        return trade
    # Settlement pays $1.00 per contract to holders of the winning side only.
    #   https://docs.kalshi.com/getting_started/market_settlement
    # The trade's entry_price is already expressed in the price of the side held
    # (a NO position entered at 1 - yes_bid), so the payout depends on whether the
    # side we hold won -- not on the market's raw result string.
    held_side_won = (result == side)
    payout = 1.0 * contracts if held_side_won else 0.0
    fee = trade["entry"]["fee_dollars"]
    pnl = round(payout - entry * contracts - fee, 4)
    trade.update({
        "status": "settled",
        "settled_at": settled_at,
        "resolution": result,
        "settlement_value_dollars": settlement_value,
        "payout_dollars": round(payout, 4),
        "realized_pnl_dollars": pnl,
        "held_side_won": held_side_won,
        "roi_pct": round(pnl / (entry * contracts + fee) * 100, 2) if entry * contracts + fee else None,
    })
    return trade


def summarise(trades: list[dict], strategies: list[dict]) -> dict:
    def block(rows: list[dict]) -> dict:
        settled = [t for t in rows if t.get("status") == "settled"]
        open_ = [t for t in rows if t.get("status") == "open"]
        pnl = round(sum(t.get("realized_pnl_dollars") or 0 for t in settled), 4)
        wins = [t for t in settled if (t.get("realized_pnl_dollars") or 0) > 0]
        invested = round(sum((t["entry"]["cash_out_dollars"] or 0) for t in settled), 4)
        return {
            "trades": len(rows), "settled": len(settled), "open": len(open_),
            "wins": len(wins), "losses": len(settled) - len(wins),
            "win_rate_pct": round(len(wins) / len(settled) * 100, 2) if settled else None,
            "invested_dollars": invested,
            "realized_pnl_dollars": pnl,
            "return_on_invested_pct": round(pnl / invested * 100, 2) if invested else None,
            "avg_pnl_per_settled_dollars": round(pnl / len(settled), 4) if settled else None,
            "open_cost_dollars": round(sum((t["entry"]["cash_out_dollars"] or 0) for t in open_), 4),
        }

    by_strategy = []
    for s in strategies:
        rows = [t for t in trades if t["strategy_id"] == s["id"]]
        by_strategy.append({"strategy_id": s["id"], "name": s["name"], "kind": s["kind"],
                            "rule": s["rule"], **block(rows)})
    by_topic: dict[str, dict] = {}
    for t in trades:
        by_topic.setdefault(t.get("topic") or "unknown", {})
    topics = [{"topic": k, **block([t for t in trades if (t.get("topic") or "unknown") == k])}
              for k in sorted(by_topic)]
    by_side = [{"side": s, **block([t for t in trades if t["entry"]["side"] == s])}
               for s in ("yes", "no")]
    return {
        "generated_at": iso_now(),
        "overall": block(trades),
        "by_strategy": by_strategy,
        "by_topic": topics,
        "by_side": by_side,
        "fee_schedule_url": FEE_SCHEDULE_URL,
        "fee_model": f"taker {TAKER_MULTIPLIER} x C x P x (1-P), rounded up to the next whole cent",
        "settlement_source": "https://docs.kalshi.com/getting_started/market_settlement",
    }
