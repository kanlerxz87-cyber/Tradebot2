'use strict';
(function () {
  const { qs, esc } = TB;
  TB.renderHeader('liquidity.html'); TB.renderFooter();
  let ticker = new URLSearchParams(location.search).get('ticker'), seconds = 3600, interval = 1;
  function fillSelect() {
    const rows = TBData.state.markets.filter(m => m.price !== null).sort((a, b) => Number(TB.isLive(b)) - Number(TB.isLive(a)) || (b.volume24h || 0) - (a.volume24h || 0));
    if (!rows.some(m => m.ticker === ticker)) ticker = rows[0] && rows[0].ticker;
    qs('#mkt').innerHTML = rows.map(m => `<option value="${esc(m.ticker)}"${m.ticker === ticker ? ' selected' : ''}>${esc(m.ticker)} — ${esc(m.title)}</option>`).join('');
  }
  async function draw() {
    const m = TBData.marketByTicker(ticker);
    if (!m) {
      TBChart.empty(qs('#chart'), 'No verified market selected.');
      qs('#mktMeta').textContent = 'No verified market selected.';
      await Promise.all([TBView.ladder(qs('#ladder'), qs('#liqMeta'), null), TBView.trades(qs('#trades'), null)]);
      TBUI.contextTable(qs('#moveContext'), null); return;
    }
    qs('#chartTitle').textContent = m.ticker;
    TBUI.contractMeta(qs('#mktMeta'), m); TBUI.contextTable(qs('#moveContext'), m);
    await Promise.all([TBView.price(qs('#chart'), m, seconds, interval, qs('#chartMeta')),
      TBView.ladder(qs('#ladder'), qs('#liqMeta'), m, 12), TBView.trades(qs('#trades'), m)]);
  }
  async function load() {
    try {
      await TBData.refresh(); TBUI.statusBar(qs('#statusbar'), TBData.state);
      TBUI.errorBox(qs('#errbox'), TBData.state.errors); fillSelect(); await draw();
    } catch (e) { TBUI.errorBox(qs('#errbox'), [e.message]); }
  }
  qs('#mkt').onchange = ev => { ticker = ev.target.value; draw(); };
  qs('#span').onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#span').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    seconds = Number(b.dataset.seconds); draw();
  };
  qs('#iv').onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#iv').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    interval = Number(b.dataset.iv); draw();
  };
  TBView.watch(() => ticker, draw, () => qs('#autoChk').checked);
  setInterval(() => { if (!document.hidden && qs('#autoChk').checked) load(); }, 60000);
  window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(draw, 200); });
  load();
})();
