/* ============================================================
 * Kalshi Demo Dashboard — shared configuration
 * All topic definitions and constants live here.
 * ============================================================ */

const TOPICS = [
  {
    id: 'gas',
    name: 'Gas Prices',
    short: 'Gas',
    color: '#f59e0b',
    description: "Where oil and gasoline contracts move: crude and gasoline price levels, demand swings and short-term supply shocks.",
    keywords: ['gas', 'petrol', 'crude', 'oil', 'wti', 'brent', 'diesel', 'fuel', 'lpg', 'gasoline'],
  },
  {
    id: 'elections',
    name: 'Elections',
    short: 'Elections',
    color: '#60a5fa',
    description: 'Political markets: winners, margins and key races. Election contracts dominate liquidity and volume on Kalshi.',
    keywords: ['election', 'president', 'senate', 'house', 'governor', 'vote', 'ballot', 'nominee', 'primary', 'midterm'],
  },
  {
    id: 'culture',
    name: 'Culture',
    short: 'Culture',
    color: '#a78bfa',
    description: 'Celebrity, music, film and TV markets — cultural moments that move contract prices hard and fast.',
    keywords: ['culture', 'celebrity', 'music', 'film', 'movie', 'tv', 'song', 'album', 'award', 'show', 'grammy', 'oscar'],
  },
  {
    id: 'crypto',
    name: 'Crypto',
    short: 'Crypto',
    color: '#34d399',
    description: 'Crypto price and adoption contracts: BTC, ETH and other majors, plus altcorn markets that move on news.',
    keywords: ['crypto', 'bitcoin', 'btc', 'eth', 'ethereum', 'sol', 'solana', 'coin', 'token', 'nft'],
  },
  {
    id: 'golf',
    name: 'Golf',
    short: 'Golf',
    color: '#f472b6',
    description: 'Golf tournament markets: majors and top events where a single swing moves a field of bets.',
    keywords: ['golf', 'pga', 'pgatour', 'major', 'augusta', 'masters', 'ryder', 'us open', 'tournament'],
  },
];

const TOPIC_MAP = Object.fromEntries(TOPICS.map(t => [t.id, t]));

const CONFIG = {
  // Alert threshold on a single move
  ALERT_THRESHOLD: 0.10,
  // Baseline window used to detect a "sudden" swing
  SWING_WINDOW_MS: 10000,
  // How often the simulator ticks
  TICK_MS: 1000,
  // History capacity (seconds per market)
  HISTORY_CAP: 86400,
  // Trade window: how many seconds until an open market closes (sim)
  SIM_LIFETIME_SEC: 240,
  STARTING_CASH: 10000,
  // Live API base URLs (from official Kalshi docs)
  LIVE_REST_BASE: 'https://external-api.demo.kalshi.co/trade-api/v2',
  LIVE_REST_FALLBACK: 'https://demo-api.kalshi.co/trade-api/v2',
  LIVE_WS_URL: 'wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2',
  // Sim tick: every market gets a random walk each tick
};

const WINDOW_PRESETS = [
  { label: '30s', sec: 30 },
  { label: '1m', sec: 60 },
  { label: '5m', sec: 300 },
  { label: '1h', sec: 3600 },
  { label: '24h', sec: 86400 },
];
