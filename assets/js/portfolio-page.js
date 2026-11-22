/**
 * Tradebot2 — Demo Portfolio Performance, Trade Categorization & Strategy Lab
 */
(async function () {
  const C = window.TradebotCore;
  C.renderLayout("portfolio");

  const topicsData = await C.loadJson("data/verified_topics.json");
  const flaggedData = await C.loadJson("data/flagged_irregularities.json");
  const flaggedCountEl = document.getElementById("nav-flagged-count");
  if (flaggedCountEl) flaggedCountEl.textContent = String(flaggedData.items.length);

  let portfolio = C.loadPortfolio();

  function drawEquityChart() {
    const canvas = document.getElementById("equity-chart-canvas");
    if (!canvas) return;
    const pts = portfolio.equityHistory || [];
    if (!pts.length) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(300, Math.floor(rect.width));
    const h = Math.max(210, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0d141c";
    ctx.fillRect(0, 0, w, h);

    const pad = { top: 18, right: 20, bottom: 28, left: 66 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    const vals = pts.map(p => p.value);
    const minV = Math.min(...vals, portfolio.startingCash) - 40;
    const maxV = Math.max(...vals, portfolio.startingCash) + 40;
    const span = Math.max(1, maxV - minV);

    ctx.strokeStyle = "#1d2b3b";
    ctx.fillStyle = "#7d90a6";
    ctx.font = "11px ui-monospace, monospace";
    for (let i = 0; i <= 3; i++) {
      const v = minV + (span * i) / 3;
      const y = pad.top + ch * (1 - (v - minV) / span);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke();
      ctx.fillText(`$${v.toFixed(0)}`, 8, y + 4);
    }

    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = pad.left + (i / Math.max(1, pts.length - 1)) * cw;
      const y = pad.top + ch * (1 - (p.value - minV) / span);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#00c482";
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }

  function renderAll() {
    const m = C.computePortfolioMetrics(portfolio);
    document.getElementById("pf-equity").textContent = C.formatUsd(m.totalEquity);
    document.getElementById("pf-cash").textContent = C.formatUsd(m.cash);
    document.getElementById("pf-realized").textContent = `${m.realizedPnl >= 0 ? "+" : ""}${C.formatUsd(m.realizedPnl)}`;
    document.getElementById("pf-realized").className = "kpi-value " + (m.realizedPnl >= 0 ? "pos" : "neg");
    document.getElementById("pf-unrealized").textContent = `${m.unrealizedPnl >= 0 ? "+" : ""}${C.formatUsd(m.unrealizedPnl)}`;
    document.getElementById("pf-unrealized").className = "kpi-value " + (m.unrealizedPnl >= 0 ? "pos" : "neg");
    document.getElementById("pf-winrate").textContent = `${m.winRate}%`;
    document.getElementById("pf-roi").textContent = `${m.totalRoi >= 0 ? "+" : ""}${m.totalRoi}%`;
    document.getElementById("pf-roi").className = "kpi-value " + (m.totalRoi >= 0 ? "pos" : "neg");

    drawEquityChart();

    // Open Positions Table
    document.getElementById("open-positions-tbody").innerHTML = portfolio.positions.map(p => {
      const mark = p.side === "YES" ? p.currentPrice : Number((1 - p.currentPrice).toFixed(2));
      const uPnl = Number(((mark - p.avgPrice) * p.contracts).toFixed(2));
      return `
        <tr>
          <td>
            <span class="badge topic-pill-${p.topic}">${C.escapeHtml(p.topic)}</span>
            <div class="mono" style="font-weight:700;margin-top:2px;">${C.escapeHtml(p.ticker)}</div>
            <div style="font-size:11.5px;color:var(--text-muted);">${C.escapeHtml(p.title)}</div>
          </td>
          <td><span class="badge ${p.side === "YES" ? "badge-green" : "badge-red"}">${p.side}</span></td>
          <td class="num">${p.contracts}</td>
          <td class="num">${C.formatPrice(p.avgPrice)}</td>
          <td class="num">${C.formatPrice(mark)}</td>
          <td class="num ${uPnl >= 0 ? "pos" : "neg"}">${uPnl >= 0 ? "+" : ""}${C.formatUsd(uPnl)}</td>
          <td>
            <div>${C.escapeHtml(p.strategy)}</div>
            <span class="badge badge-muted">${C.escapeHtml(p.categoryTag)}</span>
          </td>
          <td style="white-space:nowrap;">
            <button class="btn btn-sm btn-primary" onclick="window.pfSettle('${p.id}', 'YES')">Resolve YES</button>
            <button class="btn btn-sm btn-danger" onclick="window.pfSettle('${p.id}', 'NO')">Resolve NO</button>
            <button class="btn btn-sm" onclick="window.pfClose('${p.id}')">Close</button>
          </td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="8" style="color:var(--text-muted);">No open Demo positions. Execute a trade from the Live Dashboard or run a strategy simulation below.</td></tr>`;

    // Closed & Resolved Trades Table
    document.getElementById("closed-trades-tbody").innerHTML = portfolio.closedTrades.map(t => `
      <tr>
        <td>
          <span class="badge topic-pill-${t.topic}">${C.escapeHtml(t.topic)}</span>
          <div class="mono" style="font-weight:700;margin-top:2px;">${C.escapeHtml(t.ticker)}</div>
          <div style="font-size:11.5px;color:var(--text-muted);">${C.escapeHtml(t.title)}</div>
        </td>
        <td><span class="badge ${t.side === "YES" ? "badge-green" : "badge-red"}">${t.side}</span></td>
        <td class="num">${t.contracts}</td>
        <td class="num">${C.formatPrice(t.entryPrice)} → ${C.formatPrice(t.exitPrice)}</td>
        <td>
          <span class="badge ${t.resolvedOutcome === "YES" ? "badge-green" : t.resolvedOutcome === "NO" ? "badge-red" : "badge-muted"}">
            ${C.escapeHtml(t.resolvedOutcome)}
          </span>
        </td>
        <td class="num ${t.pnl >= 0 ? "pos" : "neg"}"><strong>${t.pnl >= 0 ? "+" : ""}${C.formatUsd(t.pnl)}</strong></td>
        <td class="num ${t.roiPct >= 0 ? "pos" : "neg"}">${t.roiPct >= 0 ? "+" : ""}${t.roiPct}%</td>
        <td>
          <div>${C.escapeHtml(t.strategy)}</div>
          <a href="${t.sourceUrl}" target="_blank" rel="noopener" style="font-size:11.5px;">Source ↗</a>
        </td>
      </tr>
    `).join("");

    // Categorization Analytics by Strategy & Topic
    const byStrat = {};
    const byTopic = {};
    portfolio.closedTrades.forEach(t => {
      if (!byStrat[t.strategy]) byStrat[t.strategy] = { count: 0, wins: 0, pnl: 0, cost: 0 };
      byStrat[t.strategy].count++;
      if (t.pnl > 0) byStrat[t.strategy].wins++;
      byStrat[t.strategy].pnl += t.pnl;
      byStrat[t.strategy].cost += t.entryPrice * t.contracts;

      if (!byTopic[t.topic]) byTopic[t.topic] = { count: 0, wins: 0, pnl: 0, yesRes: 0, noRes: 0 };
      byTopic[t.topic].count++;
      if (t.pnl > 0) byTopic[t.topic].wins++;
      byTopic[t.topic].pnl += t.pnl;
      if (t.resolvedOutcome === "YES") byTopic[t.topic].yesRes++;
      if (t.resolvedOutcome === "NO") byTopic[t.topic].noRes++;
    });

    document.getElementById("strat-analytics-tbody").innerHTML = Object.entries(byStrat).map(([name, s]) => `
      <tr>
        <td><strong>${C.escapeHtml(name)}</strong></td>
        <td class="num">${s.count}</td>
        <td class="num">${((s.wins / s.count) * 100).toFixed(1)}%</td>
        <td class="num ${s.pnl >= 0 ? "pos" : "neg"}">${s.pnl >= 0 ? "+" : ""}${C.formatUsd(s.pnl)}</td>
        <td class="num">${s.cost > 0 ? ((s.pnl / s.cost) * 100).toFixed(1) : "0.0"}%</td>
      </tr>
    `).join("") || `<tr><td colspan="5" style="color:var(--text-muted);">Settle trades to view strategy analytics.</td></tr>`;

    document.getElementById("topic-analytics-tbody").innerHTML = Object.entries(byTopic).map(([slug, s]) => `
      <tr>
        <td><span class="badge topic-pill-${slug}">${C.escapeHtml(slug)}</span></td>
        <td class="num">${s.count}</td>
        <td class="num">${s.yesRes} / ${s.noRes}</td>
        <td class="num">${((s.wins / s.count) * 100).toFixed(1)}%</td>
        <td class="num ${s.pnl >= 0 ? "pos" : "neg"}">${s.pnl >= 0 ? "+" : ""}${C.formatUsd(s.pnl)}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" style="color:var(--text-muted);">Settle trades to view topic analytics.</td></tr>`;

    // Active Strategies List
    document.getElementById("strategies-list").innerHTML = portfolio.strategies.map(s => `
      <div class="strategy-box">
        <div class="strategy-box-top">
          <strong>${C.escapeHtml(s.name)}</strong>
          <button class="btn btn-sm ${s.enabled ? "btn-primary" : ""}" onclick="window.pfToggleStrat('${s.id}')">${s.enabled ? "Enabled" : "Disabled"}</button>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">${C.escapeHtml(s.description)}</div>
        <div class="mono" style="font-size:11px;color:var(--text-dim);">
          Topic: ${C.escapeHtml(s.topicFilter)} · Rule: ${C.escapeHtml(s.rule)} · Min Swing: $${Number(s.minSwing).toFixed(2)} · Size: ${s.contracts} cts
        </div>
      </div>
    `).join("");
  }

  // Run batch automated simulation across all 5 topics using active strategies
  function runBatchSimulation() {
    const enabled = portfolio.strategies.filter(s => s.enabled);
    if (!enabled.length) {
      alert("Enable at least one strategy first.");
      return;
    }
    let added = 0;
    topicsData.topics.forEach(t => {
      const ev = t.events.find(e => e.status === "active") || t.events[0];
      const strat = enabled[added % enabled.length];
      if (strat.topicFilter !== "all" && strat.topicFilter !== t.slug) return;
      const base = Math.max(0.15, Math.min(0.85, ev.observed_yes_price));
      const side = strat.rule === "fade" ? (base > 0.5 ? "NO" : "YES") : "YES";
      const entry = side === "YES" ? base : Number((1 - base).toFixed(2));
      const res = C.executeDemoTrade(portfolio, {
        ticker: ev.event_ticker,
        topic: t.slug,
        title: `${ev.title} (${ev.leading_outcome})`,
        side,
        price: entry,
        yesPrice: base,
        contracts: Math.min(strat.contracts, 40),
        strategy: strat.name,
        categoryTag: strat.rule,
        sourceUrl: ev.kalshi_url
      });
      if (res.ok) added++;
    });
    document.getElementById("sim-batch-msg").innerHTML = `<span class="pos">Automated batch executed ${added} simulated Demo orders across verified topics.</span>`;
    renderAll();
  }

  window.pfSettle = function (id, outcome) {
    C.settlePosition(portfolio, id, outcome);
    renderAll();
  };

  window.pfClose = function (id) {
    C.closePositionAtMarket(portfolio, id);
    renderAll();
  };

  window.pfToggleStrat = function (id) {
    const s = portfolio.strategies.find(x => x.id === id);
    if (!s) return;
    s.enabled = !s.enabled;
    C.savePortfolio(portfolio);
    renderAll();
  };

  document.getElementById("btn-run-sim-batch").addEventListener("click", runBatchSimulation);
  document.getElementById("btn-reset-portfolio").addEventListener("click", () => {
    portfolio = C.resetPortfolio();
    renderAll();
  });

  document.getElementById("custom-strategy-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cs-name").value.trim();
    const topicFilter = document.getElementById("cs-topic").value;
    const rule = document.getElementById("cs-rule").value;
    const minSwing = Number(document.getElementById("cs-swing").value);
    const contracts = Number(document.getElementById("cs-contracts").value);
    if (!name) return;

    portfolio.strategies.push({
      id: "custom-" + Date.now().toString(36),
      name,
      description: `Custom strategy (${rule}) targeting ${topicFilter} on >= $${minSwing.toFixed(2)} swings.`,
      enabled: true,
      minSwing,
      topicFilter,
      rule,
      contracts
    });
    C.savePortfolio(portfolio);
    e.target.reset();
    document.getElementById("cs-swing").value = "0.10";
    document.getElementById("cs-contracts").value = "35";
    renderAll();
  });

  renderAll();
  window.addEventListener("resize", drawEquityChart);
})();
