import { classifyTopic } from '../data/topics';
import type {
  DashboardMarket,
  EventsResponse,
  KalshiEvent,
  KalshiMarket,
  MarketsResponse,
  OrderbookLevel,
  OrderbookResponse,
} from '../types/kalshi';
import { parseFixed } from '../lib/format';

export const DEMO_API_BASE = 'https://external-api.demo.kalshi.co/trade-api/v2';
export const DEMO_WS_URL = 'wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2';
export const POLL_INTERVAL_MS = 10_000;
export const DISCOVERY_INTERVAL_MS = 60_000;

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_EVENT_PAGES = 100;
const TICKER_BATCH_SIZE = 40;

export class KalshiApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'KalshiApiError';
    this.status = status;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new KalshiApiError(`Kalshi demo API returned HTTP ${response.status}.`, response.status);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new KalshiApiError('Kalshi demo API returned a non-JSON response.', response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof KalshiApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new KalshiApiError('Kalshi demo API request timed out.');
    }
    throw new KalshiApiError(
      error instanceof Error ? `Kalshi demo API request failed: ${error.message}` : 'Kalshi demo API request failed.',
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

function isMarket(value: unknown): value is KalshiMarket {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KalshiMarket>;
  return typeof candidate.ticker === 'string' && typeof candidate.event_ticker === 'string' && typeof candidate.status === 'string';
}

function isEvent(value: unknown): value is KalshiEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<KalshiEvent>;
  return typeof candidate.event_ticker === 'string' && typeof candidate.title === 'string';
}

export function marketSourceUrl(ticker: string): string {
  return `${DEMO_API_BASE}/markets/${encodeURIComponent(ticker)}`;
}

export function eventSourceUrl(eventTicker: string): string {
  return `${DEMO_API_BASE}/events/${encodeURIComponent(eventTicker)}`;
}

export function orderbookSourceUrl(ticker: string): string {
  return `${marketSourceUrl(ticker)}/orderbook`;
}

export function flattenTargetEvents(events: KalshiEvent[], observedAt = new Date().toISOString()): DashboardMarket[] {
  const flattened: DashboardMarket[] = [];

  for (const event of events) {
    const eventTopic = classifyTopic(`${event.title} ${event.sub_title ?? ''}`, event.category);
    if (!eventTopic) continue;

    for (const market of event.markets ?? []) {
      if (!isMarket(market)) continue;
      const marketTopic = classifyTopic(
        `${event.title} ${event.sub_title ?? ''} ${market.title ?? ''} ${market.subtitle ?? ''} ${market.yes_sub_title ?? ''}`,
        event.category,
      );
      if (!marketTopic) continue;

      flattened.push({
        ...market,
        eventTitle: event.title,
        eventCategory: event.category?.trim() || null,
        topic: marketTopic,
        settlementSources: Array.isArray(event.settlement_sources) ? event.settlement_sources : [],
        eventUpdatedAt: event.last_updated_ts,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      });
    }
  }

  return flattened;
}

export async function fetchTargetMarkets(): Promise<DashboardMarket[]> {
  const events: KalshiEvent[] = [];
  const seenCursors = new Set<string>();
  let cursor = '';

  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    const params = new URLSearchParams({
      limit: '200',
      status: 'open',
      with_nested_markets: 'true',
    });
    if (cursor) params.set('cursor', cursor);

    const data = await fetchJson<EventsResponse>(`${DEMO_API_BASE}/events?${params.toString()}`);
    if (!Array.isArray(data.events)) {
      throw new KalshiApiError('Kalshi demo API events response did not contain an events array.');
    }

    events.push(...data.events.filter(isEvent));
    const nextCursor = typeof data.cursor === 'string' ? data.cursor : '';
    if (!nextCursor) return flattenTargetEvents(events);
    if (seenCursors.has(nextCursor)) {
      throw new KalshiApiError('Kalshi demo API repeated an event cursor; incomplete data was discarded.');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new KalshiApiError('Kalshi demo API event pagination exceeded the safety limit; incomplete data was discarded.');
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

export async function fetchMarketsByTickers(tickers: string[]): Promise<KalshiMarket[]> {
  const unique = [...new Set(tickers.filter(Boolean))];
  if (unique.length === 0) return [];

  const batches = chunks(unique, TICKER_BATCH_SIZE);
  const responses = await Promise.all(
    batches.map(async (batch) => {
      const params = new URLSearchParams({ tickers: batch.join(','), limit: String(batch.length) });
      const data = await fetchJson<MarketsResponse>(`${DEMO_API_BASE}/markets?${params.toString()}`);
      if (!Array.isArray(data.markets)) {
        throw new KalshiApiError('Kalshi demo API markets response did not contain a markets array.');
      }
      return data.markets.filter(isMarket);
    }),
  );

  return responses.flat();
}

export async function fetchOrderbook(ticker: string): Promise<OrderbookLevel[]> {
  const sourceUrl = orderbookSourceUrl(ticker);
  const data = await fetchJson<OrderbookResponse>(sourceUrl);
  const levels: OrderbookLevel[] = [];

  for (const side of ['yes', 'no'] as const) {
    const raw = data.orderbook_fp?.[`${side}_dollars`];
    if (!Array.isArray(raw)) continue;

    for (const entry of raw) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const price = parseFixed(entry[0]);
      const quantity = parseFixed(entry[1]);
      if (price === null || quantity === null) continue;
      levels.push({ side, price, quantity, sourceUrl });
    }
  }

  return levels;
}
