# Interactivity & Live-UX Suggestions

**Branch:** `arena/7a21cbd2-tradebot2`  
**Date:** 2026-11-22

These are product suggestions for making the Kalshi dashboard more live and interactive. They are suggestions, not verified requirements.

## 1. Live charts with jump annotation
- Show a simplified price graph per event: X axis = time, Y axis = contract price.
- Let the trader choose graph length: seconds, minutes, or hours.
- Flag any price move ≥ $0.10 in either direction as a "sharp jump" on the chart (vertical marker).
- Next to each sharp jump, list a possible causing event or website link (e.g., news article, Fed announcement, debate, earnings call). Source links should point to official/reputable sites where available.

## 2. Two scrolling alert chats
- **All events chat:** every ≥ $0.10 price swing in real time, newest at top, with topic, event, old price → new price, direction, and timestamp.
- **Model-preferred (high-ROI) chat:** same format, filtered to events the model flags as high return-on-investment.
- Scrolling chat should auto-scroll to new messages and pause on hover so a trader can read.

## 3. Liquidity readout
- Show current contract price and the number of contracts available at each nearby price (orderbook bid/ask sizes) so the trader knows how much size they can move before slippage.

## 4. Resolution tracking
- Keep each live event on screen until it resolves.
- When resolved, stamp the outcome (Resolved: Yes / Resolved: No) and move the card to a "resolved" section with payout math ($1.00 per correct contract, $0.00 otherwise).

## 5. Simulated trades & strategy testing
- Paper-trade simulator: set entry price, side (Yes/No), count, and exit rule; run against recorded/live price ticks.
- Compare strategies side by side (e.g., "buy the dip ≥ $0.10" vs. "sell into strength ≥ $0.10").
- Categorize each simulated trade by type (directional, mean-reversion, news-jump, arbitrage-ish) and track win rate and P&L per category.

## 6. Portfolio performance
- Track simulated/demo portfolio balance, open positions, realized P&L, unrealized P&L.
- Chart equity curve over time.
- Group trades by category (gas prices, elections, culture, crypto, golf) and by trade type so the trader can see which strategy/topic performs best.

## 7. Topic organization
- Keep the five topics separate (separate subpages) but keep events within the same topic organized together in one table.
- A unified "all topics" landing table for quick scanning, with deep-dive subpages per topic.

## 8. Continuous simplification
- Surface one primary action per event (e.g., "the market moved $0.12 — review orderbook").
- Avoid clutter: hide resolved events by default, show only open/live events.
- Provide clear source links on every row; mark anything unverified.

## 9. Technical live-ness (suggestions)
- Poll public `/markets` and `/markets/{ticker}/orderbook` endpoints on a short interval (respecting the documented short cache and lag).
- Where available, use the WebSocket for real-time orderbook/trade updates instead of polling.
- Show a connection-status indicator (connected / reconnecting / offline) and the last-update timestamp.
- Fall back gracefully when the API is unreachable: show last-known data, mark stale, and let the trader continue with simulated/demo data.
