'use strict';
(function () {
  const { qs, esc } = TB;
  TB.renderHeader('market.html'); TB.renderFooter();
  const params = new URLSearchParams(location.search), ticker = params.get('ticker');
  let seconds = 3600, mkt = null;
  async function draw() {
    mkt = TBData.marketByTicker(ticker);
    if (!mkt) { qs('#head').innerHTML = '<div class="banner warn">This contract is not in the verified five-topic watch list. No market or order data is inferred. Open a sourced contract from a topic table.</div>'; qs('#buyBtn').disabled = true; return; }
    qs('#head').innerHTML = `<h1>${esc(mkt.title)}</h1><p class="mono">${esc(mkt.ticker)} · ${esc(mkt.eventTicker || 'event unverified')}</p>`;
    TBUI.contractMeta(qs('#contractMeta'), mkt);
    qs('#rules').textContent = mkt.rules || 'Rules not returned — unverified.';
    qs('#sources').innerHTML = TBUI.marketSourceLinks(mkt); TBUI.contextTable(qs('#moveContext'), mkt);
    const side = qs('input[name="side"]:checked').value;
    const px = side === 'yes' ? mkt.yesAsk : mkt.noAsk;
    qs('#pxHint').textContent = 'Side ask ' + TB.dollar(px, 4) + '; fresh visible size is required.';
    qs('#buyBtn').disabled = !TBData.isQuoteFresh(mkt) || mkt.status !== 'active' || TB.api.getEnv() !== 'demo';
    await Promise.all([TBView.price(qs('#chart'), mkt, seconds, seconds > 3 * 86400 ? 60 : 1, qs('#chartMeta')),
      TBView.ladder(qs('#ladder'), qs('#liq'), mkt, 12), TBView.trades(qs('#trades'), mkt)]);
  }
  async function load() {
    try { await TBData.refresh(); TBUI.statusBar(qs('#statusbar'), TBData.state); TBUI.errorBox(qs('#errbox'), TBData.state.errors); await draw(); }
    catch (e) { TBUI.errorBox(qs('#errbox'), [e.message]); }
  }
  qs('#span').onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#span').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    seconds = Number(b.dataset.seconds); draw();
  };
  document.querySelectorAll('input[name="side"]').forEach(x => x.onchange = draw);
  qs('#buyBtn').onclick = async () => {
    try {
      if (mkt) await TBData.refreshOne(ticker);
      const r = TBData.openTrade({ market: TBData.marketByTicker(ticker), side: qs('input[name="side"]:checked').value, qty: TB.num(qs('#qty').value), note: 'Manual PAPER order; no request is sent to Kalshi.' });
      qs('#orderMsg').textContent = r.ok ? `SIMULATED ${r.trade.qty} ${r.trade.side.toUpperCase()} at ${TB.dollar(r.trade.entry, 4)}. No account order was placed.` : r.error;
      await draw();
    } catch (e) { qs('#orderMsg').textContent = 'No simulated fill: ' + e.message; }
  };
  TBView.watch(() => ticker, draw);
  setInterval(() => { if (!document.hidden) load(); }, 60000);
  load();
})();
