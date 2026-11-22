/* ============================================================
 * Shared store: markets, alerts, trades, resolutions
 * Plain global object with pub/sub — no dependencies.
 * ============================================================ */

const STORE = (() => {
  const listeners = new Set();
  const state = {
    mode: 'sim',          // 'sim' | 'live'
    liveState: 'idle',    // 'idle' | 'connecting' | 'connected' | 'failed' | 'fallback' | 'awaiting-credentials'
    liveError: null,
    markets: [],          // live markets (sim or live) — see market model below
    alerts: [],           // all alerts, newest first (capped)
    trades: [],           // simulated trades — newest first
    resolved: [],         // resolved events, newest first
    startedAt: Date.now(),
    selectedId: null,
    history: {},          // marketId -> [{t, price}]
    lastTradeId: 0,
    totalAlerts: 0,
    totalTrades: 0,
  };

  function notify() {
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function upsertMarket(m) {
    const i = state.markets.findIndex(x => x.id === m.id);
    if (i >= 0) state.markets[i] = m;
    else state.markets.push(m);
  }

  function pruneMarket(id) {
    state.markets = state.markets.filter(x => x.id !== id);
    if (state.selectedId === id) state.selectedId = null;
  }

  function addAlert(alert) {
    state.alerts.unshift(alert);
    if (state.alerts.length > 400) state.alerts.length = 400;
    state.totalAlerts++;
    notify();
  }

  function addTrade(trade) {
    state.trades.unshift(trade);
    if (state.trades.length > 250) state.trades.length = 250;
    state.totalTrades++;
    notify();
  }

  function addResolution(record) {
    state.resolved.unshift(record);
    if (state.resolved.length > 100) state.resolved.length = 100;
    notify();
  }

  return {
    state,
    subscribe,
    notify,
    upsertMarket,
    pruneMarket,
    addAlert,
    addTrade,
    addResolution,
  };
})();

/* ---------- market model (plain object) ----------
 * {
 *   id, ticker, title, topic, series?, status: 'open'|'closed'|'settled',
 *   resolution: 'pending'|'yes'|'no', resolutionAt?,
 *   price, prevPrice, anchorPrice, anchorAt,
 *   volume, liquidity, spread,
 *   history: [{t, price}],  (capped)
 *   isSim, native: {ticker, title, url?, series?, raw?},
 *   alerts: count, news: [{t, text, kind}],
 *   startedAt?, settledAt?, closeAt?
 * }
 * -------------------------------------------------- */

function newMarket(partial) {
  const now = Date.now();
  return Object.assign({
    id: null, ticker: '', title: '', topic: 'gas', status: 'open',
    resolution: 'pending', resolutionAt: null,
    price: 0.5, prevPrice: 0.5, anchorPrice: 0.5, anchorAt: now,
    volume: 0, liquidity: 0, spread: 0.02,
    history: [], isSim: true, native: null,
    alerts: 0, news: [], startedAt: now, settledAt: null, closeAt: null,
    id: 'm' + now + '_' + Math.random().toString(36).slice(2, 7),
  }, partial);
}
