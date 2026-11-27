/* Tradebot2 data and PAPER broker. Official fields only; calculations and model
   assumptions are labelled. REST is a sampled read, NOT an exchange tick tape.
   Sources: docs.kalshi.com/api-reference/market/{get-markets,get-market,
   get-market-candlesticks,get-market-orderbook}, getting_started/market_lifecycle,
   and kalshi.com/docs/kalshi-fee-schedule.pdf (checked 2026-11-27). */
'use strict';
var TBData = (() => {
  const { num, api, normMarket, TOPICS, store } = TB;
  const CAP = { historyTickers: 600, historyPoints: 720, alerts: 600, quoteBatch: 60 };
  const key = name => 'tb.v2.' + api.getEnv() + '.' + name;
  const state = {
    snapshotTs: null, seriesByTopic: {}, seriesIndex: {}, events: [], markets: [],
    truncated: [], errors: [], loadedEnv: null, stats: null, fallback: null,
    coverage: null, freshCount: 0, selectedCount: 0, partial: false, capture: null
  };
  let seed = [], resolutionSample = [], refreshPromise = null, missingCursor = 0;
  const loadHistory = () => store.get(key('hist'), {}) || {};
  function saveHistory(h) {
    const tickers = Object.keys(h).sort((a, b) => (h[a].at || 0) - (h[b].at || 0));
    tickers.slice(0, Math.max(0, tickers.length - CAP.historyTickers)).forEach(t => delete h[t]);
    store.set(key('hist'), h);
  }
  const alerts = () => store.get(key('alerts'), []) || [];
  const saveAlerts = list => store.set(key('alerts'), list.filter(a => !a.demo).slice(0, CAP.alerts));
  function addAlerts(items) { saveAlerts(items.concat(alerts())); return items; }
  const historyFor = ticker => (loadHistory()[ticker] || {}).pts || [];
  const marketByTicker = ticker => state.markets.find(m => m.ticker === ticker) || null;
  const marketsForTopic = topic => state.markets.filter(m => m.topic === topic);
  const isQuoteFresh = m => !!m && !m.fallback && !state.fallback && m.observedAt != null
    && Date.now() - m.observedAt <= Math.max(90000, TB.settings().pollSeconds * 2000)
    && m.observedAt <= Date.now() + 5000;

  function withContext(raw, ctx, observedAt, fallback, sourceUrl) {
    const m = normMarket(raw, { topic: ctx.topic, seriesTicker: ctx.seriesTicker || ctx.series_ticker,
      observedAt, fallback, sourceUrl: sourceUrl || ctx.sourceUrl || ctx.source_url });
    m.eventTitle = ctx.eventTitle || ctx.event_title || null;
    m.eventSubTitle = ctx.eventSubTitle || null;
    m.eventSettlementSources = ctx.eventSettlementSources || ctx.settlement_sources || [];
    m.capturedCandles = ctx.capturedCandles || ctx.candles || {};
    m.scalar = raw.market_type === 'scalar';
    return m;
  }
  function rebuildEvents() {
    const groups = new Map();
    for (const m of state.markets) {
      if (!m.eventTicker) continue;
      if (!groups.has(m.eventTicker)) groups.set(m.eventTicker, { eventTicker: m.eventTicker,
        seriesTicker: m.seriesTicker, topic: m.topic, title: m.eventTitle,
        settlementSources: m.eventSettlementSources, raw: { markets: [] } });
      groups.get(m.eventTicker).raw.markets.push(m.raw);
    }
    state.events = [...groups.values()];
  }
  function indexCaptureSeries(markets) {
    state.seriesByTopic = {}; state.seriesIndex = {};
    for (const m of markets) {
      if (!m.seriesTicker || state.seriesIndex[m.seriesTicker]) continue;
      const s = { ticker: m.seriesTicker, title: null, volume: null, frequency: null,
        settlementSources: m.eventSettlementSources || [], contractTermsUrl: null };
      (state.seriesByTopic[m.topic] ||= []).push(s);
      state.seriesIndex[s.ticker] = { topic: m.topic, series: s };
    }
  }

  async function loadFallback() {
    // The capture is DEMO only. Never put it under a production label.
    if (api.getEnv() !== 'demo') return null;
    try {
      const res = await fetch(TB.pageUrl('data/fallback-snapshot.json'), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.schema_version !== 2 || data.environment !== 'demo') throw new Error('unsupported capture schema/environment');
      const normalize = r => {
        const u = new URL(r.source_url);
        if (!['external-api.demo.kalshi.co', 'demo-api.kalshi.co'].includes(u.host)
          || u.protocol !== 'https:' || u.pathname !== '/trade-api/v2/markets/' + encodeURIComponent(r.ticker)) {
          throw new Error('non-official or mismatched capture source');
        }
        return withContext(r, r, Date.parse(r.observed_at || data.snapshotTs), true, r.source_url);
      };
      seed = (data.markets || []).map(normalize);
      resolutionSample = (data.resolutions || []).map(normalize);
      state.capture = data; state.coverage = data.coverage;
      state.fallback = { at: data.snapshotTs, source: data.source, note: data._README };
      state.markets = seed.concat(resolutionSample);
      state.selectedCount = seed.length;
      state.freshCount = 0;
      state.snapshotTs = Date.parse(data.snapshotTs);
      indexCaptureSeries(seed);
      rebuildEvents(); state.stats = computeStats();
      return state.fallback;
    } catch (e) { state.errors.push('Fallback snapshot unavailable: ' + e.message); return null; }
  }

  /* Discovery is only a recovery path if there is no published cohort. Its page
     cap is disclosed. Normal browsing polls the selected tickers directly so a
     large crypto listing cannot hide gas, elections, culture or golf. */
  async function loadSeriesMap(topics) {
    for (const t of topics || TOPICS) {
      try {
        const r = await api.series(t.filter);
        const list = (r.series || []).filter(s => t.id !== 'gas' || /gasoline|gas prices|\bAAA\b/i.test(s.title || ''));
        state.seriesByTopic[t.id] = list.map(s => ({ ticker: s.ticker, title: s.title, volume: num(s.volume_fp),
          frequency: s.frequency, settlementSources: s.settlement_sources || [],
          contractTermsUrl: s.contract_terms_url || null }));
        for (const s of state.seriesByTopic[t.id]) state.seriesIndex[s.ticker] = { topic: t.id, series: s };
      } catch (e) { state.errors.push(`Series list for ${t.name}: ${e.message}`); }
    }
    return state.seriesByTopic;
  }
  async function loadEvents(opts) {
    const o = Object.assign({ statuses: ['open', 'closed'], maxPages: 5, limit: 200 }, opts);
    const found = new Map();
    for (const status of o.statuses) {
      let cursor = '', pages = 0;
      const seen = new Set();
      do {
        try {
          const r = await api.events({ status, with_nested_markets: true, limit: o.limit, cursor });
          for (const ev of r.events || []) {
            const idx = state.seriesIndex[ev.series_ticker];
            if (!idx) continue;
            for (const raw of ev.markets || []) {
              if (raw.market_type === 'scalar' || /^KXMVE/.test(raw.ticker)) continue;
              found.set(raw.ticker, withContext(raw, { topic: idx.topic, seriesTicker: ev.series_ticker,
                eventTitle: ev.title, eventSettlementSources: ev.settlement_sources || idx.series.settlementSources }, Date.now(), false));
            }
          }
          cursor = r.cursor || ''; pages++;
          if (cursor && (seen.has(cursor) || pages >= o.maxPages)) {
            state.truncated.push(`Discovery stopped after ${pages} ${status} pages; not exchange-wide coverage.`); break;
          }
          seen.add(cursor);
        } catch (e) { state.errors.push(`Events (${status}): ${e.message}`); break; }
      } while (cursor);
    }
    state.markets = [...found.values()]; rebuildEvents();
    return { events: state.events, markets: state.markets };
  }

  function savedTracked() {
    return (store.get(key('tracked'), []) || []).map(r => withContext(r.raw, r, r.observedAt, false, r.sourceUrl));
  }
  function saveTracked() {
    // Unresolved records are never evicted merely for dropping out of the top
    // volume selection. Finalized results are retained as a bounded audit log.
    const records = state.markets.filter(m => !m.fallback);
    const unresolved = records.filter(m => m.status !== 'finalized');
    const done = records.filter(m => m.status === 'finalized').slice(-200);
    store.set(key('tracked'), unresolved.concat(done).map(m => ({ raw: m.raw, topic: m.topic,
      seriesTicker: m.seriesTicker, eventTitle: m.eventTitle, eventSettlementSources: m.eventSettlementSources,
      observedAt: m.observedAt, sourceUrl: m.sourceUrl })));
  }
  async function fetchSingle(ticker) {
    let path = `/markets/${encodeURIComponent(ticker)}`;
    try { return { raw: (await api.get(path, null, { ttl: 0 })).market, source: api.url(path) }; }
    catch (e) {
      if (!/HTTP 404\b/.test(e.message)) throw e;
      path = `/historical/markets/${encodeURIComponent(ticker)}`;
      return { raw: (await api.get(path, null, { ttl: 0 })).market, source: api.url(path) };
    }
  }
  async function refreshCohort() {
    const tracked = savedTracked();
    const cohort = new Map(seed.map(m => [m.ticker, m]));
    for (const m of tracked) if (m.status !== 'finalized' || !cohort.has(m.ticker)) cohort.set(m.ticker, m);
    const wanted = [...cohort.values()].filter(m => m.status !== 'finalized');
    // Include any open paper position even if it is not in today's top cohort.
    for (const t of paperState().trades.filter(t => t.status === 'open')) {
      if (!cohort.has(t.ticker)) {
        const context = { ticker: t.ticker, topic: t.topic, seriesTicker: t.seriesTicker, eventTitle: t.eventTitle };
        const m = withContext({ ticker: t.ticker }, context, null, true);
        cohort.set(t.ticker, m); wanted.push(m);
      }
    }
    const got = new Set();
    for (let i = 0; i < wanted.length; i += CAP.quoteBatch) {
      const batch = wanted.slice(i, i + CAP.quoteBatch);
      const batchSet = new Set(batch.map(m => m.ticker));
      try {
        const r = await api.markets([...batchSet]);
        if (!Array.isArray(r.markets)) throw new Error('missing markets array');
        for (const raw of r.markets) {
          if (!batchSet.has(raw.ticker)) continue;
          const ctx = cohort.get(raw.ticker);
          if (ctx.eventTicker && raw.event_ticker !== ctx.eventTicker) continue;
          cohort.set(raw.ticker, withContext(raw, ctx, Date.now(), false, api.url(`/markets/${encodeURIComponent(raw.ticker)}`)));
          got.add(raw.ticker);
        }
      } catch (e) { state.errors.push('Selected quote batch: ' + e.message); }
    }
    // Missing listings rotate fairly; no "first 8 forever" starvation.
    const missing = wanted.filter(m => !got.has(m.ticker));
    if (missing.length && !state.errors.length) {
      for (let n = 0; n < Math.min(8, missing.length); n++) {
        const m = missing[(missingCursor + n) % missing.length];
        try {
          const r = await fetchSingle(m.ticker);
          if (!r.raw || r.raw.ticker !== m.ticker) continue;
          cohort.set(m.ticker, withContext(r.raw, m, Date.now(), false, r.source)); got.add(m.ticker);
        } catch (e) { state.errors.push(m.ticker + ': ' + e.message); }
      }
      missingCursor = (missingCursor + Math.min(8, missing.length)) % missing.length;
    }
    state.markets = [...new Map(resolutionSample.concat([...cohort.values()]).map(m => [m.ticker, m])).values()];
    state.freshCount = got.size; state.selectedCount = wanted.length;
    state.partial = got.size < wanted.length;
    if (state.partial) state.truncated.push(`${got.size}/${wanted.length} watched quotes re-read this cycle; the rest retain their original timestamps. Missing listings are rechecked, not treated as resolved.`);
    if (got.size) {
      state.fallback = null; state.snapshotTs = Date.now(); saveTracked();
    } else {
      state.fallback = { at: state.capture && state.capture.snapshotTs, source: state.capture && state.capture.source };
      state.snapshotTs = state.capture ? Date.parse(state.capture.snapshotTs) : null;
      state.errors.push('Live API unreachable — showing the verified snapshot or last successful reads at their original times. Alerts and paper trading are paused in this mode.');
    }
    rebuildEvents();
  }
  async function doRefresh(opts) {
    const o = opts || {};
    if (state.loadedEnv !== api.getEnv()) {
      seed = []; resolutionSample = []; state.markets = []; state.seriesIndex = {}; state.seriesByTopic = {};
      state.capture = null; state.coverage = null; state.loadedEnv = api.getEnv();
    }
    state.errors = []; state.truncated = []; state.partial = false;
    if (!state.capture && api.getEnv() === 'demo') await loadFallback();
    if (o.fallback) return { snapshotTs: state.snapshotTs, swings: [], stats: state.stats, fallback: true };
    if (seed.length || savedTracked().length) await refreshCohort();
    else {
      state.fallback = null;
      if (!Object.keys(state.seriesIndex).length) await loadSeriesMap();
      await loadEvents(o.events);
      state.freshCount = state.markets.length; state.selectedCount = state.markets.length;
      state.snapshotTs = state.freshCount ? Date.now() : null;
      if (!state.freshCount) state.errors.push('No verified live markets available. Values remain blank.');
      state.partial = true;
      saveTracked();
    }
    state.truncated.unshift(state.coverage && state.coverage.note || 'Selected/discovered markets only, not an exhaustive exchange ranking.');
    const swings = state.freshCount ? recordAndDetect() : [];
    state.stats = computeStats();
    if (!state.fallback) { markToMarket(); autoTrade(swings); carryScan(); }
    return { snapshotTs: state.snapshotTs, swings, stats: state.stats, fallback: !!state.fallback };
  }
  function refresh(opts) {
    if (!refreshPromise) refreshPromise = doRefresh(opts).finally(() => { refreshPromise = null; });
    return refreshPromise;
  }
  async function refreshOne(ticker) {
    const ctx = marketByTicker(ticker);
    if (!ctx || state.fallback) return null;
    const r = await fetchSingle(ticker);
    if (!r.raw || r.raw.ticker !== ticker) throw new Error('market identity missing');
    const m = withContext(r.raw, ctx, Date.now(), false, r.source);
    state.markets = state.markets.map(x => x.ticker === ticker ? m : x);
    const swings = recordAndDetect(); autoTrade(swings); markToMarket(); saveTracked();
    return m;
  }

  function recordAndDetect() {
    const h = loadHistory(), found = [];
    for (const m of state.markets) {
      if (!isQuoteFresh(m) || m.price === null || !Number.isFinite(m.price) || m.price < 0 || m.price > 1) continue;
      const at = m.observedAt, priceCents = TB.cents(m.price);
      const prev = h[m.ticker], last = prev && prev.pts[prev.pts.length - 1];
      if (last && at <= last.t) continue;
      const point = { t: at, p: priceCents, kind: m.priceKind, b: TB.cents(m.yesBid), a: TB.cents(m.yesAsk) };
      const baseline = !last || last.kind !== m.priceKind;
      h[m.ticker] = { at, topic: m.topic, title: m.title, series: m.seriesTicker,
        pts: (baseline ? [] : prev.pts).concat(point).slice(-CAP.historyPoints) };
      if (baseline) continue;
      const delta = Math.round((priceCents - last.p) * 100) / 100;
      if (Math.abs(delta) >= TB.ALERT_THRESHOLD * 100 && m.status === 'active') {
        found.push({ id: m.ticker + '@' + at, at, fromTs: last.t, ticker: m.ticker,
          topic: m.topic, title: m.title, eventTicker: m.eventTicker, seriesTicker: m.seriesTicker,
          from: last.p, to: priceCents, delta, bid: point.b, ask: point.a, spread: m.spread,
          volume24h: m.volume24h, oi: m.oi, priceKind: m.priceKind, closeTime: m.closeTime,
          sourceUrl: m.sourceUrl, score: scoreCandidate(m, delta) });
      }
    }
    saveHistory(h);
    const existing = new Set(alerts().map(a => a.id));
    const fresh = found.filter(a => !existing.has(a.id)); addAlerts(fresh); return fresh;
  }

  /* This screen is a testable hypothesis, NOT a probability or predicted ROI.
     Costs use a disclosed general-fee M=1 scenario, not a verified account fee.
     Event/series fee overrides and execution uncertainty remain F-09. */
  const SCREEN = { K: 0.5, minScore: 0.02, maxSpread: 0.05, minAskSize: 20, minVolume24h: 20, minOI: 1, pMin: 0.05, pMax: 0.95 };
  function feeFor(qty, price, multiplier = 1) {
    const cost = qty * price, fee = multiplier * 0.07 * qty * price * (1 - price);
    return Math.max(0, Math.round((Math.ceil((cost + fee) * 10000 - 1e-8) / 10000 - cost) * 1e8) / 1e8);
  }
  const takerFeePerContract = p => feeFor(1, p);
  function scoreCandidate(m, deltaCents) {
    const p = num(m.price), reasons = [];
    if (p === null) return { pass: false, score: null, reasons: ['no price'] };
    const target = p - SCREEN.K * deltaCents / 100;
    const side = target > p ? 'yes' : 'no';
    const entry = side === 'yes' ? m.yesAsk : m.noAsk;
    const targetSide = side === 'yes' ? target : 1 - target;
    const size = side === 'yes' ? m.yesAskSize : m.yesBidSize;
    const grossEdge = entry == null ? null : targetSide - entry;
    const fee = entry == null ? null : (feeFor(10, entry) + feeFor(10, targetSide)) / 10;
    const score = grossEdge == null ? null : grossEdge - fee;
    if (p < SCREEN.pMin || p > SCREEN.pMax) reasons.push('price outside 5¢–95¢');
    if (m.spread == null || m.spread < 0 || m.spread > SCREEN.maxSpread) reasons.push('missing, crossed or wide book');
    if (entry == null || !(entry > 0 && entry < 1)) reasons.push('no executable side ask');
    if (size == null || size < SCREEN.minAskSize) reasons.push('unknown/thin entry-side size');
    if (m.volume24h == null || m.volume24h < SCREEN.minVolume24h) reasons.push('low/unknown 24h volume');
    if (m.oi == null || m.oi < SCREEN.minOI) reasons.push('low/unknown open interest');
    if (score == null || score < SCREEN.minScore) reasons.push('scenario edge below 2¢ after entry and exit fees');
    if (target < 0 || target > 1) reasons.push('target out of range');
    return { pass: !reasons.length, side, score, grossEdge, cost: fee, target, entry, fee,
      reasons, spread: m.spread, assumption: '50% retrace; general taker fee M=1; not expected ROI' };
  }

  const sumKnown = (rows, fn) => rows.some(m => fn(m) === null) ? null : rows.reduce((s, m) => s + fn(m), 0);
  const face = (m, period) => m[period] == null || m.notional == null ? null : m[period] * m.notional;
  function computeStats() {
    const mk = state.markets, live = mk.filter(TB.isLive);
    const byTopic = TOPICS.map(t => {
      const all = mk.filter(m => m.topic === t.id), l = all.filter(TB.isLive);
      return { id: t.id, name: t.name, icon: t.icon, live: l.length, markets: all.length,
        events: new Set(all.map(m => m.eventTicker)).size,
        notional: sumKnown(l, m => face(m, 'volume')), vol24: sumKnown(l, m => face(m, 'volume24h')),
        contracts24: sumKnown(l, m => m.volume24h), resolved: all.filter(m => /^(yes|no)$/.test(m.result)).length };
    });
    return { markets: mk.length, live: live.length, events: state.events.length,
      settled: mk.filter(TB.isSettled).length, resolved: mk.filter(m => /^(yes|no)$/.test(m.result)).length,
      notional: sumKnown(live, m => face(m, 'volume')), vol24: sumKnown(live, m => face(m, 'volume24h')),
      contracts24: sumKnown(live, m => m.volume24h), byTopic };
  }
  function rankEvents(limit) {
    const groups = new Map();
    for (const m of state.markets) {
      if (!m.eventTicker) continue;
      if (!groups.has(m.eventTicker)) groups.set(m.eventTicker, { eventTicker: m.eventTicker,
        seriesTicker: m.seriesTicker, topic: m.topic, title: m.eventTitle,
        markets: [], settlementSources: m.eventSettlementSources || [] });
      groups.get(m.eventTicker).markets.push(m);
    }
    const rows = [...groups.values()].map(g => {
      const live = g.markets.filter(TB.isLive), measured = live.length ? live : g.markets;
      const resolved = g.markets.filter(m => /^(yes|no)$/.test(m.result));
      const pending = g.markets.filter(m => m.status !== 'finalized' && !TB.isLive(m));
      return Object.assign(g, { liveCount: live.length, marketCount: g.markets.length,
        notionalTotal: sumKnown(measured, m => face(m, 'volume')),
        vol24: sumKnown(measured, m => face(m, 'volume24h')),
        contracts24: sumKnown(measured, m => m.volume24h), resolved, pending,
        topMarket: live.slice().sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))[0] || null,
        state: live.length ? 'LIVE' : resolved.length === g.markets.length ? 'RESOLVED' : 'AWAITING RESULT' });
    });
    // A consistent basis for the whole ranking, never mixing USD and contracts.
    const ranked = rows.filter(r => r.state === 'LIVE');
    const useFace = ranked.length > 0 && ranked.every(r => r.vol24 !== null);
    state.rankBasis = useFace ? '24h face notional (contracts × reported settlement face value), not cash traded' : '24h contracts (face values missing; dollar rank unverified)';
    rows.sort((a, b) => ((useFace ? b.vol24 : b.contracts24) ?? -1) - ((useFace ? a.vol24 : a.contracts24) ?? -1));
    return { rows: limit ? rows.slice(0, limit) : rows, all: rows, basis: state.rankBasis };
  }

  async function chartSeries(m, spanSeconds, interval = 1) {
    const end = state.fallback ? m.observedAt : Date.now();
    const start = end - spanSeconds * 1000;
    const iv = spanSeconds / 60 / interval > 5000 ? 60 : interval;
    let points = [], message = '';
    if (spanSeconds > 60 && m.priceKind !== 'mid') {
      if (state.fallback) {
        points = (m.capturedCandles[iv === 60 ? '1h' : '1m'] || []).map(c => ({ t: c[0] * 1000, p: TB.cents(c[1]), v: num(c[4]) }));
      } else {
        try {
          const r = await api.candlesticks(m.seriesTicker, m.ticker, iv, Math.floor(start / 1000), Math.floor(end / 1000));
          points = (r.candlesticks || []).map(c => ({ t: c.end_period_ts * 1000,
            p: TB.cents(c.price && c.price.close_dollars), v: num(c.volume_fp) }));
        } catch (e) { message = 'Candles unavailable: ' + e.message + '. '; }
      }
    }
    // Never splice a midpoint into a last-trade line. Never place a dated quote
    // at Date.now(). Observations retain the time of the actual REST read.
    points.push(...historyFor(m.ticker).filter(h => h.kind === m.priceKind));
    if (m.observedAt != null && m.price != null) points.push({ t: m.observedAt, p: TB.cents(m.price) });
    const byTime = new Map(points.filter(p => Number.isFinite(p.t) && Number.isFinite(p.p) && p.t >= start && p.t <= end).map(p => [p.t, p]));
    points = [...byTime.values()].sort((a, b) => a.t - b.t);
    return { points, start, end, interval: iv,
      label: `${m.ticker} · ${m.priceKind === 'mid' ? 'observed bid/ask mid' : 'last-trade observations / candle closes'}`,
      note: message + (state.fallback ? 'Dated capture — not live. ' : '') +
        (spanSeconds <= 60 ? '5-second REST samples while this page is open; no second-by-second tape. ' : `${iv}-minute candles plus compatible REST observations. `) +
        'Missing periods are not interpolated into trades.' };
  }

  /* PAPER broker, v2. Default auto applies ONLY to simulation in this browser.
     No POST/order call exists here. Old ledgers are not imported as verified. */
  const START_CASH = 10000;
  const STRATEGIES = [
    { id: 'S1-momentum', name: 'Momentum breakout', tag: 'Trend', thesis: 'Hypothesis: a ≥10¢ move continues.',
      entry: 'Buy YES after up-moves, NO after down-moves; volume ≥50, spread ≤5¢.', exit: 'Target +8¢, stop −6¢, otherwise finalized settlement.',
      targetCents: 8, stopCents: 6, qty: 10, minVolume24h: 50, maxSpread: 0.05, requiresAlert: true },
    { id: 'S2-reversion', name: 'Reversion fade', tag: 'Mean reversion', thesis: 'Hypothesis: a move retraces 50%. Not a forecast.',
      entry: 'Entry-side depth ≥20 and scenario edge ≥2¢ after both fees.', exit: 'Target +6¢, stop −8¢, otherwise finalized settlement.',
      targetCents: 6, stopCents: 8, qty: 10, minVolume24h: 20, maxSpread: 0.05, requiresAlert: true, useScore: true },
    { id: 'S3-cheap-tail', name: 'Cheap tail', tag: 'Convexity', thesis: 'Hypothesis: upward cheap-tail repricings persist.',
      entry: 'Upward ≥10¢ alert, YES ≤15¢, volume ≥20, spread ≤5¢.', exit: 'Stop −5¢ or finalized settlement.',
      targetCents: 0, stopCents: 5, qty: 25, minVolume24h: 20, maxSpread: 0.05, requiresAlert: true, maxPrice: 0.15 },
    { id: 'S4-resolution-carry', name: 'Resolution carry', tag: 'Carry', thesis: 'Hypothesis: near-expiry favorites compensate for tail risk.',
      entry: 'YES ask ≥85¢; closes in ≤72h; volume ≥10; spread ≤8¢.', exit: 'Wait for finalized settlement; never exit simply because trading closed.',
      targetCents: 0, stopCents: 0, qty: 20, minVolume24h: 10, maxSpread: 0.08, requiresAlert: false }
  ];
  const strategyById = id => STRATEGIES.find(s => s.id === id) || null;
  function paperState() { return store.get(key('paper'), { version: 2, cash: START_CASH, startCash: START_CASH,
    trades: [], created: Date.now(), auto: true, equityHistory: [] }); }
  function savePaper(p) { store.set(key('paper'), p); return p; }
  function resetPaper() { store.del(key('paper')); return paperState(); }
  function strategyWants(s, alert, m) {
    if (!alert || alert.demo || !isQuoteFresh(m) || m.status !== 'active') return { enter: false, reason: 'needs a fresh real observation' };
    if (Math.abs(alert.delta) < 10 || Date.now() - alert.at > 120000) return { enter: false, reason: 'not a new ≥10¢ alert' };
    if (m.volume24h == null || m.volume24h < s.minVolume24h || m.spread == null || m.spread < 0 || m.spread > s.maxSpread) return { enter: false, reason: 'missing or insufficient tradability' };
    if (s.maxPrice && (m.price > s.maxPrice || alert.delta <= 0)) return { enter: false, reason: 'not an upward cheap-tail move' };
    if (s.useScore && !(alert.score && alert.score.pass)) return { enter: false, reason: 'fails the scenario screen' };
    return { enter: true, reason: s.thesis };
  }
  function openTrade({ strategyId, alert, market, side = 'yes', qty, price, note }) {
    const p = paperState(), s = strategyById(strategyId), q = num(qty == null ? s && s.qty : qty);
    if (api.getEnv() !== 'demo' || !isQuoteFresh(market) || market.status !== 'active') return { ok: false, error: 'Paper fills require a fresh active DEMO quote; snapshot/closed/paused markets cannot fill.' };
    if (market.closeTime && Date.parse(market.closeTime) <= Date.now()) return { ok: false, error: 'Passed close time; no simulated execution while status catches up.' };
    if (market.marketType !== 'binary' || market.notional !== 1) return { ok: false, error: 'Binary $1 face value must be confirmed by the API.' };
    if (!['yes', 'no'].includes(side) || q === null || q <= 0 || !Number.isInteger(q)) return { ok: false, error: 'Use a positive integer quantity and YES/NO side.' };
    const px = side === 'yes' ? market.yesAsk : market.noAsk;
    const available = side === 'yes' ? market.yesAskSize : market.yesBidSize;
    if (!(px > 0 && px < 1) || market.spread == null || market.spread < 0 || (price != null && price !== px)) return { ok: false, error: 'No verified executable side ask (last price is not a fill).' };
    if (available == null || available < q) return { ok: false, error: 'Unknown/insufficient visible entry-side depth; no fill invented.' };
    const opens = p.trades.filter(t => t.status === 'open');
    if (opens.length >= 10 || q * px > 100 || opens.some(t => t.strategy === strategyId && t.ticker === market.ticker)) return { ok: false, error: 'Simulation risk/duplicate-position limit.' };
    if (alert && p.trades.some(t => t.signalId === alert.id && t.strategy === strategyId)) return { ok: false, error: 'Signal already simulated.' };
    const fee = feeFor(q, px), cost = px * q;
    if (p.cash < cost + fee) return { ok: false, error: 'Insufficient simulated cash.' };
    const trade = { id: 'SIM-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      openedAt: Date.now(), quoteAt: market.observedAt, strategy: strategyId || 'manual', signalId: alert && alert.id,
      ticker: market.ticker, topic: market.topic, title: market.title, seriesTicker: market.seriesTicker,
      eventTitle: market.eventTitle, side, qty: q, entry: px, entryCents: TB.cents(px), fee,
      status: 'open', note: note || 'Paper only; M=1 general fee scenario; visible top size cap; no queue/slippage model.',
      sourceUrl: market.sourceUrl, closeTime: market.closeTime, marks: [] };
    p.trades.unshift(trade); p.cash = Math.round((p.cash - cost - fee) * 1e4) / 1e4; savePaper(p);
    return { ok: true, trade, paper: p };
  }
  function exitBid(m, side) { return side === 'yes' ? m.yesBid : m.noBid; }
  function closeTrade(p, t, px, why, when, settlement = false) {
    const proceeds = px * t.qty, exitFee = settlement ? 0 : feeFor(t.qty, px);
    Object.assign(t, { status: 'closed', closedAt: when, exit: px, exitCents: TB.cents(px), exitFee, why,
      pnl: Math.round((proceeds - t.entry * t.qty - t.fee - exitFee) * 1e4) / 1e4 });
    t.returnPct = t.pnl / (t.entry * t.qty + t.fee);
    p.cash = Math.round((p.cash + proceeds - exitFee) * 1e4) / 1e4;
  }
  function markToMarket() {
    const p = paperState();
    if (state.fallback) return p;
    for (const t of p.trades.filter(t => t.status === 'open')) {
      const m = marketByTicker(t.ticker);
      if (!isQuoteFresh(m)) continue;
      if (m.status === 'finalized' && /^(yes|no)$/.test(m.result)) {
        const payout = m.settlementValue != null ? m.settlementValue : (m.result === 'yes' ? 1 : 0);
        if (payout < 0 || payout > 1) continue;
        closeTrade(p, t, t.side === 'yes' ? payout : 1 - payout, 'finalized ' + m.result.toUpperCase(), Date.now(), true);
        t.settledAt = m.settlementTs; continue;
      }
      // No order execution at closed/determined/disputed/amended or paused.
      if (m.status !== 'active') continue;
      const bid = exitBid(m, t.side), size = t.side === 'yes' ? m.yesBidSize : m.yesAskSize;
      if (bid == null) continue;
      if (!t.marks.length || t.marks[t.marks.length - 1].t !== m.observedAt) {
        t.marks.push({ t: m.observedAt, p: TB.cents(bid) }); t.marks = t.marks.slice(-400);
      }
      if (size == null || size < t.qty) continue;
      const s = strategyById(t.strategy) || {}, delta = TB.cents(bid) - t.entryCents;
      if (s.stopCents && delta <= -s.stopCents) closeTrade(p, t, bid, 'stop at visible bid', Date.now());
      else if (s.targetCents && delta >= s.targetCents) closeTrade(p, t, bid, 'target at visible bid', Date.now());
    }
    return savePaper(p);
  }
  function autoTrade(items) {
    if (!paperState().auto || state.fallback) return [];
    const opened = [];
    for (const a of items) for (const s of STRATEGIES.filter(s => s.requiresAlert)) {
      const m = marketByTicker(a.ticker);
      if (!strategyWants(s, a, m).enter) continue;
      const side = s.useScore ? a.score.side : s.id === 'S1-momentum' && a.delta < 0 ? 'no' : 'yes';
      const r = openTrade({ strategyId: s.id, alert: a, market: m, side, qty: s.qty });
      if (r.ok) opened.push(r.trade);
    }
    return opened;
  }
  function carryScan() {
    if (!paperState().auto || state.fallback) return [];
    const opened = [], s = strategyById('S4-resolution-carry');
    for (const m of state.markets) {
      const close = Date.parse(m.closeTime);
      if (!isQuoteFresh(m) || m.status !== 'active' || m.yesAsk == null || m.yesAsk < 0.85 || m.volume24h < s.minVolume24h
        || m.volume24h == null || m.spread == null || m.spread < 0 || m.spread > s.maxSpread
        || !Number.isFinite(close) || close <= Date.now() || close - Date.now() > 72 * 3600e3) continue;
      const r = openTrade({ strategyId: s.id, market: m, side: 'yes', qty: s.qty });
      if (r.ok) opened.push(r.trade);
    }
    return opened;
  }
  function portfolio() {
    const p = markToMarket(), open = p.trades.filter(t => t.status === 'open'), closed = p.trades.filter(t => t.status === 'closed');
    let openValue = 0, unrealized = 0, unknown = 0;
    for (const t of open) {
      const m = marketByTicker(t.ticker), bid = m && exitBid(m, t.side);
      const known = isQuoteFresh(m) && m.status === 'active' && bid != null;
      t.markCents = known ? TB.cents(bid) : null;
      t.upnl = known ? Math.round((bid * t.qty - t.entry * t.qty - t.fee) * 1e4) / 1e4 : null;
      t.mark = known ? bid * t.qty : null;
      if (known) { openValue += t.mark; unrealized += t.upnl; } else unknown++;
    }
    const realized = closed.reduce((n, t) => n + t.pnl, 0), wins = closed.filter(t => t.pnl > 0), losses = closed.filter(t => t.pnl < 0);
    const equity = unknown ? null : Math.round((p.cash + openValue) * 1e4) / 1e4;
    if (equity !== null && (!p.equityHistory.length || Date.now() - p.equityHistory[p.equityHistory.length - 1].t >= 30000)) {
      p.equityHistory.push({ t: Date.now(), p: equity }); p.equityHistory = p.equityHistory.slice(-1000); savePaper(p);
    }
    const summary = list => ({ closed: list.length, wins: list.filter(t => t.pnl > 0).length,
      pnl: Math.round(list.reduce((n, t) => n + t.pnl, 0) * 100) / 100 });
    const byStrategy = STRATEGIES.map(s => {
      const list = closed.filter(t => t.strategy === s.id), cost = list.reduce((n, t) => n + t.entry * t.qty + t.fee, 0);
      return Object.assign({}, s, summary(list), { open: open.filter(t => t.strategy === s.id).length,
        winRate: list.length ? list.filter(t => t.pnl > 0).length / list.length : null,
        roi: cost ? list.reduce((n, t) => n + t.pnl, 0) / cost : null });
    });
    const byTopic = TOPICS.map(t => Object.assign({ id: t.id, name: t.name }, summary(closed.filter(x => x.topic === t.id))));
    const bySide = ['yes', 'no'].map(side => Object.assign({ side }, summary(closed.filter(t => t.side === side))));
    const bounds = [0, 15, 40, 60, 85, 100];
    const byPriceBucket = bounds.slice(0, -1).map((min, i) => Object.assign({ label: `${min}¢–${bounds[i + 1]}¢` },
      summary(closed.filter(t => t.entryCents >= min && t.entryCents < bounds[i + 1]))));
    return { paper: p, cash: p.cash, startCash: p.startCash, openCount: open.length, closedCount: closed.length,
      openValue: unknown ? null : openValue, openCost: open.reduce((n, t) => n + t.entry * t.qty, 0),
      unrealized: unknown ? null : unrealized, realized, equity, unknownMarks: unknown,
      totalPnl: equity === null ? null : equity - p.startCash, totalReturn: equity === null ? null : equity / p.startCash - 1,
      winRate: closed.length ? wins.length / closed.length : null, wins: wins.length, losses: losses.length,
      avgWin: wins.length ? wins.reduce((n, t) => n + t.pnl, 0) / wins.length : null,
      avgLoss: losses.length ? losses.reduce((n, t) => n + t.pnl, 0) / losses.length : null,
      byStrategy, byTopic, bySide, byPriceBucket, open, closed: closed.slice().sort((a, b) => b.closedAt - a.closedAt) };
  }
  return { state, SCREEN, STRATEGIES, strategyById, loadFallback, loadSeriesMap, loadEvents, refresh,
    refreshOne, isQuoteFresh, computeStats, rankEvents, marketsForTopic, marketByTicker, historyFor,
    alerts, saveAlerts, addAlerts, recordAndDetect, scoreCandidate, takerFeePerContract,
    paperState, savePaper, resetPaper, openTrade, markToMarket, autoTrade, carryScan, strategyWants,
    portfolio, feeFor, START_CASH, chartSeries, storageKey: key };
})();
