/* Portfolio page: live paper portfolio, strategy attribution and CI backtest. */
(function () {
  "use strict";
  const TB = window.TB;
  const UI = window.TBUI;

  const state = { snapshot: null, backtest: null, paper: null, marks: {}, feed: null };

  document.addEventListener("DOMContentLoaded", async () => {
    const data = await UI.loadAll(["snapshot.json", "backtest.json", "probe.json"]);
    state.snapshot = data["snapshot.json"];
    state.backtest = data["backtest.json"];
    if (state.snapshot) UI.applySnapshotChrome(state.snapshot);
    state.paper = TB.paper.loadState();
    seedMarks();
    renderPaper();
    renderBacktest();
    renderPlaybook();
    checkBackend();
    setInterval(renderPaper, 8000);
    window.addEventListener("storage", (event) => {
      if (event.key === TB.paper.key) { state.paper = TB.paper.loadState(); renderPaper(); }
    });
    document.querySelector("#export-trades").addEventListener("click", exportCsv);
  });

  function seedMarks() {
    if (!state.snapshot) return;
    const resolutions = {};
    (state.snapshot.resolutions || []).forEach((r) => { resolutions[r.ticker] = r.result; });
    TB.paper.settleTrades(state.paper, resolutions);
    (state.snapshot.markets || []).forEach((m) => {
      if (m.prices && m.prices.mid !== null) state.marks[m.ticker] = { mid: m.prices.mid, bid: m.prices.yes_bid, ask: m.prices.yes_ask };
    });
    const openTickers = [];
    Object.keys(state.paper.accounts).forEach((s) => state.paper.accounts[s].positions.forEach((p) => openTickers.push(p.ticker)));
    if (!openTickers.length) return;
    const markets = (state.snapshot.markets || []).filter((m) => openTickers.indexOf(m.ticker) >= 0);
    if (!markets.length) return;
    state.feed = new TBLive.LiveFeed({
      markets: markets,
      onQuotes: (updates) => {
        Object.keys(updates).forEach((t) => { state.marks[t] = { mid: updates[t].mid, bid: updates[t].bid, ask: updates[t].ask }; });
        renderPaper();
        document.querySelector("#pf-updated").textContent = "live · " + new Date().toLocaleTimeString();
      },
      onStatus: (status) => {
        const el = document.querySelector("#pf-updated");
        if (el && status.status !== "live") el.textContent = status.status === "offline" ? "snapshot marks" : "connecting…";
      }
    });
    state.feed.start();
  }

  function markFor(pos) {
    const mark = state.marks[pos.ticker];
    if (!mark || mark.mid === null || mark.mid === undefined) return pos.entry_price;
    return pos.side === "yes" ? mark.mid : 1 - mark.mid;
  }

  function renderPaper() {
    const paper = state.paper;
    let equity = 0;
    let openPnl = 0;
    let totalFees = 0;
    const openRows = [];
    Object.keys(paper.accounts).forEach((name) => {
      const acct = paper.accounts[name];
      let sleeve = acct.cash;
      acct.positions.forEach((pos) => {
        const mark = markFor(pos);
        sleeve += pos.contracts * mark;
        const cost = pos.contracts * pos.entry_price + pos.entry_fee;
        openPnl += pos.contracts * mark - cost;
        totalFees += pos.entry_fee;
        openRows.push(Object.assign({}, pos, { mark: mark, open: true }));
      });
      acct.history.forEach((pos) => { totalFees += (pos.entry_fee || 0) + (pos.exit_fee || 0); });
      equity += sleeve;
    });
    const analytics = TB.paper.analytics(paper);
    const starting = TB.CONFIG.paperCash * Object.keys(paper.accounts).length;
    const realized = analytics.total_pnl;
    const totalPnl = realized + openPnl;
    document.querySelector("#pf-equity").textContent = TB.money(equity, 0);
    document.querySelector("#pf-start").textContent = TB.money(starting, 0) + " starting · " + analytics.open_trades + " open";
    document.querySelector("#pf-start-total").textContent = TB.money(starting, 0);
    const pnlEl = document.querySelector("#pf-pnl");
    pnlEl.textContent = (totalPnl >= 0 ? "+" : "") + TB.money(totalPnl, 2);
    pnlEl.className = "value " + (totalPnl >= 0 ? "accent" : "down");
    document.querySelector("#pf-winrate").textContent = analytics.closed_trades ? TB.pct(analytics.win_rate) : "—";
    document.querySelector("#pf-trades").textContent = analytics.closed_trades + " closed · " + analytics.open_trades + " open";
    document.querySelector("#pf-expectancy").textContent = analytics.closed_trades ? (analytics.expectancy >= 0 ? "+" : "") + TB.money(analytics.expectancy, 2) : "—";
    document.querySelector("#pf-dd").textContent = analytics.closed_trades ? analytics.max_drawdown_pct.toFixed(1) + "%" : "—";
    document.querySelector("#pf-log-count").textContent = (analytics.closed_trades + openRows.length) + " trades";

    const body = document.querySelector("#pf-accounts tbody");
    body.innerHTML = Object.keys(paper.accounts).map((name) => {
      const acct = paper.accounts[name];
      let sleeve = acct.cash;
      acct.positions.forEach((pos) => { sleeve += pos.contracts * markFor(pos); });
      const ret = (sleeve / acct.starting_cash - 1) * 100;
      return "<tr><td><strong>" + TB.esc(TB.STRATEGIES[name] ? TB.STRATEGIES[name].label : name) + "</strong><span class='sub'>" + TB.esc(name) + "</span></td>" +
        '<td class="num">' + TB.money(sleeve, 0) + "</td>" +
        '<td class="num ' + (ret >= 0 ? "up" : "down") + '">' + (ret >= 0 ? "+" : "") + ret.toFixed(2) + "%</td>" +
        '<td class="num">' + TB.money(acct.realized_pnl, 2) + "</td>" +
        '<td class="num">' + acct.positions.length + "</td></tr>";
    }).join("");

    fillGroup("#pf-by-strategy", analytics.by_strategy, "strategy");
    fillGroup("#pf-by-topic", analytics.by_topic, "topic");
    fillGroup("#pf-by-price", analytics.by_price, "price");

    const curve = analytics.equity_curve.slice();
    if (openRows.length) curve.push({ ts: Math.floor(Date.now() / 1000), equity: equity });
    drawCurve(document.querySelector("#pf-chart"), curve, "#2fe3b0", { empty: "No closed paper trades yet. The curve fills as model picks are opened and closed." });

    const trades = analytics.trades.concat(openRows).sort((a, b) => (b.closed_ts || b.opened_ts) - (a.closed_ts || a.opened_ts));
    const tbody = document.querySelector("#pf-trades tbody");
    if (!trades.length) {
      tbody.innerHTML = '<tr><td colspan="12"><div class="empty">No paper trades yet. Open the dashboard and leave it running; model picks open trades automatically.</div></td></tr>';
    } else {
      const links = marketLinks();
      tbody.innerHTML = trades.slice(0, 120).map((t) => {
        const when = t.closed_ts || t.opened_ts;
        const pnl = t.open ? (t.contracts * t.mark - t.contracts * t.entry_price - t.entry_fee) : t.pnl;
        const roi = t.open ? (pnl / (t.contracts * t.entry_price + t.entry_fee)) : t.roi;
        const link = links[t.ticker] || {};
        return "<tr><td class='small'>" + TB.isoDate(new Date(when * 1000)) + "</td>" +
          "<td><span class='market-name'>" + TB.esc(t.title) + "</span><span class='sub mono'>" + TB.esc(t.ticker) + "</span></td>" +
          "<td class='small'>" + TB.esc(TB.STRATEGIES[t.strategy] ? TB.STRATEGIES[t.strategy].label : t.strategy) + "</td>" +
          "<td><span class='badge " + (t.side === "yes" ? "green" : "blue") + "'>" + t.side.toUpperCase() + "</span></td>" +
          "<td class='num'>" + t.contracts + "</td>" +
          "<td class='num'>" + TB.money(t.entry_price) + "</td>" +
          "<td class='num'>" + TB.money(t.open ? t.mark : t.exit_price) + "</td>" +
          "<td class='num'>" + TB.money((t.entry_fee || 0) + (t.exit_fee || 0), 4) + "</td>" +
          "<td class='num " + (pnl >= 0 ? "up" : "down") + "'>" + (pnl >= 0 ? "+" : "") + TB.money(pnl, 2) + "</td>" +
          "<td class='num " + (roi >= 0 ? "up" : "down") + "'>" + TB.pct(roi) + "</td>" +
          "<td><span class='badge " + (t.open ? "neutral" : t.status === "settled" ? "green" : "blue") + "'>" + TB.esc(t.open ? "open" : t.status) + "</span><span class='sub'>" + TB.esc(t.close_reason || "") + "</span></td>" +
          "<td class='small'>" + (link.market_api ? "<span class='source-links'><a href='" + TB.esc(link.market_api) + "' target='_blank' rel='noopener'>API ↗</a><a href='" + TB.esc(link.kalshi) + "' target='_blank' rel='noopener'>Kalshi ↗</a></span>" : "—") + "</td></tr>";
      }).join("");
    }
    document.querySelector("#pf-updated").textContent = "updated " + new Date().toLocaleTimeString();
  }

  function fillGroup(selector, rows, kind) {
    const table = document.querySelector(selector);
    if (!table) return;
    const body = table.querySelector("tbody") ? table.querySelector("tbody") : table;
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="4"><div class="empty">No closed trades yet.</div></td></tr>';
      return;
    }
    body.innerHTML = rows.map((row) => {
      const label = kind === "strategy" ? (TB.STRATEGIES[row.key] ? TB.STRATEGIES[row.key].label : row.key) : kind === "topic" ? ((TB.TOPICS[row.key] || {}).label || row.key) : row.key;
      return "<tr><td>" + TB.esc(label) + "</td><td class='num'>" + row.trades + "</td><td class='num'>" + TB.pct(row.win_rate) + "</td>" +
        "<td class='num " + (row.pnl >= 0 ? "up" : "down") + "'>" + (row.pnl >= 0 ? "+" : "") + TB.money(row.pnl, 2) + "</td></tr>";
    }).join("");
  }

  function marketLinks() {
    const map = {};
    (state.snapshot && state.snapshot.markets ? state.snapshot.markets : []).forEach((m) => { map[m.ticker] = m.links || {}; });
    return map;
  }

  /* ---------------- backtest ---------------- */
  function renderBacktest() {
    const bt = state.backtest;
    if (!bt) return;
    const coverage = bt.coverage || {};
    const method = bt.method || {};
    const analytics = (bt.portfolio || {}).analytics || {};
    document.querySelector("#bt-coverage").innerHTML =
      "<tr><td class='muted'>Markets tested</td><td class='num'>" + (coverage.markets_tested || 0) + "</td></tr>" +
      "<tr><td class='muted'>Skipped (insufficient candles)</td><td class='num'>" + (coverage.markets_skipped || 0) + "</td></tr>" +
      "<tr><td class='muted'>Candle observations</td><td class='num'>" + TB.compact(coverage.candle_cells) + "</td></tr>" +
      "<tr><td class='muted'>Closed simulated trades</td><td class='num'>" + (analytics.closed_trades || 0) + "</td></tr>" +
      "<tr><td class='muted'>Total P&amp;L</td><td class='num'>" + TB.money(analytics.total_pnl, 2) + "</td></tr>" +
      "<tr><td class='muted'>Win rate</td><td class='num'>" + (analytics.closed_trades ? TB.pct(analytics.win_rate) : "—") + "</td></tr>" +
      "<tr><td class='muted'>Threshold / score floor</td><td class='num'>" + TB.money(method.threshold) + " / " + (method.score_floor || "—") + "</td></tr>" +
      "<tr><td class='muted'>Starting cash / sleeve</td><td class='num'>" + TB.money(method.starting_cash_per_strategy, 0) + "</td></tr>";
    document.querySelector("#bt-limits").innerHTML = (method.limitations || []).map((x) => "<li>" + TB.esc(x) + "</li>").join("");
    fillGroup("#bt-by-strategy", analytics.by_strategy, "strategy");
    fillGroup("#bt-by-topic", analytics.by_topic, "topic");
    fillGroup("#bt-by-price", analytics.by_price, "price");
    drawCurve(document.querySelector("#bt-chart"), analytics.equity_curve || [], "#6aa9ff", { empty: "No backtest trades cleared the score floor in this window." });
  }

  function renderPlaybook() {
    const body = document.querySelector("#pf-playbook tbody");
    if (!body) return;
    const stats = {};
    const bt = state.backtest && state.backtest.portfolio ? state.backtest.portfolio.analytics : null;
    (bt && bt.by_strategy ? bt.by_strategy : []).forEach((row) => { stats[row.key] = row; });
    const configs = {
      momentum: { entry: "≥ $0.10 move, direction of the move, positive edge after fees and spread", exit: "+$0.15 take profit, −$0.10 stop, or settlement" },
      mean_reversion: { entry: "≥ $0.15 move, fade toward the pre-move price", exit: "+$0.15 / −$0.10, or settlement" },
      favorite_drift: { entry: "Within 24h of close, YES mid ≥ $0.85, depth at touch", exit: "Hold to settlement or +$0.15 / −$0.10" }
    };
    body.innerHTML = Object.keys(TB.STRATEGIES).map((key) => {
      const s = TB.STRATEGIES[key];
      const row = stats[key] || {};
      return "<tr><td><strong>" + TB.esc(s.label) + "</strong><span class='sub'>" + TB.esc(key) + "</span></td>" +
        "<td class='small'>" + TB.esc(configs[key].entry) + "</td>" +
        "<td class='small'>" + TB.esc(configs[key].exit) + "</td>" +
        "<td class='small'>2% of sleeve at risk per trade, 25% of visible depth, max 250 contracts</td>" +
        "<td class='num'>" + (row.trades === undefined ? "—" : row.trades) + "</td>" +
        "<td class='num'>" + (row.trades ? TB.pct(row.win_rate) : "—") + "</td>" +
        "<td class='num " + ((row.pnl || 0) >= 0 ? "up" : "down") + "'>" + (row.pnl === undefined ? "—" : (row.pnl >= 0 ? "+" : "") + TB.money(row.pnl, 2)) + "</td></tr>";
    }).join("");
  }

  /* ---------------- charts ---------------- */
  function drawCurve(svg, points, color, opts) {
    if (!svg) return;
    opts = opts || {};
    const width = 820; const height = 260;
    const padL = 54; const padR = 14; const padT = 14; const padB = 28;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("preserveAspectRatio", "none");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const ns = "http://www.w3.org/2000/svg";
    const make = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
      return el;
    };
    const clean = (points || []).filter((p) => Number.isFinite(Number(p.equity)));
    if (clean.length < 2) {
      const text = make("text", { x: width / 2, y: height / 2, "text-anchor": "middle", fill: "#6f829b" });
      text.textContent = opts.empty || "Not enough data yet.";
      svg.appendChild(text);
      return;
    }
    const values = clean.map((p) => Number(p.equity));
    let min = Math.min.apply(null, values); let max = Math.max.apply(null, values);
    if (max - min < 1) { min -= 50; max += 50; }
    const pad = (max - min) * 0.1; min -= pad; max += pad;
    const t0 = clean[0].ts || 0; const t1 = clean[clean.length - 1].ts || t0 + 1;
    const x = (t) => padL + ((t - t0) / Math.max(1, t1 - t0)) * (width - padL - padR);
    const y = (v) => padT + (1 - (v - min) / (max - min)) * (height - padT - padB);
    for (let i = 0; i <= 3; i++) {
      const value = min + ((max - min) * i) / 3;
      const yy = y(value);
      svg.appendChild(make("line", { class: "grid-line", x1: padL, y1: yy, x2: width - padR, y2: yy }));
      const label = make("text", { x: padL - 6, y: yy + 3, "text-anchor": "end" });
      label.textContent = "$" + Math.round(value).toLocaleString();
      svg.appendChild(label);
    }
    let d = "";
    clean.forEach((p, i) => { d += (i === 0 ? "M" : "L") + x(Number(p.ts)).toFixed(2) + " " + y(Number(p.equity)).toFixed(2); });
    svg.appendChild(make("path", { class: "price-line", d: d, stroke: color }));
    const last = clean[clean.length - 1];
    svg.appendChild(make("circle", { cx: x(Number(last.ts)), cy: y(Number(last.equity)), r: 3, fill: color }));
    const firstLabel = make("text", { x: padL, y: height - 8, "text-anchor": "start" });
    firstLabel.textContent = clean[0].label || TB.isoDate(clean[0].ts * 1000);
    svg.appendChild(firstLabel);
    const lastLabel = make("text", { x: width - padR, y: height - 8, "text-anchor": "end" });
    lastLabel.textContent = TB.money(last.equity, 0);
    svg.appendChild(lastLabel);
  }

  /* ---------------- demo account ---------------- */
  async function checkBackend() {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (!local) {
      document.querySelector("#demo-message").innerHTML = "This published page has no backend, and no demo API key was provided to the project. Balance, positions and order placement are <strong>unverified</strong>. Run the local server with your own demo key to read them. <a href='flagged.html#F-01'>Details →</a>";
      return;
    }
    try {
      const health = await TBLive.getJSON("/api/health", { timeout: 2500 });
      document.querySelector("#demo-status").className = "badge " + (health.credentials_configured ? "green" : "warn");
      document.querySelector("#demo-status").textContent = health.credentials_configured ? "CONNECTED" : "NO CREDENTIALS";
      document.querySelector("#demo-message").innerHTML = "Local backend detected. Mode: <code>" + TB.esc(health.mode) + "</code>. Environment: <code>" + TB.esc(health.environment) + "</code>. Trading active: <code>" + health.trading_active + "</code>.";
      const portfolio = await TBLive.getJSON("/api/demo/portfolio", { timeout: 8000 }).catch((e) => ({ connected: false, reason: e.message }));
      document.querySelector("#demo-live").innerHTML = "<pre class='small mono' style='white-space:pre-wrap; max-height:280px; overflow:auto'>" + TB.esc(JSON.stringify(portfolio, null, 2)) + "</pre>";
      if (portfolio && portfolio.balance) {
        document.querySelector("#demo-status").className = "badge green";
        document.querySelector("#demo-status").textContent = "VERIFIED LIVE";
      }
    } catch (e) {
      document.querySelector("#demo-message").innerHTML = "No local backend responded on this origin. Start it with <code>python -m app.server</code> and a demo API key. Balance and orders remain <strong>unverified</strong> until then.";
    }
  }

  function exportCsv() {
    const analytics = TB.paper.analytics(state.paper);
    const rows = analytics.trades.slice();
    const header = ["ticker", "topic", "strategy", "side", "contracts", "entry_price", "exit_price", "entry_fee", "exit_fee", "pnl", "roi", "status", "opened", "closed", "reason"];
    const lines = [header.join(",")];
    rows.forEach((t) => {
      lines.push([t.ticker, t.topic, t.strategy, t.side, t.contracts, t.entry_price, t.exit_price, t.entry_fee, t.exit_fee || 0, t.pnl, t.roi, t.status, new Date(t.opened_ts * 1000).toISOString(), t.closed_ts ? new Date(t.closed_ts * 1000).toISOString() : "", t.close_reason || ""].map((v) => '"' + String(v === undefined || v === null ? "" : v).replace(/"/g, '""') + '"').join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tradebot2-paper-trades-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    UI.toast("Exported " + rows.length + " closed paper trade(s) as CSV.", "ok");
  }
})();
