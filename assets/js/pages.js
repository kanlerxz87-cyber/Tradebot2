/* Fills dynamic, verified figures on the static narrative pages. Missing data
   renders as "—" (never a made-up number). */
(function () {
  "use strict";
  const TB = window.TB;
  const UI = window.TBUI;

  document.addEventListener("DOMContentLoaded", async () => {
    const data = await UI.loadAll(["snapshot.json", "probe.json", "backtest.json"]);
    const snapshot = data["snapshot.json"];
    const probe = data["probe.json"];
    const backtest = data["backtest.json"];
    if (!snapshot) return;
    UI.applySnapshotChrome(snapshot);

    const stats = snapshot.stats || {};
    const topics = snapshot.topics || [];
    const markets = snapshot.markets || [];
    const top = markets.slice().sort((a, b) => (b.volume.notional_24h_est || 0) - (a.volume.notional_24h_est || 0))[0];
    const totalVolume = topics.reduce((sum, t) => sum + (t.volume_24h_contracts || 0), 0);
    const analytics = backtest && backtest.portfolio ? backtest.portfolio.analytics : null;

    const values = {
      tracked: stats.tracked_markets,
      open_scope: stats.open_markets_in_scope,
      open_total: stats.open_markets_total,
      resolutions: (snapshot.resolutions || []).length,
      volume_24h: TB.compact(totalVolume),
      alerts_seed: stats.seed_alerts,
      series_indexed: stats.series_indexed,
      errors: stats.open_markets_total !== undefined ? snapshot.meta.error_count : null,
      top_market: top ? top.title : "—",
      top_market_price: top ? TB.money(TB.snapshotPrice(top).price) : "—",
      top_market_volume: top ? TB.compact(top.volume.last_24h_contracts) : "—",
      top_market_notional: top ? TB.money(top.volume.notional_24h_est, 0) : "—",
      top_market_topic: top ? ((TB.TOPICS[top.topic] || {}).label || top.topic) : "—",
      backtest_trades: analytics ? analytics.closed_trades : null,
      backtest_pnl: analytics ? (analytics.total_pnl >= 0 ? "+" : "") + TB.money(analytics.total_pnl, 2) : null,
      backtest_win: analytics && analytics.closed_trades ? TB.pct(analytics.win_rate) : null,
      backtest_markets: backtest ? backtest.coverage.markets_tested : null,
      probe_cors: probe ? (probe.cors_public_read_allowed ? "Allowed (measured)" : "Not confirmed") : null,
      probe_ws: probe && probe.ws && probe.ws.results && probe.ws.results[0] ? (probe.ws.results[0].upgraded ? "Unexpectedly open" : "Rejected without auth") : null,
      probe_time: probe ? TB.isoDate(probe.generated_at) : null
    };
    topics.forEach((topic) => {
      values[topic.key + "_open"] = topic.open_markets;
      values[topic.key + "_tracked"] = topic.tracked_markets;
      values[topic.key + "_resolved"] = topic.resolved_markets_30d;
      values[topic.key + "_volume"] = TB.compact(topic.volume_24h_contracts);
      values[topic.key + "_oi"] = TB.compact(topic.open_interest_contracts);
    });

    document.querySelectorAll("[data-stat]").forEach((el) => {
      const key = el.getAttribute("data-stat");
      if (values[key] !== undefined && values[key] !== null) el.textContent = values[key];
      else el.textContent = "—";
    });
  });
})();
