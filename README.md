# Tradebot2 — a Kalshi **demo** live-event desk

> ### ⚠️ Start here: the verified live dashboard is [`/live/`](live/index.html)
>
> This repository accumulated several dashboards from parallel sessions. **Only `/live/` is a verified
> live dashboard**: it reads the official Kalshi demo API in your browser, links every table row to the
> exact endpoint behind it, and shows “—” where the API returned nothing.
>
> An earlier generation of the root pages showed **fabricated** markets (ticker symbols that do not exist
> in the API) with invented news “catalysts” and a P&L built on them. That is fully documented, with
> sources, on [`live/flagged.html`](live/flagged.html) (item F-01). The older pages in `docs/`, `dash/`,
> `site/`, `pages/` and the root topic files are kept for the audit trail and are not the source of truth.
>
> Also fixed in this pass: `.github/workflows/pages.yml` contained a YAML syntax error (an unquoted colon
> in a step name) which made GitHub refuse to start the workflow — every push produced a failed run with
> zero jobs. See `COORDINATION.md` § “A2”.
>
> **Verified endpoints** (docs.kalshi.com/getting_started/api_environments):
> demo REST `https://external-api.demo.kalshi.co/trade-api/v2` · demo REST (alt) `https://demo-api.kalshi.co/trade-api/v2`
> · demo WS `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` · production REST `https://external-api.kalshi.com/trade-api/v2`.
> The `trading-api.kalshi.com` documentation URL used further down is **not** in the current official list (flag F-15).

> **Canonical site: https://kanlerxz87-cyber.github.io/Tradebot2/**
>
> The published entry point is the root `index.html` (GitHub Pages is configured as
> `build_type: legacy`, source `main:/`). Start with the
> [overview](index.html), then the [live dashboard](dashboard.html),
> [portfolio](portfolio.html), [executive summary](executive-summary.html),
> [method](methodology.html) and [flagged register](flagged.html).
>
> Archived generations are retained, not maintained: [`docs/`](docs/index.html)
> (first site) and [`site/`](site/index.html) (monitor prototype). Values on those
> pages are historical; see [`flagged.html`](flagged.html).

A focused desk for five topics only — **gas prices, elections, culture, crypto and golf**. It ranks live events by flow,
alerts on contract moves of **$0.10 or more in either direction** in two scrolling feeds, charts price against time, shows the
resting order book, paper-trades the alerts, and follows each event to its **YES/NO** resolution.

Every table row links to the Kalshi API record that produced it. Anything the API did not return is blank and flagged, never
filled in.

---

## Read the site in this order

| Page | What it answers |
|---|---|
| [`index.html`](https://kanlerxz87-cyber.github.io/Tradebot2/) | Overview, system status, tracked-market counts, latest swings |
| [`dashboard.html`](https://kanlerxz87-cyber.github.io/Tradebot2/dashboard.html) | Live dashboard: chat feeds, chart, depth, paper broker |
| [`gas-prices.html`](https://kanlerxz87-cyber.github.io/Tradebot2/gas-prices.html) · [`elections.html`](https://kanlerxz87-cyber.github.io/Tradebot2/elections.html) · [`culture.html`](https://kanlerxz87-cyber.github.io/Tradebot2/culture.html) · [`crypto.html`](https://kanlerxz87-cyber.github.io/Tradebot2/crypto.html) · [`golf.html`](https://kanlerxz87-cyber.github.io/Tradebot2/golf.html) | One topic per page, events grouped, resolution log, settlement sources |
| [`portfolio.html`](https://kanlerxz87-cyber.github.io/Tradebot2/portfolio.html) | Paper portfolio, strategy/topic/side analytics |
| [`executive-summary.html`](https://kanlerxz87-cyber.github.io/Tradebot2/executive-summary.html) | The one-page summary |
| [`methodology.html`](https://kanlerxz87-cyber.github.io/Tradebot2/methodology.html) | How every number is produced, with formulas |
| [`sources.html`](https://kanlerxz87-cyber.github.io/Tradebot2/sources.html) | Official pages and live endpoints used |
| [`flagged.html`](https://kanlerxz87-cyber.github.io/Tradebot2/flagged.html) | Unverified items, assumptions and corrected defects (F-01 …) |
| [`suggestions.html`](https://kanlerxz87-cyber.github.io/Tradebot2/suggestions.html) | What would make the desk more live |

---

## Documented endpoints

| Surface | Endpoint | Documentation |
|---|---|---|
| REST (demo, recommended) | `https://external-api.demo.kalshi.co/trade-api/v2` | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) · [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| REST (demo, also supported) | `https://demo-api.kalshi.co/trade-api/v2` | same |
| WebSocket (demo, recommended) | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | same |
| WebSocket (demo, also supported) | `wss://demo-api.kalshi.co/trade-api/ws/v2` | same |
| REST (production, not used here) | `https://external-api.kalshi.com/trade-api/v2` | same |

Kalshi documents that demo funds are mock funds, that demo credentials are separate from production, and that demo prices and
behaviour *may not be reflective of those in real markets*. The WebSocket API requires an authenticated (signed) handshake even
for public channels; the unauthenticated handshake was measured and rejected with HTTP 401 (`data/probe.json`).

Browser reads of the demo REST API **are** allowed for this site's origin: CI measured
`Access-Control-Allow-Origin: https://kanlerxz87-cyber.github.io` on a GET and a 204 preflight (`data/probe.json`).

---

## How it works

```
GitHub Actions
  data.yml   (daily + on demand)  tools/build_snapshot.py  → data/snapshot.json, data/probe.json, analytics
  collect.yml (every 5 min)       collector/run.py         → data/markets.json, alerts.json, orderbooks.json,
                                                              resolutions.json, paper_trades.json, analytics.json
  pages.yml  (push/PR)            verifies the published contract (13 canonical pages, links, markers, data files)
GitHub Pages (legacy, main:/)     serves the repository root — index.html and its assets/
```

The front end reads the committed JSON in `data/` and, where the API allows it, polls the demo REST API for live quotes
(`assets/js/live.js`), falling back to the snapshot with an explicit status when a request fails. Nothing is invented when a
request fails.

* **Alert rule:** a market's YES price moves **≥ $0.10** in either direction. Feed 1 = all swings; feed 2 = the model's
  high-ROI subset. The model feed is a published rule set, not a trained, back-tested edge (`methodology.html#model`).
* **Cause of a move** is never asserted. Kalshi's API reports prices and trades; settlement sources are reference links only.
* **Paper trading:** simulated fills, fees modelled as documented on `methodology.html#paper`; settlement values come from the
  API `result` field. This is **not** the demo account — see F-01.
* **Resolution:** `GET /markets/{ticker}` → `result` = `yes` / `no`; blank until Kalshi reports it.

---

## Repository layout (canonical parts)

```
index.html, dashboard.html, gas-prices.html, elections.html, culture.html, crypto.html, golf.html,
portfolio.html, executive-summary.html, methodology.html, sources.html, flagged.html, suggestions.html
assets/css/…            stylesheets for the canonical pages
assets/js/…             core.js, common.js, live.js (Kalshi polls + fallback), home.js, dashboard.js,
                        category.js, portfolio.js, pages.js, chart.js
collector/              the scheduled collector: kalshi.py, collect.py, alerts.py, resolutions.py,
                        trading.py, strategy.py, run.py
app/                    typed model/backtest/server modules used by the data builder and tests
tools/                  build_snapshot.py, check_site.py, verify_data.py, probe.py, build_category_pages.py
data/                   published JSON: markets, alerts, orderbooks, resolutions, paper trades, analytics,
                        meta, flags, sources, requirements, probe (+ snapshot.json for the archived builds)
tests/                  unit tests, including request signing
```

Archived generations are kept for review and are **not** maintained: `docs/` (first site), `site/` (monitor prototype),
`dash/`, `pages/`, `topics/`, `observatory/`, `main-site-index.html`, `main-site-flagged.html`, `earlier-dashboard.html`.
Their snapshots are frozen; see `flagged.html`.

---

## Run it locally

```bash
pip install -r requirements.txt            # collector + tests
python3 collector/run.py --data-dir data   # needs network access to *.kalshi.co
python3 tools/check_site.py --root . --strict
python3 tools/verify_data.py --data-dir data
python3 -m pytest -q
python3 -m http.server 8000                # then open http://localhost:8000/
```

The site is static: no build step, no framework, SVG/canvas charts.

---

## Honest limitations

1. **Demo only.** Prices are simulated by the venue; nothing here is evidence about production odds or liquidity (F-04).
2. **Demo account not connected.** No API key was supplied, so balance, positions and order placement are unverified (F-01).
   The signed client and the V2 order path exist and are unit-tested; execution is off by default.
3. **Alert cadence** is the collection schedule (5 minutes in CI, subject to GitHub's scheduling), unless a browser poll is
   running for the page you have open.
4. **WebSocket streaming is not used.** It requires a signed handshake and a process that can hold a key (F-02).
5. **The high-ROI feed is a rule set**, and paper P&L is small-sample and fee-approximate (F-05).
6. **Older pages in this repo contain hand-written data** that was never API output. They are archived and flagged; do not cite
   them.

All open items, with evidence and what would close them, are on **`flagged.html`**. Multi-session history and task ownership are
in **`COORDINATION.md`**.
