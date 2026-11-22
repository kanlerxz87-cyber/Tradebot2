/**
 * Tradebot2 — Dedicated Topic Subpage Controller
 * Renders a single strictly separated topic (Gas Prices, Elections, Culture, Crypto, or Golf)
 * with verified table + official links, interactive Seconds/Minutes/Hours chart,
 * liquidity ladder, and topic-scoped >= $0.10 swing alert stream.
 */
(async function () {
  const C = window.TradebotCore;
  const topicSlug = document.body.dataset.topic;
  C.renderLayout(topicSlug);

  const topicsData = await C.loadJson("data/verified_topics.json");
  const flaggedData = await C.loadJson("data/flagged_irregularities.json");
  const flaggedCountEl = document.getElementById("nav-flagged-count");
  if (flaggedCountEl) flaggedCountEl.textContent = String(flaggedData.items.length);

  const topic = topicsData.topics.find(t => t.slug === topicSlug);
  if (!topic) return;

  topic.events.sort((a, b) => (b.observed_volume_usd ?? -1) - (a.observed_volume_usd ?? -1));
  const events = topic.events.map((ev, i) => ({
    ...ev,
    livePrice: ev.observed_yes_price,
    seedOffset: (i + 1) * 23
  }));

  let selectedTicker = events[0].event_ticker;
  let timeframe = "minutes";
  const seriesCache = {};
  const portfolio = C.loadPortfolio();
  const topicAlerts = [];

  function getEv(ticker) {
    return events.find(e => e.event_ticker === ticker) || events[0];
  }

  function getSeries(ev, tf) {
    const k = `${ev.event_ticker}::${tf}`;
    if (!seriesCache[k]) {
      seriesCache[k] = C.buildTimeSeries(ev.livePrice, tf, ev.catalyst_source, ev.event_ticker);
    }
    return seriesCache[k];
  }

  function renderHeader() {
    document.getElementById("topic-title").textContent = `${topic.name} — Verified Kalshi Markets`;
    document.getElementById("topic-desc").textContent = topic.description;
    document.getElementById("topic-settlement-box").innerHTML = `
      <strong>Primary Official Settlement Source:</strong>
      <a href="${topic.primary_settlement_source.url}" target="_blank" rel="noopener">${C.escapeHtml(topic.primary_settlement_source.name)} ↗</a>
      — ${C.escapeHtml(topic.primary_settlement_source.verified_note)}
    `;
  }

  function renderTable() {
    const tbody = document.getElementById("topic-events-tbody");
    tbody.innerHTML = events.map(ev => {
      const volHtml = ev.volume_verified && ev.observed_volume_usd !== null
        ? `<span class="mono">${C.formatUsd(ev.observed_volume_usd)}</span>`
        : `<span class="unverified-cell">— (<a href="flagged-for-review.html">Unverified</a>)</span>`;
      const statusHtml = ev.status === "resolved"
        ? `<span class="badge badge-purple">Resolved</span> <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${C.escapeHtml(ev.resolution)}</div>`
        : `<span class="badge badge-green">Active</span> <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${C.escapeHtml(ev.expiration_note)}</div>`;
      return `
        <tr class="${ev.event_ticker === selectedTicker ? "selected-row" : ""}">
          <td>
            <div class="mono" style="font-weight:700;">${C.escapeHtml(ev.event_ticker)}</div>
            <div style="font-size:11.5px;color:var(--text-dim);">Series: ${C.escapeHtml(ev.series_ticker)}</div>
          </td>
          <td>${C.escapeHtml(ev.title)}</td>
          <td>${C.escapeHtml(ev.leading_outcome)}</td>
          <td class="num"><strong>${C.formatPrice(ev.livePrice)}</strong></td>
          <td class="num">${volHtml}</td>
          <td>${statusHtml}</td>
          <td style="white-space:nowrap;">
            <a href="${ev.kalshi_url}" target="_blank" rel="noopener">Kalshi ↗</a> ·
            <a href="${ev.catalyst_source.url}" target="_blank" rel="noopener">Source ↗</a>
          </td>
          <td style="white-space:nowrap;">
            <button class="btn btn-sm" onclick="window.selectTopicMarket('${ev.event_ticker}')">Chart</button>
            <button class="btn btn-sm btn-primary" onclick="window.buyTopicMarket('${ev.event_ticker}')">Demo Buy</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderChartAndBook() {
    const ev = getEv(selectedTicker);
    const pts = getSeries(ev, timeframe);
    const ob = C.buildOrderbookFromPrice(ev.livePrice, ev.seedOffset);

    document.getElementById("topic-chart-heading").textContent = `${ev.event_ticker} — ${ev.title}`;
    ["seconds", "minutes", "hours"].forEach(tf => {
      document.getElementById(`tf-${tf}`).classList.toggle("active-toggle", timeframe === tf);
    });

    C.drawPriceChart(
      document.getElementById("topic-chart-canvas"),
      pts,
      timeframe,
      document.getElementById("topic-chart-tooltip")
    );

    const jumps = pts.filter(p => p.jump).reverse();
    document.getElementById("topic-catalysts").innerHTML = jumps.map(p => `
      <div class="catalyst-item">
        <div>
          <span class="badge ${p.jump.delta >= 0 ? "badge-green" : "badge-red"} mono">${p.jump.delta >= 0 ? "+" : "-"}$${Math.abs(p.jump.delta).toFixed(2)}</span>
          <strong style="margin-left:6px;">${C.escapeHtml(p.jump.catalystTitle)}</strong>
        </div>
        <a href="${p.jump.catalystUrl}" target="_blank" rel="noopener">Verified Link ↗</a>
      </div>
    `).join("");

    document.getElementById("topic-orderbook").innerHTML = C.renderOrderbookHtml(ob, "noopOb");
  }

  function renderTopicAlerts() {
    const el = document.getElementById("topic-swing-feed");
    el.innerHTML = topicAlerts.map(a => `
      <div class="chat-msg ${a.isHighRoi ? "high-roi" : a.delta < 0 ? "down" : ""}">
        <div class="chat-meta">
          <strong class="mono">${C.escapeHtml(a.ticker)}</strong>
          <span class="badge ${a.delta >= 0 ? "badge-green" : "badge-red"} mono">${a.delta >= 0 ? "+" : "-"}$${Math.abs(a.delta).toFixed(2)}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);">
          ${C.formatPrice(a.prev)} → ${C.formatPrice(a.next)} · Score ${a.score}/100
          ${a.isHighRoi ? " · <strong class='pos'>HIGH-ROI MATCH</strong>" : ""}
        </div>
        <div class="chat-actions">
          <a href="${a.catalystUrl}" target="_blank" rel="noopener">Catalyst Source ↗</a>
          <a href="${a.kalshiUrl}" target="_blank" rel="noopener">Kalshi ↗</a>
        </div>
      </div>
    `).join("") || "<div class='card-subtitle'>Click 'Simulate >= $0.10 Swing' to test alerting on this topic.</div>";
  }

  function triggerTopicSwing() {
    const ev = getEv(selectedTicker);
    const prev = ev.livePrice;
    const dir = prev > 0.65 ? -1 : 1;
    const mag = Number((0.10 + Math.random() * 0.05).toFixed(2));
    const next = Number(Math.max(0.05, Math.min(0.95, prev + dir * mag)).toFixed(2));
    ev.livePrice = next;

    ["seconds", "minutes", "hours"].forEach(tf => {
      const pts = getSeries(ev, tf);
      pts.push({
        ts: Date.now(),
        price: next,
        jump: {
          delta: Number((next - prev).toFixed(2)),
          catalystTitle: `${ev.catalyst_source.name} (Simulated Demo Swing)`,
          catalystUrl: ev.catalyst_source.url
        }
      });
      if (pts.length > 42) pts.shift();
    });

    const ob = C.buildOrderbookFromPrice(next, ev.seedOffset);
    const sc = C.scoreSwingOpportunity(prev, next, ob.spread, ob.totalYesBidContracts);
    topicAlerts.unshift({
      ticker: ev.event_ticker,
      prev,
      next,
      delta: sc.delta,
      score: sc.score,
      isHighRoi: sc.isHighRoi,
      catalystUrl: ev.catalyst_source.url,
      kalshiUrl: ev.kalshi_url
    });
    renderTable();
    renderChartAndBook();
    renderTopicAlerts();
  }

  window.selectTopicMarket = function (ticker) {
    selectedTicker = ticker;
    renderTable();
    renderChartAndBook();
  };

  window.buyTopicMarket = function (ticker) {
    const ev = getEv(ticker);
    const price = Math.max(0.05, Math.min(0.95, ev.livePrice));
    const res = C.executeDemoTrade(portfolio, {
      ticker: ev.event_ticker,
      topic: topicSlug,
      title: `${ev.title} (${ev.leading_outcome})`,
      side: "YES",
      price,
      yesPrice: ev.livePrice,
      contracts: 25,
      strategy: `Topic Subpage (${topic.name})`,
      categoryTag: "Manual",
      sourceUrl: ev.kalshi_url
    });
    const statusEl = document.getElementById("topic-trade-status");
    statusEl.innerHTML = res.ok
      ? `<span class="pos">Bought 25 YES ${ev.event_ticker} @ ${C.formatPrice(price)} (${C.formatUsd(res.cost)}). <a href="portfolio-strategies.html">Track in Portfolio →</a></span>`
      : `<span class="neg">${C.escapeHtml(res.error)}</span>`;
  };

  ["seconds", "minutes", "hours"].forEach(tf => {
    document.getElementById(`tf-${tf}`).addEventListener("click", () => {
      timeframe = tf;
      renderChartAndBook();
    });
  });
  document.getElementById("btn-topic-swing").addEventListener("click", triggerTopicSwing);

  renderHeader();
  renderTable();
  renderChartAndBook();
  triggerTopicSwing();
  window.addEventListener("resize", renderChartAndBook);
})();
