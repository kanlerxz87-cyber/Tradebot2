/* Shared helpers. Loaded by every page. */
(function () {
  const TB = (window.TB = window.TB || {});

  TB.fmtMoney = (v, dp = 2) =>
    v === null || v === undefined || Number.isNaN(Number(v))
      ? '<span class="muted">—</span>'
      : '$' + Number(v).toFixed(dp);

  TB.fmtPrice = (v) => (v === null || v === undefined ? '<span class="muted">—</span>' : '$' + Number(v).toFixed(4));

  TB.fmtCents = (v) => (v === null || v === undefined ? '—' : (Number(v) * 100).toFixed(1) + '¢');

  TB.fmtNum = (v, dp = 0) =>
    v === null || v === undefined || Number.isNaN(Number(v))
      ? '—'
      : Number(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

  TB.timeAgo = (iso) => {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return iso;
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  };

  TB.utc = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').replace('.000Z', 'Z');
  };

  TB.esc = (s) =>
    String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  TB.getJSON = async (url) => {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
    return res.json();
  };

  TB.TOPICS = [
    { id: 'gas', name: 'Gas prices' },
    { id: 'elections', name: 'Elections' },
    { id: 'culture', name: 'Culture' },
    { id: 'crypto', name: 'Crypto' },
    { id: 'golf', name: 'Golf' },
  ];

  // Documented single-series endpoint (https://docs.kalshi.com/api-reference/market/get-series):
  // GET /series/{series_ticker} returns exactly the series object a rule matched on.
  TB.seriesUrl = (ticker) =>
    'https://demo-api.kalshi.co/trade-api/v2/series/' + encodeURIComponent(ticker || '');

  TB.topicTag = (id) => `<span class="tag ${TB.esc(id)}">${TB.esc(id || '?')}</span>`;

  TB.sourceLink = (url, label) =>
    url
      ? `<a href="${TB.esc(url)}" target="_blank" rel="noopener noreferrer" title="Official source: ${TB.esc(url)}">${label || 'source ↗'}</a>`
      : `<span class="unverified" title="No official source captured for this row">unverified</span>`;

  /* Draws a sparkline polyline into a canvas element. */
  TB.sparkline = (canvas, values, color) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 88, h = canvas.clientHeight || 26;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const clean = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
    if (clean.length < 2) return;
    const min = Math.min(...clean), max = Math.max(...clean);
    const range = max - min || 1;
    ctx.beginPath();
    clean.forEach((v, i) => {
      const x = (i / (clean.length - 1)) * (w - 2) + 1;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color || '#58a6ff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };
})();
