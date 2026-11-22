/* layout.js — shared header/footer injected into every page.
   All generated links use window.DASHROOT (computed from the current URL)
   so the site works on GitHub Pages (/{repo}/dash/...), local servers and file://. */
(function () {
  "use strict";
  function dashRoot() {
    var p = window.location.pathname || "";
    var i = p.lastIndexOf("/dash/");
    if (i >= 0) return p.slice(0, i + "/dash".length);
    if (p.slice(-5) === "/dash") return p;
    if (p.slice(-4) === "dash") return p; // opened directly as .../dash/index.html
    return "";
  }
  window.DASHROOT = dashRoot();
  var R = window.DASHROOT;
  var page = document.body.dataset.page || "home";
  var links = [
    ["home", R + "/", "Home"],
    ["gas", R + "/topics/gas/", "Gas"],
    ["elections", R + "/topics/elections/", "Elections"],
    ["culture", R + "/topics/culture/", "Culture"],
    ["crypto", R + "/topics/crypto/", "Crypto"],
    ["golf", R + "/topics/golf/", "Golf"],
    ["alerts", R + "/alerts/", "Alerts"],
    ["charts", R + "/charts/", "Charts"],
    ["portfolio", R + "/portfolio/", "Portfolio (sim)"],
    ["docs", R + "/docs/", "Summary"],
    ["flagged", R + "/flagged/", "Flagged"]
  ];
  var nav = links.map(function (l) {
    return '<a href="' + l[1] + '" class="' + (page === l[0] ? "on" : "") + '">' + l[2] + "</a>";
  }).join("");
  var header =
    '<header class="top"><div class="wrap">' +
    '<a class="brand" href="' + R + '/" rel="home">KALSHI <b>DEMO</b> DASHBOARD</a>' +
    '<span class="mode">REPLAY · verified historical data</span>' +
    '<nav class="main">' + nav + "</nav>" +
    "</div></header>";
  document.body.insertAdjacentHTML("afterbegin", header);

  var footer =
    '<footer><div class="wrap">' +
    "<div><b>Tradebot2 · Kalshi Demo Dashboard</b> (session-arena-93ec9646, mounted at <span class='mono'>/dash/</span>)<br>" +
    "Snapshot " + (window.KDATA ? window.KDATA.snapshotTs : "") + " UTC · all values verified against the official Kalshi demo API — see <a href='" + R + "/docs/sources/'>Sources</a>.<br>" +
    "Not affiliated with Kalshi. Simulated trading only — no real orders. <a href='" + R + "/flagged/'>Flagged for Review</a> · <a href='" + R + "/docs/'>Executive summary</a></div>" +
    "</div></footer>";
  document.body.insertAdjacentHTML("beforeend", footer);
})();
