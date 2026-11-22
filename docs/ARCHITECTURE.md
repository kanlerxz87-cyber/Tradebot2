# Architecture and security

## Runtime topology

Signal Desk is a client-only Vite/React application deployed to GitHub Pages.

```text
┌──────────────────────────────── Kalshi demo ────────────────────────────────┐
│ GET /events              public discovery, nested markets, event metadata  │
│ GET /markets             public tracked price/status/result refresh        │
│ GET /markets/{id}/orderbook public bid depth                               │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ HTTPS / JSON
                                       ▼
┌────────────────────────────── browser tab ──────────────────────────────────┐
│ API validation → topic rules → market state → movement / resolution engine │
│                                      │                                      │
│                  ┌───────────────────┼──────────────────┐                   │
│                  ▼                   ▼                  ▼                   │
│             dual alert feed     SVG chart/depth    paper engine            │
│                                                          │                  │
│                                                          ▼                  │
│                                                   localStorage              │
└──────────────────────────────────────────────────────────────────────────────┘
```

Official market-data basis: [Kalshi Quick Start: Market Data](https://docs.kalshi.com/getting_started/quick_start_market_data).

## Polling schedule

| Request | Interval | Purpose | Official source |
|---|---:|---|---|
| `GET /events?status=open&with_nested_markets=true&limit=200` | 60 seconds | Discover and classify newly open events. | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| `GET /markets?tickers=…` | 10 seconds | Refresh official tracked price, status, and result fields. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| `GET /markets/{ticker}/orderbook` | 15 seconds | Refresh selected YES/NO bid levels and contract quantities. | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |

Requests time out after 15 seconds. Failed requests retain prior sourced observations, mark the connection delayed/offline, and surface the exact failure. No fallback market values are generated.

## State ownership

| State | Lifetime | Persistence | Source |
|---|---|---|---|
| Market/event snapshots | Current tab | Memory | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Price chart points | Current tab, capped per ticker | Memory | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Movement/swing/resolution feeds | Current tab, latest 120 each | Memory | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Selected order book | Current tab | Memory | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| Paper portfolio | Browser | `localStorage` | Simulation; input-field semantics compared with [Create Order](https://docs.kalshi.com/getting_started/quick_start_create_order) |
| Kalshi account data | None | None | Requires [authenticated requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) |

## Authentication boundary

Kalshi documents three request headers for authenticated operations:

- `KALSHI-ACCESS-KEY`
- `KALSHI-ACCESS-SIGNATURE`
- `KALSHI-ACCESS-TIMESTAMP`

The signature uses the private key over timestamp + HTTP method + full path without query parameters. See [official authenticated-request guidance](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests).

This repository therefore contains:

- no key identifier;
- no private key;
- no environment-variable placeholder injected into the browser;
- no credential collection form;
- no authenticated account request;
- no live/demo order POST;
- no production API base URL in the runtime service.

Putting a private key in a Vite variable would not solve this: Vite client variables are bundled and public.

## WebSocket boundary

Kalshi's demo WebSocket handshake requires the same signed authentication headers. See [official WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets). A static site cannot safely perform server-secret signing, so this release uses public REST polling and discloses the resulting observation gap.

A secure future design should:

1. terminate the authenticated Kalshi WebSocket in a backend;
2. validate sequence numbers and resnapshot on gaps;
3. normalize only required public fields;
4. send sanitized updates to the browser through a separate client-facing stream;
5. keep account and market streams permission-separated;
6. enforce demo-only host allowlists.

## Data integrity controls

- Event identities require `event_ticker` and `title`.
- Market identities require `ticker`, `event_ticker`, and `status`.
- Numeric display values must parse as finite fixed-point values.
- Missing fields become `null`, not zero.
- A result is accepted only when exactly `yes` or `no`.
- Source URLs are constructed from the fixed recommended demo base and URL-encoded ticker.
- API responses must be JSON and successful HTTP responses.
- All polling calls use `cache: no-store`.
- Market ticker lists are deduplicated and batched.
- Alert IDs and processed paper-alert IDs prevent repeated paper entry.
- One open paper trade per ticker is enforced.

Schema sources: [Get Events](https://docs.kalshi.com/api-reference/events/get-events), [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets), and [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook).

## Static deployment

- Vite base path is `/Tradebot2/` in GitHub Actions.
- Hash routes avoid 404s for subpages.
- The Pages workflow installs from `package-lock.json`, runs all checks, builds once, uploads `dist/`, and uses the official GitHub Pages deployment action.
- No data or credentials are produced during build.

## Non-goals in this release

- authenticated portfolio access;
- authenticated demo execution;
- production trading;
- full historical backfill;
- guaranteed intrapoll event capture;
- inferred news causality;
- ROI prediction;
- financial advice.
