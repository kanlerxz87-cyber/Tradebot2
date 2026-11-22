# Tradebot2 — Kalshi demo dashboard, ≥ $0.10 alerting, and a paper-trading lab

**Live site:** <https://kanlerxz87-cyber.github.io/Tradebot2/>

Five topics only — gas prices, elections, culture, crypto, golf. Markets are ranked by traded
dollar volume, every contract move of **$0.10 or more** in either direction is alerted, every
market is followed until it resolves, and five simulated strategies are tracked and broken
down by trade type.

Every published row links to the official Kalshi endpoint it came from. A value that cannot be
confirmed is left blank and marked **unverified** rather than guessed. If the tables look empty
on a fresh deployment, that means no collection cycle has run yet — sample data is never
substituted.

## Published site

One Pages artifact, built by `.github/workflows/pages.yml`, publishes every session's tree:

| Path | Source | Owner | Contents |
| --- | --- | --- | --- |
| `/` | repo root | `arena-1546d2b0` | Dashboard, five topic pages, performance, resolutions, requirements, sources, flagged |
| `/earlier-dashboard.html` | repo root | earliest sessions | Their dashboard, preserved verbatim |
| `/pages/` | `pages/` | `arena-4f9ce955` | Topic subpages, portfolio/strategy lab, API reference, flagged page |
| `/docs/` | `docs/` | earliest sessions | First-pass dashboard and docs |
| `/monitor/` | `site/` | `arena-9a725a07` | Live monitor with its own collector |
| `/dash/` | `dash/` | `arena-93ec9646` | Full-spec dashboard from PR #7 |

Root pages:

| Page | Purpose |
| --- | --- |
| [`index.html`](index.html) | Two alert chats, KPI strip, chart with liquidity depth, per-topic tables |
| [`topics/gas.html`](topics/gas.html) · [elections](topics/elections.html) · [culture](topics/culture.html) · [crypto](topics/crypto.html) · [golf](topics/golf.html) | One page per topic; events grouped inside; chart + order book per market |
| [`performance.html`](performance.html) | Simulated portfolio: P&L by strategy, topic and side; fee card; demo-account panel |
| [`resolutions.html`](resolutions.html) | Every tracked market and its yes/no result, with settlement value and source |
| [`requirements.html`](requirements.html) | All 23 requirements with status, evidence and official source |
| [`sources.html`](sources.html) | Docs and captured evidence, with what each one supports |
| [`flagged.html`](flagged.html) | **Flagged for Review** — every irregularity and unverified value, with a source link |

## What each requirement maps to

| Requirement | Where it lives | How |
| --- | --- | --- |
| Five topics only | `collector/topics.py` | Series matched on official `category` / `categories` / `tags`. Crude-oil series share the gas tags and are excluded explicitly (flag **F-08**). |
| Highest traded dollar volume | `collector/collect.py` `rank_markets` | `volume_24h_fp` × last price; labelled an estimate on the page (flag **F-07**). |
| Swing alerts ≥ $0.10 | `collector/alerts.py` | Absolute move over a snapshot window, with a retrace-based re-arm so a sustained jump alerts once. |
| Two chat feeds | `index.html`, `assets/js/app.js` | All-events feed, plus a high-ROI feed (ROI on risk ≥ 25 %, entry $0.10–$0.90). |
| Charts | `assets/js/chart.js` | x = UTC time, 1 m / 5 m / 30 m / 1 h / 6 h / 24 h; y = $0.00–$1.00; bid/ask band; swing markers. |
| Liquidity | `collector/collect.py` `capture_orderbook` | Contracts and dollars at each price level, both sides. |
| Resolutions | `collector/resolutions.py` | `result` copied from the exchange; only `yes`/`no` counts as resolved. |
| Simulated strategies | `collector/strategy.py`, `collector/trading.py` | Five rules, fixed sizes, official fee model, settled from the exchange's result. |
| Analytics | `data/analytics.json`, `performance.html` | P&L, win rate and ROI by strategy, topic and side. |
| Demo execution | `collector/kalshi_auth.py`, `tools/execute_demo_order.py` | Signed `POST /portfolio/events/orders`; needs repository secrets (flag **F-05**). |
| Verification | `tools/verify_data.py`, `tools/check_site.py`, `tests/**` | CI fails on a missing source link, a broken internal link, or a regression in the fee / alert / settlement math. |

## Verified Kalshi demo endpoints

Per the official [API environments](https://docs.kalshi.com/getting_started/api_environments)
and [demo environment](https://docs.kalshi.com/getting_started/demo_env) pages:

| Surface | Demo host |
| --- | --- |
| REST | `https://external-api.demo.kalshi.co/trade-api/v2` (also documented: `https://demo-api.kalshi.co/trade-api/v2`) |
| WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` |
| Demo portal | `https://demo.kalshi.co/` |

Production is `https://external-api.kalshi.com/trade-api/v2`; a live check on 2026-11-22 returned
`exchange_active: true` (recorded in `data/sources.json`). `https://trading-api.kalshi.com/...`,
cited by earlier sessions, is **not** in the official list — see flag **F-16**.

## Verification status

- **Fee model** reproduces all 42 values of the published fee table (`tests/test_fees.py`;
  <https://kalshi.com/docs/kalshi-fee-schedule.pdf>).
- **Alert threshold** tested at exactly $0.10, below it, both directions, sustained move, retrace
  (`tests/test_engine.py`).
- **Settlement arithmetic** tested for YES/NO on both sides against the documented $1.00 payout
  (<https://docs.kalshi.com/getting_started/market_settlement>).
- **API behaviour** (CORS, signed preflight, WS handshake) measured by `tools/probe_api.py` in CI
  and stored in `data/verify-api.json`, which carries a `status` field so an unmeasured claim is
  visible as such.
- **Data integrity** — `tools/verify_data.py` fails the build if a published row lacks a source;
  `tools/check_site.py` fails on broken internal links.

## Run it locally

```bash
pip install -r requirements.txt
python3 tests/test_fees.py && python3 tests/test_engine.py && python3 tests/test_pipeline.py
python3 tests/run_fixture_pipeline.py        # whole pipeline offline, on fixtures
python3 collector/run.py --data-dir data     # one live cycle (needs network to Kalshi)
python3 tools/verify_data.py --data-dir data
python3 tools/check_site.py --root .
python3 -m http.server 8080                  # then open http://localhost:8080
```

## Repo review (line by line, against official sources)

| Finding | Evidence | Status |
| --- | --- | --- |
| Repository started as a one-line `README.md` at `003447e`: no code, no site, no CI, no licence | `git show 003447e --stat` | Fixed by this branch and the parallel sessions |
| Pages was enabled serving `main` at `/` with no content | `gh api repos/.../pages` | Fixed: `pages.yml` builds one artifact from the repo |
| No `COORDINATION.md` existed, so the parallel-session protocol was unimplemented | `git ls-tree 003447e` | Fixed: board created and maintained |
| `js/data.js` contains hand-written contracts (`GAS-24DEC-3.15`, `PRES-24-DJT`) presented as verified | the file itself | **Flagged F-15**, quarantined and preserved at `earlier-dashboard.html`, not deleted |
| Earlier sessions cited `trading-api.kalshi.com`, absent from the official environments page | docs page | **Flagged F-16**; correct hosts documented above |
| An earlier page says gas markets settle on EIA data; the exchange's series object names **AAA** (`gasprices.aaa.com`) | `GET /series/KXAAAGASD` | **Flagged F-17** |
| Two dashboards published from different branches with no index tying them together | repo tree | **Flagged F-18**; resolved by the shared Pages assembly and the site table above |
| Build sandbox has no network route to `*.kalshi.co` (`SSLZeroReturnError`) | `data/verify-api.json` | **Flagged F-01**; collection runs in GitHub Actions |
| Intermediate integration commits deleted 22 files from a parallel session | `git diff --diff-filter=D` | Restored in this branch's merge; no session's work is discarded |

## Repository layout

| Path | What it is |
| --- | --- |
| `collector/` | `kalshi.py` (client), `topics.py` (5-topic matching), `collect.py`, `alerts.py`, `strategy.py`, `trading.py`, `resolutions.py`, `kalshi_auth.py`, `run.py` |
| `tools/` | `verify_data.py`, `check_site.py`, `probe_api.py`, `execute_demo_order.py` |
| `tests/` | `test_fees.py` (42), `test_engine.py` (14), `test_pipeline.py` (4), `run_fixture_pipeline.py`, `fixtures/` |
| `data/` | Published datasets: markets, events, series, order books, alerts, resolutions, paper trades, analytics, portfolio, requirements, sources, flags, `verify-api.json` |
| `assets/` | `css/site.css`, `js/{util,chart,app,topic,performance,requirements}.js` |
| `.github/workflows/` | `collect.yml` (5-min cycle), `verify.yml` (all checks), `probe-api.yml` (6-hourly), `execute-demo.yml` (manual order), `pages.yml` (deploy) |
| `docs/` | `EXECUTIVE_SUMMARY.md`, `IMPROVEMENTS.md`, `coordination/` (preserved boards), plus the first-pass dashboard |
| `scripts/`, `site/`, `dash/`, `pages/` | Parallel sessions' collectors, sites and pages — kept and published |

## Documentation

- [Executive summary](docs/EXECUTIVE_SUMMARY.md)
- [Requirements register](requirements.html) · machine-readable `data/requirements.json`
- [Sources and evidence](sources.html) · `data/sources.json`
- [Flagged for review](flagged.html) · `data/flags.json`
- [Interaction suggestions](docs/IMPROVEMENTS.md)
- [Coordination board](COORDINATION.md) · preserved upstream boards in `docs/coordination/`

Verified data snapshot (machine-readable): `data/snapshot.json`. Line-by-line
verification log: `dash/docs/verification.md`. Regenerate topic pages + run the
whole-site link check with `node tools/build.js`.


---

## 📍 Independent dashboard at `/kalshi-demo/` (not yet on the Pages artifact)

A third, independently-built, interactive dashboard lives at **`kalshi-demo/`**
(branch `arena/5f1ca159-tradebot2`, PR #10). It is additive — no other session's
pages are modified.

- **Landing**: `/kalshi-demo/`
- **Live dashboard** (highest-dollar events, 30s/1m/5m/1h/24h chart, orderbook depth, all-alerts chat + High-ROI chat, 3 simulated strategies, portfolio summary, resolution feed): `/kalshi-demo/dashboard.html`
- **Topic subpages** (separate, events grouped inside each topic): `/kalshi-demo/topics/{gas,elections,culture,crypto,golf}.html`
- **Methodology**: `/kalshi-demo/methodology.html` · **Flagged for Review**: `/kalshi-demo/flagged-for-review.html`

It is **not published** — the repo's Pages pipeline (`.github/workflows/pages.yml`,
owned by `arena-9a725a07`) assembles `docs/`, `site/` and `dash/` only. The
cross-file change is requested here: add `kalshi-demo/` to the "Assemble Pages
artifact" step so the sub-site publishes at `/kalshi-demo/`. See the flagged page
for every unverified item (F1–F12) in this sub-site.

## Parallel sessions, preserved

Other sessions' pages are kept and linked, never deleted. Their own documented limits still
apply to their pages:

- Trades on `/monitor/` are simulated; fees are not modelled there and no orders are placed.
- The demo-account portfolio is not connected there; it needs API-key secrets.
- `/monitor/` alerts compare snapshots from consecutive scheduled runs (about 15 minutes apart).
- Its high-ROI screen is a rule set, not a validated model.

This branch's own pipeline *does* model fees using the official schedule, and that is what
`tests/test_fees.py` checks.
