/* Topic page controller: one page per topic, same data files, filtered view. */
(function () {
  const TB = (window.TB = window.TB || {});
  const topic = document.body.dataset.topic;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const state = { markets: [], orderbooks: {}, alerts: null, resolutions: null, meta: null, chart: null };

  async function load() {
    const get = async (n) => { try { return await TB.getJSON('data/' + n + '.json'); } catch (e) { return null; } };
    const [meta, markets, ob, alerts, res] = await Promise.all(
      ['meta', 'markets', 'orderbooks', 'alerts', 'resolutions'].map(get));
    state.meta = meta;
    state.markets = (markets?.markets || []).filter((m) => m.topic === topic);
    state.orderbooks = ob?.orderbooks || {};
    state.alerts = alerts;
    state.resolutions = res;
  }

  function renderMeta() {
    const t = (state.meta?.topics || []).find((x) => x.id === topic);
    if (!t) return;
    $('#rules').innerHTML = t.rules.map((r) => `<li><code>${TB.esc(r)}</code></li>`).join('');
    $('#blurb').textContent = t.blurb;
    $('#seriesCount').textContent = t.series_matched;
    // Each ticker links to the documented series endpoint filtered to that ticker,
    // so the claim "this series exists and matched" is one click from an API read.
    // Each ticker links to the documented series-list endpoint with a tickers filter,
    // so every "this series matched" claim is one click from an API read.
    $('#seriesList').innerHTML = (t.series || []).slice(0, 60)
      .map((s) => `<a href="${TB.seriesUrl(s)}" title="Official series object for ${TB.esc(s)}"
        target="_blank" rel="noopener">${TB.esc(s)}</a>`).join(' · ');
  }

  function renderKpis() {
    const ms = state.markets;
    const alerts = (state.alerts?.all_feed || []).filter((a) => a.topic === topic);
    const roi = (state.alerts?.high_roi_feed || []).filter((a) => a.topic === topic);
    const resolved = (state.resolutions?.records || []).filter((r) => r.topic === topic && r.state === 'resolved');
    const vol = ms.reduce((s, m) => s + (m.est_volume_24h_dollars || 0), 0);
    const kpis = [
      ['Markets', TB.fmtNum(ms.length), 'active markets in this topic'],
      ['Series matched', TB.fmtNum((state.meta?.topics || []).find((t) => t.id === topic)?.series_matched || 0), 'by the published rules below'],
      ['Est. 24h $ volume', TB.fmtMoney(vol), 'sum of volume × price across markets'],
      ['≥ $0.10 swings', TB.fmtNum(alerts.length), 'captured in the saved history'],
      ['High-ROI swings', TB.fmtNum(roi.length), 'model ROI ≥ 25%'],
      ['Resolved', TB.fmtNum(resolved.length),
        resolved.filter((r) => r.result === 'yes').length + ' yes · ' + resolved.filter((r) => r.result === 'no').length + ' no'],
    ];
    $('#kpis').innerHTML = kpis.map(([k, v, s]) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  function rows() {
    return state.markets.slice().sort((a, b) => (b.est_volume_24h_dollars || 0) - (a.est_volume_24h_dollars || 0));
  }

  function renderTable() {
    const body = $('#marketRows');
    body.innerHTML = rows().map((m) => {
      const ob = state.orderbooks[m.ticker];
      const res = (state.resolutions?.records || []).find((r) => r.ticker === m.ticker);
      const result = m.result || res?.result;
      return `<tr id="${TB.esc(m.ticker)}">
        <td><strong>${TB.esc(m.title || m.ticker)}</strong>
          <div class="small muted">${TB.esc(m.subtitle || '')}</div>
          <div class="small muted"><code>${TB.esc(m.ticker)}</code></div></td>
        <td class="num">${TB.fmtPrice(m.yes_bid_dollars)}<br><span class="small muted">ask ${TB.fmtPrice(m.yes_ask_dollars)}</span></td>
        <td class="num">${m.mid_dollars ? TB.fmtPrice(m.mid_dollars) : '<span class="muted">—</span>'}</td>
        <td class="num">${ob ? TB.fmtNum(ob.contracts_ask, 0) : '—'}</td>
        <td class="num">${ob ? TB.fmtMoney(ob.notional_ask_dollars) : '—'}</td>
        <td class="num">${TB.fmtMoney(m.est_volume_24h_dollars)}</td>
        <td class="num">${TB.fmtNum(m.open_interest_fp ? parseFloat(m.open_interest_fp) : null)}</td>
        <td>${result ? `<span class="tag ${result}">${TB.esc(result)}</span>` : '<span class="muted">open</span>'}</td>
        <td class="small">${TB.utc(m.close_time)}</td>
        <td>${TB.sourceLink(m.api_url, 'API ↗')}
          <button class="btn" style="padding:2px 7px" data-chart="${TB.esc(m.ticker)}">chart</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" class="muted">No open markets in this topic in the latest snapshot.</td></tr>';
  }

  function renderFeed() {
    const list = (state.alerts?.all_feed || []).filter((a) => a.topic === topic);
    $('#feed').innerHTML = list.length ? list.map((a) => {
      const dir = a.direction === 'up' ? 'up' : 'down';
      return `<div class="msg ${dir}">
        <div class="head"><strong>${TB.esc(a.title || a.ticker)}</strong>
          ${a.subtitle ? '<span>' + TB.esc(a.subtitle) + '</span>' : ''}
          <span style="margin-left:auto">${TB.utc(a.to_time)}</span></div>
        <div class="body">${a.direction === 'up' ? '▲' : '▼'}
          <strong>$${Math.abs(a.move_dollars).toFixed(4)}</strong>
          <span class="muted">$${a.from_price.toFixed(4)} → $${a.to_price.toFixed(4)}</span>
          ${a.model ? `<span class="tag" style="margin-left:6px">ROI ${a.model.roi_on_risk_pct}%</span>` : ''}
          <button class="btn" style="padding:1px 6px;margin-left:6px" data-chart="${TB.esc(a.ticker)}">chart</button></div>
      </div>`;
    }).join('') : '<div class="chat-empty">No ≥ $0.10 swing captured for this topic yet.</div>';
  }

  async function openChart(ticker) {
    const m = state.markets.find((x) => x.ticker === ticker);
    $('#chartPanel').hidden = false;
    $('#chartTitle').innerHTML = `${TB.esc(m?.title || ticker)}
      <span class="muted small">${TB.esc(m?.subtitle || '')} · ${TB.esc(ticker)}</span>`;
    if (!state.chart) state.chart = new TB.PriceChart($('#chartCanvas'), { range: '1h' });
    try {
      const doc = await TB.getJSON('data/history/' + encodeURIComponent(ticker) + '.json');
      state.chart.setPoints(doc.points || []);
      state.chart.setMarkers((state.alerts?.all_feed || []).filter((a) => a.ticker === ticker));
    } catch (e) { state.chart.setPoints([]); }
    const ob = state.orderbooks[ticker];
    $('#chartBook').innerHTML = ob
      ? `<h3 style="margin-top:0">Order book</h3>
         <div class="kv"><dt>Best YES bid</dt><dd>${TB.fmtPrice(ob.best_yes_bid)}</dd>
         <dt>Best YES ask</dt><dd>${TB.fmtPrice(ob.best_yes_ask)}</dd>
         <dt>Spread</dt><dd>${ob.spread_dollars != null ? '$' + ob.spread_dollars.toFixed(4) : '—'}</dd>
         <dt>Contracts bid</dt><dd>${TB.fmtNum(ob.contracts_bid, 0)}</dd>
         <dt>Contracts ask</dt><dd>${TB.fmtNum(ob.contracts_ask, 0)}</dd>
         <dt>Bid notional</dt><dd>${TB.fmtMoney(ob.notional_bid_dollars)}</dd>
         <dt>Ask notional</dt><dd>${TB.fmtMoney(ob.notional_ask_dollars)}</dd>
         <dt>Source</dt><dd>${TB.sourceLink(ob.api_url, 'order book API ↗')}</dd></div>
         <p class="small muted">Bids are YES bids; asks are implied from NO bids (1 − NO bid), per the
         <a href="https://docs.kalshi.com/getting_started/orderbook_responses" target="_blank" rel="noopener">order book docs</a>.</p>`
      : '<p class="muted small">No order book captured for this market.</p>';
    $('#chartPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function wire() {
    $$('#chartRanges button').forEach((b) => b.addEventListener('click', () => {
      $$('#chartRanges button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      state.chart && state.chart.setRange(b.dataset.range);
    }));
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-chart]');
      if (t) { e.preventDefault(); openChart(t.dataset.chart); }
    });
    const q = $('#search');
    q && q.addEventListener('input', () => {
      const v = q.value.trim().toLowerCase();
      $$('#marketRows tr').forEach((tr) => {
        tr.style.display = !v || tr.textContent.toLowerCase().includes(v) ? '' : 'none';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await load();
    renderMeta(); renderKpis(); renderTable(); renderFeed(); wire();
    if (state.markets.length) {
      openChart(rows()[0].ticker);
    }
    setInterval(async () => { await load(); renderKpis(); renderTable(); renderFeed(); }, 60000);
  });
})();
