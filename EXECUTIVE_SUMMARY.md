# Executive Summary — Tradebot2 Kalshi Demo Live Trading & Intelligence Platform

> **Repository:** [`kanlerxz87-cyber/Tradebot2`](https://github.com/kanlerxz87-cyber/Tradebot2)  
> **Live GitHub Pages Site:** [`https://kanlerxz87-cyber.github.io/Tradebot2/`](https://kanlerxz87-cyber.github.io/Tradebot2/)  
> **Verified Against Official Sources:** 2026-11-22 (UTC)

---

## 1. Objective & Strict 5-Topic Scope

**Tradebot2** is a verified Kalshi Demo API trading dashboard, real-time `>= $0.10` price-swing alerting terminal, automated strategy simulation workbench, and documentation portal built for the CFTC-regulated Kalshi Designated Contract Market (DCM).

The platform tracks highest dollar volume live and recently resolved contracts strictly across **five separated topics only**:

1. **Gas Prices** — U.S. national & state retail regular gasoline price contracts (verified against [AAA Fuel Prices](https://gasprices.aaa.com/?internal=true) & [EIA Gasoline/Diesel](https://www.eia.gov/petroleum/gasdiesel/)).
2. **Elections** — High-volume U.S. and international presidential and legislative control contracts (verified against Kalshi Elections markets & [FEC](https://www.fec.gov/)).
3. **Culture** — Major awards (Oscars, Grammys, The Game Awards) and pop-culture milestone contracts (verified against [GRAMMY.com](https://www.grammy.com/live-blog/2026-grammy-awards/), [AMPAS](https://www.oscars.org/), and Kalshi Culture markets).
4. **Crypto** — High-volume Bitcoin, Ethereum, and cryptocurrency milestone contracts (verified against Kalshi Crypto markets & [CoinGecko](https://www.coingecko.com/)).
5. **Golf** — PGA Tour tournament winners and Major championships including The Masters, John Deere Classic, and The RSM Classic (verified against [PGA TOUR](https://www.pgatour.com/article/news/latest/2026/11/17/the-rsm-classic-facts-and-figures-sea-island-golf-club-seaside-course-st-simons-island-georgia-2026) & [The Masters](https://www.masters.com/)).

Topics remain strictly separated in navigation and subpages, while events within the same topic are organized together and tracked from active trading through final **YES / NO** outcome resolution (`$1.00` payout to winning side, `$0.00` to losing side).

---

## 2. Verified Kalshi Demo API Infrastructure

Verified line by line against Kalshi's official documentation ([Demo Environment](https://docs.kalshi.com/getting_started/demo_env), [API Environments](https://docs.kalshi.com/getting_started/api_environments), [WebSockets Quick Start](https://docs.kalshi.com/getting_started/quick_start_websockets)):

| Surface | Recommended Demo Endpoint | Also Supported (Legacy Shared) | Official Verification Source |
| --- | --- | --- | --- |
| **REST Trade API** | `https://external-api.demo.kalshi.co/trade-api/v2` | `https://demo-api.kalshi.co/trade-api/v2` | [docs.kalshi.com/getting_started/demo_env](https://docs.kalshi.com/getting_started/demo_env) |
| **WebSocket API** | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | `wss://demo-api.kalshi.co/trade-api/ws/v2` | [docs.kalshi.com/getting_started/api_environments](https://docs.kalshi.com/getting_started/api_environments) |
| **User Fill/Order WS** | `wss://user-ws.demo.kalshi.co/trade-api/ws/v2` | — | [docs.kalshi.com/getting_started/api_environments](https://docs.kalshi.com/getting_started/api_environments) |
| **Demo Web Portal** | `https://demo.kalshi.co/` | — | [help.kalshi.com — Demo Account](https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account) |

### Key Verified API Findings
- **Authentication:** Public market reads (`GET /events`, `GET /markets`, `GET /markets/{ticker}/orderbook`, `GET /markets/trades`, candlesticks) require **no API key**. Trading, portfolio endpoints, and WebSockets require signed headers (`KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-TIMESTAMP`, `KALSHI-ACCESS-SIGNATURE`) signed via **RSA-PSS SHA-256** or **Ed25519** over `timestamp + METHOD + path_without_query` ([API Keys Docs](https://docs.kalshi.com/getting_started/api_keys)).
- **True Orderbook Liquidity:** `liquidity` and `liquidity_dollars` on `GET /markets` and `GET /events` are **deprecated and return `0`** ([API Changelog](https://docs.kalshi.com/changelog)). Real available contract counts at each price level are fetched from `GET /markets/{ticker}/orderbook` (or batch `GET /markets/orderbooks`) and WebSocket `orderbook_delta`, deriving YES asks from NO bids (`1.00 - no_bid_price`) ([Orderbook Docs](https://docs.kalshi.com/api-reference/market/get-market-orderbook)).
- **Timeframes & Candlesticks:** Native REST candlesticks support `period_interval` of `1` (minute), `60` (hour), and `1440` (day) ([Candlesticks Docs](https://docs.kalshi.com/api-reference/market/get-market-candlesticks)). Seconds-level X-axis graphing is aggregated live client-side from streaming ticks.
- **V2 Order Execution:** `POST /trade-api/v2/portfolio/events/orders` (Create Order V2) avoids the **10x write token penalty** on legacy `/portfolio/orders` mutations ([Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2)).
- **Lifecycle & Historical Partitioning:** Markets transition `active → closed → determined → finalized` with `result` (`yes` / `no` / `scalar`); settled markets older than `market_settled_ts` move to `/historical/*` ([Market Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle), [Historical Data](https://docs.kalshi.com/getting_started/historical_data)).

---

## 3. Core Dashboard & Engineering Modules Delivered

1. **Dual Real-Time Scrolling Swing Alert Chats (`>= $0.10` in Either Direction):**
   - **All Events Stream:** Unfiltered real-time scrolling chat alerting every contract move `>= $0.10` across Gas Prices, Elections, Culture, Crypto, and Golf.
   - **Selective High-ROI Model Stream:** Filtered scrolling chat surfacing only swings passing Tradebot2's transparent High-ROI scoring model (Score `>= 68/100`, spread `<= $0.05`, depth `>= 150` contracts).
2. **Interactive Multi-Scale Price Chart + Catalyst Links + Liquidity Depth Ladder:**
   - **X-Axis:** Time with instant toggles between **Seconds**, **Minutes**, and **Hours**.
   - **Y-Axis:** Contract price (`$0.00–$1.00`).
   - **Catalyst Annotations:** `>= $0.10` jumps are marked directly on the chart with clickable external website links explaining the probable cause.
   - **Orderbook Liquidity Depth:** Displays available YES and NO contracts at each price level; clicking any price pre-fills the Demo trade ticket.
3. **Automated Simulated Strategies & Demo Portfolio Performance:**
   - Supports manual Demo trades and automated strategy execution (*Swing Mean-Reversion `>= $0.10`*, *Momentum Breakout*, *Selective High-ROI Value Filter*, *Orderbook Liquidity Imbalance*, plus custom user-defined strategies).
   - Tracks cash balance, equity curve, realized/unrealized P&L, win rate, ROI, and trade categorization by topic, strategy type, and final **YES / NO** resolution.
4. **Python Kalshi Demo Client & Automated Site Verifier (`scripts/`):**
   - `scripts/kalshi_demo_client.py` (official RSA-PSS/Ed25519 request signing, Demo REST, V2 orders, authenticated WebSocket swing monitor).
   - `scripts/strategy_engine.py` (reproducible 5-topic multi-strategy backtester).
   - `scripts/verify_site.py` (JSON schema, 5-topic enforcement, official `https://` source check, and zero-broken-link validator).

---

## 4. Suggestions to Make the Site Even More Live & Interactive

1. **Authenticated WebSocket-to-SSE Relay:** Bridge `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` and `wss://user-ws.demo.kalshi.co/trade-api/ws/v2` via a lightweight server relay so browsers receive sub-second ticks and fills without exposing private keys.
2. **Automated News-to-Tick Catalyst Matching:** Auto-link timestamped AAA, AP/Reuters, PGA Tour, CoinDesk, and official Awards feeds to every `>= $0.10` swing within seconds.
3. **Multi-Outcome Probability Overlay Charts:** Compare competing contracts inside a single event via `GET /series/{series_ticker}/events/{ticker}/candlesticks`.
4. **Batch Orderbook Liquidity Heatmap:** Monitor 25–100 contracts in a single `GET /markets/orderbooks?tickers=...` call.
5. **Push / Discord / Slack Alert Webhooks:** Trigger notifications on Selective High-ROI swings and `market_lifecycle_v2` `determined` / `settled` transitions.
6. **Historical Replay Walk-Forward Mode:** Replay settled markets across `GET /historical/cutoff` at 1x–20x speed before deploying strategies live.

---

## 5. Verification & Flagged Irregularities

Every unverified metric, deprecated API field, and browser/sandbox constraint is left blank where unconfirmed and published transparently on **[Flagged for Review](pages/flagged-for-review.html)** (plus [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md), [`review.html`](review.html), and [`docs/flagged.html`](docs/flagged.html)).
