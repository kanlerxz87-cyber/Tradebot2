/* Tradebot2 — Simulated trades + portfolio tracking (paper money, demo only)
   No real money, no API key collected. Categorizes trades by topic and type
   so a trader can see which strategy performs best. */

(function (window) {
  'use strict';

  const TB = window.Tradebot;
  if (!TB) return;

  const TRADE_TYPES = ['directional', 'mean-reversion', 'news-jump', 'spread'];

  // persistent simulated portfolio (demo / paper money only)
  function loadSim() {
    try {
      const raw = localStorage.getItem('tradebot_sim');
      if (raw) Object.assign(TB.state.sim, JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }
  function saveSim() {
    try { localStorage.setItem('tradebot_sim', JSON.stringify(TB.state.sim)); } catch (e) { /* ignore */ }
  }
  loadSim();

  function topicOfTicker(ticker) {
    const m = TB.state.markets[ticker];
    if (!m) return '—';
    const ev = TB.state.events[m.event_ticker];
    return (ev && ev.category) ? ev.category : '—';
  }

  function renderSim() {
    const balanceEl = document.getElementById('sim-balance');
    const pnlEl = document.getElementById('sim-pnl');
    const positionsEl = document.getElementById('sim-positions');
    const tradesEl = document.getElementById('sim-trades');
    const typeEls = document.querySelectorAll('[data-sim-type]');

    if (balanceEl) balanceEl.textContent = TB.fmtMoney(TB.state.sim.balance);

    // realized P&L from settled trades
    let realized = 0;
    let unrealized = 0;
    for (const t of TB.state.sim.trades) {
      if (t.status === 'settled') realized += (t.proceeds || 0) - (t.cost || 0);
    }
    // unrealized: value open positions at current price
    for (const [tk, pos] of Object.entries(TB.state.sim.positions || {})) {
      const m = TB.state.markets[tk];
      const cur = m && m.yes_bid_dollars != null ? Number(m.yes_bid_dollars) : pos.avgPrice;
      const sideMult = pos.side === 'yes' ? 1 : -1;
      unrealized += (cur - pos.avgPrice) * pos.count * sideMult;
    }
    if (pnlEl) {
      pnlEl.textContent = (realized + unrealized).toFixed(2);
      pnlEl.className = 'metric-value delta ' + ((realized + unrealized) >= 0 ? 'up' : 'down');
    }

    if (positionsEl) {
      positionsEl.innerHTML = '';
      const poss = Object.entries(TB.state.sim.positions || {});
      if (poss.length === 0) {
        positionsEl.innerHTML = '<div class="blank">No open simulated positions.</div>';
      } else {
        for (const [tk, pos] of poss) {
          const m = TB.state.markets[tk];
          const cur = m && m.yes_bid_dollars != null ? Number(m.yes_bid_dollars) : pos.avgPrice;
          const pnl = ((cur - pos.avgPrice) * pos.count).toFixed(2);
          const row = document.createElement('div');
          row.className = 'chat-item';
          row.innerHTML = `
            <div class="chat-meta" style="margin-bottom:0.25rem">
              <span class="ticker">${TB.escapeHtml(tk)}</span>
              <span style="color:#64748b">${TB.escapeHtml(pos.side)} • ${pos.count} contracts @ ${TB.fmtMoney(pos.avgPrice)}</span>
              <span class="delta ${pnl >= 0 ? 'up' : 'down'}" style="margin-left:auto">${pnl >= 0 ? '+' : ''}$${pnl}</span>
            </div>
            <div class="chat-text" style="font-size:0.8125rem;color:#475569">Current: ${TB.fmtMoney(cur)} • topic: ${TB.escapeHtml(topicOfTicker(tk))}</div>
          `;
          positionsEl.appendChild(row);
        }
      }
    }

    if (tradesEl) {
      tradesEl.innerHTML = '';
      const trades = TB.state.sim.trades.slice(0).reverse();
      if (trades.length === 0) {
        tradesEl.innerHTML = '<div class="chat-empty">No simulated trades yet.</div>';
      } else {
        for (const t of trades) {
          const row = document.createElement('div');
          row.className = 'chat-item';
          const pnl = t.status === 'settled' ? ((t.proceeds || 0) - (t.cost || 0)).toFixed(2) : '—';
          row.innerHTML = `
            <div class="chat-meta">
              <span>${new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span class="ticker">${TB.escapeHtml(t.ticker)}</span>
              <span style="color:#64748b">${TB.escapeHtml(t.side)} ×${t.count} @ ${TB.fmtMoney(t.price)}</span>
              <span style="color:#64748b">type: ${TB.escapeHtml(t.type || '—')}</span>
            </div>
            <div class="chat-text" style="font-size:0.8125rem">
              ${TB.escapeHtml(t.status)} • ${TB.fmtMoney(t.cost || t.proceeds || 0)}
              <span style="color:#64748b"> • P&L ${pnl >= 0 ? '+' : ''}$${pnl}</span>
            </div>
          `;
          tradesEl.appendChild(row);
        }
      }
    }

    if (typeEls.length) {
      // per-type performance
      const byType = {};
      for (const t of TB.state.sim.trades) {
        if (t.status !== 'settled') continue;
        const type = t.type || '—';
        if (!byType[type]) byType[type] = { n: 0, pnl: 0, wins: 0 };
        byType[type].n++;
        const pnl = (t.proceeds || 0) - (t.cost || 0);
        byType[type].pnl += pnl;
        if (pnl > 0) byType[type].wins++;
      }
      typeEls.forEach((el) => {
        const type = el.getAttribute('data-sim-type');
        const b = byType[type] || { n: 0, pnl: 0, wins: 0 };
        const winRate = b.n ? ((b.wins / b.n) * 100).toFixed(0) : '—';
        el.innerHTML = `
          <div class="metric">${TB.escapeHtml(type)} trades</div>
          <div class="metric-value">${b.n}</div>
          <div class="delta ${b.pnl >= 0 ? 'up' : 'down'}">${b.pnl >= 0 ? '+' : ''}$${b.pnl.toFixed(2)} • ${winRate}% win rate</div>
        `;
      });
    }
  }

  function openTradeForm() {
    const form = document.getElementById('sim-trade-form');
    if (!form) return;
    form.onsubmit = (e) => {
      e.preventDefault();
      const ticker = form.elements['ticker'].value.trim().toUpperCase();
      const side = form.elements['side'].value; // yes/no
      const count = Number(form.elements['count'].value);
      const price = Number(form.elements['price'].value);
      const type = form.elements['type'].value;
      if (!ticker || !count || !price) return;
      const m = TB.state.markets[ticker];
      if (!m) {
        alert('Unknown ticker. Use a real Kalshi ticker from the tables.');
        return;
      }
      const res = TB.simBuy(ticker, count, price, side);
      if (!res.ok) { alert(res.error); return; }
      TB.state.sim.trades[0].type = type;
      saveSim();
      renderSim();
      form.reset();
    };
  }

  window.TradebotSim = {
    loadSim, saveSim, renderSim, openTradeForm,
    simBuy: TB.simBuy, simSell: TB.simSell, simResolve: TB.simResolve,
  };

  // refresh simulated portfolio on price ticks
  const _startPoll = window.Tradebot.startPoll;
  window.Tradebot.startPoll = function (intervalMs) {
    _startPoll.call(window.Tradebot, intervalMs);
    setInterval(() => renderSim(), 5000);
  };

})(window);
