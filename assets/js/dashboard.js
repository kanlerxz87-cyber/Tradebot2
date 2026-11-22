/* Tradebot2 dashboard: live quotes, dual alert chats, chart, liquidity,
   resolutions and automatic paper trading. */
(function () {
  "use strict";
  const TB = window.TB;
  const UI = window.TBUI;

  const state = {
    snapshot: null,
    probe: null,
    backtest: null,
    feed: null,
    selected: null,
    window: "15m",
    tableTopic: "all",
    search: "",
    sort: "notional",
    paper: TB.paper.loadState(),
    counts: { all: 0, model: 0, history: 0 },
    audio: false,
    audioCtx: null,
    autoSeen: new Map(),
    chartCache: {},
    chartTimer: null,
    lastChart: 0,
    lastLive: 0,
    online: false
  };

  const WINDOWS = {
    "30s": { seconds: 30, label: "30 seconds", tickOnly: true },
    "5m": { seconds: 300, label: "5 minutes" },
    "15m": { seconds: 900, label: "15 minutes" },
    "1h": { seconds: 3600, label: "1 hour" },
    "6h": { seconds: 21600, label: "6 hours" },
    "24h": { seconds: 86400, label: "24 hours" }
  };

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const data = await UI.loadAll(["snapshot.json", "probe.json", "backtest.json"]);
    state.snapshot = data["snapshot.json"];
    state.probe = data["probe.json"];
    state.backtest = data["backtest.json"];

    if (!state.snapshot) {
      $("#dashboard-root").innerHTML = '<div class="note danger"><strong>Snapshot unavailable.</strong> data/snapshot.json could not be loaded, so no verified market data is displayed. Run the data workflow to rebuild it.</div>';
      return;
    }
    UI.applySnapshotChrome(state.snapshot);
    UI.renderTickerBar(state.snapshot);
    $("#cors-note").textContent = UI.probeLine(state.probe);
    $("#threshold-note").textContent = "Alert threshold ≥ " + TB.money(state.snapshot.threshold || 0.1) + " · basis: YES mid, or last price if no two-sided quote";
    $("#snapshot-note").textContent = UI.dataNote(state.snapshot);

    buildMarketSelect();
    renderTable();
    renderResolutions();
    setupControls();
    setupPaper();
    renderKpis();

    const markets = state.snapshot.markets || [];
    const feed = new TBLive.LiveFeed({
      markets: markets,
      seed: state.snapshot.alerts_seed || [],
      onQuotes: onQuotes,
      onAlert: onAlert,
      onOpportunity: onOpportunity,
      onStatus: onStatus
    });
    state.feed = feed;

    const first = markets.slice().sort((a, b) => (b.volume.notional_24h_est || 0) - (a.volume.notional_24h_est || 0))[0];
    selectMarket(first ? first.ticker : null);

    feed.seedAlerts();
    updateChatCounts();
    feed.start();

    setInterval(tickClock, 1000);
    setInterval(updatePaper, 15000);
    setInterval(() => { if (state.selected) loadOrderbook(state.selected); }, 15000);
    window.addEventListener("resize", debounce(() => renderChart(true), 200));
  }

  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function setupControls() {
    $all(".js-window").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.window = btn.getAttribute("data-window");
        $all(".js-window").forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        renderChart(true);
      });
    });
    $all(".js-topic-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.tableTopic = btn.getAttribute("data-topic");
        $all(".js-topic-tab").forEach((b) => b.classList.toggle("active", b === btn));
        renderTable();
      });
    });
    const search = $("#market-search");
    if (search) search.addEventListener("input", () => { state.search = search.value.trim().toLowerCase(); renderTable(); });
    const sort = $("#market-sort");
    if (sort) sort.addEventListener("change", () => { state.sort = sort.value; renderTable(); });
    const select = $("#market-select");
    if (select) select.addEventListener("change", () => selectMarket(select.value));

    const pause = $("#pause-btn");
    if (pause) pause.addEventListener("click", () => {
      const paused = !state.feed || state.feed.paused;
      if (state.feed) state.feed.setPaused(!paused);
      pause.textContent = paused ? "Pause live" : "Resume live";
      pause.classList.toggle("active", !paused);
      UI.setStatus(paused ? "live" : "degraded", paused ? "LIVE" : "PAUSED");
    });

    const sound = $("#sound-btn");
    if (sound) sound.addEventListener("click", () => {
      state.audio = !state.audio;
      sound.setAttribute("aria-pressed", state.audio ? "true" : "false");
      sound.textContent = state.audio ? "🔔 Alerts on" : "🔕 Alerts off";
      if (state.audio) beep(0.03, 660);
    });

    const reset = $("#reset-paper");
    if (reset) reset.addEventListener("click", () => {
      if (!confirm("Reset the simulated portfolio? This clears every paper position and trade in this browser.")) return;
      state.paper = TB.paper.blankState();
      TB.paper.saveState(state.paper);
      updatePaper(true);
      UI.toast("Simulated portfolio reset to $" + TB.CONFIG.paperCash.toLocaleString() + " per strategy.", "ok");
    });

    const retry = $("#retry-live");
    if (retry) retry.addEventListener("click", () => {
      if (state.feed) { state.feed.errorCount = 0; state.feed.poll(); UI.toast("Retrying the live Kalshi API…", "info"); }
    });
  }

  /* ---------------- market selection & chart ---------------- */
  function buildMarketSelect() {
    const select = $("#market-select");
    if (!select) return;
    const groups = {};
    (state.snapshot.markets || []).forEach((m) => { (groups[m.topic] = groups[m.topic] || []).push(m); });
    select.innerHTML = Object.keys(TB.TOPICS).map((topic) => {
      const rows = (groups[topic] || []).slice().sort((a, b) => (b.volume.notional_24h_est || 0) - (a.volume.notional_24h_est || 0));
      if (!rows.length) return "";
      return '<optgroup label="' + TB.esc(TB.TOPICS[topic].label) + '">' + rows.map((m) =>
        '<option value="' + TB.esc(m.ticker) + '">' + TB.esc(m.title) + " — " + TB.cents(m.prices && m.prices.mid) + "</option>"
      ).join("") + "</optgroup>";
    }).join("");
  }

  function selectMarket(ticker) {
    if (!ticker) return;
    const market = (state.snapshot.markets || []).find((m) => m.ticker === ticker);
    if (!market) return;
    state.selected = market;
    const select = $("#market-select");
    if (select) select.value = ticker;
    $("#chart-title").innerHTML = TB.esc(market.title) + ' <span class="badge neutral">' + TB.esc((TB.TOPICS[market.topic] || {}).label || market.topic) + "</span>";
    $("#chart-sub").innerHTML = '<span class="mono">' + TB.esc(market.ticker) + "</span> · closes " + TB.isoDate(market.close_time) + ' · <a href="' + TB.esc(market.links.kalshi) + '" target="_blank" rel="noopener">Kalshi ↗</a> · <a href="' + TB.esc(market.links.market_api) + '" target="_blank" rel="noopener">API source ↗</a>';
    $all("#market-table tr[data-ticker]").forEach((row) => {
      row.style.background = row.getAttribute("data-ticker") === ticker ? "rgba(47,227,176,0.06)" : "";
    });
    updateQuoteMeta(market, state.feed && state.feed.quotes[market.ticker]);
    loadOrderbook(market);
    ensureCandles(market).then(() => renderChart(true));
    renderChart(true);
  }

  async function ensureCandles(market) {
    if (state.chartCache[market.ticker]) return;
    state.chartCache[market.ticker] = { oneMin: [], hour: [], loading: true };
    const cache = state.chartCache[market.ticker];
    try {
      const [oneMin, hour] = await Promise.all([
        state.feed.fetchCandles(market, 24, 1).catch(() => null),
        state.feed.fetchCandles(market, 24 * 7, 60).catch(() => null)
      ]);
      cache.oneMin = oneMin ? TBLive.candlePoints(oneMin) : [];
      cache.hour = hour ? TBLive.candlePoints(hour) : [];
    } catch (e) { /* fall back to snapshot */ }
    cache.loading = false;
    if (state.selected && state.selected.ticker === market.ticker) renderChart(true);
  }

  function chartPoints(market, windowKey) {
    const cfg = WINDOWS[windowKey];
    const now = Date.now() / 1000;
    const start = now - cfg.seconds;
    const points = new Map();
    const snapshotCandles = (market.candles || {});
    const cache = state.chartCache[market.ticker] || {};

    function addCandles(rows) {
      (rows || []).forEach((row) => {
        const ts = Number(row[0]); const price = TB.num(row[1]);
        if (price === null || !Number.isFinite(ts)) return;
        if (ts >= start - 120 && ts <= now + 5) points.set(Math.round(ts), { ts: Math.round(ts), price: price });
      });
    }
    if (!cfg.tickOnly) {
      addCandles((cache.oneMin || []).map((p) => [p.ts, p.price]));
      addCandles(snapshotCandles["1m"]);
      if (cfg.seconds > 6 * 3600) {
        addCandles((cache.hour || []).map((p) => [p.ts, p.price]));
        addCandles(snapshotCandles["60m"]);
      }
    }
    const ticks = (state.feed ? state.feed.getTicks(market.ticker) : []).filter((t) => t.ts >= start);
    ticks.forEach((t) => points.set(Math.round(t.ts * 10) / 10, { ts: t.ts, price: t.price }));
    let list = Array.from(points.values()).sort((a, b) => a.ts - b.ts);
    if (cfg.tickOnly && !list.length) return [];
    // Keep the chart readable: at most ~700 points.
    if (list.length > 700) {
      const step = Math.ceil(list.length / 700);
      list = list.filter((_, i) => i % step === 0 || i === list.length - 1);
    }
    return list;
  }

  function renderChart(force) {
    if (!state.selected) return;
    const now = Date.now();
    if (!force && now - state.lastChart < 1500) return;
    state.lastChart = now;
    const market = state.selected;
    const cfg = WINDOWS[state.window];
    const points = chartPoints(market, state.window);
    const svg = $("#price-chart");
    const tip = $("#chart-tip");
    const quote = (state.feed && state.feed.quotes[market.ticker]) || null;
    const mid = quote && quote.mid !== null ? quote.mid : (market.prices || {}).mid;
    const bid = quote && quote.bid !== null ? quote.bid : (market.prices || {}).yes_bid;
    const ask = quote && quote.ask !== null ? quote.ask : (market.prices || {}).yes_ask;
    $("#chart-empty").classList.add("hidden");
    if (!points.length) {
      svg.innerHTML = "";
      $("#chart-empty").classList.remove("hidden");
      $("#chart-empty").textContent = cfg.tickOnly
        ? "Collecting live ticks: this window starts empty and gains one point per poll (" + (TB.CONFIG.pollMs / 1000) + "s)."
        : "No candle history is available for this market yet. The table below still shows the latest quote.";
    } else {
      const end = cfg.tickOnly ? now / 1000 : Math.max(now / 1000, points[points.length - 1].ts);
      const markers = (state.feed ? state.feed.alerts : []).concat(state.snapshot.alerts_seed || [])
        .filter((a) => a.ticker === market.ticker);
      const label = cfg.seconds <= 900
        ? (t) => new Date(t * 1000).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: cfg.seconds <= 300 ? "2-digit" : undefined })
        : (t) => new Date(t * 1000).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit" });
      TB.drawChart(svg, points, {
        start: points[0].ts,
        end: end,
        bid: bid,
        ask: ask,
        markers: markers,
        labelFor: label
      });
      TB.attachCrosshair(svg, tip, (p) => "<strong>" + TB.clock(p.ts) + "</strong> · " + TB.money(p.price) + " (" + TB.cents(p.price) + ")");
    }
    $("#chart-price").textContent = TB.money(mid);
    $("#chart-bid").textContent = TB.money(bid);
    $("#chart-ask").textContent = TB.money(ask);
    $("#chart-spread").textContent = (bid !== null && ask !== null && bid !== undefined && ask !== undefined) ? TB.money(ask - bid) : "—";
    $("#chart-window-label").textContent = cfg.label;
    $("#chart-source").textContent = cfg.tickOnly ? "live ticks" : "1-min candles + live ticks";
  }

  function updateQuoteMeta(market, quote) {
    const price = quote && quote.mid !== null ? quote.mid : (market.prices || {}).mid;
    const bid = quote && quote.bid !== null ? quote.bid : (market.prices || {}).yes_bid;
    const ask = quote && quote.ask !== null ? quote.ask : (market.prices || {}).yes_ask;
    $("#chart-price").textContent = TB.money(price);
    $("#chart-bid").textContent = TB.money(bid);
    $("#chart-ask").textContent = TB.money(ask);
    $("#chart-spread").textContent = (bid !== null && ask !== null && bid !== undefined && ask !== undefined) ? TB.money(ask - bid) : "—";
    if (quote) $("#chart-updated").textContent = "quote " + TB.relative(quote.ts);
  }

  /* ---------------- liquidity ---------------- */
  async function loadOrderbook(market) {
    let book = null;
    try { book = await state.feed.refreshOrderbook(market.ticker); } catch (e) { book = null; }
    renderLiquidity(market, book);
  }

  function renderLiquidity(market, book) {
    const live = book ? TB.bookMetrics(book) : null;
    const snap = market.liquidity || {};
    const bid = live && live.bestYesBid !== null ? live.bestYesBid : snap.best_yes_bid;
    const ask = live && live.bestYesAsk !== null ? live.bestYesAsk : snap.best_yes_ask;
    const spread = bid !== null && ask !== null && bid !== undefined && ask !== undefined ? ask - bid : (snap.spread !== undefined ? snap.spread : null);
    const yesDepth = live && live.yesDepth !== null ? live.yesDepth : snap.yes_depth_at_best;
    const noDepth = live && live.noDepth !== null ? live.noDepth : snap.no_depth_at_best;
    const cells = [
      ["Best YES bid", TB.money(bid)],
      ["Best YES ask", TB.money(ask)],
      ["Spread", spread === null || spread === undefined ? "—" : TB.money(spread)],
      ["Contracts at touch", (yesDepth !== null && yesDepth !== undefined ? TB.compact(yesDepth) + " YES" : "—") + (noDepth !== null && noDepth !== undefined ? " · " + TB.compact(noDepth) + " NO" : "")]
    ];
    $("#liq-strip").innerHTML = cells.map(([k, v]) => '<div class="liq-cell"><div class="k">' + TB.esc(k) + '</div><div class="v">' + TB.esc(v) + "</div></div>").join("");

    const yes = (live && live.yes && live.yes.length ? live.yes : (snap.yes_levels || []).map((x) => ({ price: x.price, contracts: x.contracts }))).slice(-6).reverse();
    const no = (live && live.no && live.no.length ? live.no : (snap.no_levels || []).map((x) => ({ price: x.price, contracts: x.contracts }))).slice(-6).reverse();
    const max = Math.max(1, ...yes.map((x) => x.contracts), ...no.map((x) => x.contracts));
    const ladder = (rows, cls) => rows.length ? '<table class="ladder"><tbody>' + rows.map((row) =>
      '<tr><td class="num">' + TB.cents(row.price) + '</td><td class="depth-bar ' + cls + '"><span style="width:' + Math.min(100, (row.contracts / max) * 100) + '%"></span></td><td class="num">' + TB.compact(row.contracts) + "</td></tr>"
    ).join("") + "</tbody></table>" : '<div class="muted small">No levels returned.</div>';
    $("#book").innerHTML =
      '<div class="book-side"><h4>YES bids · ' + (live && live.yes.length ? "live orderbook" : "snapshot") + '</h4>' + ladder(yes, "") + "</div>" +
      '<div class="book-side"><h4>NO bids · ' + (live && live.no.length ? "live orderbook" : "snapshot") + '</h4>' + ladder(no, "no") + "</div>";
  }

  /* ---------------- tables ---------------- */
  function move24h(market) {
    const rows = (market.candles || {})["1m"] || [];
    let first = null; let last = null;
    rows.forEach((row) => {
      if (row[1] === null || row[1] === undefined) return;
      if (first === null) first = row[1];
      last = row[1];
    });
    if (first === null || last === null) return null;
    return last - first;
  }

  function renderTable() {
    const body = $("#market-table tbody");
    if (!body) return;
    const search = state.search;
    let rows = (state.snapshot.markets || []).filter((m) => {
      if (state.tableTopic !== "all" && m.topic !== state.tableTopic) return false;
      if (!search) return true;
      return (m.title + " " + m.ticker + " " + (m.event_title || "")).toLowerCase().indexOf(search) >= 0;
    });
    const sorters = {
      notional: (m) => m.volume.notional_24h_est || 0,
      volume: (m) => m.volume.last_24h_contracts || 0,
      oi: (m) => m.volume.open_interest_contracts || 0,
      close: (m) => new Date(m.close_time || 0).getTime(),
      move: (m) => Math.abs(move24h(m) || 0)
    };
    rows.sort((a, b) => sorters[state.sort](b) - sorters[state.sort](a));
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="10"><div class="empty">No tracked markets match this filter. The data workflow selects the top markets per topic by 24h volume and open interest.</div></td></tr>';
      return;
    }
    body.innerHTML = rows.map((m) => {
      const price = m.prices || {};
      const move = move24h(m);
      const liq = m.liquidity || {};
      const spread = liq.spread;
      return '<tr data-ticker="' + TB.esc(m.ticker) + '" style="cursor:pointer">' +
        '<td><a class="market-name" href="' + TB.esc(m.links.kalshi) + '" target="_blank" rel="noopener">' + TB.esc(m.title) + "</a>" +
        '<span class="sub mono">' + TB.esc(m.ticker) + (m.is_provisional ? " · provisional" : "") + "</span></td>" +
        '<td><span class="badge neutral topic-tag">' + TB.esc((TB.TOPICS[m.topic] || {}).label || m.topic) + "</span></td>" +
        '<td class="num js-price">' + TB.money(TB.snapshotPrice(m).price) + '<span class="sub">' + TB.esc(TB.snapshotPrice(m).basis) + "</span></td>" +
        '<td class="num js-bid muted">' + (price.yes_bid > 0 ? TB.money(price.yes_bid) : "—") + " / " + (price.yes_ask > 0 && price.yes_ask < 1 ? TB.money(price.yes_ask) : "—") + "</td>" +
        '<td class="num js-move ' + (move > 0 ? "up" : move < 0 ? "down" : "") + '">' + (move === null ? "—" : (move > 0 ? "+" : "") + TB.cents(move)) + "</td>" +
        '<td class="num">' + TB.compact(m.volume.last_24h_contracts) + '<span class="sub">contracts</span></td>' +
        '<td class="num">' + TB.compact(m.volume.open_interest_contracts) + "</td>" +
        '<td class="num" title="Computed estimate: 24h contracts × mid price. Not an official dollar-volume field.">' + (m.volume.notional_24h_est !== null ? TB.money(m.volume.notional_24h_est, 0) : "—") + "</td>" +
        '<td class="num js-spread">' + (spread === null || spread === undefined || spread <= 0 ? "—" : TB.money(spread)) + '<span class="sub">' + (liq.yes_depth_at_best !== undefined && liq.yes_depth_at_best !== null ? TB.compact(liq.yes_depth_at_best) + " at touch" : "depth n/a") + "</span></td>" +
        '<td class="small"><span class="source-links"><a href="' + TB.esc(m.links.market_api) + '" target="_blank" rel="noopener">API ↗</a><a href="' + TB.esc(m.links.kalshi) + '" target="_blank" rel="noopener">Kalshi ↗</a></span></td>' +
        "</tr>";
    }).join("");
    body.querySelectorAll("tr[data-ticker]").forEach((row) => {
      row.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        selectMarket(row.getAttribute("data-ticker"));
      });
    });
  }

  function renderResolutions() {
    const body = $("#resolutions-table tbody");
    if (!body) return;
    const rows = (state.snapshot.resolutions || []).slice(0, 40);
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty">No settled markets in the last 30 days were returned for these topics.</div></td></tr>';
      return;
    }
    body.innerHTML = rows.map((r) => {
      const result = r.result === "yes" ? '<span class="badge green">YES</span>' : '<span class="badge down">NO</span>';
      return "<tr><td><span class=\"market-name\">" + TB.esc(r.title) + "</span><span class=\"sub mono\">" + TB.esc(r.ticker) + "</span></td>" +
        "<td>" + result + "</td>" +
        '<td><span class="badge neutral topic-tag">' + TB.esc((TB.TOPICS[r.topic] || {}).label || r.topic) + "</span></td>" +
        '<td class="small">' + TB.isoDate(r.close_time) + "</td>" +
        '<td class="small mono">' + TB.esc(r.expiration_value || "—") + "</td>" +
        '<td class="small"><span class="source-links"><a href="' + TB.esc(r.links.market_api) + '" target="_blank" rel="noopener">API ↗</a><a href="' + TB.esc(r.links.kalshi) + '" target="_blank" rel="noopener">Kalshi ↗</a></span></td></tr>';
    }).join("");
  }

  /* ---------------- KPIs & paper ---------------- */
  function renderKpis() {
    const stats = state.snapshot.stats || {};
    $("#kpi-markets").textContent = stats.tracked_markets || 0;
    $("#kpi-markets-foot").textContent = (stats.open_markets_in_scope || 0) + " in-scope open · " + (stats.open_markets_total || 0) + " demo total";
    $("#kpi-alerts").textContent = state.counts.all;
    $("#kpi-model").textContent = state.counts.model;
    $("#kpi-resolutions").textContent = state.snapshot.resolutions ? state.snapshot.resolutions.length : 0;
    updatePaper(true);
  }

  function setupPaper() {
    const resolutions = {};
    (state.snapshot.resolutions || []).forEach((r) => { resolutions[r.ticker] = r.result; });
    const settled = TB.paper.settleTrades(state.paper, resolutions);
    if (settled.length) UI.toast(settled.length + " simulated position(s) settled against real resolved markets.", "ok");
    updatePaper(true);
  }

  function updatePaper(force) {
    if (state.feed) {
      const quotes = {};
      Object.keys(state.feed.quotes).forEach((t) => { quotes[t] = { mid: state.feed.quotes[t].mid }; });
      TB.paper.markTrades(state.paper, quotes);
    }
    const analytics = TB.paper.analytics(state.paper);
    let equity = 0;
    Object.keys(state.paper.accounts).forEach((s) => {
      const acct = state.paper.accounts[s];
      let value = acct.cash;
      acct.positions.forEach((p) => {
        const quote = state.feed && state.feed.quotes[p.ticker];
        const mark = quote && quote.mid !== null ? (p.side === "yes" ? quote.mid : 1 - quote.mid) : p.entry_price;
        value += p.contracts * mark;
      });
      equity += value;
    });
    const start = TB.CONFIG.paperCash * Object.keys(state.paper.accounts).length;
    const pnl = equity - start;
    $("#kpi-paper").textContent = TB.money(equity, 0);
    $("#kpi-paper-foot").textContent = (pnl >= 0 ? "+" : "") + TB.money(pnl, 0) + " vs " + TB.money(start, 0) + " start · " + analytics.open_trades + " open";
    $("#kpi-paper-foot").className = "foot " + (pnl >= 0 ? "up" : "down");
    const badge = $("#paper-mode");
    if (badge) badge.textContent = "SIMULATED · " + analytics.closed_trades + " closed / " + analytics.open_trades + " open";
    if (force) $("#paper-last") && ($("#paper-last").textContent = new Date().toLocaleTimeString());
  }

  /* ---------------- live callbacks ---------------- */
  function onStatus(status) {
    state.online = status.status === "live";
    if (status.status === "live") {
      UI.setStatus("live", "LIVE · " + (TB.CONFIG.pollMs / 1000) + "s poll");
      $("#feed-note").classList.add("hidden");
      $("#live-last").textContent = new Date().toLocaleTimeString();
    } else if (status.status === "connecting") {
      UI.setStatus("connecting", "CONNECTING", "Waiting for the first successful demo API poll.");
    } else if (status.status === "degraded") {
      UI.setStatus("degraded", "RETRYING · snapshot shown");
      showFeedNote("Live API request failed. Retrying with backoff; values below may be from the last successful poll or the verified snapshot. " + (status.error ? "(" + status.error + ")" : ""));
    } else if (status.status === "offline") {
      UI.setStatus("offline", "OFFLINE · verified snapshot");
      showFeedNote("The Kalshi demo API could not be reached from this browser (network, CORS or exchange availability). Showing the verified snapshot from " + TB.isoDate(state.snapshot.generated_at) + " — these prices are not current. " + (status.error ? "Error: " + status.error : ""));
    }
  }

  function showFeedNote(message) {
    const note = $("#feed-note");
    note.classList.remove("hidden");
    note.querySelector(".js-feed-error").textContent = message;
  }

  function onQuotes(updates) {
    const tickers = Object.keys(updates);
    tickers.forEach((ticker) => {
      const quote = updates[ticker];
      const market = (state.snapshot.markets || []).find((m) => m.ticker === ticker);
      if (!market) return;
      const priceCell = document.querySelector('#market-table tr[data-ticker="' + cssEscape(ticker) + '"] .js-price');
      if (priceCell) priceCell.innerHTML = TB.money(quote.mid) + '<span class="sub">' + TB.esc(quote.basis || "") + "</span>";
      const bidCell = document.querySelector('#market-table tr[data-ticker="' + cssEscape(ticker) + '"] .js-bid');
      if (bidCell) {
        bidCell.textContent = (quote.bid > 0 ? TB.money(quote.bid) : "—") + " / " +
          (quote.ask > 0 && quote.ask < 1 ? TB.money(quote.ask) : "—");
      }
      const spreadCell = document.querySelector('#market-table tr[data-ticker="' + cssEscape(ticker) + '"] .js-spread');
      if (spreadCell) {
        const spread = quote.bid !== null && quote.ask !== null ? quote.ask - quote.bid : null;
        spreadCell.innerHTML = (spread === null || spread <= 0 ? "—" : TB.money(spread)) +
          '<span class="sub">' + (market.liquidity && market.liquidity.yes_depth_at_best ? TB.compact(market.liquidity.yes_depth_at_best) + " at touch" : "depth n/a") + "</span>";
      }
      if (state.selected && state.selected.ticker === ticker) {
        updateQuoteMeta(market, quote);
        if (WINDOWS[state.window].seconds <= 900) renderChart(false);
      }
    });
    $("#live-last").textContent = new Date().toLocaleTimeString();
    updatePaper(false);
  }

  function cssEscape(value) { return String(value).replace(/"/g, '\\"'); }

  function onAlert(alert, history) {
    addChatMessage("#chat-all", alert, false, history);
    state.counts.all += 1;
    if (history) state.counts.history += 1;
    else {
      if (state.audio) beep(alert.direction === "up" ? 0.045 : 0.03, alert.direction === "up" ? 860 : 420);
      flashRow(alert.ticker, alert.direction);
    }
    const market = marketFor(alert.ticker);
    if (market) {
      const enriched = Object.assign({}, market, { __book: market.__book });
      const opp = TB.bestOpportunity(enriched, alert);
      if (opp && opp.score >= TB.CONFIG.modelScoreFloor && opp.estRoi >= TB.CONFIG.modelRoiFloor) {
        opp.links = market.links;
        addChatMessage("#chat-model", opp, true, false);
        state.counts.model += 1;
        if (!history) autoPaper(opp);
      }
    }
    updateChatCounts();
    $("#kpi-alerts").textContent = state.counts.all;
    $("#kpi-model").textContent = state.counts.model;
  }

  function onOpportunity(opp) {
    // Model picks are deliberately selective: a hard score floor, plus a
    // global throttle so a broad scan cannot flood the second chat.
    if (opp.score < 65) return;
    const now = Date.now();
    if (now - (state.lastModelPick || 0) < 30000) return;
    state.lastModelPick = now;
    const market = marketFor(opp.ticker);
    if (market) opp.links = market.links;
    addChatMessage("#chat-model", opp, true, false);
    state.counts.model += 1;
    $("#kpi-model").textContent = state.counts.model;
    updateChatCounts();
    autoPaper(opp);
  }

  function autoPaper(opp) {
    const key = opp.ticker + "|" + opp.strategy;
    const last = state.autoSeen.get(key) || 0;
    if (Date.now() - last < 600000) return;
    state.autoSeen.set(key, Date.now());
    const quotes = {};
    if (state.feed) Object.keys(state.feed.quotes).forEach((t) => { quotes[t] = { mid: state.feed.quotes[t].mid }; });
    const pos = TB.paper.openTrade(state.paper, opp, quotes);
    if (pos) {
      updatePaper(true);
      UI.toast("Paper trade opened: " + (opp.side === "yes" ? "YES" : "NO") + " " + pos.contracts + " × " + TB.money(opp.entry) + " (" + opp.strategyLabel + ")", "ok");
    }
  }

  function marketFor(ticker) {
    return (state.snapshot.markets || []).find((m) => m.ticker === ticker) || null;
  }

  function flashRow(ticker, direction) {
    const row = document.querySelector('#market-table tr[data-ticker="' + cssEscape(ticker) + '"] .js-price');
    if (!row) return;
    row.classList.remove("flash-up", "flash-down");
    void row.offsetWidth;
    row.classList.add(direction === "up" ? "flash-up" : "flash-down");
  }

  function addChatMessage(selector, payload, isModel, history) {
    const scroll = document.querySelector(selector);
    if (!scroll) return;
    const atBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100;
    const msg = document.createElement("div");
    const dir = isModel ? "up" : payload.direction;
    msg.className = "msg " + (isModel ? "model" : dir) + (history ? " history" : "");
    if (isModel) {
      const opp = payload;
      msg.innerHTML =
        '<div class="meta"><span class="time">' + TB.clock(opp.ts) + '</span><span class="badge blue">SCORE ' + Math.round(opp.score) + "</span>" +
        '<span class="badge neutral">' + TB.esc(opp.strategyLabel) + "</span><span>" + TB.esc((TB.TOPICS[opp.topic] || {}).label || opp.topic) + "</span></div>" +
        '<div class="headline">' + TB.esc(opp.title) + "</div>" +
        '<div class="numbers"><span>' + (opp.side === "yes" ? "BUY YES" : "BUY NO") + " @" + TB.money(opp.entry) + "</span>" +
        "<span>model " + TB.pct(opp.modelProb, 0) + "</span><span>edge " + TB.money(opp.edge) + "</span>" +
        '<span class="delta ' + (opp.estRoi >= 0 ? "up" : "down") + '">est. ROI ' + TB.pct(opp.estRoi) + "</span></div>" +
        '<ul class="why">' + (opp.reasons || []).slice(0, 3).map((r) => "<li>" + TB.esc(r) + "</li>").join("") + "</ul>" +
        UI.linkChips(opp.links, { api: true, news: true, maxSources: 1 });
    } else {
      const links = payload.links || (marketFor(payload.ticker) || {}).links;
      msg.innerHTML =
        '<div class="meta"><span class="time">' + TB.clock(payload.ts) + '</span><span class="badge ' + (payload.direction === "up" ? "up" : "down") + '">' +
        (payload.delta > 0 ? "+" : "") + TB.money(payload.delta) + "</span><span>" + TB.esc((TB.TOPICS[payload.topic] || {}).label || payload.topic) + "</span>" +
        (history ? '<span class="badge neutral">history · 1m candles</span>' : '<span class="badge green">live</span>') + "</div>" +
        '<div class="headline">' + TB.esc(payload.title) + "</div>" +
        '<div class="numbers"><span>' + TB.money(payload.before) + " → " + TB.money(payload.after) + "</span>" +
        '<span class="delta ' + (payload.direction === "up" ? "up" : "down") + '">' + (payload.delta > 0 ? "+" : "") + TB.money(payload.delta) + "</span>" +
        (payload.volume_24h !== null && payload.volume_24h !== undefined ? "<span>24h " + TB.compact(payload.volume_24h) + " contracts</span>" : "") +
        (payload.open_interest !== null && payload.open_interest !== undefined ? "<span>OI " + TB.compact(payload.open_interest) + "</span>" : "") +
        "<span>basis " + TB.esc(payload.basis || "mid") + "</span></div>" +
        UI.linkChips(links, { api: true, news: true, maxSources: 1 });
    }
    scroll.appendChild(msg);
    while (scroll.children.length > 140) scroll.removeChild(scroll.firstChild);
    if (atBottom || history) scroll.scrollTop = scroll.scrollHeight;
    else {
      const card = scroll.closest(".chat-card");
      let btn = card && card.querySelector(".chat-new");
      if (card && !btn) {
        btn = document.createElement("button");
        btn.className = "chat-new";
        btn.textContent = "↓ new alerts";
        btn.addEventListener("click", () => { scroll.scrollTop = scroll.scrollHeight; btn.remove(); });
        card.appendChild(btn);
      }
    }
  }

  function updateChatCounts() {
    const all = document.querySelectorAll("#chat-all .msg").length;
    const model = document.querySelectorAll("#chat-model .msg").length;
    $("#chat-all-count").textContent = state.counts.all + " alerts";
    $("#chat-model-count").textContent = state.counts.model + " model picks";
    $("#chat-all-foot").textContent = state.counts.history + " seeded from 1-min candles · " + (state.counts.all - state.counts.history) + " live";
    $("#chat-model-foot").textContent = "Score ≥ " + TB.CONFIG.modelScoreFloor + " · est. ROI ≥ " + (TB.CONFIG.modelRoiFloor * 100) + "% · heuristic";
  }

  function tickClock() {
    const el = $("#utc-clock");
    if (el) el.textContent = new Date().toISOString().slice(11, 19) + " UTC";
  }

  function beep(duration, frequency) {
    try {
      state.audioCtx = state.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = state.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.type = "sine";
      gain.gain.value = 0.05;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch (e) { /* audio is optional */ }
  }
})();
