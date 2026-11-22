import { isSwing, marketPrice, selectivityScore } from './analytics';
import type {
  DashboardMarket,
  KalshiMarket,
  MarketFeedItem,
  MonitorState,
  PricePoint,
} from '../types/kalshi';
import { marketSourceUrl } from '../services/kalshi';

const MAX_FEED_ITEMS = 120;
const MAX_HISTORY_POINTS = 720;

export interface SnapshotResult {
  markets: DashboardMarket[];
  feedItems: MarketFeedItem[];
  selectedItems: MarketFeedItem[];
  histories: Record<string, PricePoint[]>;
}

function validResolution(result: string | undefined): result is 'yes' | 'no' {
  return result === 'yes' || result === 'no';
}

function mergeMarket(existing: DashboardMarket, update: KalshiMarket, observedAt: string): DashboardMarket {
  return {
    ...existing,
    ...update,
    eventTitle: existing.eventTitle,
    eventCategory: existing.eventCategory,
    topic: existing.topic,
    settlementSources: existing.settlementSources,
    eventUpdatedAt: existing.eventUpdatedAt,
    firstSeenAt: existing.firstSeenAt,
    lastSeenAt: observedAt,
  };
}

function pricePoint(market: DashboardMarket, timestamp: number): PricePoint | null {
  const price = marketPrice(market);
  if (price === null) return null;
  return {
    ticker: market.ticker,
    timestamp,
    price,
    sourceUrl: marketSourceUrl(market.ticker),
  };
}

function appendPoint(history: PricePoint[], point: PricePoint): PricePoint[] {
  const previous = history.at(-1);
  if (previous && previous.price === point.price && point.timestamp - previous.timestamp < 60_000) {
    return history;
  }
  return [...history, point].slice(-MAX_HISTORY_POINTS);
}

function movementItem(
  previous: DashboardMarket,
  current: DashboardMarket,
  timestamp: number,
): MarketFeedItem | null {
  const fromPrice = marketPrice(previous);
  const toPrice = marketPrice(current);
  if (fromPrice === null || toPrice === null || fromPrice === toPrice) return null;

  const delta = toPrice - fromPrice;
  const score = selectivityScore(current, delta);
  const swing = isSwing(delta);

  return {
    id: `${current.ticker}:${timestamp}:${toPrice.toFixed(4)}`,
    kind: swing ? 'swing' : 'movement',
    ticker: current.ticker,
    eventTitle: current.eventTitle,
    topic: current.topic,
    timestamp,
    fromPrice,
    toPrice,
    delta,
    message: swing
      ? `YES moved ${delta > 0 ? 'up' : 'down'} ${Math.round(Math.abs(delta) * 100)}¢ between polls. Cause unverified.`
      : `YES changed ${delta > 0 ? 'up' : 'down'} ${Math.round(Math.abs(delta) * 100)}¢.`,
    sourceUrl: marketSourceUrl(current.ticker),
    selectivityScore: swing ? score.score : null,
    modelSelected: swing && score.selected,
  };
}

function resolutionItem(
  previous: DashboardMarket,
  current: DashboardMarket,
  timestamp: number,
): MarketFeedItem | null {
  if (!validResolution(current.result) || previous.result === current.result) return null;
  return {
    id: `${current.ticker}:${timestamp}:resolved-${current.result}`,
    kind: 'resolution',
    ticker: current.ticker,
    eventTitle: current.eventTitle,
    topic: current.topic,
    timestamp,
    fromPrice: marketPrice(previous),
    toPrice: marketPrice(current),
    delta: null,
    message: `Market resolved ${current.result.toUpperCase()}.`,
    sourceUrl: marketSourceUrl(current.ticker),
    selectivityScore: null,
    modelSelected: false,
    result: current.result,
  };
}

export function applyMarketSnapshot(
  previousMarkets: DashboardMarket[],
  updates: KalshiMarket[],
  histories: Record<string, PricePoint[]>,
  timestamp: number,
): SnapshotResult {
  const observedAt = new Date(timestamp).toISOString();
  const updateMap = new Map(updates.map((market) => [market.ticker, market]));
  const nextMarkets: DashboardMarket[] = [];
  const feedItems: MarketFeedItem[] = [];
  const selectedItems: MarketFeedItem[] = [];
  const nextHistories = { ...histories };

  for (const previous of previousMarkets) {
    const update = updateMap.get(previous.ticker);
    const current = update ? mergeMarket(previous, update, observedAt) : previous;
    nextMarkets.push(current);

    if (!update) continue;
    const point = pricePoint(current, timestamp);
    if (point) nextHistories[current.ticker] = appendPoint(nextHistories[current.ticker] ?? [], point);

    const resolution = resolutionItem(previous, current, timestamp);
    if (resolution) feedItems.push(resolution);

    const movement = movementItem(previous, current, timestamp);
    if (movement) {
      feedItems.push(movement);
      if (movement.modelSelected) selectedItems.push(movement);
    }
  }

  return { markets: nextMarkets, feedItems, selectedItems, histories: nextHistories };
}

export function mergeDiscovery(
  state: MonitorState,
  discovered: DashboardMarket[],
  timestamp: number,
): SnapshotResult {
  const existingMap = new Map(state.markets.map((market) => [market.ticker, market]));
  const discoveredMap = new Map(discovered.map((market) => [market.ticker, market]));
  const combined: DashboardMarket[] = [];

  for (const current of discovered) {
    const existing = existingMap.get(current.ticker);
    combined.push(
      existing
        ? {
            ...existing,
            ...current,
            firstSeenAt: existing.firstSeenAt,
            lastSeenAt: new Date(timestamp).toISOString(),
          }
        : current,
    );
  }

  // Keep previously observed contracts until the API reports a resolution.
  for (const existing of state.markets) {
    if (!discoveredMap.has(existing.ticker)) combined.push(existing);
  }

  const updates = combined.map((market) => market as KalshiMarket);
  if (state.markets.length === 0) {
    const nextHistories = { ...state.histories };
    for (const market of combined) {
      const point = pricePoint(market, timestamp);
      if (point) nextHistories[market.ticker] = appendPoint(nextHistories[market.ticker] ?? [], point);
    }
    return { markets: combined, feedItems: [], selectedItems: [], histories: nextHistories };
  }

  // applyMarketSnapshot starts from existing records so movement and resolution
  // comparisons use the exact prior poll, then append genuinely new contracts.
  const compared = applyMarketSnapshot(state.markets, updates, state.histories, timestamp);
  const comparedTickers = new Set(compared.markets.map((market) => market.ticker));
  for (const market of combined) {
    if (!comparedTickers.has(market.ticker)) {
      compared.markets.push(market);
      const point = pricePoint(market, timestamp);
      if (point) compared.histories[market.ticker] = appendPoint(compared.histories[market.ticker] ?? [], point);
    }
  }
  return compared;
}

export function prependFeed(existing: MarketFeedItem[], incoming: MarketFeedItem[]): MarketFeedItem[] {
  if (incoming.length === 0) return existing;
  const ids = new Set<string>();
  return [...incoming.sort((a, b) => b.timestamp - a.timestamp), ...existing]
    .filter((item) => {
      if (ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    })
    .slice(0, MAX_FEED_ITEMS);
}
