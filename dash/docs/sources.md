# Sources (repo-level index)

The human-readable, linked source pages live on the site:
- **Sources page (manual review)**: `docs/sources/index.html` → https://<pages-host>/docs/sources/
- **Verification log (line by line)**: `docs/verification.md`
- **Flagged for Review**: `flagged/index.html`

## Official documentation (all fetched 2026-11-22)

1. https://docs.kalshi.com/ — docs home
2. https://docs.kalshi.com/getting_started/api_environments — prod/demo REST+WS URLs, signing
3. https://docs.kalshi.com/getting_started/demo_env — demo site, mock funds, isolation
4. https://docs.kalshi.com/getting_started/quick_start_market_data — unauthenticated market data
5. https://docs.kalshi.com/getting_started/quick_start_websockets — WS auth, channels, subscribe
6. https://docs.kalshi.com/api-reference/market/get-markets — status/filter/pagination semantics
7. https://docs.kalshi.com/api-reference/market/get-market-orderbook — book semantics (bids only)
8. https://docs.kalshi.com/api-reference/market/get-market-candlesticks — 1/60/1440-min candles
9. https://docs.kalshi.com/api-reference/market/get-trades — global trades endpoint + filters
10. https://docs.kalshi.com/api-reference/market/get-series-list — series category/tags filters
11. https://docs.kalshi.com/getting_started/market_settlement — $1/$0 payout semantics
12. https://docs.kalshi.com/getting_started/rate_limits — token buckets, 429 handling
13. https://docs.kalshi.com/getting_started/api_keys — RSA signing, key isolation
14. https://docs.kalshi.com/getting_started/pagination — cursor semantics
15. https://docs.kalshi.com/llms.txt — full doc index used to locate pages
16. https://kalshi.com/docs/kalshi-fee-schedule.pdf — quadratic fee formula
17. https://docs.kalshi.com/getting_started/fee_rounding — fee rounding

## Official demo API queries (data rows)

Every row-level query is embedded per-record in `assets/data.js` / `data/snapshot.json`
(`src.api` field) and linked on each table row of the site. The complete list is
reproduced on the site Sources page (`docs/sources/index.html`) and in
`docs/verification.md` §2.

## Official website pages observed (demo.kalshi.co)

- https://demo.kalshi.co/ (homepage — URL patterns + display values)
- https://demo.kalshi.co/markets/kxsenmaj/120th-congress-who-will-be-elected-senate-majority-leader/kxsenmaj-27
- https://demo.kalshi.co/markets/kxaaagasw/us-gas-price-up/kxaaagasw-26nov23
- https://demo.kalshi.co/markets/kxgtaonline/when-will-gta-vi-release/kxgtaonline-gta6online
- https://demo.kalshi.co/markets/kxnetflixrankshowglobal/netflix-tv-ranking/kxnetflixrankshowglobal-26nov23
- https://demo.kalshi.co/markets/kxbtcd/bitcoin-price-abovebelow/kxbtcd-26nov2717
- category pages observed: /category/elections/us-elections, /category/culture/video-games, /category/politics/cabinet-staff

## Settlement sources (as returned by the API's `settlement_sources`)

EIA gas: https://www.eia.gov/dnav/pet/PET_PRI_GND_DCUS_NUS_W.htm
EIA diesel: https://www.eia.gov/dnav/pet/PET_PRI_SPT_S1_D.htm
AAA: https://www.aaa.com/gasprices/
CF Benchmarks BRTI: https://www.cfbenchmarks.com/data/indices/BRTI
CF Benchmarks (general): https://www.cfbenchmarks.com/
U.S. Senate: https://www.senate.gov/
Library of Congress: https://www.congress.gov/
PGA Tour: https://www.pgatour.com/
ESPN: https://www.espn.com
Rockstar Games: https://www.rockstargames.com/
Netflix Top 10: https://www.netflix.com/tudum/top10
Nobel Prize: https://www.nobelprize.org/
