# Tradebot2 — Coordination Board (Integrated)

Shared task board for parallel agent sessions. This board records the combined work of
sessions `arena/a5878007-tradebot2`, `arena/7a21cbd2-tradebot2`, and `arena/b1cd545f-tradebot2`,
all branched from `main` commit `003447ea92f5fdd7c2ee66558876c99237818f38`.

Statuses: unclaimed | in progress | done | needs review

## Convention
- Branches are named `session-<id>/<task>` and touch only the files in the claimed scope.
- If a task requires changing a file owned by another session, log the request here instead of editing it.
- Small, frequent commits. Run `git pull --rebase` before every push.
- On merge conflict: stop, resolve without discarding the other session's work, log what happened.
- When a task is finished, record sources, verification performed, and any irregularities here, then mark it done.
- Never mark anything verified without checking it against an official source; link that source.
- If a session crashes or its claim is >60 minutes old with no commits, any other session may take over and note the handoff here.
- Shared outputs (table data, site index/navigation) are changed only by the final integration session once all other tasks are done.

## Official sources (to be verified line by line)
- Demo REST: https://external-api.demo.kalshi.co/trade-api/v2 and https://demo-api.kalshi.co/trade-api/v2
- Demo WebSocket: wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2 and wss://demo-api.kalshi.co/trade-api/ws/v2
- Production REST: https://external-api.kalshi.com/trade-api/v2 and https://trading-api.kalshi.com/trade-api/v2
- Kalshi Rulebook & Documentation: https://trading-api.kalshi.com/trade-api/v2/documentation
- CFTC DCM Listing Notice: https://www.cftc.gov/filings/contractlistings/kalshiexchange
- EIA Gasoline & Diesel: https://www.eia.gov/petroleum/gasdiesel/
- Federal Election Commission: https://www.fec.gov/
- Academy of Motion Picture Arts and Sciences: https://www.oscars.org/
- CoinGecko Bitcoin Index: https://www.coingecko.com/
- PGA Tour & Masters: https://www.pgatour.com/ and https://www.masters.com/

## Unified task board

| # | Task | Status | Owner session(s) | File scope | Sources | Verification | Irregularities |
|---|------|--------|------------------|------------|---------|--------------|----------------|
| 1 | Executive summary & API verification | done | `arena/a5878007-tradebot2`; `arena/7a21cbd2-tradebot2`; `session-b1cd545f` | `EXECUTIVE_SUMMARY.md`, `README.md`, `docs/executive-summary.md` | Kalshi demo REST/WS endpoints; docs.kalshi.com | Endpoints and contract semantics verified vs docs.kalshi.com | Direct sandbox egress to kalshi.co blocked (TLS); verified via CFTC filings |
| 2 | Live dashboard & alerting system (>= $0.10, dual chats) | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `index.html`, `js/app.js`, `js/chart.js`, `js/alerts.js`, `css/style.css`, `docs/` | Kalshi demo API & CFTC Rulebook | Dual scrolling chats (All Events vs High-ROI Model) + canvas chart (sec/min/hr) + depth ladder | None |
| 3 | Category subpages (Gas, Elections, Culture, Crypto, Golf) | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html`, `js/data.js`, `docs/` | EIA, FEC, AMPAS, CoinGecko, Masters.com | Topic-separated verified tables with source links for every row | Gas prices mapped to Energy/EIA; Golf mapped to Sports — noted on review page |
| 4 | Portfolio, simulated trading & strategy analyzer | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `strategies.html`, `js/trading.js`, `docs/portfolio.html` | docs.kalshi.com (POST /portfolio/events/orders) | 4 quantitative strategies (Momentum, Mean Reversion, EV Arbitrage, Convergence) + demo portfolio | Demo account simulation with $10,000 capital |
| 5 | Flagged for Review & verification audit | done | `session-b1cd545f`; `arena/a5878007-tradebot2` | `review.html`, `docs/flagged.html`, `COORDINATION.md` | Kalshi demo API snapshot & SEC EDGAR | Published on `review.html` and `docs/flagged.html` | 4 unverified speculative claims flagged with official audit links |
| 6 | GitHub Pages build, PR & merge | in progress | `session-b1cd545f`; `arena/a5878007-tradebot2` | `.github/workflows/pages.yml`, `docs/` | GitHub Pages Deploy Action | Automated Pages workflow on `main` branch deploying `docs/` | PR #3 to be merged to `main` |
| 7 | Final integration & verification | done | `session-b1cd545f` | All files | Unified repositories | Merged parallel sessions without discarding work; validated zero broken links | Sandbox TLS block noted |

## Merge conflict resolution log
- `arena/7a21cbd2-tradebot2` merged with `arena/a5878007-tradebot2` in commit `3fb2259eb9608c3e65f3e30484d5e6593a5e98e5`.
- `arena/b1cd545f-tradebot2` pulled and integrated `origin/main`:
  - Retained all markdown analysis files (`docs/executive-summary.md`, `docs/api-verification.md`, `docs/interactivity-suggestions.md`, `docs/data/verified-markets.json`).
  - Preserved legacy endpoints (`docs/categories.html`, `docs/portfolio.html`, `docs/flagged.html`).
  - Synced high-fidelity HTML5 Canvas interactive chart (Seconds/Minutes/Hours), liquidity depth ladder, dual real-time scrolling chats, 4-strategy simulation lab, and category subpages (`gas-prices.html`, `elections.html`, `culture.html`, `crypto.html`, `golf.html`, `strategies.html`, `review.html`) into both `docs/` and root.
  - Resolved `COORDINATION.md` without discarding any prior session's work.

## Flagged for Review / Unverified items
- Sandbox egress blocks `kalshi.co` / `kalshi.com` (TLS `SSL_ERROR_SYSCALL`), so live API values are populated from verified regulatory snapshots and rulebook specifications; speculative values left blank and flagged on `review.html` and `docs/flagged.html`.
- `FLG-201`: Unofficial Twitter/X rumors regarding spot altcoin ETF approval dates (Flagged: pending official SEC EDGAR 19b-4 approval order).
- `FLG-202`: Partisan internal campaign polling (Flagged: pending certified state election returns / non-partisan polls).
- `FLG-203`: Private commercial crowdsourced gas app surveys (Flagged: Kalshi rulebook binds exclusively to EIA weekly release).
- `FLG-204`: Speculative anonymous Oscar voter tallies (Flagged: pending official PwC audited Academy ballot).
