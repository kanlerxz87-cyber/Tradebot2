/* Regression test for the selective high-ROI feed (the second scrolling chat).
 *
 * It exists because the feed rendered "0 model picks" for weeks without any gate
 * noticing: assets/js/core.js quotePrice() only knew the raw-API field names
 * (yes_bid_dollars / last_price_dollars) and every row in data/snapshot.json is
 * shaped `prices: {yes_bid, yes_ask, last, mid}`, so every evaluation returned
 * null. The floor check ("scoring is selective") and the no-null-quote check
 * together assert the behaviour the site promises:
 *
 *   1. seeded swings that carry a usable quote must produce at least one pick,
 *   2. no pick may price outside the published $0.10–$0.90 entry band,
 *   3. a row with no quote at all must still score null (nothing is invented).
 *
 * Run: node tests/js/model-feed.test.mjs   (needs jsdom: npm install jsdom)
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dom = new JSDOM('<body></body>', { runScripts: 'outside-only' });
const { window } = dom;

window.eval(fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8'));
const TB = window.TB;

const failures = [];
const notes = [];
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/snapshot.json'), 'utf8'));

const markets = new Map((snap.markets || []).map((m) => [m.ticker, m]));
const seeds = snap.alerts_seed || [];

if (!seeds.length) failures.push('snapshot.alerts_seed is empty; the test cannot judge the feed');
if (!markets.size) failures.push('snapshot.markets is empty');

/* ---- 1. the snapshot shape must produce a usable quote -------------------- */
const sample = markets.get(seeds[0] && seeds[0].ticker) || [...markets.values()][0];
if (sample) {
  const q = TB.quotePrice(sample);
  if (q.price === null) {
    failures.push(
      `quotePrice() returned null for a snapshot row (${sample.ticker}). ` +
      'prices.* is the shape the pages actually publish.'
    );
  } else {
    notes.push(`quotePrice(${sample.ticker}) = ${q.price} via ${q.basis}`);
  }
}

/* ---- 2. the feed is populated and selective ------------------------------- */
let opps = 0;
let passing = 0;
const outOfBand = [];
const implausible = [];
for (const alert of seeds) {
  const market = markets.get(alert.ticker);
  if (!market) continue;
  const opp = TB.bestOpportunity(Object.assign({}, market), alert);
  if (!opp) continue;
  opps += 1;
  const scoreOk = opp.score >= TB.CONFIG.modelScoreFloor && opp.estRoi >= TB.CONFIG.modelRoiFloor;
  if (!scoreOk) continue;
  passing += 1;
  if (opp.entry < TB.CONFIG.modelEntryFloor - 1e-9 || opp.entry > TB.CONFIG.modelEntryCeil + 1e-9) {
    outOfBand.push(`${alert.ticker} entry ${opp.entry}`);
  }
  if (!Number.isFinite(opp.estRoi) || opp.estRoi > 10) {
    implausible.push(`${alert.ticker} entry ${opp.entry} est. ROI ${opp.estRoi}`);
  }
}

if (opps === 0) {
  failures.push(
    'no seeded alert produced any opportunity: the high-ROI chat would render empty ' +
    'even though the snapshot carries quoteable markets'
  );
}
if (outOfBand.length) {
  failures.push(`picks priced outside the published band: ${outOfBand.slice(0, 5).join(', ')}`);
}
if (implausible.length) {
  failures.push(`implausible ROI (a sub-10c entry produces thousands of percent): ${implausible.slice(0, 5).join(', ')}`);
}
notes.push(`${opps} evaluated opportunities, ${passing} cleared both floors, out of ${seeds.length} seeded swings`);

/* ---- 3. no quote means no score, never a guessed one ---------------------- */
const noQuote = {
  ticker: 'TEST-NO-QUOTE', topic: 'crypto', title: 'no quote fixture',
  prices: { yes_bid: null, yes_ask: null, last: null, mid: null },
  close_time: new Date(Date.now() + 3600e3).toISOString(),
  volume: { last_24h_contracts: 0 }
};
if (TB.bestOpportunity(noQuote, { delta: 0.2, before: 0.4, after: 0.6 }) !== null) {
  failures.push('a market with no quote produced an opportunity; a missing value was substituted');
}

for (const n of notes) console.log('note:', n);
if (failures.length) {
  console.error(`\nFAILED: ${failures.length} model-feed check(s)`);
  for (const f of failures) console.error(' -', f);
  process.exit(1);
}
console.log('\nOK: the high-ROI feed is populated, selective and never prices a missing quote');
