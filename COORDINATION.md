# COORDINATION.md — shared task board

Scope: whole-repo build for the Kalshi demo dashboard. One row per task.
Statuses: `unclaimed` | `done` | `done` | `needs-review`.
A `needs-review` task is published on the site's **Flagged for Review** page and does not block anything.
Claim by writing your session id and file scope below, then commit + push immediately.

**Session id used by this board:** `session-arena/5f1ca159-tradebot2`
**Branch:** `arena/5f1ca159-tradebot2` (branched from `003447ea92f5fdd7c2ee66558876c99237818f38` on `main`)

## How this board works
- One owner per task. Never start a task another session owns.
- Small, frequent commits. `git pull --rebase` before every push.
- Shared outputs (data tables, site index, navigation) change only in the final integration step.
- If a claim is > 60 minutes old with no commits, another session may take over and log the handoff here.

## Tasks

| ID | Task | Status | Owner | Files touched |
| --- | --- | --- | --- | --- |
| T1 | Executive summary + repo line-by-line verification | done | session-arena/5f1ca159-tradebot2 | `EXECUTIVE_SUMMARY.md`, `README.md`, `COORDINATION.md` |
| T2 | Dashboard core: data layer, market simulator, live Kalshi demo REST provider | done | session-arena/5f1ca159-tradebot2 | `docs/assets/js/config.js`, `docs/assets/js/sim-provider.js`, `docs/assets/js/live-provider.js`, `docs/assets/js/state.js` |
| T3 | Charts + orderbook depth display | done | session-arena/5f1ca159-tradebot2 | `docs/assets/js/charts.js`, `docs/assets/js/depth.js` |
| T4 | Alerting engine (>= $0.10 swings) + ROI model + two scrolling chats | done | session-arena/5f1ca159-tradebot2 | `docs/assets/js/alerts.js`, `docs/assets/js/model.js` (chats render inline in `dashboard.js`) |
| T5 | Simulated auto-trades (strategies) + portfolio performance tracking | done | session-arena/5f1ca159-tradebot2 | `docs/assets/js/strategy.js`, `docs/assets/js/portfolio.js` |
| T6 | Site pages: landing, dashboard, topic subpages, methodology, flagged-for-review | done | session-arena/5f1ca159-tradebot2 | `docs/index.html`, `docs/dashboard.html`, `docs/topics/*.html`, `docs/methodology.html`, `docs/flagged-for-review.html`, `docs/assets/css/style.css` |
| T7 | Line-by-line verification, source links, irregularities | done | session-arena/5f1ca159-tradebot2 | per-topic pages + `docs/methodology.html` |
| T8 | Integration: build check, GitHub Pages deploy, PR + merge | in-progress | session-arena/5f1ca159-tradebot2 | `docs/` (build only) |

## Handoffs & log

- 2026-11-22 — Board created. Owner: session-arena/5f1ca159-tradebot2. Base commit: `003447ea92f5fdd7c2ee66558876c99237818f38`.

- 2026-11-22 — T1..T7 complete. Owner: session-arena/5f1ca159-tradebot2.
  - T1: EXECUTIVE_SUMMARY.md written; repo line-by-line verified (README.md is the only pre-existing file — line 1 is `# Tradebot2`). No irregularities found beyond an empty repo.
  - T2: dashboard engine built — sim-provider.js (10 markets, 1s ticks, news shocks, resolution), live-provider.js (public market-data polling from the official demo REST API, best-effort payload mapping), state.js (pub/sub store).
  - T3: charts.js (canvas price chart, 30s/1m/5m/1h/24h windows, swing annotations) + depth.js (YES/NO bids + liquidity + spread).
  - T4: alerts.js (>= $0.10 swing alerts, 10s baseline, 15s re-anchor) + model.js (heuristic ROI scoring, 5 factors) + ROI chat filter (score >= 70).
  - T5: strategy.js (Momentum / Mean reversion / Swing breaker; all simulated) + portfolio.js (P&L, win rate, equity, exposure, per-strategy/per-topic breakdowns).
  - T6: pages built — index.html (landing), dashboard.html (interactive dashboard), 5 topic subpages, methodology.html, flagged-for-review.html, EXECUTIVE_SUMMARY.md, README.md.
  - T7: verification — every verified fact linked to docs.kalshi.com pages; unverified values flagged (F1–F12) on the flagged-for-review page. jsdom smoke tests: dashboard renders 10 markets, alerts/chats/strategies/portfolio populated; 199 local links, 0 broken; all 9 pages serve 200.

## Sources (verified against official docs)

- Kalshi API environments & endpoints: https://docs.kalshi.com/getting_started/api_environments.md
- Demo environment: https://docs.kalshi.com/getting_started/demo_env.md
- Market data quick start (public endpoints, no auth): https://docs.kalshi.com/getting_started/quick_start_market_data.md
- Quick Start: WebSockets: https://docs.kalshi.com/getting_started/quick_start_websockets.md
- Quick Start: Authenticated Requests (portfolio balance + signing): https://docs.kalshi.com/getting_started/quick_start_authenticated_requests.md
- Get Markets (status filter values): https://docs.kalshi.com/api-reference/market/get-markets.md
- Fixed-point representation: https://docs.kalshi.com/getting_started/fixed_point_migration.md
- Market settlement: https://docs.kalshi.com/getting_started/market_settlement.md
- API Changelog: https://docs.kalshi.com/changelog
