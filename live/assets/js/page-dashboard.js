/* =============================================================================
   Dashboard page controller
   ============================================================================= */
'use strict';
(function () {
  const { qs, esc, dollar, compact, cents, centsLabel, pct, TOPICS, topicById, api, el } = TB;
  TB.renderHeader('index.html');
  TB.renderFooter();

  let chartPick = null;
  let chartSpanMin = 60;
  let chartIv = 1;
  let timer = null;
  let candlesCache = new Map();

  /* ---------------------------------------------------------------- renderers */
  function renderKpis(stats) {
    const host = qs('#kpis');
    const s = stats;
    host.innerHTML = [
      TBUI.kpi('Live markets', s.live.toLocaleString(), `${s.events} events in scope`),
      TBUI.kpi('Notional traded', dollar(s.notional, 0), 'live markets · contracts × $1'),
      TBUI.kpi('24h notional', dollar(s.vol24, 0), 'sum of volume_24h_fp'),
      TBUI.kpi('Resolved', s.resolved.toLocaleString(), `${s.settled} finalized · rest determined/closed`)
    ].join('');
  }

  function renderTopics(stats) {
    const host = qs('#topics');
    host.innerHTML = stats.byTopic.map(t => `
      <a class="topic-card" href="topics/${t.id}.html">
        <div class="ic">${t.icon}</div>
        <div class="nm">${esc(t.name)}</div>
        <div class="st">${t.live} live markets · ${t.events} events · ${t.resolved} resolved</div>
        <div class="sp">${dollar(t.notional, 0)} traded · 24h ${dollar(t.vol24, 0)}</div>
      </a>`).join('');
  }

  function renderEvents(filter) {
    const { rows } = TBData.rankEvents();
    const needle = (filter || '').toLowerCase();
    const shown = needle
      ? rows.filter(r => (r.title || '').toLowerCase().includes(needle) || (r.eventTicker || '').toLowerCase().includes(needle))
      : rows;
    const live = shown.filter(r => r.state === 'LIVE');
    const liveRows = live.slice(0, 30);
    const resolved = shown.filter(r => r.state === 'RESOLVED').slice(0, 10);
    const host = qs('#events');
    if (!shown.length) { host.innerHTML = '<div class="t-blank" style="padding:.8rem">No events match.</div>'; return; }
    host.innerHTML =
      (liveRows.length ? `<h3 style="margin-top:.2rem">Live now <span class="tag">${live.length}</span></h3>` : '') +
      (liveRows.length ? '<div id="evLive"></div>' : '') +
      (resolved.length ? `<h3 style="margin-top:1rem">Recently resolved</h3><div id="evResolved"></div>` : '');
    if (liveRows.length) TBUI.eventsTable(qs('#evLive'), liveRows, { limit: liveRows.length });
    if (resolved.length) TBUI.eventsTable(qs('#evResolved'), resolved, { limit: resolved.length });
  }

  function renderChats() {
    const all = TBData.alerts();
    const roi = TBUI.roiAlerts(all);
    TBUI.renderChat(qs('#chatAll'), all.slice(0, 60), {
      empty: 'No ≥$0.10 moves recorded yet in this browser. The first refresh only stores a baseline; swings appear from the second refresh onward.'
    });
    TBUI.renderChat(qs('#chatRoi'), roi.slice(0, 60), {
      showScore: true,
      empty: 'Nothing passes the high-ROI screen yet. Empty is a real result — tight spreads and enough edge after fees are required.'
    });
    qs('#allCount').textContent = all.length;
    qs('#roiCount').textContent = roi.length;
  }

  function renderResolvedMini() {
    const rows = TBData.state.markets
      .filter(m => m.result === 'yes' || m.result === 'no')
      .sort((a, b) => new Date(b.settlementTs || b.closeTime || 0) - new Date(a.settlementTs || a.closeTime || 0))
      .slice(0, 12);
    const host = qs('#resolvedMini');
    if (!rows.length) { host.innerHTML = '<div class="t-blank" style="padding:.8rem">No resolved markets in the current window.</div>'; return; }
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Topic</th><th>Market</th><th>Result</th><th>Settled</th><th>Sources</th></tr></thead><tbody>
      ${rows.map(m => {
        const t = topicById(m.topic);
        return `<tr><td>${t ? t.icon + ' ' + esc(t.name) : '—'}</td>
          <td><span class="t">${esc(m.title)}</span><div class="s mono">${esc(m.ticker)}</div></td>
          <td>${TBUI.statusPill(m)}</td>
          <td>${m.settlementTs ? TB.dateShort(m.settlementTs) : '<span class="t-blank">—</span>'}</td>
          <td class="src"><a href="${esc(api.url(`/markets/${encodeURIComponent(m.ticker)}`))}" target="_blank" rel="noopener">market API</a></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  /* ------------------------------------------------------------------- chart */
  function fillChartPick() {
    const sel = qs('#chartPick');
    const live = TBData.state.markets.filter(m => TB.isLive(m) && m.price !== null)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0)).slice(0, 120);
    const keep = chartPick || (live[0] && live[0].ticker);
    sel.innerHTML = live.map(m => `<option value="${esc(m.ticker)}"${m.ticker === keep ? ' selected' : ''}>${esc(m.ticker)} — ${esc((m.title || '').slice(0, 44))}</option>`).join('');
    chartPick = keep;
  }

  async function drawChart() {
    const canvas = qs('#dashChart');
    if (!chartPick) { TBChart.empty(canvas, 'No live market with a price available.'); return; }
    const m = TBData.marketByTicker(chartPick);
    const hist = TBData.historyFor(chartPick);
    const now = Math.floor(Date.now() / 1000);
    const start = now - chartSpanMin * 60;
    const key = `${chartPick}|${chartIv}|${start}`;
    let candles = candlesCache.get(key);
    if (!candles) {
      try {
        const r = await api.candlesticks(m.seriesTicker, chartPick, chartIv, start, now);
        candles = (r.candlesticks || []).map(c => ({
          t: c.end_period_ts * 1000,
          p: c.price && c.price.close_dollars != null ? cents(c.price.close_dollars) : null,
          v: c.volume_fp != null ? Number(c.volume_fp) : null
        })).filter(c => c.p !== null);
        candlesCache.set(key, candles);
      } catch (e) { candles = []; }
      if (candlesCache.size > 40) candlesCache.clear();
    }
    /* merge observed snapshots (they are finer than 1-minute candles) */
    let pts = candles.slice();
    for (const h of hist) if (h.t >= start * 1000) pts.push({ t: h.t, p: h.p });
    pts.sort((a, b) => a.t - b.t);
    /* de-dup identical timestamps, keep last */
    const dedup = [];
    for (const p of pts) {
      if (dedup.length && Math.abs(dedup[dedup.length - 1].t - p.t) < 500) dedup[dedup.length - 1] = p;
      else dedup.push(p);
    }
    pts = dedup;
    if (m && m.price !== null && pts.length) {
      const lastP = cents(m.price);
      if (pts[pts.length - 1].p !== lastP) pts.push({ t: Date.now(), p: lastP });
    }
    const markers = TBData.alerts().filter(a => a.ticker === chartPick && a.at >= start * 1000).map(a => ({ t: a.at, delta: a.delta }));
    const label = (m ? m.ticker + ' · ' : '') + (chartIv === 1 ? '1-min candles' : chartIv === 60 ? '1-hour candles' : '1-day candles');
    TBChart.line(canvas, { points: pts, markers, showVolume: true, label });
    if (m) drawLadder(m);
  }

  async function drawLadder(m) {
    const host = qs('#dashLadder');
    const meta = qs('#dashLiqMeta');
    meta.innerHTML = `<span class="mono">${esc(m.ticker)}</span> — loading order book…`;
    try {
      const ob = await api.orderbook(m.ticker, 10);
      TBChart.ladder(host, ob, { levels: 8, yesBid: m.yesBid, yesAsk: m.yesAsk });
      const liq = TBChart.liquidity(ob, m.yesBid, m.yesAsk);
      meta.innerHTML = liq
        ? `Resting: <b>${compact(liq.bidContracts)}</b> contracts bid across ${liq.bidLevels} levels · <b>${compact(liq.askContracts)}</b> offered across ${liq.askLevels} levels.
           Source: <a href="${esc(api.url(`/markets/${encodeURIComponent(m.ticker)}/orderbook`, { depth: 10 }))}" target="_blank" rel="noopener">GET /markets/${esc(m.ticker)}/orderbook?depth=10</a>
           · quantites are contracts, prices in cents.`
        : 'Order book unavailable for this market.';
    } catch (e) {
      host.innerHTML = `<div class="t-blank">Order book request failed: ${esc(e.message)}</div>`;
      meta.innerHTML = '';
    }
  }

  /* ------------------------------------------------------------------- paper */
  function renderPaper() {
    const p = TBData.portfolio();
    qs('#paperMode').textContent = p.paper.auto ? 'auto-trading on' : 'manual';
    const chk = qs('#autoTradeChk'); if (chk) chk.checked = !!p.paper.auto;
    qs('#paperKpis').innerHTML = [
      TBUI.kpi('Simulated equity', dollar(p.equity, 2), `cash ${dollar(p.cash, 2)} + open ${dollar(p.openValue, 2)}`),
      TBUI.kpi('Total P&L', (p.totalPnl >= 0 ? '+' : '') + dollar(p.totalPnl, 2), pct(p.totalReturn, 2) + ' on $10,000', p.totalPnl >= 0 ? 'up' : 'down'),
      TBUI.kpi('Realized / unrealized', `${p.realized >= 0 ? '+' : ''}${dollar(p.realized, 2)} / ${p.unrealized >= 0 ? '+' : ''}${dollar(p.unrealized, 2)}`, `${p.closedCount} closed · ${p.openCount} open`),
      TBUI.kpi('Win rate', p.winRate == null ? '—' : pct(p.winRate, 0), `${p.wins}W / ${p.losses}L`)
    ].join('');
    const host = qs('#paperOpen');
    if (!p.open.length) {
      host.innerHTML = `<div class="banner info">No open simulated positions. Turn on <b>auto-trade</b> (or press “Insert demo alert”) to let the four strategies open paper trades on new ≥$0.10 moves; results appear on the <a href="portfolio.html">portfolio page</a>.</div>`;
      return;
    }
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Strategy</th><th>Market</th><th>Side</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Mark</th><th class="num">P&amp;L</th></tr></thead><tbody>
      ${p.open.map(t => `<tr><td>${esc((TBData.strategyById(t.strategy) || {}).name || t.strategy)}</td>
        <td><span class="t">${esc(t.title || t.ticker)}</span><div class="s mono">${esc(t.ticker)}</div></td>
        <td>${esc(t.side.toUpperCase())}</td><td class="num">${t.qty}</td>
        <td class="num">${centsLabel(t.entryCents)}</td><td class="num">${t.markCents != null ? centsLabel(t.markCents) : '—'}</td>
        <td class="num" style="color:${(t.upnl || 0) >= 0 ? 'var(--up)' : 'var(--down)'}">${(t.upnl || 0) >= 0 ? '+' : ''}${dollar(t.upnl, 2)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  /* ------------------------------------------------------------------- boot */
  async function loadAll(first) {
    const btn = qs('#refreshBtn');
    if (btn) btn.disabled = true;
    const statusHost = qs('#statusbar');
    statusHost.innerHTML = '<span class="pill snap">loading…</span>';
    try {
      const res = await TBData.refresh({ events: { maxPages: 6 } });
      TBUI.errorBox(qs('#errbox'), TBData.state.errors);
      TBUI.truncBox(qs('#truncbox'), TBData.state.truncated);
      TBUI.statusBar(statusHost, TBData.state);
      renderKpis(TBData.state.stats);
      renderTopics(TBData.state.stats);
      renderEvents(qs('#evSearch') ? qs('#evSearch').value : '');
      /* alerts: detect first, then if auto mode, trade and re-detect */
      if (TBData.paperState().auto) { TBData.autoTrade(res.swings); TBData.carryScan(); }
      renderChats();
      fillChartPick();
      await drawChart();
      renderPaper();
      renderResolvedMini();
    } catch (e) {
      statusHost.innerHTML = `<span class="pill down">error</span>`;
      TBUI.errorBox(qs('#errbox'), [e.message]);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function schedule() {
    clearInterval(timer);
    const secs = Number(qs('#pollSel').value) || 60;
    TB.saveSettings({ pollSeconds: secs });
    const chk = qs('#autoChk');
    if (chk && chk.checked) timer = setInterval(() => loadAll(false), secs * 1000);
  }

  function bind() {
    qs('#refreshBtn').addEventListener('click', () => loadAll(false));
    qs('#autoChk').addEventListener('change', schedule);
    qs('#pollSel').addEventListener('change', schedule);
    qs('#pollSel').value = String(TB.settings().pollSeconds || 60);
    qs('#evSearch').addEventListener('input', ev => renderEvents(ev.target.value));
    qs('#evCsv').addEventListener('click', () => {
      const { rows } = TBData.rankEvents();
      TBUI.exportCsv('kalshi-live-events.csv', rows, [
        { label: 'topic', get: r => r.topic }, { label: 'event_ticker', get: r => r.eventTicker },
        { label: 'title', get: r => r.title }, { label: 'markets', get: r => r.marketCount },
        { label: 'live_markets', get: r => r.liveCount }, { label: 'state', get: r => r.state },
        { label: 'notional_usd', get: r => Math.round(r.notionalTotal) },
        { label: 'notional_24h_usd', get: r => Math.round(r.vol24) },
        { label: 'event_api', get: r => api.url('/events', { tickers: r.eventTicker, with_nested_markets: 'true' }) }
      ]);
    });
    qs('#chartPick').addEventListener('change', ev => { chartPick = ev.target.value; drawChart(); });
    qs('#chartSpan').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      [...qs('#chartSpan').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      chartSpanMin = Number(b.dataset.min); drawChart();
    });
    qs('#chartInterval').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      [...qs('#chartInterval').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      chartIv = Number(b.dataset.iv); drawChart();
    });
    qs('#autoTradeChk').addEventListener('change', ev => {
      const p = TBData.paperState(); p.auto = ev.target.checked; TBData.savePaper(p);
      renderPaper();
      if (p.auto) { TBData.carryScan(); renderPaper(); }
    });
    qs('#testAlert').addEventListener('click', () => {
      /* A clearly-labelled synthetic alert so the chat mechanics are visible
         before real moves accumulate. It is stored with demo:true and marked. */
      const m = TBData.state.markets.find(x => x.status === 'active' && x.price !== null && x.volume24h > 0)
        || TBData.state.markets.find(x => x.price !== null);
      if (!m) return;
      const from = Math.max(1, TB.cents(m.price) - 12);
      const a = {
        id: 'DEMO-' + Date.now(), at: Date.now(), fromTs: Date.now() - 60000, demo: true,
        ticker: m.ticker, topic: m.topic, title: '[DEMO — synthetic, not a live move] ' + m.title,
        eventTicker: m.eventTicker, seriesTicker: m.seriesTicker,
        from, to: TB.cents(m.price), delta: TB.cents(m.price) - from,
        bid: m.yesBid === null ? null : TB.cents(m.yesBid), ask: m.yesAsk === null ? null : TB.cents(m.yesAsk),
        spread: m.spread, volume24h: m.volume24h, oi: m.oi, priceKind: m.priceKind,
        score: TBData.scoreCandidate(m, TB.cents(m.price) - from)
      };
      const all = [a].concat(TBData.alerts());
      TBData.saveAlerts(all);
      renderChats();
    });
  }

  window.addEventListener('resize', (() => {
    let t; return () => { clearTimeout(t); t = setTimeout(() => drawChart(), 200); };
  })());

  TB.renderHeader('index.html');
  bind();
  loadAll(true).then(schedule);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadAll(false);
  });
})();
