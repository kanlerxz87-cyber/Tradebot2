/** Quote-integrity regressions from session d06c45b3, retained and adapted during
 * final integration. Fixtures below model recorded official payloads, not live
 * values. Sources: https://docs.kalshi.com/api-reference/market/get-markets and
 * https://docs.kalshi.com/api-reference/market/get-market-orderbook.
 * Run after installing jsdom: node live/tests/quote_rules.mjs
 *
 * Integration correction: NO bids .80..89 imply YES asks .20..11; the best
 * ask at depth 2 is 11c, not the 20c expected by the earlier test. Tests execute
 * the shipped functions instead of matching obsolete implementation strings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const dom = new JSDOM('<!doctype html><script src="assets/js/core.js"></script><div id="book"></div>', {
  url: 'https://example.test/Tradebot2/live/index.html', runScripts: 'outside-only'
});
const w = dom.window;
for (const [file, symbol] of [['core', 'TB'], ['data', 'TBData'], ['charts', 'TBChart'], ['ui', 'TBUI']]) {
  w.eval(read(`live/assets/js/${file}.js`) + `\nwindow.${symbol} = ${symbol};`);
}
const TB = w.TB, D = w.TBData, UI = w.TBUI;
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.error('  ✗ ' + name); } }
console.log('\n=== Empty-book zeros / genuine sized zero ===');
const emptyBook = TB.normMarket({ ticker: 'KXBTCMAXY-26DEC31-109999.99', event_ticker: 'KXBTCMAXY-26DEC31',
  status: 'active', yes_bid_dollars: '0.0000', yes_bid_size_fp: '0.00', yes_ask_dollars: '0.9200',
  no_bid_dollars: '0.0800', last_price_dollars: '0.5000', previous_price_dollars: '0.5000',
  volume_fp: '3673.17', volume_24h_fp: '0.00', open_interest_fp: '905.01', notional_value_dollars: '1.0000'
}, { topic: 'crypto', seriesTicker: 'KXBTCMAXY' });
ok('absent YES bid is null, not a 0c order', emptyBook.yesBid === null);
ok('absent bid displays blank', TB.centsLabel(TB.cents(emptyBook.yesBid)) === '—');
ok('absent side does not manufacture a 92c spread', emptyBook.spread === null);
ok('non-zero last trade is retained', emptyBook.price === 0.5 && emptyBook.priceKind === 'last');
const noTrades = TB.normMarket({ ticker: 'TEST-UNTRADED', status: 'active', yes_bid_dollars: '0.0000', yes_ask_dollars: '0.0000',
  yes_bid_size_fp: '0.00', yes_ask_size_fp: '0.00', last_price_dollars: '0.0000', volume_fp: '0.00' }, {});
ok('untraded empty book has no price', noTrades.price === null);
ok('untraded empty book has no spread', noTrades.spread === null);
ok('untraded price kind is not guessed', noTrades.priceKind === null);
const penny = TB.normMarket({ ticker: 'TEST-SIZED-ZERO', yes_bid_dollars: '0.0000', yes_bid_size_fp: '250.00',
  yes_ask_dollars: '0.0100', yes_ask_size_fp: '50.00', last_price_dollars: '0.0000' }, {});
ok('explicit 0c bid WITH positive size survives', penny.yesBid === 0);
ok('sized 0c/1c spread is exactly 1c', penny.spread === 0.01);
ok('threshold remains $0.10', TB.ALERT_THRESHOLD === 0.1);
ok('sub-cent dollars remain precise', TB.cents(0.038) === 3.8);
ok('10c move exact in cents', TB.cents(0.66) - TB.cents(0.56) === 10);
console.log('\n=== Best-level ordering, including depth truncation ===');
const host = w.document.querySelector('#book');
const book = { orderbook_fp: { no_dollars: [['0.9880', '13888.88'], ['0.9890', '15151.51'], ['0.9900', '8599.32']],
  yes_dollars: [['0.0010', '166726.66'], ['0.0020', '83333.33'], ['0.0030', '55555.55']] } };
w.TBChart.ladder(host, book, { levels: 8 });
const levels = side => [...host.querySelectorAll(`tr.${side} td:nth-child(2)`)].map(n => n.textContent);
ok('best bid appears first among bids', levels('bid').join(' ') === '0.3¢ 0.2¢ 0.1¢');
ok('best ask is adjacent to the bid block (worst ask first)', levels('ask').join(' ') === '1.2¢ 1.1¢ 1¢');
const asc = []; for (let i = 0; i < 10; i++) asc.push([(0.80 + i * 0.01).toFixed(4), String(10 + i)]);
for (const depth of [2, 3, 8]) {
  w.TBChart.ladder(host, { orderbook_fp: { no_dollars: asc, yes_dollars: [] } }, { levels: depth });
  ok(`best ask 11c survives depth=${depth}`, levels('ask').includes('11¢'));
  ok(`far ask 20c excluded at depth=${depth}`, !levels('ask').includes('20¢'));
}
console.log('\n=== No null-to-$1 fill or mark ===');
const raw = { ticker: 'TEST-NO-SIDE', event_ticker: 'TEST', market_type: 'binary', status: 'active',
  notional_value_dollars: '1.0000', yes_bid_dollars: '0.0000', yes_bid_size_fp: '0.00',
  yes_ask_dollars: '0.9200', yes_ask_size_fp: '10.00', no_bid_dollars: '0.0800', no_ask_dollars: '1.0000', last_price_dollars: '0.5000' };
const m = TB.normMarket(raw, { observedAt: w.Date.now() });
D.state.markets = [m]; D.resetPaper();
ok('no missing-side NO fill at phantom $1', !D.openTrade({ market: m, side: 'no', qty: 1 }).ok);
const valid = TB.normMarket({ ...raw, yes_bid_dollars: '0.54', yes_bid_size_fp: '100', yes_ask_dollars: '0.56',
  yes_ask_size_fp: '100', no_ask_dollars: '0.46', no_bid_dollars: '0.44' }, { observedAt: w.Date.now() });
D.state.markets = [valid];
const opened = D.openTrade({ market: valid, side: 'no', qty: 1 });
ok('a real NO ask/size can fill', opened.ok && opened.trade.entry === 0.46);
ok('NO mark is actual NO bid, never the NO ask', D.portfolio().open[0].markCents === 44);
valid.noBid = null;
ok('missing NO bid leaves mark blank (not $1)', D.portfolio().open[0].markCents === null);
valid.price = null; ok('null price cannot create a swing', D.recordAndDetect().length === 0);
console.log('\n=== Snapshot uses the same quote normalization ===');
const snap = JSON.parse(read('live/data/fallback-snapshot.json'));
ok('absent zero quotes in capture normalize to blank', snap.markets.filter(m => Number(m.yes_bid_dollars) === 0 && !(Number(m.yes_bid_size_fp) > 0))
  .every(m => TB.normMarket(m, {}).yesBid === null));
ok('positive captured trade prices survive', snap.markets.filter(m => Number(m.last_price_dollars) > 0)
  .every(m => TB.normMarket(m, {}).last === Number(m.last_price_dollars)));
console.log('\n=== Synthetic input cannot masquerade as real ===');
const alert = { id: 'TEST', at: w.Date.now(), fromTs: w.Date.now() - 60000, ticker: 'TEST-MARKET', topic: 'crypto',
  title: 'TEST ONLY', from: 40, to: 50, delta: 10, priceKind: 'last', score: null };
const real = UI.alertMessage(alert), demo = UI.alertMessage({ ...alert, demo: true });
ok('real alert carries no synthetic badge', !real.includes('synthetic'));
ok('defensive DEMO badge survives missing score', demo.includes('DEMO · synthetic'));
ok('synthetic message styled distinctly', /class="msg [^"]*demo/.test(demo));
ok('all messages still link official evidence', real.includes('external-api.demo.kalshi.co') && demo.includes('external-api.demo.kalshi.co'));
D.saveAlerts([{ ...alert, demo: true }]); ok('synthetic messages never enter v2 real feed', D.alerts().length === 0);
ok('synthetic insertion button removed', !read('live/index.html').includes('id="testAlert"'));
dom.window.close();
console.log(`\n${fail ? 'FAIL' : 'ALL PASS'}: ${pass}/${pass + fail} quote integrity checks.\n`);
process.exit(fail ? 1 : 0);
