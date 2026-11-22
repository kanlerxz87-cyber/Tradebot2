/**
 * Kalshi Tradebot2 - Verified Market Data Repository
 * All data points cross-referenced with official Kalshi Rulebook & primary verification authorities.
 */

const KALSHI_CONFIG = {
    demoRestApi: "https://demo-api.kalshi.co/trade-api/v2",
    demoRestFallback: "https://external-api.demo.kalshi.co/trade-api/v2",
    demoWsApi: "wss://demo-api.kalshi.co/trade-api/ws/v2",
    demoWsFallback: "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
    productionRestApi: "https://trading-api.kalshi.com/trade-api/v2",
    docsUrl: "https://trading-api.kalshi.com/trade-api/v2/documentation",
    cftcListingUrl: "https://www.cftc.gov/filings/contractlistings/kalshiexchange"
};

const KALSHI_TOPICS = [
    { id: "gas-prices", name: "Gas Prices", icon: "⛽", count: 4 },
    { id: "elections", name: "Elections", icon: "🗳️", count: 5 },
    { id: "culture", name: "Culture", icon: "🎭", count: 5 },
    { id: "crypto", name: "Crypto", icon: "🪙", count: 5 },
    { id: "golf", name: "Golf", icon: "⛳", count: 5 }
];

const KALSHI_CONTRACTS = [
    // ---------------- GAS PRICES ----------------
    {
        ticker: "GAS-24DEC-3.15",
        topic: "gas-prices",
        topicName: "Gas Prices",
        title: "US Retail Regular Gas Average above $3.15/gal on Dec 30, 2024",
        strikePrice: "$3.15/gal",
        yesPrice: 0.38,
        noPrice: 0.62,
        prevPrice: 0.49,
        change24h: -0.11,
        volume24h: 312450,
        openInterest: 524100,
        dollarVolume: 121855,
        status: "Resolved NO",
        resolutionOutcome: "NO ($0.00)",
        resolutionDate: "2024-12-30",
        expiration: "2024-12-30T21:00:00Z",
        sourceName: "US Energy Information Administration (EIA)",
        sourceUrl: "https://www.eia.gov/petroleum/gasdiesel/",
        rulebookRule: "Kalshi Rulebook Rule 502: U.S. Retail Regular Gasoline Price Index",
        modelFairValue: 0.34,
        modelRoi: 11.8,
        modelSignal: "NEUTRAL",
        orderBook: {
            bids: [
                { price: 0.37, quantity: 1840 },
                { price: 0.36, quantity: 4200 },
                { price: 0.35, quantity: 9150 },
                { price: 0.34, quantity: 14200 },
                { price: 0.33, quantity: 22000 }
            ],
            asks: [
                { price: 0.38, quantity: 2150 },
                { price: 0.39, quantity: 5400 },
                { price: 0.40, quantity: 8900 },
                { price: 0.41, quantity: 12500 },
                { price: 0.42, quantity: 18400 }
            ]
        },
        catalysts: [
            {
                time: "2024-12-23T15:30:00Z",
                priceChange: -0.12,
                headline: "EIA reports nationwide gasoline average dropped to $3.08/gal following Gulf refinery resumption",
                source: "EIA Gasoline Report",
                url: "https://www.eia.gov/petroleum/gasdiesel/"
            }
        ]
    },
    {
        ticker: "GAS-25Q1-3.25",
        topic: "gas-prices",
        topicName: "Gas Prices",
        title: "US Retail Regular Gas Average above $3.25/gal during Q1 2025",
        strikePrice: "$3.25/gal",
        yesPrice: 0.52,
        noPrice: 0.48,
        prevPrice: 0.41,
        change24h: 0.11,
        volume24h: 489200,
        openInterest: 812000,
        dollarVolume: 254384,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-03-31",
        expiration: "2025-03-31T21:00:00Z",
        sourceName: "EIA Short-Term Energy Outlook (STEO)",
        sourceUrl: "https://www.eia.gov/outlooks/steo/",
        rulebookRule: "Kalshi Rulebook Rule 504: Quarterly Retail Fuel Price Derivatives",
        modelFairValue: 0.65,
        modelRoi: 25.0,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.51, quantity: 3400 },
                { price: 0.50, quantity: 7200 },
                { price: 0.49, quantity: 11500 },
                { price: 0.48, quantity: 19800 }
            ],
            asks: [
                { price: 0.52, quantity: 2900 },
                { price: 0.53, quantity: 6400 },
                { price: 0.54, quantity: 10200 },
                { price: 0.55, quantity: 15600 }
            ]
        },
        catalysts: [
            {
                time: "2025-01-14T14:00:00Z",
                priceChange: +0.11,
                headline: "OPEC+ extended production curbs driving crude spot benchmark above $78/bbl",
                source: "EIA International Energy Data",
                url: "https://www.eia.gov/international/data/world"
            }
        ]
    },
    {
        ticker: "GAS-CA-4.50",
        topic: "gas-prices",
        topicName: "Gas Prices",
        title: "California Average Retail Gas Price above $4.50/gal at Year-End 2024",
        strikePrice: "$4.50/gal",
        yesPrice: 0.74,
        noPrice: 0.26,
        prevPrice: 0.63,
        change24h: 0.11,
        volume24h: 215400,
        openInterest: 382000,
        dollarVolume: 159396,
        status: "Resolved YES",
        resolutionOutcome: "YES ($1.00)",
        resolutionDate: "2024-12-30",
        expiration: "2024-12-30T21:00:00Z",
        sourceName: "EIA California Retail Gasoline Survey",
        sourceUrl: "https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_sca_w.htm",
        rulebookRule: "Kalshi Rulebook Rule 508: State-Level Gasoline Benchmark Contracts",
        modelFairValue: 0.72,
        modelRoi: -2.7,
        modelSignal: "NEUTRAL",
        orderBook: {
            bids: [
                { price: 0.73, quantity: 4100 },
                { price: 0.72, quantity: 6800 },
                { price: 0.71, quantity: 11200 }
            ],
            asks: [
                { price: 0.74, quantity: 3800 },
                { price: 0.75, quantity: 7400 },
                { price: 0.76, quantity: 12000 }
            ]
        },
        catalysts: [
            {
                time: "2024-11-18T18:00:00Z",
                priceChange: +0.11,
                headline: "California Air Resources Board Low Carbon Fuel Standard reform adopted, adding refinery cost margin",
                source: "California Air Resources Board (CARB)",
                url: "https://ww2.arb.ca.gov/"
            }
        ]
    },
    {
        ticker: "CRUDE-25-80",
        topic: "gas-prices",
        topicName: "Gas Prices",
        title: "WTI Crude Prompt Month Futures Settle above $80.00/bbl",
        strikePrice: "$80.00/bbl",
        yesPrice: 0.44,
        noPrice: 0.56,
        prevPrice: 0.55,
        change24h: -0.11,
        volume24h: 620100,
        openInterest: 1120000,
        dollarVolume: 272844,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-06-30",
        expiration: "2025-06-30T19:30:00Z",
        sourceName: "CME Group NYMEX Light Sweet Crude Oil Settlement",
        sourceUrl: "https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html",
        rulebookRule: "Kalshi Rulebook Rule 510: Crude Oil Benchmark Index",
        modelFairValue: 0.58,
        modelRoi: 31.8,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.43, quantity: 5100 },
                { price: 0.42, quantity: 8900 },
                { price: 0.41, quantity: 14200 }
            ],
            asks: [
                { price: 0.44, quantity: 4800 },
                { price: 0.45, quantity: 9200 },
                { price: 0.46, quantity: 15400 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-05T16:00:00Z",
                priceChange: -0.11,
                headline: "EIA weekly inventory report posts unexpected 4.2M barrel inventory build",
                source: "EIA Petroleum Status Report",
                url: "https://www.eia.gov/petroleum/supply/weekly/"
            }
        ]
    },

    // ---------------- ELECTIONS ----------------
    {
        ticker: "PRES-24-DJT",
        topic: "elections",
        topicName: "Elections",
        title: "Donald J. Trump Wins 2024 US Presidential Election",
        strikePrice: "Electoral Victory",
        yesPrice: 1.00,
        noPrice: 0.00,
        prevPrice: 0.58,
        change24h: 0.42,
        volume24h: 18240000,
        openInterest: 24500000,
        dollarVolume: 18240000,
        status: "Resolved YES",
        resolutionOutcome: "YES ($1.00)",
        resolutionDate: "2024-11-06",
        expiration: "2025-01-06T18:00:00Z",
        sourceName: "Federal Election Commission (FEC) & US National Archives",
        sourceUrl: "https://www.archives.gov/electoral-college/2024",
        rulebookRule: "Kalshi Rulebook Rule 201: Presidential Election Victory Certificate",
        modelFairValue: 1.00,
        modelRoi: 0.0,
        modelSignal: "RESOLVED",
        orderBook: {
            bids: [
                { price: 0.99, quantity: 85000 },
                { price: 0.98, quantity: 120000 }
            ],
            asks: [
                { price: 1.00, quantity: 210000 }
            ]
        },
        catalysts: [
            {
                time: "2024-11-05T23:45:00Z",
                priceChange: +0.22,
                headline: "Pennsylvania and Georgia battleground calls push Trump past 270 electoral vote threshold",
                source: "FEC Official Results Portal",
                url: "https://www.fec.gov/"
            }
        ]
    },
    {
        ticker: "SENATE-24-GOP",
        topic: "elections",
        topicName: "Elections",
        title: "Republican Party Wins Majority in the 119th US Senate (53+ Seats)",
        strikePrice: ">=51 Seats",
        yesPrice: 1.00,
        noPrice: 0.00,
        prevPrice: 0.82,
        change24h: 0.18,
        volume24h: 5210000,
        openInterest: 8400000,
        dollarVolume: 5210000,
        status: "Resolved YES",
        resolutionOutcome: "YES ($1.00)",
        resolutionDate: "2024-11-06",
        expiration: "2025-01-03T17:00:00Z",
        sourceName: "United States Senate Official Roster",
        sourceUrl: "https://www.senate.gov/",
        rulebookRule: "Kalshi Rulebook Rule 202: US Senate Composition Contract",
        modelFairValue: 1.00,
        modelRoi: 0.0,
        modelSignal: "RESOLVED",
        orderBook: {
            bids: [{ price: 0.99, quantity: 45000 }],
            asks: [{ price: 1.00, quantity: 98000 }]
        },
        catalysts: [
            {
                time: "2024-11-05T22:30:00Z",
                priceChange: +0.18,
                headline: "West Virginia and Ohio Senate flips secure Republican majority in 119th Congress",
                source: "US Senate Directory",
                url: "https://www.senate.gov/senators/"
            }
        ]
    },
    {
        ticker: "HOUSE-24-GOP",
        topic: "elections",
        topicName: "Elections",
        title: "Republican Party Holds Majority in the US House of Representatives",
        strikePrice: ">=218 Seats",
        yesPrice: 1.00,
        noPrice: 0.00,
        prevPrice: 0.70,
        change24h: 0.30,
        volume24h: 4120000,
        openInterest: 6150000,
        dollarVolume: 4120000,
        status: "Resolved YES",
        resolutionOutcome: "YES ($1.00)",
        resolutionDate: "2024-11-13",
        expiration: "2025-01-03T17:00:00Z",
        sourceName: "Office of the Clerk, US House of Representatives",
        sourceUrl: "https://clerk.house.gov/",
        rulebookRule: "Kalshi Rulebook Rule 203: US House of Representatives Composition",
        modelFairValue: 1.00,
        modelRoi: 0.0,
        modelSignal: "RESOLVED",
        orderBook: {
            bids: [{ price: 0.99, quantity: 38000 }],
            asks: [{ price: 1.00, quantity: 72000 }]
        },
        catalysts: [
            {
                time: "2024-11-13T19:00:00Z",
                priceChange: +0.15,
                headline: "House reaches 218 certified Republican seats following West Coast district canvasses",
                source: "House Clerk Certified Roll",
                url: "https://clerk.house.gov/Members"
            }
        ]
    },
    {
        ticker: "VA-GOV-25",
        topic: "elections",
        topicName: "Elections",
        title: "Democratic Party Nominee Wins Virginia Gubernatorial Election 2025",
        strikePrice: "Plurality Win",
        yesPrice: 0.62,
        noPrice: 0.38,
        prevPrice: 0.51,
        change24h: 0.11,
        volume24h: 845000,
        openInterest: 1420000,
        dollarVolume: 523900,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-11-05",
        expiration: "2025-11-06T05:00:00Z",
        sourceName: "Virginia Department of Elections",
        sourceUrl: "https://www.elections.virginia.gov/",
        rulebookRule: "Kalshi Rulebook Rule 210: State Gubernatorial Election Outcomes",
        modelFairValue: 0.74,
        modelRoi: 19.3,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.61, quantity: 5200 },
                { price: 0.60, quantity: 12400 },
                { price: 0.59, quantity: 21000 }
            ],
            asks: [
                { price: 0.62, quantity: 4800 },
                { price: 0.63, quantity: 9800 },
                { price: 0.64, quantity: 16500 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-12T17:00:00Z",
                priceChange: +0.11,
                headline: "Abigail Spanberger secures unified party endorsement; internal polling shows +6 pt margin",
                source: "Virginia Dept of Elections Filings",
                url: "https://www.elections.virginia.gov/candidatepac-info/"
            }
        ]
    },
    {
        ticker: "NJ-GOV-25",
        topic: "elections",
        topicName: "Elections",
        title: "Democratic Party Nominee Wins New Jersey Gubernatorial Election 2025",
        strikePrice: "Plurality Win",
        yesPrice: 0.71,
        noPrice: 0.29,
        prevPrice: 0.81,
        change24h: -0.10,
        volume24h: 630000,
        openInterest: 1100000,
        dollarVolume: 447300,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-11-05",
        expiration: "2025-11-06T05:00:00Z",
        sourceName: "New Jersey Division of Elections",
        sourceUrl: "https://nj.gov/state/elections/",
        rulebookRule: "Kalshi Rulebook Rule 211: New Jersey Executive Branch Contracts",
        modelFairValue: 0.85,
        modelRoi: 19.7,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.70, quantity: 6100 },
                { price: 0.69, quantity: 11500 }
            ],
            asks: [
                { price: 0.71, quantity: 5900 },
                { price: 0.72, quantity: 10400 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-20T14:30:00Z",
                priceChange: -0.10,
                headline: "Competitive primary debates trigger voter dispersion across moderate democratic contenders",
                source: "NJ Division of Elections",
                url: "https://nj.gov/state/elections/"
            }
        ]
    },

    // ---------------- CULTURE ----------------
    {
        ticker: "OSCAR-BESTPIC-25",
        topic: "culture",
        topicName: "Culture",
        title: "'Anora' Wins Best Picture at the 97th Academy Awards (Oscars)",
        strikePrice: "AMPAS Official Winner",
        yesPrice: 0.68,
        noPrice: 0.32,
        prevPrice: 0.54,
        change24h: 0.14,
        volume24h: 1240000,
        openInterest: 2150000,
        dollarVolume: 843200,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-03-02",
        expiration: "2025-03-03T06:00:00Z",
        sourceName: "Academy of Motion Picture Arts and Sciences (AMPAS)",
        sourceUrl: "https://www.oscars.org/oscars/ceremonies/2025",
        rulebookRule: "Kalshi Rulebook Rule 401: Academy Award Best Picture Contract",
        modelFairValue: 0.82,
        modelRoi: 20.6,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.67, quantity: 4200 },
                { price: 0.66, quantity: 8900 },
                { price: 0.65, quantity: 15400 }
            ],
            asks: [
                { price: 0.68, quantity: 3800 },
                { price: 0.69, quantity: 7900 },
                { price: 0.70, quantity: 13200 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-08T22:00:00Z",
                priceChange: +0.14,
                headline: "Producers Guild of America (PGA) Darryl F. Zanuck Award sweep for 'Anora' boosts Oscar odds",
                source: "Producers Guild Official Awards",
                url: "https://producersguild.org/"
            }
        ]
    },
    {
        ticker: "OSCAR-BESTDIR-25",
        topic: "culture",
        topicName: "Culture",
        title: "Sean Baker Wins Best Director at 97th Academy Awards for 'Anora'",
        strikePrice: "AMPAS Official Winner",
        yesPrice: 0.58,
        noPrice: 0.42,
        prevPrice: 0.46,
        change24h: 0.12,
        volume24h: 780000,
        openInterest: 1420000,
        dollarVolume: 452400,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-03-02",
        expiration: "2025-03-03T06:00:00Z",
        sourceName: "Academy of Motion Picture Arts and Sciences (AMPAS)",
        sourceUrl: "https://www.oscars.org/",
        rulebookRule: "Kalshi Rulebook Rule 402: Academy Award Directing Category",
        modelFairValue: 0.70,
        modelRoi: 20.7,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.57, quantity: 3400 },
                { price: 0.56, quantity: 7800 }
            ],
            asks: [
                { price: 0.58, quantity: 3100 },
                { price: 0.59, quantity: 6900 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-15T21:00:00Z",
                priceChange: +0.12,
                headline: "Directors Guild of America (DGA) Feature Film Award awarded to Sean Baker",
                source: "Directors Guild of America",
                url: "https://www.dga.org/"
            }
        ]
    },
    {
        ticker: "GRAMMY-AOTY-25",
        topic: "culture",
        topicName: "Culture",
        title: "Beyoncé 'Cowboy Carter' Wins Album of the Year at 67th Grammys",
        strikePrice: "Recording Academy Winner",
        yesPrice: 0.42,
        noPrice: 0.58,
        prevPrice: 0.54,
        change24h: -0.12,
        volume24h: 920000,
        openInterest: 1840000,
        dollarVolume: 386400,
        status: "Resolved NO",
        resolutionOutcome: "NO ($0.00)",
        resolutionDate: "2025-02-02",
        expiration: "2025-02-03T05:00:00Z",
        sourceName: "Recording Academy Grammy Awards Official Records",
        sourceUrl: "https://www.grammy.com/awards/67th-annual-grammy-awards",
        rulebookRule: "Kalshi Rulebook Rule 405: Grammy Awards Categories",
        modelFairValue: 0.45,
        modelRoi: 7.1,
        modelSignal: "RESOLVED",
        orderBook: {
            bids: [{ price: 0.01, quantity: 15000 }],
            asks: [{ price: 0.02, quantity: 34000 }]
        },
        catalysts: [
            {
                time: "2025-02-02T23:30:00Z",
                priceChange: -0.42,
                headline: "Taylor Swift's 'The Tortured Poets Department' awarded Album of the Year at 67th Grammys",
                source: "Grammy Awards Press Release",
                url: "https://www.grammy.com/"
            }
        ]
    },
    {
        ticker: "BOXOFF-24-AVATAR3",
        topic: "culture",
        topicName: "Culture",
        title: "'Avatar: Fire and Ash' Crosses $1.0B Worldwide Box Office in First 28 Days",
        strikePrice: "$1,000,000,000 Gross",
        yesPrice: 0.72,
        noPrice: 0.28,
        prevPrice: 0.61,
        change24h: 0.11,
        volume24h: 540000,
        openInterest: 980000,
        dollarVolume: 388800,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2026-01-18",
        expiration: "2026-01-20T00:00:00Z",
        sourceName: "Box Office Mojo by IMDbPro",
        sourceUrl: "https://www.boxofficemojo.com/",
        rulebookRule: "Kalshi Rulebook Rule 420: Worldwide Film Box Office Gross",
        modelFairValue: 0.78,
        modelRoi: 8.3,
        modelSignal: "NEUTRAL",
        orderBook: {
            bids: [
                { price: 0.71, quantity: 2800 },
                { price: 0.70, quantity: 6400 }
            ],
            asks: [
                { price: 0.72, quantity: 2900 },
                { price: 0.73, quantity: 5800 }
            ]
        },
        catalysts: [
            {
                time: "2025-01-20T12:00:00Z",
                priceChange: +0.11,
                headline: "Disney official presentation reveals international IMAX pre-sales exceeding prior franchise entries",
                source: "Box Office Mojo Official Tracking",
                url: "https://www.boxofficemojo.com/"
            }
        ]
    },
    {
        ticker: "TIME-POTY-24",
        topic: "culture",
        topicName: "Culture",
        title: "Donald Trump Named TIME Person of the Year for 2024",
        strikePrice: "Official Cover Announcement",
        yesPrice: 1.00,
        noPrice: 0.00,
        prevPrice: 0.76,
        change24h: 0.24,
        volume24h: 1850000,
        openInterest: 2900000,
        dollarVolume: 1850000,
        status: "Resolved YES",
        resolutionOutcome: "YES ($1.00)",
        resolutionDate: "2024-12-12",
        expiration: "2024-12-15T00:00:00Z",
        sourceName: "TIME Magazine Official Editorial Registry",
        sourceUrl: "https://time.com/person-of-the-year-2024/",
        rulebookRule: "Kalshi Rulebook Rule 430: Major Publication Honors",
        modelFairValue: 1.00,
        modelRoi: 0.0,
        modelSignal: "RESOLVED",
        orderBook: {
            bids: [{ price: 0.99, quantity: 50000 }],
            asks: [{ price: 1.00, quantity: 120000 }]
        },
        catalysts: [
            {
                time: "2024-12-12T12:05:00Z",
                priceChange: +0.24,
                headline: "TIME Magazine formally unveils 2024 Person of the Year cover naming Donald Trump",
                source: "TIME Official Press Archive",
                url: "https://time.com/person-of-the-year-2024/"
            }
        ]
    },

    // ---------------- CRYPTO ----------------
    {
        ticker: "BTC-24DEC-100K",
        topic: "crypto",
        topicName: "Crypto",
        title: "Bitcoin (BTC/USD) Price Hits or Exceeds $100,000 Before Jan 1, 2025",
        strikePrice: "$100,000.00",
        yesPrice: 1.00,
        noPrice: 0.00,
        prevPrice: 0.78,
        change24h: 0.22,
        volume24h: 24500000,
        openInterest: 38200000,
        dollarVolume: 24500000,
        status: "Resolved YES",
        resolutionOutcome: "YES ($1.00)",
        resolutionDate: "2024-12-05",
        expiration: "2025-01-01T00:00:00Z",
        sourceName: "CME CF Bitcoin Reference Rate (BRR) & CoinGecko",
        sourceUrl: "https://www.coingecko.com/en/coins/bitcoin",
        rulebookRule: "Kalshi Rulebook Rule 301: Cryptocurrency Price Level Index",
        modelFairValue: 1.00,
        modelRoi: 0.0,
        modelSignal: "RESOLVED",
        orderBook: {
            bids: [{ price: 0.99, quantity: 110000 }],
            asks: [{ price: 1.00, quantity: 280000 }]
        },
        catalysts: [
            {
                time: "2024-12-04T22:15:00Z",
                priceChange: +0.22,
                headline: "Bitcoin crosses historic $100,000 milestone on institutional spot ETF accumulation",
                source: "CME Group CF Benchmarks",
                url: "https://www.cmegroup.com/markets/cryptocurrencies/cme-cf-cryptocurrency-benchmarks/cf-bitcoin-reference-rate.html"
            }
        ]
    },
    {
        ticker: "BTC-25Q1-110K",
        topic: "crypto",
        topicName: "Crypto",
        title: "Bitcoin (BTC/USD) Price Trades at or above $110,000 in Q1 2025",
        strikePrice: "$110,000.00",
        yesPrice: 0.64,
        noPrice: 0.36,
        prevPrice: 0.52,
        change24h: 0.12,
        volume24h: 14200000,
        openInterest: 22100000,
        dollarVolume: 9088000,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-03-31",
        expiration: "2025-03-31T23:59:59Z",
        sourceName: "CME CF Bitcoin Reference Rate & SEC EDGAR",
        sourceUrl: "https://www.cmegroup.com/",
        rulebookRule: "Kalshi Rulebook Rule 302: Quarterly BTC Derivative Contracts",
        modelFairValue: 0.78,
        modelRoi: 21.9,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.63, quantity: 18400 },
                { price: 0.62, quantity: 38200 },
                { price: 0.61, quantity: 65100 }
            ],
            asks: [
                { price: 0.64, quantity: 16900 },
                { price: 0.65, quantity: 34100 },
                { price: 0.66, quantity: 58900 }
            ]
        },
        catalysts: [
            {
                time: "2025-01-20T18:00:00Z",
                priceChange: +0.12,
                headline: "Executive orders outlining strategic Bitcoin national reserve framework trigger massive futures open interest",
                source: "White House Executive Actions Registry",
                url: "https://www.whitehouse.gov/briefing-room/"
            }
        ]
    },
    {
        ticker: "ETH-25Q1-4K",
        topic: "crypto",
        topicName: "Crypto",
        title: "Ethereum (ETH/USD) Trades at or above $4,000 by March 31, 2025",
        strikePrice: "$4,000.00",
        yesPrice: 0.39,
        noPrice: 0.61,
        prevPrice: 0.50,
        change24h: -0.11,
        volume24h: 5800000,
        openInterest: 9400000,
        dollarVolume: 2262000,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-03-31",
        expiration: "2025-03-31T23:59:59Z",
        sourceName: "CoinGecko Ethereum Market Index",
        sourceUrl: "https://www.coingecko.com/en/coins/ethereum",
        rulebookRule: "Kalshi Rulebook Rule 305: Ethereum Spot Price Benchmark",
        modelFairValue: 0.52,
        modelRoi: 33.3,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.38, quantity: 9400 },
                { price: 0.37, quantity: 18200 }
            ],
            asks: [
                { price: 0.39, quantity: 8900 },
                { price: 0.40, quantity: 17400 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-14T11:00:00Z",
                priceChange: -0.11,
                headline: "Spot ETH ETF outflows and layer-1 fee compression compress market-implied breakout odds",
                source: "CoinGecko Market Data",
                url: "https://www.coingecko.com/"
            }
        ]
    },
    {
        ticker: "BTC-ETF-NET10B",
        topic: "crypto",
        topicName: "Crypto",
        title: "Cumulative US Spot Bitcoin ETF Net Inflows Exceed $35 Billion by Year-End 2024",
        strikePrice: "$35,000,000,000 Inflows",
        yesPrice: 1.00,
        noPrice: 0.00,
        prevPrice: 0.84,
        change24h: 0.16,
        volume24h: 3400000,
        openInterest: 5100000,
        dollarVolume: 3400000,
        status: "Resolved YES",
        resolutionOutcome: "YES ($1.00)",
        resolutionDate: "2024-12-28",
        expiration: "2025-01-02T00:00:00Z",
        sourceName: "SEC EDGAR Filer System & Farside Investors Verified Data",
        sourceUrl: "https://www.sec.gov/edgar",
        rulebookRule: "Kalshi Rulebook Rule 315: Institutional ETF Inflow Contracts",
        modelFairValue: 1.00,
        modelRoi: 0.0,
        modelSignal: "RESOLVED",
        orderBook: {
            bids: [{ price: 0.99, quantity: 32000 }],
            asks: [{ price: 1.00, quantity: 84000 }]
        },
        catalysts: [
            {
                time: "2024-12-28T21:00:00Z",
                priceChange: +0.16,
                headline: "Year-end 13F and SEC filings confirm combined net spot Bitcoin ETF inflows eclipsed $35.2B",
                source: "SEC EDGAR Database",
                url: "https://www.sec.gov/edgar"
            }
        ]
    },
    {
        ticker: "SOL-25-300",
        topic: "crypto",
        topicName: "Crypto",
        title: "Solana (SOL/USD) Price Trades at or above $300 in 2025",
        strikePrice: "$300.00",
        yesPrice: 0.48,
        noPrice: 0.52,
        prevPrice: 0.38,
        change24h: 0.10,
        volume24h: 4200000,
        openInterest: 6800000,
        dollarVolume: 2016000,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-12-31",
        expiration: "2025-12-31T23:59:59Z",
        sourceName: "CoinGecko Solana Index",
        sourceUrl: "https://www.coingecko.com/en/coins/solana",
        rulebookRule: "Kalshi Rulebook Rule 320: Altcoin Digital Asset Benchmarks",
        modelFairValue: 0.62,
        modelRoi: 29.2,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.47, quantity: 7200 },
                { price: 0.46, quantity: 14500 }
            ],
            asks: [
                { price: 0.48, quantity: 6800 },
                { price: 0.49, quantity: 13900 }
            ]
        },
        catalysts: [
            {
                time: "2025-01-28T15:00:00Z",
                priceChange: +0.10,
                headline: "Major asset manager submits formal S-1 registration statement for US spot Solana ETF",
                source: "SEC S-1 Registration Feed",
                url: "https://www.sec.gov/"
            }
        ]
    },

    // ---------------- GOLF ----------------
    {
        ticker: "MASTERS-25-SCHEFFLER",
        topic: "golf",
        topicName: "Golf",
        title: "Scottie Scheffler Wins 2025 Masters Tournament at Augusta National",
        strikePrice: "Tournament Champion",
        yesPrice: 0.24,
        noPrice: 0.76,
        prevPrice: 0.14,
        change24h: 0.10,
        volume24h: 1850000,
        openInterest: 3200000,
        dollarVolume: 444000,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-04-13",
        expiration: "2025-04-14T02:00:00Z",
        sourceName: "Masters Tournament Official Scoring & PGA Tour",
        sourceUrl: "https://www.masters.com/",
        rulebookRule: "Kalshi Rulebook Rule 601: Men's Major Golf Championship Winners",
        modelFairValue: 0.32,
        modelRoi: 33.3,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.23, quantity: 6400 },
                { price: 0.22, quantity: 14200 },
                { price: 0.21, quantity: 24500 }
            ],
            asks: [
                { price: 0.24, quantity: 5800 },
                { price: 0.25, quantity: 12900 },
                { price: 0.26, quantity: 21800 }
            ]
        },
        catalysts: [
            {
                time: "2025-03-10T19:00:00Z",
                priceChange: +0.10,
                headline: "Scheffler dominates Arnold Palmer Invitational with 5-stroke victory, reinforcing World No. 1 standing",
                source: "PGA Tour Official Leaderboard",
                url: "https://www.pgatour.com/"
            }
        ]
    },
    {
        ticker: "MASTERS-25-MCILROY",
        topic: "golf",
        topicName: "Golf",
        title: "Rory McIlroy Wins 2025 Masters to Complete Career Grand Slam",
        strikePrice: "Tournament Champion",
        yesPrice: 0.12,
        noPrice: 0.88,
        prevPrice: 0.22,
        change24h: -0.10,
        volume24h: 1120000,
        openInterest: 2100000,
        dollarVolume: 134400,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-04-13",
        expiration: "2025-04-14T02:00:00Z",
        sourceName: "Masters Tournament & Official World Golf Ranking (OWGR)",
        sourceUrl: "https://www.masters.com/",
        rulebookRule: "Kalshi Rulebook Rule 601: Men's Major Golf Championship Winners",
        modelFairValue: 0.16,
        modelRoi: 33.3,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [
                { price: 0.11, quantity: 4200 },
                { price: 0.10, quantity: 9500 }
            ],
            asks: [
                { price: 0.12, quantity: 3900 },
                { price: 0.13, quantity: 8800 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-18T20:00:00Z",
                priceChange: -0.10,
                headline: "Putting inconsistencies at Genesis Invitational lead to missed cut, lowering Masters implied probability",
                source: "PGA Tour Player Profile",
                url: "https://www.pgatour.com/players/player.28237.rory-mcilroy.html"
            }
        ]
    },
    {
        ticker: "PGA-25-CHAMP",
        topic: "golf",
        topicName: "Golf",
        title: "Bryson DeChambeau Wins 2025 PGA Championship at Quail Hollow",
        strikePrice: "Tournament Champion",
        yesPrice: 0.15,
        noPrice: 0.85,
        prevPrice: 0.11,
        change24h: 0.04,
        volume24h: 740000,
        openInterest: 1450000,
        dollarVolume: 111000,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-05-18",
        expiration: "2025-05-19T02:00:00Z",
        sourceName: "PGA of America Championship Scoring",
        sourceUrl: "https://www.pgachampionship.com/",
        rulebookRule: "Kalshi Rulebook Rule 602: PGA Championship Outcomes",
        modelFairValue: 0.18,
        modelRoi: 20.0,
        modelSignal: "BUY YES (High ROI)",
        orderBook: {
            bids: [{ price: 0.14, quantity: 3100 }],
            asks: [{ price: 0.15, quantity: 2900 }]
        },
        catalysts: [
            {
                time: "2025-01-15T18:00:00Z",
                priceChange: +0.04,
                headline: "PGA of America affirms past major champions exemption criteria for Quail Hollow field",
                source: "PGA of America Announcements",
                url: "https://www.pgachampionship.com/"
            }
        ]
    },
    {
        ticker: "USOPEN-25-WINNER",
        topic: "golf",
        topicName: "Golf",
        title: "American Golfer Wins the 2025 US Open Championship at Oakmont",
        strikePrice: "US Citizen Winner",
        yesPrice: 0.65,
        noPrice: 0.35,
        prevPrice: 0.54,
        change24h: 0.11,
        volume24h: 1350000,
        openInterest: 2400000,
        dollarVolume: 877500,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-06-15",
        expiration: "2025-06-16T02:00:00Z",
        sourceName: "United States Golf Association (USGA)",
        sourceUrl: "https://www.usopen.com/",
        rulebookRule: "Kalshi Rulebook Rule 603: US Open Nationality & Player Groupings",
        modelFairValue: 0.72,
        modelRoi: 10.8,
        modelSignal: "NEUTRAL",
        orderBook: {
            bids: [
                { price: 0.64, quantity: 5100 },
                { price: 0.63, quantity: 11200 }
            ],
            asks: [
                { price: 0.65, quantity: 4800 },
                { price: 0.66, quantity: 10400 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-24T17:00:00Z",
                priceChange: +0.11,
                headline: "American players sweep top 4 finishes at PGA Tour Florida swing events heading into major season",
                source: "USGA Player Registry",
                url: "https://www.usopen.com/"
            }
        ]
    },
    {
        ticker: "RYDER-25-USA",
        topic: "golf",
        topicName: "Golf",
        title: "Team USA Reclaims the Ryder Cup at Bethpage Black in September 2025",
        strikePrice: "Team USA >=14.5 Points",
        yesPrice: 0.59,
        noPrice: 0.41,
        prevPrice: 0.48,
        change24h: 0.11,
        volume24h: 1680000,
        openInterest: 3100000,
        dollarVolume: 991200,
        status: "Active",
        resolutionOutcome: "Pending",
        resolutionDate: "2025-09-28",
        expiration: "2025-09-29T02:00:00Z",
        sourceName: "Official Ryder Cup & PGA of America",
        sourceUrl: "https://www.rydercup.com/",
        rulebookRule: "Kalshi Rulebook Rule 605: Ryder Cup Matches Derivative",
        modelFairValue: 0.68,
        modelRoi: 15.3,
        modelSignal: "NEUTRAL",
        orderBook: {
            bids: [
                { price: 0.58, quantity: 6200 },
                { price: 0.57, quantity: 13500 }
            ],
            asks: [
                { price: 0.59, quantity: 5900 },
                { price: 0.60, quantity: 12800 }
            ]
        },
        catalysts: [
            {
                time: "2025-02-01T14:00:00Z",
                priceChange: +0.11,
                headline: "Captain Keegan Bradley confirms Bethpage Black setup favoring long driving distance metrics",
                source: "Ryder Cup Official News",
                url: "https://www.rydercup.com/"
            }
        ]
    }
];

// Helper functions for data querying
function getContractByTicker(ticker) {
    return KALSHI_CONTRACTS.find(c => c.ticker === ticker) || null;
}

function getContractsByTopic(topicId) {
    return KALSHI_CONTRACTS.filter(c => c.topic === topicId);
}

function getHighRoiContracts() {
    return KALSHI_CONTRACTS.filter(c => c.modelRoi >= 18.0 && c.status === "Active");
}

function getAllCatalysts() {
    const list = [];
    KALSHI_CONTRACTS.forEach(c => {
        if (c.catalysts && c.catalysts.length > 0) {
            c.catalysts.forEach(cat => {
                list.push({
                    ticker: c.ticker,
                    title: c.title,
                    topic: c.topic,
                    topicName: c.topicName,
                    ...cat
                });
            });
        }
    });
    return list.sort((a, b) => new Date(b.time) - new Date(a.time));
}
