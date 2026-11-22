import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {API,normalize,emptyPaper} from '../../src/engine.js';
test('collector retains unresolved contracts despite discovery failure and samples real-shaped observations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tradebot-test-'));const file=join(dir,'snapshot.json');
 const series={ticker:'TEST',category:'Sports',tags:['Golf']};
 const raw={ticker:'TEST-CONTRACT',event_ticker:'TEST-EVENT',title:'Synthetic collector fixture',status:'active',last_price_dollars:'0.4',yes_bid_dollars:'0.49',yes_ask_dollars:'0.51',yes_ask_size_fp:'20',volume_fp:'200',volume_24h_fp:'200',open_interest_fp:'100',notional_value_dollars:'1'};
 const old=normalize({...raw,ticker:'OLD-CONTRACT',status:'closed'},{title:'Prior synthetic fixture'},series,new Date(Date.now()-300000).toISOString());
 await writeFile(file,JSON.stringify({markets:[old],history:{},alerts:[],paper:emptyPaper()}));
 const original=globalThis.fetch;const oldEnv={...process.env};
 process.env.SNAPSHOT_FILE=file;process.env.LIVE_SAMPLE_DELAY_MS='2';process.env.COLLECT_REQUEST_DELAY_MS='0';
 globalThis.fetch=async url=>({ok:true,json:async()=>{
   const path=new URL(url).pathname;
   if(path.endsWith('/series'))return {series:[series]};
   if(path.endsWith('/events'))return new URL(url).searchParams.has('cursor')?{invalid:true}:{events:[{event_ticker:'TEST-EVENT',series_ticker:'TEST',title:'Synthetic event',markets:[raw]}],cursor:'next'};
   if(path.endsWith('/OLD-CONTRACT'))return {market:{...raw,ticker:'OLD-CONTRACT',status:'closed'}};
   if(path.endsWith('/markets'))return {markets:[{...raw,last_price_dollars:'0.5'}]};
   throw Error('Unexpected test request '+url);
 }});
 try{await import('../../scripts/collect.mjs?test='+Date.now());const s=JSON.parse(await readFile(file,'utf8'));assert.equal(s.status,'partial');assert.equal(s.coverage.complete,false);assert.equal(s.markets.length,2);assert.ok(s.markets.some(m=>m.ticker==='OLD-CONTRACT'&&m.status==='closed'));assert.equal(s.alerts.length,1);assert.equal(s.alerts[0].delta,.1);assert.equal(s.paper.trades.length,1);assert.equal(s.history['TEST-CONTRACT'].length,2);}finally{globalThis.fetch=original;process.env=oldEnv;await rm(dir,{recursive:true,force:true});}
});
