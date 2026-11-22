/* ============================================================
 * Simulated market provider (used when live API unreachable,
 * or explicitly chosen). Clearly labeled SIMULATED.
 * Generates realistic-looking walk + news shocks + resolutions.
 * ============================================================ */

const SIM = (() => {
  const simHeadlines = {
    gas: [
      'Crude jumps on supply shock fears',
      'Inventories surprise — market reacts',
      'Gasoline demand outlook strong',
      'Refinery outage adds to prices',
    ],
    elections: [
      'Polling closes the gap — race tightens',
      'Incumbent faces surprise challenge',
      'Key district flips in final poll',
      'Early voting numbers surprise',
    ],
    culture: [
      'Award show announces surprise nominees',
      'Streaming numbers up big on new release',
      'Chart-topping hit debuts',
      'Film award race tightens late',
    ],
    crypto: [
      'Momentum deal triggers breakout',
      'ETF flow data surprises market',
      'Major exchange moves price',
      'Institutional buying drives move',
    ],
    golf: [
      'Star player storms early rounds',
      'Weather shift boosts seaside hole',
      'Early leader loses playoff grip',
      'Field leader stumbles in 36 holes',
    ],
  };

  const SIM_EVENTS = [
    { topic: 'gas', title: 'WTI crude settles above $100 by month-end?', price: 0.58, volume: 182400, lifetime: 150 },
    { topic: 'gas', title: 'US gasoline futures above $3.85 by month-end?', price: 0.42, volume: 145300, lifetime: 130 },
    { topic: 'elections', title: 'Senate GOP holds 51+ seats after tally?', price: 0.64, volume: 416800, lifetime: 170 },
    { topic: 'elections', title: 'Major-party approval below 45% this month?', price: 0.38, volume: 214100, lifetime: 140 },
    { topic: 'culture', title: 'Highest-charting song of the year?', price: 0.55, volume: 97300, lifetime: 140 },
    { topic: 'culture', title: 'Blockbuster album wins year-end award?', price: 0.47, volume: 78900, lifetime: 120 },
    { topic: 'crypto', title: 'Bitcoin above $150k by year-end?', price: 0.71, volume: 268400, lifetime: 160 },
    { topic: 'crypto', title: 'Ethereum above $5,500 by year-end?', price: 0.36, volume: 154600, lifetime: 130 },
    { topic: 'golf', title: 'Top field leader wins Masters?', price: 0.52, volume: 88200, lifetime: 150 },
    { topic: 'golf', title: 'Top field leader wins US Open?', price: 0.61, volume: 65400, lifetime: 125 },
  ];

  const state = { markets: [], shocks: [] };
  let tickMs = 1000;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function buildMarket(def, i) {
    const now = Date.now();
    const topic = def.topic;
    const id = 'SIM-' + topic.toUpperCase() + '-' + (i + 1) + '-' + Math.random().toString(36).slice(2, 6);
    const market = newMarket({
      id,
      ticker: id,
      title: def.title,
      topic,
      status: 'open',
      resolution: 'pending',
      price: def.price,
      prevPrice: def.price,
      anchorPrice: def.price,
      anchorAt: now,
      volume: def.volume,
      liquidity: Math.round(def.volume * rand(0.08, 0.18)),
      spread: rand(0.01, 0.05),
      isSim: true,
      native: { ticker: id, title: def.title, series: 'SIM', url: '#dashboard.html', isSim: true },
      startedAt: now,
      settledAt: null,
      closeAt: now + def.lifetime * 1000,
    });

    // Pre-fill a 24h random walk at 5-minute resolution for graph depth
    let price = def.price;
    const points = [];
    const stepMs = 5 * 60 * 1000;
    for (let t = now - 24 * 3600 * 1000; t < now; t += stepMs) {
      price += rand(-0.02, 0.02);
      price = Math.max(0.04, Math.min(0.96, price));
      points.push({ t: t, price: price });
    }
    // Connect the pre-filled walk to the current price
    market.price = def.price;
    market.history = points;
    // anchor price: ~10s ago by back-filling a small recent walk
    market.anchorAt = now - (CONFIG.SWING_WINDOW_MS || 10000);
    const recentPrice = pricesAt(points, now - 10000) || market.price;
    market.anchorPrice = recentPrice;
    return market;
  }

  function pricesAt(points, targetT) {
    if (!points.length) return null;
    let best = points[0];
    for (const p of points) {
      if (p.t <= targetT) best = p;
      else break;
    }
    return best.price;
  }

  function init() {
    state.markets = SIM_EVENTS.map((d, i) => buildMarket(d, i));
    // Drop any resolved ones and keep the list sorted by volume
    STORE.state.markets = state.markets;
    if (!STORE.state.selectedId) {
      STORE.state.selectedId = state.markets[0] ? state.markets[0].id : null;
    }
    STORE.notify();
  }

  function maybeShock(market, now) {
    // ~1.2% chance per tick for a news shock (≈ one per 80 ticks), ±0.05..0.30
    if (Math.random() < 0.012) {
      const mag = rand(0.05, 0.30);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const headline = pick(simHeadlines[market.topic] || simHeadlines.gas);
      market.price = Math.max(0.03, Math.min(0.97, market.price + dir * mag));
      market.news.push({ t: now, text: headline, kind: 'shock', magnitude: dir * mag });
      if (market.news.length > 12) market.news.shift();
      market.volume += Math.round(rand(800, 6000));
    } else if (Math.random() < 0.02) {
      // gentle news drift
      market.news.push({ t: now, text: pick(simHeadlines[market.topic] || simHeadlines.gas), kind: 'drift' });
      if (market.news.length > 12) market.news.shift();
    }
  }

  function settleMarket(market, now) {
    // Resolve YES/NO with probability weighted toward the final price
    const yes = Math.random() < (market.price * 0.9 + 0.1);
    market.isSim = true;
    market.status = 'settled';
    market.resolution = yes ? 'yes' : 'no';
    market.resolutionAt = now;
    market.settledAt = now;
    market.volume = Math.round(market.volume * rand(1.05, 1.25));
    market.liquidity = 0;
    return market;
  }

  function tick() {
    const now = Date.now();
    for (const market of state.markets) {
      if (market.status === 'settled') continue;

      market.prevPrice = market.price;

      // Random walk with mild mean reversion towards initial drift
      const drift = 0.012;
      let next = market.price + rand(-drift, drift) * rand(0.4, 1.4);
      // Mean reversion
      next += (0.5 - next) * 0.006;
      maybeShock(market, now);
      next = Math.max(0.03, Math.min(0.97, next));
      market.price = next;

      // Liquidity tracks volume with jitter
      market.liquidity = Math.max(0, Math.round(market.liquidity + rand(-900, 1400)));
      market.volume = Math.round(market.volume + rand(60, 950));
      market.spread = Math.max(0.008, Math.min(0.09, market.spread + rand(-0.004, 0.004)));

      // History
      market.history.push({ t: now, price: market.price });
      if (market.history.length > CONFIG.HISTORY_CAP) market.history.shift();

      // Resolve after lifetime
      if (now > market.closeAt) {
        settleMarket(market, now);
        const record = {
          id: market.id,
          ticker: market.ticker,
          title: market.title,
          topic: market.topic,
          resolution: market.resolution,
          settledAt: now,
          volume: market.volume,
          isSim: true,
          native: market.native,
        };
        STORE.addResolution(record);
        STORE.addAlert({
          id: 'ALERT_SETTLE_' + market.id,
          t: now,
          type: 'resolved',
          marketId: market.id,
          topic: market.topic,
          ticker: market.ticker,
          title: market.title,
          magnitude: 0,
          dir: 0,
          headline: `Market settled — ${market.resolution.toUpperCase()}`,
          source: 'sim',
          sim: true,
        });
      }
    }
    // Refresh the store
    STORE.state.markets = state.markets.slice();
    // Re-select if selected market vanished/resolved handling stays
    if (!STORE.state.selectedId && state.markets[0]) {
      STORE.state.selectedId = state.markets[0].id;
    }
    STORE.notify();
  }

  // Restart a removed/resolved market with a fresh sim event after it settles
  function maybeRestart(market, now) {
    if (market.status !== 'settled') return;
    if (now - (market.settledAt || now) > 8000 && Math.random() < 0.35) {
      const def = pick(SIM_EVENTS.filter(d => d.topic === market.topic));
      const fresh = buildMarket({ ...def, lifetime: def.lifetime }, Math.floor(Math.random() * 1000));
      fresh.status = 'open';
      fresh.volume = Math.round(fresh.volume * rand(1.05, 1.3));
      const idx = state.markets.indexOf(market);
      if (idx >= 0) state.markets[idx] = fresh;
      STORE.upsertMarket(fresh);
    }
  }

  return { init, tick, maybeRestart, state };
})();

// ============================================================
// Compatibility shim: keep the store updated on the tick
// ============================================================
function simEngineTick() {
  SIM.tick();
  const now = Date.now();
  for (const m of SIM.state.markets) SIM.maybeRestart(m, now);
  STORE.state.markets = SIM.state.markets.slice();
  STORE.notify();
}
