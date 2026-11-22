# Requirements traceability

**Checked:** 2026-11-22 UTC  
**Policy:** direct official value, transparent calculation, explicit local logic, or blank/flagged.

| User requirement | Implementation | Status | Verification | Official source |
|---|---|---|---|---|
| Review repository before work | Repository inventory and clean status recorded in `COORDINATION.md`; starter contained only `README.md`. | Done | Git status and file inventory at claim time. | [Repository](https://github.com/kanlerxz87-cyber/Tradebot2) |
| Read/create shared coordination board and claim scope | `COORDINATION.md` created, committed, and pushed before implementation. | Done | Claim commit `bd18d6d`. | [Repository commits](https://github.com/kanlerxz87-cyber/Tradebot2/commits/arena/d1222891-tradebot2) |
| Executive summary | Site subpage and `docs/EXECUTIVE_SUMMARY.md`. | Done | Source-linked endpoint, capability, calculation, and constraint tables. | [API environments](https://docs.kalshi.com/getting_started/api_environments) |
| Dashboard tracks highest dollar amount live events | Open events ranked by calculated event-level 24h contract notional. | Done with disclosure | Formula is `volume_24h_fp × notional_value_dollars`; shown as calculated, not cash/liquidity. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Restrict to gas, elections, culture, crypto, golf | Five auditable keyword/category rules; category subpages. | Done | Unit tests include positive and unrelated-negative cases. | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| Alert on sudden swings ≥$0.10 either direction | Inclusive threshold across consecutive successful price observations. | Done | Unit tests cover +$0.10, −$0.10, and $0.099. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| All-events scrolling chat | `AlertFeed` all-movement tape. | Done | Runtime feed updates only on sourced changes/resolutions. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Selective high-ROI scrolling chat | Transparent score-gated shortlist; explicitly not called an ROI forecast. | Done with corrected label | Model card exposes every threshold and score weight. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Track events through resolution YES/NO | Previously observed tickers remain monitored; explicit API result shown. | Done in-session | Resolution unit test. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Automate simulated trades | `swing-momentum-v1` enters/exits without user input. | Done | Unit test verifies displayed-ask entry and target exit. | [Create order guide](https://docs.kalshi.com/getting_started/quick_start_create_order) |
| Track Kalshi demo-account portfolio | Authenticated values intentionally blank without credentials/server. | Needs secure backend | Published as FR-001; no fake account values. | [Get Balance](https://docs.kalshi.com/api-reference/portfolio/get-balance) |
| Analyze trades by category and strategy | Paper journal, equity, topic aggregation, realized/unrealized P&L. | Done for paper trades | Calculations and assumptions disclosed in UI/docs. | [Get Positions](https://docs.kalshi.com/api-reference/portfolio/get-positions) |
| Execute trades and track performance | Paper execution done; authenticated demo execution blocked safely. | Partial by design | No credential or signing key in bundle. | [Authenticated requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) |
| Interactive x/y price graph | 60 sec / 15 min / 1 hour SVG chart; x=time, y=last YES price. | Done | TypeScript build and runtime component. | [Get Markets](https://docs.kalshi.com/api-reference/market/get-markets) |
| Show current liquidity and contracts at price | YES/NO bid levels with fixed-point quantities and top-of-book size. | Done within official semantics | Labels say contracts, not order counts. | [Get Market Orderbook](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| Link events/pages that may have caused ≥$0.10 jump | No unverified causal attribution; official market source shown and cause labeled unverified. | Flagged | FR-003. | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| Simplify continuously for trader decisions | Consistent topic navigation, ranked tables, compact metrics, dual alert feeds, source links. | Done for this release | Responsive production build. | [Market-data guide](https://docs.kalshi.com/getting_started/quick_start_market_data) |
| Keep topics separate and events organized | Topic subpages and event grouping; leading contract is visibly identified. | Done | `groupMarketsByEvent` and topic routes. | [Get Events](https://docs.kalshi.com/api-reference/events/get-events) |
| No manual user input | Discovery, monitoring, alerting, paper entry, marking, and exit start automatically. | Done | No credential or trade-entry form exists. | [Market-data guide](https://docs.kalshi.com/getting_started/quick_start_market_data) |
| Every table row has an official source | Dynamic rows link to demo API; static research rows link to docs. | Done | Source policy test and manual component review. | [Kalshi API docs](https://docs.kalshi.com) |
| Blank and flag unconfirmed values | Shared empty-state and em-dash policy; five open flags published. | Done | `src/data/sources.ts` and review route. | [Kalshi API docs](https://docs.kalshi.com) |
| GitHub Pages site | Vite build and workflow deployment from `main`. | Done in repository | Workflow runs lint, tests, build, and Pages deployment. | [GitHub Pages documentation](https://docs.github.com/en/pages) |
| Clean landing page and subpages | Overview, five topics, portfolio, strategies, summary, sources, review. | Done | Responsive navigation and hash routes. | [Repository](https://github.com/kanlerxz87-cyber/Tradebot2) |

## Notes

- “Needs review” and constrained items are published and do not block the verified static release.
- The execution environment fixes this work to `arena/d1222891-tradebot2`; the requested `session-<id>/<task>` naming convention could not override that environment rule. This exception is recorded in `COORDINATION.md`.
- GitHub Pages is static. Adding authenticated Kalshi functionality requires a separate secret-bearing runtime; it must not be simulated or approximated in the browser.
