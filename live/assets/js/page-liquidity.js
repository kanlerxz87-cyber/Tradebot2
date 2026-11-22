/* =============================================================================
   Charts & liquidity page
   ============================================================================= */
'use strict';
(function () {
  const { qs, esc, cents, centsLabel, compact, dollar, api } = TB;
  TB.renderHeader('liquidity.html');
  TB.renderFooter();

  let ticker = null, spanMin = 60, interval = 1, timer = null;
  const candleCache = new Map();

  function fillSelect() {
    const sel = qs('#mkt');
    const all = TBData.state.markets.filter(m => m.price !== null);
    const live = all.filter(TB.isLive).sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    const settled = all.filter(m => !TB.isLive(m)).sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 40);
    const params = new URLSearchParams(location.search);
    const want = params.get('ticker');
    ticker = want || ticker || (live[0] && live[0].ticker);
    const opt = (m, sel) => `<option value="${esc(m.ticker)}"${m.ticker === sel ? ' selected' : ''}>${esc(m.ticker)} — ${esc((m.title || '').slice(0, 50))}</option>`;
    sel.innerHTML = `<optgroup label="Live (by 24h volume)">${live.slice(0, 120).map(m => opt(m, sel)).join('')}</optgroup>` +
      (settled.length ? `<optgroup label="Settled / closed">${settled.map(m => opt(m, ticker)).join('')}</optgroup>` : '');
    if (!ticker && live[0]) ticker = live[0].ticker;
    sel.value = ticker;
  }

  async function draw() {
    const canvas = qs('#chart');
    const m = TBData.marketByTicker(ticker);
    if (!m) { TBChart.empty(canvas, 'Market not found in the current data window.'); return; }
    qs('#chartTitle').textContent = m.ticker;
    qs('#chartMeta').textContent = `${spanMin >= 60 ? (spanMin / 60) + 'h' : spanMin + 'm'} window · ${interval === 1 ? '1-minute' : interval === 60 ? '1-hour' : '1-day'} candles`;
    const now = Math.floor(Date.now() / 1000);
    const start = now - spanMin * 60;
    const key = `${ticker}|${interval}|${start}`;
    let candles = candleCache.get(key);
    if (!candles) {
      try {
        const r = await api.candlesticks(m.seriesTicker, m.ticker, interval, start, now);
        candles = (r.candlesticks || []).map(c => ({
          t: c.end_period_ts * 1000,
          p: c.price && c.price.close_dollars != null ? cents(c.price.close_dollars) : null,
          hi: c.price && c.price.high_dollars != null ? cents(c.price.high_dollars) : null,
          lo: c.price && c.price.low_dollars != null ? cents(c.price.low_dollars) : null,
          v: c.volume_fp != null ? Number(c.volume_fp) : null
        })).filter(c => c.p !== null);
        candleCache.set(key, candles);
        if (candleCache.size > 60) candleCache.clear();
      } catch (e) {
        candles = [];
        qs('#chartMeta').textContent = 'candles unavailable: ' + e.message;
      }
    }
    let pts = candles.slice();
    for (const h of TBData.historyFor(ticker)) if (h.t >= start * 1000) pts.push({ t: h.t, p: h.p });
    pts.sort((a, b) => a.t - b.t);
    const dedup = [];
    for (const p of pts) {
      if (dedup.length && Math.abs(dedup[dedup.length - 1].t - p.t) < 500) dedup[dedup.length - 1] = p;
      else dedup.push(p);
    }
    pts = dedup;
    if (m.price !== null) {
      const lastP = cents(m.price);
      if (!pts.length || pts[pts.length - 1].p !== lastP) pts.push({ t: Date.now(), p: lastP });
    }
    const markers = TBData.alerts().filter(a => a.ticker === ticker).map(a => ({ t: a.at, delta: a.delta }));
    TBChart.line(canvas, { points: pts, markers, showVolume: true, label: `${m.ticker} · ${m.priceKind === 'mid' ? 'bid/ask mid' : 'last trade'}` });

    qs('#mktMeta').innerHTML = `
      <div><b>${esc(m.title)}</b></div>
      <div class="mono">${esc(m.ticker)}</div>
      <div>Status: ${TBUI.statusPill(m)} ${m.result ? 'result <b>' + esc(m.result.toUpperCase()) + '</b>' : ''}</div>
      <table style="margin-top:.4rem"><tbody>
        <tr><th>YES bid</th><td class="num">${m.yesBid === null ? '—' : centsLabel(cents(m.yesBid))}</td></tr>
        <tr><th>YES ask</th><td class="num">${m.yesAsk === null ? '—' : centsLabel(cents(m.yesAsk))}</td></tr>
        <tr><th>Spread</th><td class="num">${m.spread === null ? '—' : (m.spread * 100).toFixed(1) + '¢'}</td></tr>
        <tr><th>Last trade</th><td class="num">${m.last === null ? '—' : centsLabel(cents(m.last))}</td></tr>
        <tr><th>24h volume</th><td class="num">${compact(m.volume24h)}</td></tr>
        <tr><th>Open interest</th><td class="num">${compact(m.oi)}</td></tr>
        <tr><th>Tick structure</th><td>${esc(m.priceStructure || '—')}</td></tr>
        <tr><th>Closes</th><td>${m.closeTime ? new Date(m.closeTime).toLocaleString() : '—'}</td></tr>
      </tbody></table>
      <div style="margin-top:.4rem">${esc(m.rules || '')}</div>
      <div style="margin-top:.4rem">Source: <a href="${esc(api.url(`/markets/${encodeURIComponent(m.ticker)}`))}" target="_blank" rel="noopener">GET /markets/${esc(m.ticker)}</a></div>`;
    drawLadder(m);
    drawTrades(m);
  }

  async function drawLadder(m) {
    const host = qs('#ladder'), meta = qs('#liqMeta');
    try {
      const ob = await api.orderbook(m.ticker, 15);
      TBChart.ladder(host, ob, { levels: 12, yesBid: m.yesBid, yesAsk: m.yesAsk });
      const l = TBChart.liquidity(ob, m.yesBid, m.yesAsk);
      meta.innerHTML = l ? `Bid side: <b>${compact(l.bidContracts)}</b> contracts over ${l.bidLevels} levels ·
        Ask side: <b>${compact(l.askContracts)}</b> over ${l.askLevels} levels.
        <a href="${esc(api.url(`/markets/${encodeURIComponent(m.ticker)}/orderbook`, { depth: 15 }))}" target="_blank" rel="noopener">raw API</a>` : '';
    } catch (e) {
      host.innerHTML = `<div class="t-blank">${esc(e.message)}</div>`;
      meta.textContent = '';
    }
  }

  async function drawTrades(m) {
    const host = qs('#trades');
    try {
      const r = await api.trades({ ticker: m.ticker, limit: 15 });
      const rows = r.trades || [];
      if (!rows.length) { host.innerHTML = '<div class="t-blank">No trades returned for this market.</div>'; return; }
      host.innerHTML = `<table><thead><tr><th>Time</th><th class="num">Contracts</th><th class="num">YES ¢</th><th>Side</th></tr></thead><tbody>
        ${rows.map(t => `<tr><td>${new Date(t.created_time).toLocaleTimeString()}</td>
          <td class="num">${esc(t.count_fp)}</td><td class="num">${t.yes_price_dollars ? (Number(t.yes_price_dollars) * 100).toFixed(0) : '—'}</td>
          <td>${esc(t.taker_outcome_side || t.taker_side || '—')}</td></tr>`).join('')}
      </tbody></table>`;
    } catch (e) {
      host.innerHTML = `<div class="t-blank">${esc(e.message)}</div>`;
    }
  }

  function schedule() {
    clearInterval(timer);
    if (qs('#autoChk').checked) timer = setInterval(draw, 30000);
  }

  qs('#mkt').addEventListener('change', ev => { ticker = ev.target.value; draw(); });
  qs('#span').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#span').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    spanMin = Number(b.dataset.min); draw();
  });
  qs('#iv').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#iv').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    interval = Number(b.dataset.iv); draw();
  });
  qs('#autoChk').addEventListener('change', schedule);

  TBData.refresh({ events: { maxPages: 5 } }).then(() => {
    TBUI.statusBar(qs('#statusbar'), TBData.state);
    TBUI.errorBox(qs('#errbox'), TBData.state.errors);
    fillSelect();
    draw();
    schedule();
  }).catch(e => TBUI.errorBox(qs('#errbox'), [e.message]));
  window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(draw, 200); });
})();
