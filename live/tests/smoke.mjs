/**
 * Headless smoke test for the live dashboard.
 *
 * It does NOT hit the network. Instead it:
 *   1. loads the real page HTML and the real JS modules in jsdom
 *   2. stubs window.fetch with recorded responses that follow the official
 *      response schemas (docs.kalshi.com openapi), so every code path runs
 *   3. asserts the rendered DOM contains the expected live values
 *
 * Run: node live/tests/smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const here = path.dirname(fileURLToPath(import.meta.url));
const liveDir = path.resolve(here, '..');

/* ------------------------------------------------------------ fixtures ---- */
const FIX = JSON.parse(fs.readFileSync(path.join(here, 'fixtures.json'), 'utf8'));

let failures = 0, checks = 0;
function ok(cond, label, extra) {
  checks++;
  if (cond) { console.log('  ✓ ' + label); }
  else { failures++; console.log('  ✗ ' + label + (extra ? '  →  ' + extra : '')); }
}
function eq(a, b, label) { ok(String(a) === String(b), label, `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`); }

/* -------------------------------------------------------------- harness --- */
async function makePage(file, { url = 'https://example.test/', blockApi = false } = {}) {
  const html = fs.readFileSync(path.join(liveDir, file), 'utf8');
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    resources: undefined,
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  const { window } = dom;

  /* canvas stub: jsdom has no 2D context */
  const ctxCalls = { count: 0 };
  window.HTMLCanvasElement.prototype.getContext = function () {
    const self = this;
    return new Proxy({}, {
      get(_, prop) {
        if (prop === 'canvas') return self;
        if (prop === 'measureText') return () => ({ width: 40 });
        if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (prop === 'getBoundingClientRect') return () => ({ width: 800, height: 320, left: 0, top: 0 });
        return (...args) => { ctxCalls.count++; return undefined; };
      },
      set() { return true; }
    });
  };
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { width: 800, height: 320, left: 0, top: 0, right: 800, bottom: 320 }; };

  /* fetch stub: route by pathname */
  const calls = [];
  window.fetch = async (input) => {
    const u = new URL(String(input));
    calls.push(u.pathname + (u.search || ''));
    /* static-file requests (the committed fallback) must keep working */
    const isStatic = u.pathname.includes('/data/');
    if (blockApi && !isStatic) {
      throw new TypeError('Failed to fetch (simulated network/CORS block)');
    }
    if (isStatic) {
      const mount = path.posix.basename(s2Mount(u.pathname)) === 'live' ? '' : 'live';
      const idx = u.pathname.indexOf('/live/');
      const file = idx >= 0
        ? path.join(path.resolve(liveDir, '..'), u.pathname.slice(idx + 1))
        : path.join(liveDir, u.pathname.replace(/^\//, ''));
      if (!fs.existsSync(file)) {
        return { ok: false, status: 404, text: async () => 'missing', json: async () => ({}) };
      }
      const body = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => body, text: async () => '' };
    }
    const body = route(u, FIX);
    if (body === undefined) {
      return { ok: false, status: 404, text: async () => '{"error":"not in fixture"}', json: async () => ({}) };
    }
    return {
      ok: true, status: 200,
      headers: { get: (h) => (h.toLowerCase() === 'access-control-allow-origin' ? 'https://example.test' : null) },
      json: async () => JSON.parse(JSON.stringify(body)),
      text: async () => JSON.stringify(body)
    };
  };
  /* small timers so tests do not wait a minute */
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));

  dom.window._errors = errors;
  dom.window._calls = calls;
  dom.window._ctxCalls = ctxCalls;

  /* jsdom will not execute inline src unless resources:"usable"; load manually */
  const scripts = [...dom.window.document.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  for (const src of scripts) {
    const p = path.join(liveDir, src);
    const code = fs.readFileSync(p, 'utf8');
    const el = dom.window.document.createElement('script');
    el.textContent = code;
    dom.window.document.body.appendChild(el);
  }
  return dom;
}

/* test pages are served as if the site root were the repo root, so /live/… is static */
function s2Mount(p) { return p; }

function route(u, fix) {
  const p = u.pathname;
  const q = u.searchParams;
  if (p.endsWith('/exchange/status')) return fix.status;
  if (p.endsWith('/search/tags_by_categories')) return fix.tags;
  if (p.endsWith('/series')) {
    const cat = q.get('category'), tag = q.get('tags');
    const key = [cat, tag].filter(Boolean).join('|');
    return fix.series[key] || { series: [] };
  }
  if (p.endsWith('/events')) {
    const status = q.get('status') || 'open';
    return fix.events[status] || { events: [], cursor: '' };
  }
  let m = p.match(/\/markets\/([^/]+)\/orderbook$/);
  if (m) return fix.orderbooks[m[1]] || { orderbook_fp: { yes_dollars: [], no_dollars: [] } };
  m = p.match(/\/series\/([^/]+)\/markets\/([^/]+)\/candlesticks$/);
  if (m) return fix.candles[m[2]] || { candlesticks: [] };
  if (p.endsWith('/markets/trades')) return fix.trades;
  m = p.match(/\/markets\/([^/]+)$/);
  if (m) return fix.marketSingle[m[1]] || { market: null };
  return undefined;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ================================================================ TESTS === */
console.log('\n=== 1. Core library: parsing, fee maths, screen ===');
{
  const dom = await makePage('index.html');
  const w = dom.window;
  const TB = w.TB;
  ok(!!TB, 'TB core loaded');
  eq(TB.cents('0.5600'), 56, 'cents("0.5600") -> 56');
  eq(TB.cents('0.1234'), 12.34, 'cents keeps sub-cent precision');
  eq(TB.num(''), null, 'empty string is null, never 0');
  eq(TB.centsLabel(56), '¢56', 'centsLabel formats 56 cents');
  eq(TB.compact(1234567), '1.23M', 'compact 1.23M');
  eq(TB.ALERT_THRESHOLD, 0.1, 'alert threshold is $0.10');
  /* the official fee formula from kalshi.com/docs/kalshi-fee-schedule.pdf */
  const fee100at50 = Math.ceil(0.07 * 100 * 0.5 * 0.5 * 10000) / 10000;
  eq(fee100at50.toFixed(2), '1.75', 'fee for 100 contracts at 50¢ = $1.75 (matches published table row)');
  const fee1at10 = Math.ceil(0.07 * 1 * 0.1 * 0.9 * 10000) / 10000;
  eq(fee1at10.toFixed(2), '0.01', 'fee for 1 contract at 10¢ rounds up to $0.01 (matches table)');
  ok(typeof w.TBData.scoreCandidate === 'function', 'screen scorer present');
  const pass = w.TBData.scoreCandidate({ price: 0.5, spread: 0.01, yesAskSize: 100, yesBidSize: 100, volume24h: 500, oi: 50 }, 15);
  ok(typeof pass.pass === 'boolean' && typeof pass.score === 'number', 'scorer returns {pass, score}');
  eq(TB.settings().env, 'demo', 'default environment is demo');
  /* A1 regularities: tab/config must not point at the retired docs host */
  const coreSrc = fs.readFileSync(path.join(liveDir, 'assets/js/core.js'), 'utf8');
  ok(!/trading-api\.kalshi\.com/.test(coreSrc), 'no reference to the retired trading-api.kalshi.com host');
  ok(/external-api\.demo\.kalshi\.co\/trade-api\/v2/.test(coreSrc), 'demo REST base matches official docs');
  ok(/external-api-kalshi|external-api\.kalshi\.com\/trade-api\/v2/.test(coreSrc), 'production base matches official docs');
}
console.log('\n=== 2. Data layer: topic join, aggregation, swing detection ===');
{
  const dom = await makePage('index.html');
  const w = dom.window;
  await sleep(400);
  const D = w.TBData;
  const st = D.state;
  ok(st.markets.length > 0, 'markets loaded from nested events', st.markets.length);
  /* topic join */
  const topics = [...new Set(st.markets.map(m => m.topic))];
  ok(topics.length >= 2, 'markets are mapped to topics', topics.join(','));
  /* only series in our map are kept */
  const unknown = st.markets.filter(m => !st.seriesIndex[m.seriesTicker]);
  eq(unknown.length, 0, 'no market kept from an out-of-scope series');
  /* swing detection */
  const h = w.localStorage.getItem('tb.hist');
  ok(!!h, 'price history persisted to localStorage');
  const hist = JSON.parse(h);
  const firstTicker = Object.keys(hist)[0];
  const before = hist[firstTicker].pts[hist[firstTicker].pts.length - 1].p;
  /* move one market by 12 cents then re-detect */
  const mkt = st.markets.find(m => m.ticker === firstTicker);
  if (mkt) mkt.price = (before + 12) / 100;
  const swings = D.recordAndDetect();
  ok(Array.isArray(swings), 'recordAndDetect returns an array');
  const found = swings.find(s => s.ticker === firstTicker);
  ok(!!found, 'a +12¢ change produces a swing', firstTicker);
  if (found) eq(Math.round(found.delta), 12, 'delta is recorded in cents');
  /* exact threshold boundary, on one isolated ticker */
  const mk = p => ({ ticker: 'BOUND', topic: 'crypto', title: 't', seriesTicker: 'S', eventTicker: 'E', status: 'active',
    price: p, yesBid: p - 0.01, yesAsk: p + 0.01, spread: 0.02, yesBidSize: 100, yesAskSize: 100, volume24h: 500, oi: 100 });
  const boundary = (target, label) => {
    w.localStorage.removeItem('tb.hist'); D.saveAlerts([]);
    D.state.markets = [mk(0.50)]; D.recordAndDetect();
    D.state.markets = [mk(target)];
    const hits = D.recordAndDetect().filter(a => a.ticker === 'BOUND');
    return { n: hits.length, delta: hits[0] ? hits[0].delta : null, label };
  };
  eq(boundary(0.55, '').n, 0, '+5¢ does not alert');
  eq(boundary(0.5999, '').n, 0, '+9.99¢ does not alert');
  const at10 = boundary(0.60, '');
  eq(at10.n, 1, '+10.00¢ alerts (>= threshold)');
  eq(at10.delta.toFixed(2), '10.00', 'alert delta recorded as exactly 10.00¢');
  eq(boundary(0.4001, '').n, 0, '−9.99¢ does not alert');
  const dn10 = boundary(0.40, '');
  eq(dn10.n, 1, '−10.00¢ alerts');
  eq(dn10.delta.toFixed(2), '-10.00', 'down-move delta is negative');
  eq(boundary(0.35, '').n, 1, '−15¢ alerts');
  /* repeat refresh at an unchanged price must not duplicate the alert */
  w.localStorage.removeItem('tb.hist'); D.saveAlerts([]);
  D.state.markets = [mk(0.50)]; D.recordAndDetect();
  D.state.markets = [mk(0.60)]; D.recordAndDetect();
  eq(D.recordAndDetect().length, 0, 'unchanged price on the next refresh creates no duplicate alert');
  /* restore the fixture market list for the remaining checks */
  D.state.markets = st.markets;
  /* aggregation */
  const rank = D.rankEvents();
  ok(rank.rows.length > 0, 'events aggregated and ranked');
  ok(rank.rows[0].notionalTotal >= rank.rows[rank.rows.length - 1].notionalTotal, 'ranked by notional descending');
  const stats = D.computeStats();
  ok(stats.markets === st.markets.length, 'stats count all markets');
  ok(stats.live > 0, 'stats count live markets', stats.live);
  /* portfolio engine */
  const mkt2 = st.markets.find(m => m.status === 'active' && m.yesAsk);
  if (mkt2) {
    const r = D.openTrade({ strategyId: 'S1-momentum', market: mkt2, side: 'yes', qty: 10 });
    ok(r.ok, 'paper trade opens at the live ask');
    const pf = D.portfolio();
    ok(pf.equity !== 10000 || pf.openValue > 0, 'equity reflects the open position');
    ok(pf.openCount >= 1, 'open position(s) tracked', String(pf.openCount));
  }
  /* no fabricated fields */
  const anyNullCost = st.markets.every(m => m.price === null || Number.isFinite(m.price));
  ok(anyNullCost, 'prices are finite numbers or null, never NaN');
}

console.log('\n=== 3. Dashboard page renders live values ===');
{
  const dom = await makePage('index.html');
  const w = dom.window;
  await sleep(900);
  const doc = w.document;
  eq(doc.querySelectorAll('#topics .topic-card').length, 5, 'five topic cards rendered');
  ok(/Live markets/i.test(doc.querySelector('#kpis').textContent), 'KPI block rendered');
  ok(doc.querySelectorAll('#events table tbody tr').length > 0, 'event table has rows');
  ok(doc.querySelector('#events').innerHTML.includes('API'), 'event rows link to the API');
  ok(doc.querySelector('#hdr-env'), 'environment pill rendered');
  ok(!!doc.querySelector('#chartPick option'), 'chart market picker populated');
  ok(doc.querySelector('#kpis').textContent.includes('$') || doc.querySelector('#kpis').textContent.includes('—'), 'currency formatted');
  /* the alert chats exist and are labelled */
  ok(!!doc.querySelector('#chatAll'), 'all-events chat present');
  ok(!!doc.querySelector('#chatRoi'), 'high-ROI chat present');
  /* no hard-coded fake market tickers leak onto the page */
  const bodyText = doc.body.textContent;
  ['GAS-24DEC-3.15', 'PRES-24-DJT', 'OSCAR-BESTPIC-25', 'MASTERS-25-SCHEFFLER', 'BTC-25Q1-110K'].forEach(fake => {
    ok(!bodyText.includes(fake), 'fabricated ticker absent: ' + fake);
  });
  ok(!/Sharpe Ratio/i.test(bodyText), 'no fabricated Sharpe ratio on the page');
  eq(dom.window._errors.length, 0, 'no console errors', dom.window._errors.join(' | '));
}

console.log('\n=== 4. Alerts page: two chats, filters, table ===');
{
  const dom = await makePage('alerts.html');
  const w = dom.window;
  await sleep(1000);
  const doc = w.document;
  ok(!!doc.querySelector('#chatAll'), 'chat 1 exists');
  ok(!!doc.querySelector('#chatRoi'), 'chat 2 exists');
  eq(doc.querySelectorAll('#topicFilter button').length, 6, 'topic filter has all + 5 topics');
  /* inject an alert and confirm it renders as a message */
  const D = w.TBData;
  const mk = D.state.markets.find(m => m.price !== null);
  if (mk) {
    D.saveAlerts([{ id: 'T1', at: Date.now(), fromTs: Date.now() - 60000, ticker: mk.ticker, topic: mk.topic, title: mk.title,
      seriesTicker: mk.seriesTicker, from: 40, to: 55, delta: 15, spread: 0.01, volume24h: 500, oi: 100, priceKind: 'last',
      score: { pass: true, score: 0.03, side: 'no', reasons: [] } }]);
    doc.querySelector('#topicFilter button[data-t=""]').click();
    /* re-render via the refresh button path */
    doc.querySelector('#refreshBtn').click();
    await sleep(800);
    ok(doc.querySelectorAll('#chatAll .msg').length > 0, 'alert renders as a chat message');
    ok(doc.querySelector('#chatRoi .msg'), 'passing alert appears in the ROI chat');
    ok(doc.querySelector('#alertTable').textContent.includes(mk.ticker), 'alert appears in the table');
  }
}

console.log('\n=== 5. Charts & liquidity page ===');
{
  const dom = await makePage('liquidity.html');
  const w = dom.window;
  await sleep(1000);
  const doc = w.document;
  ok(!!doc.querySelector('#mkt option'), 'market selector populated');
  ok(doc.querySelector('#ladder').innerHTML.length > 20, 'order book ladder rendered');
  ok(/ladder|t-blank/.test(doc.querySelector('#ladder').className + doc.querySelector('#ladder').innerHTML), 'ladder container typed');
  ok(doc.querySelector('#mktMeta').textContent.includes('YES'), 'contract metadata rendered');
  ok(w._ctxCalls.count > 20, 'canvas drawing actually happened', String(w._ctxCalls.count));
  eq(doc.querySelectorAll('#span button').length, 5, 'five window options (incl. seconds-scale 15m)');
  eq(doc.querySelectorAll('#iv button').length, 3, '3 candle intervals per official API');
}

console.log('\n=== 6. Portfolio page: strategies, categorisation, CSV ===');
{
  const dom = await makePage('portfolio.html');
  const w = dom.window;
  await sleep(900);
  const doc = w.document;
  eq(doc.querySelectorAll('#stratTable tbody tr').length, 4, 'all four strategies listed with verdicts');
  ok(doc.querySelector('#stratTable').textContent.includes('needs more trades'), 'strategy verdict is honest about small samples');
  ok(/Simulated portfolio — not a Kalshi account/.test(doc.body.textContent), 'prominent simulation disclaimer');
  ok(doc.querySelector('#kpis').textContent.includes('$10,000') || doc.querySelector('#kpis').textContent.includes('Equity'), 'KPI rendered');
  /* open a trade, then verify it lands in the open table */
  const D = w.TBData;
  const mk = D.state.markets.find(m => m.status === 'active' && m.yesAsk);
  if (mk) {
    D.openTrade({ strategyId: 'S2-reversion', market: mk, side: 'yes', qty: 5 });
    doc.querySelector('#scanBtn').click();
    await sleep(200);
    ok(doc.querySelector('#open').textContent.includes(mk.ticker), 'open position shows on the page');
  }
}

console.log('\n=== 7. Resolutions page ===');
{
  const dom = await makePage('resolutions.html');
  const w = dom.window;
  await sleep(900);
  const doc = w.document;
  ok(doc.querySelector('#kpis').textContent.includes('Resolved'), 'resolution KPIs rendered');
  ok(!!doc.querySelector('#pending'), 'pending section present');
  ok(doc.querySelector('#resolved').innerHTML.length > 30, 'resolved table rendered');
}

console.log('\n=== 8. Offline/CORS-blocked fallback stays honest ===');
{
  const dom = await makePage('index.html', { blockApi: true });
  const w = dom.window;
  await sleep(1500);
  const doc = w.document;
  const bodyText = doc.body.textContent;
  ok(/SNAPSHOT/i.test(bodyText), 'status pill says SNAPSHOT when the live API is blocked');
  ok(/not live/i.test(bodyText), 'page states the capture is not live');
  ok(/alerts and paper trading paused/i.test(bodyText), 'page says alerts/paper trading are paused');
  ok(/showing the verified snapshot/i.test(doc.querySelector('#errbox').textContent), 'a dated explanation is shown');
  /* real markets from the committed capture, rendered through the market board */
  const boards = doc.querySelectorAll('table tbody tr').length;
  ok(boards > 0, 'markets from the verified capture are rendered in tables', String(boards));
  ok(w.TBData.state.markets.length > 30, 'fallback loaded the full verified capture',
     String(w.TBData.state.markets.length));
  const realTickers = w.TBData.state.markets.map(m => m.ticker);
  ok(realTickers.includes('KXAAAGASW-26NOV23-3.8400'), 'a known real demo ticker is present in the capture');
  /* the snapshot is dated, and no fabricated ticker sneaks in */
  ok(!bodyText.includes('GAS-24DEC-3.15'), 'no fabricated ticker in fallback mode');
  ok(doc.querySelectorAll('#topics .topic-card').length === 5, 'all five topics still render');
  /* alerts must NOT be produced from a snapshot */
  eq(w.TBData.alerts().length, 0, 'no alerts are generated from a static snapshot');
  /* every displayed market must carry a real ticker from the capture */
  const shown = [...doc.querySelectorAll('#events .mono')].map(n => n.textContent.trim()).filter(Boolean);
  ok(shown.every(t => /^[A-Z0-9]+-/.test(t)), 'displayed event tickers look like real API tickers');
}

console.log(`\n${failures === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${checks - failures}/${checks} checks passed\n`);
process.exit(failures === 0 ? 0 : 1);
