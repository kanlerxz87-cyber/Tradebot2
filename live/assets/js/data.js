/* =============================================================================
   Tradebot2 — data layer
   -----------------------------------------------------------------------------
   Loads live data from the official Kalshi Trade API, joins series → topic,
   aggregates events, remembers price snapshots in the browser, detects moves
   of >= $0.10, and runs the SIMULATED trading engine + strategy analytics.

   Nothing here invents a value. If a field is missing from the API the row
   shows "—" and the site's flagged page explains why.

   Sources (all verified 2026-11-22):
     get-series-list      /series?category=&tags=&include_volume=
     get-events           /events?status=&with_nested_markets=&limit=&cursor=
     get-markets          (nested inside events)
     get-trades           /markets/trades?ticker=&limit=
     get-market-candlesticks  /series/{s}/markets/{t}/candlesticks?period_interval=1|60|1440
     get-market-orderbook /markets/{t}/orderbook?depth=
     market_lifecycle     status enum + finalized/results
     market_settlement    YES pays $1, NO pays $0
     kalshi-fee-schedule.pdf  taker fee = ceil(0.07 * C * P * (1-P))
   ============================================================================= */
'use strict';

var TBData = (() => {
  const { num, api, normMarket, TOPICS, topicById, store, LS } = TB;

  const KEY = { history: 'tb.hist', alerts: 'tb.alerts', events: 'tb.events' };
  const CAP = { historyTickers: 400, historyPoints: 180, alerts: 600 };

  /* ------------------------------------------------------------------ state */
  const state = {
    snapshotTs: null,
    seriesByTopic: {},    // topicId -> [series]
    seriesIndex: {},      // series_ticker -> {topic, series}
    events: [],           // events in scope (all statuses scanned)
    markets: [],          // normalised markets in scope
    truncated: [],        // honest record of any page caps we hit
    errors: [],
    loadedEnv: null,
    stats: null
  };

  /* --------------------------------------------------- local snapshot store */
  function loadHistory() { return store.get(KEY.history, {}) || {}; }
  function saveHistory(h) {
    const tickers = Object.keys(h);
    if (tickers.length > CAP.historyTickers) {
      tickers.sort((a, b) => (h[a].at || 0) - (h[b].at || 0));
      tickers.slice(0, tickers.length - CAP.historyTickers).forEach(t => delete h[t]);
    }
    try { store.set(KEY.history, h); } catch (e) { /* over quota: drop oldest half */
      const t2 = Object.keys(h).sort((a, b) => (h[a].at || 0) - (h[b].at || 0));
      t2.slice(0, Math.ceil(t2.length / 2)).forEach(t => delete h[t]);
      try { store.set(KEY.history, h); } catch (e2) {}
    }
  }
  function alerts() { return store.get(KEY.alerts, []) || []; }
  function saveAlerts(list) { try { store.set(KEY.alerts, list.slice(0, CAP.alerts)); } catch (e) {} }
  function addAlerts(items) {
    if (!items.length) return [];
    const all = items.concat(alerts());
    saveAlerts(all);
    return items;
  }

  /* ------------------------------------------------------------ topic loads */
  /** Fetch the series that define each topic (verified filter strings). */
  async function loadSeriesMap(topics) {
    const list = topics || TOPICS;
    const out = {};
    const idx = {};
    for (const t of list) {
      try {
        const r = await api.series(t.filter);
        const arr = (r && r.series) || [];
        out[t.id] = arr.map(s => ({
          ticker: s.ticker, title: s.title, category: s.category, categories: s.categories || [],
          tags: s.tags || [], volume: num(s.volume_fp), frequency: s.frequency,
          settlementSources: s.settlement_sources || [],
          contractUrl: s.contract_url || null, contractTermsUrl: s.contract_terms_url || null,
          feeType: s.fee_type || null
        }));
        for (const s of out[t.id]) idx[s.ticker] = { topic: t.id, series: s };
      } catch (e) {
        state.errors.push(`Series list for ${t.name}: ${e.message}`);
        out[t.id] = [];
      }
    }
    state.seriesByTopic = out;
    state.seriesIndex = idx;
    return out;
  }

  /**
   * Page through /events with nested markets.
   * Only events whose series belongs to one of our five topics are kept.
   * caps.maxPages is recorded in state.truncated when hit, so the UI can say so.
   */
  async function loadEvents(opts) {
    const o = Object.assign({ statuses: ['open', 'closed'], maxPages: 8, limit: 200 }, opts);
    const kept = [];
    const trunc = [];
    for (const status of o.statuses) {
      let cursor = '';
      let pages = 0;
      for (;;) {
        let r;
        try {
          r = await api.events({ status, with_nested_markets: true, limit: o.limit, cursor });
        } catch (e) {
          state.errors.push(`Events (${status}): ${e.message}`);
          break;
        }
        pages++;
        for (const ev of (r.events || [])) {
          const s = state.seriesIndex[ev.series_ticker];
          if (!s) continue;                       // outside the five topics
          kept.push({
            eventTicker: ev.event_ticker, seriesTicker: ev.series_ticker, topic: s.topic,
            title: ev.title, subTitle: ev.sub_title, mutuallyExclusive: !!ev.mutually_exclusive,
            settlementSources: ev.settlement_sources || s.series.settlementSources || [],
            scalar: (ev.markets || []).some(m => m.market_type && m.market_type !== 'binary'),
            raw: ev
          });
        }
        cursor = r.cursor || '';
        if (!cursor || pages >= o.maxPages) {
          if (cursor) trunc.push(`/events?status=${status} stopped after ${pages} pages (${o.limit}/page); more events exist.`);
          break;
        }
      }
    }
    /* de-duplicate events seen under both status filters, keeping the richer record */
    const byTicker = new Map();
    for (const e of kept) {
      const prev = byTicker.get(e.eventTicker);
      if (!prev || (e.raw.markets || []).length > (prev.raw.markets || []).length) byTicker.set(e.eventTicker, e);
    }
    state.events = [...byTicker.values()];
    state.truncated = trunc;

    /* flatten markets with topic/event context */
    const markets = [];
    for (const e of state.events) {
      for (const m of (e.raw.markets || [])) {
        const nm = normMarket(m, { topic: e.topic, seriesTicker: e.seriesTicker });
        nm.eventTitle = e.title;
        nm.eventSubTitle = e.subTitle;
        nm.eventTicker = e.eventTicker;
        nm.scalar = e.scalar;
        nm.eventSettlementSources = e.settlementSources;
        markets.push(nm);
      }
    }
    state.markets = markets;
    return { events: state.events, markets };
  }

  /**
   * Fallback: load the committed verified capture (live/data/fallback-snapshot.json).
   *
   * WHY THIS EXISTS: the browser calls the Kalshi API directly. If that call is
   * blocked (network, corporate proxy, or CORS policy on the visitor's network),
   * the page must still be honest. It shows the last verified capture, clearly
   * dated and labelled "SNAPSHOT — not live", instead of either a blank page or
   * invented numbers. Alerts and paper trading are DISABLED in this mode.
   */
  async function loadFallback() {
    try {
      /* Resolve relative to THIS script's own URL. The dashboard lives at a fixed depth
         (live/*.html) and topics at (live/topics/*.html), so derive the page depth from
         the script path: assets/js/data.js -> live/assets/js/ -> ../data/ */
      let fallbackUrl;
      try {
        const sc = document.currentScript
          || [...document.scripts].find(x => /assets\/js\/data\.js/.test(x.getAttribute('src') || ''));
        const src = sc && (sc.src || sc.getAttribute('src'));
        const assetBase = src ? new URL(src, location.href) : new URL('assets/js/data.js', location.href);
        const liveRoot = new URL('../../', assetBase);            // -> .../live/
        const pageDepth = location.pathname.includes('/topics/') ? 1 : 0;
        fallbackUrl = new URL('../'.repeat(pageDepth) + 'data/fallback-snapshot.json', liveRoot).toString();
      } catch (e) {
        fallbackUrl = new URL('data/fallback-snapshot.json', location.href).toString();
      }
      state.fallbackUrl = fallbackUrl;
      const res = await fetch(fallbackUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.fallback = {
        at: data.snapshotTs, source: data.source, note: data._README
      };
      state.seriesByTopic = {};
      state.seriesIndex = {};
      state.events = [];
      const byEvent = new Map();
      state.markets = (data.markets || []).map(m => {
        const norm = {
          ticker: m.ticker, eventTicker: m.event_ticker, seriesTicker: m.series_ticker,
          topic: m.topic, title: m.title, yesSubTitle: null,
          status: m.status, statusLabel: (TB.STATUS_MAP[m.status] || m.status),
          result: m.result || '',
          yesBid: num(m.yes_bid_dollars), yesAsk: num(m.yes_ask_dollars),
          noBid: num(m.no_bid_dollars), noAsk: num(m.no_ask_dollars),
          yesBidSize: num(m.yes_bid_size_fp), yesAskSize: num(m.yes_ask_size_fp),
          last: num(m.last_price_dollars), prev: null, mid: null,
          price: num(m.last_price_dollars),
          priceKind: num(m.last_price_dollars) !== null ? 'last' : null,
          spread: (num(m.yes_bid_dollars) !== null && num(m.yes_ask_dollars) !== null)
            ? Math.round((num(m.yes_ask_dollars) - num(m.yes_bid_dollars)) * 10000) / 10000 : null,
          volume: num(m.volume_fp), volume24h: num(m.volume_24h_fp), oi: num(m.open_interest_fp),
          notional: num(m.notional_value_dollars) || 1,
          closeTime: m.close_time, expirationTime: null, latestExpiration: null,
          settlementTs: m.settlement_ts, settlementValue: null,
          rules: m.rules_primary || '', rulesSecondary: '',
          priceStructure: null, canCloseEarly: false,
          eventTitle: m.event_title, eventSubTitle: null, scalar: false,
          eventSettlementSources: [], fallback: true, raw: m
        };
        if (!byEvent.has(m.event_ticker)) {
          byEvent.set(m.event_ticker, {
            eventTicker: m.event_ticker, seriesTicker: m.series_ticker, topic: m.topic,
            title: m.event_title, subTitle: null, mutuallyExclusive: false,
            settlementSources: [], scalar: false, raw: { markets: [] }
          });
        }
        byEvent.get(m.event_ticker).raw.markets.push(norm.raw);
        return norm;
      });
      state.events = [...byEvent.values()];
      state.truncated = [];
      state.snapshotTs = data.snapshotTs ? new Date(data.snapshotTs).getTime() : null;
      state.stats = computeStats();
      return state.fallback;
    } catch (e) {
      state.errors.push('Fallback snapshot unavailable: ' + e.message);
      return null;
    }
  }

  /** Full refresh: series map first, then events/markets, then snapshot + swings.
   *  When opts.fallback is set (or the live call failed), the committed capture is used. */
  async function refresh(opts) {
    const o = opts || {};
    state.errors = [];
    state.fallback = null;
    if (o.fallback) { return { snapshotTs: state.snapshotTs, swings: [], stats: await loadFallback() && state.stats, fallback: true }; }
    if (!Object.keys(state.seriesIndex).length) await loadSeriesMap();
    await loadEvents(o.events);
    if (!state.markets.length && state.errors.length) {
      /* the live fetch failed outright: use the dated capture, do not fabricate */
      await loadFallback();
      state.errors.push(state.fallback
        ? 'Live API unreachable — showing the verified snapshot recorded ' +
          (state.fallback.at ? new Date(state.fallback.at).toUTCString() : 'at an unknown time') +
          '. Alerts and paper trading are paused in this mode.'
        : 'Live API unreachable and the committed snapshot could not be read. Reload, or open the ' +
          'CORS probe page to see what your browser is allowed to fetch.');
      state.stats = state.stats || computeStats();
      return { snapshotTs: state.snapshotTs, swings: [], stats: state.stats, fallback: !!state.fallback };
    }
    state.snapshotTs = Date.now();
    state.loadedEnv = api.getEnv();
    const swings = recordAndDetect();
    state.stats = computeStats();
    return { snapshotTs: state.snapshotTs, swings, stats: state.stats, fallback: false };
  }

  /* --------------------------------------------- snapshot + swing detection */
  /**
   * Store the current price of each market, then compare with the previous
   * stored price. A swing is recorded when |Δ| >= threshold cents.
   * The "previous" value is the last snapshot we took, so the alert window is
   * [previous fetch time, this fetch time] — never presented as "seconds".
   */
  function recordAndDetect() {
    const now = Date.now();
    const h = loadHistory();
    const cur = TB.settings();
    /* settings hold the threshold in DOLLARS (the task says $0.10); prices are
       tracked in CENTS, so convert once, here, and never compare the two units. */
    const thresholdDollars = num(cur.threshold) == null ? TB.ALERT_THRESHOLD : num(cur.threshold);
    const threshold = Math.round(thresholdDollars * 100 * 100) / 100;   // cents
    const found = [];

    for (const m of state.markets) {
      if (m.price === null) continue;
      const priceCents = TB.cents(m.price);
      const prev = h[m.ticker];
      const point = { t: now, p: priceCents, b: m.yesBid === null ? null : TB.cents(m.yesBid), a: m.yesAsk === null ? null : TB.cents(m.yesAsk) };
      if (!prev) {
        h[m.ticker] = { at: now, pts: [point], topic: m.topic, title: m.title, series: m.seriesTicker };
        continue;
      }
      const last = prev.pts[prev.pts.length - 1];
      const delta = priceCents - last.p;
      prev.pts.push(point);
      if (prev.pts.length > CAP.historyPoints) prev.pts = prev.pts.slice(-CAP.historyPoints);
      prev.at = now; prev.topic = m.topic; prev.title = m.title; prev.series = m.seriesTicker;
      if (Math.abs(delta) >= threshold && m.status === 'active') {
        found.push({
          id: m.ticker + '@' + now,
          at: now, fromTs: last.t, ticker: m.ticker, topic: m.topic, title: m.title,
          eventTicker: m.eventTicker, seriesTicker: m.seriesTicker,
          from: last.p, to: priceCents, delta,
          bid: point.b, ask: point.a, spread: m.spread, volume24h: m.volume24h,
          oi: m.oi, priceKind: m.priceKind, closeTime: m.closeTime,
          score: scoreCandidate(m, delta)
        });
      }
    }
    saveHistory(h);
    /* de-dupe: one alert per ticker per minute at the same price (repeat refreshes
       of an unchanged price must not spam the chat). */
    const minute = Math.floor(now / 60000);
    const existing = new Set(alerts().map(a => a.ticker + '|' + a.to + '|' + Math.floor(a.at / 60000)));
    const fresh = found.filter(a => !existing.has(a.ticker + '|' + a.to + '|' + minute));
    addAlerts(fresh);
    return fresh;
  }

  /* --------------------------------------------------- high-ROI candidate score
     Transparent, deliberately simple reversion screen. It is a hypothesis, not a
     validated model (flagged on the site):
       p      = price in dollars after the move
       edge   = 0.5 - |p - (1 - 0.5)| ... kept explicit below instead:
       reversion target = 0.5*prev + 0.5*p   (partial pull-back assumption, K=0.5)
       grossEdge = |target - p|              (expected cents per contract)
       cost      = spread/2 + taker fee per contract at price p
       score     = grossEdge - cost
     A trade passes the screen when score >= minScore (default $0.02) and the
     market is liquid enough to enter (bid & ask sizes, 24h volume, OI).
     ------------------------------------------------------------------------- */
  const SCREEN = { K: 0.5, minScore: 0.02, maxSpread: 0.05, minAskSize: 20, minVolume24h: 20, minOI: 1, pMin: 0.05, pMax: 0.95 };
  function takerFeePerContract(price) {
    // official schedule: fees = ceil(0.07 * C * P * (1-P)); per contract, C = 1
    return 0.07 * price * (1 - price);
  }
  function scoreCandidate(m, deltaCents) {
    const p = m.price;
    if (p === null) return { pass: false, reason: 'no price' };
    const prevP = p - deltaCents / 100;
    const target = SCREEN.K * prevP + (1 - SCREEN.K) * p;
    const grossEdge = Math.abs(target - p);                       // $ per contract
    const spread = m.spread === null ? SCREEN.maxSpread : m.spread;
    const cost = spread / 2 + takerFeePerContract(p);
    const score = grossEdge - cost;
    const side = target > p ? 'yes' : 'no';                        // expect price to revert up -> buy YES
    const reasons = [];
    if (p < SCREEN.pMin || p > SCREEN.pMax) reasons.push('price outside 5¢–95¢ band');
    if (spread > SCREEN.maxSpread) reasons.push('spread wider than 5¢');
    if ((m.yesAskSize || 0) < SCREEN.minAskSize && (m.yesBidSize || 0) < SCREEN.minAskSize) reasons.push('thin top-of-book size');
    if ((m.volume24h || 0) < SCREEN.minVolume24h) reasons.push('24h volume below 20 contracts');
    if ((m.oi || 0) < SCREEN.minOI) reasons.push('no open interest');
    if (score < SCREEN.minScore) reasons.push('edge after costs below 2¢');
    return {
      pass: reasons.length === 0, side, score, grossEdge, cost, target,
      reasons, spread, fee: takerFeePerContract(p)
    };
  }

  /* ------------------------------------------------------------- aggregates */
  function computeStats() {
    const mk = state.markets;
    const live = mk.filter(TB.isLive);
    const settled = mk.filter(m => m.status === 'finalized');
    const resolved = mk.filter(m => m.result === 'yes' || m.result === 'no');
    const notional = live.reduce((s, m) => s + (m.volume || 0) * (m.notional || 1), 0);
    const vol24 = live.reduce((s, m) => s + (m.volume24h || 0) * (m.notional || 1), 0);
    return {
      markets: mk.length, live: live.length, settled: settled.length,
      resolved: resolved.length, events: state.events.length,
      notional, vol24,
      byTopic: TOPICS.map(t => {
        const l = live.filter(m => m.topic === t.id);
        const all = mk.filter(m => m.topic === t.id);
        return {
          id: t.id, name: t.name, icon: t.icon,
          live: l.length, markets: all.length,
          events: new Set(all.map(m => m.eventTicker)).size,
          notional: l.reduce((s, m) => s + (m.volume || 0) * (m.notional || 1), 0),
          vol24: l.reduce((s, m) => s + (m.volume24h || 0) * (m.notional || 1), 0),
          resolved: all.filter(m => m.result === 'yes' || m.result === 'no').length
        };
      })
    };
  }

  /** Group live markets into events and rank by traded notional (24h first). */
  function rankEvents(limit) {
    const groups = new Map();
    for (const m of state.markets) {
      const key = m.eventTicker;
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, {
        eventTicker: key, seriesTicker: m.seriesTicker, topic: m.topic,
        title: m.eventTitle, subTitle: m.eventSubTitle, markets: [], settlementSources: m.eventSettlementSources || []
      });
      groups.get(key).markets.push(m);
    }
    const rows = [...groups.values()].map(g => {
      const live = g.markets.filter(TB.isLive);
      const notionalTotal = g.markets.reduce((s, m) => s + (m.volume || 0) * (m.notional || 1), 0);
      const vol24 = g.markets.reduce((s, m) => s + (m.volume24h || 0) * (m.notional || 1), 0);
      const resolved = g.markets.filter(m => m.result === 'yes' || m.result === 'no');
      const pending = g.markets.filter(m => TB.isClosed(m) && !(m.result === 'yes' || m.result === 'no'));
      const best = live.slice().sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))[0] || null;
      return Object.assign({}, g, {
        liveCount: live.length, marketCount: g.markets.length,
        notionalTotal, vol24, resolved, pending,
        topMarket: best,
        maxPrice: live.reduce((mx, m) => (m.price !== null && m.price > mx ? m.price : mx), 0),
        state: live.length ? 'LIVE' : (pending.length ? 'AWAITING RESULT' : (resolved.length ? 'RESOLVED' : 'CLOSED'))
      });
    });
    rows.sort((a, b) => (b.vol24 - a.vol24) || (b.notionalTotal - a.notionalTotal));
    return { rows: limit ? rows.slice(0, limit) : rows, all: rows };
  }

  function marketsForTopic(topicId) { return state.markets.filter(m => m.topic === topicId); }
  function marketByTicker(t) { return state.markets.find(m => m.ticker === t) || null; }
  function historyFor(ticker) { const h = loadHistory(); return (h[ticker] && h[ticker].pts) || []; }

  /* ======================================================================
     SIMULATED trading engine
     - $10,000 simulated cash (a simulation assumption, not a Kalshi balance)
     - every fill pays the scheduled taker fee ceil(0.07*C*P*(1-P))
     - a position closes at the market's settled result ($1 / $0) or when the
       strategy's stop / target / time limit triggers on a later snapshot
     - everything is stored in this browser; no order is ever sent
     ====================================================================== */
  const PAPER_PREFIX = 'SIM';
  const START_CASH = 10000;

  const STRATEGIES = [
    {
      id: 'S1-momentum', name: 'Momentum breakout', tag: 'Trend',
      thesis: 'A ≥10¢ move on real volume keeps going for a short while (short-horizon under-reaction).',
      entry: 'Alert with |Δ| ≥ 10¢, 24h volume ≥ 50 contracts, spread ≤ 5¢.',
      exit: 'Take profit +8¢, stop −6¢, or hold to settlement.',
      targetCents: 8, stopCents: 6, qty: 10,
      minVolume24h: 50, maxSpread: 0.05, requiresAlert: true
    },
    {
      id: 'S2-reversion', name: 'Reversion fade', tag: 'Mean reversion',
      thesis: 'A sudden ≥10¢ jump overshoots and part of it retraces (the model behind the high-ROI chat).',
      entry: 'Screen score ≥ 2¢ after costs; price 5¢–95¢; top-of-book size ≥ 20.',
      exit: 'Target 50% retrace, stop −8¢, or hold to settlement.',
      targetCents: 6, stopCents: 8, qty: 10,
      minVolume24h: 20, maxSpread: 0.05, requiresAlert: true, useScore: true
    },
    {
      id: 'S3-cheap-tail', name: 'Cheap tail', tag: 'Convexity',
      thesis: 'Contracts under 15¢ that move up are being repriced on news; the right tail is under-priced.',
      entry: 'Alert on a market whose price is ≤ 15¢ after the move and volume ≥ 20.',
      exit: 'Hold to settlement; stop −5¢.',
      targetCents: 99, stopCents: 5, qty: 25,
      minVolume24h: 20, maxSpread: 0.05, requiresAlert: true, maxPrice: 0.15
    },
    {
      id: 'S4-resolution-carry', name: 'Resolution carry', tag: 'Carry',
      thesis: 'A contract already trading at ≥ 85¢ closes within 3 days: buy YES and hold to settlement.',
      entry: 'Live market ≥ 85¢, closes ≤ 72h, volume24h ≥ 10.',
      exit: 'Hold to settlement (no stop).',
      targetCents: 99, stopCents: 0, qty: 20,
      minVolume24h: 10, maxSpread: 0.08, requiresAlert: false
    }
  ];
  function strategyById(id) { return STRATEGIES.find(s => s.id === id) || null; }

  function paperState() {
    return store.get(LS.paper, { cash: START_CASH, startCash: START_CASH, trades: [], created: Date.now(), auto: false });
  }
  function savePaper(p) { try { store.set(LS.paper, p); } catch (e) {} return p; }
  function resetPaper() { return savePaper({ cash: START_CASH, startCash: START_CASH, trades: [], created: Date.now(), auto: paperState().auto }); }

  function feeFor(qty, price) {
    // official: fees = round up (0.07 × C × P × (1−P)); we keep 4dp to stay conservative
    const raw = 0.07 * qty * price * (1 - price);
    return Math.ceil(raw * 10000) / 10000;
  }

  /** Would this strategy enter on this alert? Returns {enter, reason}. */
  function strategyWants(s, alert, mkt) {
    if (!alert) return { enter: false, reason: 'needs a ≥10¢ alert' };
    if (s.requiresAlert && Math.abs(alert.delta) < TB.ALERT_THRESHOLD * 100) return { enter: false, reason: 'move below threshold' };
    const m = mkt || {};
    const volume24h = alert.volume24h != null ? alert.volume24h : (m.volume24h || 0);
    const spread = alert.spread != null ? alert.spread : (m.spread || 0);
    const ask = alert.ask != null ? alert.ask : (m.yesAsk != null ? TB.cents(m.yesAsk) : null);
    if (volume24h < s.minVolume24h) return { enter: false, reason: `24h volume ${volume24h} < ${s.minVolume24h}` };
    if (spread > s.maxSpread) return { enter: false, reason: `spread ${(spread * 100).toFixed(1)}¢ > ${(s.maxSpread * 100).toFixed(0)}¢` };
    if (s.maxPrice && alert.to > s.maxPrice * 100) return { enter: false, reason: `price ${alert.to}¢ above ${s.maxPrice * 100}¢ cap` };
    if (alert.to < 1 || alert.to > 99) return { enter: false, reason: 'price at the $0.01–$0.99 extremes' };
    if (s.useScore && !(alert.score && alert.score.pass)) return { enter: false, reason: 'fails the high-ROI screen' };
    return { enter: true, reason: s.thesis };
  }

  /**
   * Open a simulated position.
   * side: 'yes' buys the YES contract at its ask (you pay the ask).
   * For a NO position we buy the NO contract at (1 − yesBid).
   */
  function openTrade({ strategyId, alert, market, side, qty, price, note }) {
    const p = paperState();
    const s = strategyById(strategyId);
    const q = Math.max(1, Math.round(qty || (s ? s.qty : 10)));
    const sideUse = side || 'yes';
    let px = price;
    if (px == null && market) {
      px = sideUse === 'yes' ? market.yesAsk : (market.noAsk != null ? market.noAsk : (market.yesBid != null ? 1 - market.yesBid : null));
    }
    if (px == null || px <= 0 || px >= 1) return { ok: false, error: 'no tradable price for that side' };
    const cost = Math.round(px * q * 10000) / 10000;
    const fee = feeFor(q, px);
    if (p.cash - cost - fee < 0) return { ok: false, error: 'simulated cash is insufficient for ' + q + ' contracts' };
    const trade = {
      id: PAPER_PREFIX + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 900 + 100),
      openedAt: Date.now(), strategy: strategyId, ticker: alert ? alert.ticker : (market && market.ticker),
      topic: alert ? alert.topic : (market && market.topic),
      title: alert ? alert.title : (market && market.title),
      side: sideUse, qty: q, entry: px, entryCents: Math.round(px * 10000) / 100,
      fee, status: 'open', note: note || (s ? s.name : 'manual'),
      alertFrom: alert ? alert.from : null, alertTo: alert ? alert.to : null,
      delta: alert ? alert.delta : null, closeTime: alert ? alert.closeTime : (market && market.closeTime),
      peak: px, trough: px, marks: [{ t: Date.now(), p: Math.round(px * 10000) / 100 }]
    };
    p.trades.unshift(trade);
    p.cash = Math.round((p.cash - cost - fee) * 10000) / 10000;
    savePaper(p);
    return { ok: true, trade, paper: p };
  }

  /** Mark open trades to the latest observed price; apply stops/targets. */
  function markToMarket() {
    const p = paperState();
    const now = Date.now();
    let changed = false;
    for (const t of p.trades) {
      if (t.status !== 'open') continue;
      const m = marketByTicker(t.ticker);
      const hist = historyFor(t.ticker);
      const last = hist.length ? hist[hist.length - 1].p : null;
      let priceCents = null;
      if (m && m.price !== null) priceCents = TB.cents(m.price);
      else if (last != null) priceCents = last;
      if (priceCents == null) continue;

      /* price of the side we hold */
      const sideCents = t.side === 'yes' ? priceCents
        : (m && m.noAsk != null ? TB.cents(1 - m.yesBid) : 100 - priceCents);
      t.peak = Math.max(t.peak || 0, sideCents / 100);
      t.trough = Math.min(t.trough || 1, sideCents / 100);
      if (t.marks.length < 400) t.marks.push({ t: now, p: sideCents });

      /* settlement */
      if (m && m.status === 'finalized' && (m.result === 'yes' || m.result === 'no')) {
        const payout = (m.result === 'yes') === (t.side === 'yes') ? 1 : 0;
        closeTrade(p, t, payout, 'settled ' + m.result.toUpperCase(), m.settlementTs || now);
        changed = true;
        continue;
      }
      /* strategy exits */
      const s = strategyById(t.strategy) || {};
      const entryC = t.entryCents;
      if (s.stopCents && sideCents - entryC <= -s.stopCents) { closeTrade(p, t, sideCents / 100, 'stop −' + s.stopCents + '¢', now); changed = true; continue; }
      if (s.targetCents && sideCents - entryC >= s.targetCents) { closeTrade(p, t, Math.min(0.99, sideCents / 100), 'target +' + s.targetCents + '¢', now); changed = true; continue; }
      /* closed but not settled yet: exit at last price so cash is free */
      if (m && m.status === 'closed') { closeTrade(p, t, sideCents / 100, 'market closed — exited at last price', now); changed = true; }
    }
    if (changed) savePaper(p);
    return p;
  }

  function closeTrade(p, t, exitPrice, why, when) {
    const px = Math.max(0, Math.min(1, exitPrice));
    const proceeds = Math.round(px * t.qty * 10000) / 10000;
    const exitFee = feeFor(t.qty, px);
    const pnl = Math.round((proceeds - t.entry * t.qty - t.fee - exitFee) * 10000) / 10000;
    t.status = 'closed';
    t.closedAt = when || Date.now();
    t.exit = px;
    t.exitCents = Math.round(px * 100);
    t.exitFee = exitFee;
    t.pnl = pnl;
    t.why = why;
    t.returnPct = t.entry * t.qty > 0 ? pnl / (t.entry * t.qty) : null;
    p.cash = Math.round((p.cash + proceeds - exitFee) * 10000) / 10000;
  }

  /** Auto-run every strategy on a new alert (respecting the toggle). */
  function autoTrade(alertsNew) {
    const p = paperState();
    if (!p.auto) return [];
    const opened = [];
    for (const a of alertsNew) {
      for (const s of STRATEGIES) {
        if (!s.requiresAlert) continue;
        const m = marketByTicker(a.ticker);
        const w = strategyWants(s, a, m);
        if (!w.enter) continue;
        const dup = p.trades.find(t => t.ticker === a.ticker && t.strategy === s.id && t.status === 'open');
        if (dup) continue;
        const side = s.useScore ? (a.score && a.score.side) || 'yes' : 'yes';
        const r = openTrade({ strategyId: s.id, alert: a, market: m, side, qty: s.qty });
        if (r.ok) opened.push(r.trade);
      }
    }
    return opened;
  }

  /** Run resolution-carry entries from the current live market list. */
  function carryScan() {
    const p = paperState();
    if (!p.auto) return [];
    const s = strategyById('S4-resolution-carry');
    const opened = [];
    const now = Date.now();
    for (const m of state.markets) {
      if (m.status !== 'active' || m.price === null) continue;
      if (m.price < 0.85) continue;
      if ((m.volume24h || 0) < s.minVolume24h) continue;
      if (m.spread !== null && m.spread > s.maxSpread) continue;
      const close = m.closeTime ? new Date(m.closeTime).getTime() : NaN;
      if (!Number.isFinite(close) || close - now > 72 * 3600e3 || close < now) continue;
      if (p.trades.find(t => t.ticker === m.ticker && t.strategy === s.id && t.status === 'open')) continue;
      const r = openTrade({ strategyId: s.id, market: m, side: 'yes', qty: s.qty, price: m.yesAsk != null ? m.yesAsk : m.price });
      if (r.ok) opened.push(r.trade);
    }
    return opened;
  }

  /** Portfolio snapshot: cash, open mark value, P&L, win rate, per-strategy stats. */
  function portfolio() {
    const p = markToMarket();
    const open = p.trades.filter(t => t.status === 'open');
    const closed = p.trades.filter(t => t.status === 'closed');
    let openValue = 0, openCost = 0, unreal = 0;
    for (const t of open) {
      const m = marketByTicker(t.ticker);
      const hist = historyFor(t.ticker);
      const priceCents = m && m.price !== null ? TB.cents(m.price) : (hist.length ? hist[hist.length - 1].p : t.entryCents);
      const sideCents = t.side === 'yes' ? priceCents : (100 - priceCents);
      const v = Math.max(0, Math.min(1, sideCents / 100)) * t.qty;
      openValue += v;
      openCost += t.entry * t.qty;
      t.mark = Math.round(v * 10000) / 10000;
      t.markCents = Math.round(sideCents * 100) / 100;
      t.upnl = Math.round((v - t.entry * t.qty - t.fee) * 10000) / 10000;
      unreal += t.upnl;
    }
    const realized = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = closed.filter(t => (t.pnl || 0) > 0);
    const equity = Math.round((p.cash + openValue) * 10000) / 10000;
    const byStrategy = STRATEGIES.map(s => {
      const list = closed.filter(t => t.strategy === s.id);
      const openN = open.filter(t => t.strategy === s.id).length;
      const pnl = list.reduce((a, t) => a + (t.pnl || 0), 0);
      const invested = list.reduce((a, t) => a + t.entry * t.qty, 0);
      const w = list.filter(t => (t.pnl || 0) > 0).length;
      const avgRet = list.length ? list.reduce((a, t) => a + (t.returnPct || 0), 0) / list.length : null;
      return {
        id: s.id, name: s.name, tag: s.tag, thesis: s.thesis, entry: s.entry, exit: s.exit,
        closed: list.length, open: openN, pnl: Math.round(pnl * 100) / 100, wins: w,
        winRate: list.length ? w / list.length : null,
        roi: invested > 0 ? pnl / invested : null, avgReturn: avgRet
      };
    });
    const byTopic = TOPICS.map(t => {
      const list = closed.filter(x => x.topic === t.id);
      return {
        id: t.id, name: t.name, closed: list.length, pnl: Math.round(list.reduce((a, x) => a + (x.pnl || 0), 0) * 100) / 100,
        wins: list.filter(x => (x.pnl || 0) > 0).length
      };
    });
    const bySide = ['yes', 'no'].map(side => {
      const list = closed.filter(x => x.side === side);
      return { side, closed: list.length, pnl: Math.round(list.reduce((a, x) => a + (x.pnl || 0), 0) * 100) / 100, wins: list.filter(x => (x.pnl || 0) > 0).length };
    });
    const byPriceBucket = [
      { label: '1¢–15¢ (tail)', min: 0, max: 15 },
      { label: '15¢–40¢', min: 15, max: 40 },
      { label: '40¢–60¢ (coin flip)', min: 40, max: 60 },
      { label: '60¢–85¢', min: 60, max: 85 },
      { label: '85¢–99¢ (carry)', min: 85, max: 100 }
    ].map(b => {
      const list = closed.filter(t => t.entryCents >= b.min && t.entryCents < b.max);
      return {
        label: b.label, closed: list.length,
        pnl: Math.round(list.reduce((a, t) => a + (t.pnl || 0), 0) * 100) / 100,
        wins: list.filter(t => (t.pnl || 0) > 0).length
      };
    });
    return {
      paper: p, cash: p.cash, startCash: p.startCash, openCount: open.length, closedCount: closed.length,
      openValue: Math.round(openValue * 100) / 100, openCost: Math.round(openCost * 100) / 100,
      unrealized: Math.round(unreal * 100) / 100, realized: Math.round(realized * 100) / 100,
      equity, totalPnl: Math.round((equity - p.startCash) * 10000) / 10000,
      totalReturn: equity / p.startCash - 1,
      winRate: closed.length ? wins.length / closed.length : null,
      wins: wins.length, losses: closed.length - wins.length,
      avgWin: wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : null,
      avgLoss: (closed.length - wins.length) ? closed.filter(t => (t.pnl || 0) <= 0).reduce((a, t) => a + t.pnl, 0) / (closed.length - wins.length) : null,
      byStrategy, byTopic, bySide, byPriceBucket,
      open: open.slice().sort((a, b) => b.openedAt - a.openedAt),
      closed: closed.slice().sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0))
    };
  }

  /* ---------------------------------------------------------------- exports */
  return {
    state, SCREEN, STRATEGIES, strategyById, loadFallback,
    loadSeriesMap, loadEvents, refresh, computeStats,
    rankEvents, marketsForTopic, marketByTicker, historyFor,
    alerts, addAlerts, saveAlerts, recordAndDetect, scoreCandidate, takerFeePerContract,
    paperState, savePaper, resetPaper, openTrade, markToMarket, autoTrade, carryScan,
    strategyWants, portfolio, feeFor, START_CASH
  };
})();
