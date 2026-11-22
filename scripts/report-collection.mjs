// Publish small, source-linked CI evidence through the GitHub Checks API.
// This avoids relying solely on downloadable artifacts for a manual source audit.
import {readFile} from 'node:fs/promises';
import {TOPICS,exposure} from '../src/engine.js';
const s=JSON.parse(await readFile('data/snapshot.json','utf8'));
const sample=TOPICS.flatMap(topic=>s.markets.filter(m=>m.topic===topic).sort((a,b)=>(exposure(b)??-1)-(exposure(a)??-1)).slice(0,3)).map(({rules,...m})=>m);
const seed={...s,markets:sample,history:Object.fromEntries(sample.map(m=>[m.ticker,(s.history[m.ticker]||[]).slice(-20)])),alerts:[],
  coverage:{...s.coverage,complete:false,fullCollectionComplete:s.coverage.complete,totalCollectedMarkets:s.markets.length,
    scope:'Seed sample: up to three highest face-value contracts per matched topic; long rules omitted, history limited to 20 observations. Scheduled deployment collects the full scoped universe.'},
  errors:[...s.errors,'Seed sample only; see collection evidence for full universe counts.']};
const counts=Object.fromEntries(TOPICS.map(t=>[t,s.markets.filter(m=>m.topic===t).length]));
const summary=`Official demo collection observed ${s.observedAt}. ${s.markets.length} normalized market records. Coverage complete: ${s.coverage.complete}.\n\nTopic counts: ${JSON.stringify(counts)}\n\nErrors: ${JSON.stringify(s.errors)}\n\nSource: https://external-api.demo.kalshi.co/trade-api/v2\n\nSeed evidence (directly normalized observations; no test fixtures):\n\n\`\`\`json\n${JSON.stringify(seed)}\n\`\`\``;
if(Buffer.byteLength(summary)>65000)throw Error('Evidence exceeds GitHub check output limit');
const r=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/check-runs`,{method:'POST',headers:{
  Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
  body:JSON.stringify({name:'Official demo collection evidence',head_sha:process.env.GITHUB_SHA,status:'completed',conclusion:s.coverage.complete&&s.markets.length?'success':'neutral',output:{title:`${s.markets.length} official demo market observations`,summary}})});
if(!r.ok)throw Error(`Cannot publish collection evidence: HTTP ${r.status}`);
console.log(JSON.stringify({counts,records:s.markets.length,coverage:s.coverage,errors:s.errors,evidenceUrl:(await r.json()).html_url}));
