# Executive Summary — Tradebot2 Kalshi Demo Trading & Live Event Intelligence Dashboard

> **Project Repository:** [`kanlerxz87-cyber/Tradebot2`](https://github.com/kanlerxz87-cyber/Tradebot2)  
> **Live GitHub Pages Site:** [`https://kanlerxz87-cyber.github.io/Tradebot2/`](https://kanlerxz87-cyber.github.io/Tradebot2/)  
> **Verified Against Official Sources:** 2026-11-22 (UTC)

---

## 1. Objective & Scope

**Tradebot2** is a verified Kalshi Demo API trading dashboard, live alerting system, automated strategy testing workbench, and documentation portal focused strictly on the **highest dollar volume live and recently resolved Kalshi events** across **five dedicated topics only**:

1. **Gas Prices** — National and state retail regular gasoline price contracts (AAA Fuel Prices settlement source).
2. **Elections** — Major U.S. and international electoral control and presidential outcome contracts.
3. **Culture** — Major awards (Oscars, Grammys, The Game Awards) and pop-culture milestone contracts.
4. **Crypto** — High-volume Bitcoin, Ethereum, and cryptocurrency milestone contracts.
5. **Golf** — PGA Tour tournament winners and Major championship markets (e.g., The Masters, John Deere Classic, The RSM Classic).

Topics are strictly separated in both navigation and subpages, while events belonging to the same topic are organized together and tracked from active trading through final **YES / NO** outcome resolution.

---

## 2. Verified Kalshi Demo API Architecture

All API hostnames and endpoints in this repository have been verified line by line against Kalshi's official documentation ([Demo Environment](https://docs.kalshi.com/getting_started/demo_env), [API Environments](https://docs.kalshi.com/getting_started/api_environments), [WebSockets Quick Start](https://docs.kalshi.com/getting_started/quick_start_websockets)):

| Surface | Recommended Demo Host | Also Supported (Legacy Shared) | Official Verification Source |
| --- | --- | --- | --- |
| **REST Trade API** | `https://external-api.demo.kalshi.co/trade-api/v2` | `https://demo-api.kalshi.co/trade-api/v2` | [docs.kalshi.com/getting_started/demo_env](https://docs.kalshi.com/getting_started/demo_env) |
| **WebSocket API** | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | `wss://demo-api.kalshi.co/trade-api/ws/v2` | [docs.kalshi.com/getting_started/api_environments](https://docs.kalshi.com/getting_started/api_environments) |
| **User Fill/Order WS** | `wss://user-ws.demo.kalshi.co/trade-api/ws/v2` | — | [docs.kalshi.com/getting_started/api_environments](https://docs.kalshi.com/getting_started/api_environments) |
| **Demo Web UI** | `https://demo.kalshi.co/` | — | [help.kalshi.com — Demo Account Setup](https://help.kalshi.com/en/articles/13823775-creating-and-using-a-demo-account) |

### Key Verified Technical Findings
- **Authentication:** Public market reads (`GET /events`, `GET /markets`, `GET /markets/{ticker}/orderbook`, `GET /markets/trades`, candlesticks) require **no API key**. Trading, portfolio endpoints, and WebSocket streams require signed headers (`KALSHI-ACCESS-KEY`, `KALSHI-ACCESS-TIMESTAMP`, `KALSHI-ACCESS-SIGNATURE`) using **RSA-PSS SHA-256** or **Ed25519** over `timestamp + METHOD + path_without_query_string` ([API Keys Docs](https://docs.kalshi.com/getting_started/api_keys)).
- **True Liquidity Depth:** `liquidity` and `liquidity_dollars` on `GET /markets` and `GET /events` are **deprecated and return `0`** ([API Changelog](https://docs.kalshi.com/changelog)). Tradebot2 therefore reads real bid/ask contract availability directly from `GET /markets/{ticker}/orderbook` (or batch `GET /markets/orderbooks`) and WebSocket `orderbook_delta`, reconstructing YES asks from NO bids (`1.00 - no_bid_price`) per Kalshi's binary orderbook rules ([Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook)).
- **Timeframe Charting:** Kalshi's candlestick REST endpoint supports `period_interval` values of `1` (minute), `60` (hour), and `1440` (day) ([Get Market Candlesticks](https://docs.kalshi.com/api-reference/market/get-market-candlesticks)). Seconds-level X-axis tracking is aggregated live in real time from incoming WebSocket/polling ticks.
- **Order Execution V2:** Legacy `/portfolio/orders` mutation endpoints carry a **10x write rate-limit cost** compared to V2 event-order endpoints (`POST /portfolio/events/orders`) ([Create Order V2](https://docs.kalshi.com/api-reference/orders/create-order-v2)). Our Python Demo client uses V2 order execution by default.
- **Resolution & Historical Partitioning:** Live market outcomes transition `active → closed → determined → finalized` with `result` set to `yes`, `no`, or `scalar` and `$1.00` payout per winning contract ([Market Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle), [Market Settlement](https://docs.kalshi.com/getting_started/market_settlement)). Older settled records move past `market_settled_ts` into `/historical/*` endpoints ([Historical Data](https://docs.kalshi.com/getting_started/historical_data)).

---

## 3. Core Dashboard Capabilities Delivered

1. **Dual Real-Time Swing Alert Chat Streams (`>= $0.10` Moves):**
   - **Stream A — All Events Feed:** Real-time scrolling chat alerting every contract price swing `>= $0.10` (up or down) across Gas Prices, Elections, Culture, Crypto, and Golf.
   - **Stream B — Selective High-ROI Model Feed:** Filtered scrolling chat surfacing only `>= $0.10` swings that pass Tradebot2's transparent **High-ROI Opportunity Score** (combining implied edge vs. fair value, orderbook depth, bid-ask spread tightness, and expected ROI to `$1.00` settlement).
2. **Interactive Price Chart + Catalyst Event Annotations + Orderbook Liquidity Ladder:**
   - **X-axis:** Time with instant switching between **Seconds**, **Minutes**, and **Hours** windows.
   - **Y-axis:** Contract price (`$0.00` to `$1.00`).
   - **Catalyst Markers:** Any `>= $0.10` jump is annotated directly on the chart with clickable external source/news links explaining the probable driver.
   - **Liquidity Depth Ladder:** Displays exact available YES and NO contracts at each price level alongside cumulative depth and bid-ask spread.
3. **Automated Strategy Simulator & Demo Portfolio Tracker:**
   - Execute manual Demo trades (Buy/Sell YES/NO) or activate automated strategy bots (*Swing Mean-Reversion `>= $0.10`*, *Momentum Breakout*, *Liquidity Imbalance*, *High-ROI Selective Filter*, plus user-created custom strategies).
   - Track cash balance, open positions, realized/unrealized P&L, equity curve, win rate, and ROI — categorized by topic, strategy type, setup type, and final YES/NO resolution.
4. **Live Demo REST Connection + Transparent Demo Simulator Mode:**
   - Connects directly to `https://external-api.demo.kalshi.co/trade-api/v2` (or `https://demo-api.kalshi.co/trade-api/v2`) for public market reads, and supports the companion Python authenticated WebSocket & Demo trading engine (`scripts/kalshi_demo_client.py` + `scripts/strategy_engine.py`).
   - Because static browsers cannot send custom WebSocket auth headers and Demo markets differ from production, the browser site also runs an explicitly labeled **Interactive Demo Simulator** seeded from verified official Kalshi tickers so every trader workflow works immediately out of the box without disguising simulated ticks as official exchange data.

---

## 4. Suggestions to Make the Site Even More Live & Interactive

1. **Deploy a Lightweight WebSocket-to-SSE Relay (Cloudflare Worker / FastAPI / Fly.io):** Bridges Kalshi's header-authenticated `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` to browser `EventSource` or token-authenticated WebSockets with sub-second `ticker`, `orderbook_delta`, and `market_lifecycle_v2` updates while keeping RSA/Ed25519 private keys off the browser.
2. **Automated News-to-Tick Catalyst Matching:** Pair `>= $0.10` swing detection with live RSS/Webhook feeds (AAA daily fuel updates, AP/Reuters Election alerts, PGA Tour ShotLink/leaderboard JSON, CoinDesk/exchange price feeds, official Awards announcements) to auto-attach timestamped news links within seconds of a price jump.
3. **One-Click Orderbook Ladder Execution & Hotkeys:** Allow traders to click any price level in the YES/NO liquidity ladder to pre-populate a limit order at that exact cent with instant fee & max-payout calculation.
4. **Push & Webhook Alerts (Browser Notifications, Slack, Discord, Telegram):** Deliver instant alerts whenever a Selective High-ROI `>= $0.10` swing triggers or a tracked position settles `YES` or `NO`.
5. **Walk-Forward Strategy Replay Mode:** Replay recorded WebSocket `orderbook_delta` + `trade` captures at 1x–20x speed to benchmark automated strategies against realistic historical fills and slippage before running live in the Kalshi Demo account.
6. **Multi-Outcome Event Comparison Overlay:** Plot the top 3–4 competing contracts inside a multi-outcome event (e.g., Presidential candidates, Masters leaders, Gas price thresholds) on a single normalized `$0.00–$1.00` chart so arbitrage and sum-of-probabilities dislocations stand out immediately.

---

## 5. Governance & Flagged Irregularities

Every irregularity, deprecated API field, browser limitation, and blank unverified field is tracked in [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md) and published on the live site's **[Flagged for Review](pages/flagged-for-review.html)** page so reviewers can inspect every item directly with official source links.
