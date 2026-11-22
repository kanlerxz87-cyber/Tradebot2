/* Dashboard controller.
 * Reads the committed snapshots in /data, and — when the browser is allowed to
 * reach the demo API — refreshes public reads live. Every number rendered here
 * comes either from a committed snapshot or from a live API response; nothing is
 * synthesized in the browser.
 */
(function () {
  const TB = (window.TB = window.TB || {});
  const state = {
    markets: [], alerts: null, orderbooks: {}, meta: null, resolutions: null,
    strategies: null, analytics: null, portfolio: null, trades: [],
    topic: 'all', chartTicker: null, chart: null, live: false, seenAlerts: new Set(),
    lastAlertsAt: 0,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  async function loadAll() {
    const files = ['meta', 'markets', 'alerts', 'orderbooks', 'resolutions', 'analytics',
                   'strategies', 'portfolio', 'paper_trades'];
    const out = {};
    await Promise.all(files.map(async (f) => {
      try { out[f] = await TB.getJSON('data/' + f + '.json'); }
      catch (e) { console.warn('missing', f, e.message); out[f] = null; }
    }));
    state.meta = out.meta;
    state.markets = out.markets?.markets || [];
    state.alerts = out.alerts;
    state.orderbooks = out.orderbooks?.orderbooks || {};
    state.resolutions = out.resolutions;
    state.analytics = out.analytics;
    state.strategies = out.strategies?.strategies || [];
    state.portfolio = out.portfolio;
    state.trades = out.paper_trades?.trades || [];
  }

  /* ---------- header / KPI strip ---------- */
  function renderHeader() {
    const meta = state.meta || {};
    const pill = $('#livePill');
    if (pill) {
      if (meta.awaiting_first_live_run || !meta.collected_at) {
        pill.textContent = 'demo · awaiting first live cycle';
        pill.className = 'pill';
      } else {
        pill.textContent = (meta.environment || 'demo') + ' · ' + TB.timeAgo(meta.collected_at);
        pill.className = 'pill live';
      }
    }
    const counts = state.alerts?.counts || {};
    const openMkts = state.markets.length;
    const kpis = [
      ['Tracked markets', TB.fmtNum(openMkts), 'open markets across the five topics'],
      ['Open events', TB.fmtNum(new Set(state.markets.map((m) => m.event_ticker)).size), 'distinct events in the snapshot'],
      ['≥ $0.10 swings', TB.fmtNum(counts.all || 0), (counts.up || 0) + ' up · ' + (counts.down || 0) + ' down'],
      ['High-ROI alerts', TB.fmtNum(counts.high_roi || 0), 'model ROI ≥ 25% and price $0.10–$0.90'],
      ['Resolved', TB.fmtNum(state.resolutions?.counts?.resolved || 0),
        (state.resolutions?.counts?.resolved_yes || 0) + ' yes · ' + (state.resolutions?.counts?.resolved_no || 0) + ' no'],
      ['Paper P&L', TB.fmtMoney(state.analytics?.overall?.realized_pnl_dollars || 0),
        (state.analytics?.overall?.settled || 0) + ' settled of ' + (state.analytics?.overall?.trades || 0)],
    ];
    const host = $('#kpis');
    if (!host) return;
    host.innerHTML = kpis.map(([k, v, s]) => `
      <div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  }

  /* ---------- the two chat feeds ---------- */
  function alertMessage(a, opts = {}) {
    const dir = a.direction === 'up' ? 'up' : 'down';
    const arrow = dir === 'up' ? '▲' : '▼';
    const sign = a.move_dollars > 0 ? '+' : '';
    const model = a.model || {};
    const isNew = opts.isNew ? ' new' : '';
    return `<div class="msg ${dir}${isNew}" data-ticker="${TB.esc(a.ticker)}">
      <div class="head">
        ${TB.topicTag(a.topic)}
        <strong>${TB.esc(a.title || a.ticker)}</strong>
        ${a.subtitle ? '<span>' + TB.esc(a.subtitle) + '</span>' : ''}
        <span style="margin-left:auto">${TB.utc(a.to_time) || TB.timeAgo(a.to_time)}</span>
      </div>
      <div class="body">
        <strong style="color:var(--${dir})">${arrow} ${sign}$${Math.abs(a.move_dollars).toFixed(4)}</strong>
        <span class="muted">&nbsp;$${a.from_price.toFixed(4)} → $${a.to_price.toFixed(4)}</span>
        ${a.move_pct != null ? `<span class="muted">&nbsp;(${a.move_pct > 0 ? '+' : ''}${a.move_pct}%)</span>` : ''}
      </div>
      <div class="head" style="margin-top:4px">
        <span class="tag">${TB.esc(model.strategy_id || '')}</span>
        <span>fade → buy ${TB.esc(model.side || '')} @ $${(model.entry_dollars || 0).toFixed(4)}</span>
        <span>ROI on risk <strong style="color:var(--up)">${model.roi_on_risk_pct != null ? model.roi_on_risk_pct + '%' : '—'}</strong></span>
        ${TB.sourceLink(a.source_url, 'API ↗')}
      </div>
      <div class="head" style="margin-top:2px">
        <a href="topics/${TB.esc(a.topic)}.html#${encodeURIComponent(a.ticker)}">open topic page</a>
        <button class="btn" style="padding:2px 8px" data-chart="${TB.esc(a.ticker)}">chart</button>
      </div>
    </div>`;
  }

  function renderFeeds(isNewBatch = false) {
    const all = state.alerts?.all_feed || [];
    const roi = state.alerts?.high_roi_feed || [];
    const allHost = $('#chatAll');
    const roiHost = $('#chatRoi');
    if (allHost) {
      allHost.innerHTML = all.length
        ? all.map((a) => alertMessage(a, { isNew: isNewBatch && !state.seenAlerts.has(a.to_ts + a.ticker) })).join('')
        : '<div class="chat-empty">No ≥ $0.10 move captured yet. The collector writes one observation per market every cycle; a swing appears here as soon as two observations are at least $0.10 apart.</div>';
    }
    if (roiHost) {
      roiHost.innerHTML = roi.length
        ? roi.map((a) => alertMessage(a, { isNew: isNewBatch && !state.seenAlerts.has(a.to_ts + a.ticker) })).join('')
        : '<div class="chat-empty">No high-ROI alerts yet. Filter: model ROI on risk ≥ 25% and entry price between $0.10 and $0.90.</div>';
    }
    all.forEach((a) => state.seenAlerts.add(a.to_ts + a.ticker));
  }

  /* ---------- topic tables ---------- */
  function marketRow(m) {
    const ob = state.orderbooks[m.ticker];
    const res = (state.resolutions?.records || []).find((r) => r.ticker === m.ticker);
    const bid = m.yes_bid_dollars != null ? parseFloat(m.yes_bid_dollars) : null;
    const ask = m.yes_ask_dollars != null ? parseFloat(m.yes_ask_dollars) : null;
    const result = m.result || res?.result;
    return `<tr id="${TB.esc(m.ticker)}">
      <td>${TB.topicTag(m.topic)}</td>
      <td><strong>${TB.esc(m.title || m.ticker)}</strong>
        <div class="small muted">${TB.esc(m.subtitle || '')} · ${TB.esc(m.ticker)}</div></td>
      <td class="num">${TB.fmtPrice(bid)}</td>
      <td class="num">${TB.fmtPrice(ask)}</td>
      <td class="num">${ob ? TB.fmtNum(ob.contracts_ask, 0) : '<span class="muted">—</span>'}</td>
      <td class="num">${ob ? TB.fmtMoney(ob.notional_ask_dollars) : '<span class="muted">—</span>'}</td>
      <td class="num">${TB.fmtMoney(m.est_volume_24h_dollars)}</td>
      <td class="num">${TB.fmtNum(m.open_interest_fp ? parseFloat(m.open_interest_fp) : null)}</td>
      <td>${result ? `<span class="tag ${result}">${TB.esc(result)}</span>` : '<span class="muted">open</span>'}</td>
      <td>${TB.sourceLink(m.api_url, 'API ↗')}
        <button class="btn" style="padding:2px 7px;margin-left:4px" data-chart="${TB.esc(m.ticker)}">chart</button></td>
    </tr>`;
  }

  function renderTables() {
    const rows = state.markets.filter((m) => state.topic === 'all' || m.topic === state.topic);
    const byTopic = {};
    rows.forEach((m) => (byTopic[m.topic] = byTopic[m.topic] || []).push(m));
    const host = $('#topicTables');
    if (!host) return;
    const order = TB.TOPICS.map((t) => t.id).filter((id) => byTopic[id]);
    host.innerHTML = order.map((id) => {
      const list = byTopic[id].slice().sort((a, b) => (b.est_volume_24h_dollars || 0) - (a.est_volume_24h_dollars || 0));
      return `<div class="section" id="tbl-${id}">
        <h2>${TB.esc(TB.TOPICS.find((t) => t.id === id).name)}
          <span class="muted small">· ${list.length} markets · <a href="topics/${id}.html">topic page →</a></span></h2>
        <div class="tablewrap"><table>
          <thead><tr>
            <th>Topic</th><th>Market</th><th class="num">YES bid</th><th class="num">YES ask</th>
            <th class="num">Contracts at best ask</th><th class="num">Ask-side $</th>
            <th class="num">Est. 24h $ volume</th><th class="num">Open interest</th><th>Result</th><th>Source</th>
          </tr></thead>
          <tbody>${list.map(marketRow).join('')}</tbody>
        </table></div>
      </div>`;
    }).join('') || '<p class="muted">No markets in this snapshot.</p>';
  }

  /* ---------- chart panel ---------- */
  async function openChart(ticker) {
    state.chartTicker = ticker;
    const panel = $('#chartPanel');
    if (!panel) return;
    panel.hidden = false;
    const m = state.markets.find((x) => x.ticker === ticker);
    $('#chartTitle').innerHTML = `${TB.esc(m?.title || ticker)} <span class="muted small">${TB.esc(m?.subtitle || '')} · ${TB.esc(ticker)}</span>`;
    const ob = state.orderbooks[ticker];
    $('#chartBook').innerHTML = ob ? renderBook(ob) : '<p class="muted small">No order book captured for this market in the latest cycle.</p>';
    if (!state.chart) state.chart = new TB.PriceChart($('#chartCanvas'), { range: '1h' });
    try {
      const doc = await TB.getJSON('data/history/' + encodeURIComponent(ticker) + '.json');
      state.chart.setPoints(doc.points || []);
      state.chart.setMarkers((state.alerts?.all_feed || []).filter((a) => a.ticker === ticker));
    } catch (e) {
      state.chart.setPoints([]);
    }
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderBook(ob) {
    const lvl = (rows, cls) => rows.map(([p, c]) =>
      `<div class="head"><span class="${cls}">$${Number(p).toFixed(4)}</span>
       <span style="margin-left:auto">${TB.fmtNum(c, 0)} contracts</span></div>`).join('');
    const bids = ob.yes_bids.slice().reverse().slice(0, 8);
    const asks = ob.yes_asks_implied.slice(0, 8);
    return `<div class="two" style="gap:10px">
      <div><h3 style="margin-top:0">YES bids <span class="muted small">(buyers)</span></h3>
        ${bids.length ? lvl(bids, '') : '<p class="muted small">empty</p>'}
        <p class="small muted">Total ${TB.fmtNum(ob.contracts_bid, 0)} contracts · ${TB.fmtMoney(ob.notional_bid_dollars)}</p></div>
      <div><h3 style="margin-top:0">YES asks <span class="muted small">(implied from NO bids)</span></h3>
        ${asks.length ? lvl(asks, '') : '<p class="muted small">empty</p>'}
        <p class="small muted">Total ${TB.fmtNum(ob.contracts_ask, 0)} contracts · ${TB.fmtMoney(ob.notional_ask_dollars)}</p></div>
    </div>
    <p class="small muted">Spread ${ob.spread_dollars != null ? '$' + ob.spread_dollars.toFixed(4) : '—'} ·
      captured ${TB.utc(ob.captured_at)} · ${TB.sourceLink(ob.api_url, 'order book API ↗')}</p>`;
  }

  /* ---------- live mode (public reads) ---------- */
  async function probeLive() {
    const hosts = ['https://external-api.demo.kalshi.co/trade-api/v2', 'https://demo-api.kalshi.co/trade-api/v2'];
    for (const h of hosts) {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(h + '/exchange/status', { signal: ctl.signal });
        clearTimeout(t);
        if (r.ok) {
          const j = await r.json();
          TB.liveHost = h;
          state.live = !!j.exchange_active;
          const el = $('#liveMode');
          if (el) {
            el.textContent = state.live ? 'LIVE API reachable' : 'API reachable, exchange inactive';
            el.className = 'pill ' + (state.live ? 'live' : '');
          }
          return;
        }
      } catch (e) { /* CORS or network: fall through */ }
    }
    const el = $('#liveMode');
    if (el) { el.textContent = 'snapshot mode (API not reachable from this browser)'; el.className = 'pill'; }
  }

  async function refreshLiveQuotes() {
    if (!state.live || !TB.liveHost) return;
    // Public, unauthenticated read of the tracked markets (batched per event).
    const events = Array.from(new Set(state.markets.map((m) => m.event_ticker))).slice(0, 25);
    let updated = 0;
    for (const ev of events) {
      try {
        const r = await fetch(`${TB.liveHost}/markets?event_ticker=${encodeURIComponent(ev)}`);
        if (!r.ok) continue;
        const j = await r.json();
        (j.markets || []).forEach((mk) => {
          const local = state.markets.find((x) => x.ticker === mk.ticker);
          if (!local) return;
          ['yes_bid_dollars', 'yes_ask_dollars', 'last_price_dollars', 'open_interest_fp',
           'volume_24h_fp', 'status'].forEach((k) => { if (mk[k] != null) local[k] = mk[k]; });
          updated++;
        });
      } catch (e) { /* ignore individual failures */ }
    }
    if (updated) {
      $('#liveQuotes') && ($('#liveQuotes').textContent = `${updated} live quotes merged ${TB.timeAgo(new Date().toISOString())}`);
      renderHeader(); renderTables();
    }
  }

  /* ---------- wiring ---------- */
  function wire() {
    $$('#topicFilter button').forEach((b) => {
      b.addEventListener('click', () => {
        state.topic = b.dataset.topic;
        $$('#topicFilter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        renderTables();
      });
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-chart]');
      if (t) { e.preventDefault(); openChart(t.dataset.chart); }
    });
    $$('#chartRanges button').forEach((b) => {
      b.addEventListener('click', () => {
        $$('#chartRanges button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        state.chart && state.chart.setRange(b.dataset.range);
      });
    });
    const q = $('#search');
    if (q) {
      q.addEventListener('input', () => {
        const v = q.value.trim().toLowerCase();
        $$('#topicTables tbody tr').forEach((tr) => {
          tr.style.display = !v || tr.textContent.toLowerCase().includes(v) ? '' : 'none';
        });
      });
    }
    const pause = $('#pauseFeed');
    if (pause) {
      pause.addEventListener('click', () => {
        state.paused = !state.paused;
        pause.textContent = state.paused ? 'Resume feed' : 'Pause feed';
      });
    }
  }

  async function boot() {
    await loadAll();
    renderHeader();
    renderFeeds();
    renderTables();
    wire();
    probeLive();
    if (!state.markets.length) {
      const host = document.querySelector('#topicTables');
      if (host) {
        host.innerHTML = `<div class="section note"><strong>No live cycle has been committed yet.</strong>
          Collection runs in GitHub Actions (<code>.github/workflows/collect.yml</code>) because the build
          sandbox cannot reach <code>*.kalshi.co</code>. The tables fill in automatically on the first run;
          this page deliberately shows an empty state rather than sample data.
          See <a href="flagged.html#F-01">F-01</a> for the network evidence.</div>`;
      }
      return;
    }
    if (state.markets.length) {
      const first = state.markets.slice().sort((a, b) => (b.est_volume_24h_dollars || 0) - (a.est_volume_24h_dollars || 0))[0];
      if (first) openChart(first.ticker);
    }
    setInterval(async () => {
      await loadAll();
      renderHeader();
      if (!state.paused) renderFeeds(true);
      renderTables();
    }, 60000);
    setInterval(refreshLiveQuotes, 30000);
  }

  document.addEventListener('DOMContentLoaded', boot);
  TB.dashboard = state;
})();
