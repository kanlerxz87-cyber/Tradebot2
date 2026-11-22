# Verification Log (line by line)

Session: `session-arena-93ec9646` · Date: 2026-11-22 · Snapshot window: ≈07:00–07:20 UTC
Rule: every value below was read from a single official response and transcribed
verbatim. `null` / "–" on the site = field absent from the verified response (never inferred).

## 1. Environment & protocol facts (docs.kalshi.com)

| # | Fact | Verified value | Source (official) |
|---|------|----------------|-------------------|
| V1 | Demo REST base | `https://external-api.demo.kalshi.co/trade-api/v2` | https://docs.kalshi.com/getting_started/api_environments |
| V2 | Demo REST alternate | `https://demo-api.kalshi.co/trade-api/v2` | same |
| V3 | Demo WS | `wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2` (alt `wss://demo-api.kalshi.co/trade-api/ws/v2`) | same |
| V4 | Demo website | `https://demo.kalshi.co/` | https://docs.kalshi.com/getting_started/demo_env |
| V5 | Demo isolation | mock funds; demo credentials never work in production | https://docs.kalshi.com/getting_started/demo_env |
| V6 | Public market data needs no auth | `GET /series/{ticker}`, `/markets?series_ticker=&status=open`, `/events/{ticker}`, `/markets/{ticker}/orderbook` | https://docs.kalshi.com/getting_started/quick_start_market_data |
| V7 | WS auth | headers `KALSHI-ACCESS-KEY`, `KALSHI-SIGNATURE`, `KALSHI-TIMESTAMP`; signature over `timestamp + "GET" + "/trade-api/ws/v2"`; public channels `ticker`, `trade`, `market_lifecycle_v2`; subscribe `{id,cmd:subscribe,params:{channels,market_tickers}}`; ping after 10s idle | https://docs.kalshi.com/getting_started/quick_start_websockets |
| V8 | Market status values | `unopened`, `open`, `closed`, `settled`; one status filter per request; `series_ticker`/`event_ticker`/timestamp filter compatibility table; newest-first ordering; cursor pagination; response cache lag (seconds) | https://docs.kalshi.com/api-reference/market/get-markets |
| V9 | Orderbook semantics | returns YES bids + NO bids only; YES bid @ p ≡ NO ask @ (1−p) same size; ascending levels, best last; `depth` 0–100; unknown ticker → 200 + empty arrays | https://docs.kalshi.com/api-reference/market/get-market-orderbook |
| V10 | Candlesticks | `GET /series/{series}/markets/{ticker}/candlesticks`; `period_interval` ∈ {1,60,1440} min; `start_ts`/`end_ts` seconds; ≤5,000 periods/request; OHLC for `price`, `yes_bid`, `yes_ask` + `volume_fp` + `open_interest_fp`; recent candles lag seconds | https://docs.kalshi.com/api-reference/market/get-market-candlesticks |
| V11 | Trades | `GET /markets/trades` with `ticker`, `min_ts`, `max_ts`, `limit` 1–1000, `cursor`; `taker_outcome_side` = 'yes' for buy-yes/sell-no; unknown ticker → 200 empty list | https://docs.kalshi.com/api-reference/market/get-trades |
| V12 | Series list | `GET /series` with `category` (matches any entry of `categories`, exact, case-sensitive) and `tags` filters; schema incl. `settlement_sources`, `fee_type` | https://docs.kalshi.com/api-reference/market/get-series-list |
| V13 | Settlement | Yes → $1/contract; No → No holders $1; net positions settled; zero settlement fee for simple yes/no | https://docs.kalshi.com/getting_started/market_settlement |
| V14 | Rate limits | token buckets (default 10 tokens); Read/Write buckets; 429 + backoff; unauthenticated limits separate; `X-RateLimit-*` headers | https://docs.kalshi.com/getting_started/rate_limits |
| V15 | Fees | quadratic fee schedule referenced by `fee_type=quadratic`; formula `0.07·C·P·(1−P)` (approximation used in paper engine — flag F11) | https://kalshi.com/docs/kalshi-fee-schedule.pdf · https://docs.kalshi.com/getting_started/fee_rounding |

## 2. Data rows (demo API, all fetched 2026-11-22 ≈07:00–07:20 UTC)

Each market row on the site carries its exact query in `src.api` (see
`assets/data.js` / `data/snapshot.json`). Highlights verified here:

| # | Item | Verified values (verbatim) | Query (official) |
|---|------|---------------------------|------------------|
| D1 | KXAAAGASW-26NOV23 ladder (6 strikes) | last $0.02 on 3.84/3.86/3.88/3.92/3.94; $0.00 on 3.90; volumes 3235.70 / 3398.05 / 3422.37 / – / 3273.51 / 3421.27; OI same as volume (3.90 → 0); close 2026-11-23T04:59Z; rule: AAA average > strike on Nov 23, 2026 | `.../markets?series_ticker=KXAAAGASW&status=open&limit=6` |
| D2 | KXSENMAJ-27 (5 markets) | Schumer 0.92 (OI 46,657.70; no_bid 0.08/no_ask 0.09); Cotton 0.90 (vol 0.01, OI 0.01); Slotkin 0.02 (vol 102,833.08, OI 78,126.83, yes_bid 0.01×5); Thune 0.00; Barrasso 0.00; close 2028-01-03T15:00Z | `.../markets?series_ticker=KXSENMAJ&status=open&limit=6` |
| D3 | KXCONTROLH-2030 (R & D) | both last 0.00, yes_bid 0.01×100, no_ask 0.99; close 2031-02-01T15:00Z; rule per market (Speaker party on Feb 1 2031 / media-consensus early) | `.../markets?series_ticker=KXCONTROLH&status=open&limit=5` |
| D4 | KXNETFLIXRANKSHOWGLOBAL-26NOV23 (4 markets) | The Body S1 0.73 (OI 18, yes_ask 0.73); Altruists 0.00; One About Matthew Perry 0.00; Win the Mall 0.00; close 2026-11-24T04:59Z | `.../markets?series_ticker=KXNETFLIXRANKSHOWGLOBAL&status=open&limit=6` |
| D5 | KXGTAONLINE-GTA6ONLINE (4 markets) | May 2027 0.54 (vol 1228.95); Feb 2027 0.00 (prev bid 0.21/ask 0.27); 2028 0.84 (vol 3540.14, OI 3362.58, vol24h 3.02, yes_bid 0.80/ask 0.85); Jul 2027 0.70 (vol 3473.40, OI 3473.40, yes_bid 0.69, no_bid 0.25) | `.../markets?series_ticker=KXGTAONLINE&status=open&limit=4` |
| D6 | KXBTCD-26NOV2203 (ladder) | $66,800/$66,700/$66,600/$66,500/$66,400 legs all last 0.00, no quotes, close 2026-11-22T08:00Z (3 AM ET fix) | `.../markets?series_ticker=KXBTCD&status=open&limit=6` |
| D7 | KXSOL15M-26NOV220215-15 | active; floor_strike 69.0603; no quotes yet; close 2026-11-22T07:15Z; target "SOL price up in next 15 mins?" | `.../markets?series_ticker=KXSOL15M&status=open&limit=5` — same response also contained a `status:"closed"` May-2026 market ⇒ flag F5 |
| D8 | BTC/ETH/DOGE/HYPE 15-min 26NOV201900 | all settled `no` at 2026-11-21T00:00:05Z; BTC last 0.003, vol 671.59, OI 398.77, target $58,870.00; ETH last 0.05, vol 6, OI 6, target $1,620.57; DOGE last 0.00, vol 0, target $0.0543823; HYPE last 0.00, target $60.9842 | `.../markets?min_updated_ts=1795219200&limit=100` |
| D9 | KXBTCMAXY-26DEC31 (4 legs) | 99,999.99: 0.07, vol 2410.06, OI 959.02, yes_ask 0.07×2, no_bid 0.93; 109,999.99: 0.50, vol 3667.17, OI 905.01; 139,999.99: 0.72 (vol/OI truncated in fetch ⇒ "–", flag F9); 149,999.99: 0.20, vol 1304.17, OI 1171.06 ⇒ ladder non-monotonic (flag F7) | `.../markets?series_ticker=KXBTCMAXY&limit=4` |
| D10 | KXPRESCUP-26 (3 markets) | USA settled YES (last 0.47, vol 393,982.30, OI 204,731.26); World settled NO (last 0.44, vol 2,303,649.62, OI 1,167,461.30); Tie settled NO (last 0.10, vol 1,520,095.85, OI 1,065,996.19); all settled 2026-09-27T22:39:41Z; `custom_strike:{"demo strike":"demo strike"}` on all | `.../markets?series_ticker=KXPRESCUP&limit=3` |
| D11 | KXPGAMAKECUT-THRC26 (3 shown) | Haas/Streb/Brehm all settled NO, 2026-11-20T22:08:50Z, vol 0 | `.../markets?series_ticker=KXPGAMAKECUT&limit=8` |
| D12 | KXGA14SPECIAL1ROUND-26MAR10 | settled NO 2026-03-13T02:14:44Z; last 0.98, vol 33, OI 28 | `.../markets?series_ticker=KXGA14SPECIAL1ROUND&limit=8` |
| D13 | NOBELLIT-24 (4 of 53) | Murnane YES + Can Xue YES (two YES in one MEC event ⇒ flag F6); Pynchon NO; Ulitskaya NO; settlement_ts 2026-11-05 (odd ⇒ flag F12) | `.../markets?series_ticker=NOBELLIT&limit=4` |
| D14 | Candlesticks KXBTC15M-26NOV201900-00 | 15 one-minute bars, 1795218360→1795219200; price 0.51 → 0.003; full OHLCV in `assets/data.js` (verbatim) | `.../series/KXBTC15M/markets/KXBTC15M-26NOV201900-00/candlesticks?start_ts=1795216500&end_ts=1795219205&period_interval=1` |
| D15 | Trades KXBTC15M-26NOV201900-00 | 10 trades 23:55:33→23:59:07 UTC incl. 2×2 YES@0.025, 9.8 YES@0.020, NO cluster 0.008–0.017 (verbatim in `assets/data.js`) | `.../markets/trades?ticker=KXBTC15M-26NOV201900-00&limit=10` |
| D16 | Orderbooks | KXCONTROLH-2030-R: yes [[0.01,100]], no []; KXBTCMAXY-26DEC31-99999.99: yes [], no [[0.93,2]] | `.../markets/KXCONTROLH-2030-R/orderbook?depth=10` · `.../markets/KXBTCMAXY-26DEC31-99999.99/orderbook?depth=10` |
| D17 | Series census | KXGAS "Gas weekly" (EIA) 0 markets; DIESEL/DIESELM (EIA) 0 markets; KXBBMARTIST 0; KXRTFIRSTOMEN 0; KXRIPPLED 0; KXGAS open events = 0; Golf/Elections/Crypto/Entertainment series lists with settlement sources | `.../series/KXGAS`, `.../series?tags=Gas&limit=10`, `.../series?tags=Golf&limit=100`, `.../series?category=Elections&limit=10`, `.../series?category=Crypto&limit=10`, `.../series?category=Entertainment&limit=5`, `.../events?series_ticker=KXGAS&status=open&limit=3` |
| D18 | demo.kalshi.co homepage | URL patterns; display values: Gas $3.65 (+0.5% 1D), BTC $60,078.94, ETH $919.58, Senate Majority Leader $434,922 vol, GTA VI $28,123 vol, Billboard #1 "Choosin' Texas" 97%, Netflix #1 "The Body: S1" 73%; narrative "Democrats won control of the Senate in the midterms" | https://demo.kalshi.co/ (fetched 2026-11-22) |

## 3. Irregularities observed (→ flagged/index.html)

| Flag | Observation | Evidence |
|------|-------------|----------|
| F1 | Sandbox cannot reach Kalshi hosts at TLS level (`SSL_ERROR_SYSCALL`); data fetched via platform page fetcher | curl verbose output, 2026-11-22 |
| F2 | No demo API keys in session ⇒ no real order placement possible | https://docs.kalshi.com/getting_started/api_keys |
| F3 | Demo = sparse synthetic subset; `"demo strike":"demo strike"` markers; several series empty | D10, D13, D17 |
| F4 | Browser CORS to demo API untestable from sandbox ⇒ live/replay dual mode | — |
| F5 | `status=open` query returned a `status:"closed"` market | D7 |
| F6 | Two YES legs in mutually-exclusive NOBELLIT-24 | D13 |
| F7 | KXBTCMAXY ladder non-monotonic (0.50 at higher strike than 0.72 leg) | D9 |
| F8 | `GET /events` ignored `category`/`limit` (identical responses) | observed 3 identical queries |
| F9 | KXBTCMAXY-26DEC31-139999.99 vol/OI truncated in fetch ⇒ left "–" | D9 |
| F10 | Website URL pattern not documented in API docs; only homepage-observed URLs linked | https://demo.kalshi.co/ |
| F11 | Fee model approximation in paper engine | V15 |
| F12 | Settlement timestamps years after close in demo | D13 |

## 4. Site build verification

- Internal links: 13 HTML pages, all href/src targets exist on disk (`node tools/build.js`, exit 0).
- External links: only official URLs used (docs.kalshi.com, external-api.demo.kalshi.co,
  demo.kalshi.co observed URLs, kalshi.com fee PDF, settlement sources listed by the API,
  repo URL). Every external URL in this log was fetched in-session.
- JS: all `assets/*.js`, `tools/*.js`, and every inline `<script>` block pass `node --check`.
- Runtime: data/render/sim/live/layout exercised under a DOM stub — 5 simulated trades
  (3 closed: −$11.85, +$2.57, −$49.07), alert pipeline: 0.34→0.19 PASS (edge $0.21),
  0.50→0.42 correctly NOT alerted (< $0.10).
