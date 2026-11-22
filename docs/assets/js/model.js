/* ============================================================
 * ROI model — heuristic, explainable scoring of a market for
 * high-ROI opportunity. NOT a financial recommendation.
 * Factors: price sweet spot, liquidity, volume, spread, momentum.
 * ============================================================ */

const ROI_MODEL = (() => {

  function sweetSpot(price) {
    // Best in [0.35, 0.65] (maximum implied room to move); sharp penalty near extremes
    const d = Math.abs(price - 0.5);
    return Math.max(0, 100 - d * 150);
  }

  function liquidityScore(liq) {
    if (!liq || liq <= 0) return 30;
    return Math.min(100, (liq / 2500) * 100);
  }

  function volumeScore(vol) {
    if (!vol || vol <= 0) return 30;
    return Math.min(100, (vol / 60000) * 100);
  }

  function spreadScore(spread) {
    if (!spread || spread <= 0) return 50;
    return Math.max(0, 100 - spread * 1200);
  }

  function momentum(market) {
    const hist = market.history || [];
    if (hist.length < 2) return { delta: 0, score: 0 };
    const last = hist[hist.length - 1];
    let ref = last.t - 15000;
    let base = hist[0].price;
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].t <= ref) { base = hist[i].price; break; }
    }
    const delta = last.price - base;
    const score = Math.min(100, Math.abs(delta) * 400);
    return { delta, score };
  }

  function score(market) {
    const ms = market.price;
    const sweet = sweetSpot(ms);
    const liq = liquidityScore(market.liquidity);
    const vol = volumeScore(market.volume);
    const spr = spreadScore(market.spread);
    const mom = momentum(market);

    let total = 0.30 * sweet + 0.25 * liq + 0.15 * vol + 0.15 * spr + 0.15 * mom.score;
    total = Math.max(0, Math.min(100, total));

    const verdict = total >= 70 ? 'High ROI' : total >= 50 ? 'Watch' : 'Skip';
    const rec = mom.delta > 0.05 ? 'momentum YES' : mom.delta < -0.05 ? 'swing caution' : 'monitor';

    return {
      score: Math.round(total),
      verdict,
      recommendation: rec,
      factors: {
        sweetSpot: Math.round(sweet),
        liquidity: Math.round(liq),
        volume: Math.round(vol),
        spread: Math.round(spr),
        momentum: Math.round(mom.score),
      },
      momentumDelta: mom.delta,
    };
  }

  return { score, sweetSpot, liquidityScore, volumeScore, spreadScore, momentum };
})();
