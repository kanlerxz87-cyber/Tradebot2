# Tradebot2 — executive summary

**Prepared 2026-11-22 UTC. Environment: Kalshi demo only.**

## Decision brief

The repository began with only a one-line README. It now contains a source-linked static market observatory, five dedicated topic views, an observed-price chart, two scrolling swing feeds, a bounded paper-trading engine, an official-source register, and a clearly labeled Flagged for Review page. GitHub Pages is the presentation layer; GitHub Actions collects public demo observations. Neither is represented as an authenticated account or continuous exchange feed.

The application never fills missing prices, quantities, outcomes, account balances, expected returns, fees, or news causes with guesses. Financial table cells stay blank when unavailable. Empty states explain the absence of verified observations.

## Verified foundations

| Detail | Finding | Official reference |
| --- | --- | --- |
| Recommended demo REST root | `https://external-api.demo.kalshi.co/trade-api/v2` | [Kalshi demo documentation](https://docs.kalshi.com/getting_started/demo_env) |
| Alternate demo REST root | `https://demo-api.kalshi.co/trade-api/v2` | [Kalshi demo documentation](https://docs.kalshi.com/getting_started/demo_env) |
| Recommended demo WebSocket root | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | [Kalshi demo documentation](https://docs.kalshi.com/getting_started/demo_env) |
| Alternate demo WebSocket root | `wss://demo-api.kalshi.co/trade-api/ws/v2` | [Kalshi demo documentation](https://docs.kalshi.com/getting_started/demo_env) |
| Market-price fields | Fixed-point dollar strings; last price, YES bid/ask, ask size, volume, open interest and notional are documented | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Topic taxonomy | Series categories and tags, not guessed market-title keywords; exact gasoline scope observed in official demo API | [Series schema](https://docs.kalshi.com/api-reference/market/get-series-list), [Gasoline series evidence](https://external-api.demo.kalshi.co/trade-api/v2/series/KXAAAGASM) |
| Order-book liquidity | YES / NO bid levels with fixed-point prices and quantities, not ask levels | [Order book](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| WebSocket connection | Requires authenticated handshake even for public-data channels | [WebSocket connection](https://docs.kalshi.com/websockets/websocket-connection) |
| Current order endpoint | V2 `/portfolio/events/orders`; legacy order write endpoints return 410 | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) |
| Account verification | Authentication required; balance and portfolio value do not by themselves establish net trading P&L | [Balance](https://docs.kalshi.com/api-reference/portfolio/get-balance), [Fills](https://docs.kalshi.com/api-reference/portfolio/get-fills) |
| Binary resolution | Official settlement result and reported settlement value are required; closed is not treated as settled | [Settlement](https://docs.kalshi.com/getting_started/market_settlement) |
| Hosting architecture | Pages is a static hosting service, not a secure continuously running trading backend | [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) |

## What the dashboard does

- **Focus:** gas prices, elections, culture, crypto and golf. Exact series metadata controls topic inclusion. Culture explicitly includes Entertainment. Gas prices uses exact `product_metadata.scope = Gasoline` (and exact Gas prices tags if present), not all energy contracts. Broad Politics does not automatically count as Elections. Unmatched series are excluded rather than guessed.
- **Organization:** event groups with their contracts kept together, topic navigation, table search, pagination, and JSON exports.
- **Ranking:** descending derived open-interest face value: `open_interest_fp × notional_value_dollars`, summed over tracked contracts per event. This is **not actual dollar turnover**. Exact executed dollar turnover is unconfirmed and omitted. A missing component makes an aggregate unavailable.
- **Live behavior:** a visible browser attempts 10-second REST polling for the top 100 active tracked contracts plus selected and open-paper contracts; the published universe refreshes each minute. Retries back off after errors. Browser CORS or network access can prevent polling, in which case snapshot mode is explicit.
- **Alerting:** last-price changes ≥ $0.10 in either direction between consecutive observations at most 120 seconds apart. Large data gaps do not masquerade as sudden swings. All-swings and screened-candidate feeds are separate scrollable logs on Live alerts.
- **Candidate screen:** spread ≤ $0.03, reported YES ask quantity ≥ 10, and 24-hour contract volume ≥ 100. This is a liquidity heuristic, **not a high-ROI prediction**. Expected ROI stays blank.
- **Chart:** X axis UTC time, Y axis YES contract price in dollars, selectable 60-second / 60-minute / 24-hour windows. Actual observation timestamps only. Gaps over 120 seconds are not connected; no fictional second-level history is synthesized. Swing markers include timestamp and movement. Causal news links stay blank unless evidence is available.
- **Liquidity:** on-demand official YES / NO bid depth with quantities, source links and observation timestamp. No inferred ask liquidity is presented as API-reported depth.
- **Lifecycle:** previously observed contracts are retained and rechecked through closed status until an official settled YES / NO result. Settlement values, not just outcome labels, control paper payout.

## Automated paper experiments

Two YES-only strategies run on fresh qualifying observations: Momentum buys after an upward swing; Reversion buys after a downward swing. Both use the reported YES ask and ask size, assume rather than verify execution, cap entry at 10 contracts and $10, cap open positions at 20 per strategy, and start with $1,000 simulated allocation per strategy. One position per contract per strategy is allowed while open. Unknown fees remain blank and all reported simulated P&L is **gross**.

The browser ledger lives in browser storage and is separate from the scheduled collector ledger. Neither is a Kalshi account. The portfolio page reports paper trades and settled gross P&L by strategy and topic; zero trades is a valid result, not a reason to invent history. A strategy has no win rate until at least one position settles.

## Unresolved / flagged

1. **No authenticated demo account is connected.** No account trades were submitted. Private demo-only signing and order safeguards are included but end-to-end account behavior is unverified. No production execution host is configurable.
2. **No trained or calibrated high-ROI model exists.** A liquidity screen cannot establish positive expected return.
3. **No verified event-specific news causation is available.** A timestamp correlation or settlement-source link is not a confirmed reason for a jump.
4. **Pages is not a continuous backend.** Scheduled collection requests five-minute intervals; runner timing, network success, caching, and data retention are not guaranteed. Browser polling sees only its declared subset and can miss swings between observations.
5. **Exact dollar turnover and net returns are not confirmed.** Ranking uses labeled face value; paper fees and execution quality are unknown.
6. **Coverage is scoped, not universal.** Exact metadata matches and non-multivariate events only. Failed or time-budget-limited discovery is marked partial. A series missing metadata is not guessed into a topic.
7. **Long-term audit durability is not provided by an Actions cache.** Bounded cached observations can expire. A database and replayable archive are needed for an audited financial record.
8. **Settlement corrections/scalar-only results require fuller reconciliation.** The simplified binary ledger does not certify all settlement edge cases.

These findings are published on the site's **Flagged for Review** page. They do not prevent publishing the static observatory but prevent claiming the full authenticated continuous-trading goal has been completed.

## Recommended next steps

Deploy an authenticated private relay with durable storage; handle WebSocket sequence gaps and reconnect/replay. Reconcile accepted orders against fills, fees, positions, transfers and settlements. Only then add opt-in demo execution to strategies and compute net account returns. Add timestamped first-party event releases to chart markers with explicit correlation/causality labels. Validate models using walk-forward holdouts, calibration, slippage and topic-specific drawdowns before any expected-ROI claim.

## Verification scope

Official documentation and selected direct demo API responses were read using the page-fetch tool. Direct shell access to Kalshi hosts is blocked by the development sandbox's network allowlist; live collection is tested separately on GitHub-hosted CI. Local tests use synthetic, explicitly labeled fixtures that are never shipped as market data. Tests cover normalization, missing values, exact topic mapping, ≥10¢ thresholds, stale data, duplicate signals, paper budgets, official settlement gating, order-book units, private-key signatures and execution safeguards. Build checks verify relative file references, module imports, register sources and snapshot schemas; browser tests exercise navigation and critical UI states. Tests and documentation checks do not constitute verification of an unavailable account or all exchange edge cases.
