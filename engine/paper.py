"""Simulated (paper) execution: fees, strategies, replay backtest, analytics.

Why fees matter
---------------
Kalshi charges the *taker* a fee on the expected earnings of a contract:

    fees = ceil_to_centicent( M * 0.07 * C * P * (1 - P) )

where ``P`` is the contract price in dollars and ``C`` the number of contracts,
and makers pay ``0.0175`` instead of ``0.07`` when their resting order is later
filled (official schedule: https://kalshi.com/docs/kalshi-fee-schedule.pdf).
A 10-cent move on a 50-cent contract is $0.10 gross but ~$0.017 of fee per
contract; ignoring that inflates every "high ROI" claim, so every fill in this
repository pays the fee.

Honesty rules enforced here
---------------------------
1. A fill only happens at a price that existed in recorded/served market data.
   If the needed side is empty, the trade is skipped, never invented.
2. Every trade records the data timestamp, the basis of its price, and the
   source URL of the market it traded.
3. Results are reported with the sample size and the recording window. With
   small samples nothing is called "profitable" without that caveat next to it.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING

TAKER_RATE = Decimal("0.07")   # official fee schedule, general markets
MAKER_RATE = Decimal("0.0175")  # official fee schedule, maker fee section
CENT = Decimal("0.01")
CENTICENT = Decimal("0.0001")

# ---------------------------------------------------------------------------
# A genuine contradiction inside the official fee schedule
# ---------------------------------------------------------------------------
# The PDF's prose says the fee is rounded up "to a centicent" ($0.0001), but
# every one of the 21 rows in its own "General Trading Fees Table" matches
# rounding up to the nearest CENT instead. Worked example, 100 contracts at
# $0.50: raw = 0.07*100*0.50*0.50 = $1.75, and the table says $1.75 -- the
# centicent rule would leave it at $1.75 too. At $0.01 the raw fee is $0.0693;
# the table says $0.07 (a cent), not $0.0693 (a centicent).
#
# This module therefore defaults to TABLE_CONSISTENT rounding, because the
# published table is the number a reader can check, and exposes the prose rule
# as an explicit alternative. The discrepancy is flagged on the review page
# (finding F-13) with the full 21-row reconciliation.
TABLE_CONSISTENT = "cent"
PROSE_RULE = "centicent"


def _round_up(raw: Decimal, mode: str) -> Decimal:
    unit = CENT if mode == TABLE_CONSISTENT else CENTICENT
    return (raw / unit).to_integral_value(rounding=ROUND_CEILING) * unit


def taker_fee(price: Decimal, count: Decimal, multiplier: Decimal = Decimal(1),
              mode: str = TABLE_CONSISTENT) -> Decimal:
    """Official taker fee. Default rounding reproduces the published table."""
    if count <= 0:
        return Decimal(0)
    return _round_up(multiplier * TAKER_RATE * count * price * (Decimal(1) - price), mode)


def maker_fee(price: Decimal, count: Decimal, multiplier: Decimal = Decimal(1),
              mode: str = TABLE_CONSISTENT) -> Decimal:
    if count <= 0:
        return Decimal(0)
    return _round_up(multiplier * MAKER_RATE * count * price * (Decimal(1) - price), mode)


# The published "Fee for 100 contracts" column, used by the verification gate.
OFFICIAL_FEE_TABLE_100 = (
    ("0.01", "0.07"), ("0.05", "0.34"), ("0.10", "0.63"), ("0.15", "0.90"),
    ("0.20", "1.12"), ("0.25", "1.32"), ("0.30", "1.47"), ("0.35", "1.60"),
    ("0.40", "1.68"), ("0.45", "1.74"), ("0.50", "1.75"), ("0.55", "1.74"),
    ("0.60", "1.68"), ("0.65", "1.60"), ("0.70", "1.47"), ("0.75", "1.32"),
    ("0.80", "1.12"), ("0.85", "0.90"), ("0.90", "0.63"), ("0.95", "0.34"),
    ("0.99", "0.07"),
)


def iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class Strategy:
    """A trade *type*, with an entry rule that can be evaluated from prices."""

    key: str
    name: str
    trade_type: str          # momentum | mean-reversion | value | carry | breakout
    thesis: str
    entry_rule: str          # human-readable, shown verbatim on the site
    exit_rule: str
    threshold: Decimal       # price move that triggers the rule, if any
    max_price: Decimal | None  # refuse to pay more than this for YES
    min_price: Decimal | None
    horizon_min: int         # give up after this many minutes
    target: Decimal | None   # take profit in dollars per contract
    stop: Decimal | None     # stop loss in dollars per contract
    hold_to_resolution: bool
    source: str

    def __post_init__(self) -> None:
        pass


STRATEGIES: tuple[Strategy, ...] = (
    Strategy(
        key="momentum",
        name="Momentum follow-through",
        trade_type="momentum",
        thesis="A fast >= $0.10 repricing usually continues for a few minutes when the "
               "book is thin and the move is not yet arbitraged back.",
        entry_rule="On a >= $0.10 move within one polling window, buy in the direction of "
                   "the move at the quoted ask, if the ask is <= 0.90.",
        exit_rule="Exit at +$0.06 target, -$0.05 stop, or after 180 minutes.",
        threshold=Decimal("0.10"),
        max_price=Decimal("0.90"),
        min_price=None,
        horizon_min=180,
        target=Decimal("0.06"),
        stop=Decimal("0.05"),
        hold_to_resolution=False,
        source="https://docs.kalshi.com/getting_started/order_direction.md",
    ),
    Strategy(
        key="fade",
        name="Fade the spike (mean reversion)",
        trade_type="mean-reversion",
        thesis="Many >= $0.10 jumps in prediction markets are one-off sweeps that retrace "
               "once the immediate order flow is absorbed.",
        entry_rule="After a >= $0.10 move, take the *opposite* side at the quoted ask, if "
                   "|move| >= $0.12 and the bid/ask spread is <= $0.06.",
        exit_rule="Exit on a 50% retracement of the move, a -$0.06 stop, or after 120 minutes.",
        threshold=Decimal("0.12"),
        max_price=Decimal("0.85"),
        min_price=None,
        horizon_min=120,
        target=Decimal("0.05"),
        stop=Decimal("0.06"),
        hold_to_resolution=False,
        source="https://docs.kalshi.com/getting_started/orderbook_responses.md",
    ),
    Strategy(
        key="tail-value",
        name="Cheap tail value",
        trade_type="value",
        thesis="Contracts quoted at <= $0.15 on markets with real depth can still be "
               "mispriced when attention is low; buying a basket of them is a positive-"
               "skew value bet, not a directional forecast.",
        entry_rule="Buy YES at the ask when ask <= 0.15 and at least 100 contracts are bid "
                   "within $0.01 of the best bid.",
        exit_rule="Hold to resolution (yes or no).",
        threshold=Decimal("0.10"),
        max_price=Decimal("0.15"),
        min_price=None,
        horizon_min=0,
        target=None,
        stop=None,
        hold_to_resolution=True,
        source="https://kalshi.com/docs/kalshi-fee-schedule.pdf",
    ),
    Strategy(
        key="favorite-carry",
        name="Favorite carry to resolution",
        trade_type="carry",
        thesis="High-probability contracts (>= $0.85) held to resolution collect a small, "
               "frequent premium; the risk is a rare full loss, so position size is capped.",
        entry_rule="Buy YES at the ask when the ask >= 0.85 and <= 0.97.",
        exit_rule="Hold to resolution.",
        threshold=Decimal("0.10"),
        max_price=Decimal("0.97"),
        min_price=Decimal("0.85"),
        horizon_min=0,
        target=None,
        stop=None,
        hold_to_resolution=True,
        source="https://kalshi.com/docs/kalshi-fee-schedule.pdf",
    ),
    Strategy(
        key="breakout",
        name="Threshold breakout with confirmation",
        trade_type="breakout",
        thesis="A contract crossing $0.50 upward has usually repriced its base rate; buying "
               "the cross with a tight stop is a cheap way to be long the new information.",
        entry_rule="Buy YES at the ask when price crosses 0.50 upward and the crossing move "
                   "is >= $0.10.",
        exit_rule="Exit at +$0.08, -$0.05, or after 240 minutes.",
        threshold=Decimal("0.10"),
        max_price=Decimal("0.80"),
        min_price=None,
        horizon_min=240,
        target=Decimal("0.08"),
        stop=Decimal("0.05"),
        hold_to_resolution=False,
        source="https://docs.kalshi.com/getting_started/fixed_point_migration.md",
    ),
)

STRATEGY_BY_KEY = {s.key: s for s in STRATEGIES}


@dataclass
class Trade:
    id: str
    strategy: str
    trade_type: str
    topic: str
    ticker: str
    event_ticker: str
    title: str
    side: str                 # yes | no
    entry_ts: int
    entry_price: str
    contracts: str
    fee_entry: str
    exit_ts: int | None = None
    exit_price: str | None = None
    fee_exit: str | None = None
    exit_reason: str = "open"  # target | stop | horizon | resolution | open
    pnl: str = "0"
    return_on_cost: str | None = None
    resolved_result: str | None = None  # yes | no | scalar
    price_bucket: str = ""
    data_basis: str = ""
    source_url: str = ""
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def price_bucket(price: Decimal) -> str:
    if price <= Decimal("0.15"):
        return "tail <= 0.15"
    if price <= Decimal("0.35"):
        return "0.15-0.35"
    if price <= Decimal("0.65"):
        return "0.35-0.65"
    if price <= Decimal("0.85"):
        return "0.65-0.85"
    return "favorite >= 0.85"


@dataclass
class BacktestConfig:
    starting_cash: Decimal = Decimal("10000")
    stake_per_trade: Decimal = Decimal("100")  # dollars of premium per trade
    max_contracts: Decimal = Decimal("250")
    allow_no_side: bool = True


@dataclass
class BacktestResult:
    strategy: str
    trades: list[Trade] = field(default_factory=list)
    skipped: int = 0
    skip_reasons: dict[str, int] = field(default_factory=dict)

    def stats(self) -> dict:
        closed = [t for t in self.trades if t.exit_reason != "open"]
        open_ = [t for t in self.trades if t.exit_reason == "open"]
        def d(v: str | None) -> Decimal:
            return Decimal(v) if v not in (None, "") else Decimal(0)
        pnls = [d(t.pnl) for t in closed]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        cost = sum((d(t.entry_price) * d(t.contracts) + d(t.fee_entry) for t in closed), Decimal(0))
        total = sum(pnls, Decimal(0))
        gross_win = sum(wins, Decimal(0))
        gross_loss = -sum(losses, Decimal(0))
        return {
            "strategy": self.strategy,
            "trades": len(self.trades),
            "closed": len(closed),
            "open": len(open_),
            "wins": len(wins),
            "losses": len(losses),
            "hit_rate": None if not closed else round(len(wins) / len(closed), 3),
            "net_pnl": str(total.quantize(Decimal("0.01"))),
            "cost_basis": str(cost.quantize(Decimal("0.01"))),
            "roi_on_cost": None if not cost else round(float(total / cost), 4),
            "avg_win": None if not wins else str((gross_win / len(wins)).quantize(Decimal("0.01"))),
            "avg_loss": None if not losses else str((-gross_loss / len(losses)).quantize(Decimal("0.01"))),
            "profit_factor": None if not gross_loss else round(float(gross_win / gross_loss), 3),
            "expectancy_per_trade": None if not closed else str((total / len(closed)).quantize(Decimal("0.01"))),
            "skipped": self.skipped,
            "skip_reasons": self.skip_reasons,
        }


def _quote(points: list, i: int, side: str) -> Decimal | None:
    """Executable price from a recorded point. Buys pay the ask; no price = no fill."""
    p = points[i]
    if side == "yes":
        return p.ask if p.ask is not None else None
    if p.bid is None:
        return None
    return Decimal(1) - p.bid  # buying NO at 1 - yes bid


def _mark(points: list, i: int, side: str) -> Decimal | None:
    """Executable exit price, or ``None`` when no counterparty is on the book.

    Selling YES needs a YES bid; selling NO needs a NO bid (= 1 - YES ask). A
    quote of exactly 0.00 or 1.00 is not a real counterparty, so the position
    stays open rather than being marked at a fantasy exit.
    """
    p = points[i]
    mark = p.bid if side == "yes" else (None if p.ask is None else Decimal(1) - p.ask)
    if mark is None or mark <= 0 or mark >= 1:
        return None
    return mark


def run_strategy(strategy: Strategy, series: dict[str, list], meta: dict[str, dict],
                 resolved: dict[str, str], cfg: BacktestConfig | None = None) -> BacktestResult:
    """Replay one strategy over every recorded price path.

    ``series[ticker]`` is a list of ``PricePoint``; ``resolved[ticker]`` is the
    market's official ``result`` (``yes``/``no``) when it has one.
    """
    cfg = cfg or BacktestConfig()
    result = BacktestResult(strategy=strategy.key)

    def skip(reason: str) -> None:
        result.skipped += 1
        result.skip_reasons[reason] = result.skip_reasons.get(reason, 0) + 1

    counter = 0
    for ticker, points in series.items():
        info = meta.get(ticker, {})
        if len(points) < 3:
            skip("not enough recorded points")
            continue
        cooldown_until = -1
        for i in range(1, len(points)):
            if points[i].ts < cooldown_until:
                continue
            prev, cur = points[i - 1], points[i]
            move = cur.price - prev.price
            side = None

            if strategy.key == "momentum":
                if abs(move) >= strategy.threshold:
                    side = "yes" if move > 0 else "no"
            elif strategy.key == "fade":
                if abs(move) >= strategy.threshold:
                    side = "no" if move > 0 else "yes"
                    if cur.bid is None or cur.ask is None:
                        skip("no two-sided quote to fade")
                        continue
                    if cur.ask - cur.bid > Decimal("0.06"):
                        skip("spread > $0.06")
                        continue
            elif strategy.key == "tail-value":
                if cur.ask is not None and cur.ask <= strategy.max_price and (cur.depth_contracts or 0) >= 100:
                    side = "yes"
            elif strategy.key == "favorite-carry":
                if cur.ask is not None and strategy.min_price is not None and cur.ask >= strategy.min_price \
                        and cur.ask <= (strategy.max_price or Decimal("1")):
                    side = "yes"
            elif strategy.key == "breakout":
                if prev.price < Decimal("0.50") <= cur.price and abs(move) >= strategy.threshold:
                    side = "yes"
                elif prev.price >= Decimal("0.50") > cur.price and abs(move) >= strategy.threshold:
                    side = "no"

            if side is None:
                continue
            if side == "no" and not cfg.allow_no_side:
                skip("no-side disabled")
                continue

            price = _quote(points, i, side)
            if price is None or price <= 0 or price >= 1:
                skip("no executable quote")
                continue
            if strategy.max_price is not None and price > strategy.max_price:
                skip("ask above strategy ceiling")
                continue
            if strategy.min_price is not None and price < strategy.min_price:
                skip("ask below strategy floor")
                continue

            contracts = min(cfg.max_contracts,
                            (cfg.stake_per_trade / price).quantize(Decimal("0.01")))
            if contracts < 1:
                skip("stake too small for one contract")
                continue
            fee_in = taker_fee(price, contracts)
            counter += 1
            trade = Trade(
                id=f"{strategy.key.upper()}-{counter:04d}",
                strategy=strategy.key,
                trade_type=strategy.trade_type,
                topic=info.get("topic", ""),
                ticker=ticker,
                event_ticker=info.get("event_ticker", ""),
                title=info.get("title", ticker),
                side=side,
                entry_ts=cur.ts,
                entry_price=str(price),
                contracts=str(contracts),
                fee_entry=str(fee_in),
                price_bucket=price_bucket(price),
                data_basis=cur.basis,
                source_url=info.get("source_url", ""),
                note=info.get("note", ""),
            )

            exit_i = None
            exit_price = None
            reason = None
            for j in range(i + 1, len(points)):
                mark = _mark(points, j, side)
                if mark is None:
                    continue
                gain = mark - price
                if strategy.target is not None and gain >= strategy.target:
                    exit_i, exit_price, reason = j, mark, "target"
                    break
                if strategy.stop is not None and gain <= -strategy.stop:
                    exit_i, exit_price, reason = j, mark, "stop"
                    break
                if strategy.horizon_min and points[j].ts - cur.ts >= strategy.horizon_min * 60:
                    exit_i, exit_price, reason = j, mark, "horizon"
                    break

            if exit_i is None and strategy.hold_to_resolution:
                outcome = resolved.get(ticker)
                if outcome in ("yes", "no"):
                    payout = Decimal(1) if outcome == side else Decimal(0)
                    fee_out = taker_fee(payout if payout == 1 else Decimal("0.99"), contracts) if payout else Decimal(0)
                    trade.exit_reason = "resolution"
                    trade.exit_ts = points[-1].ts
                    trade.exit_price = str(payout)
                    trade.fee_exit = str(fee_out)
                    trade.resolved_result = outcome
                    trade.pnl = str((payout - price) * contracts - fee_in - fee_out)
                    trade.return_on_cost = str(((payout - price) * contracts - fee_in - fee_out)
                                               / (price * contracts + fee_in))
                    result.trades.append(trade)
                    continue
                exit_i, exit_price, reason = len(points) - 1, _mark(points, len(points) - 1, side), "horizon"

            if exit_i is None:
                trade.exit_reason = "open"
                result.trades.append(trade)
                continue

            if exit_price is None:
                skip("no exit quote")
                continue
            fee_out = taker_fee(min(exit_price, Decimal("0.99")), contracts)
            trade.exit_ts = points[exit_i].ts
            trade.exit_price = str(exit_price)
            trade.fee_exit = str(fee_out)
            trade.exit_reason = reason or "horizon"
            trade.pnl = str((exit_price - price) * contracts - fee_in - fee_out)
            trade.return_on_cost = str(((exit_price - price) * contracts - fee_in - fee_out)
                                       / (price * contracts + fee_in))
            result.trades.append(trade)
            cooldown_until = points[exit_i].ts
    return result


def aggregate(results: list[BacktestResult]) -> dict:
    """Portfolio view across all strategies plus per-bucket breakdowns."""
    all_trades: list[Trade] = [t for r in results for t in r.trades]
    closed = [t for t in all_trades if t.exit_reason != "open"]

    def total(items: list[Trade]) -> Decimal:
        return sum((Decimal(t.pnl) for t in items), Decimal(0))

    def bucket_by(keyfunc) -> dict:
        buckets: dict[str, list[Trade]] = {}
        for t in closed:
            buckets.setdefault(keyfunc(t), []).append(t)
        out = {}
        for name, items in sorted(buckets.items()):
            wins = [t for t in items if Decimal(t.pnl) > 0]
            out[name] = {
                "trades": len(items),
                "wins": len(wins),
                "hit_rate": round(len(wins) / len(items), 3) if items else None,
                "net_pnl": str(total(items).quantize(Decimal("0.01"))),
            }
        return out

    return {
        "generated_at": iso(int(datetime.now(tz=timezone.utc).timestamp())),
        "trades": len(all_trades),
        "closed": len(closed),
        "net_pnl": str(total(closed).quantize(Decimal("0.01"))),
        "by_strategy": bucket_by(lambda t: t.strategy),
        "by_topic": bucket_by(lambda t: t.topic or "untagged"),
        "by_price_bucket": bucket_by(lambda t: t.price_bucket or "unknown"),
        "by_side": bucket_by(lambda t: t.side),
        "by_exit_reason": bucket_by(lambda t: t.exit_reason),
        "by_trade_type": bucket_by(lambda t: t.trade_type or "unknown"),
    }
