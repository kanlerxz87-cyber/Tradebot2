# Executive summary — source-first Kalshi demo desk

**Published entry:** https://kanlerxz87-cyber.github.io/Tradebot2/ · [Maintained desk](live/index.html) · [Flagged for Review](live/flagged.html) · [Verification](live/verification.html) · [Release evidence](live/release-verification.json)

## Decision in brief

Use this as a transparent **demo observation and paper-strategy desk**, not a proven high-ROI signal or an authenticated account terminal. It organizes **gas prices, elections, culture, crypto and golf** separately, groups contracts within events, offers two scrolling ≥$0.10 observation feeds, interactive charts/book quantities, a retained watch list through resolution, and a separate simulated portfolio. [Kalshi warns that demo prices may not reflect real markets](https://docs.kalshi.com/getting_started/demo_env).

| Capability | What is delivered / important qualification | Official evidence |
|---|---|---|
| Five topics | Retail-gasoline / AAA contracts, Elections, Entertainment labeled Culture, Crypto, and Sports tagged Golf. Selection is not full exchange coverage. | [Series fields / discovery](https://docs.kalshi.com/api-reference/market/get-series-list) |
| Highest-dollar view | Selected-contract 24h **face-notional proxy**, not actual cash turnover or proof of the largest events. Missing face values leave dollars blank and move the entire ranking to contracts. | [Market volume and face values](https://docs.kalshi.com/api-reference/market/get-markets) |
| Two chats | All fresh, same-basis observed YES moves of at least 10¢ in either direction; a selective 50% retrace scenario after modeled fees. No synthetic alerts enter the real feed. | [Quote / last-price fields](https://docs.kalshi.com/api-reference/market/get-market) |
| Charts / liquidity | Selectable 30s/60s/minute/hour windows; actual read times, compatible candle closes and available exchange trade prints. Book quantities at returned prices; YES asks complement NO bids. | [Candles](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) · [Bids-only book](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| Resolution | Watched unresolved tickers survive selection changes in this browser. A missing listing or close time is never a result; paper settlement waits for finalized YES/NO. | [Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle) · [Historical cutoff](https://docs.kalshi.com/getting_started/historical_data) |
| Automated paper strategies | Four hypotheses, fresh active binary $1-face contracts only, ask entries / bid exits with visible side size. $10,000 starting cash and general-taker M=1 fees are explicit simulation assumptions. | [Book semantics](https://docs.kalshi.com/api-reference/market/get-market-orderbook) · [Fee schedule](https://kalshi.com/docs/kalshi-fee-schedule.pdf) |
| Demo-account trades / portfolio | **Unverified**; no account order sent by this session. Account cash/positions are distinct from paper values and blank until a signed capture exists. Secret-enumeration permission was denied; credentials are unknown, not proven absent. | [Signed requests](https://docs.kalshi.com/getting_started/quick_start_authenticated_requests) · [Balance units](https://docs.kalshi.com/api-reference/portfolio/get-balance) |
| Jump context | Official settlement/reference links are contextual, not proven causes. Verified causal news remains blank. | [Event/reference fields](https://docs.kalshi.com/api-reference/events/get-event) |

## Operational limits — do not hide these

- Default cohort polling is 60 seconds; a visible selected chart rechecks about every five seconds. These are sampled REST observations, **not** continuous monitoring or a complete seconds tape. Prices may be venue-cached; a fetch time is not an exchange trade time. [Market caching](https://docs.kalshi.com/api-reference/market/get-market).
- Browser histories and paper ledgers are environment-isolated and local. Storage loss, browser closure and cross-tab races are not solved by static Pages. A durable server ledger and signed [WebSocket gateway](https://docs.kalshi.com/getting_started/quick_start_websockets) are recommended, not claimed delivered.
- The ROI screen is a hypothesis, not a calibrated probability or validated expected return. Series/event fee overrides, queue/slippage/impact and out-of-sample validation remain open. There is **no simulated settlement fee**; the centicent general-fee scenario is labeled and is not a verified account fee. [Official fee schedule](https://kalshi.com/docs/kalshi-fee-schedule.pdf).
- The small browser capture and compact upstream capture retain bounded resolution samples; full dated counts are not current live counts. The original 19:03 UTC capture and later collector cycles have separate provenance. See the JSON timestamps, input hash, source URLs and Actions run rather than treating a test pass as a live API check.
- Earlier dashboards and audit records remain published. Some archives contain previously unverified or illustrative numbers and not every page has a banner. The parallel root snapshot terminal and custom strategy lab have different ledgers/rules; their performance must not be combined with `/live/` as one account.

## Evidence and release status

Official environment, market, series, candle, book, lifecycle, balance, event, signed-streaming and fee references were re-read on **27 November 2026**. Combined local integration checks passed: **88 Python tests + 2 subtests, 149 DOM assertions, 37 quote-integrity checks**, the parallel frontend regression suite, and canonical/live/archive static-link gates. These are fixture/schema/behavior checks, **not** independent verification of every live value, external link or archived claim.

Fresh selected-market REST rereads run in GitHub Actions via `tools/build_live_snapshot.py --verify-live`; the resulting capture records an input SHA-256, exact official sources, observation times and runner URL. Main merge and Pages deployment are not implied by this summary: their actual outcome is recorded in [release-verification.json](live/release-verification.json) and [coordination history](COORDINATION.md). Open items are published on [Flagged for Review](live/flagged.html) and are non-blocking unless the site is broken or a value is fabricated.
