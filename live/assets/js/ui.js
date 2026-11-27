/* Shared, source-linked renderers. Model/paper calculations are not venue facts. */
'use strict';
var TBUI = (() => {
  const { esc, dollar, centsLabel, compact, timeShort, dateShort, TOPICS, topicById, api, pageUrl } = TB;
  function link(url, label) {
    try { const u = new URL(url); if (u.protocol !== 'https:') return ''; }
    catch (e) { return ''; }
    return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }
  const missing = () => `<span class="t-blank">—</span> <a class="src" href="${pageUrl('flagged.html#F-08')}">unverified</a>`;
  function source(m) { return m.sourceUrl || api.url(`/markets/${encodeURIComponent(m.ticker)}`); }
  function marketSourceLinks(m) {
    return [link(source(m), 'market API'), m.eventTicker ? link(api.url(`/events/${encodeURIComponent(m.eventTicker)}`), 'event API') : '',
      m.seriesTicker ? link(api.url(`/series/${encodeURIComponent(m.seriesTicker)}`), 'series API') : ''].filter(Boolean).join(' · ');
  }
  function statusBar(host, state) {
    if (!host) return;
    const f = state.snapshotTs ? TB.freshness(state.snapshotTs, state.fallback) : { level: 'warn', label: 'UNAVAILABLE', text: 'No verified quote time' };
    const label = state.partial && !state.fallback && state.freshCount ? 'PARTIAL LIVE READ' : f.label;
    host.innerHTML = `<div class="row" style="gap:.6rem"><span class="pill ${f.level}" id="live-pill">${esc(label)}</span>
      <span class="pill muted" id="env-pill">${esc((TB.ENVS[api.getEnv()] || {}).label)}</span>
      <span class="src" id="fresh-text">${esc(f.text)} · ${state.freshCount || 0}/${state.selectedCount || 0} watched quotes read this cycle ·
      ${state.fallback ? '<b>alerts and paper trading paused</b>' : 'REST samples, not a streaming tape'} ·
      <a href="${pageUrl('verification.html')}">sources &amp; coverage</a></span></div>`;
  }
  function kpi(label, value, detail, cls) {
    return `<div class="kpi"><div class="k">${esc(label)}</div><div class="v ${cls || ''}">${value}</div><div class="d">${detail || ''}</div></div>`;
  }
  function priceCell(m) {
    return m.price === null ? missing() : `${centsLabel(TB.cents(m.price))} <span class="s">${m.priceKind === 'mid' ? 'mid' : 'last'}</span>
      <div class="s">${m.observedAt ? timeShort(m.observedAt, true) : 'time unverified'}${m.fallback || !TBData.isQuoteFresh(m) ? ' · captured/stale' : ''}</div>`;
  }
  function statusPill(m) {
    if (/^(yes|no)$/.test(m.result)) return `<span class="pill ${m.result === 'yes' ? 'up' : 'down'} sm">${esc(m.result.toUpperCase())}</span>
      <span class="s">${m.status === 'finalized' ? 'finalized' : m.status ? esc(m.status) + ' · provisional' : 'status unverified'}</span>`;
    return `<span class="pill ${m.status === 'active' && TBData.isQuoteFresh(m) ? 'live' : 'muted'} sm">${esc(m.statusLabel || 'status unverified')}</span>`;
  }
  function marketsTable(host, rows, opts) {
    const o = Object.assign({ topic: true, sources: true, actions: null }, opts);
    if (!host) return;
    if (!rows.length) { host.innerHTML = '<div class="t-blank">No verified markets in this selection.</div>'; return; }
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>${o.topic ? '<th>Topic</th>' : ''}
      <th>Market</th><th>Status / result</th><th class="num">YES price</th><th class="num">Bid</th><th class="num">Ask</th>
      <th class="num">24h contracts</th><th class="num">Open int.</th><th>Closes</th><th>Official sources</th>${o.actions ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map(m => { const t = topicById(m.topic); return `<tr data-ticker="${esc(m.ticker)}">
        ${o.topic ? `<td>${t ? t.icon + ' ' + esc(t.name) : missing()}</td>` : ''}
        <td><span class="t">${esc(m.title)}</span><div class="s mono">${esc(m.ticker)}</div>${m.eventTitle ? `<div class="s">${esc(m.eventTitle)}</div>` : ''}</td>
        <td>${statusPill(m)}</td><td class="num">${priceCell(m)}</td><td class="num">${m.yesBid === null ? missing() : centsLabel(TB.cents(m.yesBid))}</td>
        <td class="num">${m.yesAsk === null ? missing() : centsLabel(TB.cents(m.yesAsk))}</td><td class="num">${compact(m.volume24h)}</td>
        <td class="num">${compact(m.oi)}</td><td>${m.closeTime ? dateShort(m.closeTime) + ' ' + timeShort(m.closeTime) : missing()}</td>
        <td class="src">${marketSourceLinks(m)}</td>${o.actions ? `<td>${o.actions(m)}</td>` : ''}</tr>`; }).join('')}
      </tbody></table></div>`;
  }
  function eventsTable(host, rows, opts) {
    const o = Object.assign({ topic: true, limit: 25 }, opts);
    if (!host) return;
    if (!rows.length) { host.innerHTML = '<div class="t-blank">No events returned.</div>'; return; }
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>${o.topic ? '<th>Topic</th>' : ''}
      <th>Event</th><th>Selected contracts</th><th>Status</th><th class="num">24h contracts</th><th class="num">24h face notional*</th>
      <th>YES/NO results</th><th>Official sources</th></tr></thead><tbody>${rows.slice(0, o.limit).map(r => {
      const t = topicById(r.topic);
      return `<tr>${o.topic ? `<td>${t ? t.icon + ' ' + esc(t.name) : missing()}</td>` : ''}
        <td><span class="t">${r.title ? esc(r.title) : missing()}</span><div class="s mono">${esc(r.eventTicker)}</div></td>
        <td class="num">${r.marketCount}</td><td>${esc(r.state === 'LIVE' ? r.liveCount + ' active (last read)' : r.state)}</td>
        <td class="num">${compact(r.contracts24)}</td><td class="num">${r.vol24 === null ? missing() : dollar(r.vol24, 0)}</td>
        <td>${r.resolved.length ? r.resolved.slice(0, 5).map(m => `${esc(m.yesSubTitle || m.title)} <b>${esc(m.result.toUpperCase())}</b>${m.status === 'finalized' ? '' : ' (status unverified/provisional)'}`).join('<br>') : '—'}</td>
        <td class="src">${link(api.url(`/events/${encodeURIComponent(r.eventTicker)}`), 'event API')} ·
          ${link(api.url('/markets', { event_ticker: r.eventTicker }), 'contracts API')}</td></tr>`;
      }).join('')}</tbody></table></div><p class="src">*Calculated volume × reported settlement face value, not dollars paid or a full-event total. Missing inputs stay blank.
      Ranking basis: ${esc(TBData.state.rankBasis || '')}. ${link('https://docs.kalshi.com/api-reference/market/get-markets', 'Field definitions')}</p>`;
  }
  function alertMessage(a, opts) {
    const t = topicById(a.topic), up = a.delta > 0, sc = a.score || {};
    return `<div class="msg ${up ? 'up' : 'down'}" data-id="${esc(a.id)}"><div class="top">
      <span>${dateShort(a.at)} · ${timeShort(a.fromTs, true)} → ${timeShort(a.at, true)}</span>
      ${t ? `<span class="tag">${t.icon} ${esc(t.name)}</span>` : ''}<span class="spread"></span>
      <span class="src">${link(a.sourceUrl || api.url(`/markets/${encodeURIComponent(a.ticker)}`), 'market API')}</span></div>
      <div><span class="tk">${esc(a.ticker)}</span> <span class="mv ${up ? 'up' : 'down'}">${up ? '▲ +' : '▼ −'}${Math.abs(a.delta).toFixed(2)}¢</span>
      <span class="px">${centsLabel(a.from)} → ${centsLabel(a.to)}</span> <span class="s">(${a.priceKind === 'mid' ? 'mid' : 'last trade'} observations)</span></div>
      <div class="ttl">${esc(a.title)}</div><div class="meta">
      ${sc.pass ? `<span class="pill up sm">scenario score ${(sc.score * 100).toFixed(1)}¢ · not predicted ROI</span>` : ''}
      <span>spread ${a.spread == null ? '—' : (a.spread * 100).toFixed(2) + '¢'}</span><span>24h contracts ${compact(a.volume24h)}</span>
      <a href="${pageUrl('market.html')}?ticker=${encodeURIComponent(a.ticker)}&amp;series=${encodeURIComponent(a.seriesTicker || '')}">chart, liquidity &amp; official context →</a></div></div>`;
  }
  function renderChat(host, items, opts) {
    if (!host) return;
    host.innerHTML = items.length ? items.map(a => alertMessage(a, opts)).join('')
      : `<div class="chat-empty">${esc(opts && opts.empty || 'No ≥$0.10 live observations yet. Two compatible fresh reads are required; snapshots never create alerts.')}</div>`;
  }
  const roiAlerts = list => (list || []).filter(a => a.score && a.score.pass && !a.demo);
  function contractMeta(host, m) {
    const fields = [['YES bid', m.yesBid == null ? null : centsLabel(TB.cents(m.yesBid))],
      ['YES ask', m.yesAsk == null ? null : centsLabel(TB.cents(m.yesAsk))], ['Last trade', m.last == null ? null : centsLabel(TB.cents(m.last))],
      ['24h volume (contracts)', m.volume24h], ['Open interest (contracts)', m.oi], ['Face value ($)', m.notional],
      ['Quote read time (not trade time)', m.observedAt ? new Date(m.observedAt).toLocaleString() : null], ['Closes', m.closeTime],
      ['Status', m.status], ['Result', m.result || null]];
    host.innerHTML = `<b>${esc(m.title)}</b><div class="mono">${esc(m.ticker)}</div><table><tbody>${fields.map(([name, value]) =>
      `<tr><th>${esc(name)}</th><td>${value == null ? missing() : esc(value)}</td><td class="src">${link(source(m), 'API')}</td></tr>`).join('')}</tbody></table>`;
  }
  function tradesTable(host, rows, ticker) {
    if (!rows.length) { host.innerHTML = '<div class="t-blank">No trades returned.</div>'; return; }
    const src = api.url('/markets/trades', { ticker, limit: 15 });
    host.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Exchange time</th><th>Contracts</th><th>YES ¢</th><th>Side</th><th>Source</th></tr></thead><tbody>
      ${rows.map(t => `<tr><td>${t.created_time ? esc(new Date(t.created_time).toLocaleString()) : missing()}</td>
      <td>${t.count_fp == null ? missing() : esc(t.count_fp)}</td><td>${t.yes_price_dollars == null ? missing() : centsLabel(TB.cents(t.yes_price_dollars))}</td>
      <td>${esc(t.taker_outcome_side || t.taker_side || '—')}</td><td class="src">${link(src, 'trades API')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function contextTable(host, m) {
    if (!host) return;
    const moves = TBData.alerts().filter(a => a.ticker === m.ticker).slice(0, 12);
    const refs = (m.eventSettlementSources || []).filter(s => link(s.url, s.name));
    host.innerHTML = `<p class="hint">Pins mark observed ≥$0.10 moves. The links below are the contract's official reference/settlement sources,
      <b>not evidence that a publication caused a move</b>. Causal attribution is blank and unverified (<a href="${pageUrl('flagged.html#F-04')}">F-04</a>).</p>
      <div class="table-wrap"><table><thead><tr><th>Observed move</th><th>Reference websites (not causal)</th><th>Verified catalyst</th><th>Official evidence</th></tr></thead><tbody>
      ${(moves.length ? moves : [null]).map(a => `<tr><td>${a ? `${esc(new Date(a.at).toLocaleString())} · ${a.delta > 0 ? '+' : ''}${a.delta.toFixed(2)}¢` : 'No qualifying live move recorded yet'}</td>
      <td>${refs.map(s => link(s.url, s.name || 'official reference')).join(' · ') || missing()}</td><td>${missing()}</td>
      <td class="src">${link(a && a.sourceUrl || source(m), 'market API')} · ${m.eventTicker ? link(api.url(`/events/${encodeURIComponent(m.eventTicker)}`), 'event/rules') : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function errorBox(host, errors) {
    if (!host) return;
    host.className = errors && errors.length ? 'banner bad' : '';
    host.innerHTML = errors && errors.length ? `<b>Some reads could not be verified.</b><ul class="tight">${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>
      <a href="${pageUrl('flagged.html')}">Flagged for Review</a> · Missing values stay blank; dated captures retain their original timestamps.` : '';
  }
  function truncBox(host, notes) {
    if (!host) return;
    host.className = notes && notes.length ? 'banner warn' : '';
    host.innerHTML = notes && notes.length ? `<b>Coverage.</b> ${notes.map(esc).join(' ')} <a href="${pageUrl('flagged.html#F-07')}">Limitations</a>` : '';
  }
  function topicFilterBar(host, activeId) {
    if (host) host.innerHTML = TOPICS.map(t => `<a class="btn${t.id === activeId ? ' primary' : ''}" href="${pageUrl('topics/' + t.id + '.html')}">${t.icon} ${esc(t.name)}</a>`).join('');
  }
  function exportCsv(filename, rows, columns) {
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/^([=+@]|-\D)/, "'$&") + '"';
    const text = [columns.map(c => cell(c.label)).join(',')].concat(rows.map(r => columns.map(c => cell(c.get ? c.get(r) : r[c.key])).join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  return { statusBar, kpi, marketsTable, eventsTable, alertMessage, renderChat, roiAlerts, errorBox, truncBox,
    topicFilterBar, exportCsv, marketSourceLinks, statusPill, priceCell, link, missing, source, contractMeta, tradesTable, contextTable };
})();
