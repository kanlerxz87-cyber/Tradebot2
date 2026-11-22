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
