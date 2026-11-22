import { marketMarkForSide } from './analytics';
import { parseFixed } from './format';
import type {
  DashboardMarket,
  MarketFeedItem,
  PaperExitReason,
  PaperPortfolio,
  PaperTrade,
} from '../types/kalshi';

export const PAPER_STARTING_CASH = 10_000;
export const PAPER_QUANTITY = 1;
export const PAPER_TAKE_PROFIT = 0.1;
export const PAPER_STOP_LOSS = 0.08;
export const PAPER_MAX_HOLD_MS = 6 * 60 * 60 * 1000;

export function emptyPaperPortfolio(): PaperPortfolio {
  return {
    startingCash: PAPER_STARTING_CASH,
    cash: PAPER_STARTING_CASH,
    trades: [],
    equityHistory: [{ timestamp: Date.now(), equity: PAPER_STARTING_CASH }],
    processedAlertIds: [],
  };
}

function entryForAlert(alert: MarketFeedItem, market: DashboardMarket): { side: 'yes' | 'no'; price: number } | null {
  if (alert.delta === null || alert.delta === 0) return null;
  const side = alert.delta > 0 ? 'yes' : 'no';
  const price = parseFixed(side === 'yes' ? market.yes_ask_dollars : market.no_ask_dollars);
  if (price === null || price <= 0 || price >= 1) return null;
  return { side, price };
}

export function processPaperAlert(
  portfolio: PaperPortfolio,
  alert: MarketFeedItem,
  market: DashboardMarket | undefined,
): PaperPortfolio {
  if (portfolio.processedAlertIds.includes(alert.id)) return portfolio;

  const processedAlertIds = [...portfolio.processedAlertIds, alert.id].slice(-500);
  if (!alert.modelSelected || !market || !alert.ticker) return { ...portfolio, processedAlertIds };
  if (portfolio.trades.some((trade) => trade.ticker === alert.ticker && trade.status === 'open')) {
    return { ...portfolio, processedAlertIds };
  }

  const entry = entryForAlert(alert, market);
  if (!entry) return { ...portfolio, processedAlertIds };

  const cost = entry.price * PAPER_QUANTITY;
  if (portfolio.cash < cost) return { ...portfolio, processedAlertIds };

  const trade: PaperTrade = {
    id: `paper:${alert.id}`,
    alertId: alert.id,
    ticker: market.ticker,
    eventTitle: market.eventTitle,
    topic: market.topic,
    strategy: 'swing-momentum-v1',
    side: entry.side,
    quantity: PAPER_QUANTITY,
    entryPrice: entry.price,
    openedAt: alert.timestamp,
    status: 'open',
    markPrice: entry.price,
    unrealizedPnl: 0,
    exitPrice: null,
    closedAt: null,
    realizedPnl: null,
    exitReason: null,
    sourceUrl: alert.sourceUrl,
  };

  return {
    ...portfolio,
    cash: portfolio.cash - cost,
    trades: [trade, ...portfolio.trades],
    processedAlertIds,
  };
}

function resolvedExit(market: DashboardMarket, side: 'yes' | 'no'): { price: number; reason: PaperExitReason } | null {
  if (market.result !== 'yes' && market.result !== 'no') return null;
  return {
    price: market.result === side ? 1 : 0,
    reason: market.result === 'yes' ? 'resolved-yes' : 'resolved-no',
  };
}

export function markPaperPortfolio(
  portfolio: PaperPortfolio,
  markets: DashboardMarket[],
  timestamp: number,
): PaperPortfolio {
  const marketMap = new Map(markets.map((market) => [market.ticker, market]));
  let cash = portfolio.cash;
  let changed = false;

  const trades = portfolio.trades.map((trade): PaperTrade => {
    if (trade.status === 'closed') return trade;
    const market = marketMap.get(trade.ticker);
    if (!market) return trade;

    const resolution = resolvedExit(market, trade.side);
    const mark = resolution?.price ?? marketMarkForSide(market, trade.side);
    if (mark === null) return trade;

    const pnl = (mark - trade.entryPrice) * trade.quantity;
    let exitReason: PaperExitReason | null = resolution?.reason ?? null;
    if (!exitReason && pnl >= PAPER_TAKE_PROFIT * trade.quantity) exitReason = 'take-profit';
    if (!exitReason && pnl <= -PAPER_STOP_LOSS * trade.quantity) exitReason = 'stop-loss';
    if (!exitReason && timestamp - trade.openedAt >= PAPER_MAX_HOLD_MS) exitReason = 'time-limit';

    changed = changed || mark !== trade.markPrice || exitReason !== null;
    if (!exitReason) {
      return { ...trade, markPrice: mark, unrealizedPnl: pnl };
    }

    cash += mark * trade.quantity;
    return {
      ...trade,
      status: 'closed',
      markPrice: mark,
      unrealizedPnl: 0,
      exitPrice: mark,
      closedAt: timestamp,
      realizedPnl: pnl,
      exitReason,
    };
  });

  const openValue = trades
    .filter((trade) => trade.status === 'open')
    .reduce((sum, trade) => sum + trade.markPrice * trade.quantity, 0);
  const equity = cash + openValue;
  const previousPoint = portfolio.equityHistory.at(-1);
  const shouldAppend =
    !previousPoint ||
    Math.abs(previousPoint.equity - equity) > 0.000_001 ||
    timestamp - previousPoint.timestamp >= 60_000;
  const equityHistory = shouldAppend
    ? [...portfolio.equityHistory, { timestamp, equity }].slice(-720)
    : portfolio.equityHistory;

  if (!changed && cash === portfolio.cash && equityHistory === portfolio.equityHistory) return portfolio;
  return { ...portfolio, cash, trades, equityHistory };
}

export function portfolioEquity(portfolio: PaperPortfolio): number {
  return portfolio.cash + portfolio.trades
    .filter((trade) => trade.status === 'open')
    .reduce((sum, trade) => sum + trade.markPrice * trade.quantity, 0);
}

export function realizedPnl(portfolio: PaperPortfolio): number {
  return portfolio.trades.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0);
}

export function winRate(portfolio: PaperPortfolio): number | null {
  const closed = portfolio.trades.filter((trade) => trade.status === 'closed' && trade.realizedPnl !== null);
  if (closed.length === 0) return null;
  return closed.filter((trade) => (trade.realizedPnl ?? 0) > 0).length / closed.length;
}
