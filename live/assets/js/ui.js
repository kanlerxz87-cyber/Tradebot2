/* =============================================================================
   Tradebot2 — UI components shared by every page
   ============================================================================= */
'use strict';

var TBUI = (() => {
  const { esc, dollar, centsLabel, compact, relTime, timeShort, dateShort, qs, el, TOPICS, topicById, api } = TB;

  /* ---------------------------------------------------------------- status bar */
  function statusBar(host, state) {
    if (!host) return;
    const f = TB.freshness(state.snapshotTs, state.fallback);
    host.innerHTML = `<div class="row" style="gap:.6rem">
      <span class="pill ${f.level}" id="live-pill">${f.level === 'live' ? '<span class="dot"></span>' : ''}${esc(f.label)}</span>
      <span class="pill muted" id="env-pill">${esc((TB.ENVS[api.getEnv()] || {}).label || '')}</span>
      <span class="src" id="fresh-text">${state.fallback
        ? `Data ${esc(f.text)} · <b>alerts and paper trading paused</b> · <a href="cors-probe.html">run a browser probe</a>`
        : `Data ${esc(f.text)} · auto-refresh every ${TB.settings().pollSeconds}s · <a href="verification.html">sources</a>`}</span>
    </div>`;
  }

  /* ------------------------------------------------------------------ KPI card */
  function kpi(label, value, detail, cls) {
    return `<div class="kpi"><div class="k">${esc(label)}</div>
      <div class="v ${cls || ''}">${value}</div>
      <div class="d">${detail || ''}</div></div>`;
  }

  /* ------------------------------------------------------------ market table
     Every row links to the exact official endpoint that produced it, plus the
     official Kalshi market page. Any field the API did not return is "—". */
  function marketSourceLinks(m) {
    const links = [];
    if (m.seriesTicker && m.ticker) {
      links.push(`<a href="${esc(api.url(`/series/${encodeURIComponent(m.seriesTicker)}/markets/${encodeURIComponent(m.ticker)}`))}" target="_blank" rel="noopener">candles API</a>`);
    }
    links.push(`<a href="${esc(api.url(`/markets/${encodeURIComponent(m.ticker)}/orderbook`))}" target="_blank" rel="noopener">orderbook API</a>`);
    if (m.eventTicker) links.push(`<a href="${esc(api.url('/events', { tickers: m.eventTicker, with_nested_markets: 'true' }))}" target="_blank" rel="noopener">event API</a>`);
    const site = (TB.ENVS[api.getEnv()] || {}).site || 'https://kalshi.com';
    links.push(`<a href="${esc(site + '/markets/' + (m.eventTicker || ''))}" target="_blank" rel="noopener">kalshi.com</a>`);
    return links.join(' · ');
  }

  function priceCell(m) {
    if (m.price === null) return '<span class="t-blank">—</span>';
    const kind = m.priceKind === 'mid' ? '<span class="s">mid</span>' : '';
    return `${centsLabel(TB.cents(m.price))} ${kind}`;
  }

  function statusPill(m) {
    if (m.status === 'active') return `<span class="pill live sm"><span class="dot"></span>Live</span>`;
    if (m.status === 'finalized') {
      const r = m.result === 'yes' ? '<span class="pill up sm" style="background:var(--up-soft);color:var(--up)">YES</span>'
        : m.result === 'no' ? `<span class="pill down sm">NO</span>` : '<span class="pill muted sm">settled</span>';
      return r;
    }
    if (m.status === 'closed' || m.status === 'determined') return `<span class="pill warn sm">${esc(m.statusLabel)}</span>`;
    return `<span class="pill muted sm">${esc(m.statusLabel)}</span>`;
  }

  /**
   * marketsTable(host, rows, opts)
   * opts: { topic: bool, sources: bool, actions: fn(m), limit }
   */
  function marketsTable(host, rows, opts) {
    const o = Object.assign({ topic: true, sources: true, actions: null }, opts || {});
    if (!host) return;
    if (!rows.length) { host.innerHTML = '<div class="t-blank" style="padding:.8rem">No markets returned for this filter.</div>'; return; }
    const head = `<tr>
      ${o.topic ? '<th>Topic</th>' : ''}
      <th>Market</th><th>Status</th><th class="num">Price</th><th class="num">Bid</th><th class="num">Ask</th>
      <th class="num">24h vol</th><th class="num">Open int.</th>
      <th>Closes</th>${o.sources ? '<th>Sources</th>' : ''}${o.actions ? '<th></th>' : ''}</tr>`;
    const body = rows.map(m => {
      const t = topicById(m.topic);
      return `<tr data-ticker="${esc(m.ticker)}">
        ${o.topic ? `<td><span title="${esc(t ? t.note : '')}">${t ? t.icon + ' ' + esc(t.name) : '—'}</span></td>` : ''}
        <td><span class="t">${esc(m.title)}</span><div class="s mono">${esc(m.ticker)}</div>
            ${m.eventTitle && m.eventTitle !== m.title ? `<div class="s">${esc(m.eventTitle)}</div>` : ''}</td>
        <td>${statusPill(m)}</td>
        <td class="num">${priceCell(m)}</td>
        <td class="num">${m.yesBid === null ? '<span class="t-blank">—</span>' : centsLabel(TB.cents(m.yesBid))}</td>
        <td class="num">${m.yesAsk === null ? '<span class="t-blank">—</span>' : centsLabel(TB.cents(m.yesAsk))}</td>
        <td class="num">${compact(m.volume24h)}</td>
        <td class="num">${compact(m.oi)}</td>
        <td><span title="${esc(m.closeTime || '')}">${m.closeTime ? dateShort(m.closeTime) + ' ' + timeShort(m.closeTime) : '<span class="t-blank">—</span>'}</span></td>
        ${o.sources ? `<td class="src">${marketSourceLinks(m)}</td>` : ''}
        ${o.actions ? `<td>${o.actions(m)}</td>` : ''}
      </tr>`;
    }).join('');
    host.innerHTML = `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }

  /* --------------------------------------------------------------- alert chat
     A simplified scrolling chat. Each message is one detected move.
     `mode`: 'all' shows every recorded swing; 'roi' shows ones passing the screen. */
  function alertMessage(a, opts) {
    const o = opts || {};
    const up = (a.delta || 0) > 0;
    const t = topicById(a.topic);
    const deltaTxt = (a.delta > 0 ? '+' : '−') + Math.abs(a.delta).toFixed(Math.abs(a.delta % 1) > 0.001 ? 2 : 0) + '¢';
    const window = a.fromTs ? `${timeShort(a.fromTs)} → ${timeShort(a.at, true)}` : timeShort(a.at, true);
    const sc = a.score || {};
    const link = `market.html?ticker=${encodeURIComponent(a.ticker)}&series=${encodeURIComponent(a.seriesTicker || (a.ticker || '').split('-')[0])}`;
    const srcApi = api.url(`/markets/${encodeURIComponent(a.ticker)}/orderbook`);
    return `<div class="msg ${up ? 'up' : 'down'}" data-id="${esc(a.id)}">
      <div class="top">
        <span>${esc(window)}</span>
        ${t ? `<span class="tag" title="${esc(t.note)}">${t.icon} ${esc(t.name)}</span>` : ''}
        <span class="spread"></span>
        <span class="src"><a href="${esc(srcApi)}" target="_blank" rel="noopener">API</a></span>
      </div>
      <div><span class="tk">${esc(a.ticker)}</span> <span class="mv ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${deltaTxt}</span>
        <span class="px">${centsLabel(a.from)} → ${centsLabel(a.to)}</span>
        <span class="s" style="color:var(--ink-3);font-size:.74rem">(${a.priceKind === 'mid' ? 'bid/ask mid' : 'last trade'})</span></div>
      <div class="ttl">${esc(a.title)}</div>
      <div class="meta">
        ${sc.pass ? `<span class="pill up sm" style="background:var(--up-soft);color:var(--up)">screen score ${(sc.score * 100).toFixed(1)}¢</span>` : (o.showScore ? `<span class="tag">score ${sc.score != null ? (sc.score * 100).toFixed(1) + '¢' : '—'}</span>` : '')}
        <span>spread ${a.spread != null ? (a.spread * 100).toFixed(1) + '¢' : '—'}</span>
        <span>24h vol ${compact(a.volume24h)}</span>
        <span>OI ${compact(a.oi)}</span>
        <a href="${link}">chart &amp; liquidity →</a>
      </div>
    </div>`;
  }

  function renderChat(host, items, opts) {
    const o = opts || {};
    if (!host) return;
    if (!items.length) {
      host.innerHTML = `<div class="chat-empty">${esc(o.empty || 'No qualifying moves recorded yet. Swings of $0.10 or more appear here as soon as two live refreshes differ by that much.')}</div>`;
      return;
    }
    host.innerHTML = items.map(a => alertMessage(a, o)).join('');
  }

  /** Which alerts belong in the high-ROI chat. */
  function roiAlerts(list) { return (list || []).filter(a => a.score && a.score.pass); }

  /* ------------------------------------------------------------- event table */
  function eventsTable(host, rows, opts) {
    const o = Object.assign({ topic: true, limit: 25 }, opts || {});
    if (!host) return;
    if (!rows.length) { host.innerHTML = '<div class="t-blank" style="padding:.8rem">No events returned.</div>'; return; }
    const body = rows.slice(0, o.limit).map(r => {
      const t = topicById(r.topic);
      const res = r.resolved.length
        ? r.resolved.map(m => `${esc(m.yesSubTitle || m.title)} <b>${esc((m.result || '').toUpperCase())}</b>`).join('<br>')
        : '';
      const awaiting = r.state === 'AWAITING RESULT' ? '<span class="pill warn sm">awaiting result</span>' : '';
      const site = (TB.ENVS[api.getEnv()] || {}).site;
      const links = [
        `<a href="${esc(api.url('/events', { tickers: r.eventTicker, with_nested_markets: 'true' }))}" target="_blank" rel="noopener">API</a>`,
        r.seriesTicker ? `<a href="${esc(api.url(`/series/${encodeURIComponent(r.seriesTicker)}/markets`, { status: 'open', limit: 100 }))}" target="_blank" rel="noopener">markets</a>` : '',
        (r.settlementSources && r.settlementSources[0] && r.settlementSources[0].url) ? `<a href="${esc(r.settlementSources[0].url)}" target="_blank" rel="noopener">settlement source</a>` : '',
        `<a href="${esc(site + '/markets/' + r.seriesTicker)}" target="_blank" rel="noopener">kalshi.com</a>`
      ].filter(Boolean).join(' · ');
      return `<tr>
        ${o.topic ? `<td>${t ? t.icon + ' ' + esc(t.name) : '—'}</td>` : ''}
        <td><span class="t">${esc(r.title)}</span><div class="s mono">${esc(r.eventTicker)}</div></td>
        <td class="num">${r.marketCount}</td>
        <td>${r.state === 'LIVE' ? `<span class="pill live sm"><span class="dot"></span>${r.liveCount} live</span>` : (r.state === 'RESOLVED' ? `<span class="pill muted sm">resolved</span>` : `<span class="pill warn sm">${esc(r.state.toLowerCase())}</span>`)}${awaiting}</td>
        <td class="num">${dollar(r.notionalTotal, 0)}</td>
        <td class="num">${dollar(r.vol24, 0)}</td>
        <td>${res || '<span class="t-blank">still trading</span>'}</td>
        <td class="src">${links}</td>
      </tr>`;
    }).join('');
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>
      ${o.topic ? '<th>Topic</th>' : ''}<th>Event</th><th class="num">Markets</th><th>Status</th>
      <th class="num">Notional traded</th><th class="num">24h</th><th>Resolution (YES/NO)</th><th>Sources</th>
      </tr></thead><tbody>${body}</tbody></table></div>`;
  }

  /* ------------------------------------------------------------------ helpers */
  function errorBox(host, errors) {
    if (!host) return;
    if (!errors || !errors.length) { host.innerHTML = ''; return; }
    host.className = 'banner bad';
    host.innerHTML = `<b>Some data could not be loaded.</b><ul class="tight">${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>
      <div style="margin-top:.3rem">Check your connection, or open the <a href="verification.html">sources page</a> to test the API by hand. No substitute data is shown.</div>`;
  }
  function truncBox(host, truncated) {
    if (!host) return;
    if (!truncated || !truncated.length) { host.innerHTML = ''; return; }
    host.className = 'banner warn';
    host.innerHTML = `<b>Partial view.</b> ${truncated.map(t => esc(t)).join(' ')} Not every event is listed; counts on this page are lower bounds.`;
  }
  function topicFilterBar(host, activeId, base) {
    if (!host) return;
    const b = base || 'index.html';
    host.innerHTML = `<div class="row">${TOPICS.map(t =>
      `<a class="btn${t.id === activeId ? ' primary' : ''}" href="${b}#topic-${t.id}">${t.icon} ${esc(t.name)}</a>`).join('')}</div>`;
  }
  function exportCsv(filename, rows, columns) {
    const head = columns.map(c => `"${c.label}"`).join(',');
    const body = rows.map(r => columns.map(c => {
      let v = typeof c.get === 'function' ? c.get(r) : r[c.key];
      if (v === null || v === undefined) v = '';
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',')).join('\n');
    const blob = new Blob([head + '\n' + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return {
    statusBar, kpi, marketsTable, eventsTable, alertMessage, renderChat, roiAlerts,
    errorBox, truncBox, topicFilterBar, exportCsv, marketSourceLinks, statusPill, priceCell
  };
})();
