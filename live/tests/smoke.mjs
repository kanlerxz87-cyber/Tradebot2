/** Source-contract + rendered UI regression suite. NO network and NO account
 * orders. fixtures.json is a labeled test fixture, not proof of live values.
 * Live API verification is separately recorded by tools/build_live_snapshot.py.
 * Run: npm install --no-save jsdom && node live/tests/smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
const live = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(live);
const FIX = JSON.parse(fs.readFileSync(path.join(live, 'tests/fixtures.json')));
const committed = JSON.parse(fs.readFileSync(path.join(live, 'data/fallback-snapshot.json')));
const BASE = 'https://external-api.demo.kalshi.co/trade-api/v2';
const domains = new Set(['external-api.demo.kalshi.co', 'demo-api.kalshi.co', 'docs.kalshi.com', 'kalshi.com']);
let checks = 0, failures = 0;
const doms = [];
function ok(condition, label, detail = '') { checks++; if (!condition) { failures++; console.error('  ✗ ' + label + ' ' + detail); } else console.log('  ✓ ' + label); }
function eq(a, b, label) { ok(a === b, label, `got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`); }
const settle = () => new Promise(r => setTimeout(r, 35));
const allFixture = fix => Object.values(fix.events).flatMap(r => r.events).flatMap(ev => ev.markets || []);
function capture(fix) {
  const index = {};
  for (const [filter, result] of Object.entries(fix.series)) for (const s of result.series) index[s.ticker] =
    filter.startsWith('Commodities') ? 'gas' : filter.startsWith('Entertainment') ? 'culture' : filter.startsWith('Sports') ? 'golf' : filter.startsWith('Elections') ? 'elections' : 'crypto';
  const markets = [], resolutions = [];
  for (const response of Object.values(fix.events)) for (const ev of response.events) for (const m of ev.markets || []) {
    if (!index[ev.series_ticker] || markets.concat(resolutions).some(r => r.ticker === m.ticker)) continue;
    const r = { ...m, series_ticker: ev.series_ticker, topic: index[ev.series_ticker], event_title: ev.title,
      settlement_sources: ev.settlement_sources || [], source_url: BASE + '/markets/' + encodeURIComponent(m.ticker),
      observed_at: '2026-11-22T07:00:00Z', candles: {} };
    (m.status === 'finalized' ? resolutions : markets).push(r);
  }
  return { schema_version: 2, environment: 'demo', snapshotTs: '2026-11-22T07:00:00Z', source: BASE,
    markets, resolutions, coverage: { note: 'TEST FIXTURE — partial selected cohort only.' } };
}
async function makePage(file = 'index.html', opts = {}) {
  const fix = structuredClone(FIX), vc = new VirtualConsole(), errors = [];
  vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const url = opts.url || 'https://example.test/Tradebot2/live/' + file;
  const dom = new JSDOM(fs.readFileSync(path.join(live, file), 'utf8'), { url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  doms.push(dom);
  const w = dom.window;
  // A fixed test clock keeps the recorded fixture close times meaningful.
  let now = opts.blockApi ? Date.now() : Date.parse('2026-11-22T07:10:00Z');
  const NativeDate = w.Date;
  w.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
  w._advance = ms => { now += ms; };
  const ctxCalls = [];
  const ctx = new Proxy({}, { get: (_, p) => p === 'measureText' ? () => ({ width: 40 }) : p === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...args) => { ctxCalls.push([p, args]); }, set: () => true });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 800, height: 320, top: 0, left: 0, right: 800, bottom: 320 });
  w.confirm = () => true; w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  if (opts.storage) for (const [k, v] of Object.entries(opts.storage)) w.localStorage.setItem(k, v);
  const net = { fix, offline: !!opts.blockApi, calls: [], omit: new Set(), singleOmit: new Set(), status: 200 };
  const response = (body, status = 200) => ({ ok: status === 200, status, headers: { get: () => null }, json: async () => structuredClone(body), text: async () => JSON.stringify(body) });
  w.fetch = async input => {
    const u = new URL(String(input), w.document.baseURI); net.calls.push(u);
    if (u.pathname.endsWith('/data/fallback-snapshot.json')) return response(opts.capture || (opts.blockApi ? committed : capture(fix)));
    if (u.pathname.endsWith('/data/portfolio.json') || u.pathname.endsWith('/data/account-verification.json')) return response({ configured: false, history: [], note: 'Test: no signed capture' });
    if (net.offline) throw new TypeError('Fixture: network unavailable');
    if (net.status !== 200) return response({ error: 'fixture HTTP error' }, net.status);
    const p = u.pathname, markets = allFixture(fix);
    if (p.endsWith('/exchange/status')) return response(fix.status);
    if (p.endsWith('/markets')) {
      const tickers = (u.searchParams.get('tickers') || '').split(',');
      return response({ markets: markets.filter(m => tickers.includes(m.ticker) && !net.omit.has(m.ticker)), cursor: '' });
    }
    if (p.endsWith('/series')) {
      const k = [u.searchParams.get('category'), u.searchParams.get('tags')].filter(Boolean).join('|');
      return response(fix.series[k] || { series: [] });
    }
    if (p.endsWith('/events')) return response(fix.events[u.searchParams.get('status') || 'open'] || { events: [], cursor: '' });
    let m = p.match(/\/markets\/([^/]+)\/orderbook$/);
    if (m) return response(fix.orderbooks[m[1]] || { orderbook_fp: { yes_dollars: [], no_dollars: [] } });
    m = p.match(/\/markets\/([^/]+)\/candlesticks$/);
    if (m) return response(fix.candles[m[1]] || { candlesticks: [] });
    if (p.endsWith('/markets/trades')) return response(fix.trades);
    m = p.match(/\/(?:historical\/)?markets\/([^/]+)$/);
    if (m) { const raw = markets.find(r => r.ticker === m[1]); return raw && !net.singleOmit.has(m[1]) ? response({ market: raw }) : response({}, 404); }
    return response({}, 404);
  };
  for (const node of [...w.document.querySelectorAll('script[src]')]) {
    const src = path.resolve(path.dirname(path.join(live, file)), node.getAttribute('src'));
    const script = w.document.createElement('script'); script.textContent = fs.readFileSync(src, 'utf8'); w.document.body.appendChild(script);
  }
  await settle();
  return { w, doc: w.document, net, errors, ctxCalls };
}
function rowsSourced(doc, label) {
  const rows = [...doc.querySelectorAll('tbody tr')];
  const bad = rows.filter(row => ![...row.querySelectorAll('a[href]')].some(a => {
    try { const u = new URL(a.href); return u.protocol === 'https:' && domains.has(u.host); } catch { return false; }
  }));
  eq(bad.length, 0, label + ': every rendered table row has an official source');
  const invalid = [...doc.querySelectorAll('a[href]')].filter(a => {
    const u = new URL(a.href);
    return ['external-api.demo.kalshi.co', 'demo-api.kalshi.co'].includes(u.host) &&
      (/\/series\/[^/]+\/markets$/.test(u.pathname) || (u.pathname.endsWith('/events') && u.searchParams.has('tickers')));
  });
  eq(invalid.length, 0, label + ': no undocumented source route');
}
function makeMarket(w, overrides = {}) {
  return { ticker: 'TEST-BOUNDARY', topic: 'crypto', title: 'Labeled TEST fixture', seriesTicker: 'TEST', eventTicker: 'TEST-EVENT',
    status: 'active', marketType: 'binary', notional: 1, result: '', observedAt: w.Date.now(), fallback: false,
    price: 0.50, priceKind: 'last', yesBid: 0.49, yesAsk: 0.51, noBid: 0.49, noAsk: 0.51,
    yesBidSize: 100, yesAskSize: 100, spread: 0.02, volume24h: 500, oi: 100, closeTime: '2026-11-23T07:00:00Z',
    capturedCandles: {}, eventSettlementSources: [], sourceUrl: BASE + '/markets/TEST-BOUNDARY', ...overrides };
}
console.log('\n=== Core, units, exact threshold and basis isolation ===');
{
  const { w, errors } = await makePage(); const D = w.TBData, T = w.TB;
  eq(errors.length, 0, 'dashboard boots without console errors');
  eq(T.cents('0.5600'), 56, 'fixed-point dollars → cents'); eq(T.cents('0.1234'), 12.34, 'sub-cent precision');
  eq(T.num(''), null, 'empty is not zero'); eq(T.num(null), null, 'null is not zero'); eq(T.num('0'), 0, 'actual zero preserved');
  eq(T.ALERT_THRESHOLD, 0.10, 'required threshold $0.10');
  eq(D.feeFor(100, 0.5), 1.75, 'M=1 fee formula for 100 at 50¢');
  eq(D.feeFor(1, 0.1), 0.0063, 'centicent formula, not rounded display table');
  eq(D.feeFor(10, 0.5, 0), 0, 'explicit zero multiplier is not replaced with one');
  for (const [p, count] of [[0.55, 0], [0.5999, 0], [0.60, 1], [0.4001, 0], [0.40, 1], [0.35, 1]]) {
    w.localStorage.removeItem(D.storageKey('hist')); D.saveAlerts([]); D.state.fallback = null;
    D.state.markets = [makeMarket(w)]; D.recordAndDetect(); w._advance(1000);
    D.state.markets = [makeMarket(w, { price: p })]; eq(D.recordAndDetect().length, count, `50¢ → ${p * 100}¢ threshold`);
  }
  eq(D.recordAndDetect().length, 0, 'same observation never duplicates alerts');
  w._advance(1000); D.state.markets[0].priceKind = 'mid'; D.state.markets[0].price = 0.8; D.state.markets[0].observedAt = w.Date.now();
  eq(D.recordAndDetect().length, 0, 'price-basis change resets baseline; no fake swing');
  D.state.fallback = { at: 'old' }; w._advance(1000); D.state.markets[0].price = 0.4;
  eq(D.recordAndDetect().length, 0, 'snapshot never creates an alert'); D.state.fallback = null;
  const demoKey = D.storageKey('hist'); T.api.setEnv('prod');
  ok(D.storageKey('hist') !== demoKey, 'histories are namespaced by environment'); eq(D.alerts().length, 0, 'demo alerts do not leak into prod');
  eq(await D.loadFallback(), null, 'demo fallback forbidden under prod'); eq(D.paperState().trades.length, 0, 'paper ledger isolated by environment');
}
console.log('\n=== Quotes, aggregation, unknown values and ranking ===');
{
  const { w, net, doc } = await makePage(); const D = w.TBData;
  ok(D.state.freshCount > 0, 'selected cohort re-read through tickers-only official route');
  ok(net.calls.some(u => u.pathname.endsWith('/markets') && u.searchParams.has('tickers')), 'batch quote route used');
  eq(doc.querySelectorAll('#topics .topic-card').length, 5, 'five distinct topic cards');
  ok(doc.querySelector('#events tbody tr'), 'grouped events rendered');
  eq(doc.querySelectorAll('#events section[data-topic]').length, 5, 'event ranking has five separate topic groups'); rowsSourced(doc, 'dashboard');
  const stats = D.computeStats(); ok(stats.live > 0 && stats.markets > 0, 'counts reflect actual loaded selection');
  const rows = D.rankEvents().rows;
  ok(rows.every((r, i) => i === 0 || (rows[i - 1].vol24 ?? -1) >= (r.vol24 ?? -1)), 'consistent face-notional descending ranking');
  const m = D.state.markets.find(w.TB.isLive); m.notional = null;
  eq(D.computeStats().vol24, null, 'unknown face value does not become $1');
  ok(D.rankEvents().basis.includes('contracts'), 'whole ranking changes basis when dollar inputs missing');
  m.volume24h = null; ok(D.rankEvents().rows.some(r => r.eventTicker === m.eventTicker && r.contracts24 === null), 'unknown volume is not zero');
  const one = makeMarket(w, { price: 0.5, noAsk: 0.51 });
  const screen = D.scoreCandidate(one, 20); ok(screen.pass, 'eligible reversion scenario passes');
  one.yesBidSize = null; ok(!D.scoreCandidate(one, 20).pass, 'missing entry-side size fails screen');
  one.yesBidSize = 100; one.spread = -0.01; ok(!D.scoreCandidate(one, 20).pass, 'crossed book fails screen');
  one.spread = null; ok(!D.scoreCandidate(one, 20).pass, 'unknown spread fails screen');
  net.offline = true; await D.refresh(); ok(D.state.fallback, 'failed batch switches to explicit snapshot state');
  ok(!D.isQuoteFresh(D.state.markets[0]), 'failed reads cannot keep trading on snapshot');
}
console.log('\n=== Paper execution, bid marks and finalization safety ===');
{
  const { w } = await makePage(); const D = w.TBData; D.resetPaper();
  const set = overrides => { const m = makeMarket(w, overrides); D.state.fallback = null; D.state.markets = [m]; return m; };
  const order = (m, extra = {}) => D.openTrade({ market: m, strategyId: 'manual-test', side: 'yes', qty: 5, ...extra });
  let m = set({}); let result = order(m); ok(result.ok, 'paper entry at verified ask with visible size');
  eq(result.trade.entry, 0.51, 'paper entry is ask, never last');
  const pf = D.portfolio(); eq(pf.open[0].markCents, 49, 'YES marked at side bid'); ok(pf.equity < 10000, 'spread and entry fee lower immediate equity');
  D.resetPaper(); result = order(set({}), { side: 'no' }); ok(result.ok, 'NO entry uses NO ask');
  eq(D.portfolio().open[0].markCents, 49, 'NO marked at NO bid, not ask/complement wrong side');
  for (const [overrides, label] of [[{ fallback: true }, 'snapshot'], [{ observedAt: w.Date.now() - 600000 }, 'stale'],
    [{ status: 'closed' }, 'closed'], [{ status: 'inactive' }, 'paused'], [{ status: 'determined', result: 'yes' }, 'provisional'],
    [{ yesAskSize: null }, 'unknown size'], [{ yesAskSize: 1 }, 'insufficient size'], [{ yesAsk: null }, 'missing ask'],
    [{ marketType: 'scalar' }, 'scalar'], [{ notional: null }, 'unknown face']]) {
    D.resetPaper(); ok(!order(set(overrides)).ok, `no paper fill with ${label}`);
  }
  D.resetPaper(); ok(!order(set({}), { qty: 1.5 }).ok, 'fractional requested quantity rejected by integer-lot simulation');
  ok(!order(set({}), { qty: 0 }).ok, 'zero quantity rejected'); ok(!order(set({}), { price: 0.5 }).ok, 'arbitrary price override cannot fabricate fill');
  D.resetPaper(); m = set({}); result = order(m); const before = D.paperState().cash;
  m.status = 'closed'; m.price = 0.2; m.yesBid = 0.19;
  D.markToMarket(); eq(D.paperState().trades[0].status, 'open', 'closing time does not simulate an impossible market exit');
  eq(D.paperState().cash, before, 'closed market does not release cash');
  m.status = 'determined'; m.result = 'yes'; D.markToMarket(); eq(D.paperState().trades[0].status, 'open', 'determined YES is not a settlement');
  m.status = 'disputed'; D.markToMarket(); eq(D.paperState().trades[0].status, 'open', 'disputed YES is not a settlement');
  m.status = 'finalized'; m.price = null; D.markToMarket();
  const t = D.paperState().trades[0]; eq(t.status, 'closed', 'finalized result settles even if no quote price'); eq(t.exit, 1, 'YES finalized payout'); eq(t.exitFee, 0, 'no settlement fee');
  D.resetPaper(); m = set({}); order(m, { strategyId: 'S1-momentum' });
  m.closeTime = new Date(w.Date.now() - 1).toISOString(); m.yesBid = 0.2;
  D.markToMarket(); eq(D.paperState().trades[0].status, 'open', 'passed close time blocks exit while status lags');
  eq(D.portfolio().equity, null, 'post-close pending marks are not executable equity');
  D.resetPaper(); m = set({}); order(m); m.observedAt -= 600000;
  eq(D.portfolio().equity, null, 'unknown/stale open marks leave equity blank');
  D.resetPaper(); m = set({}); D.savePaper({ ...D.paperState(), auto: true });
  const alert = { id: 'test-down', ticker: m.ticker, at: w.Date.now(), delta: -10, to: 50, score: { pass: false } };
  const opened = D.autoTrade([alert]); ok(opened.some(t => t.strategy === 'S1-momentum' && t.side === 'no'), 'downward momentum buys NO');
  eq(D.autoTrade([alert]).length, 0, 'same signal cannot be simulated twice');
}
console.log('\n=== Chart windows, ladders, sources and honest account panel ===');
for (const file of ['alerts.html', 'liquidity.html', 'portfolio.html', 'resolutions.html', 'topics/gas.html', 'topics/elections.html', 'topics/culture.html', 'topics/crypto.html', 'topics/golf.html', 'market.html']) {
  const opts = file === 'market.html' ? { url: 'https://example.test/Tradebot2/live/market.html?ticker=KXAAAGASW-26NOV23-3.8400' } : {};
  const { w, doc, errors, ctxCalls } = await makePage(file, opts);
  eq(errors.length, 0, file + ': no console errors'); rowsSourced(doc, file);
  const nav = [...doc.querySelectorAll('#site-head nav a')]; ok(nav.every(a => new URL(a.href).pathname.startsWith('/Tradebot2/live/')), file + ': navigation respects project and topic depth');
  if (file === 'alerts.html') {
    const m = w.TBData.state.markets.find(x => x.status === 'active');
    w.TBData.saveAlerts([{ id: 'test-alert', at: w.Date.now(), fromTs: w.Date.now() - 60000, ticker: m.ticker, topic: m.topic,
      title: m.title, seriesTicker: m.seriesTicker, from: 40, to: 55, delta: 15, priceKind: 'last', score: { pass: true, score: 0.03 } }]);
    doc.querySelector('#topicFilter button').click(); ok(doc.querySelector('#chatAll .msg'), 'all-events scrolling chat renders');
    ok(doc.querySelector('#chatRoi .msg'), 'selective chat renders passing alert'); rowsSourced(doc, 'alert table populated');
  }
  if (file === 'liquidity.html') {
    eq(doc.querySelectorAll('#span [data-seconds="30"]').length, 1, 'true 30-second window');
    eq(doc.querySelectorAll('#iv button').length, 3, 'exactly 3 official candle intervals');
    doc.querySelector('#span [data-seconds="30"]').click(); await settle();
    ok(doc.querySelector('#chartMeta').textContent.includes('5-second REST samples'), 'seconds-scale cadence explicitly described');
    ok(ctxCalls.length > 0, 'canvas rendering actually happens');
    const m = w.TBData.state.markets[0];
    const ob = { orderbook_fp: { yes_dollars: [['0.20', '1'], ['0.60', '2'], ['0.40', '3']], no_dollars: [['0.10', '4'], ['0.70', '5'], ['0.30', '6']] } };
    w.TBChart.ladder(doc.querySelector('#ladder'), ob, { levels: 1, source: BASE + '/markets/' + m.ticker + '/orderbook' });
    const text = doc.querySelector('#ladder').textContent;
    ok(text.includes('30¢') && text.includes('60¢'), 'ladder selects nearest ask and bid even if input unsorted');
    ok(!text.includes('90¢') && !text.includes('20¢'), 'far/worst book levels not substituted for best'); rowsSourced(doc, 'one-level book');
    await w.TBView.ladder(doc.querySelector('#ladder'), doc.querySelector('#liqMeta'), null);
    eq(doc.querySelectorAll('#ladder tbody tr').length, 0, 'no selection clears old current-liquidity rows');
    await w.TBView.trades(doc.querySelector('#trades'), null);
    eq(doc.querySelectorAll('#trades tbody tr').length, 0, 'no selection clears old trade rows');
    w.TBUI.contextTable(doc.querySelector('#moveContext'), null);
    eq(doc.querySelectorAll('#moveContext a').length, 0, 'no selection does not fabricate an empty-ticker source');
  }
  if (file === 'portfolio.html') {
    eq(doc.querySelectorAll('#stratTable tbody tr').length, 4, 'four documented paper strategies');
    ok(doc.querySelector('#stratTable').textContent.includes('needs more trades'), 'no validated-edge claim on empty samples');
    ok(doc.querySelector('#accountStatus').textContent.includes('UNVERIFIED'), 'account explicitly unverified, not simulated balance');
    const accountValues = [...doc.querySelectorAll('#accountTable tbody td:nth-child(2)')].map(n => n.textContent);
    ok(accountValues.every(t => t.includes('unverified')), 'missing account values remain blank + flagged');
  }
}
console.log('\n=== Offline capture, project paths, retention and API cache controls ===');
{
  const { w, doc, net } = await makePage('topics/gas.html', { blockApi: true });
  ok(w.TBData.state.markets.length > 30, 'real dated capture still loads on nested topic page');
  ok(doc.querySelector('#statusbar').textContent.includes('SNAPSHOT'), 'snapshot never labeled LIVE');
  ok(doc.body.textContent.includes('alerts and paper trading paused'), 'offline trading paused visibly');
  eq(w.TBData.alerts().length, 0, 'no snapshot-generated alerts');
  ok(net.calls.some(u => u.pathname === '/Tradebot2/live/data/fallback-snapshot.json'), 'fallback path resolves under /live/, not ../data on topic pages');
  rowsSourced(doc, 'offline topic');
  const m = w.TBData.state.markets.find(m => m.price !== null), priceTime = m.observedAt;
  const series = await w.TBData.chartSeries(m, 3600, 1);
  ok(series.points.every(p => p.t <= priceTime), 'dated chart never invents a quote at now');
  const { w: w2, net: n2 } = await makePage(); const T = w2.TB;
  n2.calls.length = 0; await T.api.get('/exchange/status', null, { ttl: 0 }); await T.api.get('/exchange/status', null, { ttl: 0 });
  eq(n2.calls.length, 2, 'TTL zero really bypasses cache');
  n2.status = 429; try { await T.api.get('/exchange/status', null, { ttl: 0 }); } catch {}
  const after429 = n2.calls.length; try { await T.api.get('/markets/ANY', null, { ttl: 0 }); } catch {}
  eq(n2.calls.length, after429, '429 cooldown prevents repeated requests');
}
{
  const first = await makePage(); const m = first.w.TBData.state.markets.find(m => m.status === 'active');
  const storage = Object.fromEntries(Object.keys(first.w.localStorage).map(k => [k, first.w.localStorage.getItem(k)]));
  const c = capture(structuredClone(FIX)); c.markets = c.markets.filter(r => r.ticker !== m.ticker);
  const second = await makePage('resolutions.html', { capture: c, storage });
  ok(second.w.TBData.marketByTicker(m.ticker), 'previous unresolved contract survives removal from selected cohort');
  ok(second.net.calls.some(u => (u.searchParams.get('tickers') || '').includes(m.ticker)), 'retained contract is actually re-polled');
}
console.log('\n=== Static reference pages: every row has official evidence ===');
for (const file of ['flagged.html', 'executive-summary.html', 'verification.html']) {
  const doc = new JSDOM(fs.readFileSync(path.join(live, file)), { url: 'https://example.test/Tradebot2/live/' + file }).window.document;
  rowsSourced(doc, file);
}
console.log('\n=== Published root landing: runtime navigation and source rows ===');
{
  const dom = new JSDOM(fs.readFileSync(path.join(repo, 'index.html'), 'utf8'), {
    url: 'https://example.test/Tradebot2/index.html', runScripts: 'outside-only'
  });
  doms.push(dom); const w = dom.window;
  for (const script of w.document.querySelectorAll('script')) {
    const src = script.getAttribute('src');
    w.eval(src ? fs.readFileSync(path.join(repo, src), 'utf8') + '\nwindow.TB = TB;' : script.textContent);
  }
  const nav = [...w.document.querySelectorAll('#site-head nav a')];
  eq(nav.length, 13, 'root renders all shared navigation entries');
  ok(nav.every(a => new URL(a.href).pathname.startsWith('/Tradebot2/live/')), 'root nav has no double-live or prefixed-absolute-URL links');
  eq(new URL(w.document.querySelector('#site-head .brand').href).pathname, '/Tradebot2/live/index.html', 'root brand goes to maintained desk');
  rowsSourced(w.document, 'published root landing');
  ok(!w.document.querySelector('.hero .pill.live'), 'landing does not assert an API check it never performed');
}
for (const dom of doms) dom.window.close();
console.log(`\n${failures ? 'FAIL' : 'ALL PASS'}: ${checks - failures}/${checks} checks; mocked API only.\n`);
process.exit(failures ? 1 : 0);
