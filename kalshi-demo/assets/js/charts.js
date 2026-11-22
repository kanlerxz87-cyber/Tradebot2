/* ============================================================
 * Price chart — dependency-free canvas renderer.
 * X-axis: time (selectable window), Y-axis: contract price.
 * Annotates swing alerts on the line.
 * ============================================================ */

const PriceChart = (() => {

  function resize(canvas) {
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  function roundTime(t) { return t; }

  function formatTime(t, now, windowSec) {
    const diff = Math.max(0, now - t);
    if (diff < 60) return diff + 's';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    return Math.floor(diff / 3600) + 'h';
  }

  function draw(canvas, points, opts) {
    const _r = resize(canvas);
    const ctx = _r.ctx;
    const w = _r.w, h = _r.h;
    const padL = 52, padR = 16, padT = 16, padB = 30;
    const plotW = w - padL - padR, plotH = h - padT - padB;

    const now = Date.now();
    const windowSec = opts.windowSec || 60;
    const start = now - windowSec * 1000;
    const end = now;
    const visible = (points || []).filter(p => p.t >= start && p.t <= end);
    const nowTime = Math.max(now, visible.length ? visible[visible.length - 1].t : now);

    // price range
    let yMin = 0, yMax = 1;
    if (visible.length) {
      const prices = visible.map(p => p.price);
      yMin = Math.min(...prices); yMax = Math.max(...prices);
      if (yMin === yMax) { yMin -= 0.05; yMax += 0.05; }
      const pad = (yMax - yMin) * 0.25 + 0.03;
      yMin = Math.max(0, yMin - pad); yMax = Math.min(1, yMax + pad);
    }

    const x = (t) => padL + ((t - start) / (windowSec * 1000)) * plotW;
    const y = (p) => padT + plotH - ((p - yMin) / (yMax - yMin)) * plotH;

    // background
    ctx.fillStyle = '#10161f';
    ctx.fillRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.lineWidth = 1;
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const p = yMin + ((yMax - yMin) * i / yTicks);
      const ty = y(p);
      ctx.beginPath(); ctx.moveTo(padL, ty); ctx.lineTo(w - padR, ty); ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('$' + p.toFixed(2), padL - 8, ty);
    }

    // x labels
    const xTicks = Math.min(5, Math.max(2, Math.round(windowSec / (windowSec > 300 ? 300 : 60))));
    ctx.fillStyle = '#64748b';
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i <= xTicks; i++) {
      const t = start + ((end - start) * i / xTicks);
      const tx = x(t);
      ctx.fillText(formatTime(t, now, windowSec), tx, h - padB + 8);
    }

    if (!visible.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px ui-sans-serif, system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No history in this window yet — waiting for ticks', w / 2, h / 2);
      return;
    }

    // fill under line
    const valid = visible.slice();
    ctx.beginPath();
    ctx.moveTo(x(valid[0].t), y(valid[0].price));
    for (const p of valid) ctx.lineTo(x(p.t), y(p.price));
    ctx.lineTo(x(valid[valid.length - 1].t), padT + plotH);
    ctx.lineTo(x(valid[0].t), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(45, 212, 191, 0.08)';
    ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(x(valid[0].t), y(valid[0].price));
    for (const p of valid) ctx.lineTo(x(p.t), y(p.price));
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();

    // annotations — swing alerts
    for (const a of (opts.annotations || [])) {
      if (a.t < start) continue;
      const px = x(a.t), py = y(a.price);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = a.dir > 0 ? '#34d399' : '#fb7185';
      ctx.fill();
      ctx.strokeStyle = '#0b0f14'; ctx.lineWidth = 1.5; ctx.stroke();
      const label = (a.dir > 0 ? '+' : '-') + Math.abs(a.mag).toFixed(2);
      ctx.fillStyle = '#e8eef5';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = a.dir > 0 ? 'bottom' : 'top';
      ctx.fillText(label, px, py + (a.dir > 0 ? -8 : 10));
    }

    // last point dot
    const last = valid[valid.length - 1];
    ctx.beginPath();
    ctx.arc(x(last.t), y(last.price), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2dd4bf'; ctx.fill();
    ctx.strokeStyle = '#0b0f14'; ctx.lineWidth = 2; ctx.stroke();
  }

  return { draw, resize };
})();
