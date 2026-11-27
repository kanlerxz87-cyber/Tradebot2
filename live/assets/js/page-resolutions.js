/* =============================================================================
   Resolutions page
   ============================================================================= */
'use strict';
(function () {
  const { qs, esc, dollar, centsLabel, pct, compact, api, topicById } = TB;
  TB.renderHeader('resolutions.html');
  TB.renderFooter();

  let filter = 'all', needle = '';

  function all() { return TBData.state.markets; }
  function resolvedAll() { return all().filter(m => m.result === 'yes' || m.result === 'no'); }

  function renderKpis() {
    const a = all();
    const res = resolvedAll();
    const yes = res.filter(m => m.result === 'yes').length;
    const pending = a.filter(m => TB.isClosed(m) && m.status !== 'finalized');
    qs('#kpis').innerHTML = [
      TBUI.kpi('Resolved', String(res.length), 'result published'),
      TBUI.kpi('YES outcomes', String(yes), res.length ? pct(yes / res.length, 0) + ' of resolved' : '—'),
      TBUI.kpi('NO outcomes', String(res.length - yes), res.length ? pct((res.length - yes) / res.length, 0) + ' of resolved' : '—'),
      TBUI.kpi('Awaiting result', String(pending.length), 'closed, not finalised')
    ].join('');
  }

  function renderPending() {
    const rows = all().filter(m => TB.isClosed(m) && m.status !== 'finalized').sort((a, b) => new Date(b.closeTime || 0) - new Date(a.closeTime || 0));
    const host = qs('#pending');
    if (!rows.length) { host.innerHTML = '<div class="t-blank" style="padding:.6rem">Nothing is awaiting a result right now.</div>'; return; }
    TBUI.marketsTable(host, rows, { topic: true });
  }

  function renderResolved() {
    let rows = resolvedAll();
    if (filter !== 'all') rows = rows.filter(m => m.result === filter);
    if (needle) {
      const n = needle.toLowerCase();
      rows = rows.filter(m => (m.title || '').toLowerCase().includes(n) || (m.ticker || '').toLowerCase().includes(n));
    }
    rows.sort((a, b) => new Date(b.settlementTs || b.closeTime || 0) - new Date(a.settlementTs || a.closeTime || 0));
    const host = qs('#resolved');
    if (!rows.length) { host.innerHTML = '<div class="t-blank" style="padding:.6rem">No resolved markets match.</div>'; return; }
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Topic</th><th>Market</th><th>Result</th><th class="num">Final price</th><th>Settled</th><th>Official settlement source</th><th>Sources</th>
      </tr></thead><tbody>
      ${rows.map(m => {
        const t = topicById(m.topic);
        const ss = (m.eventSettlementSources || []).filter(s => s.url).slice(0, 2);
        return `<tr>
          <td>${t ? t.icon + ' ' + esc(t.name) : '—'}</td>
          <td><span class="t">${esc(m.title)}</span><div class="s mono">${esc(m.ticker)}</div></td>
          <td>${TBUI.statusPill(m)}</td>
          <td class="num">${m.settlementValue !== null ? dollar(m.settlementValue, 4) : TBUI.missing()}</td>
          <td>${m.settlementTs ? new Date(m.settlementTs).toLocaleString() : '<span class="t-blank">—</span>'}</td>
          <td class="src">${ss.length ? ss.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join('<br>') : '<span class="t-blank">not returned</span>'}</td>
          <td class="src"><a href="${esc(TBUI.source(m))}" target="_blank" rel="noopener">market API</a></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  qs('#resFilter').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#resFilter').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    filter = b.dataset.f; renderResolved();
  });
  qs('#search').addEventListener('input', ev => { needle = ev.target.value; renderResolved(); });
  qs('#csv').addEventListener('click', () => {
    TBUI.exportCsv('kalshi-resolutions.csv', resolvedAll(), [
      { label: 'topic', get: m => m.topic }, { label: 'ticker', get: m => m.ticker },
      { label: 'title', get: m => m.title }, { label: 'event_ticker', get: m => m.eventTicker },
      { label: 'result', get: m => m.result }, { label: 'settlement_value_dollars', get: m => m.settlementValue },
      { label: 'settlement_ts', get: m => m.settlementTs }, { label: 'close_time', get: m => m.closeTime },
      { label: 'market_api', get: m => api.url(`/markets/${m.ticker}`) }
    ]);
  });

  function load() { return TBData.refresh().then(() => {
    TBUI.statusBar(qs('#statusbar'), TBData.state);
    TBUI.errorBox(qs('#errbox'), TBData.state.errors);
    TBUI.truncBox(qs('#truncbox'), TBData.state.truncated);
    renderKpis(); renderPending(); renderResolved();
  }).catch(e => TBUI.errorBox(qs('#errbox'), [e.message])); }
  load(); setInterval(() => { if (!document.hidden) load(); }, 60000);
})();
