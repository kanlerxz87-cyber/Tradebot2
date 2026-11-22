(function () {
  const TB = window.TB;
  const $ = (s) => document.querySelector(s);
  const pct = (v) => (v === null || v === undefined ? '—' : (v > 0 ? '+' : '') + v + '%');
  const pnl = (v) => v === null || v === undefined ? '<span class="muted">—</span>'
    : `<span style="color:var(--${v >= 0 ? 'up' : 'down'})">${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}</span>`;

  async function boot() {
    let a = null, trades = [], strat = [], pf = null;
    try { a = await TB.getJSON('data/analytics.json'); } catch (e) {}
    try { trades = (await TB.getJSON('data/paper_trades.json')).trades || []; } catch (e) {}
    try { strat = (await TB.getJSON('data/strategies.json')).strategies || []; } catch (e) {}
    try { pf = await TB.getJSON('data/portfolio.json'); } catch (e) {}
    if (!a) { $('#overall').innerHTML = '<div class="card">No analytics snapshot yet.</div>'; return; }
    if (!a.generated_at) {
      $('#overall').innerHTML = '<div class="card"><div class="k">Awaiting first cycle</div>' +
        '<div class="v" style="font-size:16px">No simulated trades yet</div>' +
        '<div class="s">The paper engine runs inside the GitHub Actions collector; this page fills in ' +
        'after the first cycle. The strategy rules below are the ones it will apply.</div></div>';
    }

    const o = a.overall || {};
    const cards = [
      ['Simulated trades', TB.fmtNum(o.trades), (o.open || 0) + ' open · ' + (o.settled || 0) + ' settled'],
      ['Realized P&L', pnl(o.realized_pnl_dollars), 'settled trades only'],
      ['Win rate', o.win_rate_pct == null ? '—' : o.win_rate_pct + '%', (o.wins || 0) + 'W / ' + (o.losses || 0) + 'L'],
      ['Capital deployed', TB.fmtMoney(o.invested_dollars), 'cost + fees on settled trades'],
      ['Return on invested', o.return_on_invested_pct == null ? '—' : pct(o.return_on_invested_pct), 'realized P&L ÷ invested'],
      ['Open exposure', TB.fmtMoney(o.open_cost_dollars), 'cash at risk in open trades'],
    ];
    $('#overall').innerHTML = cards.map(([k, v, s]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

    $('#strategyRows').innerHTML = (a.by_strategy || []).map((s) => `<tr>
      <td><strong>${TB.esc(s.name)}</strong><div class="small muted">${TB.esc(s.strategy_id)} · ${TB.esc(s.kind)}</div></td>
      <td class="small">${TB.esc(s.rule)}</td>
      <td class="num">${s.trades}</td><td class="num">${s.open}</td><td class="num">${s.settled}</td>
      <td class="num">${s.win_rate_pct == null ? '—' : s.win_rate_pct + '%'}</td>
      <td class="num">${TB.fmtMoney(s.invested_dollars)}</td>
      <td class="num">${pnl(s.realized_pnl_dollars)}</td>
      <td class="num">${pct(s.return_on_invested_pct)}</td></tr>`).join('');

    const blockRows = (list, key, label) => list.map((b) => `<tr>
      <td>${label(b)}</td><td class="num">${b.trades}</td><td class="num">${b.settled}</td>
      <td class="num">${b.wins}</td><td class="num">${pnl(b.realized_pnl_dollars)}</td>
      <td class="num">${pct(b.return_on_invested_pct)}</td></tr>`).join('')
      || '<tr><td colspan="6" class="muted">none yet</td></tr>';
    $('#topicRows').innerHTML = blockRows(a.by_topic || [], 'topic', (b) => TB.topicTag(b.topic));
    $('#sideRows').innerHTML = blockRows(a.by_side || [], 'side', (b) => `<span class="tag">${TB.esc(b.side)}</span>`);
    $('#feeModel').textContent = a.fee_model || '—';

    const open = trades.filter((t) => t.status === 'open');
    $('#openRows').innerHTML = open.map((t) => `<tr>
      <td class="small">${TB.esc(t.strategy_id)}</td><td>${TB.topicTag(t.topic)}</td>
      <td>${TB.esc(t.title || t.ticker)}<div class="small muted">${TB.esc(t.ticker)}</div></td>
      <td><span class="tag">${TB.esc(t.entry.side)}</span></td>
      <td class="num">${TB.fmtPrice(t.entry.entry_price)}</td>
      <td class="num">${TB.fmtNum(t.entry.contracts, 0)}</td>
      <td class="num">${TB.fmtMoney(t.entry.cash_out_dollars)}</td>
      <td class="num" style="color:var(--up)">${TB.fmtMoney(t.entry.max_profit_dollars)}</td>
      <td class="num" style="color:var(--down)">${TB.fmtMoney(t.entry.max_loss_dollars)}</td>
      <td class="small">${TB.utc(t.opened_at)}</td>
      <td>${TB.sourceLink(t.source_url, 'API ↗')}</td></tr>`).join('')
      || '<tr><td colspan="11" class="muted">No open simulated trades.</td></tr>';

    const settled = trades.filter((t) => t.status === 'settled').reverse();
    $('#settledRows').innerHTML = settled.map((t) => `<tr>
      <td class="small">${TB.esc(t.strategy_id)}</td>
      <td>${TB.esc(t.title || t.ticker)}<div class="small muted">${TB.esc(t.ticker)}</div></td>
      <td><span class="tag">${TB.esc(t.entry.side)}</span></td>
      <td><span class="tag ${t.resolution}">${TB.esc(t.resolution)}</span></td>
      <td class="num">${TB.fmtPrice(t.entry.entry_price)}</td>
      <td class="num">${TB.fmtNum(t.entry.contracts, 0)}</td>
      <td class="num">${pnl(t.realized_pnl_dollars)}</td>
      <td class="num">${pct(t.roi_pct)}</td>
      <td class="small">${TB.utc(t.settled_at)}</td>
      <td>${TB.sourceLink(t.source_url, 'API ↗')}</td></tr>`).join('')
      || '<tr><td colspan="10" class="muted">No settled trades yet — a trade settles when its market resolves.</td></tr>';

    if (pf) {
      $('#portfolio').innerHTML = pf.configured
        ? `<div class="kv">
             <dt>Balance</dt><dd>${TB.fmtMoney(pf.balance != null ? pf.balance / 100 : null)}</dd>
             <dt>Portfolio value</dt><dd>${TB.fmtMoney(pf.portfolio_value != null ? pf.portfolio_value / 100 : null)}</dd>
             <dt>Positions</dt><dd>${(pf.market_positions || []).length || 'none'}</dd>
             <dt>Updated</dt><dd>${TB.utc(pf.generated_at)}</dd>
             <dt>Source</dt><dd>${TB.sourceLink(pf.balance_source_url, 'balance API ↗')} ·
               ${TB.sourceLink(pf.positions_source_url, 'positions API ↗')}</dd></div>`
        : `<p><span class="unverified">Demo account not connected.</span> ${TB.esc(pf.note || '')}</p>
           <p class="small muted">Docs: <a href="${TB.esc(pf.docs)}" target="_blank" rel="noopener">authenticated requests ↗</a>.
           Until credentials are configured this panel stays explicit rather than showing placeholder numbers.</p>`;
    }
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
