# Executive summary — Kalshi demo dashboard

**Published site:** https://kanlerxz87-cyber.github.io/Tradebot2/ · [Live dashboard](live/index.html) · [Flagged for review](live/flagged.html) · [Sources and limitations](live/verification.html)

The project monitors **gas prices, elections, culture, crypto and golf** on Kalshi's demo exchange. The browser dashboard offers event tables, two feeds for observed price changes of at least $0.10 in either direction, price charts, order-book depth, available resolutions and experimental paper strategies. The selective feed is a rule-based hypothesis, not a validated high-ROI prediction. Demo prices may not reflect production prices ([Kalshi demo documentation](https://docs.kalshi.com/getting_started/demo_env)).

## Official environments

| Environment | Endpoint | Official source |
|---|---|---|
| Demo REST | `https://external-api.demo.kalshi.co/trade-api/v2` | [Demo environment](https://docs.kalshi.com/getting_started/demo_env) |
| Demo REST alternative | `https://demo-api.kalshi.co/trade-api/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Demo WebSocket | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Demo WebSocket alternative | `wss://demo-api.kalshi.co/trade-api/ws/v2` | [API environments](https://docs.kalshi.com/getting_started/api_environments) |

## Important limitations

- Event discovery has page caps, and the browser's series discovery is not fully paginated. Rankings cover loaded data only; contract volume multiplied by contract notional is a payout-notional proxy, not verified dollars paid. Some missing inputs are defaulted in the current calculation. Do not assume the ranking is exhaustive. [Market fields](https://docs.kalshi.com/api-reference/market/get-markets).
- Polling detects changes between observations, not every trade or a swing that reverses between polls; it cannot monitor continuously while the browser is closed. The fallback snapshot is historical, not live. WebSocket connections require a signed handshake ([WebSocket quick start](https://docs.kalshi.com/getting_started/quick_start_websockets)).
- Available binary results are displayed, but capped collection and the [historical cutoff](https://docs.kalshi.com/getting_started/historical_data) mean every event is not guaranteed to be tracked to resolution. A winning YES or NO contract pays $1 and the losing side pays $0 in simple binary markets ([settlement](https://docs.kalshi.com/getting_started/market_settlement)).
- Paper fills and results are hypothetical; the browser can simulate an exit at the last price when a market closes, which is not evidence of executable liquidity. [Order book reference](https://docs.kalshi.com/api-reference/market/get-market-orderbook).
- A signed demo-account balance, positions, and an actual submitted demo order were not verified; the published portfolio is a simulation. Demo and production credentials are separate ([demo documentation](https://docs.kalshi.com/getting_started/demo_env), [order API](https://docs.kalshi.com/api-reference/orders/create-order-v2)).
- No causal attribution for a price jump is established. Topic mappings are project choices, not a guarantee of complete official coverage ([series list](https://docs.kalshi.com/api-reference/market/get-series-list)).

## Audit, 27 November 2026

The repository's committed `data/snapshot.json` reports a 19:03:10 UTC snapshot; it is not a current independent API verification. Its companion `data/probe.json` records successful demo REST checks and unauthenticated WebSocket HTTP 401 responses at the recorded time. Sandbox egress prevented independently repeating the live API probe in this session. Tests passed: `tools/verify_site.py`, `tools/check_site.py --strict`, `live/tests/check_live.py`, 69 Python tests, and 87 browser smoke assertions. These tests do not establish that every row, archive, external link or current live market was verified. The [review page](live/flagged.html), [verification page](live/verification.html), and `COORDINATION.md` retain limitations and audit history for manual review.
