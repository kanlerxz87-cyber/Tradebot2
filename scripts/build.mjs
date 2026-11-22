import {mkdir, cp, rm, writeFile, readFile} from 'node:fs/promises';
import {TOPICS,groupEvents} from '../src/engine.js';
await rm('dist',{recursive:true,force:true}); await mkdir('dist/data/topics',{recursive:true});
for(const f of ['index.html','src','docs']) await cp(f,`dist/${f}`,{recursive:true});
const full=JSON.parse(await readFile('data/snapshot.json','utf8'));
const overview=[];
const topicCounts={};
for(const topic of TOPICS){
 const markets=full.markets.filter(m=>m.topic===topic);topicCounts[topic]={contracts:markets.length,events:new Set(markets.filter(m=>['active','open'].includes(m.status)).map(m=>m.eventTicker)).size};
 const history=Object.fromEntries(markets.filter(m=>full.history[m.ticker]?.length).map(m=>[m.ticker,full.history[m.ticker]]));
 await writeFile(`dist/data/topics/${topic.toLowerCase().replaceAll(' ','-')}.json`,JSON.stringify({markets,history,observedAt:full.observedAt,coverage:full.coverage}));
 for(const group of groupEvents(markets).slice(0,10))overview.push(...group.markets);
}
const ids=new Set(overview.map(m=>m.ticker));
const index={...full,markets:overview,history:Object.fromEntries(Object.entries(full.history).filter(([id])=>ids.has(id))),topicCounts,
 viewScope:'Overview shows the ten highest tracked face-value events per topic. Category pages automatically load every collected contract for that topic.'};
await writeFile('dist/data/snapshot.json',JSON.stringify(index));
await writeFile('dist/.nojekyll','');
console.log(`Built static dashboard → dist. ${full.markets.length} total contracts; ${overview.length} in overview; full topic shards available.`);
