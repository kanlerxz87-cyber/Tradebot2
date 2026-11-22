# Executive summary — Kalshi demo dashboard

**Prepared:** 2026-11-22 · **Environment:** Kalshi **demo** (mock funds)
**Live site:** <https://kanlerxz87-cyber.github.io/Tradebot2/>

> **Read this first.** Kalshi's own demo guide warns that *"the price and behavior of markets
> in the demo environment may not be reflective of those in real markets"*
> (<https://docs.kalshi.com/getting_started/demo_env>). Everything below is demo data. It shows
> the machinery works; it is not a market view.

## 1. What was asked, and what exists now

| Requirement | Status | Where |
| --- | --- | --- |
| Live dashboard for the highest-dollar events in gas, elections, culture, crypto, golf | Built | `index.html`, `topics/*.html` |
| Alert on contract moves ≥ $0.10 either direction | Built and unit-tested | `collector/alerts.py` |
| Two scrolling chat feeds (all events / high-ROI model) | Built | `index.html` `#chatAll`, `#chatRoi` |
| Follow events until resolved, record yes/no | Built | `collector/resolutions.py`, `resolutions.html` |
| Automated simulated trades across strategies | Built | `collector/strategy.py`, `collector/trading.py` |
| Portfolio performance on the demo account | Implemented, not credentialed | `data/portfolio.json`, `performance.html` |
| Execute trades on events | Implemented, not credentialed | `tools/execute_demo_order.py` |
| Interactive price graph, x = time with s/m/h ranges, y = price | Built | `assets/js/chart.js` |
| Liquidity: contracts available at each price | Built | order books in `data/orderbooks.json` |
| Suggestions to make the site more live | Written | `docs/IMPROVEMENTS.md` |
| Topics kept separate, events grouped within a topic | Built | one page per topic + grouped dashboard tables |
| Every table row has an official source link; blanks flagged | Enforced in CI | `tools/verify_data.py`, `flagged.html` |

The full register, with per-item verification and sources, is on the
[requirements page](../requirements.html).

## 2. The five things that matter

1. **The data path is real and auditable.** Each cycle calls documented endpoints
   (`/series`, `/events`, `/markets`, `/markets/{ticker}/orderbook`, `/markets/trades`) and stores
   the exact request URL with every record. The site never renders a number without one.

2. **The alert threshold is $0.10, measured, not assumed.** A move is `|price_now − price_N|`
   on the same market. Tests cover exactly $0.10, just under, both directions, a sustained jump
   (alerts once), and a retrace (re-arms). See `tests/test_engine.py`.

3. **Money math is anchored to the official fee schedule.** `fee = ceil(M × 0.07 × C × P × (1−P))`.
   The implementation reproduces **all 42** values in Kalshi's published table
   (<https://kalshi.com/docs/kalshi-fee-schedule.pdf>) and the test fails the build if that ever
   drifts. One documented discrepancy (formula note says centicent, table implies whole cent) is
   flagged as **F-06**.

4. **Resolution comes from the exchange, not from us.** A market is marked resolved only when
   Kalshi's own `result` field is `yes` or `no`; payouts are $1.00 per winning contract
   (<https://docs.kalshi.com/getting_started/market_settlement>).

5. **Gaps are published, not papered over.** 18 items are on the
   [Flagged for Review](../flagged.html) page, including: no sandbox network to Kalshi (F-01),
   WebSocket requires authentication (F-03), no demo credentials in this session (F-05), and
   three irregularities in **earlier sessions'** pages — constructed sample contracts presented
   as verified (F-15), a production host that is not in the official list (F-16), and a gas
   settlement source that contradicts the series object (F-17).

## 3. Architecture in one paragraph

A Python collector runs on GitHub Actions every five minutes. It discovers series from Kalshi's
own category/tag map, keeps only the five topics by explicit rules, pulls open events and their
markets, captures order books and appends one observation per market to a rolling history file.
A second stage turns those histories into swing alerts, resolves finished markets from the
exchange, opens and settles simulated trades with the official fee model, and writes the
analytics. Everything lands as JSON committed to this repository; the site is static HTML/JS
that reads those files, so it works on GitHub Pages with no server and no secrets.

## 4. Decisions a reviewer should confirm

| Decision | Why | Where to change it |
| --- | --- | --- |
| Ranking by `volume_24h_fp × last price` | Kalshi reports volume in contracts; no dollar field exists on a market | `collector/collect.py` `dollar_volume()` |
| Alert window = 6 snapshots (~30 min at the 5-minute cadence) | Balances noise against latency | `collector/alerts.py` `DEFAULT_WINDOW_POINTS` |
| High-ROI filter = ROI on risk ≥ 25% **and** entry $0.10–$0.90 | Stops long-shot contracts producing meaningless ROI ratios | `collector/alerts.py` `qualifies()` |
| Mean-reversion is the model's reference trade | It is the simplest rule that is testable from price history alone | `collector/alerts.py` `roi_view()` |
| Five strategies, fixed 10–20 contract sizes | Keeps results attributable to the rule, not to sizing | `collector/strategy.py` `STRATEGIES` |
| Topics matched on series metadata only | Title keyword matching would be inference | `collector/topics.py` |

## 5. What is explicitly **not** done

- **No news attribution.** The brief asks which events or links may have caused a jump. There is
  no verified news feed in this build, so no causal claim is made anywhere (flag **F-09**).
- **No live WebSocket stream.** The handshake requires authentication; a static page cannot hold
  one (flag **F-03**). The browser does live REST reads where CORS allows it, and otherwise shows
  the committed snapshot.
- **No real order execution verified.** The signed order path is implemented to the documented
  V2 contract but cannot be tested without demo credentials (flags **F-05**, **R-12**).
- **No production data.** By design: this is the demo environment throughout.

## 6. Sources

All 28 sources are listed with the claim each supports on the
[sources page](../sources.html) and in `data/sources.json`. The load-bearing ones:

- Endpoints: <https://docs.kalshi.com/getting_started/api_environments>
- Demo caveat: <https://docs.kalshi.com/getting_started/demo_env>
- Order book semantics: <https://docs.kalshi.com/getting_started/orderbook_responses>
- Settlement: <https://docs.kalshi.com/getting_started/market_settlement>
- Fees: <https://kalshi.com/docs/kalshi-fee-schedule.pdf>
- Signing: <https://docs.kalshi.com/getting_started/quick_start_authenticated_requests>
