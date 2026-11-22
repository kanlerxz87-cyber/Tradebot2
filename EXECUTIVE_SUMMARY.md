# Executive Summary — Kalshi Demo Dashboard

**Project:** Kalshi Demo Dashboard — collect, organize and analyze highest-dollar live events on Kalshi, focused on five topics: gas prices, elections, culture, crypto and golf.
**Environment:** Kalshi demo (demo.kalshi.co) — **demo only, no real money, no real orders**.
**Status:** Built and verified statically. The live demo API is unreachable from this build sandbox; the dashboard falls back to a clearly-labeled simulator so every feature remains explorable. See `docs/flagged-for-review.html` for the full unverified-item list.

## What was built

- **Clean, live dashboard** (`docs/dashboard.html`): highest-dollar events ranked by dollar volume, five topic filters, live price chart (X = time: 30s / 1m / 5m / 1h / 24h; Y = contract price), orderbook liquidity depth (YES bids, NO bids, totals, spread), and resolution tracking (YES/NO until settled).
- **Alerting system**: fires on sudden swings of ≥ $0.10 in either direction, measured against the price 10 seconds prior, re-anchored every 15s or +$0.02 higher magnitude. Each alert carries time, direction, magnitude, topic, the news headline behind it and the ROI model score.
- **Two scrolling chats**: (1) **All alerts** — every alert and resolution; (2) **High-ROI signals** — only alerts the internal ROI model ranks ≥ 60/100 (heuristic, not a financial recommendation).
- **Simulated auto-trades** (3 strategies): Momentum chaser (YES on upward swing), Mean reversion (YES on downward swing), Swing breaker (≥ $0.15 swings). All trades are bookkeeping-only and labeled SIMULATED.
- **Portfolio performance**: starting cash $10,000; realized P&L, win rate, open exposure, net equity, per-strategy and per-topic breakdowns.
- **Topic subpages** (`docs/topics/*.html`): one per topic, with a live simulated events snapshot, verified findings table (every row links to an official source), analysis and topic keywords.
- **Methodology + Flagged for Review**: full source list and every unverified item.

## Key details

| Topic | Focus | Volume-driving signals |
| --- | --- | --- |
| Gas Prices | Crude/gasoline contracts | Supply shocks, demand surprises |
| Elections | Political markets | Polls, late-night developments |
| Culture | Celebrity/music/film | Single-headline moves, fast decay |
| Crypto | BTC/ETH and majors | ETF flows, breakout headlines |
| Golf | Tournament markets | Per-round outcomes, field shifts |

## Important details & caveats

- **No real money, no real orders.** Simulated trades are bookkeeping only.
- **Demo prices may not reflect real markets** (official Kalshi warning).
- **ROI model is heuristic** — not a financial recommendation.
- **Live vs simulated**: dashboard auto-tries the official demo API (`external-api.demo.kalshi.co/trade-api/v2`, recommended; `demo-api.kalshi.co/trade-api/v2` fallback) and degrades to simulation if unreachable. The sim mode is clearly labeled SIMULATED; live mode is labeled LIVE (demo).
- **Demo account**: the demo environment is a sandbox account created at [demo.kalshi.co](https://demo.kalshi.co/). Signed portfolio/orders API calls require the user's own demo credentials — never stored in the repo — and are flagged on the review page.

## Verification

Every fact in topic pages links to an official source (Kalshi docs) or is flagged. The verified claims (status values, endpoint names, public-data access, demo warning, YES/NO settlement, fixed-point representation) are listed in `docs/methodology.html` and `docs/flagged-for-review.html`.

## What is NOT claimed

- No real trades, no credentialed API access, no production data.
- No guarantee of live-API reachability from every browser/network (CORS may block).
- No accuracy guarantee on live payload field names — flagged for review.

## Links

- Dashboard: `docs/dashboard.html` · Methodology: `docs/methodology.html` · Flagged: `docs/flagged-for-review.html`
- Official: [Demo env](https://docs.kalshi.com/getting_started/demo_env.md) · [API environments](https://docs.kalshi.com/getting_started/api_environments.md) · [Market data quick start](https://docs.kalshi.com/getting_started/quick_start_market_data.md)
