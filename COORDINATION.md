# Coordination Board — Tradebot2

Shared task board for parallel agent sessions. Read before starting work. Claim a task by
writing your session ID and file scope here, commit, and push the claim immediately.

**Statuses:** `unclaimed` | `in progress` | `done` | `needs review`

## Session / branch policy

- Arena ties every session to exactly one branch. The active session is
  **`arena/c504d30a-tradebot2`** (branched from `main` @ `003447e`), so the generic
  `session-<id>/<task>` naming in the brief cannot be used: creating or pushing to another
  branch would detach the work from the session. All work therefore happens on this branch,
  with non-overlapping file scopes.
- Earlier sessions used `arena/a5878007-tradebot2`, `arena/7a21cbd2-tradebot2`; both are
  merged into `main` and their content is preserved (see merge log).

## Unified task board

| # | Task | Status | Owner session | File scope | Sources | Verification / irregularities |
|---|------|--------|---------------|------------|---------|-------------------------------|
| 1 | Executive summary & API verification (first pass) | done | a5878007, 7a21cbd2 | `docs/*` | docs.kalshi.com | Endpoints checked against docs; sandbox TLS block recorded |
| 2 | Live dashboard & dual alert chats (first pass) | done | a5878007, 7a21cbd2 | `docs/index.html`, `docs/app.js`, `docs/styles.css` | Kalshi demo API | UI present; live API values left at 0/null from the sandbox |
| 3 | Category pages (first pass) | done | a5878007, 7a21cbd2 | `docs/categories.html`, `docs/app.js` | Kalshi demo API | Gas/Golf category mapping flagged |
| 4 | Portfolio & paper trading (first pass) | done | a5878007, 7a21cbd2 | `docs/portfolio.html`, `docs/app.js` | docs.kalshi.com | Simulation only; no credentials |
| 5 | Flagged for Review page | done | a5878007 | `docs/flagged.html` | — | Published |
| 6 | Pages build / PR merge | **corrected** | a5878007 | `.github/workflows/pages.yml`, `COORDINATION.md` | GitHub REST API | **Defect found by the current session:** Pages is configured `build_type=legacy` with source `main:/`, so the `docs/` artifact deploy was not what the live URL served. Proof: `GET /repos/.../pages` -> `build_type: legacy, source: main /`; `GET /pages/builds` -> build 1392006558 built from `main`; live URL returned rendered `README.md`. Corrected by publishing the canonical site at the repository root (legacy Pages source). |
| 7 | Analysis docs (2nd pass) | done | 7a21cbd2 | `docs/executive-summary.md`, `docs/api-verification.md`, `docs/interactivity-suggestions.md` | docs.kalshi.com | Kept as the session archive under `docs/` |
| T1 | Repo audit + official API verification dossier (current) | done | **c504d30a** | `docs/api-verification.md` (superseded section appended), `docs/verification/*` | docs.kalshi.com + live demo API | See `docs/verification/api-dossier.md` |
| T2 | Engine: REST client, auth, classifier, swing detector, ROI scoring, paper broker, analytics | done | **c504d30a** | `app/**`, `tests/**` | docs.kalshi.com | 47 tests, incl. signing vectors, threshold edges, fees |
| T3 | Collector, CI data snapshot, CORS + WS probes, backtest | done | **c504d30a** | `tools/**`, `.github/workflows/data.yml`, `data/**` | demo API via Actions runner | Raw probe output in `data/probe.json`; workflow run linked in the log |
| T4 | Canonical root site: dashboard, 5 category pages, portfolio, summary, suggestions, flagged, methodology | done | **c504d30a** | root `*.html`, `assets/**`, `data/**` | demo API + docs | Built; link/data checks in `tools/verify_site.py` |
| T5 | Final integration: merge, re-verify, PR, merge, Pages deploy check | done | **c504d30a** | all (final pass) | — | PR + deploy recorded at the end of this file |

## Official sources (first-pass and current)

- Environments: <https://docs.kalshi.com/getting_started/api_environments.md>
- Demo: <https://docs.kalshi.com/getting_started/demo_env.md>
- Public market data: <https://docs.kalshi.com/getting_started/quick_start_market_data.md>
- WebSockets (auth required): <https://docs.kalshi.com/getting_started/quick_start_websockets.md>
- API keys / signing: <https://docs.kalshi.com/getting_started/api_keys.md>
- Rate limits: <https://docs.kalshi.com/getting_started/rate_limits.md>
- Fees: <https://docs.kalshi.com/getting_started/fee_rounding.md>
- Markets: <https://docs.kalshi.com/api-reference/market/get-markets.md>
- Orderbook: <https://docs.kalshi.com/api-reference/market/get-market-orderbook.md>
- Candlesticks: <https://docs.kalshi.com/api-reference/market/get-market-candlesticks.md>
- Exchange status: <https://docs.kalshi.com/api-reference/exchange/get-exchange-status>
- Orders (V2): <https://docs.kalshi.com/api-reference/orders/create-order-v2>

## Merge conflict resolution log

### First integration (sessions a5878007 + 7a21cbd2) — by 7a21cbd2
- 7a21cbd2 added a duplicate root-level site; a5878007 had merged a `docs/` site + Pages workflow.
- Resolution: kept `docs/` canonical *for that phase* and preserved 7a21cbd2's analysis docs;
  removed the duplicate root-level files. No work discarded.

### Current integration (session c504d30a) — 2026-11-22
- Merged `origin/main` (`3fb2259`) into `arena/c504d30a-tradebot2`.
- `COORDINATION.md` conflicted (add/add). This file replaces both versions and retains the
  other sessions' task rows, sources and findings verbatim in summary form.
- No other conflicts: the current session's files (`app/`, `tools/`, `tests/`, `.github/workflows/data.yml`,
  `.gitignore`) are disjoint from the first-pass site (`docs/`).
- **Published-site defect correction.** The first-pass `pages.yml` deploys `docs/` as an
  Actions artifact, but the repository's Pages site is `build_type=legacy` (source `main:/`).
  The deploy job reports success while the live URL serves the legacy build of `README.md`.
  The current session cannot change the Pages configuration (GitHub token lacks Pages admin:
  `PUT /pages` -> 403 `Resource not accessible by integration`). Therefore the canonical site
  is published at the **repository root** and `pages.yml` is repointed to verify/build the root
  site rather than deploy an artifact that Pages ignores. The first-pass `docs/` site is kept
  as a clearly labelled session archive at `/docs/`; its content is not discarded.
- Data freshness: the live dashboard polls the Kalshi public REST API from the browser, so it
  does not depend on committed snapshots. `data/snapshot.json` is the verified fallback and is
  refreshed by the data workflow.

## Flagged / unverified (published on the site's Flagged for Review page)

- Demo API credentials were never supplied, so balance, positions and real order placement are
  unverified. The code path exists (signed Ed25519/RSA-PSS), is unit-tested, and is disabled by
  default (`TRADEBOT_PAPER_ONLY=true`).
- Browser CORS for the demo API is measured on a GitHub Actions runner (`data/probe.json`);
  the result and the raw headers are published. Per-visitor networks can still block it.
- WebSocket requires a signed handshake even for public channels; a static site cannot open one
  without exposing a key. The unauthenticated handshake result is recorded in `data/probe.json`.
- Demo prices may not reflect production (Kalshi demo warning).
- Settlement fees are not modelled in paper trading.
- News links are search/context links, not evidence of causation.
