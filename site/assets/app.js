/* Tradebot2 dashboard. Reads only the generated JSON in data/ (produced by scripts/kalshi_collector.py).
   Every value shown comes from a Kalshi API response; the source link on each row points to that endpoint. */
(function () {
  "use strict";

  var NAV = [
    ["index.html", "Home"], ["dashboard.html", "Live dashboard"],
    ["gas.html", "Gas"], ["elections.html", "Elections"], ["culture.html", "Culture"],
    ["crypto.html", "Crypto"], ["golf.html", "Golf"],
    ["chart.html", "Price chart & liquidity"], ["resolved.html", "Resolved"],
    ["trades.html", "Simulated trades"], ["findings.html", "Findings"],
    ["suggestions.html", "Suggestions"], ["sources.html", "Sources"],
    ["repo-review.html", "Repo review"], ["flagged.html", "Flagged for Review"]
  ];

  var TOPIC_LABEL = { gas: "Gas", elections: "Elections", culture: "Culture", crypto: "Crypto", golf: "Golf" };
  var cache = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function usd(v) { return v == null ? "" : "$" + Number(v).toFixed(2); }
  function signed(v) {
    if (v == null) return "";
    var s = (v > 0 ? "+" : v < 0 ? "-" : "") + "$" + Math.abs(v).toFixed(2);
    return '<span class="' + (v > 0 ? "up" : v < 0 ? "down" : "") + '">' + s + "</span>";
  }
  function num(v, d) { return v == null ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d }); }
  function when(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " PT";
  }
  function srcLink(url, label) {
    if (!url) return '<span class="unv">no source</span>';
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label || "API source") + " ↗</a>";
  }
  function unverified(v) { return v == null || v === "" ? '<span class="unv">unverified</span>' : ""; }

  async function load(name) {
    if (cache[name] !== undefined) return cache[name];
    try {
      var r = await fetch("data/" + name + "?t=" + Date.now(), { cache: "no-store" });
      cache[name] = r.ok ? await r.json() : null;
    } catch (e) { cache[name] = null; }
    return cache[name];
  }
  window.TB = { load: load, esc: esc, usd: usd, signed: signed, when: when, srcLink: srcLink };

  function renderNav() {
    var here = (location.pathname.split("/").pop() || "index.html");
    var html = '<span class="brand">Tradebot2 · Kalshi</span>';
    NAV.forEach(function (n) {
      html += '<a href="' + n[0] + '"' + (n[0] === here ? ' class="on"' : "") + ">" + esc(n[1]) + "</a>";
    });
    var nav = document.getElementById("nav");
    if (nav) nav.innerHTML = html;
  }

  function freshness(meta, el) {
    if (!el || !meta) return;
    var age = (Date.now() - new Date(meta.generated_at).getTime()) / 60000;
    el.innerHTML = "Data generated " + esc(when(meta.generated_at)) +
      " (" + Math.round(age) + " min ago). Updated by a scheduled job about every 15 minutes.";
    el.style.display = age > 45 ? "block" : "none";
    if (age > 45) el.textContent = "Stale: data is " + Math.round(age) + " min old. The scheduled job may be paused.";
  }

  /* ---------- Market tables (topic pages & dashboard) ---------- */
  function marketTable(markets) {
    if (!markets.length) return '<p class="note">No open markets for this topic in the latest collection run.</p>';
    var groups = {}, order = [];
    markets.forEach(function (m) {
      var k = m.event_ticker || m.ticker;
      if (!groups[k]) { groups[k] = { title: m.event_title || k, rows: [] }; order.push(k); }
      groups[k].rows.push(m);
    });
    var h = '<table class="sourced"><thead><tr><th>Market</th><th class="num">YES price</th><th class="num">Change (last run)</th>' +
      '<th class="num">YES bid / ask</th><th class="num">Ask size</th><th class="num">24h volume</th>' +
      '<th class="num">Open interest</th><th>Source</th><th>Chart</th></tr></thead><tbody>';
    order.forEach(function (k) {
      h += '<tr class="evt"><td colspan="9">' + esc(groups[k].title) + ' <span class="note">· ' + esc(k) + "</span></td></tr>";
      groups[k].rows.forEach(function (m) {
        h += "<tr><td>" + esc(m.title || m.ticker) + (m.yes_sub_title ? '<div class="note">YES: ' + esc(m.yes_sub_title) + "</div>" : "") + "</td>" +
          '<td class="num">' + usd(m.last) + unverified(m.last) + "</td>" +
          '<td class="num">' + signed(m.change_since_prev) + "</td>" +
          '<td class="num">' + usd(m.yes_bid) + " / " + usd(m.yes_ask) + "</td>" +
          '<td class="num">' + num(m.yes_ask_size) + "</td>" +
          '<td class="num">' + num(m.volume_24h) + "</td>" +
          '<td class="num">' + num(m.open_interest) + "</td>" +
          "<td>" + srcLink(m.source_url) + "</td>" +
          '<td><a href="chart.html?ticker=' + encodeURIComponent(m.ticker) + '">chart</a></td></tr>';
      });
    });
    return h + "</tbody></table>";
  }

  function bubble(a) {
    var why = (a.screen_reasons || []).join("; ");
    var refs = (a.reference_links || []).slice(0, 4).map(function (r) {
      return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.name || r.url) + "</a>";
    }).join(" · ");
    return '<div class="bubble ' + esc(a.direction) + '">' +
      '<div class="meta">' + esc(when(a.ts)) + " · " + esc(a.topic_label || a.topic) + " · " +
      (a.high_roi ? '<span class="tag hi">High-ROI screen: pass</span>' : '<span class="tag">screen: fail</span>') + "</div>" +
      '<div><span class="move ' + esc(a.direction) + '">' + (a.direction === "up" ? "▲" : "▼") + " " + signed(a.delta) + "</span> " +
      esc(a.title || a.ticker) + " — " + usd(a.from) + " → " + usd(a.to) + "</div>" +
      '<div class="why">Cause: <span class="unv">unverified</span> · spread ' + usd(a.spread) + " · ask size " + num(a.ask_size) +
      " · " + '<a href="chart.html?ticker=' + encodeURIComponent(a.ticker) + '">chart</a> · ' + srcLink(a.source_url) + "</div>" +
      (refs ? '<div class="why">Reference sources (settlement, not cause): ' + refs + "</div>" : "") +
      '<div class="why">Screen: ' + esc(why) + "</div></div>";
  }

  function chatFeed(el, alerts, filter) {
    if (!el) return;
    var rows = alerts.filter(function (a) { return filter === "all" || a.high_roi; });
    if (!rows.length) { el.innerHTML = '<p class="note">No ' + (filter === "all" ? "" : "high-ROI ") + "alerts yet. Alerts appear when a price moves $0.10 or more between two collection runs.</p>"; return; }
    var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    el.innerHTML = rows.slice().reverse().map(bubble).join("");
    if (atBottom) el.scrollTop = el.scrollHeight;
  }

  /* ---------- Dashboard ---------- */
  async function renderDashboard() {
    var meta = await load("meta.json"), mk = await load("markets.json"), al = await load("alerts.json");
    freshness(meta, document.getElementById("fresh"));
    var alerts = al ? al.alerts : [];
    var markets = mk ? mk.markets : [];
    var kpi = document.getElementById("kpis");
    if (kpi) kpi.innerHTML =
      '<div class="kpi"><b>' + markets.length + '</b><span>Live markets tracked</span></div>' +
      '<div class="kpi"><b>' + alerts.length + '</b><span>Alerts (≥ $0.10 move)</span></div>' +
      '<div class="kpi"><b>' + alerts.filter(function (a) { return a.high_roi; }).length + '</b><span>High-ROI screen passes</span></div>' +
      '<div class="kpi"><b>' + (meta ? meta.error_count : "—") + '</b><span>API errors in last run</span></div>';
    var feeds = { all: document.getElementById("feed-all"), roi: document.getElementById("feed-roi") };
    chatFeed(feeds.all, alerts, "all");
    chatFeed(feeds.roi, alerts, "roi");
    var t = document.getElementById("mk-table");
    if (!t) return;
    var sel = document.getElementById("topic-filter");
    function draw() {
      var f = sel ? sel.value : "all";
      var rows = markets.filter(function (m) { return f === "all" || m.topic === f; });
      t.innerHTML = marketTable(rows);
    }
    if (sel) sel.onchange = draw;
    draw();
  }

  /* ---------- Topic pages ---------- */
  async function renderTopic(topic) {
    var meta = await load("meta.json"), mk = await load("markets.json"), al = await load("alerts.json");
    freshness(meta, document.getElementById("fresh"));
    var markets = mk ? mk.markets.filter(function (m) { return m.topic === topic; }) : [];
    var alerts = al ? al.alerts.filter(function (a) { return a.topic === topic; }) : [];
    document.getElementById("mk-table").innerHTML = marketTable(markets);
    var m = meta && meta.topics && meta.topics[topic];
    document.getElementById("topic-note").innerHTML = m
      ? "Discovery filter (official Kalshi API): <code>" + esc(JSON.stringify(m.filter)) + "</code>. " + esc(m.note)
      : "";
    chatFeed(document.getElementById("feed"), alerts, "all");
  }

  /* ---------- Resolved ---------- */
  async function renderResolved() {
    var r = await load("resolved.json");
    var rows = r ? r.resolved : [];
    var yes = rows.filter(function (x) { return x.result === "yes"; }).length;
    document.getElementById("res-kpi").innerHTML =
      '<div class="kpi"><b>' + rows.length + '</b><span>Resolved markets tracked</span></div>' +
      '<div class="kpi"><b>' + yes + '</b><span>Resolved YES</span></div>' +
      '<div class="kpi"><b>' + (rows.length - yes) + '</b><span>Resolved NO</span></div>';
    var h = '<table class="sourced"><thead><tr><th>Market</th><th>Topic</th><th>Result</th><th class="num">Last price before resolution</th><th>Resolved at</th><th>Source</th></tr></thead><tbody>';
    rows.forEach(function (x) {
      h += "<tr><td>" + esc(x.title || x.ticker) + '<div class="note">' + esc(x.ticker) + "</div></td><td>" + esc(x.topic_label || "") + "</td>" +
        "<td><b>" + esc((x.result || "").toUpperCase()) + "</b></td>" +
        '<td class="num">' + usd(x.last_before_resolution) + unverified(x.last_before_resolution) + "</td>" +
        "<td>" + esc(when(x.resolved_at)) + "</td><td>" + srcLink(x.source_url) + "</td></tr>";
    });
    document.getElementById("res-table").innerHTML = h + (rows.length ? "" : '<tr><td colspan="6" class="note">No resolutions yet.</td></tr>') + "</tbody></table>";
  }

  /* ---------- Trades ---------- */
  function sumTable(title, rows) {
    var h = "<h2>" + esc(title) + '</h2><table class="sourced"><thead><tr><th>Group</th><th class="num">Closed</th><th class="num">Wins</th><th class="num">Win rate</th><th class="num">Total P&amp;L ($, 10-contract trades)</th><th class="num">Avg P&amp;L per contract</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += "<tr><td>" + esc(r.group) + "</td><td class=\"num\">" + r.closed_trades + '</td><td class="num">' + r.wins + '</td><td class="num">' +
        (r.win_rate == null ? "" : (r.win_rate * 100).toFixed(0) + "%") + '</td><td class="num">' + signed(r.total_pnl) + '</td><td class="num">' +
        (r.avg_pnl_per_contract == null ? "" : signed(r.avg_pnl_per_contract)) + "</td></tr>";
    });
    return h + (rows.length ? "" : '<tr><td colspan="6" class="note">No closed trades yet.</td></tr>') + "</tbody></table>";
  }
  function tradeRows(list) {
    if (!list.length) return '<tr><td colspan="9" class="note">None yet.</td></tr>';
    return list.map(function (t) {
      return "<tr><td>" + esc(t.title || t.ticker) + '<div class="note">' + esc(t.ticker) + "</div></td><td>" + esc(t.topic_label) + "</td><td>" + esc(t.strategy) +
        "</td><td>" + esc(t.status) + "</td><td class=\"num\">" + usd(t.entry) + "</td><td class=\"num\">" + usd(t.exit != null ? t.exit : t.mark) +
        "</td><td class=\"num\">" + signed(t.pnl != null ? t.pnl : t.unrealized_pnl) + "</td><td>" + esc(t.exit_reason || "") +
        "</td><td>" + srcLink(t.source_url) + "</td></tr>";
    }).join("");
  }
  async function renderTrades() {
    var meta = await load("meta.json"), tr = await load("trades.json");
    freshness(meta, document.getElementById("fresh"));
    if (!tr) { document.getElementById("trade-body").innerHTML = '<p class="note">No trade data yet.</p>'; return; }
    document.getElementById("trade-assump").innerHTML = "<b>" + esc(tr.mode) + "</b>. Assumptions: " + esc(JSON.stringify(tr.assumptions));
    document.getElementById("trade-body").innerHTML =
      sumTable("By strategy", tr.by_strategy) + sumTable("By topic", tr.by_topic) + sumTable("By alert direction", tr.by_alert_direction) +
      '<h2>Open simulated trades</h2><table class="sourced"><thead><tr><th>Market</th><th>Topic</th><th>Strategy</th><th>Status</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">Unrealized P&amp;L</th><th>Exit reason</th><th>Source</th></tr></thead><tbody>' +
      tradeRows(tr.open_trades) + '</tbody></table><h2>Closed simulated trades (latest 500)</h2><table class="sourced"><thead><tr><th>Market</th><th>Topic</th><th>Strategy</th><th>Status</th><th class="num">Entry</th><th class="num">Exit</th><th class="num">P&amp;L</th><th>Exit reason</th><th>Source</th></tr></thead><tbody>' +
      tradeRows(tr.closed_trades.slice().reverse()) + "</tbody></table>";
  }

  /* ---------- Chart & liquidity ---------- */
  var RANGES = { "1h": 3600e3, "6h": 6 * 3600e3, "24h": 24 * 3600e3, "7d": 7 * 24 * 3600e3, all: Infinity };
  function fmtX(t, unit) {
    var d = new Date(t);
    var p = function (n) { return String(n).padStart(2, "0"); };
    var hms = p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds());
    if (unit === "seconds") return hms;
    if (unit === "minutes") return p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
    return (d.getUTCMonth() + 1) + "/" + d.getUTCDate() + " " + p(d.getUTCHours()) + "h";
  }
  function drawChart(points, range, unit) {
    var W = 900, H = 340, L = 56, R = 16, T = 14, B = 40;
    var now = Date.now();
    var pts = points.filter(function (p) { return p.last != null && now - new Date(p.ts).getTime() <= RANGES[range]; });
    if (!pts.length) return '<p class="note">No snapshots in this range yet.</p>';
    var t0 = new Date(pts[0].ts).getTime(), t1 = new Date(pts[pts.length - 1].ts).getTime();
    if (t1 === t0) t1 = t0 + 60e3;
    function X(t) { return L + (t - t0) / (t1 - t0) * (W - L - R); }
    function Y(v) { return T + (1 - v) * (H - T - B); }
    var g = "";
    for (var i = 0; i <= 10; i += 2) {
      var v = i / 10;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e3e7ee"/>';
      g += '<text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">$' + v.toFixed(2) + "</text>";
    }
    var ticks = Math.min(6, pts.length);
    for (var k = 0; k < ticks; k++) {
      var tt = t0 + (t1 - t0) * k / Math.max(ticks - 1, 1);
      g += '<text x="' + X(tt) + '" y="' + (H - 14) + '" text-anchor="middle">' + fmtX(tt, unit) + "</text>";
    }
    var path = pts.map(function (p, j) { return (j ? "L" : "M") + X(new Date(p.ts).getTime()).toFixed(1) + "," + Y(p.last).toFixed(1); }).join(" ");
    var dots = pts.map(function (p) { return '<circle cx="' + X(new Date(p.ts).getTime()).toFixed(1) + '" cy="' + Y(p.last).toFixed(1) + '" r="3" fill="#00875a"><title>' + esc(when(p.ts)) + " · $" + p.last.toFixed(2) + "</title></circle>"; }).join("");
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="YES price over time">' + g +
      '<path d="' + path + '" fill="none" stroke="#00875a" stroke-width="2"/>' + dots + "</svg>" +
      '<p class="note">Y axis: YES price in dollars (0.00–1.00). X axis: time (UTC-based labels, unit selected above). Points: ' + pts.length + " snapshots.</p>";
  }
  async function renderChart() {
    var meta = await load("meta.json"), mk = await load("markets.json"), hist = await load("history.json"), ob = await load("orderbooks.json");
    freshness(meta, document.getElementById("fresh"));
    var markets = mk ? mk.markets : [];
    var params = new URLSearchParams(location.search);
    var sel = document.getElementById("ticker");
    var want = params.get("ticker") || (markets[0] && markets[0].ticker);
    sel.innerHTML = markets.map(function (m) {
      return '<option value="' + esc(m.ticker) + '"' + (m.ticker === want ? " selected" : "") + ">" + esc(m.topic_label) + " · " + esc(m.title || m.ticker) + "</option>";
    }).join("") || '<option value="">No live markets yet</option>';
    var range = "24h", unit = "minutes";
    function draw() {
      var t = sel.value;
      var m = markets.find(function (x) { return x.ticker === t; });
      var series = hist && hist.series[t] ? hist.series[t] : [];
      document.getElementById("chart").innerHTML = m ? drawChart(series, range, unit) : "";
      var info = document.getElementById("mkinfo");
      info.innerHTML = m ? "<b>" + esc(m.title) + "</b><br>" + esc(m.event_title || "") + "<br>Current YES " + usd(m.last) + " · bid " + usd(m.yes_bid) + " · ask " + usd(m.yes_ask) + " · " + srcLink(m.source_url) : "";
      var book = ob && ob.books[t];
      var lb = document.getElementById("book");
      if (!book) { lb.innerHTML = '<p class="note">No order-book depth captured for this market (only the 25 most active markets are sampled each run).</p>'; return; }
      function side(list) {
        return '<table class="sourced"><thead><tr><th class="num">Price</th><th class="num">Contracts</th><th class="num">Cumulative</th></tr></thead><tbody>' +
          list.map(function (l) { return '<tr><td class="num">' + usd(l.price) + '</td><td class="num">' + num(l.contracts, 2) + '</td><td class="num">' + num(l.contracts_cumulative, 2) + "</td></tr>"; }).join("") +
          (list.length ? "" : '<tr><td colspan="3" class="note">No resting orders.</td></tr>') + "</tbody></table>";
      }
      lb.innerHTML = '<div class="card"><b>Liquidity (resting orders)</b> captured ' + esc(when(book.ts)) + " · " + srcLink(book.source_url || (m && m.source_url), "orderbook API") +
        '<p class="note">YES bids = resting orders to buy YES at each price (how many contracts are available at a given price). NO bids are the opposite side.</p>' +
        '<div class="tiles" style="grid-template-columns:1fr 1fr"><div><h2>YES bids</h2>' + side(book.yes_bids) + "</div><div><h2>NO bids</h2>" + side(book.no_bids) + "</div></div></div>";
    }
    document.getElementById("ctl-range").onclick = function (e) {
      if (e.target.dataset.r) { range = e.target.dataset.r; document.querySelectorAll("#ctl-range button").forEach(function (b) { b.classList.toggle("on", b === e.target); }); draw(); }
    };
    document.getElementById("unit").onchange = function (e) { unit = e.target.value; draw(); };
    sel.onchange = function () { history.replaceState(null, "", "chart.html?ticker=" + encodeURIComponent(sel.value)); draw(); };
    draw();
  }

  /* ---------- Page bootstrap ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    renderNav();
    var page = document.body.getAttribute("data-page");
    var topic = document.body.getAttribute("data-topic");
    if (page === "dashboard") renderDashboard();
    else if (topic) renderTopic(topic);
    else if (page === "resolved") renderResolved();
    else if (page === "trades") renderTrades();
    else if (page === "chart") renderChart();
    else if (page === "home") renderDashboard();
    if (page === "dashboard" || topic || page === "trades" || page === "home") {
      setInterval(function () { cache = {}; if (page === "dashboard" || page === "home") renderDashboard(); else if (topic) renderTopic(topic); else renderTrades(); }, 60000);
    }
  });
})();
