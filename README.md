# Kalshi Demo Desk — live events, $0.10 alerts, paper trading

**Live site:** https://kanlerxz87-cyber.github.io/Tradebot2/
**Environment:** Kalshi **demo** exchange (mock funds). Read-only public API. **No orders are ever placed.**

A small, honest monitoring desk for five topics on the Kalshi demo exchange — **gas prices, elections, culture, crypto and
golf**. It ranks live events by dollar volume, alerts on contract moves of **$0.10 or more in either direction** in two scrolling
chats, charts price against time (seconds / minutes / hours), shows resting order-book liquidity, simulates trades and reports
performance by strategy and topic, and records how events resolve (YES or NO).

Every table row links to the Kalshi API response that produced it. Values the API does not return are left blank and marked
**unverified**; computed columns say "computed". Nothing is fabricated.

---

## Start here

| Page | What it answers |
|---|---|
| [`/`](https://kanlerxz87-cyber.github.io/Tradebot2/) | Highest-dollar live events, KPI strip, latest alerts, resolutions |
| [`/alerts.html`](https://kanlerxz87-cyber.github.io/Tradebot2/alerts.html) | Two scrolling chats: all ≥ $0.10 moves, and the model's high-ROI subset |
| [`/dashboard.html`](https://kanlerxz87-cyber.github.io/Tradebot2/dashboard.html) | Every published market, grouped by event, filterable |
| `/gas.html`, `/elections.html`, `/culture.html`, `/crypto.html`, `/golf.html` | One topic per page, events grouped, per-row sources |
| [`/chart.html`](https://kanlerxz87-cyber.github.io/Tradebot2/chart.html) | Time × price chart, seconds/minutes/hours, order-book ladder |
| [`/portfolio.html`](https://kanlerxz87-cyber.github.io/Tradebot2/portfolio.html) | Paper portfolio, strategy/topic/direction breakdowns |
| [`/resolved.html`](https://kanlerxz87-cyber.github.io/Tradebot2/resolved.html) | Resolved events and their YES/NO result |
| [`/executive-summary.html`](https://kanlerxz87-cyber.github.io/Tradebot2/executive-summary.html) | The one-page summary |
| [`/sources.html`](https://kanlerxz87-cyber.github.io/Tradebot2/sources.html) | Every official page and endpoint used, with what was verified |
| [`/repo-review.html`](https://kanlerxz87-cyber.github.io/Tradebot2/repo-review.html) | Line-by-line repo review, irregularities R1–R10 |
| [`/flagged.html`](https://kanlerxz87-cyber.github.io/Tradebot2/flagged.html) | Unverified items and approximations F1–F14 |

---

## Documented endpoints used

| Surface | Endpoint | Documentation |
|---|---|---|
| REST (demo) | `https://external-api.demo.kalshi.co/trade-api/v2` | [demo_env](https://docs.kalshi.com/getting_started/demo_env), [api_environments](https://docs.kalshi.com/getting_started/api_environments) |
| REST (demo, also supported) | `https://demo-api.kalshi.co/trade-api/v2` | same |
| WebSocket (demo) | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | same — documented, **not used** by this static site |
| WebSocket (demo, also supported) | `wss://demo-api.kalshi.co/trade-api/ws/v2` | same |

Production is `https://external-api.kalshi.com/trade-api/v2` (the older `trading-api.kalshi.com` host used to appear in this
repo's README is **not** in Kalshi's endpoint table — see repo review R6). The collector can be pointed at production with
`KALSHI_BASE`, but this site is deliberately a demo tracker.

---

## How it works

```
GitHub Actions (every 10 min)
  └─ scripts/kalshi_collector.py      # public, unauthenticated GETs
        ├─ /series                 → topic catalogs (category / tag filters)
        ├─ /events                 → open events + nested markets
        ├─ /series/{s}/markets/{t}/candlesticks   → 1-minute and 1-hour candles
        ├─ /markets/trades          → sub-second trade tape (most active markets)
        ├─ /markets/{t}/orderbook   → resting depth
        ├─ /markets/{t}             → resolution result (yes/no)
        └─ writes site/data/*.json  (never committed)
  └─ scripts/check_site.py            # link + source-link + data-source gate
  └─ publishes site/ as the Pages artifact
```

The browser reads only `site/data/*.json` and re-reads it every 30 s. Kalshi's demo API returns no
`Access-Control-Allow-Origin` header, so the page cannot poll Kalshi directly (verified 2026-11-22; see F2).

### Alerting

* An alert fires when a market's last price changes by **|Δ| ≥ $0.10** between two collection runs.
* **Chat 1** = every alert. **Chat 2** = alerts passing the rule-based high-ROI screen (spread ≤ $0.03, ≥ 50 contracts at the
  ask, 24h volume ≥ 100, entry $0.05–$0.95). The screen is **not** a validated model (F5).
* The cause of a move is **never** asserted: the API reports no causes. Reference links are the event's settlement sources.

### Simulated trading

`follow_rise` (buy YES after a screened rise) and `fade_drop` (buy YES after a screened drop): 10 contracts at the YES ask,
±$0.05 bracket on the YES bid, 48-hour time stop, settlement at the API result. Fees, slippage and queue position are not
modelled (F6). The **Kalshi demo account itself is not connected** — that needs API keys stored as repository secrets (F1).

---

## Run it locally

```bash
python3 scripts/kalshi_collector.py     # writes site/data/*.json (needs network access to Kalshi)
python3 scripts/check_site.py           # link + source checks
python3 -m http.server --directory site 8000
```

There is no build step for the site: the HTML is static, the data is JSON, the chart is inline SVG.
`tools/build_pages.py` regenerates the static pages; `scripts/probe_demo.py` and `.github/workflows/probe-demo.yml` are
read-only diagnostics for the demo API (they record what the environment actually returns).

Requires Python 3.11+ and internet access to `external-api.demo.kalshi.co`. Standard library only.

---

## What this repository does not do

* No order placement, no API keys, no account access.
* No claim about what caused a price move.
* No tick-level latency: alerts are measured between scheduled runs.
* No fee, slippage or queue modelling in the paper P&L.
* No production market data (demo only, and demo prices are simulated by design).

Known issues and unverified items are published on the site's **Flagged for review** page and listed with evidence on
**Repo review**. The earlier hand-written dashboards in `docs/`, `dash/` and the flat root pages are retained in the repository
for review but are no longer published.
