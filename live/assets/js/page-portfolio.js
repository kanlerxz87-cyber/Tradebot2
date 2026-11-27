'use strict';
(function () {
  const { qs, esc, dollar, centsLabel, pct } = TB;
  TB.renderHeader('portfolio.html'); TB.renderFooter();
  const signed = v => v == null ? '—' : (v >= 0 ? '+' : '') + dollar(v, 2);
  const feeSource = () => TBUI.link('https://kalshi.com/docs/kalshi-fee-schedule.pdf', 'fee scenario basis');
  function render() {
    const p = TBData.portfolio(); qs('#autoChk').checked = !!p.paper.auto;
    qs('#kpis').innerHTML = [TBUI.kpi('Equity', dollar(p.equity, 2), `assumed start $10,000 · cash ${dollar(p.cash, 2)}`),
      TBUI.kpi('Total simulated P&L', signed(p.totalPnl), pct(p.totalReturn) + ' return'),
      TBUI.kpi('Realized', signed(p.realized), `${p.closedCount} closed`),
      TBUI.kpi('Unrealized', signed(p.unrealized), `${p.openCount} open · ${p.unknownMarks} unverified marks`),
      TBUI.kpi('Win rate', pct(p.winRate, 0), `${p.wins} wins · ${p.losses} losses`),
      TBUI.kpi('Avg win', dollar(p.avgWin, 2), 'per winning paper trade'), TBUI.kpi('Avg loss', dollar(p.avgLoss, 2), 'per losing paper trade')].join('');
    TBChart.line(qs('#equity'), { points: p.paper.equityHistory, unit: 'usd', showVolume: false,
      label: 'Simulated mark-to-bid equity ($), recorded about every 30s', emptyMessage: 'Waiting for two real simulation equity observations. Y axis is dollars, not normalized cents.' });
    qs('#stratTable').innerHTML = `<div class="table-wrap"><table><thead><tr><th>Simulation strategy</th><th>Hypothesis (not a venue fact)</th><th>Entry → exit</th>
      <th>Closed / open</th><th>P&amp;L</th><th>Win rate</th><th>ROI on cost + entry fee</th><th>Verdict</th><th>Official method references</th></tr></thead><tbody>
      ${p.byStrategy.map(s => `<tr><td>${esc(s.name)}<div class="s mono">${esc(s.id)}</div></td><td class="s">${esc(s.thesis)}</td><td class="s">${esc(s.entry)}<br>${esc(s.exit)}</td>
      <td>${s.closed} / ${s.open}</td><td>${signed(s.pnl)}</td><td>${pct(s.winRate, 0)}</td><td>${pct(s.roi)}</td>
      <td>${s.closed < 5 ? 'needs more trades' : (s.pnl > 0 ? 'positive in this sample only' : 'non-positive in this sample only')}</td>
      <td class="src">${feeSource()} · ${TBUI.link('https://docs.kalshi.com/getting_started/market_lifecycle', 'lifecycle')}</td></tr>`).join('')}</tbody></table></div>`;
    const bars = (id, rows) => TBChart.bars(qs(id), rows, { signed: true, fmt: signed });
    bars('#byTopic', p.byTopic.map(t => ({ label: t.name, value: t.pnl })));
    bars('#bySide', p.bySide.map(t => ({ label: t.side.toUpperCase(), value: t.pnl })));
    bars('#byBand', p.byPriceBucket.map(t => ({ label: t.label, value: t.pnl })));
    qs('#open').innerHTML = !p.open.length ? '<div class="t-blank">No open paper positions.</div>' : `<div class="table-wrap"><table><thead><tr>
      <th>Opened</th><th>Strategy / topic</th><th>Market</th><th>Side / qty</th><th>Entry</th><th>Bid mark</th><th>Simulated P&amp;L</th><th>Official price evidence</th></tr></thead><tbody>
      ${p.open.map(t => `<tr><td>${esc(new Date(t.openedAt).toLocaleString())}</td><td>${esc(t.strategy)}<div>${esc(t.topic)}</div></td><td>
      <a href="${TB.pageUrl('market.html')}?ticker=${encodeURIComponent(t.ticker)}">${esc(t.ticker)}</a><div class="s">${esc(t.title)}</div></td>
      <td>${esc(t.side.toUpperCase())} × ${t.qty}</td><td>${centsLabel(t.entryCents)}</td><td>${t.markCents == null ? TBUI.missing() : centsLabel(t.markCents)}</td>
      <td>${signed(t.upnl)}</td><td class="src">${TBUI.marketSourceLinks(t)} · ${feeSource()}</td></tr>`).join('')}</tbody></table></div>`;
    qs('#closed').innerHTML = !p.closed.length ? '<div class="t-blank">No closed paper trades yet.</div>' : `<div class="table-wrap"><table><thead><tr>
      <th>Closed</th><th>Strategy / topic</th><th>Market</th><th>Side / qty</th><th>Entry / exit</th><th>Scenario fees</th><th>Simulated P&amp;L / return</th><th>Reason</th><th>Official price evidence</th></tr></thead><tbody>
      ${p.closed.slice(0, 100).map(t => `<tr><td>${esc(new Date(t.closedAt).toLocaleString())}</td><td>${esc(t.strategy)}<div>${esc(t.topic)}</div></td>
      <td>${esc(t.ticker)}</td><td>${esc(t.side.toUpperCase())} × ${t.qty}</td><td>${centsLabel(t.entryCents)} / ${centsLabel(t.exitCents)}</td>
      <td>${dollar(t.fee + t.exitFee, 4)}</td><td>${signed(t.pnl)} / ${pct(t.returnPct)}</td><td>${esc(t.why)}</td>
      <td class="src">${TBUI.marketSourceLinks(t)} · ${feeSource()}</td></tr>`).join('')}</tbody></table></div>`;
  }
  async function account() {
    let doc = {};
    try {
      const r = await fetch(TB.pageUrl('data/account-verification.json'), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status); doc = await r.json();
    } catch (e) { doc.note = 'Account capture unavailable: ' + e.message; }
    const balanceSource = 'https://external-api.demo.kalshi.co/trade-api/v2/portfolio/balance';
    const positionSource = 'https://external-api.demo.kalshi.co/trade-api/v2/portfolio/positions';
    const allowed = (url, path) => { try { const u = new URL(url); return u.protocol === 'https:' && ['external-api.demo.kalshi.co', 'demo-api.kalshi.co'].includes(u.host) && u.pathname === '/trade-api/v2' + path; } catch (e) { return false; } };
    const captureTime = Date.parse(doc.generated_at);
    const verified = doc.configured === true && doc.verified_account_read === true && doc.environment === 'demo'
      && Number.isFinite(captureTime) && captureTime <= Date.now() + 5000
      && allowed(doc.balance_source_url, '/portfolio/balance') && allowed(doc.positions_source_url, '/portfolio/positions');
    const rows = [['Available balance ($)', verified ? (TB.num(doc.balance_dollars) ?? (TB.num(doc.balance) == null ? null : Number(doc.balance) / 100)) : null, balanceSource],
      ['Portfolio value ($, cents ÷ 100)', verified && TB.num(doc.portfolio_value) != null ? Number(doc.portfolio_value) / 100 : null, balanceSource],
      ['Authenticated capture time', verified ? doc.generated_at : null, balanceSource],
      ['Returned market positions (first page, limit 200)', verified && Array.isArray(doc.market_positions) ? doc.market_positions.length : null, positionSource],
      ['Confirmed account order execution', null, positionSource]];
    qs('#accountStatus').textContent = verified ? 'Dated signed DEMO account read; not live streaming. Strategy attribution needs a linked fills/order ledger and is not inferred.' : 'UNVERIFIED — no authenticated demo-account capture. Balance, positions and order execution remain blank. Browser simulations below are separate.';
    qs('#accountTable').innerHTML = `<table><thead><tr><th>Account field</th><th>Verified value</th><th>Official source (requires authentication)</th></tr></thead><tbody>
      ${rows.map(([label, value, src]) => `<tr><th>${esc(label)}</th><td>${value == null ? TBUI.missing() : esc(value)}</td><td class="src">${TBUI.link(src, 'signed API')} · ${TBUI.link('https://docs.kalshi.com/api-reference/portfolio/get-balance', 'units/auth docs')}</td></tr>`).join('')}</tbody></table>
      <p class="src">${esc(doc.note || 'Account values remain unverified.')} · <a href="${TB.pageUrl('data/account-verification.json')}">Exact read-only capture / runner evidence</a></p>`;
  }
  async function load() {
    try { await TBData.refresh(); TBUI.statusBar(qs('#statusbar'), TBData.state); TBUI.errorBox(qs('#errbox'), TBData.state.errors); }
    catch (e) { TBUI.errorBox(qs('#errbox'), [e.message]); }
    render(); await account();
  }
  qs('#autoChk').onchange = ev => { const p = TBData.paperState(); p.auto = ev.target.checked; TBData.savePaper(p); render(); };
  qs('#scanBtn').onclick = () => { TBData.carryScan(); render(); };
  qs('#resetBtn').onclick = () => { if (confirm('Erase this browser’s version-2 paper ledger and reset its assumed $10,000?')) { TBData.resetPaper(); render(); } };
  qs('#csvBtn').onclick = () => TBUI.exportCsv('kalshi-PAPER-trades.csv', TBData.paperState().trades, [
    ...['id', 'strategy', 'ticker', 'topic', 'side', 'qty', 'entry', 'exit', 'fee', 'exitFee', 'pnl', 'status', 'sourceUrl'].map(key => ({ label: key, key })),
    { label: 'opened_at', get: t => new Date(t.openedAt).toISOString() }, { label: 'closed_at', get: t => t.closedAt ? new Date(t.closedAt).toISOString() : '' }
  ]);
  setInterval(() => { if (!document.hidden) load(); }, 60000); load();
})();
