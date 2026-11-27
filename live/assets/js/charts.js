/* =============================================================================
   Tradebot2 — charts (dependency-free canvas)
   -----------------------------------------------------------------------------
   Simple by design: one price line, optional volume bars, alert pins, crosshair.
   Y axis is always the contract price in cents (0¢–100¢, auto-zoomed).
   X axis is time in the viewer's local timezone.
   ============================================================================= */
'use strict';

var TBChart = (() => {
  const { cents, esc, timeShort, dateShort } = TB;

  const C = {
    line: '#0b6b56', fill: 'rgba(11,107,86,.10)', grid: '#eef1f4', axis: '#9aa4b0',
    ink: '#47505c', ink3: '#78828f', up: '#0a7d4f', down: '#b3261e',
    vol: 'rgba(11,107,86,.22)', cross: '#8e99a6'
  };

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(280, rect.width || canvas.clientWidth || 600);
    const h = Math.max(180, rect.height || canvas.clientHeight || 320);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    return { ctx, w, h };
  }

  function empty(canvas, message) {
    const { ctx, w, h } = setup(canvas);
    ctx.fillStyle = C.ink3;
    ctx.font = '13px -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, message, w / 2, h / 2, w - 40, 18);
    ctx.textAlign = 'left';
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    const words = String(text).split(' ');
    let line = '';
    const lines = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
  }

  function niceTicks(min, max, count) {
    const span = max - min;
    if (!(span > 0)) return [min];
    const raw = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 10000) / 10000);
    return ticks;
  }

  function fmtCents(c) {
    const n = Number(c);
    if (!Number.isFinite(n)) return '—';
    return (Math.abs(n % 1) < 0.005 ? n.toFixed(0) : n.toFixed(1)) + '¢';
  }

  function fmtTs(t, spanMs, withSeconds) {
    const d = new Date(t);
    if (spanMs > 36 * 3600e3) return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' });
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}) });
  }

  /**
   * Main price chart.
   * opts: {
   *   points: [{t, p, v?}]        price series in cents, ascending time
   *   markers: [{t, delta, ticker}] alert pins (>= $0.10 moves)
   *   showVolume: bool
   *   label: string
   *   yPad: cents of padding
   * }
   */
  function line(canvas, opts) {
    const o = Object.assign({ points: [], markers: [], showVolume: true, label: '' }, opts || {});
    const pts = (o.points || []).filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.p));
    if (pts.length < 2) {
      empty(canvas, o.emptyMessage || 'Not enough price points yet. Price history builds up as live data refreshes — leave this page open, or pick a longer window.');
      return null;
    }
    const { ctx, w, h } = setup(canvas);
    const padL = 46, padR = 14, padT = 14;
    const volH = o.showVolume && pts.some(p => Number.isFinite(p.v)) ? 46 : 0;
    const padB = 30 + volH;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const xs = pts.map(p => p.t);
    let x0 = Number.isFinite(o.start) ? o.start : Math.min(...xs);
    let x1 = Number.isFinite(o.end) ? o.end : Math.max(...xs);
    if (x1 <= x0) x1 = x0 + 1000;
    const fmtPrice = o.unit === 'usd' ? v => TB.dollar(v, 2) : fmtCents;
    const ps = pts.map(p => p.p);
    let yMin = Math.min(...ps), yMax = Math.max(...ps);
    const padY = o.yPad != null ? o.yPad : Math.max(0.5, (yMax - yMin) * 0.15);
    if (o.unit === 'usd') {
      yMin -= Math.max(0.01, padY); yMax += Math.max(0.01, padY);
    } else {
      yMin = Math.max(0, Math.floor((yMin - padY) * 2) / 2);
      yMax = Math.min(100, Math.ceil((yMax + padY) * 2) / 2);
      if (yMax - yMin < 6) { const mid = (yMax + yMin) / 2; yMin = Math.max(0, mid - 3); yMax = Math.min(100, mid + 3); }
    }

    const X = t => padL + ((t - x0) / (x1 - x0)) * plotW;
    const Y = p => padT + (1 - (p - yMin) / (yMax - yMin)) * plotH;

    /* grid + y labels */
    ctx.strokeStyle = C.grid; ctx.fillStyle = C.ink3; ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const tick of niceTicks(yMin, yMax, 5)) {
      const y = Math.round(Y(tick)) + .5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillText(fmtPrice(tick), padL - 8, y);
    }
    /* x labels */
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const span = x1 - x0;
    const xCount = w < 480 ? 3 : 5;
    for (let i = 0; i <= xCount; i++) {
      const t = x0 + (span * i) / xCount;
      const x = X(t);
      ctx.strokeStyle = C.grid;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, padT); ctx.lineTo(Math.round(x) + .5, padT + plotH); ctx.stroke();
      ctx.fillStyle = C.ink3;
      const label = fmtTs(t, span, span < 20 * 60e3);
      ctx.fillText(label, Math.min(w - padR - 18, Math.max(padL + 16, x)), padT + plotH + 8);
    }

    /* volume bars */
    if (volH) {
      const maxV = Math.max(...pts.map(p => Number.isFinite(p.v) ? p.v : 0), 1);
      const vy = padT + plotH + 6;
      ctx.fillStyle = C.vol;
      const bw = Math.max(1, Math.min(14, plotW / pts.length - 1));
      for (const p of pts) {
        const v = Number.isFinite(p.v) ? p.v : 0;
        if (!v) continue;
        const bh = Math.max(1, (v / maxV) * (volH - 10));
        ctx.fillRect(X(p.t) - bw / 2, vy + (volH - 12) - bh, bw, bh);
      }
      ctx.fillStyle = C.ink3; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = '10px ui-monospace, Menlo, monospace';
      ctx.fillText('volume (contracts)', padL + 2, vy + volH - 12);
    }

    /* alert pins */
    for (const mk of (o.markers || [])) {
      if (!Number.isFinite(mk.t) || mk.t < x0 || mk.t > x1) continue;
      const x = X(mk.t);
      ctx.strokeStyle = (mk.delta || 0) >= 0 ? 'rgba(10,125,79,.35)' : 'rgba(179,38,30,.35)';
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      ctx.setLineDash([]);
      const near = pts.reduce((best, p) => Math.abs(p.t - mk.t) < Math.abs(best.t - mk.t) ? p : best, pts[0]);
      const y = Y(near.p);
      ctx.fillStyle = (mk.delta || 0) >= 0 ? C.up : C.down;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }

    /* area + line */
    ctx.beginPath();
    pts.forEach((p, i) => { const x = X(p.t), y = Y(p.p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(11,107,86,.18)'); grad.addColorStop(1, 'rgba(11,107,86,0)');
    ctx.lineTo(X(pts[pts.length - 1].t), padT + plotH);
    ctx.lineTo(X(pts[0].t), padT + plotH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => { const x = X(p.t), y = Y(p.p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = C.line; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();

    /* last point */
    const last = pts[pts.length - 1];
    ctx.fillStyle = C.line; ctx.beginPath(); ctx.arc(X(last.t), Y(last.p), 3.2, 0, Math.PI * 2); ctx.fill();

    /* axis frame */
    ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT + plotH + .5); ctx.lineTo(w - padR, padT + plotH + .5); ctx.stroke();

    /* label */
    if (o.label) {
      ctx.fillStyle = C.ink; ctx.font = '600 11px -apple-system, Segoe UI, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(o.label, padL, 2);
    }

    /* interactivity: crosshair + tooltip */
    canvas._chart = { pts, X, Y, x0, x1, padL, padR, padT, plotH, w, h, fmtPrice, drawBase: () => line(canvas, o) };
    if (!canvas._bound) {
      canvas._bound = true;
      let tip = null;
      const ensureTip = () => {
        if (tip) return tip;
        tip = document.createElement('div');
        tip.className = 'chart-tip';
        tip.style.cssText = 'position:absolute;pointer-events:none;background:#10151c;color:#fff;padding:5px 8px;border-radius:6px;font:11px/1.35 ui-monospace,Menlo,monospace;opacity:0;transition:opacity .12s;z-index:5;white-space:nowrap';
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(tip);
        return tip;
      };
      canvas.addEventListener('mousemove', ev => {
        const ch = canvas._chart; if (!ch) return;
        const rect = canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        if (mx < ch.padL || mx > ch.w - ch.padR) { ensureTip().style.opacity = 0; return; }
        const t = ch.x0 + ((mx - ch.padL) / (ch.w - ch.padL - ch.padR)) * (ch.x1 - ch.x0);
        let best = ch.pts[0];
        for (const p of ch.pts) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
        const x = ch.X(best.t), y = ch.Y(best.p);
        const d = ch.drawBase();
        const ctx2 = canvas.getContext('2d');
        ctx2.save();
        ctx2.strokeStyle = C.cross; ctx2.setLineDash([3, 3]); ctx2.lineWidth = 1;
        ctx2.beginPath(); ctx2.moveTo(x, ch.padT); ctx2.lineTo(x, ch.padT + ch.plotH); ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.fillStyle = C.line; ctx2.beginPath(); ctx2.arc(x, y, 4, 0, Math.PI * 2); ctx2.fill();
        ctx2.fillStyle = '#fff'; ctx2.beginPath(); ctx2.arc(x, y, 1.8, 0, Math.PI * 2); ctx2.fill();
        ctx2.restore();
        const tipEl = ensureTip();
        tipEl.innerHTML = `${ch.fmtPrice(best.p)}<br><span style="color:#9aa4b0">${new Date(best.t).toLocaleString()}${Number.isFinite(best.v) ? '<br>vol ' + Math.round(best.v) : ''}</span>`;
        const left = Math.min(ch.w - 150, Math.max(0, x + 12));
        tipEl.style.left = left + 'px';
        tipEl.style.top = Math.max(4, y - 54) + 'px';
        tipEl.style.opacity = 1;
      });
      canvas.addEventListener('mouseleave', () => { const tipEl = ensureTip(); tipEl.style.opacity = 0; const ch = canvas._chart; if (ch) line(canvas, ch.opts || {}); });
    }
    canvas._chart.opts = o;
    return { x0, x1, yMin, yMax };
  }

  /** Tiny sparkline for tables/KPIs. */
  function spark(canvas, values, color) {
    const vals = (values || []).filter(v => Number.isFinite(v));
    if (vals.length < 2) return;
    const { ctx, w, h } = setup(canvas);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = 2 + (i / (vals.length - 1)) * (w - 4);
      const y = h - 3 - ((v - min) / span) * (h - 6);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color || C.line; ctx.lineWidth = 1.5; ctx.stroke();
  }

  /** Horizontal bar list (topic distribution, strategy P&L). */
  function bars(host, rows, opts) {
    const o = Object.assign({ fmt: v => String(v), signed: false }, opts || {});
    const max = Math.max(...rows.map(r => Math.abs(r.value || 0)), 1);
    host.innerHTML = rows.map(r => {
      const v = r.value || 0;
      const w = Math.abs(v) / max * 100;
      const cls = o.signed ? (v >= 0 ? 'pos' : 'neg') : '';
      return `<div class="brow">
        <div class="bl">${esc(r.label)}</div>
        <div class="bt"><span class="bf ${cls}" style="width:${w.toFixed(1)}%"></span></div>
        <div class="bv">${esc(o.fmt(v))}</div>
      </div>`;
    }).join('');
  }

  /* ======================================================================
     Order book ladder
     API shape (verified 2026-11-22, docs.kalshi.com/api-reference/market/get-market-orderbook):
       { orderbook_fp: { yes_dollars: [[price, qty], ...], no_dollars: [[price, qty], ...] } }
     - arrays are sorted ascending by price, best bid is the LAST element
     - only bids are returned; a YES ask at p equals a NO bid at (1-p)
     The ladder below therefore shows:
       ASK side  = 1 - no_bid price (size from that no bid level)
       BID side  = yes bid price    (size from that yes bid level)
     ====================================================================== */
  function bookLevels(ob) {
    const fp = ob && ob.orderbook_fp;
    if (!fp) return null;
    const levels = xs => (xs || []).map(l => ({ p: TB.num(l[0]), q: TB.num(l[1]) }))
      .filter(l => l.p !== null && l.q !== null && l.p >= 0 && l.p <= 1 && l.q > 0)
      .sort((a, b) => b.p - a.p);
    return { bids: levels(fp.yes_dollars), asks: levels(fp.no_dollars)
      .map(l => ({ p: Math.round((1 - l.p) * 10000) / 10000, q: l.q })).sort((a, b) => a.p - b.p) };
  }
  function ladder(host, ob, opts) {
    if (!host) return;
    const o = Object.assign({ levels: 8 }, opts), book = bookLevels(ob);
    if (!book) { host.innerHTML = '<div class="t-blank">No verified order book returned.</div>'; return; }
    const bids = book.bids.slice(0, o.levels), asks = book.asks.slice(0, o.levels);
    host.className = 'ladder table-wrap';
    const src = o.source || 'https://docs.kalshi.com/api-reference/market/get-market-orderbook';
    if (!bids.length && !asks.length) { host.innerHTML = '<div class="t-blank">No resting orders in returned depth.</div>'; return; }
    const row = (l, side) => `<tr class="${side}"><td>${side === 'ask' ? 'YES ask*' : 'YES bid'}</td>
      <td class="num">${fmtCents(l.p * 100)}</td><td class="num">${TB.compact(l.q)}</td>
      <td class="src"><a href="${esc(src)}" target="_blank" rel="noopener">book API</a></td></tr>`;
    host.innerHTML = `<table><thead><tr><th>Side</th><th>Price</th><th>Contracts</th><th>Source</th></tr></thead><tbody>
      ${asks.slice().reverse().map(l => row(l, 'ask')).join('')}${bids.map(l => row(l, 'bid')).join('')}</tbody></table>
      <p class="src">*YES ask = 1 − NO bid (calculated). Nearest ${o.levels} returned levels per side; not guaranteed fills.</p>`;
  }
  function liquidity(ob) {
    const book = bookLevels(ob); if (!book) return null;
    const sum = a => a.reduce((s, l) => s + l.q, 0);
    return { bidContracts: sum(book.bids), askContracts: sum(book.asks), bidLevels: book.bids.length,
      askLevels: book.asks.length, bestBid: book.bids.length ? book.bids[0].p : null,
      bestAsk: book.asks.length ? book.asks[0].p : null };
  }

  return { line, spark, bars, ladder, liquidity, fmtCents, empty, C };
})();
