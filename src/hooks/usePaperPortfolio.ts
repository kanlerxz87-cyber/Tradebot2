import { useEffect, useMemo, useState } from 'react';
import {
  emptyPaperPortfolio,
  markPaperPortfolio,
  portfolioEquity,
  processPaperAlert,
  realizedPnl,
  winRate,
} from '../lib/paperTrading';
import type { DashboardMarket, MarketFeedItem, PaperPortfolio } from '../types/kalshi';

const STORAGE_KEY = 'signal-desk.paper-portfolio.v1';

function loadPortfolio(): PaperPortfolio {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPaperPortfolio();
    const parsed = JSON.parse(raw) as Partial<PaperPortfolio>;
    if (
      typeof parsed.startingCash !== 'number' ||
      typeof parsed.cash !== 'number' ||
      !Array.isArray(parsed.trades) ||
      !Array.isArray(parsed.equityHistory) ||
      !Array.isArray(parsed.processedAlertIds)
    ) {
      return emptyPaperPortfolio();
    }
    return parsed as PaperPortfolio;
  } catch {
    return emptyPaperPortfolio();
  }
}

export function usePaperPortfolio(markets: DashboardMarket[], selectedFeed: MarketFeedItem[]) {
  const [portfolio, setPortfolio] = useState<PaperPortfolio>(loadPortfolio);

  useEffect(() => {
    setPortfolio((current) => {
      const marketMap = new Map(markets.map((market) => [market.ticker, market]));
      const withAlerts = [...selectedFeed]
        .sort((a, b) => a.timestamp - b.timestamp)
        .reduce(
          (next, alert) => processPaperAlert(next, alert, alert.ticker ? marketMap.get(alert.ticker) : undefined),
          current,
        );
      return markPaperPortfolio(withAlerts, markets, Date.now());
    });
  }, [markets, selectedFeed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    } catch {
      // Storage can be unavailable in private browsing. The in-memory simulator
      // remains valid for the current page session.
    }
  }, [portfolio]);

  const metrics = useMemo(
    () => ({
      equity: portfolioEquity(portfolio),
      realizedPnl: realizedPnl(portfolio),
      winRate: winRate(portfolio),
      openTrades: portfolio.trades.filter((trade) => trade.status === 'open').length,
      closedTrades: portfolio.trades.filter((trade) => trade.status === 'closed').length,
    }),
    [portfolio],
  );

  return {
    portfolio,
    metrics,
    reset: () => setPortfolio(emptyPaperPortfolio()),
  };
}
