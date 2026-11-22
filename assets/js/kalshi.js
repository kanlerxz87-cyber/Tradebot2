/* Tradebot2 — Kalshi demo API client + price-swing alert system
   Static-site friendly: runs in the visitor's browser.
   Reads only public endpoints (no API key). Trading/portfolio endpoints require
   a signed demo API key, which this site never collects. */

(function (window) {
  'use strict';

  const DEMO_REST = 'https://external-api.demo.kalshi.co/trade-api/v2';
  const ALERT_THRESHOLD = 0.10; // $0.10 swing in either direction

  // Focus topics and how they map to Kalshi categories.
  // "gas prices" and "golf" are NOT top-level Kalshi categories; they are
  // tracked inside Economics and Sports respectively (flagged unverified).
  const TOPICS = {
    'gas-prices':   { label: 'Gas Prices',   category: 'Economics',   note: 'sub-topic of Economics (not a standalone Kalshi category)' },
    'elections':    { label: 'Elections',    category: 'Elections',   note: 'top-level Kalshi category' },
    'culture':      { label: 'Culture',      category: 'Culture',     note: 'top-level Kalshi category' },
    'crypto':       { label: 'Crypto',       category: 'Crypto',      note: 'top-level Kalshi category' },
    'golf':         { label: 'Golf',         category: 'Sports',      note: 'sub-topic of Sports (not a standalone Kalshi category)' },
  };

  const state = {
    connected: false,
    lastError: null,
    lastUpdate: null,
    prices: {},        // ticker -> { yes, no, ts }
    priceHistory: {},  // ticker -> [{t, yes}] for charts
    markets: {},       // ticker -> market summary
    events: {},        // event_ticker -> { title, category, status, markets: [] }
    alerts: [],        // all swing alerts
    modelAlerts: [],   // model-preferred (high ROI) alerts
    resolved: [],      // resolved events
    sim: { balance: 10000, trades: [], positions: {} }, // simulated portfolio (demo-only, paper money)
  };

  /* ---------- small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const fmtMoney = (v) => (v == null ? '—' : `$${Number(v).toFixed(2)}`);
  const fmtPct = (v) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);
  const nowTs = () => new Date().toISOString();
  const chatTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  /* ---------- API fetch ---------- */
  async function apiGet(path, params = {}) {
    const url = new URL(DEMO_REST + path);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
    });
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
  }

  /* ---------- connection status ---------- */
  function setConnected(online, err) {
    state.connected = online;
    state.lastError = err;
    state.lastUpdate = online ? nowTs() : state.lastUpdate;
    const els = document.querySelectorAll('[data-status]');
    els.forEach((el) => {
      el.classList.remove('online', 'offline');
      el.classList.add(online ? 'online' : 'offline');
      el.textContent = online ? 'Demo API connected' : 'Demo API offline / unreachable';
    });
    const errEls = document.querySelectorAll('[data-lasterror]');
    errEls.forEach((el) => {
      el.textContent = err ? `Last error: ${err.message}` : '—';
    });
  }

  /* ---------- model / ROI scoring (simplified, for the "model likes" filter) ---------- */
  // A very simple, transparent heuristic: large swing + high volume + price near 0.5
  // = more uncertainty = higher potential ROI. This is a placeholder model, not
  // financial advice, and is clearly labelled as simulated.
  function modelScore(market, swingAbs, volume) {
    const price = market.yes_bid_dollars != null ? Number(market.yes_bid_dollars) : 0.5;
    const uncertainty = 1 - Math.abs(price - 0.5) * 2; // 1 at 0.5, 0 at 0/1
    const volScore = Math.min(1, Math.log1p(Number(volume || 0)) / 5);
    return Number((0.5 * swingAbs + 0.3 * uncertainty + 0.2 * volScore).toFixed(3));
  }

  function isModelPreferred(market, swingAbs, volume) {
    return modelScore(market, swingAbs, volume) >= 0.55;
  }

  /* ---------- price-swing detection ---------- */
  function detectSwing(ticker, newPrice, side) {
    const prev = state.prices[ticker];
    if (!prev || prev[side] == null) return null;
    const swing = Number(newPrice) - Number(prev[side]);
    if (Math.abs(swing) < ALERT_THRESHOLD) return null;
    const m = state.markets[ticker];
    const vol = m ? m.volume_fp : 0;
    return {
      id: `${ticker}-${side}-${Date.now()}`,
      ticker,
      event_ticker: m ? m.event_ticker : '',
      side, // 'yes' or 'no'
      oldPrice: prev[side],
      newPrice: Number(newPrice),
      swing,
      direction: swing > 0 ? 'up' : 'down',
      volume: vol,
      ts: nowTs(),
      score: modelScore(m, Math.abs(swing), vol),
    };
  }

  function addAlert(alert) {
    state.alerts.unshift(alert);
    if (state.alerts.length > 500) state.alerts.pop();
    if (isModelPreferred(state.markets[alert.ticker], Math.abs(alert.swing), alert.volume)) {
      state.modelAlerts.unshift(alert);
      if (state.modelAlerts.length > 500) state.modelAlerts.pop();
    }
    renderChat('chat-all', state.alerts);
    renderChat('chat-model', state.modelAlerts);
  }

  /* ---------- render: tables ---------- */
  function renderTopicTable(topicKey) {
    const topic = TOPICS[topicKey];
    const container = $(`#topic-table-${topicKey}`);
    if (!container) return;
    const tbody = container.querySelector('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let markets = Object.values(state.markets).filter((m) => {
      const ev = state.events[m.event_ticker];
      if (!ev) return false;
      if (topicKey === 'gas-prices') return ev.category === 'Economics' && /gas|fuel|energy/i.test((ev.title || '') + ' ' + (m.title || ''));
      if (topicKey === 'golf') return ev.category === 'Sports' && /golf/i.test((ev.title || '') + ' ' + (m.title || ''));
      return ev.category === topic.category;
    });

    if (markets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="blank">No live markets found for this topic yet.</td></tr>`;
      return;
    }

    markets.sort((a, b) => (Number(b.volume_fp || 0) || 0) - (Number(a.volume_fp || 0) || 0));

    for (const m of markets) {
      const ev = state.events[m.event_ticker] || {};
      const yes = m.yes_bid_dollars != null ? Number(m.yes_bid_dollars) : null;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="ticker">${escapeHtml(m.ticker)}</span></td>
        <td>${escapeHtml(ev.title || m.title || '—')}</td>
        <td><span class="topic ${ev.category ? ev.category.toLowerCase().replace(/\s+/g,'-') : ''}">${escapeHtml(ev.category || '—')}</span></td>
        <td>${fmtMoney(yes)}</td>
        <td class="blank">${m.yes_ask_dollars != null ? fmtMoney(Number(m.yes_ask_dollars)) : '—'}</td>
        <td>${m.volume_fp != null ? Number(m.volume_fp).toLocaleString() : '—'}</td>
        <td><span class="source-link" data-ticker="${m.ticker}">${escapeHtml(m.event_ticker || '—')}</span></td>
        <td>${ev.status || '—'}</td>
      `;
      tbody.appendChild(tr);
    }

    // wire up source links to open the single-market page
    tbody.querySelectorAll('.source-link[data-ticker]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const tk = el.getAttribute('data-ticker');
        window.location.href = `chart.html?ticker=${encodeURIComponent(tk)}`;
      });
    });
  }

  function renderAllTables() {
    Object.keys(TOPICS).forEach(renderTopicTable);
  }

  /* ---------- render: scrolling chats ---------- */
  function renderChat(id, alerts) {
    const el = $(`#${id}`);
    if (!el) return;
    el.innerHTML = '';
    if (alerts.length === 0) {
      el.insertAdjacentHTML('beforeend', '<div class="chat-empty">No alerts yet. Price swings ≥ $0.10 appear here.</div>');
      return;
    }
    // newest at top
    for (const a of alerts.slice(0).reverse()) {
      const dirClass = a.direction === 'up' ? 'up' : 'down';
      const item = document.createElement('div');
      item.className = `chat-item ${a.model ? 'model' : ''} ${Math.abs(a.swing) >= 0.20 ? 'high' : ''}`;
      const upDown = a.direction === 'up' ? '▲' : '▼';
      item.innerHTML = `
        <div class="chat-meta">
          <span>${chatTime()}</span>
          <span>${escapeHtml(a.ticker)}</span>
          <span>${escapeHtml(a.event_ticker || '')}</span>
          <span style="color:${a.direction === 'up' ? '#059669' : '#dc2626'}">${upDown} ${a.direction}</span>
        </div>
        <div class="chat-text">
          Yes price <span class="price">${fmtMoney(a.oldPrice)}</span> → <span class="price">${fmtMoney(a.newPrice)}</span>
          <span style="color:#64748b;font-weight:600"> swing ${a.swing >= 0 ? '+' : ''}$${a.swing.toFixed(2)}</span>
          <span style="color:#64748b"> • vol ${a.volume != null ? Number(a.volume).toLocaleString() : '—'}</span>
        </div>
      `;
      el.appendChild(item);
    }
    el.scrollTop = el.scrollHeight;
  }

  /* ---------- poll loop ---------- */
  let pollTimer = null;
  let polling = false;

  async function pollOnce() {
    if (polling) return;
    polling = true;
    try {
      // Get open markets (paginated). We page through a few cursors to build a topic index.
      let cursor = null;
      let pages = 0;
      const seen = new Set();
      do {
        const data = await apiGet('/markets', { status: 'open', limit: 200, cursor });
        const markets = data.markets || [];
        for (const m of markets) {
          if (seen.has(m.ticker)) continue;
          seen.add(m.ticker);
          state.markets[m.ticker] = m;
          // index parent event
          const et = m.event_ticker;
          if (et && !state.events[et]) {
            state.events[et] = {
              title: m.title,
              category: m.category || '—',
              status: m.status || 'open',
              markets: [],
            };
          }
          if (et) state.events[et].markets.push(m.ticker);

          // price-swing detection on yes bid
          if (m.yes_bid_dollars != null) {
            const swing = detectSwing(m.ticker, m.yes_bid_dollars, 'yes');
            if (swing) {
              state.prices[m.ticker] = { ...(state.prices[m.ticker] || {}), yes: Number(m.yes_bid_dollars), ts: nowTs() };
              addAlert(swing);
            } else {
              state.prices[m.ticker] = { ...(state.prices[m.ticker] || {}), yes: Number(m.yes_bid_dollars), ts: nowTs() };
            }
          }
          // keep a short rolling price history for charts (last 500 points per ticker)
          if (m.yes_bid_dollars != null) {
            const h = state.priceHistory[m.ticker] || [];
            h.push({ t: Date.now(), yes: Number(m.yes_bid_dollars) });
            if (h.length > 500) h.shift();
            state.priceHistory[m.ticker] = h;
          }
        }
        cursor = data.cursor || null;
        pages++;
      } while (cursor && pages < 3); // cap pages for static-site friendliness

      setConnected(true, null);
      renderAllTables();
    } catch (err) {
      console.error('Kalshi poll error:', err);
      setConnected(false, err);
    } finally {
      polling = false;
    }
  }

  function startPoll(intervalMs = 15000) {
    pollOnce();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollOnce, intervalMs);
  }
  function stopPoll() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  /* ---------- simulated trades + portfolio (paper money, demo only) ---------- */
  function simBuy(ticker, count, price, side = 'yes') {
    const cost = Number(count) * Number(price);
    if (state.sim.balance < cost) return { ok: false, error: 'Insufficient simulated balance' };
    const trade = {
      id: 'sim-' + Date.now(),
      ticker, side, count: Number(count), price: Number(price), cost,
      ts: nowTs(), status: 'open',
    };
    state.sim.balance -= cost;
    state.sim.trades.unshift(trade);
    const key = ticker;
    if (!state.sim.positions[key]) state.sim.positions[key] = { side, count: 0, avgPrice: 0 };
    const pos = state.sim.positions[key];
    pos.avgPrice = ((pos.avgPrice * pos.count) + (price * count)) / (pos.count + count);
    pos.count += count;
    return { ok: true, trade };
  }

  function simSell(ticker, count, price) {
    const pos = state.sim.positions[ticker];
    if (!pos || pos.count < count) return { ok: false, error: 'Not enough simulated contracts' };
    const proceeds = Number(count) * Number(price);
    state.sim.balance += proceeds;
    pos.count -= count;
    const trade = {
      id: 'sim-' + Date.now(),
      ticker, side: 'sell', count: Number(count), price: Number(price), proceeds,
      ts: nowTs(), status: 'closed',
    };
    state.sim.trades.unshift(trade);
    if (pos.count === 0) delete state.sim.positions[ticker];
    return { ok: true, trade };
  }

  function simResolve(ticker, outcome) {
    // outcome: 'yes' or 'no'
    const pos = state.sim.positions[ticker];
    if (!pos) return { ok: false, error: 'No open position' };
    const won = pos.side === outcome;
    const payout = won ? pos.count * 1.0 : 0;
    state.sim.balance += payout;
    const trade = {
      id: 'sim-' + Date.now(),
      ticker, side: 'settle', count: pos.count, price: won ? 1 : 0, proceeds: payout,
      ts: nowTs(), status: 'settled', outcome, won,
    };
    state.sim.trades.unshift(trade);
    delete state.sim.positions[ticker];
    state.resolved.push({ ticker, outcome, ts: nowTs(), payout });
    return { ok: true, trade, won, payout };
  }

  /* ---------- expose ---------- */
  window.Tradebot = {
    TOPICS, state, ALERT_THRESHOLD,
    apiGet, setConnected, startPoll, stopPoll,
    simBuy, simSell, simResolve, detectSwing, addAlert,
    renderAllTables, renderChat,
    fmtMoney, fmtPct,
    escapeHtml: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;'),
  };

})(window);
