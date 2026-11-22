# Executive summary — Kalshi Demo Desk

**Live site:** https://kanlerxz87-cyber.github.io/Tradebot2/ · **Environment:** Kalshi **demo** (mock funds) · **Mode:** read-only public data, paper trades only, no orders placed.

---

## 1. What was built

A single dashboard for the Kalshi demo exchange covering **five topics only** — gas prices, elections, culture, crypto, golf:

* **Highest-dollar live events** ranked by 24h dollar notional (computed as Σ `volume_24h_fp × last_price_dollars`, both API fields).
* **Two scrolling alert chats** for moves of **|Δ| ≥ $0.10** in either direction: one with every alert, one with a rule-based
  high-ROI subset.
* **Time × price charts** with seconds (sub-second trade tape), minutes (1-minute candles) and hours (1-hour candles) on the X
  axis and YES price in dollars on the Y axis, with recorded alerts marked.
* **Liquidity**: resting order-book depth per price level on both sides, contracts available at the best ask, and the computed
  cost to fill that size.
* **Paper trading and portfolio analysis** by strategy, topic and alert direction, with settlement at resolution ($1.00 YES /
  $0.00 NO).
* **Resolution tracking** until the API reports `result` = yes or no.
* **Provenance on every row**: each cell links to the Kalshi endpoint that produced it; anything missing is blank and marked
  `unverified`.

## 2. Environment facts (verified 2026-11-22)

| Item | Value |
|---|---|
| Demo REST | `https://external-api.demo.kalshi.co/trade-api/v2` (also `https://demo-api.kalshi.co/trade-api/v2`) |
| Demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` (also `wss://demo-api.kalshi.co/trade-api/ws/v2`) — documented, not used by this static site |
| Production REST (not used) | `https://external-api.kalshi.com/trade-api/v2` |
| Demo status at check time | `exchange_active: true`, `trading_active: true` |
| Demo caveat | Kalshi: demo prices/behaviour “may not be reflective of those in real markets”; credentials are not shared with production |

Sources: [Demo environment](https://docs.kalshi.com/getting_started/demo_env) ·
[API environments](https://docs.kalshi.com/getting_started/api_environments) ·
[live status](https://external-api.demo.kalshi.co/trade-api/v2/exchange/status)

## 3. Topic mapping (official taxonomy)

| Topic | Filter | Note |
|---|---|---|
| Gas prices | `category=Commodities&tags=Oil & Gas` | No gasoline category exists; includes crude, natural gas, heating oil (flagged F4) |
| Elections | `category=Elections` | Exact |
| Culture | `category=Entertainment` | No “Culture” category (flagged F4) |
| Crypto | `category=Crypto` | Exact |
| Golf | `category=Sports&tags=Golf` | Exact |

Source: [tags_by_categories (demo, live)](https://external-api.demo.kalshi.co/trade-api/v2/search/tags_by_categories)

## 4. Measured coverage (2026-11-22 snapshot)

* **18,298 open markets** returned across the five filters (top 40 series by volume per topic): ≈13.7k crypto, 2.1k gas,
  1.1k golf, 0.95k culture, 0.44k elections.
* Series counts: crypto 321 · elections 2,710 · entertainment 2,631 · golf 134 · oil & gas 25.
* The site publishes only markets with 24h trading or open interest, capped per topic, and states how many were omitted.

## 5. Method, in one line each

* **Alert**: last price differs from the previous collection run by ≥ $0.10; one alert per market per run.
* **High-ROI screen** (rule set, not a model): spread ≤ $0.03, ≥ 50 contracts at the ask, 24h volume ≥ 100, entry $0.05–$0.95;
  ROI shown is gross (1 − entry) ÷ entry, before fees.
* **Paper trade**: 10 contracts at the YES ask, ±$0.05 bracket on the YES bid, 48h time stop, settlement at `result`.
* **Depth**: `GET /markets/{ticker}/orderbook` — contract counts per price level, cumulative summed here.

## 6. Verified / not verified

**Verified by reading the official docs and exercising the endpoint on the demo host** (full log on the site's Sources page):
demo + production base URLs, `/exchange/status`, `/series`, `/events`, `/markets/{ticker}`, `/markets/{ticker}/orderbook`,
`/series/{series}/markets/{ticker}/candlesticks` (interval 1/60/1440, OHLC `_dollars` fields), `/markets/trades`
(`limit ≤ 1000`, sub-second `created_time`), the category/tag taxonomy, and the market object's field names.

**Not verified / deliberately not claimed** (published as F1–F14 on the Flagged for review page):

1. **Demo-account portfolio is not connected** — needs API-key secrets; the portfolio is a paper simulation.
2. **No browser CORS** on the Kalshi API (no `Access-Control-Allow-Origin` on GET or OPTIONS, 2026-11-22) → no direct browser
   polling; updates ride the scheduled rebuild (default every 10 minutes).
3. **Demo prices are simulated**, so nothing here is evidence about production odds.
4. **Culture/gas mappings** are approximations of Kalshi's taxonomy.
5. **The high-ROI screen is unvalidated**, and paper P&L ignores fees, slippage and queue position.
6. **Cause of a price move is never asserted** — the API reports none.
7. **Candles/tape are captured for the most active markets only**; other markets fall back to run snapshots.
8. **Older pages in this repo contained hand-written “live” data** (prices, catalysts, a $10,000 demo portfolio, Sharpe 1.84)
   that was not API output. They are no longer published; the files are retained and flagged (R1, R2, R7).

## 7. Repository work

* Collector switched to the **demo** host by default (it had been reading production while the site said demo — R3).
* One canonical site (`site/`), one Pages pipeline, Pages switched to `build_type: workflow` so the Actions artifact is what is
  served (a legacy branch build was racing it — R5).
* Checks on every build: internal links, a source link on every static table row, a source URL in every data record.
* Line-by-line review and irregularities R1–R10: site **Repo review**. Unverified items F1–F14: site **Flagged for review**.

## 8. Next steps worth paying for

1. A small WebSocket worker for genuine tick-level alerts (the browser cannot call Kalshi directly).
2. Demo API keys as repository secrets to show the real demo balance/positions and, later, to place demo orders behind a
   kill-switch.
3. Fee-aware, confidence-interval strategy scorecards once several weeks of alerts exist.
4. Timestamped news pins labelled “reference only, cause unproven”.
