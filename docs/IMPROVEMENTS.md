# Making the site more live and interactive — suggestions

Each item states whether it is **done**, **deferred with a reason**, or **needs something the
project cannot self-provide**. None of them requires the visitor to type anything.

| # | Suggestion | Why it helps a trader | State |
| --- | --- | --- | --- |
| 1 | Second-by-second feed driven by a server-side WebSocket consumer | Removes the 5-minute cadence as the floor on alert latency | **Deferred** — the WS handshake requires authentication (Kalshi docs), so it needs a long-running credentialed worker. Paper path documented in `collector/kalshi_auth.py`. |
| 2 | Sparkline in every market row | Lets a trader see direction without opening the chart | **Done** — `TB.sparkline()` in `assets/js/util.js`, used from the history files |
| 3 | Alert flash + optional sound on a new ≥ $0.10 move | Draws the eye to the feed without scrolling | Flash: **done** (`.msg.new` animation). Sound: **deferred** — browsers block audio without a user gesture, and an unprompted beep is hostile. |
| 4 | Pause button on the live feed | Traders need to read a message without it being pushed away | **Done** — `#pauseFeed` |
| 5 | Range switcher on the chart (1m→24h) | Matches the timeframe a trader is reasoning about | **Done** — `#chartRanges` |
| 6 | Liquidity at each price on the market row (contracts and dollars) | Answers "can I actually get filled at this price" | **Done** — order-book columns |
| 7 | Click a swing dot to see the alert that produced it | Connects the chart to the event feed | **Done** — markers are drawn from the alert feed; the feed links back to the topic page |
| 8 | Group the dashboard by topic, with a topic filter and search | Keeps five unrelated markets from interleaving | **Done** — `#topicFilter`, `#search` |
| 9 | One-click jump from an alert to the market's order book | Turns an alert into a decision | **Done** — "chart" button opens the chart plus the book panel |
| 10 | Show resolution outcome inline once a market settles | Closes the loop on the trades that depended on it | **Done** — `Result` column and `resolutions.html` |
| 11 | News-event attribution for a jump, with a source link | Would explain *why* the price moved | **Blocked** — no verified news feed is wired in; doing it without one would be invention (flag **F-09**) |
| 12 | Portfolio equity curve from the demo account | Shows strategy performance against the account, not just the paper ledger | **Deferred** — needs demo credentials (flag **F-05**); the paper ledger curve already exists in `data/analytics.json` |

## Interaction details worth knowing

- **Nothing requires typing.** Search and filters are optional accelerators; the default view
  always shows live content.
- **Every table is sortable by its natural rank.** Markets are pre-sorted by estimated traded
  dollars, alerts newest-first, resolutions by state then date.
- **Numbers never move silently.** A field the API did not return renders as `—`; it is never
  substituted with a zero or a previous value.
