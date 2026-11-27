/* Shared chart/order-book view. All clocks are read times, never invented ticks. */
'use strict';
var TBView = (() => {
  async function price(canvas, m, seconds, interval, meta) {
    const request = (canvas._request || 0) + 1; canvas._request = request;
    if (!m) { TBChart.empty(canvas, 'No verified market selected.'); return; }
    const data = await TBData.chartSeries(m, seconds, interval);
    if (canvas._request !== request) return;
    const markers = TBData.alerts().filter(a => a.ticker === m.ticker).map(a => ({ t: a.at, delta: a.delta }));
    TBChart.line(canvas, { points: data.points, markers, start: data.start, end: data.end,
      showVolume: seconds > 60, label: data.label,
      emptyMessage: seconds <= 60 ? 'Waiting for two real REST observations in this seconds window. Samples arrive about every 5 seconds while this chart is open; no ticks are fabricated.' : 'No compatible price history returned in this window. Try a longer window; missing prices stay blank.' });
    if (meta) meta.textContent = data.note;
  }
  async function ladder(host, meta, m, levels = 10) {
    if (!host) return;
    host.dataset.ticker = m ? m.ticker : '';
    if (!m) {
      host.innerHTML = '<div class="t-blank">No verified market selected; current liquidity is unverified.</div>';
      if (meta) meta.textContent = '';
      return;
    }
    if (TBData.state.fallback || m.fallback) {
      host.innerHTML = '<div class="t-blank">Current liquidity unverified. The dated capture is not an executable book.</div>';
      if (meta) meta.textContent = 'No current-size estimate is substituted.';
      return;
    }
    const source = TB.api.url(`/markets/${encodeURIComponent(m.ticker)}/orderbook`, { depth: 15 });
    try {
      const ob = await TB.api.orderbook(m.ticker, 15);
      if (host.dataset.ticker !== m.ticker) return;
      TBChart.ladder(host, ob, { levels, source });
      const liq = TBChart.liquidity(ob);
      if (meta) meta.innerHTML = `${liq ? `${TB.compact(liq.bidContracts)} contracts bid / ${TB.compact(liq.askContracts)} offered in returned depth · ` : ''}
        read ${TB.timeShort(Date.now(), true)} (REST may be cached) · ${TBUI.link(source, 'exact book API')}`;
    } catch (e) {
      if (host.dataset.ticker !== m.ticker) return;
      host.innerHTML = `<div class="t-blank">Liquidity unverified: ${TB.esc(e.message)}</div>`;
      if (meta) meta.innerHTML = TBUI.link(source, 'book API');
    }
  }
  async function trades(host, m) {
    if (!host) return;
    host.dataset.ticker = m ? m.ticker : '';
    if (!m) { host.innerHTML = '<div class="t-blank">No verified market selected; trade tape is unavailable.</div>'; return; }
    if (TBData.state.fallback || m.fallback) { host.innerHTML = '<div class="t-blank">Current trade tape unverified in snapshot mode.</div>'; return; }
    try {
      const r = await TB.api.trades({ ticker: m.ticker, limit: 15 });
      if (host.dataset.ticker === m.ticker) TBUI.tradesTable(host, r.trades || [], m.ticker);
    } catch (e) { if (host.dataset.ticker === m.ticker) host.textContent = 'Trade tape unavailable: ' + e.message; }
  }
  function watch(getTicker, onRead, enabled = () => true) {
    let busy = false;
    return setInterval(async () => {
      if (busy || document.hidden || !enabled() || !getTicker() || TBData.state.fallback) return;
      busy = true;
      try { const m = await TBData.refreshOne(getTicker()); if (m) await onRead(m); }
      catch (e) { const meta = document.querySelector('#chartMeta, #dashChartMeta'); if (meta) meta.textContent = 'Latest read failed; previous timestamps retained. ' + e.message; }
      finally { busy = false; }
    }, 5000);
  }
  return { price, ladder, trades, watch };
})();
