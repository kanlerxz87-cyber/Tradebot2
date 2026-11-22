# Tradebot2 — Coordination Board (Unified Multi-Session Integration)

> **Repository:** `kanlerxz87-cyber/Tradebot2`  
> **GitHub Pages URL:** `https://kanlerxz87-cyber.github.io/Tradebot2/` (deployed from `main` `/`)  
> **Integrated Sessions:** `arena/a5878007-tradebot2`, `arena/7a21cbd2-tradebot2`, `arena/b1cd545f-tradebot2`, and `arena/4f9ce955-tradebot2`  
> **Last Updated:** 2026-11-22 (UTC)

Statuses: `unclaimed` | `in progress` | `done` | `needs review`

---

## Convention
- Keep scopes non-overlapping, make small frequent commits, and run `git pull --rebase` (or resolve conflicts without discarding other sessions' work) before pushing.
- Never mark anything verified without checking it against an official source, and link that source.
- Any unverified value is left blank and published on the Flagged for Review page (`pages/flagged-for-review.html` and `review.html` / `docs/flagged.html`) with status `needs review` (non-blocking).

---

## Official Sources Verified Line by Line
- **Demo REST Trade API:** `https://external-api.demo.kalshi.co/trade-api/v2` (Recommended) & `https://demo-api.kalshi.co/trade-api/v2` (Also supported) — [Kalshi Demo Env Docs](https://docs.kalshi.com/getting_started/demo_env)
- **Demo WebSocket API:** `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` (Recommended) & `wss://demo-api.kalshi.co/trade-api/ws/v2` (Also supported) — [Kalshi API Environments](https://docs.kalshi.com/getting_started/api_environments)
- **User Fill/Order WebSocket (Demo):** `wss://user-ws.demo.kalshi.co/trade-api/ws/v2` — [Kalshi API Environments](https://docs.kalshi.com/getting_started/api_environments)
- **Kalshi Auth, Rate Limits, Lifecycle, Settlement, Historical Cutoff & Changelog:**
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
- **CFTC DCM Listing & Topic Primary Sources:**
  - CFTC DCM Listing Notice: `https://www.cftc.gov/filings/contractlistings/kalshiexchange`
  - Gas Prices: AAA Fuel Prices (`https://gasprices.aaa.com/?internal=true`) & EIA Gasoline/Diesel (`https://www.eia.gov/petroleum/gasdiesel/`)
  - Elections: Kalshi Elections Markets (`https://kalshi.com/markets/kxpresparty/party-winning-presidency/kxpresparty-2028`) & FEC (`https://www.fec.gov/`)
  - Culture: Recording Academy / GRAMMY.com (`https://www.grammy.com/live-blog/2026-grammy-awards/`), AMPAS (`https://www.oscars.org/`), Kalshi Culture Markets
  - Crypto: Kalshi Crypto Markets (`https://kalshi.com/markets/kxbtcmax100/when-will-bitcoin-hit-100k/kxbtcmax100-26`) & CoinGecko (`https://www.coingecko.com/`)
  - Golf: PGA TOUR Official (`https://www.pgatour.com/article/news/latest/2026/11/17/the-rsm-classic-facts-and-figures-sea-island-golf-club-seaside-course-st-simons-island-georgia-2026`) & The Masters (`https://www.masters.com/`)

---

## Unified Task Board

| # | Task | Status | Owner Session(s) | File Scope | Verification | Irregularities |
|---|---|---|---|---|---|---|
| 1 | Executive summary & API verification | `done` | `arena/a5878007-tradebot2`; `arena/7a21cbd2-tradebot2`; `arena/b1cd545f-tradebot2`; `arena/4f9ce955-tradebot2` | `EXECUTIVE_SUMMARY.md`, `VERIFICATION_REPORT.md`, `README.md`, `data/verified_api_endpoints.json`, `docs/executive-summary.md` | Verified line-by-line against `docs.kalshi.com` & `help.kalshi.com` | Dual demo hosts (`external-api` recommended vs `demo-api` legacy), deprecated `liquidity_dollars`, V2 order endpoint 10x write token advantage (`IR-01`–`IR-12`) |
| 2 | Live dashboard & alerting system (`>= $0.10`, dual chats) | `done` | `arena/4f9ce955-tradebot2`; `arena/b1cd545f-tradebot2`; `arena/a5878007-tradebot2` | `index.html`, `assets/css/styles.css`, `assets/js/app-core.js`, `assets/js/dashboard.js`, `js/*`, `css/*`, `docs/*` | Dual scrolling chats (All Events + Selective High-ROI Model), Seconds/Minutes/Hours canvas chart + catalyst links, orderbook depth ladder | Browser WS custom header restriction (`IR-05`) & sandbox CORS probe (`IR-06`) |
| 3 | Category subpages (Gas Prices, Elections, Culture, Crypto, Golf only) | `done` | `arena/4f9ce955-tradebot2`; `arena/b1cd545f-tradebot2`; `arena/a5878007-tradebot2` | `pages/{gas-prices,elections,culture,crypto,golf}.html`, `data/verified_topics.json`, root & `docs/` category subpages | All 5 topics separated; 25 verified official `kalshi.com` events with source URLs; blank unverified volumes flagged | 7 market rows without visible dollar volume left blank (`IR-09`) |
| 4 | Portfolio, automated simulated strategies & Python Demo CLI | `done` | `arena/4f9ce955-tradebot2`; `arena/b1cd545f-tradebot2`; `arena/a5878007-tradebot2` | `pages/portfolio-strategies.html`, `assets/js/portfolio-page.js`, `scripts/kalshi_demo_client.py`, `scripts/strategy_engine.py`, `strategies.html`, `docs/portfolio.html` | Manual + automated strategies, trade categorization, YES/NO settlement resolution, custom strategy builder, RSA-PSS/Ed25519 Python client | Mock funds simulation; no credentials stored in Git (`IR-12`) |
| 5 | Flagged for Review & automated site verification | `done` | `arena/4f9ce955-tradebot2`; `arena/b1cd545f-tradebot2`; `arena/a5878007-tradebot2` | `pages/flagged-for-review.html`, `pages/api-reference.html`, `data/flagged_irregularities.json`, `scripts/verify_site.py`, `review.html`, `docs/flagged.html` | Automated JSON schema, 5-topic enforcement, official URL & relative link checker passes cleanly | `IR-01`–`IR-12` + prior `FLG-201`–`FLG-204` all published as `needs review` |
| 6 | Final integration, PR merge & GitHub Pages deployment | `in progress` | `arena/4f9ce955-tradebot2` (integrating PRs `#1`, `#2`, `#3` + PR `#8`) | `.nojekyll`, `.gitignore`, `.github/workflows/pages.yml`, `COORDINATION.md`, root & `pages/` | Merge conflicts resolved without discarding any prior session's files; PR `#8` ready to merge to `main` | Logged below |

---

## Merge Conflict Resolution Log
- **PR #1 (`ea48ded`)**: `arena/a5878007-tradebot2` merged initial dashboard, `docs/` portal, and `.github/workflows/pages.yml`.
- **PR #2 (`3fb2259`)**: `arena/7a21cbd2-tradebot2` integrated with `arena/a5878007-tradebot2`.
- **PR #3 (`27c53fe`)**: `arena/b1cd545f-tradebot2` integrated root + `docs/` category pages, canvas chart, and strategy lab.
- **PR #8 (`arena/4f9ce955-tradebot2`, 2026-11-22)**: Hit add/add & content merge conflicts on `COORDINATION.md`, `EXECUTIVE_SUMMARY.md`, `README.md`, and `index.html` after PRs `#1`–`#3` merged to `origin/main`. Resolved cleanly without discarding any prior session's work:
  - Preserved all prior session files intact (`docs/**`, `.github/workflows/pages.yml`, `gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html`, `strategies.html`, `review.html`, `css/style.css`, `js/*.js`).
  - Integrated all verified 2026 Kalshi Demo API datasets (`data/*.json`), Python Demo REST/WS client & strategy engine (`scripts/*.py`), `VERIFICATION_REPORT.md`, and the unified live dashboard (`index.html`, `pages/*.html`, `assets/**`) with direct links to prior integrated `docs/` pages.
  - Unified `COORDINATION.md`, `EXECUTIVE_SUMMARY.md`, and `README.md` across all four sessions.

---

## Flagged for Review / Unverified Items (`needs review`, Non-Blocking)
- **Session `arena/4f9ce955-tradebot2` (`IR-01`–`IR-12`)**: Published on [`pages/flagged-for-review.html`](pages/flagged-for-review.html) and [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md) (dual demo hostnames, deprecated `liquidity_dollars` returning `0`, no 1-sec REST candlesticks, browser WS header limit, unverified sandbox CORS & public rate limit left blank, 7 market volume cells left blank, V2 order token cost, historical cutoff, credential hygiene).
- **Prior Sessions (`FLG-201`–`FLG-204`)**: Preserved on [`review.html`](review.html) and [`docs/flagged.html`](docs/flagged.html) (unofficial ETF rumors, partisan internal polls, crowdsourced gas surveys, anonymous Oscar tallies).
