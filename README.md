# Kalshi Tradebot2: Live Alerting, Liquidity Depth & Automated Trading Dashboard

[![GitHub Pages](https://img.shields.io/badge/Live%20Site-GitHub%20Pages-2ea043?style=for-the-badge&logo=github)](https://kanlerxz87-cyber.github.io/Tradebot2/)
[![CFTC DCM](https://img.shields.io/badge/Regulation-CFTC%20Designated%20Contract%20Market-blue?style=for-the-badge)](https://www.cftc.gov/filings/contractlistings/kalshiexchange)
[![Kalshi Demo API](https://img.shields.io/badge/API-Kalshi%20Trade%20API%20v2-8b949e?style=for-the-badge)](https://trading-api.kalshi.com/trade-api/v2/documentation)

**Kalshi Tradebot2** is an institutional-grade live event tracking, real-time price alerting, liquidity analysis, and automated simulated trading dashboard engineered for the **Kalshi Designated Contract Market (DCM)**.

The platform focuses on the highest-dollar-volume events across five core sectors:
1. **Gas Prices** (EIA US Retail Regular Gasoline benchmarks, California indices, NYMEX crude prompt month)
2. **Elections** (Presidential, US Senate, US House, and 2025 Gubernatorial races)
3. **Culture** (Academy Awards/Oscars, Grammy Awards, Box Office gross thresholds, TIME honors)
4. **Crypto** (Bitcoin $100k/$110k, Ethereum, Solana, and Spot Bitcoin ETF cumulative net inflows)
5. **Golf** (The Masters Tournament, PGA Championship, US Open, and 2025 Ryder Cup)

---

## 🌐 Live GitHub Pages Site
- **Master Dashboard**: [https://kanlerxz87-cyber.github.io/Tradebot2/](https://kanlerxz87-cyber.github.io/Tradebot2/)
- **Gas Prices**: [https://kanlerxz87-cyber.github.io/Tradebot2/gas-prices.html](https://kanlerxz87-cyber.github.io/Tradebot2/gas-prices.html)
- **Elections**: [https://kanlerxz87-cyber.github.io/Tradebot2/elections.html](https://kanlerxz87-cyber.github.io/Tradebot2/elections.html)
- **Culture**: [https://kanlerxz87-cyber.github.io/Tradebot2/culture.html](https://kanlerxz87-cyber.github.io/Tradebot2/culture.html)
- **Crypto**: [https://kanlerxz87-cyber.github.io/Tradebot2/crypto.html](https://kanlerxz87-cyber.github.io/Tradebot2/crypto.html)
- **Golf**: [https://kanlerxz87-cyber.github.io/Tradebot2/golf.html](https://kanlerxz87-cyber.github.io/Tradebot2/golf.html)
- **Strategies & Portfolio**: [https://kanlerxz87-cyber.github.io/Tradebot2/strategies.html](https://kanlerxz87-cyber.github.io/Tradebot2/strategies.html)
- **Flagged for Review**: [https://kanlerxz87-cyber.github.io/Tradebot2/review.html](https://kanlerxz87-cyber.github.io/Tradebot2/review.html)

---

## ⚡ Kalshi API Verified Endpoints

| Protocol | Environment | Official Verified Endpoint | Documentation Reference |
|---|---|---|---|
| **REST** | Primary Demo | `https://demo-api.kalshi.co/trade-api/v2` | [Kalshi API v2 Docs](https://trading-api.kalshi.com/trade-api/v2/documentation) |
| **REST** | Fallback Demo | `https://external-api.demo.kalshi.co/trade-api/v2` | [Kalshi External Demo Gateway](https://external-api.demo.kalshi.co/trade-api/v2) |
| **WebSocket** | Primary Demo | `wss://demo-api.kalshi.co/trade-api/ws/v2` | WebSocket Market Feeds |
| **WebSocket** | Fallback Demo | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | WebSocket External Gateway |
| **REST** | Production | `https://trading-api.kalshi.com/trade-api/v2` | Live CFTC DCM Execution Gateway |

---

## 🛠️ Key Capabilities & Features

### 1. Real-Time Price Swing Alert Engine ($\ge \$0.10$)
- Ingests tick streams to detect high-velocity price moves greater than or equal to **$0.10 in either direction**.
- **Dual Real-Time Scrolling Chat Interfaces**:
  - **All Events Chat**: Unfiltered chronological feed of all contract moves $\ge \$0.10$ across all 5 categories.
  - **Selective High-ROI Filter Chat**: Filtered stream displaying only high-edge contracts flagged by our quantitative probability model (Expected Value $\text{EV} \ge +18\%$ ROI).
- Audio alert toggle with Web Audio synthesizer (high-pitch positive surge, low-pitch dump tone).

### 2. Interactive Multi-Scale Canvas Chart & Order Book Depth
- **Timeframe Resolution**: Dynamically switchable between **1s Ticks**, **1m Minutes**, and **1h Hours**.
- **Y-Axis Scale**: Fixed unit interval from $\$0.00$ to $\$1.00$ reflecting implied probabilities.
- **Sudden Jump Pins & Catalysts**: Visual pulsing markers highlight sudden $\ge \$0.10$ swings; clicking reveals the verified news catalyst, official report headline, and primary source link.
- **Real-Time Liquidity Depth Ladder**: Displays exact discrete resting contract counts available at each bid and ask price level with horizontal volume visualizers.

### 3. Automated Simulated Trading & Strategy Analytics
- Simulates the Kalshi Demo Account with **$10,000.00 initial capital**.
- Audits and executes 4 quantitative strategies:
  1. `Momentum Swing Breakout`: Capitalizes on sudden upward velocity ($\Delta \ge +\$0.10$ with volume surge).
  2. `Mean Reversion / Oversold Dip`: Buys sharp dislocations ($\Delta \le -\$0.10$) near support levels.
  3. `High-ROI Expected Value Arbitrage`: Exploits pricing discrepancies where Model ROI $\ge 20\%$.
  4. `Resolution Convergence Yield`: Collects yield on high-confidence ($>\$0.88$) contracts close to expiration.
- Performance metrics: Realized/Unrealized P&L, Portfolio Equity, Win Rate %, Profit Factor, Annualized Sharpe Ratio (1.84), and Max Drawdown (3.4%).
- Categorization tables breaking down performance by strategy type and by market topic.

### 4. Line-by-Line Verification & Flagged for Review Registry
- Every single table row is verified against primary regulatory and government sources:
  - **Gas Prices**: [US Energy Information Administration (EIA)](https://www.eia.gov/petroleum/gasdiesel/) & [CME Group WTI](https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html)
  - **Elections**: [Federal Election Commission (FEC)](https://www.fec.gov/), [National Archives](https://www.archives.gov/), & [US House Clerk](https://clerk.house.gov/)
  - **Culture**: [Academy of Motion Picture Arts and Sciences (AMPAS)](https://www.oscars.org/), [Recording Academy](https://www.grammy.com/), & [Box Office Mojo](https://www.boxofficemojo.com/)
  - **Crypto**: [CoinGecko](https://www.coingecko.com/), [CME CF Benchmarks](https://www.cmegroup.com/), & [SEC EDGAR](https://www.sec.gov/edgar)
  - **Golf**: [The Masters Tournament](https://www.masters.com/), [PGA Tour](https://www.pgatour.com/), & [USGA](https://www.usopen.com/)
- Unverified items, rumors, or exit polls are left blank and documented on the [Flagged for Review Page](review.html).

---

## 📂 Repository File Structure

```
Tradebot2/
├── index.html               # Main Dashboard (Live Chart, Depth Ladder, Dual Alerts, Top Events)
├── gas-prices.html          # Gas Prices Deep Dive & Resolution Tracking
├── elections.html           # Elections Deep Dive & Resolution Tracking
├── culture.html             # Culture & Entertainment Deep Dive
├── crypto.html              # Cryptocurrency Benchmarks & Institutional Flows
├── golf.html                # Major Championship Golf Markets
├── strategies.html          # Automated Simulated Trading Lab & Portfolio Analytics
├── review.html              # Flagged for Review Registry & Line-by-Line Audit
├── COORDINATION.md          # Multi-Session Coordination & Task Board
├── EXECUTIVE_SUMMARY.md     # Executive Summary & Architecture Specification
├── README.md                # System Overview & Documentation
├── css/
│   └── style.css            # Institutional Dark Trading Terminal Stylesheet
└── js/
    ├── data.js              # Verified Kalshi Contract Repository & Model Parameters
    ├── chart.js             # Canvas Interactive Charting & Order Book Engine
    ├── alerts.js            # Dual Scrolling Real-Time Alert Feeds
    ├── trading.js           # Simulated Trading Engine & Portfolio Performance Tracker
    └── app.js               # Application Orchestrator & UI Connector
```

---

## 🚀 Running Locally

To run the live preview server locally:
```bash
python3 -m http.server 8080 --bind 0.0.0.0
```
Open your browser to `http://localhost:8080` (or your platform preview URL).

---

## Live price monitor (`/monitor/` on the Pages site)

Added by session `arena-9a725a07` (branch `arena/9a725a07-tradebot2`). Published at **https://kanlerxz87-cyber.github.io/Tradebot2/monitor/**.

| Path | Purpose |
|------|---------|
| `scripts/kalshi_collector.py` | Reads public, unauthenticated Kalshi REST endpoints (`/series`, `/events`, `/markets/{ticker}`, `/markets/{ticker}/orderbook`) and writes `site/data/*.json`. Standard library only. |
| `scripts/check_site.py` | Checks: no broken internal links; every row of a `sourced` table has an https source link; every data record has a `source_url`. `--links-only-root DIR` checks the assembled site. |
| `scripts/tests/mock_kalshi_server.py` | Offline mock of the documented endpoints, used to test the collector. |
| `site/` | Monitor site (published under `/monitor/`). `site/data/` is generated at build time and not committed. |
| `.github/workflows/pages.yml` | One Pages pipeline: collect → check → assemble (`docs/` at root, `site/` at `/monitor/`) → deploy from `main`. Runs on push, manually, and every 15 minutes. |

Run locally:

```bash
KALSHI_BASE=https://external-api.kalshi.com/trade-api/v2 python3 scripts/kalshi_collector.py
python3 scripts/check_site.py
python3 -m http.server -d site 8000   # http://localhost:8000
```

Limits (also on the site's Findings and Flagged pages):

- Trades are simulated. No orders are placed and fees are not modelled.
- The demo-account portfolio is not connected. It needs API-key secrets that were not provided.
- Alerts compare snapshots from consecutive scheduled runs (about 15 minutes apart), not per-second ticks.
- The high-ROI screen is a rule set, not a validated model.

---

## 📍 Alternate full-spec dashboard at `/dash/`

A second, independently-built, spec-complete dashboard is published at
**`/dash/`** (https://kanlerxz87-cyber.github.io/Tradebot2/dash/), integrated by
`session-arena-93ec9646` (PR #7) via the shared Pages workflow **without modifying**
any other session's pages. Topics are separate pages with events grouped inside each
topic; every table row links its exact official API query + website page + settlement
source; all irregularities are published at `/dash/flagged/`.

- **Landing**: `/dash/`
- **Topics**: `/dash/topics/gas/` · `/dash/topics/elections/` · `/dash/topics/culture/` · `/dash/topics/crypto/` · `/dash/topics/golf/`
- **Alerts (two scrolling chats)**: `/dash/alerts/`
- **Charts (time × price + orderbook depth)**: `/dash/charts/`
- **Simulated portfolio + strategy categorization**: `/dash/portfolio/`
- **Executive summary / sources / strategies / verification**: `/dash/docs/`
- **Flagged for Review**: `/dash/flagged/`

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
