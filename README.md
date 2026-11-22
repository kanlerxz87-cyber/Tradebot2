# Tradebot2 — Kalshi demo live dashboard, alerting, and paper-trading lab

**Live site:** <https://kanlerxz87-cyber.github.io/Tradebot2/>
(site is served from this repository; see *Publishing* below)

This repository tracks Kalshi **demo** markets in five topics — gas prices, elections,
culture, crypto and golf — ranks them by traded dollar volume, alerts on every contract move
of **$0.10 or more** in either direction, follows each market until it resolves, and runs
five simulated strategies whose results are broken down by trade type.

Every published row links to the exact official Kalshi endpoint it was read from. If a value
could not be confirmed it is left blank and listed on the
[Flagged for Review](flagged.html) page. Nothing on the site is filled in by inference.

> **Demo warning, from Kalshi's own documentation:** "The price and behavior of markets in
> the demo environment may not be reflective of those in real markets."
> (<https://docs.kalshi.com/getting_started/demo_env>). Every number here is a demo number.

---

## Repo review (task: review the repo line by line)

Reviewed at the commit this branch started from, `003447e`.

| # | Finding | Evidence | Action taken |
| --- | --- | --- | --- |
| 1 | The repository contained exactly one file: `README.md` with the single line `# Tradebot2`. No code, no CI, no license, no data. | `git ls-tree -r 003447e` | Recording it here; this branch is additive. |
| 2 | GitHub Pages was already enabled on `main` (path `/`, legacy build) and served an empty site. | `GET /repos/kanlerxz87-cyber/Tradebot2/pages` → `"status": "built"`, `"source": {"branch": "main", "path": "/"}` | Publishing is wired to this branch's content and verified after merge. |
| 3 | No `COORDINATION.md` existed, although the brief requires parallel-session coordination. | file listing at `003447e` | Created in the first commit of this branch, before any other work. |
| 4 | No license file. | file listing | Left as-is — choosing a license is the owner's decision, not an agent's. |
| 5 | The build sandbox has **no network route to `*.kalshi.co`**: DNS resolves, TLS is closed (`SSLZeroReturnError`). | `curl`/`requests` attempts fail identically to all demo hosts | All live collection runs on GitHub Actions instead (`.github/workflows/collect.yml`, `probe-api.yml`); documented as flag **F-01**. |

While reviewing, three earlier sessions had already merged work into `main`
(PRs #1, #2, #3). That work is preserved unchanged and linked from the dashboard. Reviewing
it surfaced three irregularities that are published as flags **F-15**, **F-16** and **F-17**:

- `js/data.js` (used by the earlier pages) contains hand-built sample contracts — tickers such
  as `GAS-24DEC-3.15`, `PRES-24-DJT`, `OSCAR-BESTPIC-25` — presented as verified data, with
  round-number order books. The Kalshi markets endpoint does not return prices for unknown
  tickers, and those tickers are not in the demo series list.
- The earlier README names `https://trading-api.kalshi.com/trade-api/v2` as the production
  API. The official documentation lists `https://external-api.kalshi.com/trade-api/v2` and
  `https://api.elections.kalshi.com/trade-api/v2`
  (<https://docs.kalshi.com/getting_started/api_environments>). A live check of the documented
  production host on 2026-11-22 returned `exchange_active: true`; `trading-api.kalshi.com` did
  not return a page.
- The earlier gas tables cite EIA / "Rulebook Rule 502" as the settlement source. The series
  object Kalshi returns for a gas market lists **AAA** (`https://gasprices.aaa.com`) as the
  settlement source (`GET /series/KXAAAGASD`).

---

## What is implemented

| Area | Where | Notes |
| --- | --- | --- |
| Topic selection | `collector/topics.py` | Rules match official series `category` / `categories` / `tags` only; explicit exclusions are recorded with reasons. |
| Collection | `collector/collect.py` | Series → open events → markets → order books → history, every record carrying its request URL. |
| Swing alerts ≥ $0.10 | `collector/alerts.py` | Absolute move over a snapshot window, with a retrace-based re-arm so a sustained jump alerts once. |
| Two chat feeds | `index.html`, `assets/js/app.js` | All-events feed and high-ROI feed (ROI on risk ≥ 25%, entry $0.10–$0.90). |
| Charts | `assets/js/chart.js` | x = UTC time with 1m/5m/30m/1h/6h/24h ranges, y = $0.00–$1.00, bid/ask band, swing dots. |
| Liquidity | `collector/collect.py` `capture_orderbook` | Contracts and dollars available at each price level, both sides. |
| Resolutions | `collector/resolutions.py` | `result` copied from the exchange; only `yes`/`no` counts as resolved. |
| Simulated strategies | `collector/strategy.py`, `collector/trading.py` | Five rules, fixed sizes, official fee model, settled from the exchange's own result. |
| Analytics | `data/analytics.json`, `performance.html` | P&L, win rate, ROI by strategy, topic and side. |
| Demo execution | `collector/kalshi_auth.py`, `tools/execute_demo_order.py` | Signed `POST /portfolio/events/orders`; needs repository secrets (flag **F-05**). |
| Verification | `tools/verify_data.py`, `tools/check_site.py`, `tests/**` | CI fails on a missing source link, a broken internal link, or a regression in the fee/alert/settlement math. |

## Verification status

- **Fee model** reproduces all 42 values of Kalshi's published fee table
  (`tests/test_fees.py`, source: <https://kalshi.com/docs/kalshi-fee-schedule.pdf>).
- **Alert threshold** is tested at exactly $0.10, below it, in both directions, under a
  sustained move, and across a retrace (`tests/test_engine.py`).
- **Settlement arithmetic** is tested for YES and NO outcomes on both sides
  (`tests/test_engine.py`), against the documented $1.00-per-contract payout
  (<https://docs.kalshi.com/getting_started/market_settlement>).
- **API behaviour** (CORS, signed preflight, WebSocket handshake) is measured by
  `tools/probe_api.py` in CI and stored in `data/verify-api.json`; the file carries a
  `status` field, so an unmeasured claim is visible as such rather than implied.

## Run it locally

```bash
pip install -r requirements.txt
python tests/test_fees.py && python tests/test_engine.py && python tests/test_pipeline.py
python tests/run_fixture_pipeline.py          # full pipeline, offline fixtures
python collector/run.py --data-dir data       # one live cycle (needs network to Kalshi)
python tools/verify_data.py --data-dir data
python tools/check_site.py --root .
```

## Publishing

The site is static and lives at the repository root. `.github/workflows/pages.yml` deploys it.
`.github/workflows/collect.yml` refreshes `data/` every five minutes and commits the result;
`.github/workflows/verify.yml` re-runs every check on each push.

## Documentation

- [Executive summary](docs/EXECUTIVE_SUMMARY.md)
- [Requirements register](requirements.html) · machine-readable: `data/requirements.json`
- [Sources and evidence](sources.html) · `data/sources.json`
- [Flagged for review](flagged.html) · `data/flags.json`
- [Interaction suggestions](docs/IMPROVEMENTS.md)
- [Coordination board](COORDINATION.md)
