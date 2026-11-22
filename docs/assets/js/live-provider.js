/* ============================================================
 * Live provider — polls the Kalshi demo REST (public, no key).
 * Official source: docs.kalshi.com (see methodology page).
 * Browser-safe: never sends credentials; public market data only.
 * ============================================================ */

const LIVE = (() => {
  const state = {
    timer: null,
    markets: new Map(), // id -> market
  };

  function baseUrls() {
    return [CONFIG.LIVE_REST_BASE, CONFIG.LIVE_REST_FALLBACK];
  }

  async function tryGet(paths) {
    // paths: array of path strings — try the recommended base, then the fallback
    let lastErr = null;
    for (const base of baseUrls()) {
      for (const p of paths) {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 10000);
          const res = await fetch(base + p, { signal: ctrl.signal });
          clearTimeout(t);
          if (res.ok) return { base, data: await res.json() };
          lastErr = new Error('HTTP ' + res.status + ' on ' + base + p);
        } catch (e) {
          lastErr = e;
        }
      }
    }
    throw lastErr || new Error('unreachable');
  }

  function num(x) {
    if (x === undefined || x === null) return null;
    const n = parseFloat(x);
    return isFinite(n) ? n : null;
  }

  function topicFor(title, series) {
    const q = ((title || '') + ' ' + (series || '')).toLowerCase();
    for (const t of TOPICS) {
      if (t.keywords.some(k => q.includes(k))) return t.id;
    }
    return null;
  }

  function mapMarket(raw) {
    const now = Date.now();
    const price = num(raw.yes_bid_dollars) ?? num(raw.last_price_dollars) ?? null;
    const prevPrice = num(raw.prev_yes_bid_dollars) ?? price;
    const topic = topicFor(raw.title, raw.series_ticker) || 'culture';
    const id = 'LIVE-' + raw.ticker;
    const prevBase = STORE.state.markets.find(m => m.id === id);
    const spread = (() => {
      const bid = num(raw.yes_bid_dollars);
      const ask = num(raw.yes_ask_dollars);
      return bid != null && ask != null ? Math.max(0, ask - bid) : 0.02;
    })();
    const volume = num(raw.volume_fp) ?? num(raw.volume) ?? 0;

    const market = newMarket({
      id,
      ticker: raw.ticker,
      title: raw.title || raw.ticker,
      topic,
      status: raw.status === 'settled' ? 'settled' : (raw.status === 'closed' ? 'closed' : 'open'),
      resolution: raw.status === 'settled' ? (raw.result === 'yes' ? 'yes' : (raw.result === 'no' ? 'no' : 'pending')) : 'pending',
      price: price ?? (prevBase ? prevBase.price : 0.5),
      prevPrice: prevBase ? prevBase.price : (price ?? 0.5),
      anchorPrice: prevBase ? (prevBase.history[prevBase.history.length - 6] ? prevBase.history[prevBase.history.length - 6].price : price ?? 0.5) : (price ?? 0.5),
      anchorAt: now - (CONFIG.SWING_WINDOW_MS || 10000),
      volume,
      liquidity: prevBase ? prevBase.liquidity : null,
      spread,
      isSim: false,
      native: {
        ticker: raw.ticker,
        title: raw.title,
        series: raw.series_ticker,
        url: null, // built later from API
        raw: raw,
      },
      startedAt: prevBase ? prevBase.startedAt : now,
      settledAt: prevBase ? prevBase.settledAt : null,
      closeAt: prevBase ? prevBase.closeAt : null,
    });
    market.history = prevBase && prevBase.history ? prevBase.history.slice(-(CONFIG.HISTORY_CAP)) : [];
    market.native.raw = raw;
    return market;
  }

  async function fetchMarkets() {
    const { data } = await tryGet(['/markets?status=open&limit=100']);
    const raw = (data && data.markets) || [];
    const out = [];
    for (const m of raw) {
      const topic = topicFor(m.title, m.series_ticker);
      if (!topic) continue;
      out.push(mapMarket(m));
    }
    return out;
  }

  async function fetchDetail(ticker) {
    const { data } = await tryGet(['/markets/' + encodeURIComponent(ticker)]);
    const raw = (data && data.market) || {};
    return mapMarket(raw);
  }

  async function fetchOrderbook(ticker) {
    const { data } = await tryGet(['/markets/' + encodeURIComponent(ticker) + '/orderbook']);
    return data || {};
  }

  async function refresh({ quiet } = {}) {
    STORE.state.liveState = 'connecting';
    STORE.notify();
    try {
      const markets = await fetchMarkets();
      if (!markets.length) throw new Error('No demo markets found');
      const existing = new Map(STORE.state.markets.filter(m => !m.isSim).map(m => [m.id, m]));
      // Preserve history for markets we already have
      const merged = markets.map(m => {
        const prev = existing.get(m.id);
        if (prev && prev.history && prev.history.length) m.history = prev.history.slice(-(CONFIG.HISTORY_CAP));
        m.history.push({ t: Date.now(), price: m.price });
        if (m.history.length > CONFIG.HISTORY_CAP) m.history.shift();
        return m;
      });
      STORE.state.markets = merged;
      if (!STORE.state.selectedId) STORE.state.selectedId = merged[0] ? merged[0].id : null;
      STORE.state.liveState = 'connected';
      STORE.state.liveError = null;
      STORE.notify();
      return merged;
    } catch (err) {
      STORE.state.liveState = 'failed';
      STORE.state.liveError = String(err && err.message ? err.message : err);
      STORE.notify();
      throw err;
    }
  }

  function start(intervalMs, onTick) {
    stop();
    refresh().catch(() => {});
    state.timer = setInterval(() => { refresh({ quiet: true }).catch(() => {}); if (onTick) onTick(); }, intervalMs);
  }

  function stop() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  return { start, stop, refresh, fetchDetail, fetchOrderbook, baseUrls, mapMarket };
})();
