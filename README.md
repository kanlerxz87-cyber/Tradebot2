# Tradebot2 — Kalshi Demo Trading & Live Event Intelligence Dashboard

Live GitHub Pages Dashboard: **[https://kanlerxz87-cyber.github.io/Tradebot2/](https://kanlerxz87-cyber.github.io/Tradebot2/)**

Tradebot2 is a verified, zero-hallucination **Kalshi Demo API** dashboard, real-time `>= $0.10` swing alerting terminal, automated strategy lab, and Python Demo API toolkit focused strictly on **five Kalshi topics only**:

- **Gas Prices** ([`pages/gas-prices.html`](pages/gas-prices.html))
- **Elections** ([`pages/elections.html`](pages/elections.html))
- **Culture** ([`pages/culture.html`](pages/culture.html))
- **Crypto** ([`pages/crypto.html`](pages/crypto.html))
- **Golf** ([`pages/golf.html`](pages/golf.html))

## Key Documentation & Pages

| Resource | Description |
| --- | --- |
| [`index.html`](index.html) | Live Interactive Kalshi Dashboard (Dual `>= $0.10` Alert Chats, Seconds/Minutes/Hours Chart + Catalyst Links, Orderbook Liquidity Ladder, Manual & Automated Demo Trading) |
| [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) & [`pages/executive-summary.html`](pages/executive-summary.html) | Executive Summary, Verified Architecture, and Interactive Roadmap Suggestions |
| [`pages/portfolio-strategies.html`](pages/portfolio-strategies.html) | Demo Portfolio Performance, Trade Categorization, Resolution Tracker & Custom Strategy Builder |
| [`pages/api-reference.html`](pages/api-reference.html) | Line-by-Line Verified Kalshi Demo REST & WebSocket API Reference |
| [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md) & [`pages/flagged-for-review.html`](pages/flagged-for-review.html) | Full Repo Audit & Flagged Irregularities / Unverified Values |
| [`COORDINATION.md`](COORDINATION.md) | Shared Task Board, Verification Log & Merge Record |

## Verified Kalshi Demo Endpoints

Per official [Kalshi Demo Environment Docs](https://docs.kalshi.com/getting_started/demo_env):

- **Recommended REST Trade API:** `https://external-api.demo.kalshi.co/trade-api/v2` (also supported: `https://demo-api.kalshi.co/trade-api/v2`)
- **Recommended WebSocket API:** `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` (also supported: `wss://demo-api.kalshi.co/trade-api/ws/v2`)
- **Demo Account Portal:** `https://demo.kalshi.co/`

## Local Python Demo Client & Strategy Engine

```bash
pip install -r requirements.txt

# Run automated strategy backtest/simulation across the 5 verified topics
python3 scripts/strategy_engine.py

# Verify all JSON datasets, official source links, and local site links
python3 scripts/verify_site.py

# Query Kalshi Demo REST/WebSocket with your own Demo API credentials
export KALSHI_KEY_ID="your-demo-key-id"
export KALSHI_PRIVATE_KEY_PATH="/path/to/demo-private-key.pem"
python3 scripts/kalshi_demo_client.py --mode demo-status
```
