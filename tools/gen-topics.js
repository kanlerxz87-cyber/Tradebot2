/* tools/gen-topics.js — generates the five topic pages from a shared
   template. Run: node tools/gen-topics.js  (idempotent) */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const TOPICS = {
  gas: {
    name: "Gas Prices",
    intro: "US retail gas and fuel markets. Live demo series: <b>KXAAAGASW</b> (AAA average US regular gas, daily strikes) — the only gas series with markets in the demo environment. The EIA-based series <b>KXGAS</b> (Gas weekly), <b>DIESEL</b> and <b>DIESELM</b> exist in the demo with official settlement sources but <b>zero markets</b> (verified empty, not inferred).",
    extra: `
      <div class="card">
        <h2>AAA gas strike ladder <span class="tag">KXAAAGASW-26NOV23 · settles Nov 23, 2026 · notional by total volume</span></h2>
        <div id="gasladder"></div>
        <p class="note">Current AAA national regular price per the official demo site: <b>$3.65 (+0.5% 1D)</b> — <a href="https://demo.kalshi.co/markets/kxaaagasw/us-gas-price-up/kxaaagasw-26nov23" target="_blank" rel="noopener">demo.kalshi.co (verified)</a>. All six open strikes sit at $0.02 (≈2% implied probability), consistent with the current price well below the $3.84–$3.94 ladder.</p>
      </div>
      <div class="card">
        <h2>Gas series census in the demo <span class="tag">verified via Get Series / Get Markets</span></h2>
        <table><thead><tr><th>Series</th><th>Title (official)</th><th>Frequency</th><th>Settlement source (official)</th><th>Demo markets</th><th>Source</th></tr></thead><tbody>
          <tr><td class="mono">KXAAAGASW</td><td>US gas price up (AAA)</td><td>daily</td><td><a href="https://www.aaa.com/gasprices/" target="_blank" rel="noopener">AAA gas prices</a></td><td><span class="badge open">LIVE — 6+ open strikes</span></td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXAAAGASW&status=open&limit=6" target="_blank" rel="noopener">API query</a></td></tr>
          <tr><td class="mono">KXGAS</td><td>Gas weekly</td><td>weekly</td><td><a href="https://www.eia.gov/dnav/pet/PET_PRI_GND_DCUS_NUS_W.htm" target="_blank" rel="noopener">U.S. EIA</a></td><td><span class="badge warn">0 markets (verified empty)</span></td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/series/KXGAS" target="_blank" rel="noopener">series</a> · <a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXGAS&limit=3" target="_blank" rel="noopener">markets</a></td></tr>
          <tr><td class="mono">DIESEL</td><td>Diesel price this week</td><td>weekly</td><td><a href="https://www.eia.gov/dnav/pet/PET_PRI_SPT_S1_D.htm" target="_blank" rel="noopener">U.S. EIA</a></td><td><span class="badge warn">0 markets (verified empty)</span></td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/series?tags=Gas&limit=10" target="_blank" rel="noopener">API query</a></td></tr>
          <tr><td class="mono">DIESELM</td><td>Diesel price this month</td><td>monthly</td><td><a href="https://www.eia.gov/dnav/pet/PET_PRI_SPT_S1_D.htm" target="_blank" rel="noopener">U.S. EIA</a></td><td><span class="badge warn">0 markets (verified empty)</span></td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/series?tags=Gas&limit=10" target="_blank" rel="noopener">API query</a></td></tr>
        </tbody></table>
      </div>`
  },
  elections: {
    name: "Elections",
    intro: "US and international election markets. The demo's active election event is <b>KXSENMAJ-27</b> — 120th Congress Senate Majority Leader (the demo site shows <b>$434,922 volume</b> on it). Long-dated <b>KXCONTROLH-2030</b> (House control 2030) markets are also open with thin books. The <b>KXGA14SPECIAL1ROUND</b> market is tracked to its verified resolution (NO).",
    extra: `
      <div class="card">
        <h2>Senate Majority Leader probability ladder <span class="tag">KXSENMAJ-27 · verified last prices</span></h2>
        <div id="senmaj-ladder"></div>
        <p class="note">Sources per row: <a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXSENMAJ&status=open&limit=6" target="_blank" rel="noopener">API query</a> · <a href="https://demo.kalshi.co/markets/kxsenmaj/120th-congress-who-will-be-elected-senate-majority-leader/kxsenmaj-27" target="_blank" rel="noopener">official demo page</a>. The demo site's headline narrative: "Democrats won control of the Senate in the midterms" (demo.kalshi.co, verified at snapshot time).</p>
      </div>
      <div class="card">
        <h2>Orderbook depth — verified <span class="tag">GET /markets/{ticker}/orderbook</span></h2>
        <div class="grid2">
          <div>
            <p class="note"><b>KXCONTROLH-2030-R</b> (Republicans, House 2030)</p>
            <div class="book"><div><div class="lvl bk"><span>YES bid $0.01</span><span>100 contracts</span></div><div class="lvl sk"><span>NO ask $0.99</span><span>—</span></div></div><div><div class="lvl sk"><span>NO bid —</span><span>—</span></div></div></div>
            <p class="srcs">source: <a href="https://external-api.demo.kalshi.co/trade-api/v2/markets/KXCONTROLH-2030-R/orderbook?depth=10" target="_blank" rel="noopener">orderbook endpoint (verified)</a></p>
          </div>
          <div>
            <p class="note"><b>KXBTCMAXY-26DEC31-99999.99</b> (BTC &gt; $100k by Dec 31)</p>
            <div class="book"><div><div class="lvl sk"><span>YES ask $0.07</span><span>2 contracts</span></div></div><div><div class="lvl bk"><span>NO bid $0.93</span><span>2 contracts</span></div></div></div>
            <p class="srcs">source: <a href="https://external-api.demo.kalshi.co/trade-api/v2/markets/KXBTCMAXY-26DEC31-99999.99/orderbook?depth=10" target="_blank" rel="noopener">orderbook endpoint (verified)</a></p>
          </div>
        </div>
      </div>`
  },
  culture: {
    name: "Culture",
    intro: "Awards, music, TV/film and video games. Live demo events: <b>KXNETFLIXRANKSHOWGLOBAL-26NOV23</b> (top global Netflix show, chart published Nov 24) and <b>KXGTAONLINE-GTA6ONLINE</b> (GTA VI Online release-date ladder, $28,123 volume per the official demo site). The Billboard Top Male Artist series (<b>KXBBMARTIST</b>) and Rotten Tomatoes (<b>KXRTFIRSTOMEN</b>) have <b>no demo markets</b> (verified empty).",
    extra: `
      <div class="card">
        <h2>GTA VI Online release ladder <span class="tag">verified last prices &amp; volume</span></h2>
        <div id="gta-ladder"></div>
        <p class="note">Settlement source: <a href="https://www.rockstargames.com/" target="_blank" rel="noopener">Rockstar Games</a> (from the API). <a href="https://demo.kalshi.co/markets/kxgtaonline/when-will-gta-vi-release/kxgtaonline-gta6online" target="_blank" rel="noopener">Official demo page (verified)</a>. Note the ladder is non-monotonic between the Feb-2027 and May-2027 legs in the demo data — flagged for review.</p>
      </div>
      <div class="card">
        <h2>Netflix global #1 show (Nov 23 chart) <span class="tag">KXNETFLIXRANKSHOWGLOBAL-26NOV23</span></h2>
        <div id="netflix-ladder"></div>
        <p class="note">Settlement source: <a href="https://www.netflix.com/tudum/top10" target="_blank" rel="noopener">Netflix Top 10</a>. <a href="https://demo.kalshi.co/markets/kxnetflixrankshowglobal/netflix-tv-ranking/kxnetflixrankshowglobal-26nov23" target="_blank" rel="noopener">Official demo page (verified)</a>.</p>
      </div>`
  },
  crypto: {
    name: "Crypto",
    intro: "The most active topic in the demo: rolling 15-minute BTC/ETH/DOGE/HYPE/SOL markets (CF Benchmarks RTI settlement), daily Bitcoin above/below ladders (KXBTCD), and the annual <b>KXBTCMAXY</b> &ldquo;how high will Bitcoin get&rdquo; ladder with real volume. The verified 15-min series below includes a real ≥$0.10 collapse that drives the alert demo.",
    extra: `
      <div class="card">
        <h2>Price chart — KXBTC15M-26NOV201900-00 <span class="tag">verified 1-minute candlesticks, 2026-11-20 23:45 → 00:00 UTC</span></h2>
        <div class="chartctl">
          <label>Time axis</label>
          <select id="btc-gran">
            <option value="0">as verified (1 min)</option>
            <option value="30">30-second buckets</option>
            <option value="60">1-minute buckets</option>
            <option value="300">5-minute buckets</option>
            <option value="3600">hour buckets</option>
          </select>
          <label><input type="checkbox" id="btc-candles" checked> candlesticks</label>
          <span class="note">x = time · y = contract price ($0–$1) · hover for OHLCV</span>
        </div>
        <div class="chartbox"><canvas id="btcchart"></canvas></div>
        <p class="note">Source: <a href="https://external-api.demo.kalshi.co/trade-api/v2/series/KXBTC15M/markets/KXBTC15M-26NOV201900-00/candlesticks?start_ts=1795216500&end_ts=1795219205&period_interval=1" target="_blank" rel="noopener">Get Market Candlesticks (verified)</a>. The move 0.51 → 0.19 in ~4 minutes is a real ≥$0.10 swing — the alert chats replay it. Settled <b>NO</b> at $0.003.</p>
      </div>
      <div class="card">
        <h2>Bitcoin 2026 max ladder <span class="tag">KXBTCMAXY-26DEC31 · verified last / volume / OI</span></h2>
        <div id="btcmaxy-ladder"></div>
        <p class="flagmark">⚑ Ladder non-monotonic in demo data ($109,999.99 leg at 0.50 vs $139,999.99 leg at 0.72) — see <a href="/dash/flagged/">Flagged for Review</a>.</p>
        <p class="note">Settlement: <a href="https://www.cfbenchmarks.com/data/indices/BRTI?ref=blog.cfbenchmarks.com" target="_blank" rel="noopener">CF Benchmarks BRTI (trimmed mean)</a>. <a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXBTCMAXY&limit=4" target="_blank" rel="noopener">API query (verified)</a>.</p>
      </div>
      <div class="card">
        <h2>15-minute crypto settlements (verified) <span class="tag">7:00 PM ET Nov 20 window</span></h2>
        <table><thead><tr><th>Market</th><th>Target (official rule)</th><th class="num">Last</th><th class="num">Volume</th><th>Result</th><th>Settled</th><th>Source</th></tr></thead><tbody id="crypto-settled"></tbody></table>
        <p class="note">Sources: <a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?min_updated_ts=1795219200&limit=100" target="_blank" rel="noopener">Get Markets (verified)</a> · settlement source for all four: <a href="https://www.cfbenchmarks.com/" target="_blank" rel="noopener">CF Benchmarks RTI</a>.</p>
      </div>`
  },
  golf: {
    name: "Golf",
    intro: "PGA Tour, majors and team events. At snapshot time the demo had <b>no open golf markets</b> (the most recent event, The RSM Classic cut markets, all settled Nov 20). The demo's largest golf dollar event is <b>KXPRESCUP-26</b> (2026 President's Cup, ≈$4.2M total notional) — tracked to its verified resolution: <b>Team USA (YES)</b>. Series census: KXPGAMAKECUT, KXPRESCUP, KXGOLFMAJORS, KXPGAMAJORTOP10, KXPGAR2LEAD, KXPGARYDERCUPD1, KXPRESCUP and more, all with PGA Tour / DP World Tour settlement sources.",
    extra: `
      <div class="card">
        <h2>2026 President's Cup — resolution (verified) <span class="tag">KXPRESCUP-26 · settled 2026-09-27 22:39 UTC</span></h2>
        <table><thead><tr><th>Market</th><th class="num">Last</th><th class="num">Total volume (notional)</th><th class="num">Open interest</th><th>Result</th><th>Source</th></tr></thead><tbody>
          <tr><td><b>Team USA</b> <span class="mono note">KXPRESCUP-26-USA</span></td><td class="num p up">0.47</td><td class="num">$393,982</td><td class="num">$204,731</td><td><span class="badge open">SETTLED YES</span></td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXPRESCUP&limit=3" target="_blank" rel="noopener">API (verified)</a></td></tr>
          <tr><td><b>Team World</b> <span class="mono note">KXPRESCUP-26-WORLD</span></td><td class="num p down">0.44</td><td class="num">$2,303,650</td><td class="num">$1,167,461</td><td><span class="badge done">SETTLED NO</span></td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXPRESCUP&limit=3" target="_blank" rel="noopener">API (verified)</a></td></tr>
          <tr><td><b>Tie</b> <span class="mono note">KXPRESCUP-26-TIE</span></td><td class="num p down">0.10</td><td class="num">$1,520,096</td><td class="num">$1,065,996</td><td><span class="badge done">SETTLED NO</span></td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXPRESCUP&limit=3" target="_blank" rel="noopener">API (verified)</a></td></tr>
        </tbody></table>
        <p class="note">Settlement source per the API: <a href="https://www.pgatour.com/" target="_blank" rel="noopener">PGA Tour / Governing League</a>. Total event notional ≈ <b>$4.22M</b> — the largest verified dollar event in the demo at snapshot time.</p>
      </div>
      <div class="card">
        <h2>PGA To Make Cut — The RSM Classic 2026 (settled) <span class="tag">KXPGAMAKECUT-THRC26</span></h2>
        <table><thead><tr><th>Market</th><th>Result (verified)</th><th>Settled</th><th>Source</th></tr></thead><tbody>
          <tr><td>Bill Haas makes the cut</td><td><span class="badge done">SETTLED NO</span></td><td class="mono">2026-11-20 22:08 UTC</td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXPGAMAKECUT&limit=8" target="_blank" rel="noopener">API (verified)</a></td></tr>
          <tr><td>Robert Streb makes the cut</td><td><span class="badge done">SETTLED NO</span></td><td class="mono">2026-11-20 22:08 UTC</td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXPGAMAKECUT&limit=8" target="_blank" rel="noopener">API (verified)</a></td></tr>
          <tr><td>Ryan Brehm makes the cut</td><td><span class="badge done">SETTLED NO</span></td><td class="mono">2026-11-20 22:08 UTC</td><td class="srcs"><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?series_ticker=KXPGAMAKECUT&limit=8" target="_blank" rel="noopener">API (verified)</a></td></tr>
        </tbody></table>
        <p class="note">Settlement source per the API: <a href="https://www.pgatour.com/" target="_blank" rel="noopener">PGA Tour</a> + <a href="https://www.espn.com" target="_blank" rel="noopener">ESPN</a>. No open golf markets in the demo at snapshot time (verified via the same queries) — the page will show the next tournament when the demo lists it.</p>
      </div>`
  }
};

const COMMON_TOP = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{NAME} — Kalshi Demo Dashboard</title>
<meta name="description" content="{NAME} events on the Kalshi demo exchange: verified live markets, prices, volume, liquidity and sources.">
<link rel="stylesheet" href="/dash/assets/style.css">
</head>
<body data-page="{SLUG}">

<div class="wrap">
  <div class="hero">
    <h1>{NAME}</h1>
    <p class="sub">{INTRO}</p>
  </div>

  <div class="card">
    <h2>Live events — {NAME} <span class="tag">active markets at snapshot, ranked by notional</span></h2>
    <div id="live-table"></div>
  </div>

  <div class="card">
    <h2>Resolved &amp; tracked to settlement — {NAME} <span class="tag">yes/no outcomes</span></h2>
    <div id="done-table"></div>
  </div>

{EXTRA}

  <div class="card">
    <h2>Events in this topic (grouped) <span class="tag">every event, every source link</span></h2>
    <div id="event-groups"></div>
  </div>
</div>
`;

const COMMON_BOTTOM = `
<script src="/dash/assets/data.js"></script>
<script src="/dash/assets/charts.js"></script>
<script src="/dash/assets/render.js"></script>
<script src="/dash/assets/layout.js"></script>
<script>
(function(){
  var D = window.KDATA, K = window.KRENDER, S = "{SLUG}";
  K.renderMarkets("live-table", {onlyTopic:S, onlyStatus:"live", ranked:true});
  K.renderMarkets("done-table", {onlyTopic:S, onlyStatus:"done", ranked:true});
  K.renderEvents("event-groups", {onlyTopic:S});
  var ms = (D.markets||[]).filter(function(m){return m.topic===S;});
  (function(){
    // topic-specific ladders
    function ladder(containerId, items, titleKey){
      if (!document.getElementById(containerId)) return;
      var max = Math.max.apply(null, items.map(function(i){return i.vol;}).concat([1]));
      var h = "";
      items.forEach(function(i){
        var pct = i.vol/max*100;
        h += '<div class="bar-row"><div class="lbl">'+K.esc(i.label)+'</div>' +
             '<div class="bar-track"><div class="bar-fill" style="width:'+Math.max(1.5,pct).toFixed(1)+'%"></div></div>' +
             '<div class="val">'+K.fmtVol(i.vol)+' · last '+K.fmtP(i.last)+'</div></div>';
      });
      document.getElementById(containerId).innerHTML = h;
    }
    if (S === "gas") {
      var gas = ms.filter(function(m){return m.series==="KXAAAGASW";});
      gas.sort(function(a,b){return parseFloat(a.market.split("-").pop()) - parseFloat(b.market.split("-").pop());});
      ladder("gasladder", gas.map(function(m){return {label: m.title, vol: m.volume||0, last: m.last};}));
    }
    if (S === "elections") {
      var sm = ms.filter(function(m){return m.series==="KXSENMAJ";});
      sm.sort(function(a,b){return (b.last||0)-(a.last||0);});
      ladder("senmaj-ladder", sm.map(function(m){return {label: m.title.replace(" wins Senate Majority Leader",""), vol: m.oi||1, last: m.last};}));
    }
    if (S === "culture") {
      var gta = ms.filter(function(m){return m.series==="KXGTAONLINE";});
      gta.sort(function(a,b){return (a.closeTime||"").localeCompare(b.closeTime||"");});
      ladder("gta-ladder", gta.map(function(m){return {label: m.title, vol: m.volume||0, last: m.last};}));
      var nflx = ms.filter(function(m){return m.series==="KXNETFLIXRANKSHOWGLOBAL";});
      nflx.sort(function(a,b){return (b.last||0)-(a.last||0);});
      ladder("netflix-ladder", nflx.map(function(m){return {label: m.title, vol: (m.oi||0)+ (m.last? m.last*100:0), last: m.last};}));
    }
    if (S === "crypto") {
      // candlestick chart
      var cd = D.candlesticks;
      var canvas = document.getElementById("btcchart");
      if (canvas && cd) {
        var pts = cd.candles.map(function(c){return {t:c.t, o:c.o, h:c.h, l:c.l, c:c.c, v:c.v};});
        function draw(){
          window.KCHART.drawPrice(canvas, {
            points: pts,
            granularity: parseInt(document.getElementById("btc-gran").value||"0",10),
            showCandles: document.getElementById("btc-candles").checked,
            title: "KXBTC15M-26NOV201900-00 — BTC up in next 15 min (settled NO @ 0.003)",
            subtitle: "1-min candles · CF Benchmarks BRTI · target $58,870",
            alertLevels: [{price:0.10, label:"alert zone $0.10"}]
          });
        }
        document.getElementById("btc-gran").onchange = draw;
        document.getElementById("btc-candles").onchange = draw;
        window.addEventListener("resize", draw);
        draw();
      }
      var bmax = ms.filter(function(m){return m.series==="KXBTCMAXY";});
      bmax.sort(function(a,b){
        var av = parseFloat(a.market.split("-").pop().replace(/\D/g,""))||0;
        var bv = parseFloat(b.market.split("-").pop().replace(/\D/g,""))||0;
        return av-bv;
      });
      ladder("btcmaxy-ladder", bmax.map(function(m){return {label: m.title, vol: m.volume||0, last: m.last};}));
      var cs = ms.filter(function(m){return m.settledResult && (m.series||"").indexOf("15M")>0;});
      var tb = document.getElementById("crypto-settled");
      if (tb) tb.innerHTML = cs.map(function(m){
        return '<tr><td class="mono note">'+m.market+'</td><td class="note">'+K.esc(m.rule.replace("then the market resolves to Yes.",""))+'</td>'+
          '<td class="num p">'+(m.last!=null?m.last.toFixed(3):"–")+'</td><td class="num">'+K.fmtVol(m.volume)+'</td>'+
          '<td><span class="badge '+(m.settledResult==="yes"?"open":"done")+'">'+m.settledResult.toUpperCase()+'</span></td>'+
          '<td class="mono">'+(m.settledTs||"").substr(0,16)+'Z</td>'+
          '<td class="srcs"><a href="'+m.src.api+'" target="_blank" rel="noopener">API (verified)</a></td></tr>';
      }).join("");
    }
  })();
})();
</script>
</body>
</html>
`;

Object.keys(TOPICS).forEach(function (slug) {
  const t = TOPICS[slug];
  let html = COMMON_TOP
    .split("{NAME}").join(t.name)
    .split("{SLUG}").join(slug)
    .split("{INTRO}").join(t.intro)
    .split("{EXTRA}").join(t.extra);
  html += COMMON_BOTTOM.split("{SLUG}").join(slug);
  const dir = path.join(ROOT, "dash", "topics", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  console.log("wrote dash/topics/" + slug + "/index.html");
});
