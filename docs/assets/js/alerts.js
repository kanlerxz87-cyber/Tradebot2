/* ============================================================
 * Alert engine — fires on sudden price swings (>= $0.10)
 * and lifecycle events. Swings are measured against the
 * price SWING_WINDOW_MS ago (baseline anchor).
 * ============================================================ */

const ALERT_ENGINE = (() => {
  const recent = new Map(); // marketId -> { at, swing } last alert time/value

  function baselinePrice(market, now) {
    // price ~10s ago from history
    const target = now - (CONFIG.SWING_WINDOW_MS || 10000);
    const hist = market.history;
    if (!hist || !hist.length) return market.anchorPrice || market.price;
    let best = null;
    for (const p of hist) {
      if (p.t <= target) best = p.price;
      else break;
    }
    return best != null ? best : hist[0].price;
  }

  function headline(market, dir) {
    if (market.isSim) {
      const news = market.news || [];
      const relevant = news.filter(n => n.kind === 'shock' && Math.sign(n.magnitude) === Math.sign(dir));
      if (relevant.length) return relevant[relevant.length - 1].text;
      if (news.length) return news[news.length - 1].text;
    }
    return dir > 0 ? 'Price jumped' : 'Price dropped';
  }

  function evaluate(market, now) {
    if (market.status !== 'open') return;
    if (market.resolution !== 'pending') return;
    const base = baselinePrice(market, now);
    const swing = market.price - base;
    const absSwing = Math.abs(swing);
    if (absSwing < CONFIG.ALERT_THRESHOLD) return;

    const last = recent.get(market.id);
    const tooSoon = last && (now - last.at < 15000) && (absSwing < Math.abs(last.swing) + 0.02);
    if (tooSoon) return;

    recent.set(market.id, { at: now, swing: absSwing });

    const dir = swing > 0 ? 1 : -1;
    const headlineText = headline(market, dir);
    const scored = ROI_MODEL.score(market);

    STORE.addAlert({
      id: 'ALERT_' + market.id + '_' + now,
      t: now,
      type: 'swing',
      marketId: market.id,
      ticker: market.ticker,
      topic: market.topic,
      title: market.title,
      magnitude: Math.abs(swing),
      dir,
      headline: headlineText,
      source: market.isSim ? 'sim' : 'live',
      isSim: market.isSim,
      score: scored.score,
      verdict: scored.verdict,
      roiFlag: scored.score >= 60,
    });
  }

  function evaluateAll() {
    const now = Date.now();
    for (const m of STORE.state.markets) evaluate(m, now);
  }

  return { evaluateAll, evaluate };
})();
