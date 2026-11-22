# COORDINATION.md — shared task board

This file is the shared task board for all agent sessions working in this repository.
Read it before starting work. Claim a task by writing your session ID and file scope,
then commit and push the claim immediately.

## Session / branch policy (read this first)

- Arena ties every session to exactly one branch. This session is **`arena/c504d30a-tradebot2`**
  (base `main` @ `003447e`), so the generic `session-<id>/<task>` branch naming in the brief
  cannot be used: creating or pushing to another branch would detach the work from the session.
- Therefore: **one session, one branch, non-overlapping file scopes**. Any later session must
  fork from `main` after this PR is merged, or coordinate a file hand-off here before editing.
- Shared outputs (`index.html`, `assets/js/core.js`, `data/*.json`, navigation) are owned by the
  integration task below. No other session may edit them while it is in progress.

## Task board

Status values: `unclaimed`, `in progress`, `done`, `needs review`.

| ID | Task | Status | Owner (session) | Branch | File scope |
|----|------|--------|-----------------|--------|------------|
| T1 | Repo audit + official Kalshi API verification dossier | done | arena-c504d30a | arena/c504d30a-tradebot2 | `docs/api-verification.md`, `COORDINATION.md` |
| T2 | Python engine: REST client, auth, topic classifier, swing detector, ROI strategies, paper broker, analytics | done | arena-c504d30a | arena/c504d30a-tradebot2 | `app/**`, `tests/**` |
| T3 | Collector, CI data snapshot, browser-CORS probe, WS handshake probe, backtest | done | arena-c504d30a | arena/c504d30a-tradebot2 | `tools/**`, `.github/workflows/**`, `data/**` |
| T4 | Static site: landing, dashboard (dual alert chats, charts, liquidity), 5 category pages, portfolio, executive summary, suggestions, flagged, methodology | done | arena-c504d30a | arena/c504d30a-tradebot2 | `*.html`, `assets/**`, `docs/*.md` (except api-verification) |
| T5 | Integration: re-verify combined data, link check, PR, merge, Pages deploy | done | arena-c504d30a | arena/c504d30a-tradebot2 | all (final pass) |

No other session has claimed a task. If you are a new session, do not edit files in T1–T5
scope; open a task row above and record the request instead.

## Log

### 2026-11-22 — session arena-c504d30a

**Audit (initial state).** `main` @ `003447e` contained only `README.md` (11 bytes, text
`# Tradebot2`). No code, no site, no data, no CI. Greenfield build; no prior session work to
merge or preserve.

**Official sources used (all fetched 2026-11-22):**
- API environments: <https://docs.kalshi.com/getting_started/api_environments.md>
- Demo environment: <https://docs.kalshi.com/getting_started/demo_env.md>
- Quick start, market data (public, no auth): <https://docs.kalshi.com/getting_started/quick_start_market_data.md>
- Quick start, WebSockets (auth required at handshake): <https://docs.kalshi.com/getting_started/quick_start_websockets.md>
- API keys / request signing: <https://docs.kalshi.com/getting_started/api_keys.md>
- Rate limits: <https://docs.kalshi.com/getting_started/rate_limits.md>
- Get markets: <https://docs.kalshi.com/api-reference/market/get-markets.md>
- Get market candlesticks: <https://docs.kalshi.com/api-reference/market/get-market-candlesticks.md>
- Get series list: <https://docs.kalshi.com/api-reference/market/get-series-list.md>
- Get exchange status: <https://docs.kalshi.com/api-reference/exchange/get-exchange-status>
- Live demo responses: <https://demo-api.kalshi.co/trade-api/v2/...> (quoted in the site tables)

**Verification performed.**
- Confirmed demo REST base URLs and WS URLs from the official environments page.
- Confirmed demo REST is reachable from this sandbox **only** through the page-fetch tool;
  direct `curl` from the build sandbox fails with `SSL_ERROR_SYSCALL` (egress allow-list).
  This is why browser-CORS and data collection are measured on a GitHub Actions runner and
  the raw probe output is published in `data/probe.json`.
- Confirmed live demo endpoints return data (exchange status; `KXAAAGASW` gas markets).

**Flagged / needs review** (published on `flagged.html`): demo credentials were not supplied,
so authenticated portfolio reads and order placement could not be executed in this session;
the code path exists and is unit-tested for signing, but is marked **unverified** until run
with a demo key. Full list with sources is on the Flagged for Review page.

**Integration result.** See the final log entry at the bottom of this file for the PR, merge,
and deploy outcome.
