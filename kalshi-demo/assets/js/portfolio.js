/* ============================================================
 * Portfolio — performance aggregates for simulated trades.
 * ============================================================ */

const PORTFOLIO = (() => {

  function compute() {
    const trades = STORE.state.trades;
    const open = trades.filter(t => t.status === 'open');
    const closed = trades.filter(t => t.status !== 'open');
    const wins = closed.filter(t => t.outcome === 'win').length;
    const losses = closed.filter(t => t.outcome === 'loss').length;
    const realizedPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const exposure = open.reduce((s, t) => s + t.cost, 0);
    const cash = CONFIG.STARTING_CASH + realizedPnl - exposure; // funds committed to open positions
    const equity = CONFIG.STARTING_CASH + realizedPnl;

    const byStrategy = {};
    for (const t of closed) {
      byStrategy[t.strategy] = byStrategy[t.strategy] || { name: t.strategyName, trades: 0, wins: 0, losses: 0, pnl: 0 };
      const b = byStrategy[t.strategy];
      b.trades++;
      b.pnl += t.pnl || 0;
      if (t.outcome === 'win') b.wins++;
      else if (t.outcome === 'loss') b.losses++;
    }
    const byTopic = {};
    for (const t of closed) {
      byTopic[t.topic] = byTopic[t.topic] || { topic: t.topic, trades: 0, wins: 0, pnl: 0 };
      const b = byTopic[t.topic];
      b.trades++;
      b.pnl += t.pnl || 0;
      if (t.outcome === 'win') b.wins++;
    }

    return {
      cash: round2(cash),   // starting cash + realized P&L - open exposure
      startingCash: CONFIG.STARTING_CASH,
      realizedPnl: round2(realizedPnl),
      equity: round2(equity),
      exposure: round2(exposure),
      openCount: open.length,
      totalTrades: closed.length + open.length,
      closedTrades: closed.length,
      wins, losses,
      winRate: closed.length ? (wins / closed.length * 100) : 0,
      byStrategy,
      byTopic,
      netUnrealized: 0,
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  return { compute };
})();
