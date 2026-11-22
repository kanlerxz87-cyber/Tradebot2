# COORDINATION — shared task board

Read this before starting work. Claim a task before touching its files. Sessions write the
handoff board below; every earlier board is preserved under `docs/coordination/` and is not
deleted.

## Session registry

| Session ID | Branch | Status | Scope |
| --- | --- | --- | --- |
| `arena-1546d2b0` | `arena/1546d2b0-tradebot2` | active | Root dashboard (`index.html`, `topics/`, `performance.html`, `resolutions.html`, `requirements.html`, `sources.html`, `flagged.html`), `collector/`, `tools/`, `tests/`, `data/*.json`, `.github/workflows/{collect,verify,probe-api,execute-demo}.yml`, shared `pages.yml` |
| `arena-9a725a07` | merged `b3090e3` | done | `scripts/`, `site/` → published at `/monitor/` |
| `arena-93ec9646` | merged `a7a6284` | done | `dash/` → published at `/dash/` |
| `arena-4f9ce955` | merged `746bc10` | done | its own site tree, integrated by the merge below |
| earlier (`a5878007`, `7a21cbd2`, `b1cd545f`, `b6135c8d`) | merged #1–#3 | done | `docs/`, `js/`, root `*.html` first-pass pages |

### Branch policy (platform constraint)

Arena tracks a session by its assigned branch, so sessions work on `arena/<id>-<slug>` rather
than `session-<id>/<task>`. Everything else in the protocol applies: claim → commit → push the
claim, non-overlapping scopes, `git pull --rebase` before each push, and shared outputs
(`pages.yml`, the site index/nav) changed only by the integrating session.

### Handoff rule

A claim older than 60 minutes with no commit may be taken over. Record the handoff here.

## Task board

| # | Task | Status | Owner | Files (scope) | Evidence |
| --- | --- | --- | --- | --- | --- |
| T1 | Repo review, line by line, against official sources | done | `arena-1546d2b0` | `README.md` | README "Repo review" table; F-11/F-15/F-16/F-17 |
| T2 | Official-source research log | done | `arena-1546d2b0` | `data/sources.json`, `sources.html` | 28 entries, each with what it supports |
| T3 | Empirical API verification via CI probe | done | `arena-1546d2b0` | `tools/probe_api.py`, `.github/workflows/probe-api.yml`, `data/verify-api.json` | reruns every 6 h; result committed |
| T4 | Collector: 5 topics from the demo API | done | `arena-1546d2b0` | `collector/**`, `.github/workflows/collect.yml` | `data/run_log.json` |
| T5 | ≥ $0.10 swing alerting, two chat feeds | done | `arena-1546d2b0` | `collector/alerts.py`, `data/alerts.json` | `tests/test_engine.py` |
| T6 | Order book / liquidity capture | done | `arena-1546d2b0` | `data/orderbooks.json` | chart depth panel |
| T7 | Simulated strategies + portfolio analytics | done | `arena-1546d2b0` | `collector/strategy.py`, `trading.py`, `performance.html` | `tests/test_fees.py` (42/42) |
| T8 | Resolutions until settled, yes/no recorded | done | `arena-1546d2b0` | `collector/resolutions.py`, `resolutions.html` | `data/resolutions.json` |
| T9 | Interactive charts: time × price, selectable window | done | `arena-1546d2b0` | `assets/js/chart.js` | 1m–24h ranges |
| T10 | Explain ≥ $0.10 jumps, link sources | **needs review** | `arena-1546d2b0` | `data/alerts.json` `context` field | F-09: no verified news feed, so no causal claim |
| T11 | Requirements register + flagged page | done | `arena-1546d2b0` | `requirements.html`, `flagged.html` | 23 requirements, 18 flags |
| T12 | Site: landing + per-category subpages, tables | done | `arena-1546d2b0` | `index.html`, `topics/*.html` | `tools/check_site.py` |
| T13 | Integration + PR + Pages | in progress | `arena-1546d2b0` | `COORDINATION.md`, `pages.yml`, PR #5 | see log |

## Integration log

| When (UTC) | Who | What |
| --- | --- | --- |
| 2026-11-22 06:0x | `arena-1546d2b0` | Claimed the full build; pushed the initial claim commit `c873630`. |
| 2026-11-22 06:5x | `arena-1546d2b0` | Collector, alert engine, fee model, strategies, site, tooling all landed (`2921000`). |
| 2026-11-22 07:0x | `arena-1546d2b0` | Merged `origin/main` (`27c53fe`) preserving both dashboards; added F-15…F-18. |
| 2026-11-22 07:13 | `arena-1546d2b0` | Opened **PR #5**. |
| 2026-11-22 07:1x | `arena-1546d2b0` | Found `pages.yml` published only `docs/` + `site/`; root dashboard would never deploy. Rewrote it to publish `/`, `/docs`, `/monitor`, `/dash`. |
| 2026-11-22 07:20 | `arena-1546d2b0` | Merged `origin/main` twice (`a7a6284` → PR #7, `746bc10` → PR #8). Conflicts were add/add in `README.md`, `COORDINATION.md`, `index.html`, `requirements.txt`, `.gitignore`; resolved additively — no other session's page removed. Earlier board text preserved in `docs/coordination/`. |

## Cross-session change requests

| Request | From | To | Status |
| --- | --- | --- | --- |
| Publish the root dashboard at `/` instead of only `docs/` | `arena-1546d2b0` | integrating session | done in this branch's `pages.yml`; `/docs/`, `/monitor/`, `/dash/` all still published |
| Do not model fees / do not place orders (monitor's stated limits) | `arena-9a725a07` | all | unchanged for `/monitor/`; the root pipeline *does* model the official fee schedule and is tested |

## Preserved boards

- `docs/coordination/upstream-board-origin-main.md` — `origin/main`'s board as of this merge.
- `docs/coordination/branch-board-archive.md` — this branch's earlier board text.
