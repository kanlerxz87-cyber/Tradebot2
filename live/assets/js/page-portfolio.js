/* =============================================================================
   Portfolio & strategy analysis page
   ============================================================================= */
'use strict';
(function () {
  const { qs, esc, dollar, centsLabel, pct, compact } = TB;
  TB.renderHeader('portfolio.html');
  TB.renderFooter();

  function render() {
    const p = TBData.portfolio();
    qs('#autoChk').checked = !!p.paper.auto;
    qs('#kpis').innerHTML = [
      TBUI.kpi('Equity', dollar(p.equity, 2), `start $10,000 · cash ${dollar(p.cash, 2)}`),
      TBUI.kpi('Total P&L', (p.totalPnl >= 0 ? '+' : '') + dollar(p.totalPnl, 2), pct(p.totalReturn, 2) + ' return', p.totalPnl >= 0 ? 'up' : 'down'),
      TBUI.kpi('Realized', (p.realized >= 0 ? '+' : '') + dollar(p.realized, 2), `${p.closedCount} closed`),
      TBUI.kpi('Unrealized', (p.unrealized >= 0 ? '+' : '') + dollar(p.unrealized, 2), `${p.openCount} open`),
      TBUI.kpi('Win rate', p.winRate == null ? '—' : pct(p.winRate, 0), `${p.wins}W / ${p.losses}L`),
      TBUI.kpi('Avg win', p.avgWin == null ? '—' : dollar(p.avgWin, 2), 'per closed trade'),
      TBUI.kpi('Avg loss', p.avgLoss == null ? '—' : dollar(p.avgLoss, 2), 'per closed trade')
    ].join('');

    /* equity curve */
    const sorted = p.closed.slice().sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0));
    let run = p.startCash;
    const pts = [{ t: p.paper.created || Date.now() - 1000, p: run }];
    for (const t of sorted) { run += t.pnl || 0; pts.push({ t: t.closedAt || Date.now(), p: run }); }
    const canvas = qs('#equity');
    if (pts.length < 2) {
      TBChart.empty(canvas, 'No closed trades yet — the equity curve starts once a trade closes.');
    } else {
      /* The chart component plots cents; scale equity into a comparable 0-100 space */
      const min = Math.min(...pts.map(x => x.p)), max = Math.max(...pts.map(x => x.p));
      const span = max - min || 1;
      TBChart.line(canvas, {
        points: pts.map(x => ({ t: x.t, p: ((x.p - min) / span) * 80 + 10 })),
        showVolume: false, label: `equity ${dollar(min, 0)} → ${dollar(max, 0)}`
      });
      canvas._equity = { min, max };
    }

    /* strategy table */
    qs('#stratTable').innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Strategy</th><th>Type</th><th>Thesis</th><th>Entry → exit</th><th class="num">Closed</th><th class="num">Open</th>
      <th class="num">P&amp;L</th><th class="num">Win rate</th><th class="num">ROI on cost</th><th>Verdict</th></tr></thead><tbody>
      ${p.byStrategy.map(s => {
        const verdict = s.closed < 5 ? '<span class="t-blank">needs more trades</span>'
          : (s.pnl > 0 ? '<span class="pill up sm" style="background:var(--up-soft);color:var(--up)">profitable so far</span>'
            : '<span class="pill down sm">losing so far</span>');
        return `<tr>
          <td><span class="t">${esc(s.name)}</span><div class="s mono">${esc(s.id)}</div></td>
          <td>${esc(s.tag)}</td>
          <td class="s">${esc(s.thesis)}</td>
          <td class="s">${esc(s.entry)}<br><span class="t-blank">${esc(s.exit)}</span></td>
          <td class="num">${s.closed}</td><td class="num">${s.open}</td>
          <td class="num" style="color:${s.pnl >= 0 ? 'var(--up)' : 'var(--down)'}">${(s.pnl >= 0 ? '+' : '') + dollar(s.pnl, 2)}</td>
          <td class="num">${s.winRate == null ? '—' : pct(s.winRate, 0)}</td>
          <td class="num">${s.roi == null ? '—' : pct(s.roi, 1)}</td>
          <td>${verdict}</td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;

    TBChart.bars(qs('#byTopic'), p.byTopic.map(t => ({ label: t.name, value: t.pnl })), {
      signed: true, fmt: v => (v >= 0 ? '+' : '') + dollar(v, 2)
    });
    TBChart.bars(qs('#bySide'), p.bySide.map(t => ({ label: 'Buy ' + t.side.toUpperCase(), value: t.pnl })), {
      signed: true, fmt: v => (v >= 0 ? '+' : '') + dollar(v, 2)
    });
    TBChart.bars(qs('#byBand'), p.byPriceBucket.map(t => ({ label: t.label, value: t.pnl })), {
      signed: true, fmt: v => (v >= 0 ? '+' : '') + dollar(v, 2)
    });

    qs('#open').innerHTML = p.open.length ? `<div class="table-wrap"><table><thead><tr>
      <th>Opened</th><th>Strategy</th><th>Market</th><th>Side</th><th class="num">Qty</th><th class="num">Entry</th>
      <th class="num">Mark</th><th class="num">P&amp;L</th><th></th></tr></thead><tbody>
      ${p.open.map(t => `<tr>
        <td>${new Date(t.openedAt).toLocaleString()}</td>
        <td class="s">${esc((TBData.strategyById(t.strategy) || {}).name || t.strategy || 'manual')}</td>
        <td><span class="t">${esc(t.title || t.ticker)}</span><div class="s mono">${esc(t.ticker)}</div></td>
        <td>${esc(t.side.toUpperCase())}</td><td class="num">${t.qty}</td>
        <td class="num">${centsLabel(t.entryCents)}</td>
        <td class="num">${t.markCents != null ? centsLabel(t.markCents) : '—'}</td>
        <td class="num" style="color:${(t.upnl || 0) >= 0 ? 'var(--up)' : 'var(--down)'}">${(t.upnl || 0) >= 0 ? '+' : ''}${dollar(t.upnl, 2)}</td>
        <td><a class="btn" href="market.html?ticker=${encodeURIComponent(t.ticker)}">chart</a></td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="t-blank" style="padding:.6rem">No open positions.</div>';

    qs('#closed').innerHTML = p.closed.length ? `<div class="table-wrap"><table><thead><tr>
      <th>Closed</th><th>Strategy</th><th>Market</th><th>Side</th><th class="num">Qty</th><th class="num">Entry</th>
      <th class="num">Exit</th><th class="num">Fees</th><th class="num">P&amp;L</th><th class="num">Return</th><th>Why closed</th></tr></thead><tbody>
      ${p.closed.slice(0, 100).map(t => `<tr>
        <td>${new Date(t.closedAt).toLocaleString()}</td>
        <td class="s">${esc((TBData.strategyById(t.strategy) || {}).name || t.strategy || 'manual')}</td>
        <td><span class="t">${esc(t.title || t.ticker)}</span><div class="s mono">${esc(t.ticker)}</div></td>
        <td>${esc(t.side.toUpperCase())}</td><td class="num">${t.qty}</td>
        <td class="num">${centsLabel(t.entryCents)}</td><td class="num">${centsLabel(t.exitCents)}</td>
        <td class="num">${dollar((t.fee || 0) + (t.exitFee || 0), 4)}</td>
        <td class="num" style="color:${(t.pnl || 0) >= 0 ? 'var(--up)' : 'var(--down)'}">${(t.pnl || 0) >= 0 ? '+' : ''}${dollar(t.pnl, 2)}</td>
        <td class="num">${t.returnPct == null ? '—' : pct(t.returnPct, 1)}</td>
        <td class="s">${esc(t.why || '—')}</td>
      </tr>`).join('')}</tbody></table></div>` : '<div class="t-blank" style="padding:.6rem">No closed trades yet.</div>';
  }

  qs('#autoChk').addEventListener('change', ev => {
    const p = TBData.paperState(); p.auto = ev.target.checked; TBData.savePaper(p);
    if (p.auto) { TBData.carryScan(); render(); }
  });
  qs('#scanBtn').addEventListener('click', () => {
    const p = TBData.paperState();
    if (!p.auto) { const p2 = TBData.paperState(); p2.auto = true; TBData.savePaper(p2); }
    TBData.carryScan();
    /* also let alerts already recorded trigger the alert-driven strategies */
    TBData.autoTrade(TBData.alerts().slice(0, 50));
    render();
  });
  qs('#resetBtn').addEventListener('click', () => {
    if (!confirm('Erase all simulated trades and reset to $10,000? This cannot be undone.')) return;
    TBData.resetPaper(); render();
  });
  qs('#csvBtn').addEventListener('click', () => {
    const p = TBData.portfolio();
    TBUI.exportCsv('kalshi-simulated-trades.csv', p.paper.trades, [
      { label: 'id', key: 'id' }, { label: 'strategy', key: 'strategy' }, { label: 'ticker', key: 'ticker' },
      { label: 'topic', key: 'topic' }, { label: 'side', key: 'side' }, { label: 'qty', key: 'qty' },
      { label: 'entry_dollars', key: 'entry' }, { label: 'exit_dollars', key: 'exit' }, { label: 'entry_fee', key: 'fee' },
      { label: 'exit_fee', key: 'exitFee' }, { label: 'pnl', key: 'pnl' }, { label: 'status', key: 'status' },
      { label: 'opened_at', get: t => new Date(t.openedAt).toISOString() },
      { label: 'closed_at', get: t => t.closedAt ? new Date(t.closedAt).toISOString() : '' },
      { label: 'why', key: 'why' }
    ]);
  });

  TBData.refresh({ events: { maxPages: 4 } }).then(() => {
    TBUI.statusBar(qs('#statusbar'), TBData.state);
    TBUI.errorBox(qs('#errbox'), TBData.state.errors);
    render();
  }).catch(e => { TBUI.errorBox(qs('#errbox'), [e.message]); render(); });
})();
