/* =============================================================================
   Single market detail page
   ============================================================================= */
'use strict';
(function () {
  const { qs, esc, cents, centsLabel, compact, dollar, api } = TB;
  TB.renderHeader('market.html');
  TB.renderFooter();

  const params = new URLSearchParams(location.search);
  const ticker = params.get('ticker');
  let series = params.get('series') || (ticker ? ticker.split('-')[0] : null);
  let spanMin = 60;
  let mkt = null;

  async function loadMarket() {
    if (!ticker) return;
    mkt = TBData.marketByTicker(ticker);
    if (mkt) return;
    /* not in the scanned events: fetch it directly by ticker */
    try {
      const r = await api.get(`/markets/${encodeURIComponent(ticker)}`, null, { ttl: 0 });
      if (r && r.market) { mkt = TB.normMarket(r.market, { seriesTicker: series }); series = series || mkt.seriesTicker; }
    } catch (e) { /* handled by caller */ }
  }

  function renderHead() {
    const host = qs('#head');
    if (!mkt) {
      host.innerHTML = `<div class="banner bad"><b>Market not found.</b> ${ticker ? `The API did not return <span class="mono">${esc(ticker)}</span>.` : 'No ticker was supplied.'}
        Open this page from a table row or alert. <a href="index.html">Back to the dashboard</a>.</div>`;
      return;
    }
    host.innerHTML = `<div class="card">
      <div class="row" style="justify-content:space-between">
        <div><h1 style="font-size:1.25rem">${esc(mkt.title)}</h1>
          <div class="mono s">${esc(mkt.ticker)} · event ${esc(mkt.eventTicker || '—')} · ${esc(mkt.eventTitle || '')}</div></div>
        <div class="row">${TBUI.statusPill(mkt)}${mkt.result ? `<span class="pill ${mkt.result === 'yes' ? '' : 'down'} sm">${esc(mkt.result.toUpperCase())}</span>` : ''}</div>
      </div>
      <div class="grid g4" style="margin-top:.7rem">
        ${TBUI.kpi('Price', mkt.price === null ? '—' : centsLabel(cents(mkt.price)), mkt.priceKind === 'mid' ? 'bid/ask mid' : 'last trade')}
        ${TBUI.kpi('YES bid / ask', `${mkt.yesBid === null ? '—' : centsLabel(cents(mkt.yesBid))} / ${mkt.yesAsk === null ? '—' : centsLabel(cents(mkt.yesAsk))}`, 'top of book')}
        ${TBUI.kpi('24h volume', compact(mkt.volume24h), 'contracts')}
        ${TBUI.kpi('Open interest', compact(mkt.oi), 'contracts')}
      </div>
    </div>`;
  }

  async function draw() {
    if (!mkt) return;
    const now = Math.floor(Date.now() / 1000);
    const start = now - spanMin * 60;
    const iv = spanMin <= 360 ? 1 : spanMin <= 1440 ? 1 : 60;
    let candles = [];
    try {
      const r = await api.candlesticks(series || mkt.seriesTicker, mkt.ticker, iv, start, now);
      candles = (r.candlesticks || []).map(c => ({ t: c.end_period_ts * 1000, p: c.price && c.price.close_dollars != null ? cents(c.price.close_dollars) : null, v: Number(c.volume_fp) || 0 })).filter(c => c.p !== null);
    } catch (e) {
      candles = [];
      qs('#errbox').innerHTML = `<div class="banner warn">Candlesticks unavailable: ${esc(e.message)}. The chart still shows prices this browser observed.</div>`;
    }
    let pts = candles.concat(TBData.historyFor(mkt.ticker).filter(h => h.t >= start * 1000).map(h => ({ t: h.t, p: h.p })));
    pts.sort((a, b) => a.t - b.t);
    if (mkt.price !== null) pts.push({ t: Date.now(), p: cents(mkt.price) });
    const markers = TBData.alerts().filter(a => a.ticker === mkt.ticker).map(a => ({ t: a.at, delta: a.delta }));
    TBChart.line(qs('#chart'), { points: pts, markers, showVolume: true, label: `${mkt.ticker} · ${iv}-min candles` });

    try {
      const ob = await api.orderbook(mkt.ticker, 15);
      TBChart.ladder(qs('#ladder'), ob, { levels: 12, yesBid: mkt.yesBid, yesAsk: mkt.yesAsk });
      const l = TBChart.liquidity(ob, mkt.yesBid, mkt.yesAsk);
      qs('#liq').innerHTML = l ? `Bid ${compact(l.bidContracts)} · Ask ${compact(l.askContracts)} contracts resting.
        <a href="${esc(api.url(`/markets/${encodeURIComponent(mkt.ticker)}/orderbook`, { depth: 15 }))}" target="_blank" rel="noopener">raw</a>` : '';
    } catch (e) {
      qs('#ladder').innerHTML = `<div class="t-blank">${esc(e.message)}</div>`;
    }

    try {
      const r = await api.trades({ ticker: mkt.ticker, limit: 20 });
      const rows = r.trades || [];
      qs('#trades').className = '';
      qs('#trades').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Time</th><th class="num">Contracts</th><th class="num">YES ¢</th><th class="num">NO ¢</th><th>Side</th></tr></thead><tbody>
        ${rows.map(t => `<tr><td>${new Date(t.created_time).toLocaleString()}</td><td class="num">${esc(t.count_fp)}</td>
          <td class="num">${t.yes_price_dollars ? (Number(t.yes_price_dollars) * 100).toFixed(0) : '—'}</td>
          <td class="num">${t.no_price_dollars ? (Number(t.no_price_dollars) * 100).toFixed(0) : '—'}</td>
          <td>${esc(t.taker_outcome_side || t.taker_side || '—')}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="t-blank">No trades returned.</div>';
    } catch (e) {
      qs('#trades').textContent = e.message;
    }

    qs('#rules').innerHTML = esc(mkt.rules || '—');
    const site = (TB.ENVS[api.getEnv()] || {}).site;
    qs('#sources').innerHTML = `
      <div><a href="${esc(api.url(`/markets/${encodeURIComponent(mkt.ticker)}`))}" target="_blank" rel="noopener">GET /markets/${esc(mkt.ticker)}</a></div>
      <div><a href="${esc(api.url(`/series/${encodeURIComponent(series || mkt.seriesTicker)}/markets/${encodeURIComponent(mkt.ticker)}/candlesticks`, { period_interval: iv, start_ts: start, end_ts: now }))}" target="_blank" rel="noopener">candlesticks call used above</a></div>
      <div><a href="${esc(api.url(`/markets/${encodeURIComponent(mkt.ticker)}/orderbook`, { depth: 15 }))}" target="_blank" rel="noopener">order book</a></div>
      <div><a href="${esc(api.url('/markets/trades', { ticker: mkt.ticker, limit: 20 }))}" target="_blank" rel="noopener">trades</a></div>
      <div><a href="${esc(site + '/markets/' + (mkt.eventTicker || series || ''))}" target="_blank" rel="noopener">Kalshi market page</a></div>
      ${mkt.eventTicker ? `<div><a href="${esc(api.url('/events', { tickers: mkt.eventTicker, with_nested_markets: 'true' }))}" target="_blank" rel="noopener">event record</a></div>` : ''}`;
    updatePxHint();
  }

  function updatePxHint() {
    if (!mkt) return;
    const side = (qs('input[name="side"]:checked') || {}).value || 'yes';
    const px = side === 'yes' ? mkt.yesAsk : (mkt.noAsk != null ? mkt.noAsk : (mkt.yesBid != null ? 1 - mkt.yesBid : null));
    qs('#pxHint').textContent = px == null ? 'no tradable price' : `fills at ${centsLabel(cents(px))} (${side.toUpperCase()} ask)`;
  }

  qs('#span').addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    [...qs('#span').children].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    spanMin = Number(b.dataset.min); draw();
  });
  document.addEventListener('change', ev => { if (ev.target.name === 'side') updatePxHint(); });
  qs('#buyBtn').addEventListener('click', () => {
    if (!mkt) return;
    const side = (qs('input[name="side"]:checked') || {}).value || 'yes';
    const qty = Number(qs('#qty').value) || 10;
    const r = TBData.openTrade({ strategyId: null, market: mkt, side, qty, note: 'manual simulated' });
    qs('#orderMsg').innerHTML = r.ok
      ? `<div class="banner ok">Simulated fill: ${qty} ${side.toUpperCase()} at ${centsLabel(r.trade.entryCents)} · fee ${dollar(r.trade.fee, 4)}. <a href="portfolio.html">View portfolio →</a></div>`
      : `<div class="banner bad">${esc(r.error)}</div>`;
  });

  TBData.refresh({ events: { maxPages: 3 } }).then(async () => {
    TBUI.statusBar(qs('#statusbar'), TBData.state);
    await loadMarket();
    renderHead();
    await draw();
  }).catch(async e => {
    TBUI.errorBox(qs('#errbox'), [e.message]);
    await loadMarket();
    renderHead();
  });
})();
