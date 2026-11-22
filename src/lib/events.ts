import { marketNotional24h, sortByNotional } from './analytics';
import type { DashboardMarket, TopicId } from '../types/kalshi';
import { eventSourceUrl } from '../services/kalshi';

export interface EventMarketGroup {
  eventTicker: string;
  title: string;
  topic: TopicId;
  category: string | null;
  markets: DashboardMarket[];
  leadMarket: DashboardMarket;
  notional24h: number | null;
  sourceUrl: string;
}

export function groupMarketsByEvent(markets: DashboardMarket[]): EventMarketGroup[] {
  const grouped = new Map<string, DashboardMarket[]>();
  for (const market of markets) {
    const existing = grouped.get(market.event_ticker) ?? [];
    existing.push(market);
    grouped.set(market.event_ticker, existing);
  }

  return [...grouped.entries()]
    .map(([eventTicker, eventMarkets]): EventMarketGroup => {
      const sorted = sortByNotional(eventMarkets);
      const leadMarket = sorted[0] as DashboardMarket;
      const notionals = eventMarkets.map(marketNotional24h).filter((value): value is number => value !== null);
      return {
        eventTicker,
        title: leadMarket.eventTitle,
        topic: leadMarket.topic,
        category: leadMarket.eventCategory,
        markets: sorted,
        leadMarket,
        notional24h: notionals.length === eventMarkets.length && notionals.length > 0
          ? notionals.reduce((sum, value) => sum + value, 0)
          : null,
        sourceUrl: eventSourceUrl(eventTicker),
      };
    })
    .sort((a, b) => {
      if (a.notional24h === null && b.notional24h === null) return a.title.localeCompare(b.title);
      if (a.notional24h === null) return 1;
      if (b.notional24h === null) return -1;
      return b.notional24h - a.notional24h;
    });
}
