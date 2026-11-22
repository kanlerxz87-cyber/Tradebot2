/* ============================================================
   charts.js — dependency-free canvas charts for the dashboard.
   Line + candlestick rendering, x = time (bucketable to
   seconds/minutes/hours), y = contract price in dollars (0..1).
   ============================================================ */
(function () {
  "use strict";

  function fmtTime(ts, granularity) {
    var d = new Date(ts * 1000);
    if (granularity <= 60) { // seconds/minutes: HH:MM:SS
      return d.toISOString().substr(11, 8);
    }
    if (granularity <= 3600) { // minutes: HH:MM
      return d.toISOString().substr(11, 5);
    }
    return d.toISOString().substr(5, 10); // hours: MM-DD HH
  }

  // Bucket a series of {t, price|ohlc} into fixed-size time buckets.
  function bucketize(points, seconds) {
    if (!seconds || seconds <= 0) return points.slice();
    var out = [], map = {};
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      var b = Math.floor(p.t / seconds) * seconds;
      var k = String(b);
      if (!map[k]) {
        map[k] = { t: b, o: p.c != null ? p.c : p.o, h: -1, l: 1e9, c: null, v: 0 };
        out.push(map[k]);
      }
      var cur = map[k];
      var hi = p.h != null ? p.h : (p.c != null ? p.c : p.o);
      var lo = p.l != null ? p.l : (p.c != null ? p.c : p.o);
      if (hi > cur.h) cur.h = hi;
      if (lo < cur.l) cur.l = lo;
      if (p.c != null) cur.c = p.c;
      else if (cur.c == null) cur.c = p.o;
      cur.v += p.v || 0;
    }
    out.forEach(function (b) { if (b.l >= 1e8) b.l = b.h; });
    return out;
  }

  // Draw a price chart. opts:
  //  {points:[{t,o,h,l,c,v}], granularity:1|60|3600, showCandles:bool,
  //   title, subtitle, alertLevels:[{price,label}], height}
  function drawPrice(canvas, opts) {
    var W = canvas.clientWidth || canvas.parentNode.clientWidth || 700;
    var H = opts.height || 300;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var pts = bucketize(opts.points || [], opts.granularity || 0);
    if (!pts.length) {
      ctx.fillStyle = "#8b98a9"; ctx.font = "13px sans-serif";
      ctx.fillText("No data points", 14, H / 2); return;
    }

    var padL = 46, padR = 12, padT = 26, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    if (t1 - t0 < 1) t1 = t0 + 1;
    var pmin = 0, pmax = 1; // contract prices are $0..$1
    var x = function (t) { return padL + (t - t0) / (t1 - t0) * plotW; };
    var y = function (p) { return padT + (1 - (p - pmin) / (pmax - pmin)) * plotH; };

    // grid + y labels
    ctx.font = "10px monospace"; ctx.fillStyle = "#5c6773";
    ctx.strokeStyle = "#1b222c"; ctx.lineWidth = 1;
    for (var g = 0; g <= 100; g += 20) {
      var gy = y(g / 100);
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
      ctx.fillText("$" + (g / 100).toFixed(2), 8, gy + 3);
    }
    // x labels (5 ticks)
    for (var i2 = 0; i2 <= 4; i2++) {
      var tt = t0 + (t1 - t0) * i2 / 4;
      var gx = x(tt);
      ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, H - padB); ctx.strokeStyle = "#141a22"; ctx.stroke();
      var lbl = fmtTime(tt, opts.granularity || 0);
      var tw = ctx.measureText(lbl).width;
      ctx.fillStyle = "#5c6773";
      ctx.fillText(lbl, Math.min(Math.max(gx - tw / 2, 2), W - tw - 2), H - 8);
    }

    // alert threshold lines
    if (opts.alertLevels) {
      opts.alertLevels.forEach(function (al) {
        var ay = y(al.price);
        ctx.strokeStyle = "rgba(210,153,34,.55)"; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(padL, ay); ctx.lineTo(W - padR, ay); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#d29922";
        ctx.fillText(al.label || ("alert ≥$0.10"), W - padR - 120, ay - 4);
      });
    }

    if (opts.showCandles) {
      // candlesticks
      var cw = Math.max(2, Math.min(14, plotW / Math.max(pts.length, 1) * 0.6));
      pts.forEach(function (c) {
        var cx = x(c.t);
        var up = (c.c != null ? c.c : c.o) >= c.o;
        var col = up ? "#3fb950" : "#f85149";
        ctx.strokeStyle = col; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(cx, y(c.h)); ctx.lineTo(cx, y(c.l)); ctx.stroke();
        var yo = y(c.o), yc = y(c.c != null ? c.c : c.o);
        var top = Math.min(yo, yc), hh = Math.max(1, Math.abs(yc - yo));
        ctx.fillRect(cx - cw / 2, top, cw, hh);
      });
    } else {
      // line
      ctx.strokeStyle = "#58a6ff"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      var started = false;
      pts.forEach(function (c) {
        var pv = c.c != null ? c.c : c.o;
        var px = x(c.t), py = y(pv);
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      });
      ctx.stroke();
      // area fill
      ctx.lineTo(x(t1), y(0)); ctx.lineTo(x(t0), y(0)); ctx.closePath();
      ctx.fillStyle = "rgba(88,166,255,.08)"; ctx.fill();
    }

    // title
    ctx.fillStyle = "#e6edf3"; ctx.font = "600 13px sans-serif";
    ctx.fillText(opts.title || "", padL, 16);
    if (opts.subtitle) {
      ctx.fillStyle = "#8b98a9"; ctx.font = "11px sans-serif";
      ctx.fillText(opts.subtitle, padL + ctx.measureText(opts.title || "").width + 12, 16);
    }

    // hover tooltip
    var tip = document.createElement("div");
    tip.style.cssText = "position:absolute;pointer-events:none;background:#0a0e13;border:1px solid #2b3340;border-radius:6px;padding:5px 8px;font:11px monospace;color:#e6edf3;display:none;z-index:5";
    var host = canvas.parentNode;
    if (!host.contains(tip)) host.appendChild(tip);
    canvas.onmousemove = function (e) {
      var r = canvas.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var best = null, bd = 1e9;
      pts.forEach(function (c) { var d = Math.abs(x(c.t) - mx); if (d < bd) { bd = d; best = c; } });
      if (!best || bd > 40) { tip.style.display = "none"; return; }
      tip.innerHTML =
        fmtTime(best.t, opts.granularity || 0) + "<br>" +
        "O " + best.o.toFixed(3) + "  H " + best.h.toFixed(3) + "<br>" +
        "L " + best.l.toFixed(3) + "  C " + (best.c != null ? best.c.toFixed(3) : "–") + "<br>" +
        "vol " + (best.v || 0).toFixed(1) + " contracts";
      tip.style.display = "block";
      tip.style.left = Math.min(mx + 12, W - 150) + "px";
      tip.style.top = "10px";
    };
    canvas.onmouseleave = function () { tip.style.display = "none"; };
  }

  // Simple horizontal bars: [{label, value, max, link}]
  function drawBars(container, items) {
    var html = "";
    items.forEach(function (it) {
      var pct = it.max > 0 ? Math.max(1.5, it.value / it.max * 100) : 1.5;
      html += '<div class="bar-row"><div class="lbl">' + (it.html || it.label) +
        '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<div class="val">' + (it.valText != null ? it.valText : it.value) + "</div></div>";
    });
    container.innerHTML = html;
  }

  window.KCHART = { drawPrice: drawPrice, drawBars: drawBars, bucketize: bucketize, fmtTime: fmtTime };
})();
