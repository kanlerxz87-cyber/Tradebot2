/* ============================================================
 * Orderbook depth — renders top of book: YES bids, NO bids,
 * total liquidity and spread. Live mode reads the real orderbook
 * from the Kalshi demo API; sim mode synthesizes a book.
 * ============================================================ */

const DepthPanel = (() => {

  function simBook(market) {
    const yes = [], no = [];
    const topYes = Math.max(0.05, Math.min(0.96, market.price - (market.spread || 0.02) / 2));
    const topNo = Math.max(0.05, Math.min(0.96, 1 - market.price - (market.spread || 0.02) / 2));
    const base = Math.max(60, Math.round((market.liquidity || 5000) / 6));
    for (let i = 0; i < 5; i++) {
      const step = 0.01 + i * 0.008;
      const szYes = Math.round(base * Math.max(0.25, (1 - i * 0.22)) * (0.8 + Math.random() * 0.4));
      const szNo = Math.round(base * Math.max(0.25, (1 - i * 0.22)) * (0.8 + Math.random() * 0.4));
      yes.push({ price: Math.max(0.01, topYes - i * 0.01), size: szYes });
      no.push({ price: Math.max(0.01, topNo - i * 0.01), size: szNo });
    }
    return { yes, no, spread: market.spread || 0.02, liquidity: market.liquidity || 0 };
  }

  function parseOrderbook(raw) {
    if (!raw || !raw.orderbook_fp) return null;
    const toRows = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr.slice(-5).reverse().map(entry => {
        if (Array.isArray(entry)) return { price: parseFloat(entry[0]), size: parseFloat(entry[1]) };
        if (entry && typeof entry === 'object') {
          const p = entry.price_dollars ?? entry.yes_dollars ?? entry.price;
          const s = entry.count_fp ?? entry.count ?? entry.size;
          return { price: parseFloat(p), size: parseFloat(s) };
        }
        return null;
      }).filter(r => r && isFinite(r.price));
    };
    const yes = toRows(raw.orderbook_fp.yes_dollars);
    const no = toRows(raw.orderbook_fp.no_dollars);
    return { yes, no, spread: null, liquidity: null, source: 'live' };
  }

  function rowsHtml(rows, cls) {
    if (!rows || !rows.length) return '<div class="sub" style="color:var(--faint);font-size:12px;padding:6px 0;">No bids at top of book</div>';
    const maxSize = Math.max(...rows.map(r => r.size), 1);
    return rows.map(r => {
      const width = Math.max(8, Math.round((r.size / maxSize) * 100));
      return `<div class="depth-row">
        <span class="d-price">$${r.price.toFixed(2)}</span>
        <span class="d-bar"><i style="width:${width}%; background:${cls === 'yes' ? 'var(--green)' : 'var(--red)'};"></i></span>
        <span class="d-size">${r.size.toFixed(2)}</span>
      </div>`;
    }).join('');
  }

  function render(container, market, orderbookRaw) {
    if (!container) return;
    const data = orderbookRaw ? parseOrderbook(orderbookRaw) : simBook(market);
    const yes = data && data.yes ? data.yes : simBook(market).yes;
    const no = data && data.no && data.no.length ? data.no : simBook(market).no;
    const totalYes = yes.reduce((s, r) => s + r.size, 0);
    const totalNo = no.reduce((s, r) => s + r.size, 0);
    const sourceLabel = data && data.source === 'live' ? 'LIVE orderbook (demo API)' : 'SIMULATED book';
    container.innerHTML = `
      <div class="depth-block">
        <h4>YES bids <span class="chip ${market.isSim ? 'amber' : 'green'}" style="margin-left:8px;">${sourceLabel}</span></h4>
        ${rowsHtml(yes, 'yes')}
        <div class="depth-total"><span>Total YES (top 5)</span><span>${totalYes.toFixed(2)} contracts</span></div>
      </div>
      <div class="depth-block">
        <h4>NO bids</h4>
        ${rowsHtml(no, 'no')}
        <div class="depth-total"><span>Total NO (top 5)</span><span>${totalNo.toFixed(2)} contracts</span></div>
      </div>
      <div class="depth-block">
        <h4>Liquidity &amp; spread</h4>
        <div class="depth-row"><span class="d-price">Liquidity</span><span style="color:var(--text); font-family:var(--mono);">$${(market.liquidity || 0).toLocaleString('en-US')}</span></div>
        <div class="depth-row"><span class="d-price">Spread</span><span style="color:var(--text); font-family:var(--mono);">$${(market.spread || 0).toFixed(2)}</span></div>
        <div class="depth-row"><span class="d-price">Top YES bid</span><span style="color:var(--green); font-family:var(--mono);">${yes[0] ? '$' + yes[0].price.toFixed(2) : '—'}</span></div>
        <div class="depth-row"><span class="d-price">Top NO bid</span><span style="color:var(--red); font-family:var(--mono);">${no[0] ? '$' + no[0].price.toFixed(2) : '—'}</span></div>
        <div class="depth-row"><span class="d-price">Volume</span><span style="color:var(--text); font-family:var(--mono);">$${(market.volume || 0).toLocaleString('en-US')}</span></div>
      </div>`;
  }

  return { render, parseOrderbook, simBook };
})();
