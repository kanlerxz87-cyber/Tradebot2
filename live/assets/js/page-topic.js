/* =============================================================================
   Topic page — one of gas / elections / culture / crypto / golf
   ============================================================================= */
'use strict';
(function () {
  const { qs, esc, dollar, compact, TOPICS, topicById, api, cents, centsLabel } = TB;
  const topicId = document.body.dataset.topic;
  const topic = topicById(topicId);
  TB.renderHeader(`topics/${topicId}.html`);
  TB.renderFooter();

  let statusFilter = 'live';
  let searchText = '';

  function meta() { return TBData.state.markets.filter(m => m.topic === topicId); }

  function renderKpis() {
    const mk = meta();
    const live = mk.filter(TB.isLive);
    const resolved = mk.filter(m => m.result === 'yes' || m.result === 'no');
    const summary = TBData.computeStats().byTopic.find(t => t.id === topicId);
    qs('#kpis').innerHTML = [
      TBUI.kpi('Live markets', String(live.length), `${new Set(mk.map(m => m.eventTicker)).size} events`),
      TBUI.kpi('Notional traded', dollar(summary.notional, 0), 'calculated from reported face values; not cash traded'),
      TBUI.kpi('24h notional', dollar(summary.vol24, 0), 'missing face values stay blank'),
      TBUI.kpi('Resolved', String(resolved.length), 'YES/NO results from the API')
    ].join('');
  }

  function renderEvents() {
    const { rows } = TBData.rankEvents();
    const rowsT = rows.filter(r => r.topic === topicId);
    qs('#events').innerHTML = '';
    if (!rowsT.length) { qs('#events').innerHTML = '<div class="t-blank" style="padding:.8rem">The demo exchange returned no events for this topic in the scanned window.</div>'; return; }
    TBUI.eventsTable(qs('#events'), rowsT, { topic: false, limit: 40 });
  }

  function filtered() {
    let rows = meta();
    if (statusFilter === 'live') rows = rows.filter(TB.isLive);
    else if (statusFilter === 'closed') rows = rows.filter(TB.isClosed);
    else if (statusFilter === 'resolved') rows = rows.filter(m => m.result === 'yes' || m.result === 'no');
    if (searchText) {
      const n = searchText.toLowerCase();
      rows = rows.filter(m => (m.title || '').toLowerCase().includes(n) || (m.ticker || '').toLowerCase().includes(n) || (m.eventTitle || '').toLowerCase().includes(n));
    }
    return rows.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0) || (b.volume || 0) - (a.volume || 0));
  }

  function renderMarkets() {
    const rows = filtered();
    TBUI.marketsTable(qs('#markets'), rows, {
      topic: false,
      actions: m => `<a class="btn" href="../market.html?ticker=${encodeURIComponent(m.ticker)}&series=${encodeURIComponent(m.seriesTicker)}">chart</a>`
    });
  }

  function renderSeries() {
    const list = (TBData.state.seriesByTopic[topicId] || []);
    const host = qs('#series');
    if (!list.length) { host.innerHTML = '<div class="t-blank" style="padding:.8rem">No series returned for this filter.</div>'; return; }
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Series</th><th>Title</th><th class="num">Volume (all events)</th><th>Frequency</th><th>Settlement sources (official)</th><th>Contract</th></tr></thead><tbody>
      ${list.map(s => `<tr>
        <td class="mono">${esc(s.ticker)}</td>
        <td>${esc(s.title)}</td>
        <td class="num">${compact(s.volume)}</td>
        <td>${esc(s.frequency || '—')}</td>
        <td class="src">${(s.settlementSources || []).slice(0, 4).map(x => x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name || 'source')}</a>` : esc(x.name || '')).join('<br>') || '<span class="t-blank">—</span>'}</td>
        <td class="src">${s.contractTermsUrl ? `<a href="${esc(s.contractTermsUrl)}" target="_blank" rel="noopener">terms (PDF)</a>` : '<span class="t-blank">—</span>'}
          <div><a href="${esc(api.url(`/series/${encodeURIComponent(s.ticker)}`))}" target="_blank" rel="noopener">series API</a></div></td>
      </tr>`).join('')}
      </tbody></table></div>`;
  }

  async function load() {
    const sb = qs('#statusbar');
    sb.innerHTML = '<span class="pill snap">loading…</span>';
    try {
      await TBData.refresh({ events: { maxPages: 6 } });
      TBUI.errorBox(qs('#errbox'), TBData.state.errors);
      TBUI.truncBox(qs('#truncbox'), TBData.state.truncated);
      TBUI.statusBar(sb, TBData.state);
      renderKpis(); renderEvents(); renderMarkets(); renderSeries();
    } catch (e) {
      sb.innerHTML = '<span class="pill down">error</span>';
      TBUI.errorBox(qs('#errbox'), [e.message]);
    }
  }

  qs('#statusFilter').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#statusFilter').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    statusFilter = b.dataset.f; renderMarkets();
  });
  qs('#mSearch').addEventListener('input', ev => { searchText = ev.target.value; renderMarkets(); });
  qs('#mCsv').addEventListener('click', () => {
    TBUI.exportCsv(`kalshi-${topicId}-markets.csv`, filtered(), [
      { label: 'ticker', get: m => m.ticker }, { label: 'title', get: m => m.title },
      { label: 'event_ticker', get: m => m.eventTicker }, { label: 'status', get: m => m.status },
      { label: 'result', get: m => m.result }, { label: 'yes_bid_dollars', get: m => m.yesBid },
      { label: 'yes_ask_dollars', get: m => m.yesAsk }, { label: 'last_price_dollars', get: m => m.last },
      { label: 'volume_24h_fp', get: m => m.volume24h }, { label: 'volume_fp', get: m => m.volume },
      { label: 'open_interest_fp', get: m => m.oi }, { label: 'close_time', get: m => m.closeTime },
      { label: 'market_api', get: m => api.url(`/markets/${m.ticker}`) }
    ]);
  });
  load(); setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
