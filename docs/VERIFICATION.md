# Verification record

**Review date:** 2026-11-22 UTC  
**Reviewer session:** `d1222891`  
**Branch:** `arena/d1222891-tradebot2`

## Verification standard

A displayed fact must be one of:

1. a direct value from the official Kalshi demo API;
2. a transparent calculation over named direct values;
3. explicitly labeled local classification or simulation logic; or
4. blank and published as unverified/constrained.

No bundled market fixture is used at runtime. Test fixtures are synthetic and exist only inside the test suite.

## Official documentation checks

| Claim checked | Finding | Official source |
|---|---|---|
| Recommended demo REST root | `https://external-api.demo.kalshi.co/trade-api/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Supported shared demo REST root | `https://demo-api.kalshi.co/trade-api/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Recommended and shared demo WebSocket URLs | The two URLs supplied in the brief are documented. | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Public market data | Kalshi documents unauthenticated market, event, and order-book requests with JavaScript examples. | [Market-data quick start](https://docs.kalshi.com/getting_started/quick_start_market_data) |
| Event category / nested markets / settlement sources | Present in the documented event response; nested markets require the query parameter. | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| Market price, status, result, volume, size, notional | Present as fixed-point fields in the market schema. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Market status filter values | Includes open and settled among the documented values. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Order-book semantics | Returns YES/NO bids as ascending `[price, quantity]` levels; no order counts. | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| `liquidity_dollars` | Deprecated, returned zero, and removed; top-of-book sizes are recommended instead. | [API changelog](https://docs.kalshi.com/changelog) |
| Authenticated request signature | Requires access key, signature, timestamp; signs timestamp + method + full path without query. | [Authenticated requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) |
| WebSocket authentication | Signed headers are required at connection time. | [WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets) |
| Account balance | Authenticated endpoint returns available balance and portfolio value. | [Get Balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) |
| Account positions | Authenticated endpoint returns market/event positions, exposure, P&L, and fees. | [Get Positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) |
| Fills | Authenticated endpoint returns matched fills and supports filters/pagination. | [Get Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) |
| Order creation | Authenticated POST with documented order fields and client order ID. | [Create order guide](https://docs.kalshi.com/getting_started/quick_start_create_order) |
| Historical cutoffs | Older settled market/account data can require historical endpoints. | [Historical data](https://docs.kalshi.com/getting_started/historical_data) |

## Runtime field handling

| Field group | Handling | Source |
|---|---|---|
| Identity | Reject event records without `event_ticker`/`title`; reject markets without `ticker`/`event_ticker`/`status`. | [Event schema](https://docs.kalshi.com/api-reference/events/get-events) |
| Fixed-point numbers | Parse only finite strings/numbers; empty, absent, or malformed values become `null` and render `—`. | [Market schema](https://docs.kalshi.com/api-reference/market/get-markets) |
| Result | Treat only exact `yes` or `no` as a resolution. | [Market schema](https://docs.kalshi.com/api-reference/market/get-markets) |
| Order-book levels | Use only two-element levels whose price and quantity both parse as finite numbers. | [Order-book schema](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| Settlement links | Preserve the official event field, but do not call it a catalyst. | [Event schema](https://docs.kalshi.com/api-reference/events/get-events) |
| Account values | Do not request or render without a secure authenticated service. | [Authentication guide](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) |

## Calculation checks

| Calculation | Formula | Null / boundary rule | Source inputs |
|---|---|---|---|
| 24h contract notional | `volume_24h_fp × notional_value_dollars` | Blank unless both fields exist. Never labeled cash volume or liquidity. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Poll-to-poll movement | `current last_price_dollars − previous observed last_price_dollars` | No alert without both observations. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Swing | `abs(movement) >= 0.10` | Inclusive; floating-point epsilon protects the exact decimal boundary. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Displayed spread | `yes_ask_dollars − yes_bid_dollars` | Blank for missing fields or inverted values. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Paper NO mark | `1 − last YES price` | Blank without official last YES price. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Paper P&L | `(mark/exit − entry) × quantity` | Simulation only; no fees or queue assumptions. | [Create order guide](https://docs.kalshi.com/getting_started/quick_start_create_order) |

## Automated checks

Run:

```bash
npm run check
```

Current expected checks:

| Check | Scope | Pass condition |
|---|---|---|
| ESLint | TypeScript/TSX source and tests | No lint findings. |
| Vitest | 9 core tests | All pass. |
| TypeScript | Strict referenced projects | No type errors. |
| Vite production build | Static site bundle | Exit 0 and emit `dist/`. |
| Source policy test | Static source and flag registries | Every link begins with `https://docs.kalshi.com/`. |
| Topic tests | Positive and unrelated negative examples | Only the requested five lanes match. |
| Swing tests | +$0.10, −$0.10, $0.099 | Inclusive threshold behaves exactly. |
| Paper test | Entry and target exit | Uses displayed ask and disclosed target. |

## Manual code review checklist

- [x] No private key, API key, token, credential form, or production endpoint in runtime code.
- [x] No runtime sample/fallback market dataset.
- [x] Every dynamic market/trade/order-book row carries an official API URL.
- [x] Every static research, score, source, requirement, and review row carries an official documentation URL.
- [x] Calculations are labeled in the page where displayed.
- [x] Topic classification is labeled local.
- [x] Paper and authenticated account sections are visually separate.
- [x] Alert cause is labeled unverified.
- [x] The removed liquidity field is not consumed.
- [x] Order-book quantity is not mislabeled as order count.
- [x] Empty/error states do not inject placeholder values.
- [x] Hash routes avoid GitHub Pages rewrite failures.
- [x] Vite preview accepts the Arena proxy host.

## Open verification items

| ID | Item | Why open | Official source |
|---|---|---|---|
| FR-001 | Authenticated demo account | No key/private key and no secure backend; values remain blank. | [Authentication guide](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) |
| FR-002 | WebSocket stream | Static browser bundle cannot safely hold signing material; REST polling used. | [WebSocket guide](https://docs.kalshi.com/getting_started/quick_start_websockets) |
| FR-003 | Price-jump catalyst | Event/market data does not prove causal attribution. | [Event schema](https://docs.kalshi.com/api-reference/events/get-events) |
| FR-004 | Deployment-time demo-host reachability | Browser CORS/availability is external to repository correctness; exact errors are surfaced with no fallback data. | [Market-data guide](https://docs.kalshi.com/getting_started/quick_start_market_data) |
| FR-005 | “Highest dollar amount” interpretation | Removed liquidity field cannot rank dollar liquidity; transparent contract-notional calculation is used. | [API changelog](https://docs.kalshi.com/changelog) |
