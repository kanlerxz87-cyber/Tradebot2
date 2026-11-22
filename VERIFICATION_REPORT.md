# Repository Audit & Line-by-Line Verification Report

> **Repository:** `kanlerxz87-cyber/Tradebot2`  
> **Audit Date:** 2026-11-22 (UTC)  
> **Branch:** `arena/4f9ce955-tradebot2` (from base commit `003447ea92f5fdd7c2ee66558876c99237818f38`)

---

## 1. Initial Repository Review

At base commit `003447ea92f5fdd7c2ee66558876c99237818f38`, the repository contained only a single file:

| File | Initial Content | Audit Finding |
| --- | --- | --- |
| `README.md` | `# Tradebot2` (11 bytes, 1 line) | No existing code, API clients, market datasets, tests, or GitHub Pages files existed prior to this session. |

GitHub Pages was verified via GitHub API (`repos/kanlerxz87-cyber/Tradebot2/pages`) as enabled in `legacy` mode serving `main` at `/` (`https://kanlerxz87-cyber.github.io/Tradebot2/`).

---

## 2. Official Verification Sources Consulted

Every verified fact in this repository links directly to one of the following official sources:

1. Kalshi Demo Environment Documentation — `https://docs.kalshi.com/getting_started/demo_env`
2. Kalshi API Environments & Endpoints — `https://docs.kalshi.com/getting_started/api_environments`
3. Kalshi WebSockets Quick Start — `https://docs.kalshi.com/getting_started/quick_start_websockets`
4. Kalshi Market Data Quick Start — `https://docs.kalshi.com/getting_started/quick_start_market_data`
5. Kalshi API Keys & Signing — `https://docs.kalshi.com/getting_started/api_keys`
6. Kalshi Rate Limits & Tiers — `https://docs.kalshi.com/getting_started/rate_limits`
7. Kalshi Market Lifecycle — `https://docs.kalshi.com/getting_started/market_lifecycle`
8. Kalshi Market Settlement — `https://docs.kalshi.com/getting_started/market_settlement`
9. Kalshi Historical Data Partitioning — `https://docs.kalshi.com/getting_started/historical_data`
10. Kalshi API Changelog — `https://docs.kalshi.com/changelog`
11. Kalshi Orderbook API Reference — `https://docs.kalshi.com/api-reference/market/get-market-orderbook`
12. Kalshi Create Order V2 Reference — `https://docs.kalshi.com/api-reference/orders/create-order-v2`
13. Kalshi Help Center (Demo Account Setup) — `https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account`
14. Official Kalshi Market Pages (`kalshi.com/markets/...` and `pro.kalshi.com/markets`)
15. AAA Fuel Prices — `https://gasprices.aaa.com/?internal=true`
16. PGA TOUR Official — `https://www.pgatour.com/article/news/latest/2026/11/17/the-rsm-classic-facts-and-figures-sea-island-golf-club-seaside-course-st-simons-island-georgia-2026`
17. Recording Academy / GRAMMY.com — `https://www.grammy.com/live-blog/2026-grammy-awards/`

---

## 3. Flagged Irregularities & Unverified Fields (`needs review`)

All items below are published on `pages/flagged-for-review.html` and stored in `data/flagged_irregularities.json`. Unverified values are left blank rather than inferred.

| ID | Severity | Category | Summary | Blank / Unverified Field | Official Source |
| --- | --- | --- | --- | --- | --- |
| `IR-01` | Info | Repository Audit | Initial repo contained only `# Tradebot2` (`README.md`) | Prior baseline code (none existed) | [GitHub Repo](https://github.com/kanlerxz87-cyber/Tradebot2) |
| `IR-02` | Medium | API Endpoints | Prompt lists both `external-api.demo.kalshi.co` (recommended) and `demo-api.kalshi.co` (also supported legacy) | — | [Kalshi Demo Env Docs](https://docs.kalshi.com/getting_started/demo_env) |
| `IR-03` | High | Liquidity Data | `liquidity` & `liquidity_dollars` on `/markets` & `/events` are deprecated and return `0`; must use `/orderbook` | Static live Demo orderbook depth (runtime-only) | [Kalshi API Changelog](https://docs.kalshi.com/changelog) |
| `IR-04` | Medium | Chart Timeframes | Official candlesticks support `1` min, `60` min, `1440` min only; no native 1-second REST candlesticks | Native 1-sec historical REST endpoint | [Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) |
| `IR-05` | High | Browser WebSocket Auth | Browser `WebSocket()` cannot attach custom `KALSHI-ACCESS-*` handshake headers; requires Python relay for authenticated WS | — | [WebSockets Quick Start](https://docs.kalshi.com/getting_started/quick_start_websockets) |
| `IR-06` | High | Browser CORS | Live `Access-Control-Allow-Origin` header on `external-api.demo.kalshi.co` could not be probed from restricted build sandbox | `Access-Control-Allow-Origin` header value | [Market Data Quick Start](https://docs.kalshi.com/getting_started/quick_start_market_data) |
| `IR-07` | Medium | Demo vs Production | Kalshi warns Demo prices & behavior may not match real markets; Demo requires separate credentials | Live Demo exchange dollar volume per ticker | [Kalshi Demo Env Docs](https://docs.kalshi.com/getting_started/demo_env) |
| `IR-08` | Low | Rate Limits | Unauthenticated public REST numeric req/sec limit is not published in official docs | Public REST req/sec limit | [Rate Limits & Tiers](https://docs.kalshi.com/getting_started/rate_limits) |
| `IR-09` | Low | Topic Catalog Volumes | 7 verified Kalshi market entries had no visible dollar volume in official page snippets; cells intentionally left blank | Observed USD volume on 7 rows | [Kalshi Markets](https://kalshi.com/markets) |
| `IR-10` | Medium | Order Execution V2 | Legacy `/portfolio/orders` mutations cost 10x write tokens vs V2 `/portfolio/events/orders` | — | [Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2) |
| `IR-11` | Low | Historical Partitioning | Settled markets older than `market_settled_ts` move to `/historical/*` endpoints | Current live `market_settled_ts` cutoff | [Historical Data](https://docs.kalshi.com/getting_started/historical_data) |
| `IR-12` | Info | Security & Credentials | No Demo API keys or private keys are stored in Git | User Demo API Key ID & PEM | [Demo Account Setup](https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account) |
