export interface OfficialSource {
  id: string;
  area: string;
  verifiedClaim: string;
  officialUrl: string;
  status: 'verified' | 'flagged';
  verifiedAt: string;
  note: string;
}

export const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: 'environments',
    area: 'Environment',
    verifiedClaim: 'The recommended demo REST root is https://external-api.demo.kalshi.co/trade-api/v2; the shared demo-api host remains supported.',
    officialUrl: 'https://docs.kalshi.com/getting_started/api_environments',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'The dashboard uses only the recommended demo REST host.',
  },
  {
    id: 'public-market-data',
    area: 'Market data',
    verifiedClaim: 'Kalshi documents unauthenticated public market-data requests and JavaScript fetch examples for markets, events, and order books.',
    officialUrl: 'https://docs.kalshi.com/getting_started/quick_start_market_data',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'This is the basis for browser-side polling.',
  },
  {
    id: 'markets-schema',
    area: 'Market fields',
    verifiedClaim: 'Market responses document fixed-point dollar prices, fixed-point volume/open interest, market status, result, top-of-book size, and notional value.',
    officialUrl: 'https://docs.kalshi.com/api-reference/market/get-markets',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'Unknown or absent fields render as an em dash; the UI does not invent values.',
  },
  {
    id: 'events-schema',
    area: 'Events',
    verifiedClaim: 'Get Events can include nested markets and returns the event category and settlement sources.',
    officialUrl: 'https://docs.kalshi.com/api-reference/events/get-events',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'Dashboard topics are an explicitly labeled local ruleset, not a Kalshi classification.',
  },
  {
    id: 'orderbook',
    area: 'Liquidity depth',
    verifiedClaim: 'The order-book endpoint returns YES and NO bids as fixed-point [price, quantity] levels sorted ascending; it does not return order counts.',
    officialUrl: 'https://docs.kalshi.com/api-reference/market/get-market-orderbook',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'The interface labels quantities as contracts and never as order counts.',
  },
  {
    id: 'websocket',
    area: 'Streaming',
    verifiedClaim: 'The recommended demo WebSocket host is wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2 and the connection requires signed authentication headers.',
    officialUrl: 'https://docs.kalshi.com/getting_started/quick_start_websockets',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'A static browser client cannot safely hold the signing key, so this release uses REST polling.',
  },
  {
    id: 'authentication',
    area: 'Authentication',
    verifiedClaim: 'Authenticated requests use key ID, signature, and millisecond timestamp headers; the signed message includes timestamp, method, and full path without query parameters.',
    officialUrl: 'https://docs.kalshi.com/getting_started/quick_start_authenticated_requests',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'No private key, API key, or credential input is included in the static site.',
  },
  {
    id: 'create-order',
    area: 'Execution',
    verifiedClaim: 'Creating an order is an authenticated POST operation with a unique client order ID and documented order payload.',
    officialUrl: 'https://docs.kalshi.com/getting_started/quick_start_create_order',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'Live demo execution is deliberately disabled without a secret-bearing server.',
  },
  {
    id: 'balance',
    area: 'Portfolio',
    verifiedClaim: 'The authenticated balance endpoint returns available balance, portfolio value, and an update timestamp.',
    officialUrl: 'https://docs.kalshi.com/api-reference/portfolio/get-balance',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'The site does not claim to show a demo-account balance because credentials were not supplied.',
  },
  {
    id: 'positions',
    area: 'Portfolio',
    verifiedClaim: 'The authenticated positions endpoint returns market and event positions with exposure, realized P&L, fees, and update data.',
    officialUrl: 'https://docs.kalshi.com/api-reference/portfolio/get-positions',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'Paper positions are separately labeled and stored only in this browser.',
  },
  {
    id: 'fills',
    area: 'Portfolio',
    verifiedClaim: 'The authenticated fills endpoint returns matched fills and supports pagination and market/time filters.',
    officialUrl: 'https://docs.kalshi.com/api-reference/portfolio/get-fills',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'No account fills are shown without authenticated server access.',
  },
  {
    id: 'liquidity-deprecation',
    area: 'Liquidity',
    verifiedClaim: 'Kalshi removed the deprecated liquidity_dollars market field after it had returned zero; top-of-book size fields are the documented replacement for top-of-book size.',
    officialUrl: 'https://docs.kalshi.com/changelog',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'The dashboard uses top-of-book size and the order-book endpoint instead of the removed field.',
  },
  {
    id: 'historical',
    area: 'Resolved history',
    verifiedClaim: 'Older settled markets and portfolio records cross documented historical cutoffs and may require historical endpoints.',
    officialUrl: 'https://docs.kalshi.com/getting_started/historical_data',
    status: 'verified',
    verifiedAt: '2026-11-22',
    note: 'This browser session retains markets it observed; it is not a complete historical archive.',
  },
];

export interface ReviewFlag {
  id: string;
  severity: 'constraint' | 'needs review';
  title: string;
  detail: string;
  impact: string;
  sourceUrl: string;
  status: 'open';
}

export const REVIEW_FLAGS: ReviewFlag[] = [
  {
    id: 'FR-001',
    severity: 'constraint',
    title: 'Authenticated demo account is not connected',
    detail: 'No Kalshi API key or private signing key was provided, and a public GitHub Pages bundle is not a safe secret store.',
    impact: 'Account balance, positions, fills, and live demo orders remain blank. Automated paper trading is active instead.',
    sourceUrl: 'https://docs.kalshi.com/getting_started/quick_start_authenticated_requests',
    status: 'open',
  },
  {
    id: 'FR-002',
    severity: 'constraint',
    title: 'REST polling replaces authenticated WebSocket streaming',
    detail: 'Kalshi documents signed headers for the WebSocket handshake. Native browser WebSocket APIs do not expose a secure secret-bearing handshake path for a static site.',
    impact: 'The monitor detects net price moves between polls; it can miss an intrapoll move that fully reverses.',
    sourceUrl: 'https://docs.kalshi.com/getting_started/quick_start_websockets',
    status: 'open',
  },
  {
    id: 'FR-003',
    severity: 'constraint',
    title: 'No causality is assigned to price jumps',
    detail: 'A timestamp correlation does not verify that a webpage or news item caused a market move. Event settlement sources are not treated as catalysts.',
    impact: 'Swing alerts show “cause unverified” and link to the official Kalshi market record only.',
    sourceUrl: 'https://docs.kalshi.com/api-reference/events/get-events',
    status: 'open',
  },
  {
    id: 'FR-004',
    severity: 'needs review',
    title: 'Demo browser reachability depends on Kalshi CORS and availability',
    detail: 'The implementation follows Kalshi’s documented JavaScript public-market-data pattern, but deployment-time demo-host availability cannot be guaranteed by this repository.',
    impact: 'If the browser request fails, the UI remains empty and shows the exact error; it never substitutes fabricated values.',
    sourceUrl: 'https://docs.kalshi.com/getting_started/quick_start_market_data',
    status: 'open',
  },
  {
    id: 'FR-005',
    severity: 'constraint',
    title: '“Highest dollar amount” uses calculated contract notional',
    detail: 'The removed liquidity_dollars field cannot support dollar ranking. The dashboard calculates 24-hour contract notional as official volume_24h_fp multiplied by official notional_value_dollars.',
    impact: 'This is a transparent ranking metric, not traded cash, liquidity, or profit.',
    sourceUrl: 'https://docs.kalshi.com/changelog',
    status: 'open',
  },
];
