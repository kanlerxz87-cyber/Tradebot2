/* Landing page: fills verified snapshot figures and a short, real alert preview. */
(function () {
  "use strict";
  const TB = window.TB;
  const UI = window.TBUI;

  document.addEventListener("DOMContentLoaded", async () => {
    const data = await UI.loadAll(["snapshot.json", "probe.json", "backtest.json"]);
    const snapshot = data["snapshot.json"];
    const probe = data["probe.json"];
    if (!snapshot) {
      document.querySelectorAll("[data-snapshot-time]").forEach((el) => { el.textContent = "unavailable"; });
      return;
    }
    UI.applySnapshotChrome(snapshot);

    (snapshot.topics || []).forEach((topic) => {
      document.querySelectorAll('[data-topic-vol="' + topic.key + '"]').forEach((el) => {
        el.textContent = TB.compact(topic.volume_24h_contracts) + " contracts / 24h";
      });
      document.querySelectorAll('[data-topic-res="' + topic.key + '"]').forEach((el) => {
        el.textContent = topic.resolved_markets_30d + " resolved / 30d";
      });
    });

    const totalVolume = (snapshot.topics || []).reduce((sum, t) => sum + (t.volume_24h_contracts || 0), 0);
    UI.setText("[data-total-volume]", TB.compact(totalVolume));
    UI.setText("[data-open-scope]", (snapshot.stats || {}).open_markets_in_scope || 0);
    UI.setText("[data-resolved-30d]", (snapshot.resolutions || []).length);
    UI.setText("[data-probe-cors]", probe && probe.cors_public_read_allowed ? "Allowed (measured)" : "Not confirmed");
    UI.setText("[data-probe-time]", probe ? TB.isoDate(probe.generated_at) : "not measured");
    const ws = probe && probe.ws && probe.ws.results && probe.ws.results[0];
    UI.setText("[data-probe-ws]", ws ? (ws.upgraded ? "Unexpectedly open" : "Rejected without auth") : "not measured");
    UI.setText("[data-backtest-trades]", data["backtest.json"] ? (data["backtest.json"].portfolio.analytics.closed_trades || 0) : "—");
    UI.setText("[data-backtest-pnl]", data["backtest.json"] ? TB.money(data["backtest.json"].portfolio.analytics.total_pnl, 0) : "—");

    renderTopMarkets(snapshot);
    renderAlerts(snapshot);
  });

  function renderTopMarkets(snapshot) {
    const body = document.querySelector("#home-markets tbody");
    if (!body) return;
    const rows = (snapshot.markets || []).slice().sort((a, b) => (b.volume.notional_24h_est || 0) - (a.volume.notional_24h_est || 0)).slice(0, 8);
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7"><div class="empty">No tracked markets in this snapshot.</div></td></tr>';
      return;
    }
    body.innerHTML = rows.map((m) => {
      const move = move24h(m);
      return '<tr>' +
        '<td><a class="market-name" href="' + TB.esc(m.links.kalshi) + '" target="_blank" rel="noopener">' + TB.esc(m.title) + '</a><span class="sub mono">' + TB.esc(m.ticker) + '</span></td>' +
        '<td>' + UI.topicBadge(m.topic) + '</td>' +
        '<td class="num">' + TB.money(m.prices && m.prices.mid) + '</td>' +
        '<td class="num ' + (move > 0 ? "up" : move < 0 ? "down" : "") + '">' + (move === null ? "—" : (move > 0 ? "+" : "") + TB.cents(move)) + '</td>' +
        '<td class="num">' + TB.compact(m.volume.last_24h_contracts) + '</td>' +
        '<td class="num">' + TB.money(m.volume.notional_24h_est, 0) + '</td>' +
        '<td><span class="source-links"><a href="' + TB.esc(m.links.market_api) + '" target="_blank" rel="noopener">API ↗</a><a href="' + TB.esc(m.links.kalshi) + '" target="_blank" rel="noopener">Kalshi ↗</a></span></td>' +
        '</tr>';
    }).join("");
  }

  function move24h(market) {
    const rows = (market.candles || {})["1m"] || [];
    let first = null; let last = null;
    rows.forEach((row) => {
      if (row[1] === null || row[1] === undefined) return;
      if (first === null) first = row[1];
      last = row[1];
    });
    if (first === null) return null;
    return last - first;
  }

  function renderAlerts(snapshot) {
    const host = document.querySelector("#home-alerts");
    if (!host) return;
    const alerts = (snapshot.alerts_seed || []).slice(0, 7);
    if (!alerts.length) {
      host.innerHTML = '<div class="empty">No ≥ $0.10 moves in the seeded window.</div>';
      return;
    }
    host.innerHTML = alerts.map((a) => {
      const links = a.links || {};
      return '<div class="msg ' + (a.direction === "up" ? "up" : "down") + ' history">' +
        '<div class="meta"><span class="time">' + TB.isoDate(new Date(a.ts * 1000)) + '</span>' +
        '<span class="badge ' + (a.direction === "up" ? "up" : "down") + '">' + (a.delta > 0 ? "+" : "") + TB.money(a.delta) + '</span>' +
        '<span>' + TB.esc((TB.TOPICS[a.topic] || {}).label || a.topic) + '</span></div>' +
        '<div class="headline">' + TB.esc(a.title) + '</div>' +
        '<div class="numbers"><span>' + TB.money(a.before) + ' → ' + TB.money(a.after) + '</span><span>history · 1m candles</span></div>' +
        UI.linkChips(links, { api: true, news: true, maxSources: 1 }) + '</div>';
    }).join("");
  }
})();
