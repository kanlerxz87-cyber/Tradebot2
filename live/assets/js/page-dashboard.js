'use strict';
(function () {
  const { qs, esc, dollar, compact, pct, centsLabel, topicById } = TB;
  TB.renderHeader('index.html'); TB.renderFooter();
  let chartPick = null, spanSeconds = 3600, interval = 1, timer = null;
  function renderKpis() {
    const s = TBData.state.stats;
    qs('#kpis').innerHTML = [TBUI.kpi('Live markets', compact(s.live), 'active at last read · selected cohort only'),
      TBUI.kpi('24h face notional*', dollar(s.vol24, 0), 'computed from reported contract face values; not cash flow'),
      TBUI.kpi('24h contracts', compact(s.contracts24), 'selected active contracts · not exchange total'),
      TBUI.kpi('Resolved', compact(s.resolved), 'confirmed YES/NO · includes dated sample')].join('');
    qs('#topics').innerHTML = s.byTopic.map(t => `<a class="topic-card" href="${TB.pageUrl('topics/' + t.id + '.html')}">
      <div class="ic">${t.icon}</div><div class="nm">${esc(t.name)}</div><div class="st">${t.live} selected active · ${t.events} events</div>
      <div class="sp">24h ${compact(t.contracts24)} contracts · ${t.resolved} results</div></a>`).join('');
  }
  function renderEvents() {
    const needle = qs('#evSearch').value.toLowerCase();
    const rows = TBData.rankEvents().rows.filter(r => r.state === 'LIVE' && (!needle || ((r.title || '') + r.eventTicker).toLowerCase().includes(needle)));
    const host = qs('#events'); host.replaceChildren();
    for (const topic of TB.TOPICS) {
      const group = document.createElement('section'); group.dataset.topic = topic.id;
      group.style.marginTop = '1rem';
      group.innerHTML = `<div class="spread"><h3>${topic.icon} ${esc(topic.name)}</h3><a href="${TB.pageUrl('topics/' + topic.id + '.html')}">All selected ${esc(topic.name.toLowerCase())} contracts →</a></div>`;
      const table = document.createElement('div'); group.appendChild(table);
      TBUI.eventsTable(table, rows.filter(r => r.topic === topic.id), { topic: false, limit: 10 });
      host.appendChild(group);
    }
  }
  function renderChats() {
    const all = TBData.alerts(), roi = TBUI.roiAlerts(all);
    TBUI.renderChat(qs('#chatAll'), all.slice(0, 60)); TBUI.renderChat(qs('#chatRoi'), roi.slice(0, 60), { showScore: true });
    qs('#allCount').textContent = all.length; qs('#roiCount').textContent = roi.length;
  }
  function fillChartPick() {
    const live = TBData.state.markets.filter(m => TB.isLive(m) && m.price !== null).sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    if (!live.some(m => m.ticker === chartPick)) chartPick = live[0] && live[0].ticker;
    qs('#chartPick').innerHTML = live.map(m => `<option value="${esc(m.ticker)}"${m.ticker === chartPick ? ' selected' : ''}>${esc(m.ticker)} — ${esc(m.title)}</option>`).join('');
  }
  async function drawChart() {
    const m = TBData.marketByTicker(chartPick);
    await TBView.price(qs('#dashChart'), m, spanSeconds, interval, qs('#dashChartMeta'));
    await TBView.ladder(qs('#dashLadder'), qs('#dashLiqMeta'), m, 8);
    TBUI.contextTable(qs('#moveContext'), m || { ticker: '', eventSettlementSources: [] });
  }
  function signed(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + dollar(v, 2); }
  function renderPaper() {
    const p = TBData.portfolio();
    qs('#paperMode').textContent = p.paper.auto ? 'automatic · paper only' : 'paper paused'; qs('#autoTradeChk').checked = !!p.paper.auto;
    qs('#paperKpis').innerHTML = [TBUI.kpi('Simulated equity', dollar(p.equity, 2), `cash ${dollar(p.cash, 2)} · ${p.unknownMarks} unverified marks`),
      TBUI.kpi('Total simulated P&L', signed(p.totalPnl), pct(p.totalReturn) + ' on assumed $10,000'),
      TBUI.kpi('Realized / unrealized', signed(p.realized) + ' / ' + signed(p.unrealized), `${p.closedCount} closed · ${p.openCount} open`),
      TBUI.kpi('Win rate', pct(p.winRate, 0), `${p.wins} wins · ${p.losses} losses`)].join('');
    qs('#paperOpen').innerHTML = !p.open.length ? '<div class="hint">No open paper positions. The four strategies run automatically on eligible fresh reads while a live page is open. No synthetic alerts or account orders are inserted.</div>' :
      `<div class="table-wrap"><table><thead><tr><th>Strategy</th><th>Market</th><th>Side</th><th>Qty</th><th>Entry</th><th>Bid mark</th><th>Simulated P&amp;L</th><th>Official price source</th></tr></thead><tbody>
      ${p.open.map(t => `<tr><td>${esc((TBData.strategyById(t.strategy) || {}).name || t.strategy)}</td><td>${esc(t.ticker)}</td><td>${esc(t.side.toUpperCase())}</td>
      <td>${t.qty}</td><td>${centsLabel(t.entryCents)}</td><td>${centsLabel(t.markCents)}</td><td>${signed(t.upnl)}</td><td class="src">${TBUI.marketSourceLinks(t)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderResolved() {
    const rows = TBData.state.markets.filter(m => /^(yes|no)$/.test(m.result)).sort((a, b) => Date.parse(b.settlementTs || b.closeTime || 0) - Date.parse(a.settlementTs || a.closeTime || 0)).slice(0, 10);
    TBUI.marketsTable(qs('#resolvedMini'), rows);
  }
  async function loadAll() {
    qs('#refreshBtn').disabled = true;
    try {
      await TBData.refresh(); TBUI.statusBar(qs('#statusbar'), TBData.state);
      TBUI.errorBox(qs('#errbox'), TBData.state.errors); TBUI.truncBox(qs('#truncbox'), TBData.state.truncated);
      renderKpis(); renderEvents(); renderChats(); fillChartPick(); renderPaper(); renderResolved(); await drawChart();
    } catch (e) { TBUI.errorBox(qs('#errbox'), [e.message]); }
    finally { qs('#refreshBtn').disabled = false; }
  }
  function schedule() {
    clearInterval(timer); const seconds = Number(qs('#pollSel').value) || 60;
    TB.saveSettings({ pollSeconds: seconds }); if (qs('#autoChk').checked) timer = setInterval(loadAll, seconds * 1000);
  }
  qs('#refreshBtn').onclick = loadAll;
  qs('#autoChk').onchange = schedule; qs('#pollSel').onchange = schedule;
  qs('#pollSel').value = String(TB.settings().pollSeconds); qs('#evSearch').oninput = renderEvents;
  qs('#chartPick').onchange = ev => { chartPick = ev.target.value; drawChart(); };
  qs('#chartSpan').onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#chartSpan').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    spanSeconds = Number(b.dataset.seconds); drawChart();
  };
  qs('#chartInterval').onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#chartInterval').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    interval = Number(b.dataset.iv); drawChart();
  };
  qs('#autoTradeChk').onchange = ev => { const p = TBData.paperState(); p.auto = ev.target.checked; TBData.savePaper(p); renderPaper(); };
  qs('#evCsv').onclick = () => TBUI.exportCsv('kalshi-selected-events.csv', TBData.rankEvents().rows, [
    { label: 'topic', key: 'topic' }, { label: 'event_ticker', key: 'eventTicker' }, { label: 'title', key: 'title' },
    { label: 'selected_contracts', key: 'marketCount' }, { label: '24h_contracts', key: 'contracts24' },
    { label: '24h_face_notional_usd_calculated', key: 'vol24' },
    { label: 'official_event_api', get: r => TB.api.url(`/events/${encodeURIComponent(r.eventTicker)}`) }
  ]);
  TBView.watch(() => chartPick, async () => { renderChats(); renderPaper(); await drawChart(); }, () => qs('#autoChk').checked);
  window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(drawChart, 200); });
  loadAll().then(schedule);
})();
