/**
 * Tradebot2 — Main Live Dashboard Controller (index.html)
 */
(async function () {
  const C = window.TradebotCore;
  C.renderLayout("dashboard");

  const topicsData = await C.loadJson("data/verified_topics.json");
  const flaggedData = await C.loadJson("data/flagged_irregularities.json");
  const flaggedCountEl = document.getElementById("nav-flagged-count");
  if (flaggedCountEl) flaggedCountEl.textContent = String(flaggedData.items.length);

  // Flatten verified events while keeping topic separation intact
  const topics = topicsData.topics;
  const allEvents = [];
  topics.forEach((t, tIdx) => {
    t.events.forEach((ev, eIdx) => {
      allEvents.push({
        ...ev,
        topicSlug: t.slug,
        topicName: t.name,
        livePrice: ev.status === "resolved" ? ev.observed_yes_price : ev.observed_yes_price,
        lastDelta: 0,
        seedOffset: (tIdx + 1) * 19 + (eIdx + 1) * 7
      });
    });
  });

  // Sort within each topic by verified dollar volume descending (blank unverified last)
  topics.forEach(t => {
    t.events.sort((a, b) => (b.observed_volume_usd ?? -1) - (a.observed_volume_usd ?? -1));
  });

  let state = {
    selectedTopic: "all",
    selectedTicker: allEvents[0].event_ticker,
    timeframe: "minutes",
    mode: "SIMULATED_DEMO",
    restHost: "https://external-api.demo.kalshi.co/trade-api/v2",
    simRunning: true,
    seriesByKey: {},
    orderbooks: {},
    allAlerts: [],
    highRoiAlerts: [],
    portfolio: C.loadPortfolio(),
    autoLog: []
  };

  function getEvent(ticker) {
    return allEvents.find(e => e.event_ticker === ticker) || allEvents[0];
  }

  function getSeries(ev, timeframe) {
    const key = `${ev.event_ticker}::${timeframe}`;
    if (!state.seriesByKey[key]) {
      state.seriesByKey[key] = C.buildTimeSeries(ev.livePrice, timeframe, ev.catalyst_source, ev.event_ticker);
    }
    return state.seriesByKey[key];
  }

  function getOrderbook(ev) {
    if (!state.orderbooks[ev.event_ticker]) {
      state.orderbooks[ev.event_ticker] = C.buildOrderbookFromPrice(ev.livePrice, ev.seedOffset);
    }
    return state.orderbooks[ev.event_ticker];
  }

  // Seed initial >= $0.10 swing alerts across topics so both scrolling chats are immediately populated
  function seedInitialAlerts() {
    const seeds = [
      { ticker: "KXAAAGASMIN-26DEC31", prev: 0.70, next: 0.97, note: "AAA national regular gas fell below $4.00/gal to $3.7502; traders repriced sub-$3.60 yearly low." },
      { ticker: "KXETHMINY-27JAN01", prev: 0.23, next: 0.42, note: "Ethereum slipped under $2,000 amid $695.9M Nov US fund outflows." },
      { ticker: "KXFRENCHPRES-27", prev: 0.62, next: 0.51, note: "French probe headlines pressured frontrunner contract by -$0.11." },
      { ticker: "KXGAMEAWARDS-2026", prev: 0.79, next: 0.91, note: "GTA VI Metacritic 99 & 8 Game Awards nominations drove +$0.12 jump." },
      { ticker: "KXPGATOUR-MAST27", prev: 0.28, next: 0.16, note: "2027 Masters outright odds tightened as field futures expanded." }
    ];
    seeds.forEach((s, idx) => {
      const ev = getEvent(s.ticker);
      const ob = getOrderbook(ev);
      const scored = C.scoreSwingOpportunity(s.prev, s.next, ob.spread, ob.totalYesBidContracts);
      const alertObj = {
        id: "INIT-" + idx,
        time: new Date(Date.now() - (seeds.length - idx) * 45000).toLocaleTimeString(),
        ticker: ev.event_ticker,
        title: ev.title,
        topicSlug: ev.topicSlug,
        topicName: ev.topicName,
        prevPrice: s.prev,
        newPrice: s.next,
        delta: scored.delta,
        score: scored.score,
        isHighRoi: scored.isHighRoi,
        recommendedSide: scored.recommendedSide,
        estRoiPct: scored.estRoiPct,
        catalystTitle: s.note,
        catalystUrl: ev.catalyst_source.url,
        kalshiUrl: ev.kalshi_url,
        isSimulated: true
      };
      state.allAlerts.unshift(alertObj);
      if (alertObj.isHighRoi) state.highRoiAlerts.unshift(alertObj);
    });
  }

  function renderKpis() {
    const m = C.computePortfolioMetrics(state.portfolio);
    const activeCount = allEvents.filter(e => e.status === "active").length;
    const resolvedCount = allEvents.filter(e => e.status === "resolved").length;
    document.getElementById("kpi-equity").textContent = C.formatUsd(m.totalEquity);
    document.getElementById("kpi-equity-sub").textContent = `Cash ${C.formatUsd(m.cash)} · ROI ${m.totalRoi >= 0 ? "+" : ""}${m.totalRoi}%`;
    document.getElementById("kpi-pnl").textContent = `${m.realizedPnl + m.unrealizedPnl >= 0 ? "+" : ""}${C.formatUsd(m.realizedPnl + m.unrealizedPnl)}`;
    document.getElementById("kpi-pnl").className = "kpi-value " + (m.realizedPnl + m.unrealizedPnl >= 0 ? "pos" : "neg");
    document.getElementById("kpi-pnl-sub").textContent = `Realized ${C.formatUsd(m.realizedPnl)} · Unrealized ${C.formatUsd(m.unrealizedPnl)}`;
    document.getElementById("kpi-swings").textContent = String(state.allAlerts.length);
    document.getElementById("kpi-swings-sub").textContent = `${state.highRoiAlerts.length} passed Selective High-ROI filter`;
    document.getElementById("kpi-events").textContent = `${activeCount} / ${resolvedCount}`;
    document.getElementById("kpi-events-sub").textContent = `Active vs Resolved (YES/NO) across 5 topics`;
  }

  function renderAlertFeeds() {
    const renderMsg = (a, isHighRoiFeed) => {
      const up = a.delta >= 0;
      const cls = isHighRoiFeed ? "chat-msg high-roi" : `chat-msg ${up ? "" : "down"}`;
      return `
        <div class="${cls}">
          <div class="chat-meta">
            <div>
              <span class="badge topic-pill-${a.topicSlug}">${C.escapeHtml(a.topicName)}</span>
              <strong class="mono" style="margin-left:4px;">${C.escapeHtml(a.ticker)}</strong>
            </div>
            <div>
              <span class="badge ${up ? "badge-green" : "badge-red"} mono">
                ${up ? "▲ +" : "▼ -"}$${Math.abs(a.delta).toFixed(2)} (${C.formatPrice(a.prevPrice)} → ${C.formatPrice(a.newPrice)})
              </span>
              <span class="chat-time" style="margin-left:6px;">${a.time}</span>
            </div>
          </div>
          <div style="color:var(--text);font-weight:600;margin-bottom:2px;">${C.escapeHtml(a.title)}</div>
          <div style="color:var(--text-muted);font-size:12px;">
            ${C.escapeHtml(a.catalystTitle)}
            ${isHighRoiFeed ? ` · <strong class="pos">Model Score ${a.score}/100 · Suggest ${a.recommendedSide} (~${a.estRoiPct}% max ROI)</strong>` : ` · Model Score: ${a.score}/100`}
          </div>
          <div class="chat-actions">
            <button class="btn btn-sm" onclick="window.inspectMarket('${a.ticker}')">Inspect Chart &amp; Book</button>
            <button class="btn btn-sm btn-primary" onclick="window.quickPrefillTrade('${a.ticker}', '${a.recommendedSide}', ${a.newPrice})">Trade ${a.recommendedSide}</button>
            <a href="${a.catalystUrl}" target="_blank" rel="noopener">Catalyst Source ↗</a>
            <a href="${a.kalshiUrl}" target="_blank" rel="noopener">Kalshi Market ↗</a>
          </div>
        </div>
      `;
    };

    document.getElementById("chat-all-events").innerHTML =
      state.allAlerts.map(a => renderMsg(a, false)).join("") || "<div class='card-subtitle'>Waiting for >= $0.10 swings…</div>";
    document.getElementById("chat-high-roi").innerHTML =
      state.highRoiAlerts.map(a => renderMsg(a, true)).join("") || "<div class='card-subtitle'>No swings met High-ROI filter criteria yet.</div>";
    document.getElementById("all-swing-count").textContent = `${state.allAlerts.length} alerts`;
    document.getElementById("roi-swing-count").textContent = `${state.highRoiAlerts.length} high-ROI`;
  }

  function renderChartAndOrderbook() {
    const ev = getEvent(state.selectedTicker);
    const series = getSeries(ev, state.timeframe);
    const ob = getOrderbook(ev);

    document.getElementById("chart-market-title").textContent = `${ev.title}`;
    document.getElementById("chart-market-meta").innerHTML = `
      <span class="badge topic-pill-${ev.topicSlug}">${C.escapeHtml(ev.topicName)}</span>
      <span class="mono" style="margin-left:6px;color:var(--text-muted);">${C.escapeHtml(ev.event_ticker)}</span>
      · Leading: <strong>${C.escapeHtml(ev.leading_outcome)}</strong>
      · Current YES: <strong class="mono pos">${C.formatPrice(ev.livePrice)}</strong>
      · <a href="${ev.kalshi_url}" target="_blank" rel="noopener">Official Kalshi Page ↗</a>
    `;

    // Timeframe toggle button states
    ["seconds", "minutes", "hours"].forEach(tf => {
      const btn = document.getElementById(`tf-${tf}`);
      if (btn) btn.classList.toggle("active-toggle", state.timeframe === tf);
    });

    const canvas = document.getElementById("price-chart-canvas");
    const tooltip = document.getElementById("price-chart-tooltip");
    C.drawPriceChart(canvas, series, state.timeframe, tooltip);

    // Catalyst links for >= $0.10 jumps on this chart
    const jumps = series.filter(pt => pt.jump).reverse();
    const catEl = document.getElementById("chart-catalysts");
    if (jumps.length) {
      catEl.innerHTML = jumps.map(pt => `
        <div class="catalyst-item">
          <div>
            <span class="badge ${pt.jump.delta >= 0 ? "badge-green" : "badge-red"} mono">
              ${pt.jump.delta >= 0 ? "+" : "-"}$${Math.abs(pt.jump.delta).toFixed(2)} Swing
            </span>
            <strong style="margin-left:6px;">${C.escapeHtml(pt.jump.catalystTitle)}</strong>
            <span class="mono" style="color:var(--text-dim);margin-left:6px;">${new Date(pt.ts).toLocaleTimeString()}</span>
          </div>
          <a href="${pt.jump.catalystUrl}" target="_blank" rel="noopener">Open Verified Source Link ↗</a>
        </div>
      `).join("");
    } else {
      catEl.innerHTML = `<div class="catalyst-item"><span>No >= $0.10 jumps recorded in this window yet.</span><a href="${ev.catalyst_source.url}" target="_blank" rel="noopener">Primary Settlement Source ↗</a></div>`;
    }

    // Orderbook liquidity ladder
    document.getElementById("orderbook-container").innerHTML = C.renderOrderbookHtml(ob, "selectOrderbookPrice");

    // Sync trade ticket ticker
    const tradeTickerEl = document.getElementById("trade-ticker");
    if (tradeTickerEl && tradeTickerEl.value !== ev.event_ticker) {
      tradeTickerEl.value = ev.event_ticker;
      document.getElementById("trade-price").value = ev.livePrice.toFixed(2);
    }
  }

  function renderTopicsTables() {
    const container = document.getElementById("topics-table-container");
    const visibleTopics = state.selectedTopic === "all"
      ? topics
      : topics.filter(t => t.slug === state.selectedTopic);

    container.innerHTML = visibleTopics.map(topic => `
      <div style="margin-bottom:20px;">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div>
            <span class="badge topic-pill-${topic.slug}" style="font-size:12px;">${C.escapeHtml(topic.name)}</span>
            <span style="color:var(--text-muted);font-size:12.5px;margin-left:8px;">${C.escapeHtml(topic.description)}</span>
          </div>
          <div style="display:flex;gap:10px;font-size:12px;">
            <a href="pages/${topic.slug}.html">Open Dedicated ${C.escapeHtml(topic.name)} Subpage →</a>
            <a href="${topic.primary_settlement_source.url}" target="_blank" rel="noopener">Settlement Source ↗</a>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event Ticker &amp; Title</th>
                <th>Leading Outcome</th>
                <th class="num">YES Price</th>
                <th class="num">Observed Volume (USD)</th>
                <th>Lifecycle / Resolution (YES / NO)</th>
                <th>Official Source Links</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${topic.events.map(ev => {
                const liveEv = getEvent(ev.event_ticker);
                const selected = liveEv.event_ticker === state.selectedTicker;
                const volHtml = ev.volume_verified && ev.observed_volume_usd !== null
                  ? `<span class="mono">${C.formatUsd(ev.observed_volume_usd)}</span>`
                  : `<span class="unverified-cell">— (<a href="pages/flagged-for-review.html">Unverified</a>)</span>`;
                const statusBadge = ev.status === "resolved"
                  ? `<span class="badge badge-purple">Resolved</span> <span style="font-size:12px;color:var(--text-muted);">${C.escapeHtml(ev.resolution)}</span>`
                  : `<span class="badge badge-green">Active</span> <span style="font-size:12px;color:var(--text-muted);">${C.escapeHtml(ev.expiration_note)}</span>`;
                return `
                  <tr class="${selected ? "selected-row" : ""}">
                    <td>
                      <div class="mono" style="font-weight:700;color:var(--text);">${C.escapeHtml(ev.event_ticker)}</div>
                      <div style="color:var(--text-muted);font-size:12px;">${C.escapeHtml(ev.title)}</div>
                    </td>
                    <td>${C.escapeHtml(ev.leading_outcome)}</td>
                    <td class="num"><strong>${C.formatPrice(liveEv.livePrice)}</strong></td>
                    <td class="num">${volHtml}</td>
                    <td>${statusBadge}</td>
                    <td style="white-space:nowrap;">
                      <a href="${ev.kalshi_url}" target="_blank" rel="noopener">Kalshi ↗</a> ·
                      <a href="${ev.catalyst_source.url}" target="_blank" rel="noopener">Source ↗</a>
                    </td>
                    <td style="white-space:nowrap;">
                      <button class="btn btn-sm" onclick="window.inspectMarket('${ev.event_ticker}')">Chart</button>
                      <button class="btn btn-sm btn-primary" onclick="window.quickPrefillTrade('${ev.event_ticker}', 'YES', ${liveEv.livePrice})">Trade</button>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `).join("");
  }

  function renderStrategyToggles() {
    const el = document.getElementById("auto-strategy-toggles");
    el.innerHTML = state.portfolio.strategies.map(s => `
      <div class="strategy-box">
        <div class="strategy-box-top">
          <strong style="font-size:12.5px;">${C.escapeHtml(s.name)}</strong>
          <button class="btn btn-sm ${s.enabled ? "btn-primary" : ""}" onclick="window.toggleAutoStrategy('${s.id}')">
            ${s.enabled ? "AUTO ON" : "AUTO OFF"}
          </button>
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);">${C.escapeHtml(s.description)}</div>
        <div class="mono" style="font-size:11px;color:var(--text-dim);">Trigger: >= $${Number(s.minSwing).toFixed(2)} · Size: ${s.contracts} cts</div>
      </div>
    `).join("");
  }

  function runAutomatedStrategiesOnSwing(ev, alertObj, ob) {
    const enabled = state.portfolio.strategies.filter(s => s.enabled);
    enabled.forEach(s => {
      if (Math.abs(alertObj.delta) < s.minSwing) return;
      if (s.topicFilter !== "all" && s.topicFilter !== ev.topicSlug) return;
      if (s.rule === "high-roi" && !alertObj.isHighRoi) return;

      let side = "YES";
      if (s.rule === "fade") side = alertObj.delta < 0 ? "YES" : "NO";
      else if (s.rule === "follow") side = alertObj.delta > 0 ? "YES" : "NO";
      else if (s.rule === "high-roi") side = alertObj.recommendedSide;
      else side = ob.totalYesBidContracts >= ob.totalYesAskContracts ? "YES" : "NO";

      const execPrice = side === "YES" ? ev.livePrice : Number((1 - ev.livePrice).toFixed(2));
      const res = C.executeDemoTrade(state.portfolio, {
        ticker: ev.event_ticker,
        topic: ev.topicSlug,
        title: `${ev.title} (${ev.leading_outcome})`,
        side,
        price: execPrice,
        yesPrice: ev.livePrice,
        contracts: s.contracts,
        strategy: s.name,
        categoryTag: s.rule === "fade" ? "Mean-Reversion" : s.rule === "follow" ? "Momentum" : s.rule === "high-roi" ? "High-ROI Selective" : "Liquidity Imbalance",
        sourceUrl: ev.kalshi_url
      });
      if (res.ok) {
        state.autoLog.unshift(`[${new Date().toLocaleTimeString()}] AUTO ${s.name}: Bought ${s.contracts} ${side} ${ev.event_ticker} @ ${C.formatPrice(execPrice)} (cost ${C.formatUsd(res.cost)})`);
        if (state.autoLog.length > 8) state.autoLog.pop();
        document.getElementById("auto-exec-log").innerHTML = state.autoLog
          .map(line => `<div class="mono" style="font-size:11.5px;color:#34d399;padding:2px 0;">${C.escapeHtml(line)}</div>`)
          .join("");
      }
    });
  }

  function emitSwingEvent(forcedTicker = null) {
    const activeEvents = allEvents.filter(e => e.status === "active");
    const ev = forcedTicker
      ? getEvent(forcedTicker)
      : activeEvents[Math.floor(Math.random() * activeEvents.length)];

    const prev = ev.livePrice;
    const dir = prev > 0.72 ? -1 : prev < 0.28 ? 1 : (Math.random() > 0.5 ? 1 : -1);
    const mag = Number((0.10 + Math.random() * 0.06).toFixed(2));
    const next = Number(Math.max(0.05, Math.min(0.95, prev + dir * mag)).toFixed(2));
    ev.livePrice = next;
    ev.lastDelta = Number((next - prev).toFixed(2));

    // Update orderbook and mark open positions to market
    const ob = C.buildOrderbookFromPrice(next, ev.seedOffset + Math.floor(Math.random() * 20));
    state.orderbooks[ev.event_ticker] = ob;
    state.portfolio.positions.forEach(p => {
      if (p.ticker === ev.event_ticker) p.currentPrice = next;
    });
    C.savePortfolio(state.portfolio);

    // Append jump point to all cached timeframes for this market
    ["seconds", "minutes", "hours"].forEach(tf => {
      const key = `${ev.event_ticker}::${tf}`;
      if (state.seriesByKey[key]) {
        state.seriesByKey[key].push({
          ts: Date.now(),
          price: next,
          jump: {
            delta: ev.lastDelta,
            catalystTitle: `${ev.catalyst_source.name} — Simulated Demo Repricing Shock`,
            catalystUrl: ev.catalyst_source.url
          }
        });
        if (state.seriesByKey[key].length > 42) state.seriesByKey[key].shift();
      }
    });

    const scored = C.scoreSwingOpportunity(prev, next, ob.spread, ob.totalYesBidContracts);
    const alertObj = {
      id: "SW-" + Date.now(),
      time: new Date().toLocaleTimeString(),
      ticker: ev.event_ticker,
      title: ev.title,
      topicSlug: ev.topicSlug,
      topicName: ev.topicName,
      prevPrice: prev,
      newPrice: next,
      delta: scored.delta,
      score: scored.score,
      isHighRoi: scored.isHighRoi,
      recommendedSide: scored.recommendedSide,
      estRoiPct: scored.estRoiPct,
      catalystTitle: `${ev.catalyst_source.name} (Simulated Demo Swing Tick)`,
      catalystUrl: ev.catalyst_source.url,
      kalshiUrl: ev.kalshi_url,
      isSimulated: true
    };
    state.allAlerts.unshift(alertObj);
    if (state.allAlerts.length > 40) state.allAlerts.pop();
    if (alertObj.isHighRoi) {
      state.highRoiAlerts.unshift(alertObj);
      if (state.highRoiAlerts.length > 30) state.highRoiAlerts.pop();
    }

    runAutomatedStrategiesOnSwing(ev, alertObj, ob);
    renderAlertFeeds();
    renderKpis();
    renderTopicsTables();
    if (ev.event_ticker === state.selectedTicker || forcedTicker) {
      renderChartAndOrderbook();
    }
  }

  // Gentle live tick every 3 seconds when Simulator is active
  function runSimTick() {
    if (!state.simRunning) return;
    const ev = getEvent(state.selectedTicker);
    if (ev.status === "active") {
      const nudge = Number(((Math.random() - 0.5) * 0.02).toFixed(2));
      ev.livePrice = Number(Math.max(0.03, Math.min(0.97, ev.livePrice + nudge)).toFixed(2));
      state.orderbooks[ev.event_ticker] = C.buildOrderbookFromPrice(ev.livePrice, ev.seedOffset + Math.floor(Date.now() / 3000) % 15);
      const secSeries = getSeries(ev, "seconds");
      secSeries.push({ ts: Date.now(), price: ev.livePrice, jump: null });
      if (secSeries.length > 42) secSeries.shift();
      state.portfolio.positions.forEach(p => {
        if (p.ticker === ev.event_ticker) p.currentPrice = ev.livePrice;
      });
      renderChartAndOrderbook();
      renderKpis();
    }
    // Occasionally emit a >= $0.10 swing (~15% chance per tick)
    if (Math.random() < 0.15) {
      emitSwingEvent();
    }
  }

  // Live Kalshi Demo REST connector
  async function connectLiveDemoRest() {
    const statusText = document.getElementById("connection-status-text");
    const statusDot = document.getElementById("connection-status-dot");
    const host = document.getElementById("demo-host-select").value;
    state.restHost = host;
    statusText.textContent = `Connecting to ${host}…`;
    statusDot.className = "status-dot amber";

    try {
      const resp = await fetch(`${host}/events?status=open&with_nested_markets=true&limit=20`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      const liveEventsCount = (json.events || []).length;
      state.mode = "LIVE_KALSHI_DEMO_REST";
      statusDot.className = "status-dot";
      statusText.textContent = `Connected Live Demo REST (${liveEventsCount} open Demo events fetched)`;

      // Try fetching live orderbook for selected ticker if present on Demo
      const obResp = await fetch(`${host}/markets/${encodeURIComponent(state.selectedTicker)}/orderbook?depth=10`);
      if (obResp.ok) {
        const obJson = await obResp.json();
        if (obJson?.orderbook_fp && (obJson.orderbook_fp.yes_dollars?.length || obJson.orderbook_fp.no_dollars?.length)) {
          state.orderbooks[state.selectedTicker] = C.parseLiveKalshiOrderbook(obJson);
          renderChartAndOrderbook();
        }
      }
    } catch (err) {
      state.mode = "SIMULATED_DEMO";
      statusDot.className = "status-dot amber";
      statusText.textContent = `Simulated Demo Mode (Browser REST fetch blocked/unavailable: ${err.message} — see IR-06 on Flagged page)`;
    }
  }

  // Global window handlers for inline buttons
  window.inspectMarket = function (ticker) {
    state.selectedTicker = ticker;
    renderChartAndOrderbook();
    renderTopicsTables();
    document.getElementById("chart-section").scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  window.quickPrefillTrade = function (ticker, side, price) {
    state.selectedTicker = ticker;
    document.getElementById("trade-ticker").value = ticker;
    document.getElementById("trade-side").value = side;
    document.getElementById("trade-price").value = Number(price).toFixed(2);
    renderChartAndOrderbook();
    document.getElementById("trade-ticket-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  window.selectOrderbookPrice = function (price, side) {
    document.getElementById("trade-side").value = side;
    document.getElementById("trade-price").value = Number(price).toFixed(2);
  };

  window.toggleAutoStrategy = function (stratId) {
    const s = state.portfolio.strategies.find(x => x.id === stratId);
    if (!s) return;
    s.enabled = !s.enabled;
    C.savePortfolio(state.portfolio);
    renderStrategyToggles();
  };

  // Populate trade ticker selector
  const tickerSelect = document.getElementById("trade-ticker");
  tickerSelect.innerHTML = allEvents.map(ev =>
    `<option value="${ev.event_ticker}">[${ev.topicName}] ${ev.event_ticker} — ${ev.title}</option>`
  ).join("");

  // Wire UI Controls
  ["seconds", "minutes", "hours"].forEach(tf => {
    document.getElementById(`tf-${tf}`).addEventListener("click", () => {
      state.timeframe = tf;
      renderChartAndOrderbook();
    });
  });

  document.querySelectorAll(".topic-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".topic-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedTopic = btn.dataset.topic;
      renderTopicsTables();
    });
  });

  document.getElementById("btn-connect-live").addEventListener("click", connectLiveDemoRest);
  document.getElementById("btn-trigger-swing").addEventListener("click", () => emitSwingEvent(state.selectedTicker));
  document.getElementById("btn-toggle-sim").addEventListener("click", (e) => {
    state.simRunning = !state.simRunning;
    e.target.textContent = state.simRunning ? "Pause Live Stream" : "Resume Live Stream";
  });

  document.getElementById("trade-ticket-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const ticker = document.getElementById("trade-ticker").value;
    const side = document.getElementById("trade-side").value;
    const contracts = Number(document.getElementById("trade-contracts").value);
    const price = Number(document.getElementById("trade-price").value);
    const categoryTag = document.getElementById("trade-category").value;
    const ev = getEvent(ticker);
    const res = C.executeDemoTrade(state.portfolio, {
      ticker,
      topic: ev.topicSlug,
      title: `${ev.title} (${ev.leading_outcome})`,
      side,
      price,
      yesPrice: ev.livePrice,
      contracts,
      strategy: "Manual Demo Execution",
      categoryTag,
      sourceUrl: ev.kalshi_url
    });
    const feedback = document.getElementById("trade-feedback");
    if (res.ok) {
      feedback.innerHTML = `<span class="pos">Executed Demo order: Bought ${contracts} ${side} ${ticker} @ ${C.formatPrice(price)} (${C.formatUsd(res.cost)}). <a href="pages/portfolio-strategies.html">View in Portfolio →</a></span>`;
      renderKpis();
    } else {
      feedback.innerHTML = `<span class="neg">${C.escapeHtml(res.error)}</span>`;
    }
  });

  // Initial render
  seedInitialAlerts();
  renderKpis();
  renderAlertFeeds();
  renderChartAndOrderbook();
  renderTopicsTables();
  renderStrategyToggles();

  window.addEventListener("resize", () => renderChartAndOrderbook());
  setInterval(runSimTick, 3000);
})();
