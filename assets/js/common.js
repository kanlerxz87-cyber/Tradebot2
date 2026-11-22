/* Tradebot2 shared page chrome and small UI helpers. */
(function () {
  "use strict";
  const TB = window.TB;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function markNav() {
    const page = document.body.getAttribute("data-page");
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.getAttribute("data-nav") === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  async function loadAll(names) {
    const out = {};
    await Promise.all((names || ["snapshot.json", "probe.json", "backtest.json"]).map(async (name) => {
      try { out[name] = await window.TBLive.loadData(name); }
      catch (error) { out[name] = null; out.errors = (out.errors || []).concat(name + ": " + error.message); }
    }));
    // One visible degradation note on every page, even for pages whose own
    // controller has nothing useful to render without data.
    const missing = Object.keys(out).filter((key) => key !== "errors" && !out[key]);
    const main = document.querySelector("main");
    const existing = document.querySelector("[data-snapshot-missing]");
    if (missing.length && main && !existing) {
      const div = document.createElement("div");
      div.className = "note danger";
      div.setAttribute("data-snapshot-missing", "");
      div.innerHTML = "<strong>Verified snapshot unavailable.</strong> Could not load " +
        missing.map((name) => "<code>data/" + TB.esc(name) + "</code>").join(", ") +
        ". No values are substituted: every affected figure shows a dash, and live polling is unaffected.";
      main.insertBefore(div, main.firstChild);
    }
    return out;
  }

  function setStatus(state, label, detail) {
    document.querySelectorAll(".js-live-status").forEach((el) => {
      el.className = "badge dot js-live-status " + (state === "live" ? "green" : state === "degraded" ? "warn" : state === "offline" ? "down" : "neutral");
      el.innerHTML = '<span class="live-dot" style="background:' +
        (state === "live" ? "#2fe3b0" : state === "degraded" ? "#ffc857" : state === "offline" ? "#ff5f7e" : "#6f829b") +
        '"></span>' + TB.esc(label || state);
      if (detail) el.title = detail;
    });
  }

  function snapshotAge(snapshot) {
    if (!snapshot || !snapshot.generated_at) return "unknown";
    return TB.relative(new Date(snapshot.generated_at).getTime());
  }

  function linkChips(links, options) {
    if (!links) return "";
    const opts = options || {};
    const chips = [];
    if (links.kalshi) chips.push('<a href="' + TB.esc(links.kalshi) + '" target="_blank" rel="noopener">Kalshi ↗</a>');
    if (links.market_api && opts.api !== false) chips.push('<a href="' + TB.esc(links.market_api) + '" target="_blank" rel="noopener">API source ↗</a>');
    if (links.news_search && opts.news !== false) chips.push('<a href="' + TB.esc(links.news_search) + '" target="_blank" rel="noopener" title="Google News search built from the market title; context only, not causal evidence">News context ↗</a>');
    if (Array.isArray(links.settlement_sources)) {
      links.settlement_sources.slice(0, opts.maxSources || 1).forEach((source) => {
        if (source && source.url) chips.push('<a href="' + TB.esc(source.url) + '" target="_blank" rel="noopener" title="Official settlement source named by Kalshi">' + TB.esc(source.name || "Settlement source") + " ↗</a>");
      });
    }
    return chips.length ? '<div class="chips">' + chips.join("") + "</div>" : "";
  }

  function topicBadge(topic) {
    const meta = TB.TOPICS[topic];
    return '<span class="badge neutral topic-tag">' + TB.esc(meta ? meta.label : topic) + "</span>";
  }

  function renderTickerBar(snapshot) {
    const track = document.querySelector(".js-ticker-track");
    if (!track || !snapshot) return;
    const markets = (snapshot.markets || []).slice().sort((a, b) => (b.volume.notional_24h_est || 0) - (a.volume.notional_24h_est || 0)).slice(0, 6);
    track.innerHTML = markets.map((m) => {
      const price = TB.snapshotPrice(m).price;
      return '<span class="ticker-item">' + topicBadge(m.topic) + '<strong>' + TB.esc(m.title) + '</strong>' +
        '<span class="mono">' + (price === null ? "—" : TB.cents(price)) + "</span></span>";
    }).join('<span class="muted-2">·</span>') || '<span class="muted">No tracked markets in the snapshot.</span>';
  }

  function probeLine(probe) {
    if (!probe) return "CORS probe not loaded";
    const rest = probe.rest && probe.rest.hosts ? probe.rest.hosts[0] : null;
    if (!probe.cors_public_read_allowed) return "Browser CORS not confirmed by CI";
    return "CORS verified " + TB.relative(new Date(probe.generated_at).getTime()) + (rest && rest.status ? " · HTTP " + rest.status : "");
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => { el.textContent = value; });
  }

  function setHTML(selector, html) {
    document.querySelectorAll(selector).forEach((el) => { el.innerHTML = html; });
  }

  function toast(message, tone) {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:200;display:flex;flex-direction:column;gap:8px;max-width:360px";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "note " + (tone || "info");
    el.style.boxShadow = "var(--shadow)";
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .4s"; }, 3600);
    setTimeout(() => el.remove(), 4200);
  }

  function dataNote(snapshot) {
    return "Snapshot " + TB.isoDate(snapshot && snapshot.generated_at) + " · " + snapshotAge(snapshot);
  }

  // Fill simple snapshot-driven fields that appear across pages.
  function applySnapshotChrome(snapshot) {
    if (!snapshot) return;
    document.querySelectorAll("[data-snapshot-time]").forEach((el) => { el.textContent = TB.isoDate(snapshot.generated_at); });
    document.querySelectorAll("[data-snapshot-age]").forEach((el) => { el.textContent = snapshotAge(snapshot); });
    document.querySelectorAll("[data-api-base]").forEach((el) => { el.textContent = snapshot.api_base || "—"; });
    document.querySelectorAll("[data-topic-count]").forEach((el) => {
      const topic = el.getAttribute("data-topic-count");
      const row = (snapshot.topics || []).find((t) => t.key === topic);
      el.textContent = row ? row.open_markets : "—";
    });
    document.querySelectorAll("[data-tracked]").forEach((el) => { el.textContent = snapshot.stats ? snapshot.stats.tracked_markets : "—"; });
    document.querySelectorAll("[data-resolutions-count]").forEach((el) => { el.textContent = snapshot.resolutions ? snapshot.resolutions.length : "—"; });
    document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  window.TBUI = {
    ready, markNav, loadAll, setStatus, snapshotAge, linkChips, topicBadge,
    renderTickerBar, probeLine, setText, setHTML, toast, dataNote, applySnapshotChrome
  };
  ready(markNav);
})();
