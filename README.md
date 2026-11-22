# Signal Desk — Kalshi Demo Monitor

A source-first, GitHub Pages dashboard for monitoring selected Kalshi demo markets, detecting price swings, inspecting bid depth, and evaluating an automated **paper** strategy.

**Live site:** <https://kanlerxz87-cyber.github.io/Tradebot2/>

> This project is independent research software. It is not affiliated with or endorsed by Kalshi. Paper results are simulated and are not investment advice.

## What it does

- Discovers open events from Kalshi's recommended demo REST host.
- Keeps only **gas prices, elections, culture, crypto, and golf** using a disclosed local classification rule.
- Ranks events by calculated 24-hour contract notional: `volume_24h_fp × notional_value_dollars`.
- Polls tracked contracts every 10 seconds and flags net YES-price moves of **at least $0.10** in either direction.
- Shows two auto-scrolling tapes: all observed movements and a transparent score-gated shortlist.
- Retains observed contracts through an API-reported `yes` / `no` result.
- Charts locally observed YES prices over 60-second, 15-minute, and 1-hour windows.
- Displays official YES/NO bid levels and fixed-point contract quantities.
- Runs an autonomous one-contract paper strategy and groups results by topic.
- Links every live table row to its official Kalshi demo API record.
- Publishes official documentation sources and unresolved constraints in the interface.

## Truth boundaries

This is a static GitHub Pages application. Kalshi documents signed authentication headers for account endpoints and the WebSocket handshake. A public bundle cannot safely hold the private signing key, so:

- public demo market data is live through REST polling;
- authenticated demo balance, positions, fills, and orders stay blank;
- authenticated WebSockets and demo order execution are not claimed;
- paper trading is clearly separated from demo-account trading;
- price-jump causes remain “unverified” unless independently reviewed;
- absent API fields render as `—` and are never filled with estimates.

See [Flagged for Review](https://kanlerxz87-cyber.github.io/Tradebot2/#/review) and [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Official sources

- [API environments and endpoints](https://docs.kalshi.com/getting_started/api_environments)
- [Unauthenticated market data](https://docs.kalshi.com/getting_started/quick_start_market_data)
- [Get Markets schema](https://docs.kalshi.com/api-reference/market/get-markets)
- [Get Events schema](https://docs.kalshi.com/api-reference/events/get-events)
- [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook)
- [Authenticated requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests)
- [WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets)
- [Create an order](https://docs.kalshi.com/getting_started/quick_start_create_order)
- [API changelog](https://docs.kalshi.com/changelog)

The complete claim-by-claim register is in [`src/data/sources.ts`](src/data/sources.ts) and rendered on the **Sources & methods** page.

## Local development

Requirements: a current Node.js release and npm.

```bash
npm ci
npm run dev
```

The Vite server binds to `0.0.0.0`. No `.env` file or credentials are required or accepted.

## Verification

```bash
npm run check
```

This runs ESLint, the Vitest suite, TypeScript compilation, and a production Vite build. Core tests cover:

- five-topic classification and unrelated-market exclusion;
- inclusive `$0.10` swing detection;
- null-preserving calculations;
- event normalization;
- price and resolution alerts;
- automatic paper entry and exit;
- official-source URL policy.

## Architecture

```text
Kalshi demo REST API
  ├─ /events?status=open&with_nested_markets=true  (discovery, 60s)
  ├─ /markets?tickers=…                            (tracked prices/status, 10s)
  └─ /markets/{ticker}/orderbook                   (selected depth, 15s)
                    │
                    ▼
React monitor → alert engine → local paper engine → charts/tables
                    │
                    ▼
           Browser memory + localStorage
```

No backend, database, signing key, analytics tracker, or fabricated fallback dataset is included.

## Documentation

- [`docs/EXECUTIVE_SUMMARY.md`](docs/EXECUTIVE_SUMMARY.md)
- [`docs/REQUIREMENTS_TRACEABILITY.md`](docs/REQUIREMENTS_TRACEABILITY.md)
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`COORDINATION.md`](COORDINATION.md)

## Deployment

`.github/workflows/pages.yml` validates and deploys `dist/` to GitHub Pages after a push to `main`. The app uses hash routes so category and research pages work without server rewrites.

## Parallel-session archive

PRs #1–#3 landed a separate static implementation while this final integration was in progress. That work is preserved under [`archive/parallel-sessions/`](archive/parallel-sessions/README.md), but excluded from the deployed artifact because its hard-coded market/account/performance values could not be confirmed row-by-row from official Kalshi API records. The conflict and preservation decision is recorded in `COORDINATION.md`.

## License / usage

No license has been granted by the repository owner. All Kalshi names, API documentation, and API data remain subject to Kalshi's terms and policies.
