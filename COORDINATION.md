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
| T11 | Requirements register + flagged page | done | `arena-1546d2b0` | 23 requirements, 19 flags |
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

<<<<<<< HEAD
- `docs/coordination/upstream-board-origin-main.md` — `origin/main` board snapshots.
- `docs/coordination/branch-board-archive.md` — this branch's earlier board text.
=======
### Merge Conflict Resolution Log (`arena-4f9ce955`)
1. First merge against `origin/main` (`27c53fe`, after PRs `#1`–`#3`): resolved conflicts in `COORDINATION.md`, `EXECUTIVE_SUMMARY.md`, `README.md`, and `index.html` while keeping all `docs/`, `css/`, `js/`, `.github/workflows/pages.yml`, and root companion `.html` files intact.
2. Second merge against `origin/main` (`b3090e3`, after PR `#9` by `arena-9a725a07`): resolved conflicts in `.gitignore`, `COORDINATION.md`, and `README.md` while keeping PR `#9`'s `site/`, `scripts/kalshi_collector.py`, `scripts/check_site.py`, `scripts/tests/`, and `.github/workflows/pages.yml` completely untouched.
3. PR Link: https://github.com/kanlerxz87-cyber/Tradebot2/pull/8

4. Third merge against `origin/main` (`a7a6284`, after PR #7 by `arena-93ec9646`): preserved PR #7's `dash/`, `data/snapshot.json`, `tools/`, and `.github/workflows/pages.yml` intact while resolving `COORDINATION.md` and `README.md`.

### Session log — arena/0737c6bc-tradebot2

- Session: `session-0737c6bc` (this branch, originally branched from `003447e`).
- At start this session built a parallel static dashboard (flat pages `dashboard.html`,
  `portfolio.html`, `review.html`, `flagged-review.html`, `executive-summary.html`,
  `topics/*.html`, `assets/`, plus `scripts/simulate.js` and `data/README.md`), verified it with
  jsdom smoke tests (events table, >= $0.10 swing alerts -> high-ROI feed, simulated ledger,
  chart canvas guard), then discovered that the same scope was merged into `main` by other
  parallel sessions (PRs #1-#9) with a stronger implementation (CI pipeline, verified taxonomy via
  `/search/tags_by_categories`, `check_site.py`, dual root + /monitor + /dash + /pages publish).
  Per the board's rule that shared outputs are owned by the integration session, this session
  DROPPED its duplicate static site on this branch (kept locally, not merged) rather than
  overwrite `main`'s site. The dropped site is kept outside the repo for reference.
- Unique additions kept (additive, no conflicts): `scripts/simulate.js` (headless Node simulator;
  paper-default, `--live` places orders on the DEMO environment with user-held credentials only)
  and `data/README.md` (format notes; no fabricated data).
- Verification performed (jsdom): dashboard/topic pages render, >= $0.10 alerts fire and are
  routed to both chats, simulated ledger auto-fills, header/nav/footer inject, chart guards handle
  missing canvas, portfolio page aggregates ledger correctly. Not deployed (dropped).
- Irregularity noticed, NOT edited, flagged for review: `.github/workflows/pages.yml` runs
  `python3 scripts/kalshi_collector.py` without setting `KALSHI_BASE`, so the collector defaults
  to PRODUCTION (`https://external-api.kalshi.com/trade-api/v2`) while the site is branded as a demo
  tracker (see also PR #4, which overlaps the same shared file). `data/portfolio-log.json` is not
  covered by `.gitignore` — requested for the next integration session.
- Status: additive handoff -> see the open PR from this branch.

---

## Session `arena-93ec9646` — branch `arena/93ec9646-tradebot2` (PR #7, merged `a7a6284`)

Full-spec static dashboard for the official Kalshi **demo** exchange, published at
**`/dash/`** in the shared Pages artifact (built from `dash/`; no build step).
Integrated non-destructively: all other sessions' files preserved; the only shared
file this session touched was one line in `.github/workflows/pages.yml`
(`cp -r dash/. _site/dash/`) so the single Pages artifact also publishes `/dash/`.

| Task | Status | File scope | Verification |
|---|---|---|---|
| T1 Coordination board | `done` | `COORDINATION.md` (this section) | — |
| T2 Source verification (endpoints, demo env, auth, markets, orderbook, candlesticks, settlement, rate limits) | `done` | `dash/docs/verification.md` (V1–V15) | every fact linked to its official docs.kalshi.com page |
| T3 Live data snapshot (gas, elections, culture, crypto, golf) | `done` | `dash/assets/data.js`, `data/snapshot.json` | 40 market records + 2 orderbooks + 15×1-min candles + 10-trade tape + series census; every record embeds the exact official query that verified it (`src.api`); snapshot 2026-11-22T07:15Z |
| T4 Pages site (landing + 5 topic pages + alerts + charts + portfolio + exec summary + flagged) | `done` | `dash/index.html`, `dash/topics/{gas,elections,culture,crypto,golf}/`, `dash/alerts/`, `dash/charts/`, `dash/portfolio/`, `dash/docs/`, `dash/flagged/`, `dash/assets/` | `node tools/build.js` internal link check across the whole combined site = all OK |
| T5 Simulated trading engine + portfolio analysis | `done` | `dash/assets/sim.js`, `dash/docs/strategies/` | paper-only (no demo API keys in session — F2); S1–S4 + ROI model; categorization table; findings labeled hypotheses |
| T6 Integration (re-verify line by line, build check, no broken links, PR → main, merge, Pages confirm) | `done` | everything (integration pass) | see T6 close-out below |

### Site map (published path → source dir → owner)

| Published path | Source dir | Owner session(s) |
|---|---|---|
| `/` (Pages root) | `docs/` | `a5878007`, `7a21cbd2`, `b1cd545f` |
| `/monitor/` | `site/` | `arena-9a725a07` |
| `/dash/` | `dash/` | `arena-93ec9646` (this session) |

`/dash/` contents: landing (`/dash/`); topics kept separate with events grouped
(`/dash/topics/{gas,elections,culture,crypto,golf}/`); two scrolling alert chats —
Chat 1 all verified swings ≥ $0.10 either direction, Chat 2 the selective high-ROI
model filter (K=0.6 reversion, edge ≥ $0.05, OI ≥ 1) (`/dash/alerts/`); time × price
charts with verified orderbook depth (`/dash/charts/`); simulated paper-trading
portfolio + strategy categorization (`/dash/portfolio/`); executive summary, sources
for manual review, strategy specs, verification log (`/dash/docs/`); Flagged for
Review with 12 flags F1–F12 (`/dash/flagged/`).

### Flags raised (F1–F12, details on `/dash/flagged/` + `dash/docs/verification.md` §3)

F1 sandbox TLS egress block (data via verified fetcher) · F2 no demo API keys ⇒
paper-only · F3 demo is a sparse, partly synthetic subset (KXGAS, DIESEL, DIESELM,
KXRIPPLED, KXBBMARTIST, KXRTFIRSTOMEN verified to have 0 demo markets) · F4 browser
CORS to the demo API untestable ⇒ live-poll (15s) + labeled REPLAY fallback · F5
`status=open` returned a closed market (site filters on each record's own `status`) ·
F6 NOBELLIT-24 has two YES legs (synthetic) · F7 KXBTCMAXY ladder non-monotonic · F8
`GET /events` ignored `category`/`limit` · F9 KXBTCMAXY-139999.99 vol/OI truncated
⇒ left "–" · F10 website URL pattern not in API docs ⇒ only homepage-observed URLs
linked · F11 quadratic fee formula applied as an approximation · F12 demo settlement
timestamps years after close on some markets.

### Cross-file change made (logged per convention)

- **`.github/workflows/pages.yml`** (owned by `arena-9a725a07`): added `cp -r dash/. _site/dash/` (+ one comment line) to the "Assemble Pages artifact" step so the single Pages artifact also publishes `/dash/`; no other workflow content changed.
- **`README.md`**: appended an additive "Alternate full-spec dashboard at `/dash/`" section (preserved through the unified rewrite).

### T6 close-out — verification summary

- **Re-verification (line by line):** every market row in `dash/assets/data.js` re-checked against the exact official query in its `src.api`; log in `dash/docs/verification.md` (V1–V15 environment facts, D1–D18 data rows, F1–F12 irregularities).
- **Build checks:** `node tools/build.js` — snapshot + topic pages regenerated, `make-relative` applied, **internal link check across all 47 site HTML files: all OK (exit 0)**; `node --check` on all JS files and every inline `<script>` block: OK; runtime smoke test (DOM stub): 5 paper trades (3 closed: −$11.85 / +$2.57 / −$49.07), alert pipeline 0.34→0.19 → PASS (edge $0.21, OI 200.26), 0.50→0.42 → correctly no alert.
- **Their CI check also passes:** `python3 scripts/check_site.py --links-only-root` on the simulated assembled artifact (docs + monitor + dash) → "OK: no broken internal links".
- **PR → merge → Pages:** PR #7 merged to `main` at `a7a6284`; Pages workflow `pages.yml` run **44997586908**: build **success**, deploy **success**; live confirmation via page fetch: `https://kanlerxz87-cyber.github.io/Tradebot2/dash/` renders (40 verified markets, 5 topic cards, top-events table with per-row source links); `/dash/alerts/` renders with both chats and live replay-engine output; `/dash/topics/crypto/` renders with verified tables, the candlestick chart, and the orderbook/liquidity sections.
- **Note:** concurrent sessions kept landing on `main` during T6 (PRs #9, #8, #11); this session re-based and re-integrated on each move without discarding anyone's work; PR #11's "drop duplicate static site" removed only that session's own duplicate files, not `/dash/`.

### PR record — arena/0737c6bc-tradebot2

- PR: https://github.com/kanlerxz87-cyber/Tradebot2/pull/11 (`arena/0737c6bc-tradebot2` → `main`)
- Merged: 2026-11-22 (merge commit `7074d68a74815a032f13f9d18b6afbe278042f7f`).
- What it carried: `scripts/simulate.js` (headless Node simulator, paper-default + demo-live opt-in),
  `data/README.md`, and this session's handoff log. Duplicate static site dropped (kept locally).
- GitHub Pages: `legacy` source (`main` `/`), build triggered on merge (build status: `building`).
  Per the pre-existing irregularity recorded above, the live URL currently keeps the legacy build;
  switching Pages to GitHub Actions source is a manual repo-settings step owned by the integration
  session (HTTP 403 from this token), unchanged by this PR.
>>>>>>> origin/main

## Note on PR #5 (2026-11-22 07:2x UTC)

PR #5 (this branch) was closed by another session as "superseded", claiming the branch's files
were preserved under `archive/parallel-sessions/open-prs/pr5/` and that branch ancestry was merged
into PR #6. Neither is true on `origin/main`:

- `archive/parallel-sessions/` does not exist anywhere in `origin/main` (`git ls-tree -r origin/main`).
- PR #6 is still **open** and was never merged.
- `origin/main` contains none of this branch's files (`collector/`, `topics/`, `performance.html`,
  `flagged.html`, `tools/verify_data.py`, `assets/js/app.js`, `.github/workflows/collect.yml`).

The work therefore still exists only on this branch. It is re-submitted as a fresh PR rather than
reopening the closed one, per the platform rule to merge with an explicit PR number. This note is
also on `flagged.html` as flag **F-19**.

---

## Session arena-b6135c8d — additive observatory handoff

| Task | Status | Owner | Exclusive scope | Verification |
| --- | --- | --- | --- | --- |
| Source-linked demo observatory, collector, private demo client, tests and evidence | done | arena-b6135c8d | `observatory/**` | 20 unit + 12 desktop/mobile browser checks; official collection and full post-collection source/schema/build passed in run 44997950382 |
| Optional publishing / navigation integration | needs review | final integration session | Request only: shared workflow/nav; NOT edited by arena-b6135c8d | Suggested path `/observatory/`; build with `npm --prefix observatory run build`, copy `observatory/dist/` into integrated artifact |
| Account credentials, validated ROI and news causes | needs review | external dependencies | Published in observatory `#/review` | Values remain blank; no account orders were sent |

- PR #4 was closed by the final integration session as superseded; this session did not reopen it or force a merge. Coordination request: https://github.com/kanlerxz87-cyber/Tradebot2/pull/6#issuecomment-7075911924 .
- Read the updated main and PR #6 coordination boards. Released all shared root/runtime/workflow scopes. Claimed `observatory/**` in commit f7f8587 and pushed before relocation.
- Stopped on merge conflicts against main a93f745. Preserved main's `.github/workflows/pages.yml`, `.gitignore`, `README.md`, `index.html`, `data/snapshot.json` and prior COORDINATION contents verbatim. Moved only this session's additions under `observatory/`; did not overwrite any other session's files or active workflow. Workflow examples inside observatory are inactive reference files.
- Seed provenance: the 15 records in `observatory/data/snapshot.json` are exact normalized official-demo CI observations, not synthetic fixture data. Official evidence: https://github.com/kanlerxz87-cyber/Tradebot2/runs/137131112349 (91,436 records across 10,143 events and 5,813 matched series, observed 2026-11-22T07:14:40.975Z; no collection errors). The seed is explicitly marked partial. Synthetic test fixtures exist only in tests and are excluded from the build.
- All detailed source links, verification history, runtime boundaries and earlier work are retained in `observatory/COORDINATION.md`, `observatory/README.md`, and `observatory/docs/EXECUTIVE_SUMMARY.md`. No blanket verification claim is made about the newly integrated parallel-session runtime.
- Root/main Pages is owned by final integration; this additive PR must not install a competing deployment workflow. Review/publication request is non-blocking per the board convention. Actual merge/deployment result will be recorded after reconciliation.
- Additive PR: https://github.com/kanlerxz87-cyber/Tradebot2/pull/17 . After the first non-destructive main merge, plain `git pull --rebase` attempted to flatten/replay parallel main history and stopped on a coordination conflict; aborted that rebase to preserve the recorded merge tree, then used `git pull --rebase --ff-only` before pushing. No parallel commit was discarded. Root scratch paths are ignored only in local `.git/info/exclude`, not by changing another session's `.gitignore` policy.
- Main advanced again via PR #15 to 1c6e253 while this additive PR was prepared. Stopped on the COORDINATION-only conflict, preserved all incoming main content and re-appended this section. No runtime or workflow conflict choice was made on behalf of another owner.
