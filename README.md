# Tradebot2 — source-first Kalshi **demo** desk

**Start:** https://kanlerxz87-cyber.github.io/Tradebot2/ · [Maintained `/live/` desk](live/index.html) · [Executive summary](EXECUTIVE_SUMMARY.md) · [Flagged for Review](live/flagged.html) · [Release evidence](live/release-verification.json)

Five topics only: **gas prices, elections, culture, crypto and golf**. The maintained desk groups selected contracts into events, shows two scrolling feeds of observed **≥$0.10** moves in either direction, charts sampled prices and current returned book quantities, retains watched unresolved contracts, and tests four paper strategies. Missing/unverified values stay blank and flagged; calculations and assumptions are identified.

**Do not confuse source-linked with universally verified.** Official API contracts were checked; capture times and live read status remain visible. Tests do not independently verify every current market, external URL or archived statement. Demo conditions [may not reflect real markets](https://docs.kalshi.com/getting_started/demo_env).

## Where to go

| Page | Purpose / limit | Official design reference |
|---|---|---|
| [`live/index.html`](live/index.html) | Selected-event board, five topics, two chats, quick price chart and ladder. Not exhaustive cash-turnover ranking. | [Market fields](https://docs.kalshi.com/api-reference/market/get-markets) |
| [`live/topics/gas.html`](live/topics/gas.html) · [elections](live/topics/elections.html) · [culture](live/topics/culture.html) · [crypto](live/topics/crypto.html) · [golf](live/topics/golf.html) | Topic-separated event groups and source-linked contracts. Gas is retail gasoline, not crude/natural-gas substitution. | [Series categories/tags](https://docs.kalshi.com/api-reference/market/get-series-list) |
| [`live/alerts.html`](live/alerts.html) | All observed ≥10¢ swings and a selective retrace hypothesis, with filters/CSV. Not validated expected ROI. | [Market price fields](https://docs.kalshi.com/api-reference/market/get-market) |
| [`live/liquidity.html`](live/liquidity.html) | Selectable 30s/60s/minute/hour windows, available trade prints and quantities at returned book prices. | [Candles](https://docs.kalshi.com/api-reference/market/get-market-candlesticks) · [Book](https://docs.kalshi.com/api-reference/market/get-market-orderbook) |
| [`live/portfolio.html`](live/portfolio.html) | Browser-local PAPER ledger, strategy/topic/side/per-trade analysis; distinct blank-until-verified account panel. | [Signed balance endpoint](https://docs.kalshi.com/api-reference/portfolio/get-balance) |
| [`live/resolutions.html`](live/resolutions.html) | Retained watch list and finalized results; missing listing/closed status is not settlement. | [Lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle) |
| [`live/verification.html`](live/verification.html) · [`live/flagged.html`](live/flagged.html) | Sources, exact field/endpoint contracts, release evidence, open issues and historical audit links. | [Official API environments](https://docs.kalshi.com/getting_started/api_environments) |

The root [`dashboard.html`](dashboard.html), [`portfolio.html`](portfolio.html) custom strategy lab and [`sources.html`](sources.html) are preserved parallel work using a separate compact snapshot and separate model/ledger. Do not combine their P&L with `/live/` as one account.

## Exact environments

| Surface | Endpoint | Official source |
|---|---|---|
| Demo REST, recommended | `https://external-api.demo.kalshi.co/trade-api/v2` | [Environment list](https://docs.kalshi.com/getting_started/api_environments) |
| Demo REST, alternate | `https://demo-api.kalshi.co/trade-api/v2` | [Environment list](https://docs.kalshi.com/getting_started/api_environments) |
| Demo WebSocket, recommended | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` | [Environment list](https://docs.kalshi.com/getting_started/api_environments) |
| Demo WebSocket, alternate | `wss://demo-api.kalshi.co/trade-api/ws/v2` | [Environment list](https://docs.kalshi.com/getting_started/api_environments) |
| Production REST, read-only switch | `https://external-api.kalshi.com/trade-api/v2` | [Environment list](https://docs.kalshi.com/getting_started/api_environments) |

The dated `data/probe.json` records demo REST CORS and an unsigned WebSocket HTTP 401; inspect its timestamp, not just the HTTP code. All WebSocket handshakes require [signed authentication](https://docs.kalshi.com/getting_started/quick_start_websockets). Production and demo credentials are separate. The site never holds a private key in browser code.

## Behavior and honest limits

- **Ranking:** volume × *reported* face value is a face-notional proxy, **not cash paid**. Missing face values leave dollars blank and change the whole ranking to contracts. Upstream selects top contracts per topic by 24h contract volume plus open interest; this does not prove the highest-dollar events exchange-wide.
- **Alerts:** consecutive fresh observations on the same last-trade or midpoint basis; an exact absolute 10¢ threshold. Old captures and synthetic messages cannot generate real signals. Default cohort poll is 60s; a selected visible chart samples about every 5s. Between-poll reversals may be missed.
- **Charts:** actual REST read times, compatible last-trade candle closes and available exchange-timestamped trade prints; 30s/60s are real time windows, **not a complete tick tape**. Official candles are 1/60/1440-minute intervals with a 5,000-period request limit. Missing periods are not invented trades.
- **Book:** official `orderbook_fp` contains bids. YES asks complement NO bids. Nearest levels are sorted before truncation, with quantities and an exact source link on every row.
- **Paper execution:** enabled by default **only for simulation**, DEMO environment, fresh active binary $1-face contract, ask entry / side-bid exit and visible side size. Closed/paused/stale quotes cannot fill; unresolved positions wait for finalized settlement. General taker M=1 fees and $10,000 starting cash are assumptions, not account figures. No settlement fee. Fee overrides, slippage/queue/impact, cross-tab locking and continuous server execution are not modeled.
- **Account:** balance/positions and an actual submitted demo order have **not been verified by this session**. The [read-only Actions check](live/data/account-verification.json) found no credentials available to that job; global absence of keys is not inferred. Existing secret-backed collector/manual order tools remain intact; none is portrayed as a confirmed account order. No credentials are requested in chat.
- **Context:** settlement/reference links provide official context; no headline is asserted to cause a move. Verified causal-news values remain blank.
- **Persistence:** environment-isolated browser history/watch list/paper ledger; unresolved watched tickers survive cohort changes and missing tickers rotate through current/historical rechecks. Browser closure/storage loss and bounded finalized audit history limit completeness. A durable ledger and signed streaming gateway are recommendations, not delivered services.

Sources: [markets](https://docs.kalshi.com/api-reference/market/get-markets), [book](https://docs.kalshi.com/api-reference/market/get-market-orderbook), [lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle), [historical data](https://docs.kalshi.com/getting_started/historical_data), [official fees](https://kalshi.com/docs/kalshi-fee-schedule.pdf).

## Collection, provenance and Pages

```text
.github/workflows/data.yml       daily / dispatch: tools/build_snapshot.py → data/snapshot.json + probes
                                then tools/build_live_snapshot.py --verify-live
                                + separate GET-only demo-account availability job
                                → live/data/fallback-snapshot.json
.github/workflows/collect.yml    scheduled / dispatch: collector/run.py → other data/*.json + paper ledger
.github/workflows/pages.yml      push / PR: engine, static links, rendered UI and quote-integrity checks
GitHub Pages legacy main:/      publishes committed repository root; index.html points to /live/
```

The small schema-v2 browser capture is a **dated bootstrap, not live liquidity**. It records exact official URLs, original read times, selected cohort, input SHA-256, and Actions run URL when generated on a runner. `--verify-live` requires every selected ticker to be returned with matching identity. A plain adapter build only projects the committed capture; it never claims to have re-read the API. Both captures keep bounded resolution samples; full dated counts are not current live counts. Older collector outputs can be empty/stale without proving no market activity.

## Repository map

```text
index.html, live/               maintained landing and five-topic browser desk
live/assets/js/                core, data/PAPER engine, shared chart view, UI and page controllers
live/data/                     compact source-linked bootstrap
live/tests/                    DOM and quote-integrity regressions; fixtures explicitly not live data
assets/, dashboard.html, ...   parallel root snapshot terminal / custom strategy sandbox
app/                           typed collector/backtest/server modules
collector/                     scheduled signed-account-capable collector and paper engine
tools/                         capture builders, probes and verification tools
data/                          published captures, probes, scheduled feeds and provenance
tests/                         Python, archived pipeline and root frontend regressions
COORDINATION.md                ownership, conflicts, official checks, PR/deployment evidence
```

## Run and verify locally

```bash
pip install -r app/requirements.txt -r requirements.txt pytest
npm install --no-save jsdom
python3 -m http.server 8000 --bind 0.0.0.0
# Open the served /live/ page. The browser calls documented official HTTPS hosts.
```

One-shot checks (separate from the server):

```bash
python3 -m pytest -q
node live/tests/smoke.mjs
node live/tests/quote_rules.mjs
node tests/test_frontend.mjs
python3 live/tests/check_live.py
python3 tools/verify_site.py
python3 tools/check_site.py --root . --strict
python3 scripts/check_site.py
# Network capture, when the official demo API is reachable:
python3 tools/build_live_snapshot.py --verify-live
```

The site has no build step, external font/CDN or private signing keys. Current merge/check/Pages outcomes are in [`live/release-verification.json`](live/release-verification.json); a unit-test pass is not proof of API connectivity or authenticated execution.

## Audit archives

Earlier generations are preserved at `docs/`, `site/`, `dash/`, `pages/`, `topics/`, `observatory/` and the `main-site-*` / `earlier-*` files. Some contain formerly fabricated tickers, illustrative news or unsupported performance. Not every archive has a warning banner. Do not cite their numbers as current verified market facts. The retracted golf-classification accusation, corrected ladder arithmetic and other historical findings remain in [`VERIFICATION_REPORT.md`](VERIFICATION_REPORT.md), root [`flagged.html`](flagged.html) and [`COORDINATION.md`](COORDINATION.md), rather than being silently erased.

Review is published and non-blocking: unavailable account access, causal evidence or exhaustive rankings stay **Flagged for Review**. Broken navigation, fabricated values and failing build checks are fixed before release.
