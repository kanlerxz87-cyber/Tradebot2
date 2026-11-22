/* ============================================================
 * Simulated auto-trading strategies
 * Three strategies run against the store of markets.
 * ALL trades are clearly SIMULATED — no real money, no real orders.
 * ============================================================ */

const STRATEGIES = [
  {
    id: 'momentum',
    name: 'Momentum chaser',
    desc: 'Enter YES on an upward swing (>= $0.10) near breakout.',
    rules: 'alert dir = up (+) AND magnitude >= 0.10',
    tags: ['momentum', 'breakout'],
  },
  {
    id: 'meanrev',
    name: 'Mean reversion',
    desc: 'Enter YES on a downward swing — anticipate a bounce.',
    rules: 'alert dir = down (-) AND magnitude >= 0.10',
    tags: ['reversion', 'fade'],
  },
  {
    id: 'swingbreaker',
    name: 'Swing breaker',
    desc: 'High-conviction entry on >= $0.15 swings.',
    rules: 'magnitude >= 0.15',
    tags: ['reversion', 'breakout'],
  },
];

const TRADER = (() => {
  const notionalPerTrade = 250;   // $ per simulated trade (documented assumption)
  const entryBuffer = 0.02;       // enter slightly into the spread
  const recentAlertIds = new Set();
  const lastTickAlerts = [];

  function reset() {
    recentAlertIds.clear();
    lastTickAlerts.length = 0;
  }

  function newTrade(market, strategy, now, dir, magnitude) {
    const entry = Math.min(0.97, market.price + entryBuffer);
    const contracts = Math.max(1, Math.floor(notionalPerTrade / entry));
    const cost = contracts * entry;
    return {
      id: 'SIMTRADE_' + (++STORE.state.lastTradeId) + '_' + now,
      strategy: strategy.id,
      strategyName: strategy.name,
      topic: market.topic,
      marketId: market.id,
      ticker: market.ticker,
      title: market.title,
      side: 'yes',
      contracts,
      entry: round2(entry),
      cost: round2(cost),
      entryAt: now,
      exitAt: null,
      exitPrice: null,
      pnl: null,
      outcome: null,      // win / loss / pending
      status: 'open',
      isSim: true,
      alertId: 'swing_' + market.id + '_' + now,
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function fireForAlert(market, alert, now) {
    if (!market || market.status !== 'open') return;
    if (alert.magnitude < 0.10) return;

    for (const strat of STRATEGIES) {
      let fire = false;
      if (strat.id === 'momentum') fire = alert.dir > 0 && alert.magnitude >= 0.10;
      if (strat.id === 'meanrev') fire = alert.dir < 0 && alert.magnitude >= 0.10;
      if (strat.id === 'swingbreaker') fire = alert.magnitude >= 0.15;
      if (!fire) continue;
      if (recentAlertIds.has(alert.id + '_' + strat.id)) continue;
      recentAlertIds.add(alert.id + '_' + strat.id);
      const trade = newTrade(market, strat, now, alert.dir, alert.magnitude);
      trade.alertId = alert.id;
      STORE.addTrade(trade);
    }
  }

  function onTick() {
    const now = Date.now();
    // Fire trades on freshly-added alerts only
    const fresh = lastTickAlerts.splice(0, lastTickAlerts.length);
    for (const alert of fresh) {
      const market = STORE.state.markets.find(m => m.id === alert.marketId);
      if (market) fireForAlert(market, alert, now);
    }

    // Close open trades whose market resolved
    for (const trade of STORE.state.trades) {
      if (trade.status !== 'open') continue;
      const market = STORE.state.markets.find(m => m.id === trade.marketId);
      if (market && market.resolution !== 'pending') {
        const win = (trade.side === 'yes' && market.resolution === 'yes') || (trade.side === 'no' && market.resolution === 'no');
        const payout = win ? trade.contracts * 1 : 0;
        trade.exitAt = now;
        trade.exitPrice = win ? 1 : 0;
        trade.pnl = round2(payout - trade.cost);
        trade.outcome = win ? 'win' : 'loss';
        trade.status = 'closed';
      } else if (market && market.price <= trade.entry - 0.12) {
        // Early loss: exit when marked $0.12+ under entry
        trade.exitAt = now;
        trade.exitPrice = round2(market.price);
        trade.pnl = round2(trade.contracts * market.price - trade.cost);
        trade.outcome = 'loss';
        trade.status = 'closed';
      }
    }

    STORE.notify();
  }

  function markFreshAlerts(alerts) {
    for (const a of alerts) {
      if (a.type === 'swing') lastTickAlerts.push(a);
    }
  }

  return { STRATEGIES, onTick, reset, markFreshAlerts, notionalPerTrade };
})();

// wire alert engine -> trader: watch the store for new alerts
STORE.subscribe(() => {
  const alerts = STORE.state.alerts.slice(0, 20);
  TRADER.markFreshAlerts(alerts);
});
