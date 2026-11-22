import { describe, expect, it, vi } from 'vitest';
import { classifyTopic } from '../src/data/topics';
import { OFFICIAL_SOURCES, REVIEW_FLAGS } from '../src/data/sources';
import { isSwing, marketNotional24h, selectivityScore } from '../src/lib/analytics';
import { applyMarketSnapshot } from '../src/lib/marketMonitor';
import { emptyPaperPortfolio, markPaperPortfolio, processPaperAlert } from '../src/lib/paperTrading';
import { flattenTargetEvents } from '../src/services/kalshi';
import type { DashboardMarket, MarketFeedItem } from '../src/types/kalshi';

function market(overrides: Partial<DashboardMarket> = {}): DashboardMarket {
  return {
    ticker: 'KXBTC-TEST-T50000',
    event_ticker: 'KXBTC-TEST',
    status: 'open',
    eventTitle: 'Will Bitcoin trade above $50,000?',
    eventCategory: 'Crypto',
    topic: 'crypto',
    settlementSources: [],
    firstSeenAt: '2026-11-22T00:00:00.000Z',
    lastSeenAt: '2026-11-22T00:00:00.000Z',
    last_price_dollars: '0.4500',
    previous_price_dollars: '0.4000',
    yes_bid_dollars: '0.4300',
    yes_ask_dollars: '0.4700',
    yes_bid_size_fp: '10.00',
    yes_ask_size_fp: '12.00',
    no_ask_dollars: '0.5700',
    volume_24h_fp: '100.00',
    notional_value_dollars: '1.0000',
    ...overrides,
  };
}

describe('topic classifier', () => {
  it('keeps the five requested lanes auditable and excludes broad unrelated categories', () => {
    expect(classifyTopic('Bitcoin price at 5 PM', 'Crypto')).toBe('crypto');
    expect(classifyTopic('Who will win the Masters golf tournament?', 'Sports')).toBe('golf');
    expect(classifyTopic('Average US gasoline price this week', 'Economics')).toBe('gas-prices');
    expect(classifyTopic('Best Picture at the Academy Awards', 'Culture')).toBe('culture');
    expect(classifyTopic('California governor election winner', 'Politics')).toBe('elections');
    expect(classifyTopic('NFL Sunday game winner', 'Sports')).toBeNull();
    expect(classifyTopic('Federal shutdown before Friday', 'Politics')).toBeNull();
  });
});

describe('verified market calculations', () => {
  it('uses an inclusive ten-cent swing threshold', () => {
    expect(isSwing(0.1)).toBe(true);
    expect(isSwing(-0.1)).toBe(true);
    expect(isSwing(0.099)).toBe(false);
  });

  it('calculates and labels contract notional only when both official inputs exist', () => {
    expect(marketNotional24h(market())).toBe(100);
    expect(marketNotional24h(market({ volume_24h_fp: undefined }))).toBeNull();
  });

  it('selects a qualifying swing using the disclosed 100-point ruleset', () => {
    const result = selectivityScore(market({ last_price_dollars: '0.5500' }), 0.1);
    expect(result.score).toBe(100);
    expect(result.selected).toBe(true);
    expect(result.checks).toEqual({
      swing: true,
      tightSpread: true,
      active: true,
      depth: true,
      awayFromEdges: true,
    });
  });
});

describe('official event normalization and monitoring', () => {
  it('flattens only matching official event records without filling absent values', () => {
    const result = flattenTargetEvents([
      {
        event_ticker: 'KXGOLF-1',
        title: 'Who will win the Masters golf tournament?',
        category: 'Sports',
        settlement_sources: [{ name: 'Tournament', url: 'https://example.test' }],
        markets: [{ ticker: 'KXGOLF-1-A', event_ticker: 'KXGOLF-1', status: 'open' }],
      },
      {
        event_ticker: 'KXNFL-1',
        title: 'Who wins Sunday football?',
        category: 'Sports',
        markets: [{ ticker: 'KXNFL-1-A', event_ticker: 'KXNFL-1', status: 'open' }],
      },
    ], '2026-11-22T01:00:00.000Z');

    expect(result).toHaveLength(1);
    expect(result[0]?.topic).toBe('golf');
    expect(result[0]?.last_price_dollars).toBeUndefined();
    expect(result[0]?.eventCategory).toBe('Sports');
  });

  it('creates a selected alert for an exact ten-cent official price update', () => {
    const prior = market();
    const result = applyMarketSnapshot(
      [prior],
      [{
        ...prior,
        last_price_dollars: '0.5500',
        yes_bid_dollars: '0.5300',
        yes_ask_dollars: '0.5700',
      }],
      {},
      1_795_309_200_000,
    );

    expect(result.feedItems).toHaveLength(1);
    expect(result.feedItems[0]?.kind).toBe('swing');
    expect(result.feedItems[0]?.delta).toBeCloseTo(0.1);
    expect(result.selectedItems).toHaveLength(1);
    expect(result.selectedItems[0]?.modelSelected).toBe(true);
    expect(result.histories[prior.ticker]?.[0]?.price).toBe(0.55);
  });

  it('reports only explicit yes/no API results as resolutions', () => {
    const prior = market();
    const result = applyMarketSnapshot([prior], [{ ...prior, status: 'settled', result: 'yes' }], {}, 1_795_309_200_000);
    expect(result.feedItems).toHaveLength(1);
    expect(result.feedItems[0]?.kind).toBe('resolution');
    expect(result.feedItems[0]?.result).toBe('yes');
  });
});

describe('automated paper strategy', () => {
  it('enters at the displayed ask and exits at the disclosed take profit', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_795_309_200_000);
    const currentMarket = market({ last_price_dollars: '0.5500', yes_ask_dollars: '0.6000' });
    const alert: MarketFeedItem = {
      id: 'alert-1',
      kind: 'swing',
      ticker: currentMarket.ticker,
      eventTitle: currentMarket.eventTitle,
      topic: currentMarket.topic,
      timestamp: 1_795_309_200_000,
      fromPrice: 0.45,
      toPrice: 0.55,
      delta: 0.1,
      message: 'Observed swing',
      sourceUrl: 'https://external-api.demo.kalshi.co/trade-api/v2/markets/KXBTC-TEST-T50000',
      selectivityScore: 100,
      modelSelected: true,
    };

    const opened = processPaperAlert(emptyPaperPortfolio(), alert, currentMarket);
    expect(opened.trades).toHaveLength(1);
    expect(opened.trades[0]?.entryPrice).toBe(0.6);
    expect(opened.trades[0]?.side).toBe('yes');
    expect(opened.cash).toBeCloseTo(9_999.4);

    const closed = markPaperPortfolio(opened, [market({ last_price_dollars: '0.7500' })], 1_795_309_210_000);
    expect(closed.trades[0]?.status).toBe('closed');
    expect(closed.trades[0]?.exitReason).toBe('take-profit');
    expect(closed.trades[0]?.realizedPnl).toBeCloseTo(0.15);
    expect(closed.cash).toBeCloseTo(10_000.15);
    vi.restoreAllMocks();
  });
});

describe('source policy', () => {
  it('uses official Kalshi documentation for every static source and review flag', () => {
    for (const source of OFFICIAL_SOURCES) {
      expect(source.officialUrl).toMatch(/^https:\/\/docs\.kalshi\.com\//);
      expect(source.verifiedAt).toBe('2026-11-22');
    }
    for (const flag of REVIEW_FLAGS) {
      expect(flag.sourceUrl).toMatch(/^https:\/\/docs\.kalshi\.com\//);
    }
  });
});
