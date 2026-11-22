/* Tradebot2 — Price movement charts
   X axis = time, Y axis = contract price.
   Selectable graph length: seconds / minutes / hours.
   Requires Chart.js (loaded via CDN on pages that use charts) and Tradebot from kalshi.js. */

(function (window) {
  'use strict';

  const LENGTHS = {
    seconds: { label: 'Last 5 minutes', ms: 5 * 60 * 1000 },
    minutes: { label: 'Last 2 hours', ms: 2 * 60 * 60 * 1000 },
    hours:   { label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  };

  const charts = {}; // ticker -> Chart instance

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function getColor(mode = 'yes') {
    return mode === 'yes' ? 'rgba(37, 99, 235, 0.9)' : 'rgba(16, 185, 129, 0.9)';
  }

  function initChart(ticker, containerId, lengthKey = 'minutes') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!window.Chart) {
      container.innerHTML = '<div class="blank">Chart.js is loading…</div>';
      return;
    }
    const state = window.Tradebot.state;
    if (!state) return;

    const length = LENGTHS[lengthKey] || LENGTHS.minutes;
    const cutoff = Date.now() - length.ms;

    // destroy existing
    if (charts[ticker]) {
      try { charts[ticker].destroy(); } catch (e) {}
      charts[ticker] = null;
    }

    const canvas = document.createElement('canvas');
    container.innerHTML = '';
    container.appendChild(canvas);

    const history = (state.priceHistory && state.priceHistory[ticker]) || [];
    const points = history.filter((p) => p.t >= cutoff);
    const current = state.prices && state.prices[ticker] ? state.prices[ticker].yes : null;
    if (current != null && points.length && points[points.length - 1].t < Date.now()) {
      points.push({ t: Date.now(), yes: current });
    }

    const labels = points.map((p) => fmtTime(p.t));
    const data = points.map((p) => p.yes);

    const ctx = canvas.getContext('2d');
    charts[ticker] = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Yes price — ${ticker}`,
          data,
          borderColor: getColor('yes'),
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (c) => (c.parsed.y != null ? `$${c.parsed.y.toFixed(2)}` : '—'),
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: lengthKey === 'seconds' ? 'second' : lengthKey === 'minutes' ? 'minute' : 'hour' },
            title: { display: true, text: 'Time' },
          },
          y: {
            min: 0, max: 1,
            title: { display: true, text: 'Contract price ($)' },
            ticks: { callback: (v) => `$${v}` },
          },
        },
      },
    });
  }

  function refreshAllCharts() {
    Object.keys(charts).forEach((ticker) => {
      const ch = charts[ticker];
      if (!ch) return;
      const state = window.Tradebot.state;
      const lengthKey = (ch.cfg && ch.cfg.options && ch.cfg.options._lengthKey) || 'minutes';
      const length = LENGTHS[lengthKey] || LENGTHS.minutes;
      const cutoff = Date.now() - length.ms;
      const history = (state.priceHistory && state.priceHistory[ticker]) || [];
      const points = history.filter((p) => p.t >= cutoff);
      const current = state.prices && state.prices[ticker] ? state.prices[ticker].yes : null;
      if (current != null && (!points.length || points[points.length - 1].t < Date.now())) {
        points.push({ t: Date.now(), yes: current });
      }
      ch.data.labels = points.map((p) => fmtTime(p.t));
      ch.data.datasets[0].data = points.map((p) => p.yes);
      ch.update('none');
    });
  }

  window.TradebotCharts = { initChart, refreshAllCharts, LENGTHS };

  // Auto-refresh charts every 5 seconds while visible
  setInterval(refreshAllCharts, 5000);

})(window);
