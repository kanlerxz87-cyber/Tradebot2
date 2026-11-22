/* ============================================================
   render.js — shared page renderers.
   Every table row carries source links: the exact official API
   query used to verify the values, the official Kalshi website
   page when one was verified, and the official settlement
   source(s) from the API. null => "–" (never inferred).
   ============================================================ */
(function () {
  "use strict";

  // Site root at runtime (set by layout.js; computed here as a fallback so
  // renderers work regardless of script order). GitHub Pages serves the repo
  // under /{repo}/, so links must be built from the real base, not "/".
  function root() {
    if (window.DASHROOT != null) return window.DASHROOT;
    var p = window.location.pathname || "";
    var i = p.lastIndexOf("/dash/");
    if (i >= 0) return p.slice(0, i + "/dash".length);
    if (p.slice(-5) === "/dash") return p;
    return "";
  }

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtUsd(n, digits) {
    if (n == null) return "–";
    var s = n.toLocaleString("en-US", { maximumFractionDigits: digits == null ? 2 : digits });
    return "$" + s;
  }
  function fmtP(n) {
    if (n == null) return "–";
    return "$" + n.toFixed(2);
  }
  function fmtVol(v) {
    if (v == null) return "–";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + v.toFixed(0);
  }
  function statusBadge(m) {
    if (m.status === "finalized" || m.status === "closed" || m.status === "settled") {
      var r = m.settledResult;
      return '<span class="badge done">' + (r ? "SETTLED " + r.toUpperCase() : "SETTLED") + "</span>";
    }
    if (m.status === "active" || m.status === "open") return '<span class="badge open">LIVE</span>';
    return '<span class="badge">' + esc(m.status) + "</span>";
  }
  function srcLinks(m) {
    var h = "";
    if (m.src && m.src.api) h += '<a href="' + esc(m.src.api) + '" target="_blank" rel="noopener">API</a>';
    if (m.src && m.src.site) h += ' · <a href="' + esc(m.src.site) + '" target="_blank" rel="noopener">Kalshi site</a>';
    if (m.src && m.src.settlement && m.src.settlement.length) {
      m.src.settlement.slice(0, 2).forEach(function (s) {
        h += ' · <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + "</a>";
      });
    }
    return h || "–";
  }

  // Market table for a topic (or all). opts: {onlyTopic, onlyStatus, ranked}
  function renderMarkets(containerId, opts) {
    var el = $(containerId);
    if (!el) return;
    var D = window.KDATA;
    var rows = (D.markets || []).filter(function (m) {
      if (opts && opts.onlyTopic && m.topic !== opts.onlyTopic) return false;
      if (opts && opts.onlyStatus) {
        var isLive = m.status === "active" || m.status === "open";
        var isDone = m.status === "finalized" || m.status === "closed" || m.status === "settled";
        if (opts.onlyStatus === "live" && !isLive) return false;
        if (opts.onlyStatus === "done" && !isDone) return false;
      }
      return true;
    });
    if (opts && opts.ranked) {
      rows = rows.slice().sort(function (a, b) {
        var av = a.volume24h != null && a.volume24h > 0 ? a.volume24h : (a.volume || 0);
        var bv = b.volume24h != null && b.volume24h > 0 ? b.volume24h : (b.volume || 0);
        return bv - av;
      });
    }
    var html =
      "<table><thead><tr>" +
      "<th>Event / market</th><th>Status</th><th class='num'>Last</th>" +
      "<th class='num'>Yes bid</th><th class='num'>Yes ask</th>" +
      "<th class='num'>Vol 24h (notional)</th><th class='num'>Total vol</th><th class='num'>Open interest</th>" +
      "<th>Close / settle</th><th>Sources</th>" +
      "</tr></thead><tbody>";
    if (!rows.length) {
      html += "<tr><td colspan='10' class='note'>No verified markets in this view — see Flagged for Review.</td></tr>";
    }
    rows.forEach(function (m) {
      var cls = m.last == null ? "flat" : (m.last >= 0.5 ? "up" : "down");
      var notional24 = (m.volume24h == null || m.volume24h === 0)
        ? (m.volume ? "0 (no 24h; total " + fmtVol(m.volume) + ")" : "0")
        : fmtVol(m.volume24h) + " <span class='note'>(" + Math.round(m.volume24h) + " contracts)</span>";
      html += "<tr>" +
        "<td><b>" + esc(m.eventTitle) + "</b><br><span class='note'>" + esc(m.title) + " · <span class='mono'>" + esc(m.market) + "</span></span>" +
        (m.flag ? "<br><span class='flagmark'>⚑ " + esc(m.flag) + "</span>" : "") +
        "</td>" +
        "<td>" + statusBadge(m) + "</td>" +
        "<td class='num p " + cls + "'>" + fmtP(m.last) + "</td>" +
        "<td class='num'>" + fmtP(m.yesBid) + (m.yesBidSize ? " ×" + m.yesBidSize : "") + "</td>" +
        "<td class='num'>" + fmtP(m.yesAsk) + (m.yesAskSize ? " ×" + m.yesAskSize : "") + "</td>" +
        "<td class='num'>" + notional24 + "</td>" +
        "<td class='num'>" + fmtVol(m.volume) + "</td>" +
        "<td class='num'>" + fmtVol(m.oi) + "</td>" +
        "<td class='note'>" + esc((m.closeTime || "").substr(0, 10)) + (m.settledTs ? "<br><span class='flagmark'>settled " + esc(m.settledTs.substr(0, 16)) + "Z</span>" : "") + "</td>" +
        "<td class='srcs'>" + srcLinks(m) + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    html += "<p class='note'>Notional = contracts × $1.00 (each contract settles at exactly $1 — official settlement docs). 'Vol 24h' is <span class='mono'>volume_24h_fp</span>; where 24h volume is 0 the total volume is shown instead, labeled as such. No value is inferred; blanks mean 'not present in the verified snapshot'.</p>";
    el.innerHTML = html;
  }

  // Event-level rollup grouped by event (topics stay separate; events grouped)
  function renderEvents(containerId, opts) {
    var el = $(containerId);
    if (!el) return;
    var D = window.KDATA;
    var groups = {};
    (D.markets || []).forEach(function (m) {
      if (opts && opts.onlyTopic && m.topic !== opts.onlyTopic) return;
      var k = m.topic + "||" + m.event;
      if (!groups[k]) groups[k] = { topic: m.topic, event: m.event, eventTitle: m.eventTitle, series: m.series, seriesTitle: m.seriesTitle, markets: [], vol: 0, vol24: 0, anyLive: false, settled: null, src: m.src };
      groups[k].markets.push(m);
      groups[k].vol += m.volume || 0;
      groups[k].vol24 += m.volume24h || 0;
      if (m.status === "active" || m.status === "open") groups[k].anyLive = true;
      if (m.settledResult) groups[k].settled = m.settledResult;
    });
    var list = Object.keys(groups).map(function (k) { return groups[k]; });
    list.sort(function (a, b) { return (b.vol24 || b.vol) - (a.vol24 || a.vol); });
    var html = "<table><thead><tr><th>Topic</th><th>Event (grouped)</th><th class='num'>Markets</th><th>Status</th><th class='num'>Total notional (all markets)</th><th class='num'>24h notional</th><th>Resolution</th><th>Sources</th></tr></thead><tbody>";
    if (!list.length) html += "<tr><td colspan='8' class='note'>Nothing to show.</td></tr>";
    list.forEach(function (g) {
      var resTxt = "–";
      if (g.settled) {
        // resolution only if ALL markets in the group agree in direction of the winning leg
        resTxt = "settled: " + esc(g.markets.map(function (m) { return m.title.split(" (")[0].substr(0, 22) + "=" + (m.settledResult || "?"); }).join(", "));
      }
      html += "<tr>" +
        "<td><a href='" + root() + "/topics/" + esc(g.topic) + "/'><span class='badge topic'>" + esc(g.topic) + "</span></a></td>" +
        "<td><b>" + esc(g.eventTitle) + "</b><br><span class='note mono'>" + esc(g.event) + " · " + esc(g.series) + "</span></td>" +
        "<td class='num'>" + g.markets.length + "</td>" +
        "<td>" + (g.anyLive ? '<span class="badge open">LIVE</span>' : '<span class="badge done">CLOSED</span>') + "</td>" +
        "<td class='num'>" + fmtVol(g.vol) + "</td>" +
        "<td class='num'>" + (g.vol24 ? fmtVol(g.vol24) : "0") + "</td>" +
        "<td class='note'>" + (g.settled ? resTxt : (g.anyLive ? "tracking until resolution" : "–")) + "</td>" +
        "<td class='srcs'>" + srcLinks({ src: g.src }) + "</td>" +
        "</tr>";
    });
    html += "</tbody></table>";
    el.innerHTML = html;
  }

  // Topic card grid for landing
  function renderTopicCards(containerId) {
    var el = $(containerId);
    if (!el) return;
    var D = window.KDATA;
    var h = "";
    Object.keys(D.topics).forEach(function (t) {
      var info = D.topics[t];
      var ms = (D.markets || []).filter(function (m) { return m.topic === t; });
      var live = ms.filter(function (m) { return m.status === "active" || m.status === "open"; }).length;
      var vol = ms.reduce(function (s, m) { return s + (m.volume || 0); }, 0);
      h += "<a class='chip' href='" + root() + "/topics/" + info.slug + "/'><b>" + esc(info.name) + "</b>" +
        "<span>" + ms.length + " verified markets · " + live + " live · " + fmtVol(vol) + " total notional</span>" +
        "<span class='note'>" + esc(info.blurb) + "</span></a>";
    });
    el.innerHTML = h;
  }

  // Demo-site highlights strip
  function renderHighlights(containerId) {
    var el = $(containerId);
    if (!el) return;
    var D = window.KDATA;
    el.innerHTML = (D.demoSiteHighlights || []).map(function (x) {
      return '<a class="chip" href="' + esc(x.url) + '" target="_blank" rel="noopener"><b>' + esc(x.label) + "</b>" +
        "<span>" + esc(x.topic) + " · official demo.kalshi.co page</span></a>";
    }).join("");
  }

  window.KRENDER = {
    renderMarkets: renderMarkets,
    renderEvents: renderEvents,
    renderTopicCards: renderTopicCards,
    renderHighlights: renderHighlights,
    fmtUsd: fmtUsd, fmtP: fmtP, fmtVol: fmtVol, esc: esc, srcLinks: srcLinks, statusBadge: statusBadge
  };
})();
