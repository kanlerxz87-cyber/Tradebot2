# Executive Summary — Tradebot2 Kalshi Demo Dashboard

**Project:** Tradebot2 — Kalshi demo event-contract dashboard
**Branch:** `arena/7a21cbd2-tradebot2` (from `main` commit `003447e`)
**Date:** 2026-11-22
**Sandbox note:** Direct outbound access to `kalshi.co` / `kalshi.com` hosts is blocked from this sandbox (TLS/SSL error on all kalshi endpoints). All API facts below are taken from official Kalshi documentation surfaced via web search (docs.kalshi.com) and are cited. Values that cannot be confirmed from an official source are left blank and flagged unverified. No values were inferred or filled in.

---

## 1. Purpose

Collect, organize, and analyze live event-contract data from the Kalshi demo Trade API, focused on five topics: **gas prices, elections, culture, crypto, and golf**.

The dashboard operates as a **live alerting system** for sudden contract price swings of **≥ $0.10 in either direction**, tracks each live event until it **resolves (Yes or No)**, automates **simulated trades** to test strategies, and tracks **portfolio performance** with trade categorization.

---

## 2. Kalshi demo environment (official endpoints)

| Item | Value | Source |
|---|---|---|
| Demo REST base URL | https://external-api.demo.kalshi.co/trade-api/v2 | Kalshi Trade API (user-specified; matches docs.kalshi.com demo URL) |
| Demo WebSocket | wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2 | Kalshi Trade API (user-specified; matches docs.kalshi.com demo URL) |
| Production REST base URL | https://external-api.kalshi.com/trade-api/v2 | docs.kalshi.com "Quick Start: Market Data" |
| Production WebSocket | wss://external-api-ws.kalshi.com/trade-api/ws/v2 | docs.kalshi.com developer guide |
| Public market-data endpoints (no auth) | GET /series, /events, /markets, /markets/{ticker}, /markets/{ticker}/orderbook, /markets/trades, /markets/{ticker}/candlesticks | docs.kalshi.com |
| Authenticated portfolio/trading endpoints | GET /portfolio/balance, /positions, /settlements, /orders, /fills; POST /portfolio/events/orders (V2) | docs.kalshi.com developer guide |
| Authentication | Public endpoints: none required. Portfolio/trading: signed headers `KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-TIMESTAMP`, `KALSHI-ACCESS-SIGNATURE` (RSA-PSS or Ed25519) | docs.kalshi.com developer guide |
| Data freshness | Market data (GET /markets, /markets/{ticker}) cached briefly; prices/sizes/status can lag the exchange by several seconds | docs.kalshi.com |

> **Connectivity limitation:** I could not reach any kalshi.co/kalshi.com host from this sandbox (all returned `SSL_ERROR_SYSCALL`). The live dashboard therefore attempts to call the demo API from the visitor's browser and reports connection status; where the API is unreachable, data is left blank and flagged unverified. See docs/api-verification.md and the Flagged for Review page.

---

## 3. Contract fundamentals

| Attribute | Value | Source |
|---|---|---|
| Contract type | Binary Yes/No event contract | docs.kalshi.com + multiple Kalshi guides |
| Price range | $0.01 to $0.99 (implied probability of "Yes") | docs.kalshi.com + Kalshi guides |
| Payout if correct | $1.00 per contract | docs.kalshi.com + Kalshi guides |
| Payout if wrong | $0.00 per contract | docs.kalshi.com + Kalshi guides |
| Resolution | Resolves Yes or No per the contract rulebook's official resolution source | docs.kalshi.com ("close_time is the trading close, not a promise of immediate settlement") |
| Regulator | CFTC-regulated exchange (KalshiEX LLC) | Kalshi guides |

---

## 4. Focus topics → Kalshi category mapping

| Tracked topic | Kalshi API category | Verification status |
|---|---|---|
| Elections | `Elections` | Verified top-level category |
| Crypto | `Crypto` | Verified top-level category |
| Culture | `Culture` | Verified top-level category |
| Gas prices | `Economics` (sub-topic; "state gas prices" listed under Economics) | **Not a standalone Kalshi category — flagged unverified** |
| Golf | `Sports` (sub-topic) | **Not a standalone Kalshi category — flagged unverified** |

Gas prices and golf are tracked within their parent categories (`Economics` and `Sports`) because they are not separate top-level Kalshi categories.

---

## 5. Dashboard capabilities

| Capability | Description |
|---|---|
| Live event tables by category | One subpage per topic, events organized together within the topic, table format with source links |
| Price-swing alerts (≥ $0.10 either direction) | Two scrolling chats: (a) all events, (b) model-preferred high-ROI events only |
| Resolution tracking | Each event tracked until resolved; outcome recorded as Yes or No |
| Price movement graph | Time on X axis, contract price on Y axis; selectable graph length (seconds / minutes / hours) |
| Liquidity | Current contract price plus how many contracts are available at a given price (orderbook bid sizes) |
| Simulated trades | Automated simulated trades to test different strategies, no real money |
| Portfolio performance | Track simulated/demo portfolio, categorize trades by type, build strategies per trade type |
| Live/interactive | Simplified graphs and charts; sharp-jump (≥ $0.10) events annotated with possible causing event/website links |

---

## 6. Verification approach

- Every table row carries a source link to an official site where a value can be confirmed.
- If a value cannot be confirmed from an official source, it is left **blank** and flagged **unverified**.
- No values are inferred or filled in.
- Flagged irregularities and unverified items are published on a clearly labeled **"Flagged for Review"** page on the site and do not block the release.
