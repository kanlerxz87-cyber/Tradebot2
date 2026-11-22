// All financial values are USD; API fixed-point strings are parsed without coercing blanks to zero.
export const API = 'https://external-api.demo.kalshi.co/trade-api/v2';
export const TOPICS = ['Gas prices', 'Elections', 'Culture', 'Crypto', 'Golf'];
export const number = x => (typeof x === 'number' || typeof x === 'string' && x.trim() !== '') && Number.isFinite(Number(x)) ? Number(x) : null;
export const price = x => { const n = number(x); return n !== null && n >= 0 && n <= 1 ? n : null; };
export const sourceFor = ticker => `${API}/markets/${encodeURIComponent(ticker)}`;
export const isOpen = m => ['active', 'open'].includes(m.status);
// Exact official tags/categories only. No ticker/title keyword guesses.
export function topicFor(s) {
  const tags = s.tags || [], categories = s.categories || [s.category];
  if (s.product_metadata?.scope === 'Gasoline' || tags.includes('Gas prices') || tags.includes('Gas Prices')) return 'Gas prices';
  if (tags.includes('Golf')) return 'Golf';
  if (categories.includes('Elections') || tags.includes('Elections')) return 'Elections';
  if (categories.includes('Crypto')) return 'Crypto';
  if (categories.includes('Culture') || categories.includes('Entertainment')) return 'Culture';
  return null;
}
export function normalize(m, event, series, observedAt) {
  return {
    ticker: m.ticker, eventTicker: m.event_ticker || event.event_ticker, eventTitle: event.title || '',
    title: m.title || m.yes_sub_title || '', seriesTicker: series.ticker, topic: topicFor(series),
    officialCategory: series.category || '', officialTags: series.tags || [], officialScope: series.product_metadata?.scope || null,
    status: m.status || '', result: ['yes', 'no'].includes(m.result) ? m.result : null,
    last: price(m.last_price_dollars), bid: price(m.yes_bid_dollars), ask: price(m.yes_ask_dollars),
    askSize: number(m.yes_ask_size_fp), noAsk: price(m.no_ask_dollars),
    volume: number(m.volume_fp), volume24h: number(m.volume_24h_fp), openInterest: number(m.open_interest_fp),
    notional: number(m.notional_value_dollars), closeTime: m.close_time || null,
    settlement: price(m.settlement_value_dollars), updatedAt: m.updated_time || null, observedAt,
    source: sourceFor(m.ticker), seriesSource: `${API}/series/${encodeURIComponent(series.ticker)}`,
    rules: m.rules_primary || '', settlementSources: event.settlement_sources || series.settlement_sources || []
  };
}
export function exposure(m) {
  return m.openInterest !== null && m.notional !== null ? m.openInterest * m.notional : null;
}
export function groupEvents(markets) {
  const grouped = new Map();
  for (const m of markets) {
    const e = grouped.get(m.eventTicker) || { ticker: m.eventTicker, title: m.eventTitle, topic: m.topic, markets: [], dollars: 0 };
    e.markets.push(m); const value = exposure(m);
    e.dollars = e.dollars === null || value === null ? null : e.dollars + value;
    grouped.set(m.eventTicker, e);
  }
  return [...grouped.values()].sort((a,b) => (b.dollars ?? -1) - (a.dollars ?? -1));
}
export function swing(previous, current, time, maxGap = 120000) {
  if (!previous || !isOpen(current) || previous.last === null || current.last === null) return null;
  const elapsed = Date.parse(time) - Date.parse(previous.observedAt);
  if (elapsed <= 0 || elapsed > maxGap) return null;
  const delta = Math.round((current.last - previous.last) * 1e6) / 1e6;
  if (Math.abs(delta) < .10) return null;
  return {id: `${current.ticker}:${time}`, ticker: current.ticker, title: current.title, topic: current.topic,
    from: previous.last, to: current.last, delta, time, windowSeconds: elapsed / 1000,
    source: current.source, candidate: candidate(current), news: null, expectedRoi: null};
}
// A liquidity screen, NOT a probability model or a claim of positive expected return.
export function candidate(m) {
  return isOpen(m) && m.bid !== null && m.ask !== null && m.ask > 0 && m.ask < 1 &&
    m.ask >= m.bid && m.ask - m.bid <= .03 + 1e-8 && m.askSize !== null && m.askSize >= 10 &&
    m.volume24h !== null && m.volume24h >= 100;
}
export function emptyPaper() { return {version: 1, trades: [], processed: [], initialPerStrategy: 1000}; }
export function runPaper(state, markets, alerts, now) {
  const byId = new Map(markets.map(m => [m.ticker, m]));
  for (const t of state.trades.filter(t => !t.closedAt)) {
    const m = byId.get(t.ticker);
    if (m?.status === 'settled' && m.result && m.settlement !== null) {
      t.exit = t.side === 'yes' ? m.settlement : 1 - m.settlement;
      t.pnl = +(t.quantity * (t.exit - t.entry)).toFixed(6); t.closedAt = now; t.result = m.result;
    }
  }
  for (const a of alerts) {
    if (state.processed.includes(a.id)) continue;
    state.processed.push(a.id);
    const m = byId.get(a.ticker);
    if (!m || !a.candidate || Date.parse(now) - Date.parse(m.observedAt) > 30000) continue;
    for (const strategy of ['Momentum', 'Reversion']) {
      // Trade YES only to use the explicitly reported YES ask and ask size; no inferred NO depth.
      const eligible = strategy === 'Momentum' ? a.delta > 0 : a.delta < 0;
      if (!eligible || state.trades.some(t => t.ticker === m.ticker && t.strategy === strategy && !t.closedAt)) continue;
      const ledger = state.trades.filter(t => t.strategy === strategy);
      const spent = ledger.reduce((s,t) => s + t.entry*t.quantity - (t.closedAt ? t.exit*t.quantity : 0), 0);
      const quantity = Math.min(10, Math.floor(m.askSize), Math.floor(10/m.ask));
      if (quantity < 1 || spent + quantity * m.ask > state.initialPerStrategy || ledger.filter(t => !t.closedAt).length >= 20) continue;
      state.trades.push({id: `${a.id}:${strategy}`, ticker: m.ticker, title: m.title, topic: m.topic, strategy,
        side: 'yes', entry: m.ask, quantity, openedAt: now, closedAt: null, pnl: null, source: m.source,
        fees: null, execution: 'Paper assumption at observed ask; not an exchange fill'});
    }
  }
  state.processed = state.processed.slice(-5000);
  return state;
}
export function paperStats(state, markets, strategy) {
  const trades = state.trades.filter(t => !strategy || t.strategy === strategy);
  const closed = trades.filter(t => t.closedAt), open = trades.filter(t => !t.closedAt);
  const realized = closed.reduce((s,t) => s+t.pnl, 0);
  const marks = open.map(t => {const m = markets.find(m=>m.ticker===t.ticker); return m?.bid !== null && m?.bid !== undefined ? (m.bid-t.entry)*t.quantity : null;});
  return {count: trades.length, open: open.length, realized, unrealized: marks.includes(null) ? null : marks.reduce((s,v)=>s+v,0),
    winRate: closed.length ? closed.filter(t=>t.pnl>0).length/closed.length : null};
}
export function levels(book) {
  const b = book.orderbook_fp;
  if (!b) return [];
  return ['yes', 'no'].flatMap(side => (b[`${side}_dollars`] || []).map(([p,q])=>({side, price: price(p), quantity: number(q)})))
    .filter(l=>l.price !== null && l.quantity !== null).sort((a,b)=>a.side.localeCompare(b.side)||b.price-a.price);
}
