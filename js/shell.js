/* Shared chrome: nav, live-status pill, and page-level helpers.
 * Loaded by every page after js/live.js. Keeps nav and footer identical so no
 * page can drift out of sync.
 */
(() => {
  const NAV = [
    ["index.html", "Dashboard"],
    ["topic-gas.html", "Gas"],
    ["topic-elections.html", "Elections"],
    ["topic-culture.html", "Culture"],
    ["topic-crypto.html", "Crypto"],
    ["topic-golf.html", "Golf"],
    ["events.html", "Resolved"],
    ["strategies.html", "Strategies"],
    ["summary.html", "API summary"],
    ["verification.html", "Verification"],
    ["suggestions.html", "Ideas"],
    ["flagged.html", "Flagged"],
    ["archive-dashboards.html", "Archive"],
  ];

  function nav() {
    const here = location.pathname.split("/").pop() || "index.html";
    const links = NAV.map(([href, label]) =>
      `<a href="${href}" class="${href === here ? "active" : ""}">${label}</a>`).join("");
    return `<header class="top"><div class="nav">
      <div class="brand"><span class="dot" id="liveDot"></span>
        <span>Tradebot2</span><small>Kalshi demo · 5 topics</small></div>
      <nav class="links">${links}</nav>
    </div></header>`;
  }

  function footer() {
    return `<footer class="foot">
      <p>Tradebot2 is a read-only research dashboard for the <b>Kalshi demo</b> exchange
      (<code>external-api.demo.kalshi.co</code>). It holds no API key, sends no orders, and never
      fills in a number it could not read from an official source.</p>
      <p>Every table row links to the official Kalshi URL it came from. Values the API did not
      return are blank and marked unverified. <a href="verification.html">Verification log</a> ·
      <a href="flagged.html">Flagged for review</a> ·
      <a href="https://docs.kalshi.com/" target="_blank" rel="noopener">Kalshi API docs</a></p>
    </footer>`;
  }

  let mounted = false;

  /** Idempotent: safe if DOMContentLoaded fires more than once (bfcache, tests). */
  function mount() {
    if (mounted) return;
    mounted = true;
    const shell = document.getElementById("shell");
    if (shell && !shell.querySelector("header.top")) shell.insertAdjacentHTML("afterbegin", nav());
    const f = document.getElementById("footer");
    if (f && !f.querySelector("footer")) f.innerHTML = footer();
    paintStatus();
  }

  /* Live-ness pill: green only when the demo API answered this browser. */
  async function paintStatus() {
    const dot = document.getElementById("liveDot");
    const pill = document.getElementById("modePill");
    if (!window.T2) return;
    const st = await T2.status();
    if (dot) dot.className = "dot" + (st.ok ? "" : " off");
    if (pill) {
      pill.className = "badge " + (st.ok ? "live" : "err");
      pill.textContent = st.ok
        ? `live demo API · trading ${st.trading_active ? "active" : "paused"}`
        : "demo API unreachable from this browser — snapshot only";
    }
    return st;
  }

  function topicBadge(key) {
    if (!key) return '<span class="badge off">off-topic</span>';
    return `<span class="badge ${key}">${key === "gas" ? "gas prices" : key}</span>`;
  }

  function srcLink(url, label = "source") {
    if (!url) return '<span class="unverified">unverified</span>';
    return `<a href="${T2.esc(url)}" target="_blank" rel="noopener">${label} ↗</a>`;
  }

  const v = (x, fmt) => (x === null || x === undefined || x === "" ? '<span class="unverified">—</span>' : fmt ? fmt(x) : T2.esc(x));

  window.Shell = { mount, paintStatus, topicBadge, srcLink, v, NAV };
  document.addEventListener("DOMContentLoaded", mount);
})();
