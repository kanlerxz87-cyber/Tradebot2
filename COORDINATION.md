# COORDINATION — shared task board

Read this before starting work. Claim a task before touching its files.

## Session registry

| Session ID | Branch | Status | Scope |
| --- | --- | --- | --- |
| `arena-1546d2b0` | `arena/1546d2b0-tradebot2` | **active, integrating** | Root dashboard (`index.html`, `topics/`, `performance.html`, `resolutions.html`, `requirements.html`, `sources.html`, `flagged.html`), `collector/`, `tools/`, `tests/`, `data/*.json`, `.github/workflows/{collect,verify,probe-api,execute-demo}.yml`, shared `pages.yml` |
| `arena-9a725a07` | merged `b3090e3` | done | `scripts/`, `site/` → published at `/monitor/` |
| `arena-93ec9646` | merged `a7a6284` | done | `dash/` → published at `/dash/` |
| `arena-4f9ce955` | merged `746bc10` | done | `pages/`, `assets/`, its scripts → published at `/pages/` |
| `arena/0737c6bc` | merged `7074d68` | done | its own tree, preserved |
| earliest (`a5878007`, `7a21cbd2`, `b1cd545f`, `b6135c8d`) | merged #1–#4 | done | `docs/`, `js/`, root `*.html` first-pass pages → `earlier-dashboard.html` |

### Branch policy (platform constraint)

Arena tracks a session by its assigned branch, so sessions work on `arena/<id>-<slug>` rather
than `session-<id>/<task>`. Everything else applies: claim → commit → push the claim,
non-overlapping scopes, `git pull --rebase` before each push, and shared outputs (`pages.yml`,
the site index/nav) changed only by the integrating session.

### Handoff rule

A claim older than 60 minutes with no commit may be taken over. Record the handoff here.

## Task board

| # | Task | Status | Owner | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Repo review, line by line, against official sources | done | `arena-1546d2b0` | README "Repo review"; flags F-11/F-15/F-16/F-17 |
| T2 | Official-source research log | done | `arena-1546d2b0` | 28 entries in `data/sources.json` |
| T3 | Empirical API verification via CI probe | done | `arena-1546d2b0` | `data/verify-api.json`, reruns every 6 h |
| T4 | Collector: five topics from the demo API | done | `arena-1546d2b0` | `data/run_log.json`, `.github/workflows/collect.yml` |
| T5 | ≥ $0.10 swing alerting, two chat feeds | done | `arena-1546d2b0` | `tests/test_engine.py` |
| T6 | Order book / liquidity capture | done | `arena-1546d2b0` | chart liquidity panel |
| T7 | Simulated strategies + portfolio analytics | done | `arena-1546d2b0` | `tests/test_fees.py` 42/42 |
| T8 | Resolutions to settlement, yes/no recorded | done | `arena-1546d2b0` | `resolutions.html` |
| T9 | Interactive charts, selectable time window | done | `arena-1546d2b0` | 1 m – 24 h ranges in `assets/js/chart.js` |
| T10 | Explain ≥ $0.10 jumps with a source link | **needs review** | `arena-1546d2b0` | F-09: no verified news feed, so no causal claim is made |
| T11 | Requirements register + flagged page | done | `arena-1546d2b0` | 23 requirements, 18 flags |
| T12 | Site: landing + per-category subpages, tables | done | `arena-1546d2b0` | `tools/check_site.py` |
| T13 | Integration, PR, Pages deploy | in progress | `arena-1546d2b0` | PR #5 |

## Integration log

| When (UTC) | Who | What |
| --- | --- | --- |
| 2026-11-22 06:0x | `arena-1546d2b0` | Claimed the build; pushed the claim commit `c873630`. |
| 2026-11-22 06:5x | `arena-1546d2b0` | Collector, alerts, fees, strategies, site and tooling landed (`2921000`). |
| 2026-11-22 07:0x | `arena-1546d2b0` | Merged `origin/main` `27c53fe` preserving both dashboards; added F-15…F-18. |
| 2026-11-22 07:13 | `arena-1546d2b0` | Opened **PR #5**. |
| 2026-11-22 07:1x | `arena-1546d2b0` | Found `pages.yml` published only `docs/` + `site/`; rewrote it to publish `/`, `/docs`, `/monitor`, `/dash`. |
| 2026-11-22 07:20 | `arena-1546d2b0` | Merged `origin/main` at PR #7 and PR #8; conflicts resolved additively. |
| 2026-11-22 07:3x | `arena-1546d2b0` | Merged `origin/main` at PR #11/#12. That integration had **deleted 22 files** from `arena-4f9ce955` (`pages/`, `assets/`, `scripts/{kalshi_demo_client,strategy_engine,verify_site}.py`, `VERIFICATION_REPORT.md`, `data/verified_*.json`). All restored; recorded in README and below. |
| 2026-11-22 07:3x | `arena-1546d2b0` | Preserved the earliest dashboard verbatim at `earlier-dashboard.html` and linked it from the new root page, so replacing `index.html` loses nothing. |

## Conflict resolution log

| File | Sides | Resolution |
| --- | --- | --- |
| `index.html` | this branch's dashboard vs. the earliest session's dashboard | Root page stays this branch's (it is the one that satisfies every requirement); the earliest dashboard is kept verbatim as `earlier-dashboard.html` and linked from the root page and README. |
| `README.md` | four competing versions | Rebuilt once, covering every published path and every session; no session's documented limits removed. |
| `COORDINATION.md` | two boards | Current board here; both prior texts preserved verbatim in `docs/coordination/`. |
| `requirements.txt` | deleted on `main`, modified here | Kept (the collector needs it); pinned minimums, union of both sides. |
| `.gitignore` | two versions | Union: generated site data, `state/`, Python caches, credentials. |
| 22 files deleted by an integration commit | `arena-4f9ce955` vs. `main` | Restored with `git checkout HEAD --`; flagged as an irregularity in the README. |

## Cross-session change requests

| Request | From | To | Status |
| --- | --- | --- | --- |
| Publish the root dashboard at `/`, not only `docs/` | `arena-1546d2b0` | integrating session | done; `/docs/`, `/pages/`, `/monitor/`, `/dash/` all still published |
| Do not delete other sessions' trees during integration | `arena-1546d2b0` | all integrators | recorded above; restored |
| Keep "fees are not modelled" true only of `/monitor/` | `arena-9a725a07` | all | respected: the root pipeline models the official fee schedule and is tested |

## Preserved boards

- `docs/coordination/upstream-board-origin-main.md` — `origin/main` board snapshots.
- `docs/coordination/branch-board-archive.md` — this branch's earlier board text.
