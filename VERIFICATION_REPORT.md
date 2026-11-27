# Repository Audit & Line-by-Line Verification Report

> **Repository:** `kanlerxz87-cyber/Tradebot2`  
> **Original audit date:** 2026-11-22 (UTC)
> **Original audit branch:** `arena/4f9ce955-tradebot2` (from base commit `003447ea92f5fdd7c2ee66558876c99237818f38`)
> **Latest supplemental audit:** 2026-11-27 (UTC), branch `arena/a32cdd24-tradebot2` (base `aca6cc898a8abb16bb36928648e1dcda90be7e78`)

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

---

## 7. Supplemental audit (2026-11-27 UTC)

**Scope and limits.** This was a static repository and test audit of the current branch, not a fresh live Kalshi API probe. I did not treat stored snapshots or prior session notes as a substitute for current API verification. The official API documentation used by the site is linked below and in `live/verification.html`; an official-source reference does not, by itself, prove a current market value.

### Findings corrected

- The canonical `live/flagged.html` said prior dashboard files had been moved to `/legacy/`, while no such directory exists and the files remain in their original repository paths. It also linked to a nonexistent deployed archive URL. This is corrected: the review page now states the actual file layout, links to existing archive files, and clearly says the earlier ticker checks were not repeated in this audit.
- The root `index.html` said all older pages were labelled as archives. Inspection found archived dashboard files without an archive banner, including `docs/index.html`. The landing warning now says not all archived pages carry warnings and marks `/live/` as the only authoritative dashboard.
- Root `flagged.html` item F-18 said the illustrative-performance issue was closed by adding visible warnings to archive pages. That was not true for every archived page. F-18 now remains marked for review and records the warning gap rather than claiming it is closed.

### Automated verification run

All commands below completed on this branch after installing test-only dependencies in an ignored local environment; no dependency manifest was changed.

| Check | Result |
|---|---|
| `python3 tools/verify_data.py --data-dir data` | Pass; integrity rules passed. The report showed **0** rows in its checked `all_feed`, `high_roi_feed`, `markets`, `orderbooks`, `resolutions`, and `trades` collections, so it validates source-link rules but does not establish those collections have current data. |
| `python3 tools/check_site.py --root . --strict` | Pass; 14 canonical pages and 406 internal links. |
| `python3 scripts/verify_site.py` | Pass; JSON schemas, five topics, official source URL patterns, 54 relative HTML links. |
| `python3 scripts/check_site.py` | Pass; 18 pages, no broken internal links; informational notes for empty archived tables and absent `site/data`. |
| `.venv/bin/python -m pytest -q` | Pass; 69 tests. |
| Archived fixture/regression tests (`tests/test_fees.py`, `test_engine.py`, `test_pipeline.py`, `run_fixture_pipeline.py`) | Pass; fee table values, alert boundaries, topic filtering and fixture pipeline. |
| JavaScript syntax (`node --check` over `assets/js`, `js`, `dash/assets`) | Pass. |
| `node live/tests/smoke.mjs` | Pass; 87/87 browser checks including $0.10 boundaries, topics, event links, two feeds, charts, ladder, simulated portfolio and offline snapshot labelling. |
| `python3 live/tests/check_live.py` | Pass; 16 pages, 0 failures. |

### Data freshness and remaining review items

- `data/snapshot.json` says `generated_at: 2026-11-27T19:03:10.263062Z` and includes 128 markets and 44,192 resolutions. This audit did not independently fetch those records from Kalshi; the file is stored evidence, not a claim that each value remains current.
- `live/data/fallback-snapshot.json` identifies itself as a read-only capture from 2026-11-22 and contains 40 markets. The automated browser checks confirm the UI labels this as a snapshot and pauses alerts/paper trading in fallback mode; do not describe it as live data.
- `data/meta.json` records a collector run at `2026-11-22T07:17:34Z` and `api_requests: 0`; it is not evidence of a current successful collector run.
- No demo-account key is present and no authenticated balance, position or real order execution was verified. No real or demo order was sent during this audit.
- News causes for price moves remain unverified and are intentionally not attributed. The current browser-only dashboard cannot ensure every transient move is captured between polling intervals.
- Official references for manual review: [Kalshi demo environment](https://docs.kalshi.com/getting_started/demo_env), [API environments](https://docs.kalshi.com/getting_started/api_environments), [Events endpoint](https://docs.kalshi.com/api-reference/events/get-events), [Markets endpoint](https://docs.kalshi.com/api-reference/market/get-markets), [Order book endpoint](https://docs.kalshi.com/api-reference/market/get-market-orderbook), [Candlesticks endpoint](https://docs.kalshi.com/api-reference/market/get-market-candlesticks), [Trades endpoint](https://docs.kalshi.com/api-reference/market/get-trades), and [settlement](https://docs.kalshi.com/getting_started/market_settlement). These links are official documentation references; current live API behavior and values were not re-probed in this supplemental audit.

**Residual site irregularity:** old page generations remain published at their historical paths. The root landing page and both review pages now describe this honestly, but this audit did not add warning banners to every archive page. Open this as a review item, not as verified archived content; start at `/live/` for the maintained dashboard.
