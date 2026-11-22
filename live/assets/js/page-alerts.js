/* =============================================================================
   Alerts page — two scrolling chats + table view
   ============================================================================= */
'use strict';
(function () {
  const { qs, esc, centsLabel, compact, api, TOPICS, topicById } = TB;
  TB.renderHeader('alerts.html');
  TB.renderFooter();

  let topicFilter = '';
  let dirFilter = '';
  let lastTopId = null;
  let audioCtx = null;
  let timer = null;

  function filtered(list) {
    return list.filter(a =>
      (!topicFilter || a.topic === topicFilter) &&
      (!dirFilter || (dirFilter === 'up' ? a.delta > 0 : a.delta < 0)));
  }

  function render() {
    const all = filtered(TBData.alerts());
    const roi = TBUI.roiAlerts(all);
    const chatAll = qs('#chatAll'), chatRoi = qs('#chatRoi');
    const atBottom = chatAll.scrollHeight - chatAll.scrollTop - chatAll.clientHeight < 80;
    TBUI.renderChat(chatAll, all.slice(0, 150), { showScore: true });
    TBUI.renderChat(chatRoi, roi.slice(0, 150), { showScore: true, empty: 'No move currently passes the screen. That is a valid outcome: most large moves are illiquid or already priced through fees.' });
    qs('#nAll').textContent = all.length;
    qs('#nRoi').textContent = roi.length;
    if (atBottom) chatAll.scrollTop = 0;

    /* table */
    const host = qs('#alertTable');
    if (!all.length) { host.innerHTML = '<div class="t-blank" style="padding:.8rem">No alerts recorded yet.</div>'; return; }
    host.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Time</th><th>Topic</th><th>Market</th><th class="num">From</th><th class="num">To</th><th class="num">Δ</th>
      <th class="num">Score</th><th class="num">Spread</th><th class="num">24h vol</th><th>Sources</th></tr></thead><tbody>
      ${all.slice(0, 200).map(a => {
        const t = topicById(a.topic);
        return `<tr>
          <td class="mono">${TB.timeShort(a.fromTs)}→${TB.timeShort(a.at)}</td>
          <td>${t ? t.icon + ' ' + esc(t.name) : '—'}</td>
          <td><span class="t">${esc(a.title)}</span><div class="s mono">${esc(a.ticker)}</div>${a.demo ? '<div class="flag">synthetic demo alert</div>' : ''}</td>
          <td class="num">${centsLabel(a.from)}</td><td class="num">${centsLabel(a.to)}</td>
          <td class="num" style="color:${a.delta > 0 ? 'var(--up)' : 'var(--down)'}">${a.delta > 0 ? '+' : '−'}${Math.abs(a.delta).toFixed(1)}¢</td>
          <td class="num">${a.score && a.score.score != null ? (a.score.score * 100).toFixed(1) + '¢' + (a.score.pass ? ' ✓' : '') : '—'}</td>
          <td class="num">${a.spread != null ? (a.spread * 100).toFixed(1) + '¢' : '—'}</td>
          <td class="num">${compact(a.volume24h)}</td>
          <td class="src"><a href="market.html?ticker=${encodeURIComponent(a.ticker)}&series=${encodeURIComponent(a.seriesTicker || '')}">chart</a> ·
            <a href="${esc(api.url(`/markets/${encodeURIComponent(a.ticker)}/orderbook`))}" target="_blank" rel="noopener">API</a></td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
  }

  function beep(up) {
    if (!qs('#soundChk').checked) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = up ? 880 : 440;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.26);
    } catch (e) { /* audio blocked until user gesture */ }
  }

  async function refresh() {
    const sb = qs('#statusbar');
    sb.innerHTML = '<span class="pill snap">refreshing…</span>';
    try {
      const r = await TBData.refresh({ events: { maxPages: 8 } });
      TBUI.errorBox(qs('#errbox'), TBData.state.errors);
      TBUI.statusBar(sb, TBData.state);
      if (r.swings.length) {
        beep(r.swings[0].delta > 0);
        if (TBData.paperState().auto) { TBData.autoTrade(r.swings); TBData.carryScan(); }
      }
      render();
    } catch (e) {
      sb.innerHTML = '<span class="pill down">error</span>';
      TBUI.errorBox(qs('#errbox'), [e.message]);
    }
  }

  qs('#topicFilter').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#topicFilter').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    topicFilter = b.dataset.t; render();
  });
  qs('#dirFilter').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#dirFilter').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    dirFilter = b.dataset.d; render();
  });
  qs('#refreshBtn').addEventListener('click', refresh);
  qs('#clearBtn').addEventListener('click', () => {
    if (!confirm('Delete all locally stored alerts? This cannot be undone.')) return;
    TBData.saveAlerts([]); render();
  });
  qs('#alertCsv').addEventListener('click', () => {
    TBUI.exportCsv('kalshi-alerts.csv', filtered(TBData.alerts()), [
      { label: 'detected_at', get: a => new Date(a.at).toISOString() },
      { label: 'from_time', get: a => a.fromTs ? new Date(a.fromTs).toISOString() : '' },
      { label: 'ticker', get: a => a.ticker }, { label: 'topic', get: a => a.topic },
      { label: 'title', get: a => a.title }, { label: 'from_cents', get: a => a.from },
      { label: 'to_cents', get: a => a.to }, { label: 'delta_cents', get: a => a.delta },
      { label: 'screen_score_dollars', get: a => a.score ? a.score.score : '' },
      { label: 'screen_pass', get: a => a.score ? a.score.pass : '' },
      { label: 'spread_dollars', get: a => a.spread }, { label: 'volume_24h', get: a => a.volume24h }
    ]);
  });

  render();
  refresh();
  timer = setInterval(refresh, Math.max(30, TB.settings().pollSeconds) * 1000);
})();
