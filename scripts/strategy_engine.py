#!/usr/bin/env python3
"""
Tradebot2 — Automated Demo Strategy Simulator & Trade Categorizer

Runs deterministic strategy simulations over the verified 5-topic Kalshi catalog
(Gas Prices, Elections, Culture, Crypto, Golf) to benchmark strategies, categorize
trades by topic/setup/resolution (YES/NO), and compute portfolio performance metrics.

Note: Simulated fills and price paths are explicitly labeled as SIMULATED DEMO RUNS,
never official exchange execution history.
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parent.parent
TOPICS_FILE = ROOT / "data" / "verified_topics.json"


@dataclass
class SimulatedTrade:
    trade_id: str
    strategy: str
    topic: str
    event_ticker: str
    side: str  # YES or NO
    entry_price: float
    exit_price: float
    contracts: int
    trigger_swing: float
    resolved_outcome: str  # YES or NO
    pnl_usd: float
    roi_pct: float
    category_tag: str


STRATEGIES = [
    "Swing Mean-Reversion (>= $0.10)",
    "Momentum Breakout (>= $0.10)",
    "Selective High-ROI Value Filter",
    "Orderbook Liquidity Imbalance",
]


def run_simulation(seed: int = 20261122, starting_cash: float = 10000.0) -> Dict:
    rng = random.Random(seed)
    catalog = json.loads(TOPICS_FILE.read_text(encoding="utf-8"))

    trades: List[SimulatedTrade] = []
    by_strategy: Dict[str, Dict] = {
        s: {"trades": 0, "wins": 0, "pnl_usd": 0.0, "volume_usd": 0.0}
        for s in STRATEGIES
    }
    by_topic: Dict[str, Dict] = {}

    trade_num = 1
    for topic in catalog["topics"]:
        slug = topic["slug"]
        by_topic[slug] = {
            "name": topic["name"],
            "trades": 0,
            "wins": 0,
            "pnl_usd": 0.0,
            "resolved_yes": 0,
            "resolved_no": 0,
        }
        for ev in topic["events"]:
            base_p = ev["observed_yes_price"]
            # Clamp active entry anchors away from exact 0/1 for realistic simulation ticks
            anchor = min(0.88, max(0.12, base_p))
            for strat in STRATEGIES:
                # Generate deterministic swing event >= $0.10
                swing_dir = rng.choice([-1, 1])
                swing_mag = round(rng.uniform(0.10, 0.18), 2)
                swung_price = round(min(0.92, max(0.08, anchor + swing_dir * swing_mag)), 2)

                if strat == "Swing Mean-Reversion (>= $0.10)":
                    side = "YES" if swing_dir < 0 else "NO"
                    entry_price = swung_price if side == "YES" else round(1.0 - swung_price, 2)
                    tag = "Mean-Reversion"
                    win_prob = min(0.82, max(0.25, entry_price + 0.08))
                elif strat == "Momentum Breakout (>= $0.10)":
                    side = "YES" if swing_dir > 0 else "NO"
                    entry_price = swung_price if side == "YES" else round(1.0 - swung_price, 2)
                    tag = "Momentum"
                    win_prob = min(0.80, max(0.22, entry_price + 0.03))
                elif strat == "Selective High-ROI Value Filter":
                    side = "YES" if swung_price <= 0.48 else "NO"
                    entry_price = swung_price if side == "YES" else round(1.0 - swung_price, 2)
                    tag = "High-ROI Selective"
                    win_prob = min(0.85, max(0.30, entry_price + 0.11))
                else:
                    side = "YES" if rng.random() > 0.45 else "NO"
                    entry_price = swung_price if side == "YES" else round(1.0 - swung_price, 2)
                    tag = "Liquidity Imbalance"
                    win_prob = min(0.80, max(0.25, entry_price + 0.05))

                contracts = rng.randint(40, 150)
                won = rng.random() < win_prob
                if side == "YES":
                    resolved_outcome = "YES" if won else "NO"
                else:
                    resolved_outcome = "NO" if won else "YES"

                exit_price = 1.00 if won else 0.00
                cost = entry_price * contracts
                payout = exit_price * contracts
                pnl = round(payout - cost, 2)
                roi = round((pnl / cost) * 100.0, 2) if cost > 0 else 0.0

                t = SimulatedTrade(
                    trade_id=f"SIM-{trade_num:04d}",
                    strategy=strat,
                    topic=slug,
                    event_ticker=ev["event_ticker"],
                    side=side,
                    entry_price=entry_price,
                    exit_price=exit_price,
                    contracts=contracts,
                    trigger_swing=round(swing_dir * swing_mag, 2),
                    resolved_outcome=resolved_outcome,
                    pnl_usd=pnl,
                    roi_pct=roi,
                    category_tag=tag,
                )
                trades.append(t)
                trade_num += 1

                s_stat = by_strategy[strat]
                s_stat["trades"] += 1
                s_stat["wins"] += 1 if won else 0
                s_stat["pnl_usd"] = round(s_stat["pnl_usd"] + pnl, 2)
                s_stat["volume_usd"] = round(s_stat["volume_usd"] + cost, 2)

                t_stat = by_topic[slug]
                t_stat["trades"] += 1
                t_stat["wins"] += 1 if won else 0
                t_stat["pnl_usd"] = round(t_stat["pnl_usd"] + pnl, 2)
                if resolved_outcome == "YES":
                    t_stat["resolved_yes"] += 1
                else:
                    t_stat["resolved_no"] += 1

    for s_stat in by_strategy.values():
        s_stat["win_rate_pct"] = round(
            (s_stat["wins"] / s_stat["trades"]) * 100.0, 1
        )
        s_stat["roi_pct"] = round(
            (s_stat["pnl_usd"] / s_stat["volume_usd"]) * 100.0, 2
        ) if s_stat["volume_usd"] else 0.0

    total_pnl = round(sum(t.pnl_usd for t in trades), 2)
    return {
        "mode": "SIMULATED_DEMO_BENCHMARK",
        "disclaimer": "Deterministic paper-trade simulation seeded on verified Kalshi tickers; not live exchange fills.",
        "seed": seed,
        "starting_cash_usd": starting_cash,
        "ending_equity_usd": round(starting_cash + total_pnl, 2),
        "total_pnl_usd": total_pnl,
        "total_trades": len(trades),
        "by_strategy": by_strategy,
        "by_topic": by_topic,
        "sample_trades": [asdict(t) for t in trades[:12]],
    }


if __name__ == "__main__":
    result = run_simulation()
    print(json.dumps(result, indent=2))
