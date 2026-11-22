import type { DashboardMarket } from '../types/kalshi';
import { parseFixed } from './format';

export const SWING_THRESHOLD = 0.1;
export const MODEL_SCORE_THRESHOLD = 65;

export function marketPrice(market: DashboardMarket): number | null {
  return parseFixed(market.last_price_dollars);
}

export function marketPreviousPrice(market: DashboardMarket): number | null {
  return parseFixed(market.previous_price_dollars);
}

/** Calculated from two API-provided fields; null means one source field is absent. */
export function marketDayChange(market: DashboardMarket): number | null {
  const current = marketPrice(market);
  const previous = marketPreviousPrice(market);
  return current === null || previous === null ? null : current - previous;
}

/**
 * Transparent ranking measure requested by the brief. This is contract notional,
 * not cash traded or liquidity: volume_24h_fp × notional_value_dollars.
 */
export function marketNotional24h(market: DashboardMarket): number | null {
  const volume = parseFixed(market.volume_24h_fp);
  const notional = parseFixed(market.notional_value_dollars);
  return volume === null || notional === null ? null : volume * notional;
}

export function marketSpread(market: DashboardMarket): number | null {
  const bid = parseFixed(market.yes_bid_dollars);
  const ask = parseFixed(market.yes_ask_dollars);
  if (bid === null || ask === null || ask < bid) return null;
  return ask - bid;
}

export function topBookSize(market: DashboardMarket): number | null {
  const bidSize = parseFixed(market.yes_bid_size_fp);
  const askSize = parseFixed(market.yes_ask_size_fp);
  if (bidSize === null && askSize === null) return null;
  return Math.max(bidSize ?? 0, askSize ?? 0);
}

export function isSwing(delta: number): boolean {
  return Math.abs(delta) + Number.EPSILON >= SWING_THRESHOLD;
}

export interface ScoreBreakdown {
  score: number;
  selected: boolean;
  checks: {
    swing: boolean;
    tightSpread: boolean;
    active: boolean;
    depth: boolean;
    awayFromEdges: boolean;
  };
}

/**
 * A deterministic selectivity score, not a forecast or expected return.
 * Inputs are direct market fields plus arithmetic differences.
 */
export function selectivityScore(market: DashboardMarket, delta: number): ScoreBreakdown {
  const spread = marketSpread(market);
  const volume = parseFixed(market.volume_24h_fp);
  const depth = topBookSize(market);
  const price = marketPrice(market);

  const checks = {
    swing: isSwing(delta),
    tightSpread: spread !== null && spread <= 0.05,
    active: volume !== null && volume >= 100,
    depth: depth !== null && depth >= 10,
    awayFromEdges: price !== null && price >= 0.15 && price <= 0.85,
  };

  const score =
    (checks.swing ? 30 : 0) +
    (checks.tightSpread ? 25 : 0) +
    (checks.active ? 20 : 0) +
    (checks.depth ? 15 : 0) +
    (checks.awayFromEdges ? 10 : 0);

  return { score, selected: score >= MODEL_SCORE_THRESHOLD, checks };
}

export function sortByNotional(markets: DashboardMarket[]): DashboardMarket[] {
  return [...markets].sort((a, b) => {
    const aNotional = marketNotional24h(a);
    const bNotional = marketNotional24h(b);
    if (aNotional === null && bNotional === null) return a.eventTitle.localeCompare(b.eventTitle);
    if (aNotional === null) return 1;
    if (bNotional === null) return -1;
    return bNotional - aNotional;
  });
}

export function marketMarkForSide(market: DashboardMarket, side: 'yes' | 'no'): number | null {
  const yes = marketPrice(market);
  if (yes === null) return null;
  return side === 'yes' ? yes : 1 - yes;
}
