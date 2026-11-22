export type TopicId = 'gas-prices' | 'elections' | 'culture' | 'crypto' | 'golf';

export type MarketStatus =
  | 'initialized'
  | 'unopened'
  | 'open'
  | 'paused'
  | 'closed'
  | 'settled'
  | 'determined'
  | string;

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type?: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: MarketStatus;
  created_time?: string;
  updated_time?: string;
  open_time?: string;
  close_time?: string;
  expected_expiration_time?: string;
  expiration_time?: string;
  latest_expiration_time?: string;
  yes_bid_dollars?: string;
  yes_bid_size_fp?: string;
  yes_ask_dollars?: string;
  yes_ask_size_fp?: string;
  no_bid_dollars?: string;
  no_ask_dollars?: string;
  last_price_dollars?: string;
  previous_price_dollars?: string;
  previous_yes_bid_dollars?: string;
  previous_yes_ask_dollars?: string;
  volume_fp?: string;
  volume_24h_fp?: string;
  open_interest_fp?: string;
  notional_value_dollars?: string;
  result?: 'yes' | 'no' | '' | string;
  settlement_value_dollars?: string | null;
  rules_primary?: string;
  rules_secondary?: string;
  can_close_early?: boolean;
}

export interface SettlementSource {
  name?: string;
  url?: string;
}

export interface KalshiEvent {
  event_ticker: string;
  series_ticker?: string;
  title: string;
  sub_title?: string;
  category?: string;
  mutually_exclusive?: boolean;
  settlement_sources?: SettlementSource[];
  markets?: KalshiMarket[];
  last_updated_ts?: string;
}

export interface EventsResponse {
  events?: KalshiEvent[];
  cursor?: string;
}

export interface MarketsResponse {
  markets?: KalshiMarket[];
  cursor?: string;
}

export interface DashboardMarket extends KalshiMarket {
  eventTitle: string;
  eventCategory: string | null;
  topic: TopicId;
  settlementSources: SettlementSource[];
  eventUpdatedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface PricePoint {
  ticker: string;
  timestamp: number;
  price: number;
  sourceUrl: string;
}

export type FeedKind = 'movement' | 'swing' | 'resolution' | 'system';

export interface MarketFeedItem {
  id: string;
  kind: FeedKind;
  ticker: string | null;
  eventTitle: string;
  topic: TopicId | null;
  timestamp: number;
  fromPrice: number | null;
  toPrice: number | null;
  delta: number | null;
  message: string;
  sourceUrl: string;
  selectivityScore: number | null;
  modelSelected: boolean;
  result?: 'yes' | 'no';
}

export interface OrderbookResponse {
  orderbook_fp?: {
    yes_dollars?: [string, string][];
    no_dollars?: [string, string][];
  };
}

export interface OrderbookLevel {
  side: 'yes' | 'no';
  price: number;
  quantity: number;
  sourceUrl: string;
}

export type PaperSide = 'yes' | 'no';
export type PaperTradeStatus = 'open' | 'closed';
export type PaperExitReason = 'take-profit' | 'stop-loss' | 'time-limit' | 'resolved-yes' | 'resolved-no';

export interface PaperTrade {
  id: string;
  alertId: string;
  ticker: string;
  eventTitle: string;
  topic: TopicId;
  strategy: 'swing-momentum-v1';
  side: PaperSide;
  quantity: number;
  entryPrice: number;
  openedAt: number;
  status: PaperTradeStatus;
  markPrice: number;
  unrealizedPnl: number;
  exitPrice: number | null;
  closedAt: number | null;
  realizedPnl: number | null;
  exitReason: PaperExitReason | null;
  sourceUrl: string;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

export interface PaperPortfolio {
  startingCash: number;
  cash: number;
  trades: PaperTrade[];
  equityHistory: EquityPoint[];
  processedAlertIds: string[];
}

export type ConnectionState = 'connecting' | 'live' | 'degraded' | 'offline';

export interface MonitorState {
  markets: DashboardMarket[];
  feed: MarketFeedItem[];
  selectedFeed: MarketFeedItem[];
  histories: Record<string, PricePoint[]>;
  connection: ConnectionState;
  lastSyncAt: number | null;
  nextSyncAt: number | null;
  error: string | null;
  isRefreshing: boolean;
}
