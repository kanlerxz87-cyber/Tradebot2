import {readFile,access,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {sources,flags,requirements} from '../src/research.js';
import {API,TOPICS,sourceFor} from '../src/engine.js';
const html=await readFile('index.html','utf8');
for(const [,ref] of html.matchAll(/(?:href|src)="(\.[^"?#]+)"/g))await access(ref);
for(const file of (await readdir('src')).filter(f=>f.endsWith('.js'))){const code=await readFile('src/'+file,'utf8');for(const [,ref]of code.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))await access('src/'+ref);}
const official=new Set(['docs.kalshi.com','external-api.demo.kalshi.co','docs.github.com']);
for(const row of [...sources,...flags,...requirements]){assert.ok(official.has(new URL(row.url).hostname),`Non-official register source: ${row.url}`);assert.ok(row.title);}
const s=JSON.parse(await readFile('data/snapshot.json','utf8'));assert.equal(s.schemaVersion,1);assert.ok(Array.isArray(s.markets));
const seen=new Set();for(const m of s.markets){assert.ok(!seen.has(m.ticker),'Duplicate market');seen.add(m.ticker);assert.equal(m.source,sourceFor(m.ticker));assert.ok(TOPICS.includes(m.topic));assert.ok(m.observedAt&&Number.isFinite(Date.parse(m.observedAt)));for(const field of ['last','bid','ask','noAsk','settlement'])assert.ok(m[field]===null || typeof m[field]==='number'&&m[field]>=0&&m[field]<=1,`Invalid ${field}`);assert.ok(m.result===null||['yes','no'].includes(m.result));}
for(const a of s.alerts){assert.ok(a.source.startsWith(API+'/markets/'));assert.ok(Math.abs(a.delta)>=.1);assert.ok(a.windowSeconds>0&&a.windowSeconds<=120);assert.equal(a.expectedRoi,null);assert.equal(a.news,null);}
await access('docs/EXECUTIVE_SUMMARY.md');
console.log(`Verified local links/module imports, ${sources.length+flags.length+requirements.length} official-reference rows, ${seen.size} snapshot market records and alert schema. External market values require successful official collection; this is not an account audit.`);
