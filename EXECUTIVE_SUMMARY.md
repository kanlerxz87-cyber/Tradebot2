# Executive summary — Tradebot2 (Kalshi demo desk)

**Site:** https://kanlerxz87-cyber.github.io/Tradebot2/ · **Pages model:** legacy build of `main:/` (repository root)
**Venue:** Kalshi **demo** environment · **Data:** public, unauthenticated Kalshi REST reads · **Orders:** none

> This file mirrors the published [executive summary page](executive-summary.html). If the two ever disagree, the page and the
> live data in `data/` win; this file is the repository copy.

## 1. What it is

A monitoring and paper-trading desk for five topics on the Kalshi demo exchange: **gas prices, elections, culture, crypto,
golf**. It does five things:

1. **Ranks live events by flow** so the highest-dollar events are visible first.
2. **Alerts on ≥ $0.10 contract moves** in either direction, in two scrolling feeds — all swings, and the model's high-ROI
   subset.
3. **Charts price against time** with an order-book depth ladder (contracts available at each price, both sides).
4. **Paper-trades** the alerts and reports performance by strategy, topic and side, with settlement at the API's resolution.
5. **Tracks each event to resolution** — YES or NO, taken from `result`, never inferred.

Every row links to the Kalshi API record it came from. Unconfirmed values are blank and flagged.

## 2. Environment (verified 2026-11-22)

| Item | Value |
|---|---|
| Demo REST (recommended) | `https://external-api.demo.kalshi.co/trade-api/v2` |
| Demo REST (also supported) | `https://demo-api.kalshi.co/trade-api/v2` |
| Demo WebSocket (recommended) | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` |
| Demo WebSocket (also supported) | `wss://demo-api.kalshi.co/trade-api/ws/v2` |
| Production REST (not used) | `https://external-api.kalshi.com/trade-api/v2` |
| Exchange status at check time | `exchange_active: true`, `trading_active: true` |
| Browser CORS | Allowed for this site's origin: `Access-Control-Allow-Origin: https://kanlerxz87-cyber.github.io` on GET; 204 preflight (`data/probe.json`) |
| WebSocket without signing | Rejected, HTTP 401 `token_authentication_failure` (`data/probe.json`) |

Sources: [Demo environment](https://docs.kalshi.com/getting_started/demo_env) ·
[API environments](https://docs.kalshi.com/getting_started/api_environments) ·
[live status](https://external-api.demo.kalshi.co/trade-api/v2/exchange/status)

## 3. Topic filters (official taxonomy)

| Topic | Filter | Caveat |
|---|---|---|
| Gas prices | `category=Commodities&tags=Oil & Gas` | No gasoline category exists; includes crude, natural gas, heating oil |
| Elections | `category=Elections` | Exact |
| Culture | `category=Entertainment` | No “Culture” category |
| Crypto | `category=Crypto` | Exact |
| Golf | `category=Sports&tags=Golf` | Exact |

Source: [tags_by_categories](https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories).

## 4. Method

* Collect public series/events/markets, order books, candles and resolutions on a schedule; publish JSON into `data/`.
* Price history: 1-minute and 1-hour candlesticks plus the trade tape for the most active markets; snapshots elsewhere.
* Alerts: |Δ last| ≥ $0.10 between observations. Model feed: published rule set (spread, size at the ask, 24h volume, price
  band). Feeds are labelled; the model feed is **not** a validated edge.
* Paper broker: simulated fills with the documented trading fee; settlement from `result`. Fees at settlement and queue
  position are not modelled.
* Verification: `pages.yml` gates every merge/PR on the canonical pages, their mount points, internal links and required data
  files; `tools/verify_data.py` checks every published row carries an official source.

## 5. Verified / not verified

**Verified against official docs and measured live:** demo and production base URLs; `/exchange/status`; `/series`;
`/events`; `/markets/{ticker}`; `/markets/{ticker}/orderbook`; candlesticks (1 / 60 / 1440-minute intervals); `/markets/trades`
(limit ≤ 1000, sub-second timestamps); the category/tag taxonomy; and the CORS/WS behaviour above.

**Not verified / not claimed (published as F-01 … on `flagged.html`):**

1. **Demo-account balance, positions, orders** — no API key was supplied; nothing was signed against the account.
2. **WebSocket streaming** — not used by the static site; it needs a signed handshake.
3. **Demo prices are simulated** and may not reflect production markets.
4. **Culture / gas mappings** are approximations of Kalshi's taxonomy.
5. **The model feed and paper P&L** — rule-based, small-sample, fee-approximate; not evidence of an edge.
6. **Causes of price moves** — never asserted; the API publishes none.

## 6. Repository state and corrections

* Canonical site = root pages; generated data = `data/*.json`; pipeline = `collector/` + `tools/build_snapshot.py`.
* Archived generations (`docs/`, `site/`, `dash/`, `pages/`, `topics/`, `observatory/`, `main-site-*.html`) are frozen and
  labelled; earlier builds included hand-written “live” data (tickers, catalysts, a $10,000 demo portfolio and Sharpe 1.84)
  that was never API output. They are flagged, not cited.
* An earlier README claimed tick-stream ingestion, four quantitative strategies, verified news catalysts and a live demo
  account. Those claims were not supported by the code and were removed in this integration pass.
* The repository's site gate (`tools/check_site.py`) referenced mount points from a different page generation; it now checks
  the pages that are actually published, so a missing mount point fails the build instead of passing unnoticed.
* Pages is `build_type: legacy` from `main:/`; the Pages settings API returned 403 for this integration token, so the
  repository root is the contract that is verified on every push.

Open items, evidence and the condition that would close each one: **`flagged.html`**. Task ownership and history:
**`COORDINATION.md`**.
