# Tradebot2 — Kalshi Demo Live Trading, Swing Alerting & Strategy Dashboard

[![Live GitHub Pages](https://img.shields.io/badge/Live%20Site-GitHub%20Pages-00c482?style=for-the-badge&logo=github)](https://kanlerxz87-cyber.github.io/Tradebot2/)
[![Kalshi Demo API v2](https://img.shields.io/badge/API-Kalshi%20Demo%20Trade%20API%20v2-3b82f6?style=for-the-badge)](https://docs.kalshi.com/getting_started/demo_env)
[![CFTC DCM](https://img.shields.io/badge/Regulation-CFTC%20DCM-64748b?style=for-the-badge)](https://www.cftc.gov/filings/contractlistings/kalshiexchange)

**Tradebot2** is a verified, zero-hallucination **Kalshi Demo API** live dashboard, real-time `>= $0.10` price-swing alerting system, automated strategy simulation workbench, and Python Demo API toolkit focused strictly on **five Kalshi topics only**:

1. **Gas Prices** — [`pages/gas-prices.html`](pages/gas-prices.html)
2. **Elections** — [`pages/elections.html`](pages/elections.html)
3. **Culture** — [`pages/culture.html`](pages/culture.html)
4. **Crypto** — [`pages/crypto.html`](pages/crypto.html)
5. **Golf** — [`pages/golf.html`](pages/golf.html)

---

## Live GitHub Pages Site & Navigation

| Page | Purpose |
| --- | --- |
| [`index.html`](index.html) | **Live Dashboard** — Dual `>= $0.10` Alert Chats (All Events + Selective High-ROI Model), Seconds/Minutes/Hours Interactive Chart + Catalyst Links, Orderbook Liquidity Ladder, Trade Ticket & Automated Strategies |
| [`pages/gas-prices.html`](pages/gas-prices.html) · [`pages/elections.html`](pages/elections.html) · [`pages/culture.html`](pages/culture.html) · [`pages/crypto.html`](pages/crypto.html) · [`pages/golf.html`](pages/golf.html) | **5 Strictly Separated Topic Subpages** — Verified tables with official `kalshi.com` & settlement source links, topic charts, orderbook depth, and resolution tracking (`YES` / `NO`) |
| [`pages/portfolio-strategies.html`](pages/portfolio-strategies.html) | **Demo Portfolio & Strategy Lab** — Equity curve, categorized P&L by topic/strategy/resolution, YES/NO settlement actions, and custom automated strategy builder |
| [`pages/executive-summary.html`](pages/executive-summary.html) & [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) | **Executive Summary** — Architecture, verified API findings, and interactive enhancement roadmap |
| [`pages/api-reference.html`](pages/api-reference.html) | **Verified API Reference** — Line-by-line Kalshi Demo REST, WebSocket, auth headers, and blank unverified runtime parameters |
| [`pages/flagged-for-review.html`](pages/flagged-for-review.html) & [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md) | **Flagged for Review** — Complete register of irregularities (`IR-01`–`IR-12`) and blank unverified values with official links |
| [`COORDINATION.md`](COORDINATION.md) | **Multi-Session Coordination Board** — Unified task board, conflict resolution log, and PR/Pages record |
| [`docs/index.html`](docs/index.html) · [`strategies.html`](strategies.html) · [`review.html`](review.html) | **Integrated Parallel Session Archives** — Preserved companion views from prior parallel sessions (`a5878007`, `7a21cbd2`, `b1cd545f`) |

---

## Verified Kalshi Demo Endpoints

Per official [Kalshi Demo Environment Docs](https://docs.kalshi.com/getting_started/demo_env) & [API Environments](https://docs.kalshi.com/getting_started/api_environments):

| Surface | Recommended Demo Host | Also Supported (Legacy Shared) |
| --- | --- | --- |
| **REST Trade API** | `https://external-api.demo.kalshi.co/trade-api/v2` | `https://demo-api.kalshi.co/trade-api/v2` |
| **WebSocket API** | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | `wss://demo-api.kalshi.co/trade-api/ws/v2` |
| **User Fill/Order WS** | `wss://user-ws.demo.kalshi.co/trade-api/ws/v2` | — |
| **Demo Portal** | `https://demo.kalshi.co/` | — |

---

## Local Python Demo Client, Strategy Simulator & Site Verifier

```bash
pip install -r requirements.txt

# 1. Verify all JSON datasets, 5-topic scope, official URLs, and relative HTML links
python3 scripts/verify_site.py

# 2. Run reproducible automated strategy benchmark across the 5 verified topics
python3 scripts/strategy_engine.py

# 3. Query Kalshi Demo REST / WebSocket with your own Demo API credentials
export KALSHI_KEY_ID="your-demo-key-id"
export KALSHI_PRIVATE_KEY_PATH="/path/to/demo-private-key.pem"
python3 scripts/kalshi_demo_client.py --mode demo-status

# 4. Serve the live dashboard locally
python3 -m http.server 4173 --bind 0.0.0.0
```
