# API Verification — Kalshi Demo Trade API

**Branch:** `arena/7a21cbd2-tradebot2`  
**Date:** 2026-11-22  
**Rule:** Every value is checked against an official source; if it cannot be confirmed, it is left blank and flagged unverified. Nothing is inferred.

## Connectivity test (sandbox)

| Host | Result | Notes |
|---|---|---|
| https://external-api.demo.kalshi.co/trade-api/v2 | **UNREACHABLE** | `SSL_ERROR_SYSCALL` on TLS handshake (port 443) |
| https://demo-api.kalshi.co/trade-api/v2 | **UNREACHABLE** | `SSL_ERROR_SYSCALL` |
| https://external-api.kalshi.com/trade-api/v2 | **UNREACHABLE** | `SSL_ERROR_SYSCALL` |
| https://docs.kalshi.com | **UNREACHABLE** | `SSL_ERROR_SYSCALL` (direct curl) |

**Cause:** Sandbox outbound egress is restricted to `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`. Kalshi hosts are not in the allowlist, so direct verification by calling the API is **not possible from this sandbox**.

All facts below therefore come from official Kalshi documentation surfaced via web search (docs.kalshi.com), cited per claim.

## Verified endpoint surface (source: docs.kalshi.com "Quick Start: Market Data" + developer guide)

| Endpoint | Method | Auth required? | Verified? | Source |
|---|---|---|---|---|
| GET /series | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /events | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /markets | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /markets/{ticker} | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /markets/{ticker}/orderbook | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /markets/orderbooks | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /markets/trades | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /markets/{ticker}/candlesticks | GET | No | Yes (per docs) | docs.kalshi.com |
| GET /portfolio/balance | GET | Yes | Yes (per docs) | docs.kalshi.com |
| GET /portfolio/positions | GET | Yes | Yes (per docs) | docs.kalshi.com |
| GET /portfolio/settlements | GET | Yes | Yes (per docs) | docs.kalshi.com |
| GET /portfolio/orders | GET | Yes | Yes (per docs) | docs.kalshi.com |
| GET /portfolio/fills | GET | Yes | Yes (per docs) | docs.kalshi.com |
| POST /portfolio/events/orders | POST | Yes | Yes (per docs) | docs.kalshi.com |
| DELETE /portfolio/events/orders/{id} | DELETE | Yes | Yes (per docs) | docs.kalshi.com |
| WebSocket /trade-api/ws/v2 | WS | Yes (streaming) | Yes (per docs) | docs.kalshi.com |

## Verified contract semantics (source: docs.kalshi.com + Kalshi guides)

| Attribute | Value | Verified? | Source |
|---|---|---|---|
| Contract type | Binary Yes/No | Yes | docs.kalshi.com + Kalshi guides |
| Price range | $0.01 – $0.99 | Yes | docs.kalshi.com + Kalshi guides |
| Payout if correct | $1.00 | Yes | docs.kalshi.com + Kalshi guides |
| Payout if wrong | $0.00 | Yes | docs.kalshi.com + Kalshi guides |
| Resolution outcomes | Yes / No | Yes | docs.kalshi.com + Kalshi guides |
| Price = implied probability of Yes | Yes | Yes | docs.kalshi.com + Kalshi guides |
| close_time = trading close, not guaranteed immediate settlement | Yes | Yes | docs.kalshi.com |

## Market data fields used by the dashboard (per docs.kalshi.com examples)

| Field | Meaning | Verified? | Source |
|---|---|---|---|
| `ticker` | Market ticker | Yes | docs.kalshi.com |
| `event_ticker` | Parent event ticker | Yes | docs.kalshi.com |
| `title` | Market title | Yes | docs.kalshi.com |
| `yes_bid_dollars` | Best Yes bid price ($) | Yes | docs.kalshi.com |
| `yes_ask_dollars` | Best Yes ask price ($) | Yes | docs.kalshi.com |
| `volume_fp` | Volume (contracts) | Yes | docs.kalshi.com |
| `status` | open / closed / settled | Yes | docs.kalshi.com |
| `category` | Event category | Yes | docs.kalshi.com |
| `close_time` | Trading close timestamp | Yes | docs.kalshi.com |
| Orderbook `yes_dollars` / `no_dollars` | Bid levels (price, size) | Yes | docs.kalshi.com |

## Unverified / flagged items

| Item | Reason | Disposition |
|---|---|---|
| Live demo-account balance / positions / fills | Requires demo API key + signed requests; credentials not collected; API unreachable from sandbox | Left blank — **unverified** |
| Real-time price values for any specific market | API unreachable from sandbox | Left blank — **unverified** |
| Gas prices as a standalone Kalshi category | Not a top-level category; nested under Economics | **unverified** — flagged |
| Golf as a standalone Kalshi category | Not a top-level category; nested under Sports | **unverified** — flagged |
| CORS behavior of demo API from github.io | Not tested (API unreachable) | **unverified** — flagged |

## Sources used

- https://docs.kalshi.com/getting_started/quick_start_market_data (official Kalshi docs — via web search)
- https://external-api.demo.kalshi.co/trade-api/v2 (demo base URL — user-specified; matches docs; unreachable from sandbox)
- https://demo-api.kalshi.co/trade-api/v2 (demo base URL — user-specified; unreachable from sandbox)
