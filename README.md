# Tradebot2 — Kalshi demo live dashboard, ≥ $0.10 alerting, and a paper-trading lab

**Live site:** <https://kanlerxz87-cyber.github.io/Tradebot2/>

The repository tracks Kalshi **demo** markets in five topics — gas prices, elections, culture,
crypto and golf — ranks them by traded dollar volume, alerts on every contract move of
**$0.10 or more** in either direction, follows every market until it resolves, and runs five
simulated strategies whose results are broken down by trade type.

Every published row links to the exact official Kalshi endpoint it was read from. If a value
cannot be confirmed, the cell is left blank and marked **unverified** rather than filled in.
Nothing on the site is invented: the empty tables you may see on a fresh deployment mean the
first GitHub Actions cycle has not run yet, not that sample data was substituted.

## What each requirement maps to

| Requirement | Where it lives | How |
| --- | --- | --- |
| Five topics only | `collector/topics.py` | Series are matched on Kalshi's official `category` / `categories` / `tags` fields. Crude-oil series share the gas tags and are excluded explicitly (flag **F-08**). |
| Highest traded dollar volume | `collector/collect.py` `rank_markets` | `volume_24h_fp` × last price; the estimate is labelled as an estimate on the page (flag **F-07**). |
| Swing alerts ≥ $0.10 | `collector/alerts.py` | Absolute move over a snapshot window, with a retrace-based re-arm so a sustained jump alerts once. |
| Two chat feeds | `index.html`, `assets/js/app.js` | An all-events feed and a high-ROI feed (ROI on risk ≥ 25 %, entry $0.10–$0.90). |
| Charts | `assets/js/chart.js` | x = UTC time with 1 m / 5 m / 30 m / 1 h / 6 h / 24 h ranges, y = $0.00–$1.00, bid/ask band, swing markers. |
| Liquidity | `collector/collect.py` `capture_orderbook` | Contracts and dollars available at each price level, both sides. |
| Resolutions | `collector/resolutions.py` | `result` copied from the exchange; only `yes`/`no` counts as resolved. |
| Simulated strategies | `collector/strategy.py`, `collector/trading.py` | Five rules, fixed sizes, the official fee model, settled from the exchange's own result. |
| Analytics | `data/analytics.json`, `performance.html` | P&L, win rate and ROI by strategy, topic and side. |
| Demo execution | `collector/kalshi_auth.py`, `tools/execute_demo_order.py` | Signed `POST /portfolio/events/orders`; needs repository secrets (flag **F-05**). |
| Verification | `tools/verify_data.py`, `tools/check_site.py`, `tests/**` | CI fails on a missing source link, a broken internal link, or a regression in the fee / alert / settlement math. |

## Live GitHub Pages site

| Path | Built from | Session | Contents |
| --- | --- | --- | --- |
| `/` | repo root | `arena-1546d2b0` | Dashboard, five topic pages, performance, resolutions, requirements, sources, flagged |
| `/pages/` | `pages/` | `arena-4f9ce955` | Its topic subpages, portfolio/strategy lab, API reference, flagged page |
| `/docs/` | `docs/` | earliest sessions | First-pass dashboard, kept verbatim |
| `/monitor/` | `site/` | `arena-9a725a07` | Live monitor with its own collector |
| `/dash/` | `dash/` | `arena-93ec9646` | Full-spec dashboard from PR #7 |

Root pages:

| Page | Purpose |
| --- | --- |
| [`index.html`](index.html) | Dashboard: two alert chats, KPI strip, chart with liquidity depth, per-topic tables |
| [`topics/gas.html`](topics/gas.html) · [`elections`](topics/elections.html) · [`culture`](topics/culture.html) · [`crypto`](topics/crypto.html) · [`golf`](topics/golf.html) | One page per topic, events grouped inside, chart + order book per market |
| [`performance.html`](performance.html) | Simulated portfolio: P&L by strategy, topic and side; fee card; demo-account panel |
| [`resolutions.html`](resolutions.html) | Every tracked market and its recorded yes/no result, with settlement value and source |
| [`requirements.html`](requirements.html) | All 23 requirements with status, evidence and the official source |
| [`sources.html`](sources.html) | Docs and captured evidence, with what each one supports |
| [`flagged.html`](flagged.html) | **Flagged for Review** — every irregularity and unverified value, linked to a source |
| [`strategies.html`](strategies.html) · [`review.html`](review.html) | First-pass strategy and review pages from the earliest sessions, preserved |

## Verified Kalshi demo endpoints

Per the official [API environments](https://docs.kalshi.com/getting_started/api_environments)
and [demo environment](https://docs.kalshi.com/getting_started/demo_env) pages:

| Surface | Demo host |
| --- | --- |
| REST | `https://external-api.demo.kalshi.co/trade-api/v2` (also documented: `https://demo-api.kalshi.co/trade-api/v2`) |
| WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` |
| Demo portal | `https://demo.kalshi.co/` |

Production is `https://external-api.kalshi.com/trade-api/v2`; a live check on 2026-11-22
returned `exchange_active: true` (recorded in `data/sources.json`).

`https://trading-api.kalshi.com/trade-api/v2`, cited by earlier sessions, is **not** in the
official list — see flag **F-16**.

## Verification status

- **Fee model** reproduces all 42 values of Kalshi's published fee table
  (`tests/test_fees.py`; source: <https://kalshi.com/docs/kalshi-fee-schedule.pdf>).
- **Alert threshold** is tested at exactly $0.10, below it, in both directions, under a
  sustained move, and across a retrace (`tests/test_engine.py`).
- **Settlement arithmetic** is tested for YES and NO outcomes on both sides
  (`tests/test_engine.py`), against the documented $1.00-per-contract payout
  (<https://docs.kalshi.com/getting_started/market_settlement>).
- **API behaviour** (CORS, signed preflight, WebSocket handshake) is measured by
  `tools/probe_api.py` in CI and stored in `data/verify-api.json`; the file carries a `status`
  field, so an unmeasured claim is visible as such rather than implied.
- **Data integrity** — every published row needs a source; `tools/verify_data.py` fails the
  build otherwise, and `tools/check_site.py` fails on broken internal links.

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
| The repository started as a single one-line `README.md` at `003447e`: no code, no site, no CI, no licence | `git show 003447e --stat` | Fixed by this branch and the parallel sessions |
| Pages was enabled serving `main` at `/` with no content | repo settings, `gh api repos/.../pages` | Fixed: `pages.yml` now builds one artifact from the repo |
| No `COORDINATION.md` existed, so the parallel-session protocol was unimplemented | `git ls-tree 003447e` | Fixed: board created and maintained |
| Earlier sessions' `js/data.js` contains hand-written contracts (`GAS-24DEC-3.15`, `PRES-24-DJT`) presented as verified | file itself | **Flagged F-15**, quarantined, not deleted |
| Earlier sessions cited `trading-api.kalshi.com`, absent from the official environments page | docs page | **Flagged F-16** (resolved: correct hosts documented above) |
| An earlier page says gas markets settle on EIA data; the exchange's own series object names **AAA** (`gasprices.aaa.com`) | `/series/KXAAAGASD` | **Flagged F-17** |
| Two dashboards were published from different branches with no index tying them together | repo tree | **Flagged F-18**, resolved by the shared Pages assembly and this README table |
| The build sandbox has no network route to `*.kalshi.co` (`SSLZeroReturnError`) | `data/verify-api.json` | **Flagged F-01**; all collection runs in GitHub Actions |

## Documentation

- [Executive summary](docs/EXECUTIVE_SUMMARY.md)
- [Requirements register](requirements.html) · machine-readable `data/requirements.json`
- [Sources and evidence](sources.html) · `data/sources.json`
- [Flagged for review](flagged.html) · `data/flags.json`
- [Interaction suggestions](docs/IMPROVEMENTS.md)
- [Coordination board](COORDINATION.md) · preserved upstream boards in `docs/coordination/`

## Parallel sessions, preserved

Other sessions' pages are kept and linked, never deleted. Their own documented limits still
apply to their pages:

- Trades on `/monitor/` are simulated; fees are not modelled there and no orders are placed.
- The demo-account portfolio is not connected there; it needs API-key secrets.
- `/monitor/` alerts compare snapshots from consecutive scheduled runs (about 15 minutes
  apart), not per-second ticks.
- Its high-ROI screen is a rule set, not a validated model.

This branch's own pipeline *does* model fees using the official schedule, and that is what
`tests/test_fees.py` checks.
