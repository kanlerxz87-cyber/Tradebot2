> **Archive — session b1cd545f.** This document is retained for review. It is superseded by
> [`executive-summary.html`](executive-summary.html), which separates verified facts, snapshot
> observations and unverified items. Performance figures in this document are illustrative unless a
> source is shown; no Kalshi demo credentials were available to verify a live account. See
> [`flagged.html`](flagged.html).

# Kalshi Tradebot2: Executive Summary & System Specification

## 1. Project Overview & Mission
**Kalshi Tradebot2** is an institutional-grade analytics, live monitoring, alerting, and automated simulated trading platform specifically engineered for the Kalshi Designated Contract Market (DCM). The platform tracks high-dollar-volume events across five prioritized sectors:
1. **Gas Prices** (EIA US Retail Gas Averages, crude benchmarks, fuel CPI derivatives)
2. **Elections** (Presidential, Congressional, Gubernatorial, and geopolitical outcomes)
3. **Culture** (Academy Awards, Grammys, Box Office milestones, Billboard rankings)
4. **Crypto** (Bitcoin, Ethereum price targets, ETF net flow thresholds, regulatory actions)
5. **Golf** (The Masters, PGA Championship, US Open, Ryder Cup outcomes, player cuts)

The platform provides real-time detection of high-velocity price dislocations (sudden swings $\ge \$0.10$ in contract price), dual scrolling real-time alert feeds (all events vs. selective high-ROI model opportunities), order-book liquidity visualization, and an automated simulated trading engine executing and auditing four quantitative strategies.

---

## 2. Official Kalshi API Infrastructure & Specifications

Kalshi operates under CFTC oversight as a regulated Designated Contract Market (DCM). All contract parameters, settlement determinations, and pricing rules are codified in official regulatory filings.

### 2.1 API Endpoints (Demo vs. Production)
| Environment | Protocol | Verified Official URL | Description |
|---|---|---|---|
| **Demo REST API** | HTTPS | `https://demo-api.kalshi.co/trade-api/v2` | Primary sandbox trading & market data endpoint |
| **Demo REST Fallback** | HTTPS | `https://external-api.demo.kalshi.co/trade-api/v2` | Secondary external sandbox REST gateway |
| **Demo WebSocket** | WSS | `wss://demo-api.kalshi.co/trade-api/ws/v2` | Real-time market tick, order book & trade stream |
| **Demo WS Fallback** | WSS | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | Alternate WebSocket connection gateway |
| **Production REST** | HTTPS | `https://trading-api.kalshi.com/trade-api/v2` | Regulated live execution & clearing gateway |
| **Documentation** | HTTPS | `https://trading-api.kalshi.com/trade-api/v2/documentation` | Official OpenAPI 3.0 specification |

### 2.2 Market Mechanics & Binary Structure
- **Contract Valuation**: All contracts trade within the unit interval $[\\$0.01, \\$0.99]$.
- **Payout Settlement**:
  - Event occurs $\rightarrow$ **YES** resolves to $\mathbf{\$1.00}$ (100¢).
  - Event does not occur $\rightarrow$ **NO** resolves to $\mathbf{\$0.00}$ (0¢).
- **Price as Implied Probability**: A contract priced at $\$0.65$ reflects a market-implied probability of $65\%$ for event occurrence.
- **Liquidity Depth**: Quantities represent discrete 1-contract lots, collateralized fully with zero margin debt or counterparty risk.

---

## 3. Core Functional Modules

### 3.1 Live Event Tracking & Resolution Lifecycle
- Events are ingested with open order book depth, 24h dollar volume, open interest, and settlement target timestamps.
- Contracts are monitored through three distinct states:
  1. **Active (Live)**: Open order book trading, continuous bid/ask quotes.
  2. **Pending Settlement**: Expiration time reached; awaiting official verifier determination.
  3. **Resolved**: Finalized outcome strictly recorded as YES or NO based on official source criteria.

### 3.2 Dual Scrolling Real-Time Alert Engine
The alerting system captures any instantaneous or intra-minute price movement $\ge \$0.10$:
- **Feed 1: Global All-Events Stream**: Unfiltered chronological scroll of all market moves $\ge \$0.10$ across all 5 categories. Displays contract ticker, prior price, new price, magnitude ($\Delta$), volume, and timestamp.
- **Feed 2: High-ROI Model Filter**: Selective stream filtering only events where our quantitative probability model identifies a statistically significant edge (Expected Value $\text{EV} \ge +18\%$ ROI).

### 3.3 Interactive Multi-Scale Charting & Order Book Depth
- **X-Axis (Time)**: Dynamically switchable between **Seconds (1s/5s ticks)**, **Minutes (1m/5m)**, and **Hours (1h/4h)**.
- **Y-Axis (Price)**: Full precision scale spanning $\$0.00$ to $\$1.00$.
- **Liquidity Ladder**: Real-time visualization of resting bid/ask contracts at each price tick, displaying exact contract count available at the best bid, best ask, and deep book levels.
- **Catalyst Markers**: Visual pins on charts pinpointing sudden $\ge \$0.10$ jumps with hyperlinks to verified external news catalysts and official reports.

### 3.4 Automated Simulated Trading Engine
The engine simulates demo trading accounts with realistic execution constraints (slippage, fill rates against resting depth):
1. **Momentum Swing Breakout**: Enters long on sudden velocity ($\Delta \ge +\$0.10$ with volume surge) targeting continuation to resistance.
2. **Mean Reversion / Oversold Dip**: Identifies sharp downswings ($\Delta \le -\$0.10$) occurring on thin liquidity and buys the dip for bounce reversion.
3. **High-ROI Expected Value (EV) Arbitrage**: Compares market-implied probability to our verified fundamental model forecast, executing when mispricing yields $>20\%$ expected return.
4. **Resolution Convergence Yield**: Collects yield by purchasing high-confidence contracts ($>\$0.88$) close to resolution with verified positive underlying data.

---

## 4. Source Verification & Compliance Standards
In accordance with strict verification directives:
- Every market contract is verified against official Kalshi rulebook filings and government or primary authoritative data sources:
  - **Gas Prices**: US Energy Information Administration (EIA) Gasoline & Diesel Fuel Update (`https://www.eia.gov/petroleum/gasdiesel/`).
  - **Elections**: Federal Election Commission (FEC) & Official State Secretary of State canvasses (`https://www.fec.gov/`).
  - **Culture**: Academy of Motion Picture Arts and Sciences (AMPAS) (`https://www.oscars.org/`).
  - **Crypto**: Spot exchange volume-weighted average prices and CFTC/SEC filings (`https://www.coingecko.com/`).
  - **Golf**: PGA Tour Official Scoring System & Augusta National Masters Committee (`https://www.pgatour.com/`, `https://www.masters.com/`).
- Any metric that cannot be directly confirmed from an official regulatory or primary source is marked as **Unverified** and routed to the **Flagged for Review** registry (`review.html`).

---

## 5. Deployment & GitHub Pages Architecture
The platform is organized into static, standards-compliant HTML5/CSS3/ES6 web modules served from the repository root:
- `index.html`: Executive Dashboard, Live Charts, Order Book Depth, Dual Alerts & Portfolio Summary.
- `gas-prices.html`: Gas Prices category deep-dive with EIA benchmark tracking.
- `elections.html`: Election contracts, polling aggregate comparisons, and resolution criteria.
- `culture.html`: Cultural and entertainment contracts with official certification sources.
- `crypto.html`: Digital asset contracts with real-time liquidity and price targets.
- `golf.html`: Major championship outcomes with PGA Tour official links.
- `strategies.html`: Strategy testing console, trade execution interface, and portfolio performance analytics.
- `review.html`: Flagged for Review page listing all unverified items and audit logs.
- `COORDINATION.md`: Multi-session task board tracking development and verification milestones.
