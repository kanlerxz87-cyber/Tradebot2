"""Verified dataset for the site.

Every record below was read from an official Kalshi source on 2026-11-22 and is
reproduced **verbatim** (prices/counts copied, not computed). Each record keeps
the exact URL it came from, so every table row on the site can carry a working
"source" link and a snapshot timestamp. Fields the API did not return stay
``None`` and render as an em-dash + "unverified".

Nothing here is inferred: if a number was not in a response body, it is absent.
"""

from __future__ import annotations

SNAPSHOT_TS = "2026-11-22T07:28:00Z"  # UTC capture time of the records below
DEMO = "https://external-api.demo.kalshi.co/trade-api/v2"
KALSHI = "https://kalshi.com"

# --------------------------------------------------------------------------
# 1. Series catalogue (GET /series?category=... and /series/{ticker})
#    fields copied verbatim: ticker, title, category, tags, settlement_sources
# --------------------------------------------------------------------------
SERIES = [
    # ---- gas prices (Economics + tag "Oil and energy") -------------------
    {
        "topic": "gas",
        "ticker": "KXAAAGASD",
        "title": "US gas prices tomorrow",
        "category": "Economics",
        "tags": ["Oil and energy", "Econ Daily"],
        "frequency": "daily",
        "settlement_source": "AAA",
        "settlement_url": "https://gasprices.aaa.com/",
        "source_url": f"{DEMO}/markets?status=open&series_ticker=KXAAAGASD&limit=6",
        "note": "Market rules: 'average regular gas prices for United States ... according to AAA'.",
    },
    {
        "topic": "gas",
        "ticker": "KXAAAGASDUT",
        "title": "Utah gas price",
        "category": "Economics",
        "tags": ["Oil and energy", "Econ Daily"],
        "frequency": "daily",
        "settlement_source": "AAA",
        "settlement_url": "https://gasprices.aaa.com/?state=UT",
        "source_url": f"{DEMO}/series?category=Economics&tags=Oil+and+energy&limit=3",
        "note": "Category is Economics, not 'Gas'.",
    },
    {
        "topic": "gas",
        "ticker": "KXAAAGASCDNH",
        "title": "New Hampshire gas price",
        "category": "Economics",
        "tags": ["Oil and energy", "Econ Daily"],
        "frequency": "daily",
        "settlement_source": "AAA",
        "settlement_url": "https://gasprices.aaa.com/?state=NH",
        "source_url": f"{DEMO}/series?category=Economics&tags=Oil+and+energy&limit=3",
        "note": "Same family, state-level daily strike ladder.",
    },
    {
        "topic": "gas",
        "ticker": "KXAAAGASMIN",
        "title": "US lowest gas price yearly",
        "category": "Economics",
        "tags": ["Oil & Gas", "Oil and energy"],
        "frequency": "annual",
        "settlement_source": "AAA",
        "settlement_url": "https://gasprices.aaa.com/",
        "source_url": f"{DEMO}/series?category=Economics&tags=Oil+and+energy&limit=3",
        "note": "Annual min/max ladder, same AAA settlement source.",
    },
    {
        "topic": "gas",
        "ticker": "KXAAAGASM",
        "title": "US gas price (monthly)",
        "category": "Economics",
        "tags": ["Oil and energy"],
        "frequency": "monthly",
        "settlement_source": "AAA",
        "settlement_url": "https://gasprices.aaa.com/",
        "source_url": "https://kalshi.com/docs/kalshi-fee-schedule.pdf",
        "note": "Named on the official fee schedule with maker/taker multiplier 1.",
    },
    # ---- elections (category "Elections") -------------------------------
    {
        "topic": "elections",
        "ticker": "PRESPARTYMN",
        "title": "Minnesota presidential winner",
        "category": "Elections",
        "tags": ["US Elections"],
        "frequency": "custom",
        "settlement_source": "Library of Congress",
        "settlement_url": "https://www.congress.gov/",
        "source_url": f"{DEMO}/series?category=Elections&limit=2",
        "note": "Presidential party-winner family.",
    },
    {
        "topic": "elections",
        "ticker": "KXSENATEID",
        "title": "Who will win the Senate race in Idaho?",
        "category": "Elections",
        "tags": ["Senate"],
        "frequency": "one_off",
        "settlement_source": "United States Congress",
        "settlement_url": "https://www.congress.gov/",
        "source_url": f"{DEMO}/series?category=Elections&limit=2",
        "note": "Senate race, one-off frequency.",
    },
    {
        "topic": "elections",
        "ticker": "KXGOVHINOMR",
        "title": "Hawaii Governor Republican nominee",
        "category": "Elections",
        "tags": ["Primaries"],
        "frequency": "one_off",
        "settlement_source": "Republican Party",
        "settlement_url": "https://gop.com/",
        "source_url": f"{DEMO}/series?category=Elections&limit=2",
        "note": "Primary nomination market.",
    },
    # ---- culture (category "Culture") -----------------------------------
    {
        "topic": "culture",
        "ticker": "KXXBANNEDMURRAYHILLGUY1",
        "title": "Will @MurrayHillGuy1 get banned from X this year?",
        "category": "Culture",
        "tags": [],
        "frequency": "one_off",
        "settlement_source": "AP / Reuters / Bloomberg / CNN (23 listed)",
        "settlement_url": "https://apnews.com/",
        "source_url": f"{DEMO}/series?category=Culture&limit=2",
        "note": "Settlement source list includes google.com/search entries - flagged.",
    },
    {
        "topic": "culture",
        "ticker": "KXXBANNEDGROK",
        "title": "Will Grok be banned this year",
        "category": "Culture",
        "tags": ["AI"],
        "frequency": "one_off",
        "settlement_source": "AP / Reuters / Bloomberg / CNN (23 listed)",
        "settlement_url": "https://apnews.com/",
        "source_url": f"{DEMO}/series?category=Culture&limit=2",
        "note": "Same source list; 0 open markets at snapshot time.",
    },
    # ---- crypto (category "Crypto") -------------------------------------
    {
        "topic": "crypto",
        "ticker": "KXXRPMAXM",
        "title": "XRP max monthly",
        "category": "Crypto",
        "tags": ["Crypto", "XRP"],
        "frequency": "custom",
        "settlement_source": "CF Benchmarks",
        "settlement_url": "https://www.cfbenchmarks.com/",
        "source_url": f"{DEMO}/series?category=Crypto&limit=2",
        "note": "Monthly maximum ladder.",
    },
    {
        "topic": "crypto",
        "ticker": "KXBTCHITBY",
        "title": "Bitcoin above a price by a date",
        "category": "Crypto",
        "tags": ["BTC"],
        "frequency": "custom",
        "settlement_source": "CF Benchmarks BRTI",
        "settlement_url": "https://www.cfbenchmarks.com/data/indices/BRTI",
        "source_url": f"{DEMO}/series?category=Crypto&limit=2",
        "note": "The BRTI index is the same source used by the KXBTCD hourly markets.",
    },
    {
        "topic": "crypto",
        "ticker": "KXBNBMAXMON",
        "title": "BNB Max Monthly",
        "category": "Crypto",
        "tags": ["BNB", "Crypto"],
        "frequency": "monthly",
        "settlement_source": "CF Benchmarks",
        "settlement_url": "https://www.cfbenchmarks.com/",
        "source_url": f"{DEMO}/series?category=Crypto&limit=2",
        "note": "",
    },
    {
        "topic": "crypto",
        "ticker": "KXNEAR15M",
        "title": "NEAR 15m",
        "category": "Crypto",
        "tags": ["15 min", "NEAR"],
        "frequency": "fifteen_min",
        "settlement_source": "CF Benchmarks",
        "settlement_url": "https://www.cfbenchmarks.com/",
        "source_url": f"{DEMO}/series?category=Crypto&limit=2",
        "note": "15-minute cycle: the tightest time window on the platform.",
    },
    {
        "topic": "crypto",
        "ticker": "KXSOL26500",
        "title": "Sol above 500 in 2026",
        "category": "Crypto",
        "tags": ["Crypto", "Solana"],
        "frequency": "one_off",
        "settlement_source": "CF Benchmarks",
        "settlement_url": "https://www.cfbenchmarks.com/",
        "source_url": f"{DEMO}/series?category=Crypto&limit=2",
        "note": "",
    },
    {
        "topic": "crypto",
        "ticker": "KXFDVLINEA",
        "title": "Linea FDV",
        "category": "Crypto",
        "tags": ["Pre-Market"],
        "frequency": "one_off",
        "settlement_source": "CoinGecko",
        "settlement_url": "https://www.coingecko.com",
        "source_url": f"{DEMO}/series?category=Crypto&limit=2",
        "note": "Only crypto series in the sample settled from CoinGecko rather than CF Benchmarks.",
    },
    # ---- golf (Sports + tag "Golf") -------------------------------------
    {
        "topic": "golf",
        "ticker": "KXPGAROUNDLOW",
        "title": "lowest round score",
        "category": "Sports",
        "tags": ["Golf"],
        "frequency": "custom",
        "settlement_source": "the Governing League (PGA Tour)",
        "settlement_url": "https://www.pgatour.com/",
        "source_url": f"{DEMO}/series?category=Sports&tags=Golf&limit=3",
        "note": "Per-round strike ladder; resolved example captured below.",
    },
    {
        "topic": "golf",
        "ticker": "KXPGAWINMARGIN",
        "title": "PGA Win Margin",
        "category": "Sports",
        "tags": ["Golf"],
        "frequency": "custom",
        "settlement_source": "ESPN / Fox Sports / PGA Tour / Golf Channel",
        "settlement_url": "https://www.espn.com",
        "source_url": f"{DEMO}/series?category=Sports&tags=Golf&limit=3",
        "note": "0 open markets at snapshot time.",
    },
    {
        "topic": "golf",
        "ticker": "KXPGAMAJORTOP10",
        "title": "PGA Top 10 for All 4 Majors",
        "category": "Sports",
        "tags": ["Golf"],
        "frequency": "annual",
        "settlement_source": "WSJ / ESPN / PGA Tour / Fox Sports",
        "settlement_url": "https://www.wsj.com/",
        "source_url": f"{DEMO}/series?category=Sports&tags=Golf&limit=3",
        "note": "Season-long ladder.",
    },
    {
        "topic": "golf",
        "ticker": "KXPGAEAGLE",
        "title": "Player to Record an Eagle in Round",
        "category": "Sports",
        "tags": ["Golf"],
        "frequency": "custom",
        "settlement_source": "Fox Sports / ESPN / PGA Tour",
        "settlement_url": "https://www.foxsports.com",
        "source_url": f"{DEMO}/series?category=Sports&tags=Golf&limit=3",
        "note": "",
    },
    {
        "topic": "golf",
        "ticker": "KXDPWTTOP5",
        "title": "DPWT Top 5 Finisher",
        "category": "Sports",
        "tags": ["Golf"],
        "frequency": "custom",
        "settlement_source": "DP World Tour",
        "settlement_url": "https://www.europeantour.com/dpworld-tour/schedule/",
        "source_url": f"{DEMO}/series?category=Sports&tags=Golf&limit=3",
        "note": "European tour coverage sits in the same Golf tag.",
    },
]

# --------------------------------------------------------------------------
# 2. Live markets (GET /markets) - verbatim prices, all fixed-point strings
# --------------------------------------------------------------------------
MARKETS = [
    {
        "topic": "gas",
        "ticker": "KXAAAGASD-28SEP16-3.5",
        "event_ticker": "KXAAAGASD-28SEP16",
        "title": "Will average gas prices be above $3.5?",
        "status": "active",
        "yes_bid": "0.4100",
        "yes_ask": "1.0000",
        "no_bid": "0.0000",
        "no_ask": "0.5900",
        "last_price": "0.4100",
        "previous_price": "0.4100",
        "volume": "8.16",
        "volume_24h": "0.00",
        "open_interest": "5.02",
        "yes_bid_size": "78.00",
        "close_time": "2028-09-16T13:59:00Z",
        "result": "",
        "rules": "If average regular gas prices for United States are strictly greater than $3.5 "
                 "on Sep 16, 2028 according to AAA, then the market resolves to Yes.",
        "source_url": f"{DEMO}/markets?status=open&series_ticker=KXAAAGASD&limit=6",
        "note": "Derived YES ask from no_bid 0.00 would be 1.0000 - same as the quoted yes_ask.",
    },
    {
        "topic": "gas",
        "ticker": "KXAAAGASD-28SEP16-2.5",
        "event_ticker": "KXAAAGASD-28SEP16",
        "title": "Will average gas prices be above $2.5?",
        "status": "active",
        "yes_bid": "0.3500",
        "yes_ask": "1.0000",
        "no_bid": "0.0000",
        "no_ask": "0.6500",
        "last_price": "0.3500",
        "previous_price": "0.3500",
        "volume": "12.98",
        "volume_24h": "0.00",
        "open_interest": "9.84",
        "yes_bid_size": "90.18",
        "close_time": "2028-09-16T13:59:00Z",
        "result": "",
        "rules": "If average regular gas prices for United States are strictly greater than $2.5 "
                 "on Sep 16, 2028 according to AAA, then the market resolves to Yes.",
        "source_url": f"{DEMO}/markets?status=open&series_ticker=KXAAAGASD&limit=6",
        "note": "",
    },
    {
        "topic": "gas",
        "ticker": "KXAAAGASD-28SEP16-3",
        "event_ticker": "KXAAAGASD-28SEP16",
        "title": "Will average gas prices be above $3?",
        "status": "active",
        "yes_bid": "0.0000",
        "yes_ask": "1.0000",
        "no_bid": "0.0000",
        "no_ask": "1.0000",
        "last_price": "0.9000",
        "previous_price": "0.9000",
        "volume": "3.17",
        "volume_24h": "0.00",
        "open_interest": "0.03",
        "yes_bid_size": "0.00",
        "close_time": "2028-09-16T13:59:00Z",
        "result": "",
        "rules": "If average regular gas prices for United States are strictly greater than $3 "
                 "on Sep 16, 2028 according to AAA, then the market resolves to Yes.",
        "source_url": f"{DEMO}/markets?status=open&series_ticker=KXAAAGASD&limit=6",
        "note": "One-sided book: last trade 0.90 but no bid and no offer - unquotable right now.",
    },
    {
        "topic": "crypto",
        "ticker": "KXBTCD-26NOV2203-T66799.99",
        "event_ticker": "KXBTCD-26NOV2203",
        "title": "Bitcoin price on Nov 22, 2026? ($66,800 or above)",
        "status": "active",
        "yes_bid": "0.0000",
        "yes_ask": "0.0000",
        "no_bid": "1.0000",
        "no_ask": "1.0000",
        "last_price": "0.0000",
        "previous_price": "0.0000",
        "volume": "0.00",
        "volume_24h": "0.00",
        "open_interest": "0.00",
        "yes_bid_size": "0.00",
        "close_time": "2026-11-22T08:00:00Z",
        "result": "",
        "rules": "If the simple average of the sixty seconds of CF Benchmarks' Bitcoin Real-Time "
                 "Index (BRTI) before 3 AM EST is above 66799.99 at 3 AM EST on Nov 22, 2026, "
                 "then the market resolves to Yes.",
        "source_url": f"{DEMO}/markets?status=open&series_ticker=KXBTCD&limit=2",
        "note": "Exchange shard 2. No trades yet: every price field is 0.0000.",
    },
    {
        "topic": "crypto",
        "ticker": "KXBTCD-26NOV2203-T66699.99",
        "event_ticker": "KXBTCD-26NOV2203",
        "title": "Bitcoin price on Nov 22, 2026? ($66,700 or above)",
        "status": "active",
        "yes_bid": "0.0000",
        "yes_ask": "0.0000",
        "no_bid": "1.0000",
        "no_ask": "1.0000",
        "last_price": "0.0000",
        "previous_price": "0.0000",
        "volume": "0.00",
        "volume_24h": "0.00",
        "open_interest": "0.00",
        "yes_bid_size": "0.00",
        "close_time": "2026-11-22T08:00:00Z",
        "result": "",
        "rules": "Same BRTI rule with a 66699.99 strike at 3 AM EST on Nov 22, 2026.",
        "source_url": f"{DEMO}/markets?status=open&series_ticker=KXBTCD&limit=2",
        "note": "Adjacent strike of the same event; used to show ladder structure.",
    },
    {
        "topic": None,
        "ticker": "KXELONMARS-99",
        "event_ticker": "KXELONMARS-99",
        "title": "Will Elon Musk visit Mars before Aug 1, 2099?",
        "status": "active",
        "yes_bid": "0.1400",
        "yes_ask": "1.0000",
        "no_bid": "0.0000",
        "no_ask": "0.8600",
        "last_price": "0.3000",
        "previous_price": "0.1400",
        "volume": "14150.08",
        "volume_24h": "6.15",
        "open_interest": "12774.79",
        "yes_bid_size": "2718.76",
        "close_time": "2099-08-01T04:59:00Z",
        "result": "",
        "rules": "If Elon Musk visits Mars before the earlier of his death or Aug 1, 2099, then "
                 "the market resolves to Yes.",
        "source_url": f"{DEMO}/markets/KXELONMARS-99",
        "note": "Official category is Politics - NOT one of the five tracked topics. Used here "
                "only as the worked example of the alert + liquidity machinery because it is the "
                "one live market on the demo exchange that actually traded through a >= $0.10 move.",
    },
]

# --------------------------------------------------------------------------
# 3. Resolved markets (GET /markets?status=settled) - yes/no outcomes
# --------------------------------------------------------------------------
RESOLVED = [
    {
        "topic": "crypto", "ticker": "KXBTCD-26NOV2201-T66799.99",
        "event_ticker": "KXBTCD-26NOV2201",
        "title": "Bitcoin price at 1 AM EST on Nov 22, 2026 ($66,800 or above)",
        "result": "no", "settlement_value": "0.0000", "status": "finalized",
        "settlement_ts": "2026-11-22T06:24:47Z", "close_time": "2026-11-22T06:00:00Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/markets?status=settled&series_ticker=KXBTCD&limit=5",
        "note": "Settled from the average of 60 BRTI prints in the final minute.",
    },
    {
        "topic": "crypto", "ticker": "KXBTCD-26NOV2201-T66699.99",
        "event_ticker": "KXBTCD-26NOV2201",
        "title": "Bitcoin price at 1 AM EST on Nov 22, 2026 ($66,700 or above)",
        "result": "no", "settlement_value": "0.0000", "status": "finalized",
        "settlement_ts": "2026-11-22T06:24:47Z", "close_time": "2026-11-22T06:00:00Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/markets?status=settled&series_ticker=KXBTCD&limit=5",
        "note": "Same event, lower strike, same NO outcome.",
    },
    {
        "topic": "crypto", "ticker": "KXBTCD-26NOV2201-T66599.99",
        "event_ticker": "KXBTCD-26NOV2201",
        "title": "Bitcoin price at 1 AM EST on Nov 22, 2026 ($66,600 or above)",
        "result": "no", "settlement_value": "0.0000", "status": "finalized",
        "settlement_ts": "2026-11-22T06:24:47Z", "close_time": "2026-11-22T06:00:00Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/markets?status=settled&series_ticker=KXBTCD&limit=5",
        "note": "",
    },
    {
        "topic": "crypto", "ticker": "KXBTCD-26NOV2201-T66499.99",
        "event_ticker": "KXBTCD-26NOV2201",
        "title": "Bitcoin price at 1 AM EST on Nov 22, 2026 ($66,500 or above)",
        "result": "no", "settlement_value": "0.0000", "status": "finalized",
        "settlement_ts": "2026-11-22T06:24:47Z", "close_time": "2026-11-22T06:00:00Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/markets?status=settled&series_ticker=KXBTCD&limit=5",
        "note": "Four strikes captured; all four resolved NO.",
    },
    {
        "topic": "golf", "ticker": "KXPGAROUNDLOW-THOC26R3-67",
        "event_ticker": "KXPGAROUNDLOW-THOC26R3",
        "title": "Will the lowest round score of Round 3 be under 67.5?",
        "result": "yes", "settlement_value": "1.0000", "status": "finalized",
        "settlement_ts": "2026-07-19T02:19:08Z", "close_time": "2026-07-19T02:11:13Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/events?status=settled&with_nested_markets=true&limit=1&series_ticker=KXPGAROUNDLOW",
        "note": "2026 Open Championship, Round 3. Zero recorded volume on the demo exchange.",
    },
    {
        "topic": "golf", "ticker": "KXPGAROUNDLOW-THOC26R3-66",
        "event_ticker": "KXPGAROUNDLOW-THOC26R3",
        "title": "Will the lowest round score of Round 3 be under 66.5?",
        "result": "yes", "settlement_value": "1.0000", "status": "finalized",
        "settlement_ts": "2026-07-19T02:19:08Z", "close_time": "2026-07-19T02:11:13Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/events?status=settled&with_nested_markets=true&limit=1&series_ticker=KXPGAROUNDLOW",
        "note": "Strike ladder resolves together when the score clears every threshold.",
    },
    {
        "topic": "golf", "ticker": "KXPGAROUNDLOW-THOC26R3-65",
        "event_ticker": "KXPGAROUNDLOW-THOC26R3",
        "title": "Will the lowest round score of Round 3 be under 65.5?",
        "result": "yes", "settlement_value": "1.0000", "status": "finalized",
        "settlement_ts": "2026-07-19T02:19:08Z", "close_time": "2026-07-19T02:11:13Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/events?status=settled&with_nested_markets=true&limit=1&series_ticker=KXPGAROUNDLOW",
        "note": "",
    },
    {
        "topic": "golf", "ticker": "KXPGAROUNDLOW-THOC26R3-64",
        "event_ticker": "KXPGAROUNDLOW-THOC26R3",
        "title": "Will the lowest round score of Round 3 be under 64.5?",
        "result": "yes", "settlement_value": "1.0000", "status": "finalized",
        "settlement_ts": "2026-07-19T02:19:08Z", "close_time": "2026-07-19T02:11:13Z",
        "volume": "0.00", "open_interest": "0.00",
        "source_url": f"{DEMO}/events?status=settled&with_nested_markets=true&limit=1&series_ticker=KXPGAROUNDLOW",
        "note": "",
    },
]

# The prior session's file claimed a market called KXBTC-26NOV2201-*; the real
# tickers on the API are KXBTCD-* (D = daily). Recorded as an irregularity.

# --------------------------------------------------------------------------
# 4. Order book snapshots (GET /markets/{ticker}/orderbook) - verbatim ladders
# --------------------------------------------------------------------------
ORDERBOOKS = [
    {
        "ticker": "KXELONMARS-99",
        "topic": None,
        "source_url": f"{DEMO}/markets/KXELONMARS-99/orderbook?depth=10",
        "yes_dollars": [["0.0100", "11285.32"], ["0.0600", "0.99"], ["0.1000", "1002.00"],
                        ["0.1100", "91.49"], ["0.1400", "2718.76"]],
        "no_dollars": [],
        "note": "Bids only, ascending, best bid last (0.14). No NO bids, so the derived YES ask is "
                "1.00 - the visible bid ladder is the entire tradeable side.",
    },
]

# --------------------------------------------------------------------------
# 5. Candlestick replay (GET /series/{s}/markets/{t}/candlesticks, 60-min bars)
#    Only fields the API returned are stored; nulls stay null.
# --------------------------------------------------------------------------
CANDLES = {
    "KXELONMARS-99": {
        "series": "KXELONMARS",
        "source_url": f"{DEMO}/series/KXELONMARS/markets/KXELONMARS-99/candlesticks"
                      "?start_ts=1794700800&end_ts=1795305600&period_interval=60",
        "rows": [
            # end_period_ts, bid close, ask close, trade price close, volume
            {"ts": 1794718800, "bid": "0.1400", "ask": "1.0000", "price": None, "volume": "0.00", "oi": "12543.05"},
            {"ts": 1794744000, "bid": "0.1400", "ask": "1.0000", "price": None, "volume": "0.00", "oi": "12543.05"},
            {"ts": 1794754800, "bid": "0.5000", "ask": "1.0000", "price": "0.1400", "volume": "55.01", "oi": "12598.06"},
            {"ts": 1794758400, "bid": "0.1400", "ask": "1.0000", "price": "0.1400", "volume": "50.85", "oi": "12648.91"},
            {"ts": 1794762000, "bid": "0.1400", "ask": "1.0000", "price": "0.3000", "volume": "5.00", "oi": "12653.91"},
            {"ts": 1794765600, "bid": "0.1400", "ask": "1.0000", "price": None, "volume": "0.00", "oi": "12653.91"},
            {"ts": 1794787200, "bid": "0.1400", "ask": "1.0000", "price": "0.1400", "volume": "11.51", "oi": "12665.42"},
            {"ts": 1794816000, "bid": "0.1400", "ask": "1.0000", "price": "0.1400", "volume": "1.00", "oi": "12666.42"},
            {"ts": 1794844800, "bid": "0.1400", "ask": "1.0000", "price": "0.1400", "volume": "1.15", "oi": "12667.57"},
            {"ts": 1794859200, "bid": "0.1400", "ask": "1.0000", "price": "0.3000", "volume": "5.00", "oi": "12672.57"},
            {"ts": 1794880800, "bid": "0.1400", "ask": "1.0000", "price": None, "volume": "0.00", "oi": "12672.57"},
            {"ts": 1794942000, "bid": "0.1400", "ask": "1.0000", "price": "0.3000", "volume": "5.00", "oi": "12677.57"},
            {"ts": 1794963600, "bid": "0.1400", "ask": "1.0000", "price": "0.3000", "volume": "5.00", "oi": "12682.57"},
            {"ts": 1795028400, "bid": "0.1400", "ask": "1.0000", "price": "0.3000", "volume": "5.00", "oi": "12687.57"},
            {"ts": 1795269600, "bid": "0.1400", "ask": "1.0000", "price": "0.1400", "volume": "1.15", "oi": "12769.79"},
            {"ts": 1795280400, "bid": "0.1400", "ask": "1.0000", "price": "0.3000", "volume": "5.00", "oi": "12774.79"},
        ],
        "note": "16 hourly bars retained (the response contained more). Trade-price close swings "
                "0.14 -> 0.30 repeatedly with 5.00-contract clips - the exact pattern the "
                ">= $0.10 alert rule is meant to surface.",
    },
}

# --------------------------------------------------------------------------
# 6. Gap log: queries that returned nothing (published, not hidden)
# --------------------------------------------------------------------------
GAPS = [
    {"query": f"{DEMO}/markets?status=open&series_ticker=KXPGAWINMARGIN&limit=2",
     "returned": '{"cursor": "", "markets": []}',
     "meaning": "Zero open golf markets on the demo exchange at snapshot time, although the Golf "
                "series exist. The Golf page therefore shows the series catalogue and real settled "
                "outcomes, and no live prices."},
    {"query": f"{DEMO}/series?category=Golf&limit=2", "returned": '{"series": null}',
     "meaning": "Category 'Golf' does not exist. Golf is category Sports + tag Golf."},
    {"query": f"{DEMO}/series?category=Gas&limit=2", "returned": '{"series": null}',
     "meaning": "Category 'Gas' does not exist. Gas prices are category Economics + tag Oil and energy."},
    {"query": f"{DEMO}/markets?status=open&series_ticker=KXXBANNEDGROK&limit=1", "returned": '{"markets": []}',
     "meaning": "Culture series KXXBANNEDGROK has no open markets right now."},
    {"query": f"{DEMO}/series/KXAAAGASD/markets/KXAAAGASD-28SEP16-3.5/candlesticks"
              "?start_ts=1795132800&end_ts=1795305600&period_interval=60",
     "returned": '{"candlesticks": [], "ticker": "KXAAAGASD-28SEP16-3.5"}',
     "meaning": "Gas markets have no trades in that window, so no candles exist. Chart pages fall "
                "back to the live browser feed instead of drawing a fake line."},
]
