import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {API, topicFor, normalize, swing, runPaper, emptyPaper} from '../src/engine.js';
const file = process.env.SNAPSHOT_FILE || 'data/snapshot.json';
let old; try {old = JSON.parse(await readFile(file,'utf8'));} catch {old = {};}
const errors = [], started = Date.now();
let calls = 0;
async function get(path) {
  if (Date.now() - started > 210000) throw new Error('Collection time budget exceeded; coverage incomplete');
  for(let i=0;i<3;i++) {
    calls++; await new Promise(r=>setTimeout(r,150));
    try {
      const r = await fetch(API+path, {signal: AbortSignal.timeout(20000)});
      if ([429,500,502,503,504].includes(r.status) && i<2) {await new Promise(r=>setTimeout(r,1000*2**i)); continue;}
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${path}`);
      return await r.json();
    } catch(e) {if(i===2) throw e;}
  }
}
const history = old.history || {}, previous = new Map((old.markets || []).map(m=>[m.ticker,m]));
const markets = new Map(), events = new Set(); let complete = true, seriesCount = 0;
try {
  const all = await get('/series?include_product_metadata=true');
  if (!Array.isArray(all.series)) throw new Error('Invalid series response');
  const series = new Map(all.series.filter(s=>topicFor(s)).map(s=>[s.ticker,s])); seriesCount = series.size;
  let cursor = '', seen = new Set();
  do {
    const page = await get(`/events?status=open&with_nested_markets=true&limit=200${cursor?'&cursor='+encodeURIComponent(cursor):''}`);
    if (!Array.isArray(page.events)) throw new Error('Invalid events response');
    for (const e of page.events) {
      const s = series.get(e.series_ticker); if (!s) continue;
      events.add(e.event_ticker);
      for (const raw of e.markets || []) {
        const m = normalize(raw,e,s,new Date().toISOString()); markets.set(m.ticker,m);
      }
    }
    cursor = page.cursor || '';
    if (cursor && seen.has(cursor)) throw new Error('Repeated pagination cursor');
    seen.add(cursor);
  } while(cursor);
  // Retain every previously observed contract until official settlement; never equate closed with resolved.
  for (const m of previous.values()) {
    if (markets.has(m.ticker)) continue;
    if(m.status==='settled' && m.result) {markets.set(m.ticker,m); continue;}
    try {
      const raw = (await get(`/markets/${encodeURIComponent(m.ticker)}`)).market;
      if (!raw) throw new Error('Missing market response');
      const updated = normalize(raw,{event_ticker:m.eventTicker,title:m.eventTitle,settlement_sources:m.settlementSources},
        {ticker:m.seriesTicker,category:m.officialCategory,categories:[m.officialCategory],tags:m.officialTags,product_metadata:{scope:m.officialScope}},new Date().toISOString());
      markets.set(m.ticker,updated);
    } catch(e) {complete=false; errors.push(`${m.ticker}: ${e.message}`); markets.set(m.ticker,m);}
  }
} catch(e) {complete=false;errors.push(e.message);}
if (!markets.size && previous.size) for(const [id,m] of previous) markets.set(id,m);
const now = new Date().toISOString(), alerts=[];
for (const m of markets.values()) {
  const p = previous.get(m.ticker);
  const a = swing(p,m,m.observedAt); if(a) alerts.push(a);
  const h = history[m.ticker] ||= [];
  if(m.last !== null && m.observedAt !== p?.observedAt) h.push({time:m.observedAt,price:m.last});
  // Bounded raw observations, not fabricated/interpolated seconds data.
  history[m.ticker]=h.slice(-2000);
}
const paper = runPaper(old.paper || emptyPaper(),[...markets.values()],alerts,now);
const result = {schemaVersion:1,observedAt:now,status:complete?'ok':'partial',markets:[...markets.values()],history,
  alerts:[...(old.alerts || []),...alerts].slice(-1000),paper,
  coverage:{complete,series:seriesCount,events:events.size,calls,scope:'Exact series categories/tags only; non-multivariate open events plus previously tracked markets.'},errors};
await mkdir('data',{recursive:true}); await writeFile(file,JSON.stringify(result));
console.log(JSON.stringify({status:result.status,markets:result.markets.length,coverage:result.coverage,errors}));
if (!result.markets.length) process.exitCode=1;
