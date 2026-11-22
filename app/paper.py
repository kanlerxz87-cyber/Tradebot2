"""Deterministic paper-trading broker used by the dashboard and the backtester.

Assumptions, all surfaced on the site:
  * Buys pay the current YES ask (or the NO ask implied by 1 - YES bid).
  * Sells receive the current YES bid (or 1 - YES ask); no price improvement.
  * The general taker fee applies (0.07 x C x P x (1-P), rounded up to 1e-6).
  * Settlement pays $1 per winning contract and $0, with no settlement fee
    modelled. Kalshi does not charge a trading fee on settlement AFAIK, but
    this is flagged rather than asserted.
  * Visible depth caps the fill size; no partial-fill queue simulation.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

from .strategies import Opportunity, order_fee, position_size


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _now() -> float:
    return datetime.now(tz=timezone.utc).timestamp()


@dataclass
class Position:
    id: str
    ticker: str
    topic: str
    title: str
    strategy: str
    side: str
    contracts: float
    entry_price: float
    entry_fee: float
    opened_ts: float
    target_price: float | None = None
    stop_price: float | None = None
    status: str = "open"  # open | closed | settled
    exit_price: float | None = None
    exit_fee: float = 0.0
    closed_ts: float | None = None
    close_reason: str = ""
    resolved_result: str | None = None
    model_score: float | None = None
    est_roi: float | None = None

    @property
    def cost(self) -> float:
        return self.contracts * self.entry_price + self.entry_fee

    @property
    def opened(self) -> str:
        return _iso(self.opened_ts)

    def pnl(self, mark_price: float | None = None) -> float:
        if self.status == "settled":
            payout = self.contracts * (1.0 if self._side_won() else 0.0)
            return payout - self.cost
        if self.status == "closed":
            proceeds = self.contracts * float(self.exit_price or 0.0)
            return proceeds - self.cost - self.exit_fee
        if mark_price is None:
            return -self.cost
        return self.contracts * mark_price - self.cost

    def _side_won(self) -> bool:
        result = (self.resolved_result or "").lower()
        if result not in {"yes", "no"}:
            return False
        return (self.side == "yes" and result == "yes") or (self.side == "no" and result == "no")

    def roi(self, mark_price: float | None = None) -> float:
        if self.cost <= 0:
            return 0.0
        return self.pnl(mark_price) / self.cost

    def to_dict(self, mark_price: float | None = None) -> dict[str, Any]:
        current = mark_price if mark_price is not None else self.exit_price
        return {
            "id": self.id,
            "ticker": self.ticker,
            "topic": self.topic,
            "title": self.title,
            "strategy": self.strategy,
            "side": self.side,
            "contracts": round(self.contracts, 2),
            "entry_price": round(self.entry_price, 4),
            "entry_fee": round(self.entry_fee, 6),
            "opened_ts": int(self.opened_ts),
            "opened": self.opened,
            "target_price": self.target_price,
            "stop_price": self.stop_price,
            "status": self.status,
            "exit_price": self.exit_price,
            "exit_fee": round(self.exit_fee, 6),
            "closed_ts": int(self.closed_ts) if self.closed_ts else None,
            "close_reason": self.close_reason,
            "resolved_result": self.resolved_result,
            "pnl": round(self.pnl(current), 4) if self.status != "open" else round(self.pnl(current), 4),
            "roi": round(self.roi(current), 4),
            "model_score": self.model_score,
            "est_roi": self.est_roi,
        }


@dataclass
class StrategyAccount:
    strategy: str
    starting_cash: float
    cash: float
    positions: dict[str, Position] = field(default_factory=dict)
    history: list[Position] = field(default_factory=list)
    realized_pnl: float = 0.0

    def equity(self, marks: dict[str, float] | None = None) -> float:
        marks = marks or {}
        value = self.cash
        for pos in self.positions.values():
            if pos.status == "open":
                mark = marks.get(pos.ticker) or pos.entry_price
                value += pos.contracts * mark
        return value

    @property
    def open_exposure(self) -> float:
        return sum(p.contracts * p.entry_price for p in self.positions.values() if p.status == "open")


class PaperBroker:
    """Multi-strategy paper broker with one cash sleeve per strategy."""

    def __init__(self, starting_cash: float = 10_000.0, strategies: Iterable[str] = ()) -> None:
        self.accounts: dict[str, StrategyAccount] = {
            name: StrategyAccount(name, starting_cash, starting_cash) for name in strategies
        }
        self.starting_cash = starting_cash

    def account(self, strategy: str) -> StrategyAccount:
        if strategy not in self.accounts:
            self.accounts[strategy] = StrategyAccount(strategy, self.starting_cash, self.starting_cash)
        return self.accounts[strategy]

    def open(
        self,
        opp: Opportunity,
        *,
        ts: float | None = None,
        market: dict[str, Any] | None = None,
        risk_pct: float = 0.02,
    ) -> Position | None:
        acct = self.account(opp.strategy)
        contracts = position_size(opp, bankroll=acct.equity(), risk_pct=risk_pct)
        if market:
            # Respect the quoted size if the book was not supplied.
            size_raw = (
                market.get("yes_ask_size_fp") if opp.side == "yes" else market.get("yes_bid_size_fp")
            )
            try:
                quoted = float(size_raw) if size_raw not in (None, "") else None
            except (TypeError, ValueError):
                quoted = None
            if quoted is not None and quoted > 0:
                contracts = min(contracts, int(quoted))
        if contracts <= 0:
            return None
        fee = order_fee(contracts, opp.entry_price)
        cost = contracts * opp.entry_price + fee
        if cost > acct.cash:
            contracts = int((acct.cash - fee) / opp.entry_price)
            if contracts <= 0:
                return None
            fee = order_fee(contracts, opp.entry_price)
            cost = contracts * opp.entry_price + fee
        pos = Position(
            id=uuid.uuid4().hex[:10],
            ticker=opp.ticker,
            topic=opp.topic,
            title=opp.title,
            strategy=opp.strategy,
            side=opp.side,
            contracts=float(contracts),
            entry_price=opp.entry_price,
            entry_fee=fee,
            opened_ts=ts or _now(),
            target_price=opp.target_price,
            stop_price=opp.stop_price,
            model_score=opp.score,
            est_roi=opp.est_roi,
        )
        acct.cash -= cost
        acct.positions[pos.id] = pos
        return pos

    def close(self, strategy: str, position_id: str, price: float, reason: str, ts: float | None = None) -> Position | None:
        acct = self.account(strategy)
        pos = acct.positions.pop(position_id, None)
        if pos is None:
            return None
        fee = order_fee(pos.contracts, price)
        pos.exit_price = price
        pos.exit_fee = fee
        pos.closed_ts = ts or _now()
        pos.close_reason = reason
        pos.status = "closed"
        proceeds = pos.contracts * price - fee
        acct.cash += proceeds
        acct.realized_pnl += pos.pnl()
        acct.history.append(pos)
        return pos

    def settle(self, strategy: str, position_id: str, result: str, ts: float | None = None) -> Position | None:
        acct = self.account(strategy)
        pos = acct.positions.pop(position_id, None)
        if pos is None:
            return None
        pos.resolved_result = result.lower()
        pos.status = "settled"
        pos.closed_ts = ts or _now()
        pos.close_reason = f"settled {result.upper()}"
        payout = pos.contracts * (1.0 if pos._side_won() else 0.0)
        acct.cash += payout
        acct.realized_pnl += pos.pnl()
        acct.history.append(pos)
        return pos

    def mark(
        self,
        marks: dict[str, float],
        *,
        ts: float | None = None,
        take_profit: float = 0.15,
        stop_loss: float = 0.10,
    ) -> list[Position]:
        """Apply target/stop exits to open positions using current marks.

        ``marks`` maps ticker -> current YES mid. For NO positions the NO mark is
        1 - yes_mid. Only positions whose own side has moved by the configured
        amount are closed.
        """

        closed: list[Position] = []
        for acct in self.accounts.values():
            for pos in list(acct.positions.values()):
                if pos.status != "open":
                    continue
                yes_mark = marks.get(pos.ticker)
                if yes_mark is None:
                    continue
                mark = yes_mark if pos.side == "yes" else 1.0 - yes_mark
                gain = mark - pos.entry_price
                if gain >= take_profit:
                    closed.append(self.close(acct.strategy, pos.id, mark, "take profit", ts))
                elif gain <= -stop_loss:
                    closed.append(self.close(acct.strategy, pos.id, mark, "stop loss", ts))
        return [p for p in closed if p is not None]

    def settle_resolved(self, resolutions: dict[str, str], ts: float | None = None) -> list[Position]:
        settled: list[Position] = []
        for acct in self.accounts.values():
            for pos in list(acct.positions.values()):
                result = resolutions.get(pos.ticker)
                if result in {"yes", "no"}:
                    done = self.settle(acct.strategy, pos.id, result, ts)
                    if done:
                        settled.append(done)
        return settled

    def snapshot(self, marks: dict[str, float] | None = None) -> dict[str, Any]:
        marks = marks or {}
        accounts = []
        for acct in self.accounts.values():
            open_positions = [p.to_dict(marks.get(p.ticker)) for p in acct.positions.values()]
            eq = acct.equity(marks)
            accounts.append(
                {
                    "strategy": acct.strategy,
                    "starting_cash": round(acct.starting_cash, 2),
                    "cash": round(acct.cash, 2),
                    "equity": round(eq, 2),
                    "realized_pnl": round(acct.realized_pnl, 2),
                    "unrealized_pnl": round(eq - acct.starting_cash - acct.realized_pnl, 2),
                    "return_pct": round((eq / acct.starting_cash - 1.0) * 100.0, 2)
                    if acct.starting_cash
                    else 0.0,
                    "open_positions": open_positions,
                    "total_trades": len(acct.history) + len(acct.positions),
                    "closed_trades": len(acct.history),
                }
            )
        return {
            "starting_cash": self.starting_cash,
            "accounts": accounts,
            "analytics": analytics(self),
        }


def _bucket(price: float) -> str:
    low = int(max(0.0, min(0.99, price)) * 10) * 10
    return f"${low / 100:.2f}-${(low + 10) / 100:.2f}"


def analytics(broker: PaperBroker) -> dict[str, Any]:
    """Performance grouped by strategy, topic, entry-price bucket and hold time."""

    trades: list[Position] = []
    for acct in broker.accounts.values():
        trades.extend(acct.history)
    closed = [p for p in trades if p.status in {"closed", "settled"}]
    wins = [p for p in closed if p.pnl() > 0]
    losses = [p for p in closed if p.pnl() <= 0]
    gross_win = sum(p.pnl() for p in wins)
    gross_loss = abs(sum(p.pnl() for p in losses))
    total_pnl = sum(p.pnl() for p in closed)

    def group(key: str) -> list[dict[str, Any]]:
        buckets: dict[str, list[Position]] = {}
        for p in closed:
            if key == "strategy":
                k = p.strategy
            elif key == "topic":
                k = p.topic or "unknown"
            elif key == "price":
                k = _bucket(p.entry_price)
            elif key == "side":
                k = p.side
            else:
                k = "unknown"
            buckets.setdefault(k, []).append(p)
        rows = []
        for k, items in buckets.items():
            w = [p for p in items if p.pnl() > 0]
            rows.append(
                {
                    "key": k,
                    "trades": len(items),
                    "wins": len(w),
                    "win_rate": round(len(w) / len(items), 4) if items else 0.0,
                    "pnl": round(sum(p.pnl() for p in items), 2),
                    "avg_roi": round(sum(p.roi() for p in items) / len(items), 4) if items else 0.0,
                }
            )
        rows.sort(key=lambda r: r["trades"], reverse=True)
        return rows

    equity_curve = _equity_curve(broker)
    max_dd = 0.0
    peak = -math.inf
    for point in equity_curve:
        peak = max(peak, point["equity"])
        if peak > 0:
            max_dd = max(max_dd, (peak - point["equity"]) / peak)

    return {
        "closed_trades": len(closed),
        "open_trades": sum(len(a.positions) for a in broker.accounts.values()),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(closed), 4) if closed else 0.0,
        "total_pnl": round(total_pnl, 2),
        "avg_roi": round(sum(p.roi() for p in closed) / len(closed), 4) if closed else 0.0,
        "expectancy": round(total_pnl / len(closed), 2) if closed else 0.0,
        "profit_factor": round(gross_win / gross_loss, 2) if gross_loss > 0 else None,
        "max_drawdown_pct": round(max_dd * 100.0, 2),
        "by_strategy": group("strategy"),
        "by_topic": group("topic"),
        "by_price": group("price"),
        "by_side": group("side"),
        "equity_curve": equity_curve,
    }


def _equity_curve(broker: PaperBroker) -> list[dict[str, Any]]:
    """Realised equity after each closed trade, across all strategy sleeves."""

    events: list[tuple[float, float]] = []
    for acct in broker.accounts.values():
        for p in acct.history:
            events.append((p.closed_ts or p.opened_ts, p.pnl()))
    events.sort(key=lambda x: x[0])
    equity = broker.starting_cash * max(1, len(broker.accounts))
    curve = [{"ts": 0, "equity": round(equity, 2), "label": "start"}]
    for ts, pnl in events:
        equity += pnl
        curve.append({"ts": int(ts), "equity": round(equity, 2), "label": _iso(ts)})
    return curve
