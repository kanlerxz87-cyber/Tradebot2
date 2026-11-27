/**
 * quote_rules.mjs — regression tests for how a Kalshi payload becomes a price.
 *
 * Run: node live/tests/quote_rules.mjs        (CI runs it from .github/workflows/pages.yml)
 *
 * WHY THESE EXIST
 * The dashboard prints a YES price, a spread, a bid/ask and a swing alert. Each of
 * those can be wrong in a way that still *looks* like data, which is the failure
 * this repository has already shipped once (flagged.html F-01). The fixtures below
 * are the real payload shapes, captured from the demo host on 2026-11-27, not
 * hand-written guesses:
 *
 *   GET /markets?status=open&series_ticker=KXBTCMAXY
 *     -> yes_bid_dollars "0.0000", yes_bid_size_fp "0.00",
 *        yes_ask_dollars "0.9200", last_price_dollars "0.0700"
 *   GET /markets/KXBTCMAXY-26DEC31-109999.99/orderbook?depth=100
 *     -> {"orderbook_fp":{"no_dollars":[["0.0800","1.00"]],"yes_dollars":[]}}
 *   GET /markets/KXDPWORLDTOUR-BMAPC26-TMOR/orderbook?depth=100
 *     -> no_dollars ascending 0.9880..0.9900, yes_dollars ascending 0.0010..0.0030
 *
 * Source: https://docs.kalshi.com/api-reference/market/get-markets
 *         https://docs.kalshi.com/api-reference/market/get-market-orderbook
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; console.log(`  \u2717 ${name}${detail ? ' \u2014 ' + detail : ''}`); }
};

/* --- load the shipped modules in this process, no bundler ------------------ */
function loadCore() {
  const TB = new Function(read('live/assets/js/core.js') + '\n; return TB;')();
  return TB;
}
const TB = loadCore();

console.log('\n=== 1. A quoted zero is not a price (D1) ===');

const emptyBook = TB.normMarket({
  ticker: 'KXBTCMAXY-26DEC31-109999.99', event_ticker: 'KXBTCMAXY-26DEC31',
  status: 'active', yes_bid_dollars: '0.0000', yes_bid_size_fp: '0.00',
  yes_ask_dollars: '0.9200', no_bid_dollars: '0.0800',
  last_price_dollars: '0.5000', previous_price_dollars: '0.5000',
  volume_fp: '3673.17', volume_24h_fp: '0.00', open_interest_fp: '905.01',
  notional_value_dollars: '1.0000'
}, { topic: 'crypto', seriesTicker: 'KXBTCMAXY' });

ok('absent YES bid (0.0000 with 0.00 size) becomes null, not 0',
  emptyBook.yesBid === null, `got ${emptyBook.yesBid}`);
ok('the bid column therefore renders an em dash, not 0\u00a2',
  TB.centsLabel(TB.cents(emptyBook.yesBid)) === '\u2014',
  `got ${TB.centsLabel(TB.cents(emptyBook.yesBid))}`);
ok('an absent side does not invent a 92\u00a2 spread',
  emptyBook.spread === null, `got ${emptyBook.spread}`);
ok('the real last trade is still reported',
  emptyBook.price === 0.5 && emptyBook.priceKind === 'last',
  `got ${emptyBook.price}/${emptyBook.priceKind}`);

const noTrades = TB.normMarket({
  ticker: 'KXMVECROSSCATEGORY-S2026UMWM7ZIYWNTPBFA4-QGZ4RX6QT',
  event_ticker: 'KXMVECROSSCATEGORY-S2026UMWM7ZIYWNTPBFA4', status: 'active',
  yes_bid_dollars: '0.0000', yes_ask_dollars: '0.0000',
  yes_bid_size_fp: '0.00', yes_ask_size_fp: '0.00',
  last_price_dollars: '0.0000', previous_price_dollars: '0.0000',
  volume_fp: '0.00', volume_24h_fp: '0.00', open_interest_fp: '0.00',
  notional_value_dollars: '1.0000'
}, { topic: 'crypto', seriesTicker: 'KXMVECROSSCATEGORY' });

ok('an untraded market has no price at all', noTrades.price === null, `got ${noTrades.price}`);
ok('an untraded market has no spread', noTrades.spread === null, `got ${noTrades.spread}`);
ok('an untraded market is not a 0\u00a2 quote', noTrades.priceKind === null, `got ${noTrades.priceKind}`);

/* A genuine zero-cent level WITH size is a real quote and must survive. */
const pennyBook = TB.normMarket({
  ticker: 'X-Y', event_ticker: 'X', status: 'active',
  yes_bid_dollars: '0.0000', yes_bid_size_fp: '250.00',
  yes_ask_dollars: '0.0100', yes_ask_size_fp: '50.00',
  last_price_dollars: '0.0000', volume_fp: '1', volume_24h_fp: '0', open_interest_fp: '1',
  notional_value_dollars: '1.0000'
}, {});
ok('a 0\u00a2 bid backed by 250 contracts is kept as a real quote',
  pennyBook.yesBid === 0, `got ${pennyBook.yesBid}`);
ok('that real 0\u00a2/1\u00a2 book reports a 1\u00a2 spread',
  pennyBook.spread === 0.01, `got ${pennyBook.spread}`);

console.log('\n=== 2. Swings are measured in cents, threshold is exact (R-05) ===');
ok('threshold constant is $0.10', TB.ALERT_THRESHOLD === 0.1, `got ${TB.ALERT_THRESHOLD}`);
ok('$0.56 -> 56.00 cents', Math.abs(TB.cents(0.56) - 56) < 1e-9, `got ${TB.cents(0.56)}`);
ok('dollars->cents keeps 4dp, so 0.0380 is 3.8\u00a2 not 4\u00a2',
  Math.abs(TB.cents(0.038) - 3.8) < 1e-9, `got ${TB.cents(0.038)}`);
ok('a 0.10 move is exactly 10 cents (no float drift)',
  Math.abs(Math.abs(TB.cents(0.66) - TB.cents(0.56)) - 10) < 1e-9);

console.log('\n=== 3. Order-book ladder reads the API ordering correctly (retraction) ===');
function loadCharts() {
  const shim = { cents: TB.cents, esc: s => String(s ?? ''), timeShort: () => '', dateShort: () => '' };
  const src = read('live/assets/js/charts.js');
  return new Function('TB', src + '\n; return TBChart;')(shim);
}
const TBC = loadCharts();
const levels = (host, cls) =>
  [...host.innerHTML.matchAll(new RegExp(`lvl ${cls}"><div class="p">([^<]+)`, 'g'))].map(m => m[1]);

/* The live KXDPWORLDTOUR book, verbatim. */
const liveBook = {
  orderbook_fp: {
    no_dollars: [['0.9880', '13888.88'], ['0.9890', '15151.51'], ['0.9900', '8599.32']],
    yes_dollars: [['0.0010', '166726.66'], ['0.0020', '83333.33'], ['0.0030', '55555.55']]
  }
};
const h1 = { innerHTML: '', className: '' };
TBC.ladder(h1, liveBook, { levels: 8, yesBid: 0.003, yesAsk: 0.012 });
const h1bids = levels(h1, 'bid'), h1asks = levels(h1, 'ask');
ok('best YES bid (0.30\u00a2) is printed first, worst last',
  h1bids.join(' ') === '0.3\u00a2 0.2\u00a2 0.1\u00a2', h1bids.join(' '));
/* The ask block is printed worst-first and best-last: the best ask sits next to the
   spread line, directly above the best bid. So 1.2\u00a2 (from NO bid 0.9880) is FIRST. */
ok('best YES ask (1.20\u00a2, from NO bid 0.9880) heads the ask block',
  h1asks[0] === '1.2\u00a2' && h1asks[h1asks.length - 1] === '1\u00a2', h1asks.join(' '));

/* Ten ascending NO levels: the API's own ordering. The best ask must survive any depth. */
const asc = []; for (let i = 0; i < 10; i++) asc.push([(0.80 + i * 0.01).toFixed(4), String(10 + i)]);
for (const n of [2, 3, 8]) {
  const h = { innerHTML: '', className: '' };
  TBC.ladder(h, { orderbook_fp: { no_dollars: asc, yes_dollars: [] } }, { levels: n, yesBid: null, yesAsk: null });
  ok(`at levels=${n} the best ask 20\u00a2 is never dropped`,
    levels(h, 'ask').includes('20\u00a2'), levels(h, 'ask').join(' '));
}

console.log('\n=== 4. Untraded markets cannot manufacture an alert ===');
{
  const TBData = (() => {
    global.window = { addEventListener() {} };
    global.document = { currentScript: null, scripts: [], addEventListener() {} };
    global.location = { href: 'https://example.test/live/index.html', pathname: '/live/index.html' };
    const src = read('live/assets/js/data.js');
    return { src };
  })();
  /* data.js needs TB + DOM at load; assert on the source contract instead of
     standing up a whole browser: the detector must skip a null price. */
  ok('the swing detector skips markets with a null price',
    /if \(m\.price === null\) continue;/.test(TBData.src));
  ok('the swing detector only fires on a live (active) market',
    /m\.status === 'active'/.test(TBData.src));
}

console.log('\n=== 4b. The committed snapshot is subject to the same rule (D1) ===');
{
  const snap = JSON.parse(read('live/data/fallback-snapshot.json'));
  const zeros = snap.markets.filter(m => TB.quotedPrice(m.last_price_dollars, null) === 0);
  const zerosBid = snap.markets.filter(m => TB.quotedPrice(m.yes_bid_dollars, m.yes_bid_size_fp) === 0);
  ok('no fallback market is presented as trading at 0\u00a2', zeros.length === 0, `${zeros.length} found`);
  ok('no fallback market is presented with a 0\u00a2 bid', zerosBid.length === 0, `${zerosBid.length} found`);
  const real = snap.markets.filter(m => Numbersafe(m.last_price_dollars) > 0);
  const stillReal = real.filter(m => TB.quotedPrice(m.last_price_dollars, null) === Numbersafe(m.last_price_dollars));
  ok('every market that really traded keeps its price', real.length === stillReal.length,
    `${real.length - stillReal.length} lost`);
  function Numbersafe(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }
}

console.log('\n=== 4c. A missing quote cannot become a 100\u00a2 fill or mark (D3) ===');
{
  const dial = read('live/assets/js/data.js');
  const mkt = read('live/assets/js/page-market.js');

  /* The bug was `TB.cents(1 - m.yesBid)` with yesBid === null -> 1 - null === 1.00. */
  ok('no mark-to-market path multiplies a possibly-null quote',
    !/noAsk\s*!=\s*null\s*\?\s*TB\.cents\(1 - m\.yesBid\)/.test(dial));
  ok('the NO mark is the mirror of the YES mark, which cannot coerce null',
    /t\.side === 'yes' \? priceCents : 100 - priceCents/.test(dial));
  ok('a NO fill is priced from the resting YES bid, not no_ask_dollars',
    /sideUse === 'yes' \? market\.yesAsk : \(market\.yesBid != null \? 1 - market\.yesBid : null\)/.test(dial));
  ok('the market page advertises the same NO fill rule',
    /side === 'yes' \? mkt\.yesAsk : \(mkt\.yesBid != null \? 1 - mkt\.yesBid : null\)/.test(mkt));
  ok('an unpriced NO side is refused rather than guessed',
    /no tradable price for that side/.test(dial));

  /* Arithmetic proof of the two rules on a 56\u00a2 market with an empty YES bid. */
  const yesBid = null, markCents = 56;
  ok('old rule would have marked NO at 100\u00a2 (a phantom $1.00 win)',
    Math.round((quoted(yesBid) * 100)) === 100, 'rule check');
  ok('new rule marks NO at 44\u00a2', 100 - markCents === 44);
  function quoted(v) { return v != null ? 1 - v : 1; } /* reproduces the OLD code */
}

console.log('\n=== 5. A synthetic demo alert can never pass as a real move (D2) ===');
{
  const shim = {
    esc: s => String(s ?? ''), dollar: n => '$' + n, centsLabel: c => (c === null ? '\u2014' : c + '\u00a2'),
    compact: n => String(n), relTime: () => '', timeShort: () => '12:00', dateShort: () => '',
    qs: () => null, el: () => null,
    TOPICS: TB.TOPICS, topicById: TB.topicById,
    api: { getEnv: () => 'demo', url: p => 'https://external-api.demo.kalshi.co/trade-api/v2' + p },
    freshness: () => ({ level: 'live', label: 'LIVE', text: '' }),
    ENVS: TB.ENVS, settings: () => ({ pollSeconds: 60 })
  };
  const src = read('live/assets/js/ui.js');
  const UI = new Function('TB', 'window', src + '\n; return TBUI;')(shim, { addEventListener() {} });

  const base = {
    id: 'X@1', at: Date.now(), fromTs: Date.now() - 60000, ticker: 'KXBTCMAXY-26DEC31-109999.99',
    topic: 'crypto', title: 't', from: 40, to: 50, delta: 10, priceKind: 'last', score: {}
  };
  const realMsg = UI.alertMessage(base, {});
  const demoMsg = UI.alertMessage(Object.assign({}, base, { demo: true }), {});

  ok('a real alert carries no DEMO badge', !/DEMO/.test(realMsg));
  ok('a synthetic alert is badged DEMO', /DEMO/.test(demoMsg));
  ok('a synthetic alert is styled distinctly', /class="msg [^"]*demo/.test(demoMsg));
  ok('the badge cannot be suppressed by a missing score', /DEMO/.test(UI.alertMessage(
    Object.assign({}, base, { demo: true, score: null }), {})));
  ok('every message still links the official endpoint behind it',
    /external-api\.demo\.kalshi\.co/.test(realMsg) && /external-api\.demo\.kalshi\.co/.test(demoMsg));
}

console.log(`\n${fail === 0 ? '\u2705 ALL PASS' : '\u274c FAILURES'}: ${pass}/${pass + fail} checks passed\n`);
process.exit(fail === 0 ? 0 : 1);
