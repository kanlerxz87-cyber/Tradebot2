/* Minimal canvas price chart.
 * x axis = time (range selectable: seconds/minutes/hours/days window)
 * y axis = contract price in dollars, always 0.00 - 1.00 so binary contracts are
 * never cropped. Overlays the best bid/ask band and marks >= $0.10 swing points
 * with the same threshold the alert engine uses.
 */
(function () {
  const TB = (window.TB = window.TB || {});
  const RANGES = { '1m': 60e3, '5m': 300e3, '30m': 1800e3, '1h': 3600e3, '6h': 21600e3, '24h': 86400e3 };

  class PriceChart {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.points = [];
      this.range = opts.range || '1h';
      this.threshold = opts.threshold || 0.10;
      this.markers = [];
      this._bindResize();
    }

    _bindResize() {
      let t = null;
      window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => this.draw(), 120);
      });
    }

    setPoints(points) {
      this.points = (points || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
      this.draw();
    }

    setRange(r) {
      if (RANGES[r]) this.range = r;
      this.draw();
    }

    setMarkers(markers) {
      this.markers = markers || [];
      this.draw();
    }

    visible() {
      const span = RANGES[this.range];
      const end = (this.points[this.points.length - 1]?.ts || Date.now() / 1000) * 1000;
      const start = end - span;
      return this.points.filter((p) => p.ts * 1000 >= start);
    }

    draw() {
      const cv = this.canvas;
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth, H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      const css = getComputedStyle(document.documentElement);
      const col = {
        line: css.getPropertyValue('--accent-2').trim() || '#58a6ff',
        grid: css.getPropertyValue('--line').trim() || '#2a3444',
        text: css.getPropertyValue('--muted').trim() || '#9aa7b6',
        up: css.getPropertyValue('--up').trim() || '#26a869',
        down: css.getPropertyValue('--down').trim() || '#e5534b',
      };

      const padL = 46, padR = 12, padT = 12, padB = 26;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const pts = this.visible();

      g.font = '10px ui-monospace, monospace';
      g.strokeStyle = col.grid;
      g.fillStyle = col.text;
      g.lineWidth = 1;

      // y grid: 0 .. $1.00 in $0.20 steps
      for (let p = 0; p <= 1.0001; p += 0.2) {
        const y = padT + plotH - p * plotH;
        g.beginPath(); g.moveTo(padL, y); g.lineTo(padL + plotW, y); g.stroke();
        g.fillText('$' + p.toFixed(2), 6, y + 3);
      }

      if (!pts.length) {
        g.fillStyle = col.text;
        g.fillText('No observations in this window yet — data is added by each collection cycle.', padL + 8, padT + plotH / 2);
        return;
      }

      const t0 = pts[0].ts * 1000, t1 = pts[pts.length - 1].ts * 1000;
      const span = Math.max(t1 - t0, 1);
      const X = (ts) => padL + ((ts * 1000 - t0) / span) * plotW;
      const Y = (p) => padT + plotH - Math.max(0, Math.min(1, p)) * plotH;

      // x labels (4 ticks)
      const fmt = (ms) => {
        const d = new Date(ms);
        return RANGES[this.range] <= 3600e3
          ? d.toISOString().slice(11, 19)
          : d.toISOString().slice(5, 16).replace('T', ' ');
      };
      for (let i = 0; i <= 3; i++) {
        const ms = t0 + (span * i) / 3;
        const x = padL + (plotW * i) / 3;
        g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + plotH); g.stroke();
        const label = fmt(ms);
        const w = g.measureText(label).width;
        g.fillText(label, Math.min(x, padL + plotW - w), H - 8);
      }

      // bid/ask band
      const band = pts.filter((p) => p.bid != null && p.ask != null);
      if (band.length > 1) {
        g.beginPath();
        band.forEach((p, i) => (i ? g.lineTo(X(p.ts), Y(p.ask)) : g.moveTo(X(p.ts), Y(p.ask))));
        for (let i = band.length - 1; i >= 0; i--) g.lineTo(X(band[i].ts), Y(band[i].bid));
        g.closePath();
        g.fillStyle = 'rgba(88,166,255,.10)';
        g.fill();
      }

      // price line (mid, else last)
      const price = (p) => (p.mid != null ? p.mid : p.last);
      g.beginPath();
      let started = false;
      pts.forEach((p) => {
        const v = price(p);
        if (v == null) { started = false; return; }
        const x = X(p.ts), y = Y(v);
        started ? g.lineTo(x, y) : g.moveTo(x, y);
        started = true;
      });
      g.strokeStyle = col.line; g.lineWidth = 1.8; g.stroke();

      // swing markers from the alert engine's own threshold
      this.markers.forEach((m) => {
        const x = X(m.to_ts || m.ts), y = Y(m.to_price != null ? m.to_price : price(m));
        g.beginPath();
        g.arc(x, y, 3.4, 0, Math.PI * 2);
        g.fillStyle = m.direction === 'up' ? col.up : col.down;
        g.fill();
      });
    }
  }

  TB.PriceChart = PriceChart;
  TB.RANGES = RANGES;
})();
