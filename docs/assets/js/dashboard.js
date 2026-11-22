/* ============================================================
 * Dashboard controller — wires data providers, engine, and UI.
 * ============================================================ */

(function () {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const fmt$ = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmt2 = (n) => '$' + Number(n || 0).toFixed(2);
  const fmtPct = (n) => (n || 0).toFixed(1) + '%';
  const timeAgo = (t) => {
    const d = Math.max(0, Date.now() - t);
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    return Math.floor(d / 3600) + 'h ago';
  };

  /* ---------- state ---------- */
  let mode = 'auto';          // auto | live | sim
  let winSec = 60;            // chart window in seconds
  let orderbookCache = { ticker: null, data: null, at: 0, isSim: true };
  let orderbookTimer = null;
  const liveResolvedIds = new Set(); // live resolutions we already recorded
  let lastRender = 0;

  /* ---------- mode control ---------- */
  let lastActualMode = null; // 'live' | 'sim' — last synced store mode

  function setMode(target) {
    mode = target;
    const btns = document.querySelectorAll('#modeControls [data-mode]');
    btns.forEach(b => b.classList.toggle('primary', b.dataset.mode === target));
    const hint = $('modeHint');
    if (hint) hint.textContent = target === 'auto' ? 'Auto: try live, fall back to simulated'
      : target === 'live' ? 'Live demo API only — will fall back to sim when unreachable'
      : 'Simulated mode — synthetic data, no network needed';
    start();
  }

  function start() {
    clearOrderbookTimer();
    LIVE.stop();
    liveResolvedIds.clear();
    lastActualMode = null;
    TRADER.reset();
    if (mode === 'sim') {
      resetStore();
      SIM.init();
      STORE.state.liveState = 'idle';
      setModeState('sim', 'Simulated mode — synthetic demo data', 'This session runs entirely on generated data so you can explore every feature. No Kalshi demo API was used.');
      lastActualMode = 'sim';
      renderAll();
    } else {
      resetStore();
      lastActualMode = null;
      STORE.state.liveState = 'connecting';
      STORE.notify();
      LIVE.start(5000, null);
      startOrderbookTimer();
      // watch for connection failure, then fall back
      setTimeout(() => {
        if (lastActualMode === null && STORE.state.liveState !== 'connected' && mode !== 'sim') {
          LIVE.stop();
          SIM.init();
          setModeState('sim', 'Live API unavailable — showing simulation', 'The Kalshi demo API could not be reached. Showing clearly-labeled simulated data instead.');
          lastActualMode = 'sim';
          renderAll();
        }
      }, 9000);
    }
  }

  function maybeTransitionLive() {
    if (mode === 'sim') return;
    const ls = STORE.state.liveState;
    if (ls === 'connected' && lastActualMode !== 'live') {
      lastActualMode = 'live';
      setModeState('live', 'Live demo API connected', 'Public market data from the Kalshi demo environment. Demo prices may not reflect real markets.');
      renderAll();
    } else if (ls === 'failed' && lastActualMode !== 'sim') {
      lastActualMode = 'sim';
      LIVE.stop();
      SIM.init();
      setModeState('sim', 'Live API unavailable — showing simulation', 'The Kalshi demo API could not be reached. Showing clearly-labeled simulated data instead.');
      renderAll();
    }
  }

  function resetStore() {
    STORE.state.markets = [];
    STORE.state.alerts = [];
    STORE.state.trades = [];
    STORE.state.resolved = [];
    STORE.state.totalAlerts = 0;
    STORE.state.totalTrades = 0;
    STORE.state.lastTradeId = 0;
    STORE.state.selectedId = null;
    STORE.state.history = {};
    liveResolvedIds.clear();
    TRADER.reset();
  }

  function setModeState(actual, title, body) {
    STORE.state.mode = actual;
    const badge = $('modeBadge'), txt = $('modeBadgeText');
    const banner = $('modeBanner'), bTitle = $('modeBannerTitle'), bBody = $('modeBannerBody');
    if (actual === 'live') {
      badge.classList.add('is-live'); txt.textContent = 'LIVE DEMO';
      banner.style.display = 'block';
      banner.className = 'banner live';
      bTitle.textContent = 'Live demo API connected';
      bBody.textContent = body || 'Public market data from the Kalshi demo environment. Demo prices may not reflect real markets.';
    } else {
      badge.classList.remove('is-live'); txt.textContent = 'SIMULATED';
      banner.style.display = 'block';
      banner.className = 'banner warn';
      bTitle.textContent = title; bBody.textContent = body;
    }
  }

  function currentModeLabel() {
    return STORE.state.mode === 'live' ? 'LIVE (demo)' : 'SIMULATED';
  }

  /* ---------- sim/live dispatch ---------- */
  function tickOnce() {
    const now = Date.now();
    if (STORE.state.mode === 'live') {
      // ensure selected market still exists
      ensureSelection();
      // detect live resolutions
      for (const m of STORE.state.markets) {
        if (m.status === 'settled' && !liveResolvedIds.has(m.id)) {
          liveResolvedIds.add(m.id);
          STORE.addResolution({
            id: m.id, ticker: m.ticker, title: m.title, topic: m.topic,
            resolution: m.resolution === 'pending' ? 'pending' : m.resolution,
            settledAt: now, volume: m.volume, isSim: false, native: m.native,
          });
          STORE.addAlert({
            id: 'ALERT_SETTLE_' + m.id, t: now, type: 'resolved',
            marketId: m.id, topic: m.topic, ticker: m.ticker, title: m.title,
            magnitude: 0, dir: 0, headline: 'Market settled',
            source: 'live', isSim: false, score: 0, verdict: '—', roiFlag: false,
          });
        }
      }
    } else {
      simEngineTick();
      ensureSelection();
    }
    // alerts engine — fires on swings for all markets
    ALERT_ENGINE.evaluateAll();
    TRADER.onTick();
    render(now);
  }

  function ensureSelection() {
    const current = STORE.state.markets.find(m => m.id === STORE.state.selectedId);
    if (current && current.status !== 'settled') return;
    const ranked = [...STORE.state.markets].filter(m => m.status !== 'settled').sort((a, b) => (b.volume || 0) - (a.volume || 0));
    STORE.state.selectedId = ranked[0] ? ranked[0].id : null;
  }

  function clearOrderbookTimer() {
    if (orderbookTimer) { clearInterval(orderbookTimer); orderbookTimer = null; }
  }

  function maybeFetchOrderbookNow() {
    const m = STORE.state.markets.find(x => x.id === STORE.state.selectedId);
    if (!m || m.isSim) return;
    if (orderbookCache.ticker === m.ticker && Date.now() - orderbookCache.at < 4500) return;
    LIVE.fetchOrderbook(m.ticker || m.native.ticker).then(data => {
      orderbookCache = { ticker: m.ticker, data, at: Date.now(), isSim: false };
      renderDepth();
    }).catch(() => {
      orderbookCache = { ticker: m.ticker, data: null, at: Date.now(), isSim: false };
    });
  }

  function startOrderbookTimer() {
    clearOrderbookTimer();
    orderbookTimer = setInterval(maybeFetchOrderbookNow, 5000);
  }

  /* ---------- render ---------- */
  function render(now) {
    renderStats();
    renderEventList();
    renderChart();
    renderDepth();
    renderChats();
    renderStrategyTable();
    renderTopicBreakdown();
    renderResolutions();
    renderPortfolio();
    renderBadge();
  }

  function renderBadge() {
    const badge = $('modeBadge');
    const txt = $('modeBadgeText');
    const live = STORE.state.mode === 'live';
    txt.textContent = live ? 'LIVE DEMO' : 'SIMULATED';
    badge.classList.toggle('is-live', live);
  }

  function renderStats() {
    const markets = STORE.state.markets;
    const open = markets.filter(m => m.status !== 'settled');
    const totalVol = markets.reduce((s, m) => s + (m.volume || 0), 0);
    const alerts = STORE.state.totalAlerts;
    const pf = PORTFOLIO.compute();
    const netPnl = pf.realizedPnl;

    const cards = [
      { label: 'Tracked markets', value: String(markets.length), meta: open.length + ' open · ' + (markets.length - open.length) + ' settled' },
      { label: 'Combined volume', value: fmt$(totalVol), meta: 'across ' + markets.length + ' events' },
      { label: 'Swing alerts', value: String(alerts), meta: '≥ $0.10 moves' },
      { label: 'Net P&L (sim)', value: (netPnl >= 0 ? '+' : '') + fmt2(netPnl), meta: pf.closedTrades + ' closed trades', cls: netPnl >= 0 ? 'pos' : 'neg' },
    ];
    $('statGrid').innerHTML = cards.map(c => `
      <div class="stat">
        <div class="label">${c.label}</div>
        <div class="value ${c.cls || ''}">${c.value}</div>
        <div class="meta">${c.meta}</div>
      </div>`).join('');
  }

  function renderEventList() {
    const ranked = [...STORE.state.markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
    $('eventCount').textContent = String(ranked.length);
    const el = $('eventList');
    el.innerHTML = ranked.map(m => {
      const topic = TOPIC_MAP[m.topic];
      const active = m.id === STORE.state.selectedId;
      const delta = m.price - (m.prevPrice != null ? m.prevPrice : m.price);
      const dirCls = delta > 0.001 ? 'up' : delta < -0.001 ? 'down' : 'flat';
      const settled = m.status === 'settled';
      const selCls = active ? 'selected' : '';
      return `
        <div class="event-row ${selCls}" data-id="${m.id}">
          <div class="er-top">
            <div class="er-ticker">${esc(m.ticker)}</div>
            <span class="chip" style="border-color:${topic.color}55;color:${topic.color};background:${topic.color}18;">${topic.short}</span>
          </div>
          <div class="er-title">${esc(m.title)}</div>
          <div class="er-bottom">
            <span class="er-vol">${fmt$(m.volume)} vol · ${timeAgo(m.startedAt)}</span>
            <span class="price-pill ${settled ? 'flat' : dirCls}">${settled ? (m.resolution || 'settled').toUpperCase() : '$' + m.price.toFixed(2)}</span>
          </div>
        </div>`;
    }).join('');
    el.querySelectorAll('.event-row').forEach(row => {
      row.addEventListener('click', () => {
        STORE.state.selectedId = row.dataset.id;
        renderAll();
      });
    });
  }

  function renderChart() {
    const m = STORE.state.markets.find(x => x.id === STORE.state.selectedId);
    const canvas = $('priceChart');
    const win = WINDOW_PRESETS.find(w => w.sec === winSec) || WINDOW_PRESETS[1];
    $('chartTitle').textContent = m ? m.title : 'No event selected';
    $('chartSub').textContent = m ? `${m.ticker} · ${m.resolution !== 'pending' ? 'settled ' + m.resolution.toUpperCase() : (m.status === 'closed' ? 'closed' : 'live')} · ${currentModeLabel()}` : '—';
    $('winSwitch').innerHTML = WINDOW_PRESETS.map(w => `<button class="${w.sec === winSec ? 'active' : ''}" data-sec="${w.sec}">${w.label}</button>`).join('');
    $('winSwitch').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => { winSec = Number(btn.dataset.sec); renderChart(); });
    });
    if (!m) { PriceChart.draw(canvas, [], { windowSec: winSec, annotations: [] }); $('chartFoot').innerHTML = ''; return; }
    const now = Date.now();
    const start = now - winSec * 1000;
    const alerts = STORE.state.alerts.filter(a => a.marketId === m.id && a.type === 'swing' && a.t >= start && a.t <= now)
      .map(a => ({ t: a.t, price: priceAtTime(m, a.t), dir: a.dir, mag: a.magnitude }));
    PriceChart.draw(canvas, m.history, { windowSec: winSec, annotations: alerts });
    const delta = m.price - (m.anchorPrice || m.price);
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '▬';
    $('chartFoot').innerHTML = `
      <span>Price <b class="mono">$${m.price.toFixed(2)}</b></span>
      <span>Change vs anchor <b class="mono ${delta >= 0 ? 'good' : 'bad'}">${arrow} ${Math.abs(delta).toFixed(2)}</b></span>
      <span>Liquidity <b class="mono">${m.liquidity ? fmt$(m.liquidity) : '—'}</b></span>
      <span>Spread <b class="mono">$${(m.spread || 0).toFixed(2)}</b></span>
      <span>Volume <b class="mono">${fmt$(m.volume)}</b></span>`;
  }

  function priceAtTime(market, t) {
    let best = market.price;
    for (const p of market.history) {
      if (p.t <= t) best = p.price;
      else break;
    }
    return best;
  }

  function renderDepth() {
    const m = STORE.state.markets.find(x => x.id === STORE.state.selectedId);
    const grid = $('depthGrid');
    if (!m) { grid.innerHTML = ''; return; }
    const liveSource = !m.isSim && orderbookCache.ticker === m.ticker && orderbookCache.data;
    DepthPanel.render(grid, m, liveSource ? orderbookCache.data : null);
  }

  function renderChats() {
    const allChat = $('allChat'), roiChat = $('roiChat');
    const wasAtBottomAll = allChat.scrollHeight - allChat.scrollTop - allChat.clientHeight < 24;
    const wasAtBottomRoi = roiChat.scrollHeight - roiChat.scrollTop - roiChat.clientHeight < 24;

    const all = STORE.state.alerts.slice(0, 250).reverse();
    allChat.innerHTML = all.map(chatMessage).join('');
    $('allAlertCount').textContent = String(STORE.state.totalAlerts);
    if (wasAtBottomAll) allChat.scrollTop = allChat.scrollHeight;

    const roi = STORE.state.alerts.filter(a => a.roiFlag).slice(0, 250).reverse();
    roiChat.innerHTML = roi.length
      ? roi.map(chatMessageRoi).join('')
      : '<div class="sub" style="color:var(--faint); padding:8px 0; font-size:13px;">No high-ROI signals yet. Watch the model scores as swings fire.</div>';
    $('roiAlertCount').textContent = String(STORE.state.alerts.filter(a => a.roiFlag).length);
    if (wasAtBottomRoi) roiChat.scrollTop = roiChat.scrollHeight;
  }

  function chatMessage(a) {
    if (a.type === 'resolved') {
      return `<div class="chat-msg resolve">
        <div class="msg-time">${timeAgo(a.t)} · ${TOPIC_MAP[a.topic] ? TOPIC_MAP[a.topic].name : a.topic}</div>
        <div class="msg-title">✓ ${esc(a.title)}</div>
        <div class="msg-body">Resolved · ${a.isSim ? 'SIMULATED' : 'DEMO'} market settled</div>
      </div>`;
    }
    const dirLabel = a.dir > 0 ? '▲ UP' : '▼ DOWN';
    const cls = a.dir > 0 ? 'up' : 'down';
    return `<div class="chat-msg ${cls}">
      <div class="msg-time">${timeAgo(a.t)} · ${TOPIC_MAP[a.topic] ? TOPIC_MAP[a.topic].name : a.topic} · ${esc(a.ticker)}</div>
      <div class="msg-title">${dirLabel} $${a.magnitude.toFixed(2)} · ${esc(short(a.title))}</div>
      <div class="msg-body">${esc(a.headline || '')}</div>
    </div>`;
  }

  function chatMessageRoi(a) {
    return `<div class="chat-msg roi">
      <div class="msg-time">${timeAgo(a.t)} · SCORE ${a.score} · ${a.verdict}</div>
      <div class="msg-title">${a.dir > 0 ? '▲' : '▼'} $${a.magnitude.toFixed(2)} ${esc(short(a.title))}</div>
      <div class="msg-body">${esc(a.headline || '')}</div>
    </div>`;
  }

  function short(title) {
    if (!title) return '';
    return title.length > 64 ? title.slice(0, 64) + '…' : title;
  }

  function renderStrategyTable() {
    const rows = $('strategyRows');
    const pf = PORTFOLIO.compute();
    rows.innerHTML = TT_STRATEGIES().map(strat => {
      const d = pf.byStrategy[strat.id] || { trades: 0, wins: 0, losses: 0, pnl: 0 };
      const winRate = d.trades ? (d.wins / (d.wins + d.losses) * 100) : 0;
      return `<tr>
        <td class="strong">${strat.name}</td>
        <td class="mono" style="font-size:11px; color:var(--muted);">${strat.rules}</td>
        <td class="num">${d.trades}</td>
        <td class="num good">${d.wins}</td>
        <td class="num bad">${d.losses}</td>
        <td class="num">${winRate ? fmtPct(winRate) : '—'}</td>
        <td class="num ${d.pnl >= 0 ? 'good' : 'bad'}">${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(2)}</td>
        <td><span class="chip amber">SIMULATED</span></td>
      </tr>`;
    }).join('');
  }

  function TT_STRATEGIES() { return TRADER.STRATEGIES; }

  function renderTopicBreakdown() {
    const pf = PORTFOLIO.compute();
    const el = $('topicRows');
    if (!el) return;
    const topics = TOPICS.filter(t => pf.byTopic[t.id] || true);
    el.innerHTML = topics.map(t => {
      const d = pf.byTopic[t.id] || { topic: t.id, trades: 0, wins: 0, pnl: 0 };
      return `<tr>
        <td><span class="chip" style="border-color:${t.color}55;color:${t.color};background:${t.color}18;">${t.name}</span></td>
        <td class="num">${d.trades}</td>
        <td class="num good">${d.wins}</td>
        <td class="num ${d.pnl >= 0 ? 'good' : 'bad'}">${d.pnl >= 0 ? '+' : ''}${fmt2(d.pnl)}</td>
      </tr>`;
    }).join('');
  }

  function renderResolutions() {
    const el = $('resolvedFeed');
    const resolutions = STORE.state.resolved.slice(0, 30);
    if (!resolutions.length) {
      el.innerHTML = '<div class="sub" style="color:var(--faint); padding:8px 0;">No resolutions yet — markets settle as they expire.</div>';
      return;
    }
    el.innerHTML = resolutions.map(r => {
      const yes = r.resolution === 'yes';
      const no = r.resolution === 'no';
      return `<div class="res-item">
        <div>
          <div class="r">${esc(r.title)} <span class="chip ${yes ? 'green' : no ? 'red' : 'blue'}" style="margin-left:6px;">${yes ? 'YES' : no ? 'NO' : 'PENDING'}</span></div>
          <div class="sub" style="color:var(--muted); font-size:12px; margin-top:2px;">${esc(r.ticker)} · ${timeAgo(r.settledAt)} · vol ${fmt$(r.volume)} · ${r.isSim ? 'SIMULATED' : 'DEMO'}</div>
        </div>
        <span class="price-pill flat">${TOPIC_MAP[r.topic] ? TOPIC_MAP[r.topic].short : r.topic}</span>
      </div>`;
    }).join('');
  }

  function renderPortfolio() {
    const pf = PORTFOLIO.compute();
    const rows = $('portfolioRows');
    const startCash = CONFIG.STARTING_CASH;
    rows.innerHTML = `
      <tr><th>Starting cash</th><td><b>${fmt$(startCash)}</b></td></tr>
      <tr><th>Realized P&amp;L (closed trades)</th><td><b class="${pf.realizedPnl >= 0 ? 'good' : 'bad'}">${pf.realizedPnl >= 0 ? '+' : ''}${fmt2(pf.realizedPnl)}</b> · ${pf.closedTrades} closed</td></tr>
      <tr><th>Open positions</th><td><b>${pf.openCount}</b> · ${fmt$(pf.exposure)} exposure</td></tr>
      <tr><th>Win rate</th><td><b>${pf.closedTrades ? fmtPct(pf.winRate) : '—'}</b> · ${pf.wins}W / ${pf.losses}L</td></tr>
      <tr><th>Net equity (sim)</th><td><b class="${pf.equity >= startCash ? 'good' : 'bad'}">${fmt$(pf.equity)}</b></td></tr>
      <tr><th>Cash available (after exposure)</th><td><b>${fmt$(pf.cash)}</b></td></tr>`;
    $('startCash').textContent = fmt$(startCash);
  }

  function renderAll() { render(Date.now()); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- boot ---------- */
  setMode('auto');

  document.getElementById('modeControls').addEventListener('click', e => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    setMode(btn.dataset.mode);
  });

  setInterval(() => tickOnce(), 1000);
  window.addEventListener('resize', () => renderChart());
  // watch live state transitions -> sync mode badge/banner
  STORE.subscribe(() => maybeTransitionLive());
  render(Date.now());
})();
