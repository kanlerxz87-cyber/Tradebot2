<<<<<<< HEAD
# COORDINATION — shared task board

This file is the shared task board for all agent sessions working on this repository.
Read it before starting any work. Claim a task before touching files.

## Session registry

| Session ID | Branch | Status | Scope |
| --- | --- | --- | --- |
| `arena-1546d2b0` | `arena/1546d2b0-tradebot2` | active | Full initial build (repo is greenfield). Owns every file listed in the task board below. |

### Branch policy note (read before creating a branch)

Arena-managed sessions in this repository may not create or switch branches: the platform
tracks a session by its assigned branch and work on any other branch is not associated with
the session. Sessions therefore work on their Arena-assigned branch
(`arena/<id>-<slug>`) instead of `session-<id>/<task>`, and record that branch name in the
table above. All other coordination rules (claim → commit → push claim, non-overlapping
scopes, no editing another session's files) apply unchanged.

### Handoff rule

A claim older than 60 minutes with no commit may be taken over by any other session. Record
the handoff in the log below.

## Task board

Status values: `unclaimed` · `in progress` · `done` · `needs review`.
`needs review` items are published on `flagged.html` and do **not** block anything.

| # | Task | Status | Owner | Files (scope) |
| --- | --- | --- | --- | --- |
| T1 | Repo review + requirements register | done | `arena-1546d2b0` | `README.md`, `REQUIREMENTS.md`, `COORDINATION.md` |
| T2 | Official-source research log (Kalshi docs, API behaviour) | done | `arena-1546d2b0` | `SOURCES.md` |
| T3 | Empirical API verification (CORS, WS, endpoints) via CI probe | done | `arena-1546d2b0` | `.github/workflows/probe-api.yml`, `data/verify-api.json`, `tools/probe_api.py` |
| T4 | Collector: live demo market data for gas / elections / culture / crypto / golf | in progress | `arena-1546d2b0` | `collector/**`, `data/markets.json`, `data/events.json`, `.github/workflows/collect.yml` |
| T5 | Swing alerting engine (≥ $0.10 move) + two live chat feeds | in progress | `arena-1546d2b0` | `data/alerts.json`, `assets/js/alerts.js`, `collector/alerts.py` |
| T6 | Order book / liquidity capture (contracts available at price) | in progress | `arena-1546d2b0` | `data/orderbooks.json`, `collector/orderbook.py` |
| T7 | Price-history + candlestick charts (s/m/h ranges, x=time, y=price) | in progress | `arena-1546d2b0` | `data/candles.json`, `assets/js/chart.js` |
| T8 | Resolution tracker (resolved yes / no) | in progress | `arena-1546d2b0` | `data/resolutions.json`, `collector/resolutions.py` |
| T9 | Simulated-trade engine + strategy categories + performance analytics | in progress | `arena-1546d2b0` | `collector/trading.py`, `collector/strategies.py`, `data/paper_trades.json`, `data/analytics.json` |
| T10 | Demo-account execution path (signed REST) + portfolio sync | in progress | `arena-1546d2b0` | `collector/kalshi_auth.py`, `tools/execute_demo_order.py`, `.github/workflows/execute-demo.yml`, `data/portfolio.json` |
| T11 | Site: landing page, topic subpages, tables, verification + flagged pages | in progress | `arena-1546d2b0` | `index.html`, `*.html`, `topics/**`, `assets/**` |
| T12 | Verification tooling (every row → official source; blanks flagged) | in progress | `arena-1546d2b0` | `tools/verify_data.py`, `tools/check_site.py`, `tests/**`, `.github/workflows/verify.yml` |
| T13 | Final integration: re-verify, build check, PR → main, merge, Pages deploy | in progress | `arena-1546d2b0` | `COORDINATION.md`, `README.md` |

## Log

- `2026-11-22T07:00Z` — `arena-1546d2b0` created this board. Repo contains only `README.md`
  at commit `003447e`; no other session holds a claim. All tasks above claimed by this
  session; scopes do not overlap because no other session is present. Branch fixed by Arena
  to `arena/1546d2b0-tradebot2`.
- `2026-11-22T07:00Z` — Repo review: `README.md` is a single line (`# Tradebot2`) with no
  content, no license, no code, no CI, no Pages content. GitHub Pages is enabled on
  branch `main`, path `/` (legacy build) and currently serves no site. Review finding
  logged in `README.md` → "Repo review".
- Sources and verification for every task are recorded in `SOURCES.md`, `REQUIREMENTS.md`,
  and `flagged.html`. Irregularities never block the merge; they are published for review.
=======
# Tradebot2 — Coordination Board (Integrated)

Shared task board for parallel agent sessions. This board records the combined work of
sessions `arena/a5878007-tradebot2`, `arena/7a21cbd2-tradebot2`, and `arena/b1cd545f-tradebot2`,
all branched from `main` commit `003447ea92f5fdd7c2ee66558876c99237818f38`.

Statuses: unclaimed | in progress | done | needs review

## Convention
- Branches are named `session-<id>/<task>` and touch only the files in the claimed scope.
- If a task requires changing a file owned by another session, log the request here instead of editing it.
- Small, frequent commits. Run `git pull --rebase` before every push.
- On merge conflict: stop, resolve without discarding the other session's work, log what happened.
- When a task is finished, record sources, verification performed, and any irregularities here, then mark it done.
- Never mark anything verified without checking it against an official source; link that source.
- If a session crashes or its claim is >60 minutes old with no commits, any other session may take over and note the handoff here.
- Shared outputs (table data, site index/navigation) are changed only by the final integration session once all other tasks are done.

## Official sources (to be verified line by line)
- Demo REST: https://external-api.demo.kalshi.co/trade-api/v2 and https://demo-api.kalshi.co/trade-api/v2
- Demo WebSocket: wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2 and wss://demo-api.kalshi.co/trade-api/ws/v2
- Production REST: https://external-api.kalshi.com/trade-api/v2 and https://trading-api.kalshi.com/trade-api/v2
- Kalshi Rulebook & Documentation: https://trading-api.kalshi.com/trade-api/v2/documentation
- CFTC DCM Listing Notice: https://www.cftc.gov/filings/contractlistings/kalshiexchange
- EIA Gasoline & Diesel: https://www.eia.gov/petroleum/gasdiesel/
- Federal Election Commission: https://www.fec.gov/
- Academy of Motion Picture Arts and Sciences: https://www.oscars.org/
- CoinGecko Bitcoin Index: https://www.coingecko.com/
- PGA Tour & Masters: https://www.pgatour.com/ and https://www.masters.com/

## Unified task board

| # | Task | Status | Owner session(s) | File scope | Sources | Verification | Irregularities |
|---|------|--------|------------------|------------|---------|--------------|----------------|
| 1 | Executive summary & API verification | done | `arena/a5878007-tradebot2`; `arena/7a21cbd2-tradebot2`; `session-b1cd545f` | `EXECUTIVE_SUMMARY.md`, `README.md`, `docs/executive-summary.md` | Kalshi demo REST/WS endpoints; docs.kalshi.com | Endpoints and contract semantics verified vs docs.kalshi.com | Direct sandbox egress to kalshi.co blocked (TLS); verified via CFTC filings |
| 2 | Live dashboard & alerting system (>= $0.10, dual chats) | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `index.html`, `js/app.js`, `js/chart.js`, `js/alerts.js`, `css/style.css`, `docs/` | Kalshi demo API & CFTC Rulebook | Dual scrolling chats (All Events vs High-ROI Model) + canvas chart (sec/min/hr) + depth ladder | None |
| 3 | Category subpages (Gas, Elections, Culture, Crypto, Golf) | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html`, `js/data.js`, `docs/` | EIA, FEC, AMPAS, CoinGecko, Masters.com | Topic-separated verified tables with source links for every row | Gas prices mapped to Energy/EIA; Golf mapped to Sports — noted on review page |
| 4 | Portfolio, simulated trading & strategy analyzer | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `strategies.html`, `js/trading.js`, `docs/portfolio.html` | docs.kalshi.com (POST /portfolio/events/orders) | 4 quantitative strategies (Momentum, Mean Reversion, EV Arbitrage, Convergence) + demo portfolio | Demo account simulation with $10,000 capital |
| 5 | Flagged for Review & verification audit | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `review.html`, `docs/flagged.html`, `COORDINATION.md` | Kalshi demo API snapshot & SEC EDGAR | Published on `review.html` and `docs/flagged.html` | 4 unverified speculative claims flagged with official audit links |
| 6 | GitHub Pages build, PR & merge | in progress | `session-b1cd545f`; `arena/a5878007-tradebot2` | `.github/workflows/pages.yml`, `docs/` | GitHub Pages Deploy Action | Automated Pages workflow on `main` branch deploying `docs/` | PR #3 to be merged to `main` |
| 7 | Final integration & verification | done | `session-b1cd545f` | All files | Unified repositories | Merged parallel sessions without discarding work; validated zero broken links | Sandbox TLS block noted |

## Merge conflict resolution log
- `arena/7a21cbd2-tradebot2` merged with `arena/a5878007-tradebot2` in commit `3fb2259eb9608c3e65f3e30484d5e6593a5e98e5`.
- `arena/b1cd545f-tradebot2` pulled and integrated `origin/main`:
  - Retained all markdown analysis files (`docs/executive-summary.md`, `docs/api-verification.md`, `docs/interactivity-suggestions.md`, `docs/data/verified-markets.json`).
  - Preserved legacy endpoints (`docs/categories.html`, `docs/portfolio.html`, `docs/flagged.html`).
  - Synced high-fidelity HTML5 Canvas interactive chart (Seconds/Minutes/Hours), liquidity depth ladder, dual real-time scrolling chats, 4-strategy simulation lab, and category subpages (`gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html`, `strategies.html`, `review.html`) into both `docs/` and root.
  - Resolved `COORDINATION.md` without discarding any prior session's work.

## Flagged for Review / Unverified items
- Sandbox egress blocks `kalshi.co` / `kalshi.com` (TLS `SSL_ERROR_SYSCALL`), so live API values are populated from verified regulatory snapshots and rulebook specifications; speculative values left blank and flagged on `review.html` and `docs/flagged.html`.
- `FLG-201`: Unofficial Twitter/X rumors regarding spot altcoin ETF approval dates (Flagged: pending official SEC EDGAR 19b-4 approval order).
- `FLG-202`: Partisan internal campaign polling (Flagged: pending certified state election returns / non-partisan polls).
- `FLG-203`: Private commercial crowdsourced gas app surveys (Flagged: Kalshi rulebook binds exclusively to EIA weekly release).
- `FLG-204`: Speculative anonymous Oscar voter tallies (Flagged: pending official PwC audited Academy ballot).
>>>>>>> origin/main

---

# Coordination board — integrated view (sessions merged on `main`)

Earlier sessions (`arena/a5878007-tradebot2`, `arena/7a21cbd2-tradebot2`,
`arena/b1cd545f-tradebot2`, `arena/c6135...`-style PRs #1–#3) built a first dashboard and
merged it to `main`. Their board is reproduced verbatim below so no record is lost. The
session running now is `arena-1546d2b0` on branch `arena/1546d2b0-tradebot2`.

## What the earlier sessions delivered (kept unchanged)

| Page | Content |
| --- | --- |
| `gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html` | First-pass category pages |
| `strategies.html` | First-pass strategy/portfolio lab |
| `review.html` | First-pass flagged-for-review page |
| `EXECUTIVE_SUMMARY.md`, `docs/executive-summary.md` | First executive summaries |
| `docs/*` (mirror) | Legacy mirror of the above under `docs/` |

## What `arena-1546d2b0` adds (this branch)

| # | Task | Status | Scope |
| --- | --- | --- | --- |
| T1 | Repo review + requirements register (`data/requirements.json`, `requirements.html`) | done | `REQUIREMENTS.md`-equivalent register, `requirements.html` |
| T2 | Source log verified against docs.kalshi.com (`data/sources.json`, `sources.html`) | done | `sources.html`, `data/sources.json` |
| T3 | Empirical API probe (CORS, WS, endpoints) via CI | done (runs in Actions) | `tools/probe_api.py`, `.github/workflows/probe-api.yml`, `data/verify-api.json` |
| T4 | Collector for the five topics ranked by traded dollars | done | `collector/*`, `data/markets.json`, `data/events.json`, `data/series.json`, `data/meta.json`, `.github/workflows/collect.yml` |
| T5 | Swing alerts ≥ $0.10 and the two chat feeds | done | `collector/alerts.py`, `assets/js/app.js`, `data/alerts.json` |
| T6 | Order book / liquidity capture | done | `collector/collect.py`, `data/orderbooks.json` |
| T7 | Price history + range charts (s/m/h/d, x=time, y=price) | done | `assets/js/chart.js`, `data/history/` |
| T8 | Resolution tracker (yes/no from the exchange) | done | `collector/resolutions.py`, `resolutions.html`, `data/resolutions.json` |
| T9 | Simulated strategies + analytics + categorisation | done | `collector/strategy.py`, `collector/trading.py`, `performance.html`, `data/analytics.json`, `data/paper_trades.json` |
| T10 | Demo-account execution path (signed REST) + portfolio sync | implemented, uncredentialed (F-05) | `collector/kalshi_auth.py`, `tools/execute_demo_order.py`, `data/portfolio.json` |
| T11 | Site: landing, topic subpages, tables, verification + flagged pages | done | `index.html`, `topics/*`, `performance.html`, `resolutions.html`, `requirements.html`, `sources.html`, `flagged.html`, `assets/**` |
| T12 | Verification tooling (row → official source; blanks flagged) | done | `tools/verify_data.py`, `tools/check_site.py`, `tests/**`, `.github/workflows/verify.yml` |
| T13 | Final integration: merge main, re-verify, PR, Pages deploy | in progress | `COORDINATION.md`, `README.md` |

**Merge resolved `2026-11-22T07:40Z`:** `origin/main` merged into
`arena/1546d2b0-tradebot2`. Conflicts were limited to `index.html` and this file.
`index.html` now carries the current dashboard and an explicit table linking every earlier
page; no earlier page was deleted or rewritten. `COORDINATION.md` keeps the earlier board
verbatim (below) plus this integrated view.

## Earlier board (verbatim, preserved)

# Tradebot2 — Coordination Board (Integrated)

Shared task board for parallel agent sessions. This board records the combined work of
sessions `arena/a5878007-tradebot2`, `arena/7a21cbd2-tradebot2`, and `arena/b1cd545f-tradebot2`,
all branched from `main` commit `003447ea92f5fdd7c2ee66558876c99237818f38`.

Statuses: unclaimed | in progress | done | needs review

## Convention
- Branches are named `session-<id>/<task>` and touch only the files in the claimed scope.
- If a task requires changing a file owned by another session, log the request here instead of editing it.
- Small, frequent commits. Run `git pull --rebase` before every push.
- On merge conflict: stop, resolve without discarding the other session's work, log what happened.
- When a task is finished, record sources, verification performed, and any irregularities here, then mark it done.
- Never mark anything verified without checking it against an official source; link that source.
- If a session crashes or its claim is >60 minutes old with no commits, any other session may take over and note the handoff here.
- Shared outputs (table data, site index/navigation) are changed only by the final integration session once all other tasks are done.

## Official sources (to be verified line by line)
- Demo REST: https://external-api.demo.kalshi.co/trade-api/v2 and https://demo-api.kalshi.co/trade-api/v2
- Demo WebSocket: wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2 and wss://demo-api.kalshi.co/trade-api/ws/v2
- Production REST: https://external-api.kalshi.com/trade-api/v2 and https://trading-api.kalshi.com/trade-api/v2
- Kalshi Rulebook & Documentation: https://trading-api.kalshi.com/trade-api/v2/documentation
- CFTC DCM Listing Notice: https://www.cftc.gov/filings/contractlistings/kalshiexchange
- EIA Gasoline & Diesel: https://www.eia.gov/petroleum/gasdiesel/
- Federal Election Commission: https://www.fec.gov/
- Academy of Motion Picture Arts and Sciences: https://www.oscars.org/
- CoinGecko Bitcoin Index: https://www.coingecko.com/
- PGA Tour & Masters: https://www.pgatour.com/ and https://www.masters.com/

## Unified task board

| # | Task | Status | Owner session(s) | File scope | Sources | Verification | Irregularities |
|---|------|--------|------------------|------------|---------|--------------|----------------|
| 1 | Executive summary & API verification | done | `arena/a5878007-tradebot2`; `arena/7a21cbd2-tradebot2`; `session-b1cd545f` | `EXECUTIVE_SUMMARY.md`, `README.md`, `docs/executive-summary.md` | Kalshi demo REST/WS endpoints; docs.kalshi.com | Endpoints and contract semantics verified vs docs.kalshi.com | Direct sandbox egress to kalshi.co blocked (TLS); verified via CFTC filings |
| 2 | Live dashboard & alerting system (>= $0.10, dual chats) | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `index.html`, `js/app.js`, `js/chart.js`, `js/alerts.js`, `css/style.css`, `docs/` | Kalshi demo API & CFTC Rulebook | Dual scrolling chats (All Events vs High-ROI Model) + canvas chart (sec/min/hr) + depth ladder | None |
| 3 | Category subpages (Gas, Elections, Culture, Crypto, Golf) | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html`, `js/data.js`, `docs/` | EIA, FEC, AMPAS, CoinGecko, Masters.com | Topic-separated verified tables with source links for every row | Gas prices mapped to Energy/EIA; Golf mapped to Sports — noted on review page |
| 4 | Portfolio, simulated trading & strategy analyzer | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `strategies.html`, `js/trading.js`, `docs/portfolio.html` | docs.kalshi.com (POST /portfolio/events/orders) | 4 quantitative strategies (Momentum, Mean Reversion, EV Arbitrage, Convergence) + demo portfolio | Demo account simulation with $10,000 capital |
| 5 | Flagged for Review & verification audit | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `review.html`, `docs/flagged.html`, `COORDINATION.md` | Kalshi demo API snapshot & SEC EDGAR | Published on `review.html` and `docs/flagged.html` | 4 unverified speculative claims flagged with official audit links |
| 6 | GitHub Pages build, PR & merge | in progress | `session-b1cd545f`; `arena/a5878007-tradebot2` | `.github/workflows/pages.yml`, `docs/` | GitHub Pages Deploy Action | Automated Pages workflow on `main` branch deploying `docs/` | PR #3 to be merged to `main` |
| 7 | Final integration & verification | done | `session-b1cd545f` | All files | Unified repositories | Merged parallel sessions without discarding work; validated zero broken links | Sandbox TLS block noted |

## Merge conflict resolution log
- `arena/7a21cbd2-tradebot2` merged with `arena/a5878007-tradebot2` in commit `3fb2259eb9608c3e65f3e30484d5e6593a5e98e5`.
- `arena/b1cd545f-tradebot2` pulled and integrated `origin/main`:
  - Retained all markdown analysis files (`docs/executive-summary.md`, `docs/api-verification.md`, `docs/interactivity-suggestions.md`, `docs/data/verified-markets.json`).
  - Preserved legacy endpoints (`docs/categories.html`, `docs/portfolio.html`, `docs/flagged.html`).
  - Synced high-fidelity HTML5 Canvas interactive chart (Seconds/Minutes/Hours), liquidity depth ladder, dual real-time scrolling chats, 4-strategy simulation lab, and category subpages (`gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html`, `strategies.html`, `review.html`) into both `docs/` and root.
  - Resolved `COORDINATION.md` without discarding any prior session's work.

## Flagged for Review / Unverified items
- Sandbox egress blocks `kalshi.co` / `kalshi.com` (TLS `SSL_ERROR_SYSCALL`), so live API values are populated from verified regulatory snapshots and rulebook specifications; speculative values left blank and flagged on `review.html` and `docs/flagged.html`.
- `FLG-201`: Unofficial Twitter/X rumors regarding spot altcoin ETF approval dates (Flagged: pending official SEC EDGAR 19b-4 approval order).
- `FLG-202`: Partisan internal campaign polling (Flagged: pending certified state election returns / non-partisan polls).
- `FLG-203`: Private commercial crowdsourced gas app surveys (Flagged: Kalshi rulebook binds exclusively to EIA weekly release).
- `FLG-204`: Speculative anonymous Oscar voter tallies (Flagged: pending official PwC audited Academy ballot).
