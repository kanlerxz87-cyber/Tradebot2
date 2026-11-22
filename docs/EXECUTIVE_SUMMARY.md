# Executive summary

**Project:** Signal Desk — Kalshi Demo Monitor  
**Verification date:** 2026-11-22 UTC  
**Environment:** Kalshi demo, public market data only  
**Published target:** <https://kanlerxz87-cyber.github.io/Tradebot2/>

## Decision summary

Signal Desk is a static, source-first trading research interface focused on five requested lanes: gas prices, elections, culture, crypto, and golf. It discovers official demo events, tracks prices and market lifecycle fields, detects observed net moves of at least $0.10, presents all-market and score-gated alert tapes, exposes order-book bid quantities, and runs a fully automatic browser-local paper strategy.

The implementation deliberately separates three kinds of information:

1. **Direct** — returned by Kalshi's official demo API.
2. **Calculated** — reproducible arithmetic over named direct fields.
3. **Local classification / simulation** — clearly labeled product logic, never represented as a Kalshi field or live-account result.

Missing or unauthenticated values remain blank. No fallback market records are bundled.

## Official endpoint decision

| Surface | Selected endpoint | Decision | Official source |
|---|---|---|---|
| Demo REST | `https://external-api.demo.kalshi.co/trade-api/v2` | Used; Kalshi identifies it as the recommended demo root. | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Demo REST shared host | `https://demo-api.kalshi.co/trade-api/v2` | Documented, not mixed into live data. | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | Not connected from the static client; signed headers are required. | [WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets) |
| Demo WebSocket shared host | `wss://demo-api.kalshi.co/trade-api/ws/v2` | Documented, not used. | [API environments](https://docs.kalshi.com/getting_started/api_environments) |

## Delivered capabilities

| Capability | Delivery | Important detail | Official source |
|---|---|---|---|
| Event discovery | Complete | Paginates open events with nested markets every 60 seconds. | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| Focused topic desks | Complete | Local keyword/category rules are visible; Kalshi's category remains separate. | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| Highest-amount ranking | Complete, calculated | Sums `volume_24h_fp × notional_value_dollars` per event. This is contract notional, not cash volume or liquidity. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Live movement monitor | Complete through polling | Tracked markets update every 10 seconds. | [Market-data quick start](https://docs.kalshi.com/getting_started/quick_start_market_data) |
| ≥$0.10 alerts | Complete | Threshold is inclusive in either direction over consecutive successful observations. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Dual scrolling feeds | Complete | All changed prices vs. selected swings scoring at least 65/100. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Price chart | Complete | 60 seconds, 15 minutes, and 1 hour; records only values observed while the browser runs. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Liquidity depth | Complete within API semantics | Shows YES and NO bid price/quantity levels; does not claim order counts. | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| Resolution tracking | Complete in-session | Preserves observed contracts and displays only explicit API `yes` or `no` results. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Automated paper trading | Complete | One displayed-ask paper contract, deterministic risk rules, local persistence. | [Create order lifecycle](https://docs.kalshi.com/getting_started/quick_start_create_order) |
| Demo account tracking and execution | Safely blocked | No credentials or secret-bearing server were supplied. Authenticated values stay blank. | [Authenticated requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) |
| Causal jump links | Not inferred | Settlement sources are not treated as catalysts; alert text says “cause unverified.” | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |

## Alert and model definition

A swing is generated when:

```text
abs(current official last YES price − prior observed official last YES price) >= $0.10
```

A swing reaches the selective feed at a score of at least 65:

| Check | Exact rule | Points | Official input source |
|---|---:|---:|---|
| Swing | absolute observed movement ≥ $0.10 | 30 | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Spread | displayed YES ask − YES bid ≤ $0.05 | 25 | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Activity | 24-hour volume ≥ 100 contracts | 20 | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Depth | max displayed YES bid/ask size ≥ 10 contracts | 15 | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Price location | official last YES price is $0.15–$0.85 | 10 | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |

This is a selectivity score, not a probability model, ROI estimate, recommendation, or guarantee.

## Paper strategy definition

- Direction: follow the selected observed swing (YES after an upward move; NO after a downward move).
- Entry: one paper contract at the corresponding displayed ask; no ask means no trade.
- Exit: +$0.10 take profit, −$0.08 stop, six-hour time limit, or official result.
- Mark: official last YES price; NO is calculated as `1 − YES`.
- Starting cash: configured simulation input of $10,000.
- Exclusions: fees, queue position, partial fills, latency, and added slippage.
- Storage: current browser only.

## Primary constraints

1. **Static-site authentication boundary.** Kalshi account and WebSocket access require signed headers. A private key must not be embedded in a GitHub Pages bundle. [Official authentication guide](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests)
2. **Polling boundary.** A move that occurs and fully reverses between polls may be missed. [Official WebSocket guide](https://docs.kalshi.com/getting_started/quick_start_websockets)
3. **Historical boundary.** In-browser observations are not a complete exchange archive; older records can cross Kalshi's historical cutoffs. [Official historical-data guide](https://docs.kalshi.com/getting_started/historical_data)
4. **Liquidity-field change.** Kalshi removed the deprecated `liquidity_dollars` market field; the site uses documented top-of-book sizes and order-book depth instead. [Official changelog](https://docs.kalshi.com/changelog)
5. **Causality boundary.** No official field proves a webpage caused a price move; the site refuses to infer causality from timestamps alone. [Official event schema](https://docs.kalshi.com/api-reference/events/get-events)

## Recommended next architecture

To add authenticated demo execution without weakening security:

1. Deploy a small server-side relay on a non-static runtime.
2. Keep the Kalshi private key in a managed secret store.
3. Sign only allowlisted demo requests; reject production hosts.
4. Enforce per-order quantity/price limits and idempotent client order IDs.
5. Normalize authenticated WebSocket messages and stream only sanitized market/account data to the browser.
6. Persist raw source URL, exchange timestamp, ingestion timestamp, and schema version with every record.
7. Keep paper and account results visually and structurally separate.

Relevant official guides: [authentication](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests), [WebSockets](https://docs.kalshi.com/getting_started/quick_start_websockets), and [order creation](https://docs.kalshi.com/getting_started/quick_start_create_order).
