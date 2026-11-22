/* Tradebot2 — Kalshi DEMO live desk.
 *
 * Reads only the JSON written by scripts/kalshi_collector.py into data/.
 * Every price, size and volume comes from a Kalshi public API response; the
 * source link on each row points at the exact endpoint that returned it.
 * Anything the API did not return is left blank and marked "unverified".
 * Values marked "computed" are simple arithmetic on API fields and say so.
 */
(function () {
  "use strict";

  var NAV_PRIMARY = [
    ["index.html", "Desk"],
    ["alerts.html", "Live alerts"],
    ["dashboard.html", "Markets"],
    ["chart.html", "Chart & liquidity"],
    ["portfolio.html", "Portfolio"],
    ["resolved.html", "Resolved"]
  ];
  var NAV_TOPICS = [
    ["gas.html", "Gas"],
    ["elections.html", "Elections"],
    ["culture.html", "Culture"],
    ["crypto.html", "Crypto"],
    ["golf.html", "Golf"]
  ];
  var NAV_REF = [
    ["executive-summary.html", "Executive summary"],
    ["findings.html", "Findings"],
    ["sources.html", "Sources"],
    ["repo-review.html", "Repo review"],
    ["suggestions.html", "Suggestions"],
    ["flagged.html", "Flagged for review"]
  ];
  var TOPIC_LABEL = { gas: "Gas prices", elections: "Elections", culture: "Culture", crypto: "Crypto", golf: "Golf" };
  var TOPIC_NOTE = {
    gas: "Kalshi category “Commodities”, tag “Oil & Gas”. Kalshi has no retail-gasoline category, so this page can include crude oil, natural gas and heating-oil contracts (flagged).",
    elections: "Kalshi category “Elections”.",
    culture: "Kalshi has no “Culture” category. This page uses “Entertainment” as the closest official category (flagged).",
    crypto: "Kalshi category “Crypto”.",
    golf: "Kalshi category “Sports”, tag “Golf”."
  };
  var cache = {};
  var POLL_MS = 30000;

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function price(v) {
    if (!isNum(v)) return '<span class="unv">unverified</span>';
    if (v === 0) return "$0.00";
    if (v < 0.01) return "$" + v.toFixed(4);
    return "$" + v.toFixed(2);
  }
  function usd(v) { return isNum(v) ? "$" + v.toFixed(2) : ""; }
  function signed(v) {
    if (!isNum(v)) return "";
    var s = (v > 0 ? "+" : v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(2);
    return '<span class="' + (v > 0 ? "up" : v < 0 ? "down" : "") + '">' + s + "</span>";
  }
  function num(v, d) {
    return isNum(v) ? v.toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d }) : "";
  }
  function pct(v) { return isNum(v) ? (v * 100).toFixed(0) + "%" : '<span class="unv">n/a</span>'; }
  function when(iso, withSeconds) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return d.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: withSeconds ? "2-digit" : undefined
    }) + " PT";
  }
  function srcLink(url, label) {
    if (!url) return '<span class="unv">no source</span>';
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label || "API") + " ↗</a>";
  }
  function unv(v) { return v == null || v === "" ? '<span class="unv">unverified</span>' : ""; }
  function ageMinutes(iso) { var d = new Date(iso); return isNaN(d) ? null : Math.round((Date.now() - d.getTime()) / 60000); }

  async function load(name) {
    if (cache[name] !== undefined) return cache[name];
    try {
      var r = await fetch("data/" + name + "?t=" + Date.now(), { cache: "no-store" });
      cache[name] = r.ok ? await r.json() : null;
    } catch (e) { cache[name] = null; }
    return cache[name];
  }
  window.TB = { load: load, esc: esc, price: price, num: num, when: when };

  function freshness(meta, el) {
    if (!el || !meta) return;
    var age = ageMinutes(meta.generated_at);
    var live = age != null && age <= 25;
    el.className = "freshness" + (live ? "" : " stale");
    el.innerHTML = '<span class="dot' + (live ? " on" : "") + '"></span> Data generated ' + esc(when(meta.generated_at, true)) +
      (age == null ? "" : " (" + age + " min ago)") +
      " · source <code>" + esc(meta.api_base || "") + "</code>" +
      " · " + (meta.environment === "demo" ? '<b class="tag demo">KALSHI DEMO — simulated prices</b>' : '<b class="tag">production</b>') +
      (live ? "" : " · <b>stale</b>: the scheduled job may be paused");
  }

  /* ---------------- nav ---------------- */
  function renderNav() {
    var here = location.pathname.split("/").pop() || "index.html";
    function group(items, cls) {
      return '<span class="nav-group ' + (cls || "") + '">' + items.map(function (n) {
        return '<a href="' + n[0] + '"' + (n[0] === here ? ' class="on"' : "") + ">" + esc(n[1]) + "</a>";
      }).join("") + "</span>";
    }
    var nav = document.getElementById("nav");
    if (!nav) return;
    nav.innerHTML =
      '<div class="nav-row"><a class="brand" href="index.html">Kalshi <b>Demo</b> Desk</a>' +
      group(NAV_PRIMARY, "primary") +
      '<span class="nav-spacer"></span>' +
      '<a class="nav-flag" href="flagged.html">⚠ Flagged for review</a></div>' +
      '<div class="nav-row secondary">' + group(NAV_TOPICS, "topics") + '<span class="sep"></span>' + group(NAV_REF, "ref") + "</div>";
  }

  /* ---------------- shared table builders ---------------- */
  function eventRows(events, opts) {
    opts = opts || {};
    if (!events.length) return '<tr><td colspan="8" class="note">No events with activity in the latest run.</td></tr>';
    var rows = events.slice(0, opts.limit || events.length).map(function (e) {
      return "<tr>" +
        '<td class="num rank">' + (e.rank_by_dollar_volume || "") + "</td>" +
        "<td><a href=\"dashboard.html?event=" + encodeURIComponent(e.event_ticker || "") + '">' + esc(e.title || e.event_ticker) + "</a>" +
        '<div class="note">' + esc(e.event_ticker) + " · " + e.markets + " markets</div></td>" +
        "<td>" + '<a href="' + esc(topicHref(e.topic)) + '">' + esc(e.topic_label || TOPIC_LABEL[e.topic] || e.topic) + "</a></td>" +
        '<td class="num">' + num(e.contracts_24h) + "</td>" +
        '<td class="num">' + (isNum(e.dollar_volume_24h_computed) ? usd(e.dollar_volume_24h_computed) : '<span class="unv">—</span>') + "</td>" +
        '<td class="num">' + num(e.open_interest) + "</td>" +
        "<td>" + esc(when(e.close_time)) + "</td>" +
        "<td>" + srcLink(e.source_url, "events API") + "</td></tr>";
    }).join("");
    return rows;
  }
  function topicHref(t) { return (t || "") + ".html"; }

  function marketTable(markets) {
    if (!markets.length) return '<p class="note">No traded or interest-bearing markets for this topic in the latest run.</p>';
    var groups = {}, order = [];
    markets.forEach(function (m) {
      var k = m.event_ticker || m.ticker;
      if (!groups[k]) { groups[k] = { title: m.event_title || k, ticker: k, rows: [] }; order.push(k); }
      groups[k].rows.push(m);
    });
    var h = '<div class="table-wrap"><table class="sourced"><thead><tr>' +
      "<th>Market</th><th class=\"num\">Last</th><th class=\"num\">YES bid / ask</th><th class=\"num\">Contracts at ask</th>" +
      '<th class="num">Cost to fill ask (computed)</th><th class="num">24h contracts</th><th class="num">24h $ (computed)</th>' +
      '<th class="num">Open interest</th><th class="num">Δ since previous run</th><th>Chart</th><th>Source</th></tr></thead><tbody>';
    order.forEach(function (k) {
      var g = groups[k];
      var evTotal = g.rows.reduce(function (a, r) { return a + (r.dollar_volume_24h_computed || 0); }, 0);
      h += '<tr class="evt"><td colspan="11"><b>' + esc(g.title) + '</b> <span class="note">· ' + esc(k) +
        " · " + g.rows.length + " markets · " + (evTotal ? usd(evTotal) + " 24h $ (computed)" : "no traded notional") + "</span></td></tr>";
      g.rows.sort(function (a, b) { return (b.dollar_volume_24h_computed || 0) - (a.dollar_volume_24h_computed || 0); });
      g.rows.forEach(function (m) {
        var last = m.has_traded && m.last ? m.last : null;
        h += "<tr>" +
          "<td>" + esc(m.title || m.ticker) + (m.yes_sub_title ? '<div class="note">YES: ' + esc(m.yes_sub_title) + "</div>" : "") + "</td>" +
          '<td class="num">' + (last == null ? '<span class="unv" title="no trade in the last 24h">no trade</span>' : price(last)) + "</td>" +
          '<td class="num">' + price(m.yes_bid) + " / " + price(m.yes_ask) + "</td>" +
          '<td class="num">' + (isNum(m.yes_ask_size) ? num(m.yes_ask_size, 2) : "") + unv(m.yes_ask_size) + "</td>" +
          '<td class="num">' + (isNum(m.ask_depth_dollars_computed) ? usd(m.ask_depth_dollars_computed) : '<span class="unv">—</span>') + "</td>" +
          '<td class="num">' + num(m.volume_24h, 2) + "</td>" +
          '<td class="num">' + (isNum(m.dollar_volume_24h_computed) ? usd(m.dollar_volume_24h_computed) : '<span class="unv">—</span>') + "</td>" +
          '<td class="num">' + num(m.open_interest, 2) + "</td>" +
          '<td class="num">' + signed(m.change_since_prev) + "</td>" +
          '<td><a href="chart.html?ticker=' + encodeURIComponent(m.ticker) + '">chart</a></td>' +
          "<td>" + srcLink(m.source_url) + "</td></tr>";
      });
    });
    return h + "</tbody></table></div>";
  }

  function bubble(a) {
    var refs = (a.reference_links || []).slice(0, 3).map(function (r) {
      return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.name || "source") + "</a>";
    }).join(" · ");
    var screen = (a.screen_reasons || []).join("; ");
    return '<div class="bubble ' + esc(a.direction) + (a.high_roi ? " hi" : "") + '">' +
      '<div class="meta">' + esc(when(a.ts, true)) + " · " + esc(a.topic_label || TOPIC_LABEL[a.topic] || a.topic) +
      (a.high_roi ? ' · <span class="tag hi">model likes this</span>' : ' · <span class="tag">screen: no</span>') + "</div>" +
      '<div class="move-line"><span class="move ' + esc(a.direction) + '">' + (a.direction === "up" ? "▲" : "▼") + " " +
      signed(a.delta) + "</span> <b>" + esc(a.title || a.ticker) + "</b></div>" +
      '<div class="path">' + price(a.from) + " → " + price(a.to) + " (YES) · spread " + (isNum(a.spread) ? usd(a.spread) : "—") +
      " · " + num(a.ask_size) + " at ask · 24h " + num(a.volume_24h) + "</div>" +
      '<div class="why">Cause: <span class="unv">unverified — the API does not report causes</span>' +
      (refs ? '<div class="refs">Reference sources (settlement/rules, not proof of cause): ' + refs + "</div>" : "") +
      (screen ? '<div class="refs">Screen: ' + esc(screen) + "</div>" : "") + "</div>" +
      '<div class="why">' + '<a href="chart.html?ticker=' + encodeURIComponent(a.ticker) + '">chart</a> · ' + srcLink(a.source_url) + "</div></div>";
  }

  function chatFeed(el, alerts, filter) {
    if (!el) return;
    var rows = alerts.filter(function (a) { return filter === "all" || a.high_roi; });
    if (!rows.length) {
      el.innerHTML = '<p class="empty">No ' + (filter === "all" ? "" : "high-ROI ") + "alerts in the current window. " +
        "An alert fires when a contract's last price moves $0.10 or more between two collection runs.</p>";
      return;
    }
    var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    el.innerHTML = rows.slice().reverse().map(bubble).join("");
    if (atBottom) el.scrollTop = el.scrollHeight;
  }

  /* ---------------- home ---------------- */
  async function renderHome() {
    var meta = await load("meta.json"), mk = await load("markets.json"), ev = await load("events.json"),
      al = await load("alerts.json"), rs = await load("resolved.json");
    freshness(meta, document.getElementById("fresh"));
    var markets = mk ? mk.markets : [];
    var events = ev ? ev.events : [];
    var alerts = al ? al.alerts : [];
    var resolved = rs ? rs.resolved : [];
    var highRoi = alerts.filter(function (a) { return a.high_roi; });

    var kpi = document.getElementById("kpis");
    if (kpi) kpi.innerHTML =
      '<div class="kpi"><b>' + num(meta && meta.open_markets_seen) + '</b><span>Open demo markets seen</span></div>' +
      '<div class="kpi"><b>' + num(markets.length) + '</b><span>Published (traded or open interest)</span></div>' +
      '<div class="kpi"><b>' + (events[0] && isNum(events[0].dollar_volume_24h_computed) ? usd(events[0].dollar_volume_24h_computed) : "—") + '</b><span>Top event 24h $ (computed)</span></div>' +
      '<div class="kpi"><b>' + num(alerts.length) + '</b><span>Alerts ≥ $0.10</span></div>' +
      '<div class="kpi"><b>' + num(highRoi.length) + '</b><span>Model high-ROI picks</span></div>' +
      '<div class="kpi"><b>' + num(resolved.length) + '</b><span>Resolved tracked</span></div>';

    var t = document.getElementById("top-events");
    if (t) t.innerHTML = eventRows(events, { limit: 15 });

    var cards = document.getElementById("topic-cards");
    if (cards) {
      cards.innerHTML = Object.keys(TOPIC_LABEL).map(function (k) {
        var list = markets.filter(function (m) { return m.topic === k; });
        var e = events.filter(function (x) { return x.topic === k; })[0];
        var topicAlerts = alerts.filter(function (a) { return a.topic === k; }).length;
        return '<a class="tile" href="' + topicHref(k) + '"><span class="tile-head">' + esc(TOPIC_LABEL[k]) + "</span>" +
          "<span class=\"tile-kpi\">" + num(list.length) + " markets</span>" +
          '<span class="note">' + (e ? "Top: " + esc(e.title || e.event_ticker) : "No traded event yet") + "</span>" +
          '<span class="note">' + topicAlerts + " alert" + (topicAlerts === 1 ? "" : "s") + " ≥ $0.10</span></a>";
      }).join("");
    }

    var feed = document.getElementById("feed-preview");
    if (feed) {
      var recent = alerts.slice(0, 6);
      feed.innerHTML = recent.length ? recent.map(bubble).join("") :
        '<p class="empty">No ≥ $0.10 moves recorded yet. The collector compares each market with its previous run.</p>';
    }

    var res = document.getElementById("resolved-strip");
    if (res) {
      res.innerHTML = resolved.length ? resolved.slice(0, 8).map(function (r) {
        return '<div class="res-item"><span class="tag ' + (r.result === "yes" ? "yes" : "no") + '">' + esc((r.result || "").toUpperCase()) +
          "</span> " + esc(r.title || r.ticker) + " <span class=\"note\">" + esc(when(r.resolved_at)) + "</span></div>";
      }).join("") : '<p class="empty">No resolutions recorded yet. A market is checked with <code>GET /markets/{ticker}</code> after it leaves the open listing.</p>';
    }
    var omitted = meta && meta.markets_omitted_per_topic;
    var note = document.getElementById("coverage-note");
    if (note && omitted) {
      note.innerHTML = "Open demo markets seen: " + num(meta.open_markets_seen) + ". Published only markets with 24h trading or open interest, capped at " +
        num(meta.max_markets_per_topic) + " per topic. Markets not published: " +
        Object.keys(omitted).map(function (k) { return esc(TOPIC_LABEL[k] || k) + " " + num(omitted[k]); }).join(" · ") +
        ". Full listing: " + srcLink((meta.api_base || "") + "/events?status=open&with_nested_markets=true&limit=200", "events API");
    }
  }

  /* ---------------- alerts ---------------- */
  async function renderAlerts() {
    var meta = await load("meta.json"), al = await load("alerts.json");
    freshness(meta, document.getElementById("fresh"));
    var alerts = al ? al.alerts : [];
    var topic = "all";
    function draw() {
      var rows = alerts.filter(function (a) { return topic === "all" || a.topic === topic; });
      chatFeed(document.getElementById("feed-all"), rows, "all");
      chatFeed(document.getElementById("feed-roi"), rows, "roi");
      var c = document.getElementById("alert-kpis");
      if (c) c.innerHTML = '<div class="kpi"><b>' + rows.length + '</b><span>Alerts in window</span></div>' +
        '<div class="kpi"><b>' + rows.filter(function (a) { return a.high_roi; }).length + '</b><span>High-ROI picks</span></div>' +
        '<div class="kpi"><b>' + rows.filter(function (a) { return a.direction === "up"; }).length + '</b><span>Moves up</span></div>' +
        '<div class="kpi"><b>' + rows.filter(function (a) { return a.direction === "down"; }).length + '</b><span>Moves down</span></div>';
    }
    var sel = document.getElementById("topic-filter");
    if (sel) sel.onchange = function (e) { topic = e.target.value; draw(); };
    draw();
  }

  /* ---------------- markets explorer ---------------- */
  async function renderDashboard() {
    var meta = await load("meta.json"), mk = await load("markets.json"), ev = await load("events.json");
    freshness(meta, document.getElementById("fresh"));
    var markets = mk ? mk.markets : [];
    var events = ev ? ev.events : [];
    var params = new URLSearchParams(location.search);
    var eventFilter = params.get("event");
    var state = { topic: "all", minVol: 0, q: "" };

    var top = document.getElementById("top-events");
    if (top) top.innerHTML = eventRows(events, { limit: 20 });

    function draw() {
      var rows = markets.filter(function (m) {
        if (state.topic !== "all" && m.topic !== state.topic) return false;
        if (eventFilter && m.event_ticker !== eventFilter) return false;
        if ((m.volume_24h || 0) < state.minVol) return false;
        if (state.q) {
          var s = (m.title || "") + " " + (m.event_title || "") + " " + m.ticker;
          if (s.toLowerCase().indexOf(state.q.toLowerCase()) < 0) return false;
        }
        return true;
      });
      var head = document.getElementById("mk-head");
      if (head) head.innerHTML = rows.length + " markets shown" + (eventFilter ? ' · event <code>' + esc(eventFilter) + "</code> · <a href=\"dashboard.html\">clear</a>" : "");
      document.getElementById("mk-table").innerHTML = marketTable(rows);
    }
    var selTopic = document.getElementById("topic-filter");
    if (selTopic) selTopic.onchange = function (e) { state.topic = e.target.value; draw(); };
    var selVol = document.getElementById("min-vol");
    if (selVol) selVol.onchange = function (e) { state.minVol = Number(e.target.value); draw(); };
    var q = document.getElementById("q");
    if (q) q.oninput = function (e) { state.q = e.target.value.trim(); draw(); };
    draw();
  }

  /* ---------------- topic pages ---------------- */
  async function renderTopic(key) {
    var meta = await load("meta.json"), mk = await load("markets.json"), al = await load("alerts.json"), ev = await load("events.json");
    freshness(meta, document.getElementById("fresh"));
    var markets = mk ? mk.markets.filter(function (m) { return m.topic === key; }) : [];
    var alerts = al ? al.alerts.filter(function (a) { return a.topic === key; }) : [];
    var events = ev ? ev.events.filter(function (e) { return e.topic === key; }) : [];
    var t = document.getElementById("topic-note");
    if (t) {
      var m = meta && meta.topics && meta.topics[key];
      t.innerHTML = "<b>Discovery filter</b> (official Kalshi API): <code>" + esc(m ? JSON.stringify(m.filter) : "") + "</code>. " +
        esc(TOPIC_NOTE[key]) + " · " + markets.length + " markets published · " + events.length + " events · " +
        srcLink((meta && meta.api_base ? meta.api_base : "") + "/series?" + new URLSearchParams(m ? m.filter : {}).toString(), "series API");
    }
    document.getElementById("topic-events").innerHTML = eventRows(events);
    document.getElementById("mk-table").innerHTML = marketTable(markets);
    chatFeed(document.getElementById("feed"), alerts, "all");
  }

  /* ---------------- chart & liquidity ---------------- */
  var RANGES = { "1h": 3600e3, "6h": 6 * 3600e3, "24h": 24 * 3600e3, "7d": 7 * 86400e3, "30d": 30 * 86400e3 };
  function fmtX(t, mode) {
    var d = new Date(t), p = function (n) { return String(n).padStart(2, "0"); };
    if (mode === "seconds") return p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds());
    if (mode === "minutes") return p(d.getUTCHours()) + ":" + p(d.getUTCMinutes());
    return (d.getUTCMonth() + 1) + "/" + p(d.getUTCDate()) + " " + p(d.getUTCHours()) + "h";
  }

  function drawChart(series, mode, rangeMs, alertMarks) {
    var W = 940, H = 360, L = 58, R = 14, T = 16, B = 46;
    var now = Date.now();
    var pts = series.filter(function (p) { return p.t != null; });
    if (rangeMs && isFinite(rangeMs)) {
      var cutoff = pts.length ? Math.max(now - rangeMs, 0) : 0;
      var filtered = pts.filter(function (p) { return p.t >= now - rangeMs; });
      if (filtered.length) pts = filtered;
      else if (pts.length) pts = pts.slice(-2);
    }
    if (!pts.length) return '<p class="empty">No prices returned for this market in the selected window.</p>';
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    if (t1 <= t0) t1 = t0 + 60000;
    var vals = [];
    pts.forEach(function (p) {
      ["l", "h", "o", "c"].forEach(function (k) { if (isNum(p[k])) vals.push(p[k]); });
    });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = Math.max(0.01, (hi - lo) * 0.15);
    lo = Math.max(0, lo - pad); hi = Math.min(1, hi + pad);
    if (hi - lo < 0.02) { hi = Math.min(1, hi + 0.01); lo = Math.max(0, lo - 0.01); }
    function X(t) { return L + (t - t0) / (t1 - t0) * (W - L - R); }
    function Y(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
    var g = "";
    for (var i = 0; i <= 4; i++) {
      var v = lo + (hi - lo) * i / 4;
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="grid"/>' +
        '<text x="' + (L - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" class="axis">' + price(v) + "</text>";
    }
    var ticks = 6;
    for (var k = 0; k <= ticks; k++) {
      var tt = t0 + (t1 - t0) * k / ticks;
      g += '<text x="' + X(tt).toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle" class="axis">' + fmtX(tt, mode) + "</text>";
    }
    var marks = "";
    (alertMarks || []).forEach(function (a) {
      var t = new Date(a.ts).getTime();
      if (t < t0 || t > t1) return;
      marks += '<line x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" class="alertmark"><title>Alert ' +
        esc(when(a.ts, true)) + " " + signed(a.delta) + " (≥ $0.10)</title></line>";
    });

    var body = "";
    if (mode === "seconds") {
      var path = pts.map(function (p, j) { return (j ? "L" : "M") + X(p.t).toFixed(1) + "," + Y(p.c != null ? p.c : p.h).toFixed(1); }).join(" ");
      body = '<path d="' + path + '" class="line"/>' + pts.map(function (p) {
        return '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.c != null ? p.c : p.h).toFixed(1) + '" r="2.5" class="dot"><title>' +
          esc(new Date(p.t).toISOString()) + " · " + price(p.c) + (p.vol != null ? " · " + p.vol + " contracts" : "") + "</title></circle>";
      }).join("");
    } else {
      var bw = Math.max(1.2, Math.min(14, (W - L - R) / Math.max(pts.length, 1) * 0.62));
      body = pts.map(function (p) {
        var x = X(p.t), o = p.o != null ? p.o : p.c, c = p.c != null ? p.c : p.o, h = p.h != null ? p.h : c, l = p.l != null ? p.l : c;
        var up = c >= o;
        var cls = up ? "candle up" : "candle down";
        return '<g><title>' + esc(new Date(p.t).toISOString()) + " · O " + price(o) + " H " + price(h) + " L " + price(l) + " C " + price(c) +
          (p.vol != null ? " · vol " + p.vol : "") + '</title>' +
          '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + Y(h).toFixed(1) + '" y2="' + Y(l).toFixed(1) + '" class="' + cls + '"/>' +
          '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + Y(Math.max(o, c)).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' +
          Math.max(1, Math.abs(Y(o) - Y(c))).toFixed(1) + '" class="' + cls + '"/></g>';
      }).join("");
    }
    var volMax = Math.max.apply(null, pts.map(function (p) { return p.vol || 0; }).concat([0]));
    var volBars = "";
    if (volMax > 0) {
      pts.forEach(function (p) {
        if (!p.vol) return;
        var h2 = (p.vol / volMax) * 42;
        volBars += '<rect x="' + (X(p.t) - 1).toFixed(1) + '" y="' + (H - B - h2).toFixed(1) + '" width="2" height="' + h2.toFixed(1) + '" class="volbar"/>';
      });
    }
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="chart" role="img" aria-label="YES price over time">' +
      g + '<text x="' + L + '" y="' + 10 + '" class="axis">' + price(hi) + "</text>" + volBars + body + marks + "</svg>" +
      '<p class="note">Y axis: YES price in USD (contracts settle at $1.00 YES / $0.00 NO). X axis: time, UTC labels, ' +
      (mode === "seconds" ? "individual trades from <code>GET /markets/trades</code>" : mode === "minutes" ? "1-minute candles from <code>GET /series/{series}/markets/{ticker}/candlesticks</code>" : "1-hour candles from the same endpoint") +
      ". Dashed red lines are recorded ≥ $0.10 alerts. Grey bars are volume per period.</p>";
  }

  async function renderChart() {
    var meta = await load("meta.json"), mk = await load("markets.json"), ob = await load("orderbooks.json"),
      hist = await load("history.json"), candles = await load("candles.json"), ticks = await load("ticks.json"), al = await load("alerts.json");
    freshness(meta, document.getElementById("fresh"));
    var markets = mk ? mk.markets : [];
    var alerts = al ? al.alerts : [];
    var haveC = candles ? candles.interval_1m : {};
    var haveH = candles ? candles.interval_60m : {};
    var haveT = ticks ? ticks.markets : {};
    var sel = document.getElementById("ticker");
    var params = new URLSearchParams(location.search);
    var want = params.get("ticker");
    if (want && !markets.some(function (m) { return m.ticker === want; })) {
      var extra = document.createElement("option");
      extra.value = want; extra.textContent = want + " (not in current published set)";
      sel.appendChild(extra);
    }
    var sortable = markets.slice().sort(function (a, b) {
      var rank = function (m) { return (haveT[m.ticker] ? 2 : 0) + (haveC[m.ticker] ? 1 : 0); };
      return rank(b) - rank(a) || (b.dollar_volume_24h_computed || 0) - (a.dollar_volume_24h_computed || 0);
    });
    sel.innerHTML = sortable.map(function (m) {
      var badge = haveT[m.ticker] ? " · tick data" : haveC[m.ticker] ? " · candles" : "";
      return '<option value="' + esc(m.ticker) + '"' + ((m.ticker === want || (!want && m === sortable[0])) ? " selected" : "") + ">" +
        esc(TOPIC_LABEL[m.topic] || m.topic) + " · " + esc(m.title || m.ticker) + badge + "</option>";
    }).join("") || '<option value="">No markets yet</option>';
    var mode = "minutes", range = "6h";

    function seriesFor(ticker) {
      if (mode === "seconds" && haveT[ticker] && haveT[ticker].trades.length) {
        return { pts: haveT[ticker].trades.map(function (x) { return { t: new Date(x.ts).getTime(), c: x.price, h: x.price, l: x.price, o: x.price, vol: x.count }; }), src: haveT[ticker].source_url };
      }
      var set = mode === "hours" ? (haveH[ticker] || haveC[ticker]) : haveC[ticker];
      if (mode !== "seconds" && set && set.candles.length) {
        return {
          pts: set.candles.map(function (c) {
            return { t: c.ts * 1000, o: c.open, h: c.high, l: c.low, c: c.close, vol: c.volume };
          }), src: set.source_url
        };
      }
      var h = hist && hist.series && hist.series[ticker] ? hist.series[ticker] : [];
      if (h.length) {
        return {
          pts: h.map(function (p) { return { t: new Date(p.ts).getTime(), o: p.last, h: p.last, l: p.last, c: p.last, vol: p.vol24 }; }),
          src: "data/history.json", snapshot: true
        };
      }
      return { pts: [] };
    }

    function draw() {
      var ticker = sel.value;
      var m = markets.filter(function (x) { return x.ticker === ticker; })[0];
      var s = seriesFor(ticker);
      var marks = alerts.filter(function (a) { return a.ticker === ticker; });
      document.getElementById("chart").innerHTML = drawChart(s.pts, mode, RANGES[range], marks) +
        (s.snapshot ? '<p class="note"><b>Snapshot mode:</b> no candle/tape capture for this market (only the most active markets are sampled). Points are collection-run snapshots.</p>' : "") +
        (s.src ? '<p class="note">Data endpoint: ' + srcLink(s.src, "source") + "</p>" : "");
      var info = document.getElementById("mkinfo");
      if (info) {
        info.innerHTML = m ? "<b>" + esc(m.title || m.ticker) + "</b>" +
          (m.event_title ? '<div class="note">' + esc(m.event_title) + "</div>" : "") +
          "<div class=\"kv\"><span>Last traded</span><b>" + (m.has_traded ? price(m.last) : "no trade in 24h") + "</b></div>" +
          "<div class=\"kv\"><span>YES bid / ask</span><b>" + price(m.yes_bid) + " / " + price(m.yes_ask) + "</b></div>" +
          "<div class=\"kv\"><span>Contracts available at ask</span><b>" + (isNum(m.yes_ask_size) ? num(m.yes_ask_size, 2) : "—") + "</b></div>" +
          "<div class=\"kv\"><span>Cost to buy displayed ask size (computed)</span><b>" + (isNum(m.ask_depth_dollars_computed) ? usd(m.ask_depth_dollars_computed) : "—") + "</b></div>" +
          "<div class=\"kv\"><span>24h volume</span><b>" + num(m.volume_24h, 2) + " contracts</b></div>" +
          "<div class=\"kv\"><span>24h $ notional (computed)</span><b>" + (isNum(m.dollar_volume_24h_computed) ? usd(m.dollar_volume_24h_computed) : "—") + "</b></div>" +
          "<div class=\"kv\"><span>Open interest</span><b>" + num(m.open_interest, 2) + "</b></div>" +
          "<div class=\"kv\"><span>Closes</span><b>" + esc(when(m.close_time)) + "</b></div>" +
          "<div class=\"kv\"><span>Market API</span><b>" + srcLink(m.source_url, "source") + "</b></div>" +
          (m.settlement_sources && m.settlement_sources.length ? '<div class="note">Event settlement sources (reference, not cause): ' +
            m.settlement_sources.slice(0, 4).map(function (r) { return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.name || r.url) + "</a>"; }).join(" · ") + "</div>" : "")
          : '<p class="empty">Pick a market.</p>';
      }
      var book = ob && ob.books && ob.books[ticker];
      var lb = document.getElementById("book");
      if (!lb) return;
      if (!book) { lb.innerHTML = '<div class="card"><b>Order book depth</b><p class="empty">Depth is captured for the 25 most active markets each run; this market is not in that sample.</p></div>'; return; }
      function side(list, label) {
        var max = Math.max.apply(null, list.map(function (l) { return l.contracts_cumulative || 0; }).concat([1]));
        return '<div><h3>' + label + '</h3><div class="ladder">' + (list.length ? list.map(function (l) {
          return '<div class="ladder-row"><span class="ladder-px">' + price(l.price) + '</span>' +
            '<span class="ladder-bar" style="width:' + Math.max(2, (l.contracts_cumulative / max) * 100).toFixed(0) + '%"></span>' +
            '<span class="ladder-qty">' + num(l.contracts, 2) + " <em>cum " + num(l.contracts_cumulative, 2) + "</em></span></div>";
        }).join("") : '<p class="empty">No resting orders returned.</p>') + "</div></div>";
      }
      lb.innerHTML = '<div class="card"><div class="card-head"><b>Liquidity — resting orders</b><span class="note">captured ' + esc(when(book.ts, true)) + " · " + srcLink(book.source_url, "orderbook API") + "</span></div>" +
        '<p class="note">Each row is a price level with the number of contracts resting there (API <code>orderbook_fp</code>). Bar length is cumulative contracts from the top of book.</p>' +
        '<div class="two-col">' + side(book.yes_bids, "YES bids (buy YES)") + side(book.no_bids, "NO bids (buy NO)") + "</div></div>";
    }
    document.getElementById("mode").onchange = function (e) {
      mode = e.target.value;
      if (mode === "seconds") { range = "6h"; markRange("6h"); }
      if (mode === "hours") { range = "30d"; markRange("30d"); }
      draw();
    };
    function markRange(r) {
      document.querySelectorAll("#ctl-range button").forEach(function (b) { b.classList.toggle("on", b.dataset.r === r); });
    }
    document.getElementById("ctl-range").onclick = function (e) {
      if (!e.target.dataset.r) return;
      range = e.target.dataset.r; markRange(range); draw();
    };
    sel.onchange = function () {
      history.replaceState(null, "", "chart.html?ticker=" + encodeURIComponent(sel.value));
      draw();
    };
    markRange(range);
    draw();
  }

  /* ---------------- portfolio ---------------- */
  function sumTable(title, rows, noteText) {
    var h = "<h2>" + esc(title) + "</h2>" + (noteText ? '<p class="note">' + noteText + "</p>" : "") +
      '<div class="table-wrap"><table class="sourced"><thead><tr><th>Group</th><th class="num">Closed</th><th class="num">Wins</th><th class="num">Win rate</th>' +
      '<th class="num">Realized P&amp;L</th><th class="num">Avg P&amp;L / contract</th></tr></thead><tbody>';
    h += rows.length ? rows.map(function (r) {
      return "<tr><td>" + esc(r.group) + '</td><td class="num">' + r.closed_trades + '</td><td class="num">' + r.wins + '</td><td class="num">' + pct(r.win_rate) +
        '</td><td class="num">' + signed(r.total_pnl) + '</td><td class="num">' + (isNum(r.avg_pnl_per_contract) ? signed(r.avg_pnl_per_contract) : "—") + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="note">No closed trades yet.</td></tr>';
    return h + "</tbody></table></div>";
  }
  function tradeRows(list) {
    if (!list.length) return '<tr><td colspan="9" class="note">None yet.</td></tr>';
    return list.map(function (t) {
      return "<tr><td>" + esc(t.title || t.ticker) + '<div class="note">' + esc(t.ticker) + "</div></td><td>" + esc(t.topic_label || "") +
        "</td><td>" + esc(t.strategy) + "</td><td>" + esc(t.status) + '</td><td class="num">' + price(t.entry) + "</td>" +
        '<td class="num">' + price(t.exit != null ? t.exit : t.mark) + "</td>" +
        '<td class="num">' + signed(t.pnl != null ? t.pnl : t.unrealized_pnl) + "</td><td>" + esc(t.exit_reason || "") +
        "</td><td>" + srcLink(t.source_url) + "</td></tr>";
    }).join("");
  }
  async function renderPortfolio() {
    var meta = await load("meta.json"), tr = await load("trades.json");
    freshness(meta, document.getElementById("fresh"));
    var p = tr && tr.portfolio;
    var k = document.getElementById("pf-kpis");
    if (k) {
      k.innerHTML = p ? '<div class="kpi"><b>' + usd(p.equity) + '</b><span>Paper equity (start ' + usd(p.starting_cash) + ")</span></div>" +
        '<div class="kpi"><b>' + signed(p.realized_pnl) + '</b><span>Realized</span></div>' +
        '<div class="kpi"><b>' + signed(p.unrealized_pnl) + '</b><span>Unrealized</span></div>' +
        '<div class="kpi"><b>' + p.open_positions + '</b><span>Open positions</span></div>' +
        '<div class="kpi"><b>' + p.closed_trades + '</b><span>Closed trades</span></div>' +
        '<div class="kpi"><b>' + pct(p.win_rate) + '</b><span>Win rate</span></div>'
        : '<p class="empty">No trade data yet.</p>';
    }
    var body = document.getElementById("trade-body");
    if (!body) return;
    if (!tr) { body.innerHTML = '<p class="empty">No trade data yet. The collector opens paper trades when a high-ROI alert fires.</p>'; return; }
    var closed = (tr.closed_trades || []).slice().reverse();
    var eq = [], run = 0;
    (tr.closed_trades || []).forEach(function (t) { run += t.pnl || 0; eq.push({ t: new Date(t.exit_at || t.opened_at).getTime(), c: run }); });
    var eqChart = "";
    if (eq.length > 1) {
      eqChart = '<div class="card"><b>Realized P&amp;L over time (computed from closed paper trades)</b>' +
        drawChart(eq.map(function (x) { return { t: x.t, o: x.c, h: x.c, l: x.c, c: x.c }; }), "hours", null, []) + "</div>";
    }
    body.innerHTML =
      '<p class="note">' + esc(tr.mode || "") + ". Assumptions: " + esc(JSON.stringify(tr.assumptions || {})) + "</p>" +
      eqChart +
      sumTable("By strategy", tr.by_strategy || [], "Strategies are rule sets defined by the collector, not validated models. Fees, slippage and queue position are not modelled.") +
      sumTable("By topic", tr.by_topic || []) +
      sumTable("By alert direction", tr.by_alert_direction || []) +
      '<h2>Open paper positions</h2><div class="table-wrap"><table class="sourced"><thead><tr><th>Market</th><th>Topic</th><th>Strategy</th><th>Status</th>' +
      '<th class="num">Entry</th><th class="num">Mark</th><th class="num">Unrealized</th><th>Exit reason</th><th>Source</th></tr></thead><tbody>' +
      tradeRows(tr.open_trades || []) + "</tbody></table></div>" +
      '<h2>Closed paper trades</h2><div class="table-wrap"><table class="sourced"><thead><tr><th>Market</th><th>Topic</th><th>Strategy</th><th>Status</th>' +
      '<th class="num">Entry</th><th class="num">Exit</th><th class="num">P&amp;L</th><th>Exit reason</th><th>Source</th></tr></thead><tbody>' +
      tradeRows(closed) + "</tbody></table></div>" +
      '<div class="card flag"><b>Kalshi demo account not connected.</b> This portfolio is a paper simulation computed from the API prices above. ' +
      'Reading a real demo-account balance needs API-key credentials stored as repository secrets; none are configured. ' +
      '<a href="flagged.html">See Flagged for review</a>.</div>';
  }

  /* ---------------- resolved ---------------- */
  async function renderResolved() {
    var rs = await load("resolved.json"), meta = await load("meta.json");
    freshness(meta, document.getElementById("fresh"));
    var rows = rs ? rs.resolved : [];
    var yes = rows.filter(function (x) { return x.result === "yes"; }).length;
    var k = document.getElementById("res-kpi");
    if (k) k.innerHTML = '<div class="kpi"><b>' + rows.length + '</b><span>Resolved markets tracked</span></div>' +
      '<div class="kpi"><b>' + yes + '</b><span>Resolved YES</span></div>' +
      '<div class="kpi"><b>' + (rows.length - yes) + '</b><span>Resolved NO</span></div>';
    var h = '<div class="table-wrap"><table class="sourced"><thead><tr><th>Market</th><th>Topic</th><th>Result</th>' +
      '<th class="num">Settlement value</th><th class="num">Last price before resolution</th><th>Resolved (first seen)</th><th>Source</th></tr></thead><tbody>';
    h += rows.map(function (x) {
      var v = x.settlement_value;
      return "<tr><td>" + esc(x.title || x.ticker) + '<div class="note">' + esc(x.ticker) + "</div></td><td>" + esc(x.topic_label || "") +
        '</td><td><b class="tag ' + (x.result === "yes" ? "yes" : "no") + '">' + esc((x.result || "").toUpperCase()) + "</b></td>" +
        '<td class="num">' + (isNum(v) ? price(v) : '<span class="unv">unverified</span>') + "</td>" +
        '<td class="num">' + (isNum(x.last_before_resolution) ? price(x.last_before_resolution) : '<span class="unv">unverified</span>') + "</td>" +
        "<td>" + esc(when(x.resolved_at)) + "</td><td>" + srcLink(x.source_url) + "</td></tr>";
    }).join("") || '<tr><td colspan="7" class="note">No resolutions recorded yet.</td></tr>';
    document.getElementById("res-table").innerHTML = h + "</tbody></table></div>";
  }

  /* ---------------- boot ---------------- */
  function route() {
    renderNav();
    var page = document.body.getAttribute("data-page");
    var topic = document.body.getAttribute("data-topic");
    if (topic) return renderTopic(topic);
    if (page === "home") return renderHome();
    if (page === "alerts") return renderAlerts();
    if (page === "dashboard") return renderDashboard();
    if (page === "chart") return renderChart();
    if (page === "portfolio" || page === "trades") return renderPortfolio();
    if (page === "resolved") return renderResolved();
    return Promise.resolve();
  }
  document.addEventListener("DOMContentLoaded", function () {
    route();
    setInterval(function () { cache = {}; route(); }, POLL_MS);
    var btn = document.getElementById("refresh-now");
    if (btn) btn.onclick = function () { cache = {}; route(); };
  });
})();
