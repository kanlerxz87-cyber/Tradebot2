# Tradebot2 — Kalshi Demo Dashboard

**Goal:** collect, organize and analyze the highest-dollar live events on Kalshi (demo environment) — focused on five topics: **Gas Prices, Elections, Culture, Crypto and Golf**.

## Live site

The site is a static GitHub Pages deployment under `docs/`. See the repository's GitHub Pages settings for the URL.

## What it does

- Tracks the highest-dollar events by volume across the five topics
- Alerts on sudden contract-price swings ≥ $0.10 (either direction)
- Two scrolling chats: all alerts + a high-ROI filter (heuristic, not financial advice)
- Tracks events until they resolve YES / NO
- Simulates trades with three strategies (Momentum, Mean reversion, Swing breaker)
- Portfolio performance: P&L, win rate, per-strategy and per-topic breakdowns
- Interactive charts (time-windowed: 30s / 1m / 5m / 1h / 24h) and orderbook liquidity depth

## Architecture

```
docs/
  index.html          Landing
  dashboard.html      Live interactive dashboard (main surface)
  methodology.html    Sources, verification, what is unverified
  flagged-for-review.html
  topics/*.html       One page per topic (Gas, Elections, Culture, Crypto, Golf)
  assets/css, assets/js   Vanilla CSS + JS — no build step, no dependencies
```

## Modes

- **Live (demo):** polls the official Kalshi demo REST API (`external-api.demo.kalshi.co/trade-api/v2`); public market data needs no credentials.
- **Simulated:** built-in simulator, always works, clearly labeled SIMULATED. The dashboard auto-falls back to simulation when the demo API is unreachable.

All trades are simulated bookkeeping. Nothing executes real orders.

## Sources

- [Kalshi demo environment](https://docs.kalshi.com/getting_started/demo_env.md)
- [API environments & endpoints](https://docs.kalshi.com/getting_started/api_environments.md)
- [Quick Start: Market Data](https://docs.kalshi.com/getting_started/quick_start_market_data.md)
- [Get Markets (status values)](https://docs.kalshi.com/api-reference/market/get-markets.md)
- [Market Settlement](https://docs.kalshi.com/getting_started/market_settlement.md)
- [Fixed-Point Representation](https://docs.kalshi.com/getting_started/fixed_point_migration.md)

See `EXECUTIVE_SUMMARY.md` for the full overview and `docs/methodology.html` for verification details.
