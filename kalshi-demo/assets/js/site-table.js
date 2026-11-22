/* ============================================================
 * Shared topic-page table engine.
 * Runs the simulated engine on topic pages so the live-events
 * snapshot is real (simulated) data — clearly labeled SIMULATED.
 * ============================================================ */

(function () {
  'use strict';

  const topic = TOPIC_MAP[window.TOPIC_ID];
  if (!topic) { console.error('topic page: unknown topic id'); return; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt$(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function fmt2(n) { return '$' + Number(n || 0).toFixed(2); }

  function render() {
    const rowsEl = document.getElementById('eventsRows');
    if (!rowsEl) return;
    const markets = STORE.state.markets.filter(m => m.topic === topic.id).slice(0, 6);
    const now = Date.now();
    const scored = markets.map(m => ({ m, roi: ROI_MODEL.score(m) })).sort((a, b) => (b.m.volume || 0) - (a.m.volume || 0));
    rowsEl.innerHTML = scored.map(({ m, roi }) => {
      const delta = m.price - (m.anchorPrice != null ? m.anchorPrice : m.price);
      const deltaCls = delta > 0.001 ? 'good' : delta < -0.001 ? 'bad' : '';
      const settled = m.status === 'settled';
      return `<tr>
        <td><b>${esc(m.title)}</b><div class="sub" style="color:var(--faint);font-size:11px;font-family:var(--mono);">${esc(m.ticker)}</div></td>
        <td><span class="chip ${settled ? (m.resolution === 'yes' ? 'green' : 'red') : 'teal'}">${settled ? (m.resolution || 'settled').toUpperCase() : 'LIVE'}</span></td>
        <td class="num">${settled ? '—' : fmt2(m.price)}</td>
        <td class="num ${deltaCls}">${settled ? '—' : (delta >= 0 ? '+' : '') + delta.toFixed(2)}</td>
        <td class="num">${fmt$(m.volume)}</td>
        <td class="num"><span class="chip ${roi.score >= 60 ? 'green' : 'amber'}">${roi.score}</span></td>
      </tr>`;
    }).join('');
    document.getElementById('simBadge') && (document.getElementById('simBadge').textContent = 'SIMULATED');
  }

  function tick() {
    simEngineTick();
    render();
  }

  SIM.init();
  render();
  setInterval(tick, 1000);
})();
