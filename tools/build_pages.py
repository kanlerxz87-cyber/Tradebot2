#!/usr/bin/env python3
"""Generate the static pages of the Kalshi Demo Desk (site/*.html).

Run from the repository root:  python3 tools/build_pages.py

The generated pages are committed, so GitHub Pages needs no build step. Every
page shares one header/nav (rendered by site/assets/app.js) and footer. Dynamic
numbers are filled in the browser from the JSON the collector writes, so the
numbers on the site always match the API data in data/.
"""
import pathlib

SITE = pathlib.Path(__file__).resolve().parent.parent / "site"

FOOTER = (
    '<footer>Kalshi <b>Demo</b> Desk · read-only public demo data · paper trades only · not financial advice · '
    '<a href="sources.html">Sources</a> · <a href="repo-review.html">Repo review</a> · '
    '<a href="flagged.html">Flagged for review</a></footer>'
)


def page(title, body, page_id="", topic=None, desc=""):
    attrs = f' data-page="{page_id}"' if page_id else ""
    if topic:
        attrs += f' data-topic="{topic}"'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Kalshi Demo Desk</title>
<meta name="description" content="{desc or title}">
<link rel="stylesheet" href="assets/style.css">
<script src="assets/app.js" defer></script>
</head>
<body{attrs}>
<header class="top" id="nav"></header>
<main>
{body}
</main>
{FOOTER}
</body>
</html>
"""


DEMO_NOTE = ('<div class="card flag"><b>Kalshi demo environment.</b> Every market on this site is read live from the '
             'Kalshi <b>demo</b> REST API (<code>external-api.demo.kalshi.co/trade-api/v2</code>). Kalshi documents that demo '
             'funds are mock funds, that demo credentials are separate from production, and that demo prices and behaviour '
             '"may not be reflective of those in real markets". '
             '<a href="https://docs.kalshi.com/getting_started/demo_env" target="_blank" rel="noopener noreferrer">Official source ↗</a>. '
             'Nothing here is trading advice, and no orders are placed.</div>')

HOME = f"""
<h1>Kalshi demo live desk</h1>
<p class="lead">Highest-dollar live events on the Kalshi demo exchange across <b>gas prices, elections, culture, crypto and golf</b>,
with $0.10 swing alerts, contract-price charts, order-book liquidity, paper-trade performance and resolution tracking.
Every value links to the official Kalshi endpoint that returned it.</p>
<div class="freshness" id="fresh"></div>
<div class="kpis" id="kpis"></div>
<p class="note" id="coverage-note"></p>

<h2>Highest-dollar live events</h2>
<p class="note">Ranked by <b>24h dollar notional (computed)</b> = Σ over the event's published markets of
<code>volume_24h_fp × last_price_dollars</code>. Both inputs are API fields; the product is arithmetic here, not an API field.
"24h contracts" is the raw API volume. Events with no traded notional sort below traded events.</p>
<div class="table-wrap"><table class="sourced">
<thead><tr><th class="num">#</th><th>Event</th><th>Topic</th><th class="num">24h contracts</th>
<th class="num">24h $ (computed)</th><th class="num">Open interest</th><th>Closes</th><th>Source</th></tr></thead>
<tbody id="top-events"></tbody></table></div>
<p class="note">Full ranking on <a href="dashboard.html">Markets</a>.</p>

<h2>Topics</h2>
<div class="tiles" id="topic-cards"></div>

<div class="chats" style="margin-top:22px">
  <div class="chat">
    <div class="chat-head"><b>Latest alerts (≥ $0.10)</b><a class="small" href="alerts.html">Open both live chats →</a></div>
    <div class="scroll" id="feed-preview" style="height:420px"></div>
  </div>
  <div class="chat">
    <div class="chat-head"><b>Resolved events — how it ended</b><a class="small" href="resolved.html">All resolutions →</a></div>
    <div style="padding:12px" id="resolved-strip"></div>
    <div style="padding:0 12px 12px">
      <h3>How to read this desk</h3>
      <p class="note"><b>Last</b> is the last traded YES price; “no trade” means no contract traded in the last 24h (the API
      returns 0, which is not a price). <b>Contracts at ask</b> is the size resting at the best YES ask. <b>24h $ (computed)</b>
      is volume × last price. <b>Cause</b> of a move is never claimed: the API does not report causes, so reference links are
      settlement/rules sources, not proof.</p>
      <p class="note">Refresh the page — it re-reads <code>data/</code> every 30 seconds. A scheduled GitHub Actions job
      rebuilds that data (default: every 10 minutes).</p>
    </div>
  </div>
</div>

{DEMO_NOTE}
"""

ALERTS = """
<h1>Live alerting — two scrolling chats</h1>
<p class="lead">An alert fires when a contract's <b>last price moves by $0.10 or more in either direction</b> between two
collection runs. <b>Chat 1</b> shows every alert. <b>Chat 2</b> shows only alerts that pass the high-ROI screen the model likes
(tight spread, size at the ask, 24h volume, entry between $0.05 and $0.95).</p>
<div class="freshness" id="fresh"></div>
<div class="kpis" id="alert-kpis"></div>
<div class="controls">
  <label>Topic <select id="topic-filter"><option value="all">All topics</option><option value="gas">Gas prices</option>
  <option value="elections">Elections</option><option value="culture">Culture</option><option value="crypto">Crypto</option>
  <option value="golf">Golf</option></select></label>
  <span class="note">Newest alerts at the bottom. The feed auto-scrolls unless you scroll up. Re-reads <code>data/</code> every 30 s.</span>
</div>
<div class="chats">
  <div class="chat"><div class="chat-head"><b>Chat 1 · All events (≥ $0.10)</b><span class="note">unfiltered</span></div>
    <div class="scroll" id="feed-all"></div></div>
  <div class="chat"><div class="chat-head"><b>Chat 2 · Model high-ROI picks</b><span class="note">rule-based screen</span></div>
    <div class="scroll" id="feed-roi"></div></div>
</div>
<div class="card">
  <h3>What the high-ROI screen is — and is not</h3>
  <p class="note">The screen is a fixed, published rule set evaluated at alert time: spread ≤ $0.03, at least 50 contracts resting
  at the YES ask, 24h volume ≥ 100 contracts, and entry price between $0.05 and $0.95. The ROI figure shown is a gross proxy,
  (1 − entry) ÷ entry, before fees. It is <b>not</b> a trained, backtested or validated model, and it does not look at news.
  <a href="findings.html">Method and limitations →</a></p>
</div>
<div class="card flag"><b>Why “sudden” is the collection interval and not a tick.</b> This page reads the collector's JSON, so a
$0.10 move is measured between runs. The demo API <b>does</b> allow browser reads: a probe from this site's own origin
(<code>https://kanlerxz87-cyber.github.io</code>) returned <code>Access-Control-Allow-Origin</code> equal to that origin with
<code>Access-Control-Allow-Credentials: true</code>, and the OPTIONS preflight returned 204 with the same origin — measured by
CI on 2026-11-22 and published in
<a href="data/probe.json">data/probe.json</a>. A per-second alert feed would therefore only need a browser polling loop (or a
WebSocket client, which <b>does</b> require a signed handshake — the unauthenticated handshake was rejected with HTTP 401).
<a href="suggestions.html">Suggestions →</a></div>
"""

DASHBOARD = """
<h1>Markets — the whole published book</h1>
<p class="lead">Every demo market that traded in the last 24 hours or carries open interest, grouped by event and topic.
Filter by topic, by minimum 24h volume, or search titles and tickers.</p>
<div class="freshness" id="fresh"></div>
<div class="controls">
  <label>Topic <select id="topic-filter"><option value="all">All topics</option><option value="gas">Gas prices</option>
  <option value="elections">Elections</option><option value="culture">Culture</option><option value="crypto">Crypto</option>
  <option value="golf">Golf</option></select></label>
  <label>Min 24h contracts <select id="min-vol"><option value="0">any</option><option value="1">1</option>
  <option value="100">100</option><option value="1000">1,000</option><option value="10000">10,000</option></select></label>
  <label>Search <input type="search" id="q" placeholder="ticker, title, event…"></label>
</div>
<h2>Events ranked by 24h dollar notional (computed)</h2>
<div class="table-wrap"><table class="sourced">
<thead><tr><th class="num">#</th><th>Event</th><th>Topic</th><th class="num">24h contracts</th>
<th class="num">24h $ (computed)</th><th class="num">Open interest</th><th>Closes</th><th>Source</th></tr></thead>
<tbody id="top-events"></tbody></table></div>
<h2>All published markets</h2>
<p class="note" id="mk-head"></p>
<div id="mk-table"></div>
<div class="card flag"><b>Contract price read-out.</b> A last price of 0 with no volume is shown as “no trade”, not $0.00,
because the API uses 0 for “no trade” rather than a price. Bid/ask and resting size are shown as returned.
Rows without an API value are marked <span class="unv">unverified</span> rather than filled in.</div>
"""


def topic_page(key, label, lead, note):
    return f"""
<h1>{label}</h1>
<p class="lead">{lead}</p>
<p class="note" id="topic-note"></p>
<div class="freshness" id="fresh"></div>
<h2>Events ranked by 24h dollar notional (computed)</h2>
<div class="table-wrap"><table class="sourced">
<thead><tr><th class="num">#</th><th>Event</th><th>Topic</th><th class="num">24h contracts</th>
<th class="num">24h $ (computed)</th><th class="num">Open interest</th><th>Closes</th><th>Source</th></tr></thead>
<tbody id="topic-events"></tbody></table></div>
<h2>Markets in this topic</h2>
<p class="note">{note}</p>
<div id="mk-table"></div>
<h2>Alerts for this topic (≥ $0.10)</h2>
<div class="chat"><div class="scroll" id="feed" style="height:380px"></div></div>
{DEMO_NOTE}
"""


CHART = """
<h1>Chart & liquidity</h1>
<p class="lead">YES contract price over time with <b>seconds, minutes or hours</b> on the X axis, plus the resting order book:
how many contracts are available at each price.</p>
<div class="freshness" id="fresh"></div>
<div class="controls">
  <label>Market <select id="ticker"></select></label>
  <label>X axis <select id="mode">
    <option value="seconds">Seconds — trade tape (≤ 6h)</option>
    <option value="minutes" selected>Minutes — 1-minute candles</option>
    <option value="hours">Hours — 1-hour candles (≤ 30d)</option>
  </select></label>
  <span id="ctl-range">
    <button data-r="1h">1h</button><button data-r="6h" class="on">6h</button>
    <button data-r="24h">24h</button><button data-r="7d">7d</button><button data-r="30d">30d</button>
  </span>
  <button class="ghost" id="refresh-now">Refresh data</button>
</div>
<div class="card" id="mkinfo"></div>
<div class="card" id="chart"></div>
<div id="book"></div>
<div class="card">
  <h3>Axes and units</h3>
  <p class="note">X axis is time (labels in UTC; the data file timestamps are UTC). Y axis is the YES contract price in dollars,
  on a $0.00–$1.00 scale where $1.00 is a certain YES. Seconds mode plots individual prints from
  <code>GET /markets/trades</code>; minutes mode plots 1-minute candles and hours mode 1-hour candles from
  <code>GET /series/{series_ticker}/markets/{ticker}/candlesticks</code>. Dashed red lines mark recorded ≥ $0.10 alerts.
  Grey bars show contracts traded per period.</p>
  <p class="note">Candles and the trade tape are captured for the most active markets only (to stay inside public rate limits).
  Other markets fall back to collection-run snapshots, labelled “snapshot mode”.</p>
</div>
"""

PORTFOLIO = """
<h1>Portfolio & strategy lab</h1>
<p class="lead">Automated paper trades opened from high-ROI alerts, marked against live YES bids, settled at resolution
($1.00 for YES, $0.00 for NO). Performance is broken out by strategy, topic and alert direction so trade types can be compared.</p>
<div class="freshness" id="fresh"></div>
<div class="kpis" id="pf-kpis"></div>
<div id="trade-body"></div>
<h2>Strategy definitions</h2>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>Strategy</th><th>Rule</th><th>Risk control</th><th>Source</th></tr></thead>
<tbody>
<tr><td><code>follow_rise</code></td><td>Buy YES at the ask after an alert with Δ ≥ +$0.10 that passes the high-ROI screen.</td>
<td>10 contracts; +$0.05 target or −$0.05 stop on the YES bid; 48h time stop.</td>
<td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/scripts/kalshi_collector.py" target="_blank" rel="noopener noreferrer">collector</a></td></tr>
<tr><td><code>fade_drop</code></td><td>Buy YES at the ask after an alert with Δ ≤ −$0.10 that passes the high-ROI screen.</td>
<td>Same bracket and time stop.</td>
<td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/scripts/kalshi_collector.py" target="_blank" rel="noopener noreferrer">collector</a></td></tr>
<tr><td>Resolution hold</td><td>Any open paper position that reaches settlement is closed at the API <code>result</code> value.</td>
<td>No leverage; 1 contract pays $1.00 or $0.00.</td>
<td><a href="https://docs.kalshi.com/api-reference/market/get-market" target="_blank" rel="noopener noreferrer">GET /markets/{ticker}</a></td></tr>
</tbody></table></div>
<div class="card flag"><b>This is not the Kalshi demo account.</b> The portfolio is computed from simulated fills at API prices.
Connecting the real demo account (balance, positions, fills) needs API-key credentials in repository secrets; none are set.
See <a href="flagged.html">Flagged for review</a>.</div>
"""

RESOLVED = """
<h1>Resolved events</h1>
<p class="lead">Markets are tracked after they leave the open listing and are re-checked with <code>GET /markets/{ticker}</code>
until the API reports <code>result</code> = <b>yes</b> or <b>no</b>. That result, and the settlement value when present, are shown here.</p>
<div class="freshness" id="fresh"></div>
<div class="kpis" id="res-kpi"></div>
<div id="res-table"></div>
<p class="note">Resolution comes from the market object's <code>result</code> field
(<a href="https://docs.kalshi.com/api-reference/market/get-market" target="_blank" rel="noopener noreferrer">official docs ↗</a>).
Where the API returns an empty result, the market stays open on this list and no outcome is inferred.</p>
"""

EXEC = """
<h1>Executive summary</h1>
<p class="lead">What this repository is, what is verified, how the numbers are produced, and what is deliberately not claimed.</p>

<h2>1. Purpose</h2>
<p>A read-only monitoring and paper-trading desk for the <b>Kalshi demo exchange</b>, covering five topics only:
gas prices, elections, culture, crypto and golf. It shows the highest-dollar live events, alerts on ≥ $0.10 contract moves in
two scrolling chats (all events, and a rule-based high-ROI subset), charts price against time with seconds/minutes/hours axes,
shows resting liquidity at each price, simulates trades, tracks their performance by strategy and topic, and records how events
resolve (YES or NO).</p>

<h2>2. Environment (verified 2026-11-22)</h2>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>Item</th><th>Value used here</th><th>Official source</th></tr></thead>
<tbody>
<tr><td>Demo REST base URL</td><td><code>https://external-api.demo.kalshi.co/trade-api/v2</code> (also supported:
<code>https://demo-api.kalshi.co/trade-api/v2</code>)</td>
<td><a href="https://docs.kalshi.com/getting_started/demo_env" target="_blank" rel="noopener noreferrer">Demo environment</a>,
<a href="https://docs.kalshi.com/getting_started/api_environments" target="_blank" rel="noopener noreferrer">API environments</a></td></tr>
<tr><td>Demo WebSocket</td><td><code>wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2</code> (also
<code>wss://demo-api.kalshi.co/trade-api/ws/v2</code>) — documented, <b>not used</b> by this static site</td>
<td><a href="https://docs.kalshi.com/getting_started/api_environments" target="_blank" rel="noopener noreferrer">API environments</a></td></tr>
<tr><td>Demo money</td><td>Mock funds; demo credentials are separate from production; prices “may not be reflective of those in
real markets”</td><td><a href="https://docs.kalshi.com/getting_started/demo_env" target="_blank" rel="noopener noreferrer">Demo environment</a></td></tr>
<tr><td>Exchange status at check time</td><td><code>exchange_active: true</code>, <code>trading_active: true</code></td>
<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/exchange/status" target="_blank" rel="noopener noreferrer">GET /exchange/status (live)</a></td></tr>
<tr><td>Production REST (for reference)</td><td><code>https://external-api.kalshi.com/trade-api/v2</code> — not used</td>
<td><a href="https://docs.kalshi.com/getting_started/api_environments" target="_blank" rel="noopener noreferrer">API environments</a></td></tr>
</tbody></table></div>

<h2>3. Topic mapping (official taxonomy)</h2>
<p>The five topics map onto Kalshi's published categories and tags. Kalshi has no “Culture” and no “gas prices” category, so two
mappings are approximations and are flagged on the site.</p>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>Topic</th><th>Kalshi filter used</th><th>Why</th><th>Official source</th></tr></thead>
<tbody>
<tr><td>Gas prices</td><td><code>category=Commodities&amp;tags=Oil &amp; Gas</code></td><td>Closest official tag; includes crude oil,
natural gas and heating oil, not only retail gasoline.</td>
<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories" target="_blank" rel="noopener noreferrer">tags_by_categories</a></td></tr>
<tr><td>Elections</td><td><code>category=Elections</code></td><td>Exact category.</td>
<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories" target="_blank" rel="noopener noreferrer">tags_by_categories</a></td></tr>
<tr><td>Culture</td><td><code>category=Entertainment</code></td><td>No “Culture” category exists; Entertainment is the nearest
(oscars, music, TV, box office).</td>
<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories" target="_blank" rel="noopener noreferrer">tags_by_categories</a></td></tr>
<tr><td>Crypto</td><td><code>category=Crypto</code></td><td>Exact category.</td>
<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories" target="_blank" rel="noopener noreferrer">tags_by_categories</a></td></tr>
<tr><td>Golf</td><td><code>category=Sports&amp;tags=Golf</code></td><td>Exact tag under Sports.</td>
<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories" target="_blank" rel="noopener noreferrer">tags_by_categories</a></td></tr>
</tbody></table></div>

<h2>4. Measured coverage</h2>
<p>At the 2026-11-22 snapshot the demo host returned <b>18,298 open markets</b> across these five filters
(≈13.7k crypto, 2.1k gas, 1.1k golf, 0.95k culture, 0.44k elections), from the top 40 series by volume in each topic.
The site publishes only markets that traded in 24h or carry open interest, capped per topic, and states how many were left out.
Series counts at the same time: crypto 321, elections 2,710, entertainment 2,631, golf 134, oil &amp; gas 25.
Live counts are on the <a href="index.html">desk</a>; raw counts are in <code>data/meta.json</code>.</p>

<h2>5. Alerting and “high ROI”</h2>
<ul>
<li><b>Alert rule:</b> |Δ last price| ≥ <b>$0.10</b> between consecutive collection runs, in either direction. $0.10 on a
$1.00-settling contract is 10 percentage points of implied probability.</li>
<li><b>Chat 1</b> shows every alert. <b>Chat 2</b> shows alerts passing the screen: spread ≤ $0.03, ≥ 50 contracts at the ask,
24h volume ≥ 100 contracts, entry $0.05–$0.95. The screen is a transparent rule set, <b>not</b> a validated model.</li>
<li><b>Cause of a move is never asserted.</b> The API does not report causes. Each alert lists the event's settlement sources as
reference links only, explicitly marked unverified as causes.</li>
</ul>

<h2>6. Charts and liquidity</h2>
<p>Price history comes from Kalshi's candlestick endpoint (1-minute and 1-hour candles) and the trade tape (individual prints with
sub-second timestamps) for the most active markets; other markets fall back to run snapshots. Charts put time on X
(seconds, minutes or hours) and YES price in dollars on Y, with recorded alerts marked. Liquidity comes from
<code>GET /markets/{ticker}/orderbook</code>: both sides of the book, price by price, with resting contract counts and cumulative
depth — i.e. how many contracts are available at a given price.</p>

<h2>7. Trading, portfolio and strategies</h2>
<p>Trades are <b>simulated</b>: 10 contracts, entered at the YES ask when a screened alert fires, bracketed ±$0.05 on the YES bid,
with a 48-hour time stop, and settled at resolution. Performance is grouped by strategy (<code>follow_rise</code>,
<code>fade_drop</code>, resolution hold), by topic and by alert direction, with win rate, realized P&amp;L and average P&amp;L per
contract. Fees, slippage and queue position are <b>not</b> modelled, so results test the pipeline, not an edge. The real
<b>demo account</b> (balance, positions, fills) is not connected because no API keys are stored in the repository.</p>

<h2>8. What is verified, and what is not</h2>
<p>Every endpoint and parameter on this site is listed with the official page that documents it on
<a href="sources.html">Sources</a>. Every table row links to the API response that produced it. Values the API did not return are
left blank and marked <span class="unv">unverified</span>. Items that could not be verified — including the corrected CORS
measurement, the demo-account credential gap, and the fabricated content found in older pages of this repository — are on
<a href="flagged.html">Flagged for review</a>, and repository-level findings are on <a href="repo-review.html">Repo review</a>.</p>

<h2>9. Known limits</h2>
<ul>
<li>Demo prices are simulated and may not match the production exchange.</li>
<li>Alert latency equals the collector cadence (GitHub Actions schedule, default every 10 minutes; GitHub documents that
scheduled runs can be delayed).</li>
<li>Candles/tape cover the most active markets only.</li>
<li>Paper results have small samples early on; treat every P&amp;L figure as a pipeline test.</li>
<li>The demo account is not connected, and no orders are ever sent.</li>
</ul>
"""

FINDINGS = """
<h1>Findings & methodology</h1>
<p class="lead">Exactly how each number on this site is produced, and where the method stops being able to answer a question.</p>

<h2>Data flow</h2>
<ol>
<li><b>Discovery.</b> <code>GET /series</code> with the topic's official filter (<code>include_volume=true</code>, up to 200 per
page), ranked by <code>volume_fp</code>; top 40 series per topic.</li>
<li><b>Events and markets.</b> <code>GET /events?series_ticker=…&amp;status=open&amp;with_nested_markets=true</code> for each series.</li>
<li><b>Publish.</b> Keep markets with 24h volume or open interest, cap per topic by activity, and record the omitted count.</li>
<li><b>History.</b> <code>GET /series/{series}/markets/{ticker}/candlesticks</code> at 1-minute (6h) and 1-hour (30d) intervals,
plus <code>GET /markets/trades</code> (≤1,000 prints, 6h) for the most active markets.</li>
<li><b>Depth.</b> <code>GET /markets/{ticker}/orderbook?depth=10</code> for the 25 most active markets.</li>
<li><b>Alerts.</b> Compare each market's last price with the previous run; |Δ| ≥ $0.10 creates one alert per market per run.</li>
<li><b>Trades.</b> Screened alerts open paper trades; open trades are marked on the YES bid and closed on target, stop, time
stop or settlement.</li>
<li><b>Resolution.</b> <code>GET /markets/{ticker}</code> for markets that left the open listing; record <code>result</code>.</li>
</ol>

<h2>Definitions used in the tables</h2>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>Column</th><th>Definition</th><th>Status</th><th>Source</th></tr></thead>
<tbody>
<tr><td>Last</td><td>Last traded YES price (<code>last_price_dollars</code>). Shown as “no trade” when the market has no 24h volume and the API returns 0.</td><td>API field</td><td><a href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener noreferrer">Get Markets</a></td></tr>
<tr><td>YES bid / ask</td><td><code>yes_bid_dollars</code> / <code>yes_ask_dollars</code></td><td>API field</td><td><a href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener noreferrer">Get Markets</a></td></tr>
<tr><td>Contracts at ask</td><td><code>yes_ask_size_fp</code>: resting contracts at the best YES ask</td><td>API field</td><td><a href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener noreferrer">Get Markets</a></td></tr>
<tr><td>24h contracts</td><td><code>volume_24h_fp</code></td><td>API field</td><td><a href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener noreferrer">Get Markets</a></td></tr>
<tr><td>24h $ (computed)</td><td>Σ <code>volume_24h_fp × last_price_dollars</code> over published markets in the event</td><td>Computed here</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/scripts/kalshi_collector.py" target="_blank" rel="noopener noreferrer">collector source</a></td></tr>
<tr><td>Cost to fill ask (computed)</td><td><code>yes_ask_size_fp × yes_ask_dollars</code></td><td>Computed here</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/scripts/kalshi_collector.py" target="_blank" rel="noopener noreferrer">collector source</a></td></tr>
<tr><td>Open interest</td><td><code>open_interest_fp</code></td><td>API field</td><td><a href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener noreferrer">Get Markets</a></td></tr>
<tr><td>Depth ladder</td><td><code>orderbook_fp.yes_dollars</code> / <code>no_dollars</code>: [price, contracts] per level; cumulative is summed here</td><td>API field + computed cumulative</td><td><a href="https://docs.kalshi.com/api-reference/market/get-market-orderbook" target="_blank" rel="noopener noreferrer">Get Market Orderbook</a></td></tr>
<tr><td>Δ since previous run</td><td>Last price minus the previous run's last price for the same market</td><td>Computed here</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/scripts/kalshi_collector.py" target="_blank" rel="noopener noreferrer">collector source</a></td></tr>
<tr><td>Result</td><td><code>result</code> = yes / no (empty until resolved)</td><td>API field</td><td><a href="https://docs.kalshi.com/api-reference/market/get-market" target="_blank" rel="noopener noreferrer">Get Market</a></td></tr>
</tbody></table></div>

<h2>What the data cannot tell you</h2>
<ul>
<li><b>Why a contract moved.</b> The API reports prices and trades, not causes. Any news headline shown anywhere on this site is
a reference link from the event's settlement sources, and is marked unverified as a cause.</li>
<li><b>Sub-interval alert latency</b> on this page: it renders the collector's JSON, not a browser poll. The API itself does
allow cross-origin reads for this site's origin (measured, see <a href="data/probe.json">data/probe.json</a>); WebSocket
channels need a signed handshake.</li>
<li><b>True dollar volume.</b> Kalshi publishes volume in contracts, not dollars; the $ columns are explicitly labelled
“computed”.</li>
<li><b>Edge.</b> Fees, queuing and slippage are not modelled. Early samples are far too small to judge a strategy.</li>
<li><b>Your demo account balance.</b> Reading it needs signed API requests with stored credentials; none exist in this repo.</li>
</ul>

<h2>Verification performed</h2>
<p>Each endpoint was read from <code>docs.kalshi.com</code> and then exercised against the demo host on 2026-11-22; the log of what
was checked, with links, is on <a href="sources.html">Sources</a>. The site is checked on every build for broken internal links,
for a source link on every table row rendered from static HTML, and for a source URL in every data record
(<code>scripts/check_site.py</code>).</p>
"""

SOURCES = """
<h1>Sources & verification log</h1>
<p class="lead">Official pages and live endpoints relied on, what was checked on each, and when. Items that were linked but not
reviewed are listed as such. “Live” means a response was retrieved and inspected on the check date.</p>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>Source</th><th>What was verified</th><th>Checked</th><th>Status</th></tr></thead>
<tbody>
<tr><td><a href="https://docs.kalshi.com/getting_started/demo_env" target="_blank" rel="noopener noreferrer">docs.kalshi.com · Demo environment</a></td>
<td>Demo REST root <code>https://external-api.demo.kalshi.co/trade-api/v2</code>; also supported <code>https://demo-api.kalshi.co/trade-api/v2</code>.
Demo WS <code>wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2</code>; also supported <code>wss://demo-api.kalshi.co/trade-api/ws/v2</code>.
Demo uses mock funds, credentials are not shared with production, and demo prices “may not be reflective of those in real markets”.</td>
<td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://docs.kalshi.com/getting_started/api_environments" target="_blank" rel="noopener noreferrer">docs.kalshi.com · API environments</a></td>
<td>Production REST <code>external-api.kalshi.com</code> / <code>api.elections.kalshi.com</code>; demo REST hosts; WS hosts; dedicated user WS hosts
<code>user-ws.demo.kalshi.co</code>. Note that <code>trading-api.kalshi.com</code> is <b>not</b> listed as a Trade API host.</td>
<td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://external-api.demo.kalshi.co/trade-api/v2/exchange/status" target="_blank" rel="noopener noreferrer">GET /exchange/status (demo, live)</a></td>
<td><code>exchange_active: true</code>, <code>trading_active: true</code>, exchange indexes 0–3 active.</td>
<td>2026-11-22</td><td>Verified (live)</td></tr>
<tr><td><a href="https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories" target="_blank" rel="noopener noreferrer">GET /search/tags_by_categories (demo, live)</a></td>
<td>Official taxonomy: Sports → Golf; Commodities → “Oil &amp; Gas”; Elections; Crypto; Entertainment. No “Culture” category and no
gasoline-specific category.</td><td>2026-11-22</td><td>Verified (live)</td></tr>
<tr><td><a href="https://external-api.demo.kalshi.co/trade-api/v2/series?category=Crypto&amp;include_volume=true&amp;limit=200" target="_blank" rel="noopener noreferrer">GET /series?category=Crypto (demo, live)</a></td>
<td>Series catalog with <code>volume_fp</code>, tags and fee fields; 321 crypto series returned at check time.</td>
<td>2026-11-22</td><td>Verified (live)</td></tr>
<tr><td><a href="https://docs.kalshi.com/api-reference/events/get-events" target="_blank" rel="noopener noreferrer">docs.kalshi.com · Get Events</a></td>
<td>Parameters <code>limit</code> (max 200), <code>cursor</code>, <code>status</code> (unopened/open/closed/settled),
<code>with_nested_markets</code>, <code>series_ticker</code>, <code>tickers</code>, <code>min_close_ts</code>, <code>min_updated_ts</code>;
market object field names (<code>yes_bid_dollars</code>, <code>last_price_dollars</code>, <code>volume_24h_fp</code>, <code>result</code>…).</td>
<td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://external-api.demo.kalshi.co/trade-api/v2/events?limit=2&amp;status=open&amp;with_nested_markets=true" target="_blank" rel="noopener noreferrer">GET /events (demo, live)</a></td>
<td>Open events with nested markets and settlement sources; used as the collector's source URL for event rows.</td>
<td>2026-11-22</td><td>Verified (live)</td></tr>
<tr><td><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets/KXAAAGASW-26NOV23-3.8400" target="_blank" rel="noopener noreferrer">GET /markets/{ticker} (demo, live)</a></td>
<td>Single market object: <code>last_price_dollars</code>, bid/ask and sizes, <code>volume_fp</code>, <code>volume_24h_fp</code>,
<code>open_interest_fp</code>, <code>status</code>, <code>result</code>, rules text.</td><td>2026-11-22</td><td>Verified (live)</td></tr>
<tr><td><a href="https://docs.kalshi.com/api-reference/market/get-market-orderbook" target="_blank" rel="noopener noreferrer">docs.kalshi.com · Get Market Orderbook</a></td>
<td>Path <code>GET /markets/{ticker}/orderbook</code>, <code>depth</code> 0–100; response <code>orderbook_fp.yes_dollars</code> and
<code>no_dollars</code> as [price, contracts] levels. Confirmed live on the demo host.</td><td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://docs.kalshi.com/api-reference/market/get-market-candlesticks" target="_blank" rel="noopener noreferrer">docs.kalshi.com · Get Market Candlesticks</a></td>
<td>Path <code>GET /series/{series_ticker}/markets/{ticker}/candlesticks</code>; required <code>start_ts</code>, <code>end_ts</code>,
<code>period_interval</code> ∈ {1, 60, 1440} minutes; OHLC fields with <code>_dollars</code> suffix, plus volume and open interest.
Confirmed live: 60 1-minute candles returned for a 1-hour window.</td><td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://docs.kalshi.com/api-reference/market/get-trades" target="_blank" rel="noopener noreferrer">docs.kalshi.com · Get Trades</a></td>
<td>Path <code>GET /markets/trades</code>; <code>limit</code> ≤ 1000, <code>ticker</code>, <code>min_ts</code>, <code>max_ts</code>;
fields <code>created_time</code> (sub-second), <code>yes_price_dollars</code>, <code>count_fp</code>, <code>taker_side</code>.
Confirmed live: 200 prints returned for one market.</td><td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://docs.kalshi.com/getting_started/rate_limits" target="_blank" rel="noopener noreferrer">docs.kalshi.com · Rate limits</a></td>
<td>Token-bucket limits for authenticated tiers; the page states unauthenticated public requests have separate limits and to back
off on 429, without publishing the numbers.</td><td>2026-11-22</td><td>Partly verified (numbers not published)</td></tr>
<tr><td><a href="https://docs.kalshi.com/getting_started/quick_start_websockets" target="_blank" rel="noopener noreferrer">docs.kalshi.com · WebSockets quick start</a></td>
<td>Documented WebSocket channel approach for a tick-level feed. Not implemented here (static site, no server).</td>
<td>2026-11-22</td><td>Linked, not implemented</td></tr>
<tr><td><a href="https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site" target="_blank" rel="noopener noreferrer">GitHub Docs · Pages publishing source</a></td>
<td>Pages can publish from a branch or from a GitHub Actions workflow; used to publish this site from an Actions artifact.</td>
<td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule" target="_blank" rel="noopener noreferrer">GitHub Docs · schedule event</a></td>
<td>Scheduled workflows use cron, run on the default branch, can be delayed under load; GitHub states the shortest interval is
5 minutes.</td><td>2026-11-22</td><td>Verified</td></tr>
<tr><td><a href="https://external-api.demo.kalshi.co/trade-api/v2/markets?limit=1" target="_blank" rel="noopener noreferrer">GET /markets (demo, live) — CORS check</a></td>
<td>With <code>Origin: https://kanlerxz87-cyber.github.io</code> the demo host answered 200 with
<code>Access-Control-Allow-Origin: https://kanlerxz87-cyber.github.io</code>, <code>Access-Control-Allow-Credentials: true</code> and
an <code>Access-Control-Expose-Headers</code> list; the OPTIONS preflight answered 204 with the same origin and
<code>GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS</code>. An earlier probe that sent no Origin header saw no CORS header — the header is
<b>origin-reflective</b>. Measured by CI and stored in <a href="data/probe.json">data/probe.json</a>.</td>
<td>2026-11-22</td><td>Verified (headers measured)</td></tr>
<tr><td><a href="https://www.cftc.gov/filings/contractlistings/kalshiexchange" target="_blank" rel="noopener noreferrer">CFTC · Kalshi contract listings</a></td>
<td>Linked from the repository README as the regulation reference. Not reviewed in this session.</td><td>—</td><td>Linked, not reviewed</td></tr>
</tbody></table></div>
<p class="note">An item marked “verified” means the linked page or endpoint said so on 2026-11-22. It does not mean every value on
the site was re-checked by hand; market values are re-read from the API on every build, and every row links to its endpoint so
you can re-check any value yourself.</p>
"""

REPO_REVIEW = """
<h1>Repo review</h1>
<p class="lead">A line-by-line pass over this repository as it stood at the start of the integration session, with the
irregularities found and what was done about each. Nothing here is inferred: each item names the file and, where it concerns an
external fact, the official source that contradicts or confirms it.</p>

<h2>What the repository contained</h2>
<p>Four separate front-end builds of the same idea had accumulated, plus two competing Pages configurations:</p>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>Path</th><th>What it was</th><th>Data source</th><th>Status now</th><th>Source</th></tr></thead>
<tbody>
<tr><td><code>index.html</code>, <code>gas-prices.html</code>, <code>elections.html</code>, <code>culture.html</code>,
<code>crypto.html</code>, <code>golf.html</code>, <code>strategies.html</code>, <code>review.html</code>, <code>js/</code>, <code>css/</code></td>
<td>Session a5878007 build: a “live” dashboard with hard-coded markets, prices, catalysts and portfolio metrics.</td>
<td><code>js/data.js</code> (hand-written, not API output)</td><td>Not published; kept in the repo, flagged R1/R2</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/js/data.js" target="_blank" rel="noopener noreferrer">js/data.js</a></td></tr>
<tr><td><code>docs/</code></td><td>Session b1cd545f build, published at the site root until this session.</td>
<td><code>docs/js/data.js</code> (same hand-written data)</td><td>Not published; flagged R1</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/docs/js/data.js" target="_blank" rel="noopener noreferrer">docs/js/data.js</a></td></tr>
<tr><td><code>site/</code></td><td>Session 9a725a07 live monitor, published at <code>/monitor/</code>.</td>
<td>API collector (<code>site/data/*.json</code>)</td><td><b>Canonical site, now published at the root</b></td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/scripts/kalshi_collector.py" target="_blank" rel="noopener noreferrer">collector</a></td></tr>
<tr><td><code>dash/</code></td><td>Session 93ec9646 full-spec dashboard, published at <code>/dash/</code>.</td>
<td><code>dash/assets/data.js</code> + <code>data/snapshot.json</code> (API snapshot)</td><td>Not published; kept, snapshot spot-checked</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/data/snapshot.json" target="_blank" rel="noopener noreferrer">snapshot</a></td></tr>
</tbody></table></div>

<h2>Irregularities</h2>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>#</th><th>Finding</th><th>Evidence</th><th>Action</th><th>Source</th></tr></thead>
<tbody>
<tr><td>R1</td><td>Hand-written market data presented as live Kalshi data. Tickers such as <code>PRES-24-DJT</code>,
<code>GAS-24DEC-3.15</code>, <code>BTC-24DEC-100K</code>, <code>OSCAR-BESTPIC-25</code> and <code>MASTERS-25-SCHEFFLER</code>
do not follow the demo exchange's ticker format and were not returned by the demo API when queried. Each record also has a
“catalyst” headline with a specific time and no source.</td>
<td><code>js/data.js</code>, <code>docs/js/data.js</code>; demo API <code>GET /markets/{ticker}</code> returned not-found for the
tested tickers (recorded in <code>data/verification.json</code>).</td><td>Retired from publishing; flagged for review</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/js/data.js" target="_blank" rel="noopener noreferrer">js/data.js</a></td></tr>
<tr><td>R2</td><td>Capability claims with no implementation in the repo: “ingests tick streams”, “$10,000 demo account”,
“EV ≥ +18% ROI model”, “verified news catalyst pins”, “4 quantitative strategies”.</td>
<td><code>README.md</code>, <code>EXECUTIVE_SUMMARY.md</code>; no tick-stream client, no demo-account code and no model in the tree.</td>
<td>README and summary rewritten to match what runs</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/README.md" target="_blank" rel="noopener noreferrer">README.md</a></td></tr>
<tr><td>R3</td><td>The Pages workflow ran the collector against the <b>production</b> API (no <code>KALSHI_BASE</code> set, collector
defaulted to <code>external-api.kalshi.com</code>) while the site was branded as a demo tracker.</td>
<td><code>.github/workflows/pages.yml</code> + old collector default</td><td>Collector now defaults to the demo host; workflow
sets it explicitly</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/.github/workflows/pages.yml" target="_blank" rel="noopener noreferrer">pages.yml</a></td></tr>
<tr><td>R4</td><td>Seven records in <code>docs/data/verified-markets.json</code> carry <code>0.0</code> / <code>0</code> for
bid, ask, last, sizes, volume and open interest on active markets. A zero is not a verified value.</td>
<td><code>docs/data/verified-markets.json</code></td><td>Flagged; file no longer published</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/docs/data/verified-markets.json" target="_blank" rel="noopener noreferrer">verified-markets.json</a></td></tr>
<tr><td>R5</td><td>Two Pages configurations existed at once: a “legacy” branch build from <code>main</code> at <code>/</code>, and
an Actions workflow deploying an assembled artifact. Which one visitors saw depended on timing.</td>
<td><code>gh api repos/…/pages</code> reported <code>build_type: legacy</code>; <code>pages.yml</code> deploys by Actions</td>
<td>Pages switched to <code>build_type: workflow</code></td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/actions" target="_blank" rel="noopener noreferrer">Actions runs</a></td></tr>
<tr><td>R6</td><td>README links “Production REST” to <code>https://trading-api.kalshi.com/trade-api/v2</code>. Kalshi's endpoint
table does not list that host.</td>
<td><a href="https://docs.kalshi.com/getting_started/api_environments" target="_blank" rel="noopener noreferrer">API environments</a></td>
<td>README rewritten with the documented hosts</td></tr>
<tr><td>R7</td><td>The root dashboard's portfolio cards read “$10,000.00 / +$248.00 / Sharpe 1.84” in HTML, then are overwritten
at runtime from a local simulation — with no account connected.</td>
<td><code>docs/index.html</code> + <code>docs/js/trading.js</code></td><td>Retired from publishing; replaced by a clearly
labelled paper portfolio</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/docs/index.html" target="_blank" rel="noopener noreferrer">docs/index.html</a></td></tr>
<tr><td>R8</td><td>COORDINATION.md lists <code>scripts/kalshi_demo_client.py</code>, <code>scripts/strategy_engine.py</code>,
<code>scripts/verify_site.py</code> and <code>requirements.txt</code> as delivered, but none of those files is in the tree.</td>
<td>Present in commit <code>6d98549</code>, absent from <code>main</code> (a later merge dropped them); <code>ls scripts</code></td>
<td>Flagged; not restored (the collector covers the same read-only functions; the strategy engine used random price paths)</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/commit/6d98549" target="_blank" rel="noopener noreferrer">commit 6d98549</a></td></tr>
<tr><td>R9</td><td>COORDINATION.md records “Pages live” for a build that was never the deployed artifact at <code>/</code>.</td>
<td>Pages build history and <code>gh api …/pages</code></td><td>Corrected in COORDINATION.md by this session</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/COORDINATION.md" target="_blank" rel="noopener noreferrer">COORDINATION.md</a></td></tr>
<tr><td>R10</td><td>Generated data was committed to the repository by some sessions (<code>data/snapshot.json</code>,
<code>docs/data/verified-markets.json</code>) while other generated data is ignored (<code>site/data/</code>).</td>
<td><code>.gitignore</code>, repository tree</td><td>Generated collector output stays ignored; small verification files are kept</td><td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/.gitignore" target="_blank" rel="noopener noreferrer">.gitignore</a></td></tr>
</tbody></table></div>

<h2>What was checked file by file</h2>
<ul>
<li><code>js/*.js</code>, <code>docs/js/*.js</code> — traced where numbers come from: all from hand-written objects plus local
simulation; no <code>fetch</code> of the Kalshi API.</li>
<li><code>site/assets/app.js</code>, <code>site/*.html</code> — reads only <code>data/*.json</code>; each row links to its endpoint.</li>
<li><code>scripts/kalshi_collector.py</code> — public read-only endpoints only; no signing, no orders; now demo-first.</li>
<li><code>scripts/check_site.py</code> — link and source-link gate used by CI; extended expectations kept intact.</li>
<li><code>tools/*.js</code> — static generators for the <code>dash/</code> build; no longer on the published path.</li>
<li><code>data/snapshot.json</code> — spot-checked: <code>KXAAAGASW-26NOV23-3.8400</code> exists on the demo host with the same
rules text and open interest as the snapshot.</li>
<li><code>.github/workflows/pages.yml</code> — the only workflow on <code>main</code>; now assembles and deploys one site.</li>
</ul>
"""

SUGGESTIONS = """
<h1>Making the desk more live and more useful</h1>
<p class="lead">Suggestions are split into what this session actually implemented and what is worth doing next. Each one says
what it needs, so a cost is visible before you ask for it.</p>

<h2>Implemented in this session</h2>
<ul>
<li><b>Two scrolling chats</b> side by side — every ≥ $0.10 move, and the model's high-ROI subset — with topic filter,
auto-scroll and a per-alert link to the exact API response.</li>
<li><b>Real price history instead of snapshots only:</b> Kalshi's 1-minute and 1-hour candlesticks and its sub-second trade tape,
so the X axis can be seconds, minutes or hours.</li>
<li><b>Time-range buttons</b> (1h / 6h / 24h / 7d / 30d) that match the available data instead of pretending to have more.</li>
<li><b>Alert markers drawn on the chart</b>, so a price jump and its alert are visible in the same picture.</li>
<li><b>Liquidity ladder</b> with cumulative depth on both book sides, plus “contracts available at the ask” and the computed cost
to fill that size.</li>
<li><b>Highest-dollar events ranking</b> (computed 24h notional) with events grouped inside their topic pages.</li>
<li><b>Honest freshness banner</b> — data timestamp, age, environment and a stale warning.</li>
<li><b>One canonical site</b> at the root, one build pipeline, and a source link on every row.</li>
</ul>

<h2>Next, in priority order</h2>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>Idea</th><th>Why it helps a trader</th><th>What it needs</th><th>Reference</th></tr></thead>
<tbody>
<tr><td>Tick-level alerting over WebSocket</td><td>Turns “≥ $0.10 between 10-minute runs” into a true real-time alert and makes the
seconds chart live rather than tape-based.</td><td>A small always-on worker (Fly/Render/VPS) subscribing to
<code>wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2</code>; the browser then polls your worker, not Kalshi.</td>
<td><a href="https://docs.kalshi.com/getting_started/quick_start_websockets" target="_blank" rel="noopener noreferrer">WS quick start</a></td></tr>
<tr><td>Demo-account portfolio</td><td>Replaces the paper ledger with the actual demo balance, positions and fills.</td>
<td>Demo API key id + private key stored as encrypted repository secrets; signed requests per Kalshi's auth docs.</td>
<td><a href="https://docs.kalshi.com/getting_started/api_keys" target="_blank" rel="noopener noreferrer">API keys</a></td></tr>
<tr><td>Automated demo order execution</td><td>Moves from paper fills to real demo orders, so fill quality and fees can be measured.</td>
<td>The same credentials plus a hard kill-switch and per-run order caps.</td>
<td><a href="https://docs.kalshi.com/api-reference/orders/create-order-v2" target="_blank" rel="noopener noreferrer">Create order V2</a></td></tr>
<tr><td>Event timeline with news pins</td><td>Lets you see whether a headline preceded a jump — without claiming causation.</td>
<td>A news source with timestamps and an explicit “reference only, unverified cause” label; the event's
<code>settlement_sources</code> already give the official resolution authority.</td>
<td><a href="https://docs.kalshi.com/api-reference/events/get-events" target="_blank" rel="noopener noreferrer">Get Events</a></td></tr>
<tr><td>Strategy scorecards with confidence intervals</td><td>Stops small samples from looking like an edge.</td>
<td>More days of alerts; report n, win rate with Wilson interval, average P&amp;L per contract, and fee-adjusted P&amp;L.</td>
<td><a href="https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval" target="_blank" rel="noopener noreferrer">Wilson interval</a></td></tr>
<tr><td>Saved watchlists and deep links</td><td>Fewer clicks during a live event.</td><td>URL state (already used for
<code>chart.html?ticker=…</code>) extended to filters and chat topic; localStorage for watchlists.</td>
<td><a href="https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams" target="_blank" rel="noopener noreferrer">URLSearchParams</a></td></tr>
<tr><td>Keyboard-first navigation and sound alerts</td><td>Faster scanning of two feeds.</td><td>Arrow-key feed navigation and an
opt-in sound on new high-ROI alerts.</td><td><a href="https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets" target="_blank" rel="noopener noreferrer">MDN</a></td></tr>
</tbody></table></div>

<h2>What is deliberately not suggested</h2>
<ul>
<li>More aggregate “live” counters that are not backed by a response — the previous builds did that and it was misleading.</li>
<li>Filling blank cells with estimates. Blank plus <span class="unv">unverified</span> is the rule.</li>
<li>Claiming a cause for a price move from the API. It does not publish one.</li>
</ul>
"""

FLAGGED = """
<h1>Flagged for review</h1>
<p class="lead">Everything the agent could not verify, had to approximate, or chose to change. None of it blocks the site.
Every item names what would settle it.</p>
<div class="table-wrap"><table class="sourced">
<thead><tr><th>#</th><th>Item</th><th>Status</th><th>What would settle it</th><th>Source</th></tr></thead>
<tbody>
<tr><td>F1</td><td><b>Demo-account portfolio is not connected.</b> Balance, positions and fills from the Kalshi demo account are
not shown; the portfolio on this site is a paper simulation.</td><td>Blocked — needs secrets</td>
<td>Add a demo API key id and RSA private key as encrypted repository secrets and enable the signed-request job.</td>
<td><a href="https://docs.kalshi.com/getting_started/api_keys" target="_blank" rel="noopener noreferrer">API keys</a></td></tr>
<tr><td>F2</td><td><b>Browser CORS is allowed (measured), so direct polling is possible — this page still renders the
collector's JSON.</b> With an Origin header the demo host returns <code>Access-Control-Allow-Origin</code> for that origin and a
204 preflight. An early probe without an Origin header saw no CORS header and that was almost written up as a limit; the
measurement corrected it. The WebSocket handshake, by contrast, needs signing (401 without it).</td><td>Verified, corrected</td>
<td>Add a 5-second browser poll to this page for true per-second quotes; use the collector JSON as the fallback.</td>
<td><a href="data/probe.json">data/probe.json</a></td></tr>
<tr><td>F3</td><td><b>Demo prices are simulated.</b> Kalshi states demo prices and behaviour may not reflect real markets, so
nothing here is evidence about production odds or liquidity.</td><td>Documented limit</td>
<td>Run the same collector against the production host (<code>KALSHI_BASE</code> switch already exists) and label the site accordingly.</td>
<td><a href="https://docs.kalshi.com/getting_started/demo_env" target="_blank" rel="noopener noreferrer">Demo environment</a></td></tr>
<tr><td>F4</td><td><b>“Culture” is mapped to Kalshi's “Entertainment” category</b> and <b>“Gas prices” to the “Oil &amp; Gas” tag</b>
under Commodities. Neither is an exact topic in Kalshi's taxonomy, so these pages include adjacent markets (e.g. crude oil, TV
awards).</td><td>Approximation</td><td>Choose different filters, or accept the mapping and keep the note on each page.</td>
<td><a href="https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories" target="_blank" rel="noopener noreferrer">tags_by_categories</a></td></tr>
<tr><td>F5</td><td><b>High-ROI filter is a rule set, not a validated model.</b> Thresholds (spread $0.03, 50 contracts at the ask,
24h volume 100, entry $0.05–$0.95) were chosen by the agent and are not backtested. Its "ROI" is a gross proxy before fees.</td>
<td>Unvalidated</td><td>Backtest on accumulated alerts and report confidence intervals, or replace with a documented model.</td>
<td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/scripts/kalshi_collector.py" target="_blank" rel="noopener noreferrer">collector source</a></td></tr>
<tr><td>F6</td><td><b>Paper trades ignore fees, slippage and queue position.</b> Kalshi's fee schedule is per series
(<code>fee_type</code>, <code>fee_multiplier</code>) and is not modelled.</td><td>Open</td>
<td>Apply the per-series fee schedule to each fill and re-run.</td>
<td><a href="https://docs.kalshi.com/getting_started/fees" target="_blank" rel="noopener noreferrer">Fees (documented by Kalshi)</a></td></tr>
<tr><td>F7</td><td><b>Cause of a price move is never claimed.</b> The API does not report causes; the reference links on alerts are
the event's settlement sources.</td><td>Documented limit</td>
<td>Pair moves with timestamped news from a named source and still label causation as unproven.</td>
<td><a href="https://docs.kalshi.com/api-reference/events/get-events" target="_blank" rel="noopener noreferrer">Get Events</a></td></tr>
<tr><td>F8</td><td><b>Alert latency equals the collector cadence.</b> Default is every 10 minutes; GitHub documents that scheduled
runs can be delayed and are disabled after 60 days of repository inactivity.</td><td>Documented limit</td>
<td>A dedicated worker for sub-minute detection; keep the scheduled run as a backstop.</td>
<td><a href="https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule" target="_blank" rel="noopener noreferrer">schedule docs</a></td></tr>
<tr><td>F9</td><td><b>Hand-written “live” data inherited from earlier builds.</b> Tickers, catalysts and portfolio metrics in the
root pages and <code>docs/</code> were not API output. They are no longer published, but the files remain in the repository.</td>
<td>Needs review</td><td>Delete or clearly mark those directories, or keep them as archived examples.</td>
<td><a href="https://github.com/kanlerxz87-cyber/Tradebot2" target="_blank" rel="noopener noreferrer">repository</a></td></tr>
<tr><td>F10</td><td><b>Files listed as delivered in COORDINATION.md are missing</b> from the tree
(<code>kalshi_demo_client.py</code>, <code>strategy_engine.py</code>, <code>verify_site.py</code>, <code>requirements.txt</code>).</td>
<td>Needs review</td><td>Restore from commit <code>6d98549</code> if the authenticated client is wanted.</td>
<td><a href="https://github.com/kanlerxz87-cyber/Tradebot2/commit/6d98549" target="_blank" rel="noopener noreferrer">commit 6d98549</a></td></tr>
<tr><td>F11</td><td><b>Candles and the trade tape cover only the most active markets</b> (12 each by default) to stay inside public
rate limits; other markets show collection-run snapshots.</td><td>Documented limit</td>
<td>Fetch candles lazily per selected market through a small proxy.</td>
<td><a href="https://docs.kalshi.com/api-reference/market/get-market-candlesticks" target="_blank" rel="noopener noreferrer">Candlesticks</a></td></tr>
<tr><td>F12</td><td><b>Unauthenticated rate limits are not published.</b> The collector backs off on 429 but cannot size its request
budget against a published number.</td><td>Unverified</td><td>Ask Kalshi support, or measure empirically over a long run.</td>
<td><a href="https://docs.kalshi.com/getting_started/rate_limits" target="_blank" rel="noopener noreferrer">Rate limits</a></td></tr>
<tr><td>F13</td><td><b>Markets with no 24h trade show last price 0 in the API.</b> The site renders “no trade” rather than $0.00 to
avoid implying a price.</td><td>Handled</td><td>None; this is a display decision, documented on the Markets page.</td>
<td><a href="https://docs.kalshi.com/api-reference/market/get-markets" target="_blank" rel="noopener noreferrer">Get Markets</a></td></tr>
<tr><td>F14</td><td><b>Resolution timestamps are “first seen by this collector”,</b> not the exchange's official settlement time;
the API's <code>settlement_ts</code> is shown only when returned.</td><td>Documented limit</td>
<td>Read <code>settlement_ts</code> and <code>settlement_value_dollars</code> where present.</td>
<td><a href="https://docs.kalshi.com/api-reference/market/get-market" target="_blank" rel="noopener noreferrer">Get Market</a></td></tr>
</tbody></table></div>
"""

TRADES_REDIRECT = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Portfolio &amp; strategy lab · Kalshi Demo Desk</title>
<link rel="canonical" href="portfolio.html">
<meta http-equiv="refresh" content="0; url=portfolio.html">
<link rel="stylesheet" href="assets/style.css">
<script src="assets/app.js" defer></script>
</head>
<body data-page="portfolio">
<header class="top" id="nav"></header>
<main>
<h1>Portfolio &amp; strategy lab</h1>
<p class="lead">This page moved to <a href="portfolio.html">portfolio.html</a>.</p>
</main>
<footer>Kalshi <b>Demo</b> Desk · <a href="flagged.html">Flagged for review</a></footer>
</body>
</html>
"""

PAGES = {
    "index.html": page("Kalshi demo live desk", HOME, "home",
                       desc="Live Kalshi demo events in gas prices, elections, culture, crypto and golf with $0.10 swing alerts."),
    "alerts.html": page("Live alerts", ALERTS, "alerts", desc="Two scrolling alert chats: all ≥ $0.10 moves and model high-ROI picks."),
    "dashboard.html": page("Markets", DASHBOARD, "dashboard", desc="Every published Kalshi demo market, grouped by event and topic."),
    "gas.html": page("Gas prices", topic_page(
        "gas", "Gas prices",
        "Open gas-price and energy markets on the Kalshi demo exchange, grouped by event. This is the “Oil &amp; Gas” tag under the "
        "Commodities category — Kalshi publishes no retail-gasoline category.",
        "Markets with 24h trading or open interest, grouped by event and ordered by computed 24h dollar notional. Each row links to "
        "the market object that produced it."), "topic-gas", "gas"),
    "elections.html": page("Elections", topic_page(
        "elections", "Elections",
        "Open election markets on the Kalshi demo exchange — presidential, congressional, gubernatorial and international.",
        "Markets with 24h trading or open interest, grouped by event and ordered by computed 24h dollar notional."), "topic-elections", "elections"),
    "culture.html": page("Culture", topic_page(
        "culture", "Culture",
        "Awards, music, film, television and other entertainment markets on the Kalshi demo exchange.",
        "Markets with 24h trading or open interest, grouped by event and ordered by computed 24h dollar notional."), "topic-culture", "culture"),
    "crypto.html": page("Crypto", topic_page(
        "crypto", "Crypto",
        "Bitcoin, Ethereum, XRP, Solana and other crypto markets on the Kalshi demo exchange, including hourly and daily ranges.",
        "Markets with 24h trading or open interest, grouped by event and ordered by computed 24h dollar notional. Crypto is the "
        "largest topic on the demo host."), "topic-crypto", "crypto"),
    "golf.html": page("Golf", topic_page(
        "golf", "Golf",
        "PGA Tour, LIV and major-championship markets on the Kalshi demo exchange.",
        "Markets with 24h trading or open interest, grouped by event and ordered by computed 24h dollar notional."), "topic-golf", "golf"),
    "chart.html": page("Chart & liquidity", CHART, "chart", desc="YES price over seconds, minutes or hours with order-book depth."),
    "portfolio.html": page("Portfolio & strategy lab", PORTFOLIO, "portfolio", desc="Simulated trades, strategy categorisation and paper P&L."),
    "resolved.html": page("Resolved events", RESOLVED, "resolved", desc="How tracked Kalshi demo events resolved: YES or NO."),
    "executive-summary.html": page("Executive summary", EXEC, desc="Executive summary of the Kalshi demo desk: scope, sources and limits."),
    "findings.html": page("Findings & methodology", FINDINGS, desc="How each number is produced and where the method stops."),
    "sources.html": page("Sources", SOURCES, desc="Official Kalshi pages and live endpoints used, with what was verified."),
    "repo-review.html": page("Repo review", REPO_REVIEW, desc="Line-by-line repository review and irregularities."),
    "suggestions.html": page("Suggestions", SUGGESTIONS, desc="How to make the desk more live and more useful."),
    "flagged.html": page("Flagged for review", FLAGGED, desc="Unverified items and approximations, with sources."),
    "trades.html": TRADES_REDIRECT,
}


def main():
    SITE.mkdir(exist_ok=True)
    for name, html in PAGES.items():
        (SITE / name).write_text(html, encoding="utf-8")
    print(f"wrote {len(PAGES)} pages to {SITE}")


if __name__ == "__main__":
    main()
