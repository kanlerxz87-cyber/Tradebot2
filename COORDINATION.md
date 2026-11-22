# COORDINATION.md — Tradebot2 Shared Task Board

> **Repository:** `kanlerxz87-cyber/Tradebot2`  
> **GitHub Pages URL:** `https://kanlerxz87-cyber.github.io/Tradebot2/` (deployed from `main` `/`)  
> **Active Integration Branch:** `arena/4f9ce955-tradebot2` (base commit `003447ea92f5fdd7c2ee66558876c99237818f38`)  
> **Last Updated:** 2026-11-22 (UTC)

---

## Task Board

| Task ID | Task Name | Status | Owning Session | Branch | File Scope |
| --- | --- | --- | --- | --- | --- |
| `T1-repo-audit` | Repo Review & Kalshi Demo API Verification | `done` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `VERIFICATION_REPORT.md`, `data/verified_api_endpoints.json`, `data/flagged_irregularities.json` |
| `T2-executive-summary` | Executive Summary & Interactive Roadmap | `done` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `EXECUTIVE_SUMMARY.md`, `README.md` |
| `T3-topic-datasets` | Verified 5-Topic Catalog (Gas Prices, Elections, Culture, Crypto, Golf) | `done` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `data/verified_topics.json` |
| `T4-kalshi-demo-tooling` | Kalshi Demo REST/WebSocket Client, Strategy Engine & Site Verifier | `done` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `scripts/kalshi_demo_client.py`, `scripts/strategy_engine.py`, `scripts/verify_site.py`, `requirements.txt` |
| `T5-live-dashboard-site` | Live Interactive GitHub Pages Dashboard & Category Subpages | `done` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | `.nojekyll`, `index.html`, `pages/*.html`, `assets/css/styles.css`, `assets/js/*.js` |
| `T6-final-integration` | Final Line-by-Line Verification, Build Check, PR Merge & Pages Deploy | `in progress` | `arena-4f9ce955` | `arena/4f9ce955-tradebot2` | Shared index/nav verification, PR & GitHub Pages deployment |

---

## Flagged Items (`needs review`, Non-Blocking)
- 12 items (`IR-01` through `IR-12`) are published on [`pages/flagged-for-review.html`](pages/flagged-for-review.html) and documented in [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md) and [`data/flagged_irregularities.json`](data/flagged_irregularities.json).
- Key highlights: dual Demo hostnames (`external-api.demo.kalshi.co` recommended vs `demo-api.kalshi.co` legacy), deprecated `liquidity`/`liquidity_dollars` returning `0` (must use `/orderbook`), no native 1-second REST candlesticks, browser WebSocket custom-header constraint, unverified sandbox CORS header & public rate limit left blank, and 7 market rows with unconfirmed dollar volumes left blank.

---

## Verified Official Sources Used
- `https://docs.kalshi.com/getting_started/demo_env`
- `https://docs.kalshi.com/getting_started/api_environments`
- `https://docs.kalshi.com/getting_started/quick_start_websockets`
- `https://docs.kalshi.com/getting_started/quick_start_market_data`
- `https://docs.kalshi.com/getting_started/api_keys`
- `https://docs.kalshi.com/getting_started/rate_limits`
- `https://docs.kalshi.com/getting_started/market_lifecycle`
- `https://docs.kalshi.com/getting_started/market_settlement`
- `https://docs.kalshi.com/getting_started/historical_data`
- `https://docs.kalshi.com/changelog`
- `https://docs.kalshi.com/api-reference/market/get-market-orderbook`
- `https://docs.kalshi.com/api-reference/orders/create-order-v2`
- `https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account`
- Official `kalshi.com/markets/*` and `pro.kalshi.com/markets` pages for all 25 cataloged events across Gas Prices, Elections, Culture, Crypto, and Golf
- `https://gasprices.aaa.com/?internal=true`
- `https://www.pgatour.com/article/news/latest/2026/11/17/the-rsm-classic-facts-and-figures-sea-island-golf-club-seaside-course-st-simons-island-georgia-2026`
- `https://www.grammy.com/live-blog/2026-grammy-awards/`

---

## Activity & Verification Log

| Timestamp (UTC) | Session | Action | Notes |
| --- | --- | --- | --- |
| 2026-11-22 07:05 | `arena-4f9ce955` | Created `COORDINATION.md` and claimed `T1`–`T5` | Initial audit: commit `003447e` contained only `# Tradebot2` (`README.md`). GitHub Pages active on `main` root (`/`). |
| 2026-11-22 07:12 | `arena-4f9ce955` | Completed `T1`–`T3` | Committed verified API specs, 5-topic catalog, `VERIFICATION_REPORT.md`, `EXECUTIVE_SUMMARY.md`, and `README.md`. |
| 2026-11-22 07:16 | `arena-4f9ce955` | Completed `T4` | Committed & tested `kalshi_demo_client.py`, `strategy_engine.py`, and `verify_site.py`. |
| 2026-11-22 07:22 | `arena-4f9ce955` | Completed `T5` & claimed `T6` | Built live interactive dashboard (`index.html`), 5 separated topic subpages, Portfolio & Strategies lab, Executive Summary, API Reference, and Flagged for Review page. Verified `verify_site.py` (31 relative HTML links, all JSON schemas & official URLs), JS syntax (`node --check`), Python compilation (`py_compile`), and HTTP 200 across all 18 site routes. |
| 2026-11-22 07:25 | `arena-4f9ce955` | Opened PR #8 | Created PR [`#8`](https://github.com/kanlerxz87-cyber/Tradebot2/pull/8) from `arena/4f9ce955-tradebot2` into `main` and added `.gitignore` for Python bytecode and private key safety. |
