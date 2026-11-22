"""Source registry: every external claim on the site points at one of these.

`verify.py` re-checks that each URL is well-formed and that every fact id used
by the generated pages exists here, so no page can cite a source that is not
recorded. Adding a fact = adding one row here and one row in the page builder.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    fact_id: str
    claim: str
    url: str
    kind: str  # "official-docs" | "official-api" | "official-site"
    checked: str  # ISO date the claim was last read at the source


DOCS = "https://docs.kalshi.com"
DEMO = "https://external-api.demo.kalshi.co/trade-api/v2"

SOURCES: tuple[Source, ...] = (
    Source("api-environments", "REST and WebSocket base URLs for production and demo",
           f"{DOCS}/getting_started/api_environments.md", "official-docs", "2026-11-22"),
    Source("demo-environment", "Demo environment uses mock funds; demo prices may diverge from production",
           f"{DOCS}/getting_started/demo_env.md", "official-docs", "2026-11-22"),
    Source("ws-quickstart", "WebSocket handshake headers and the signed path /trade-api/ws/v2",
           f"{DOCS}/getting_started/quick_start_websockets.md", "official-docs", "2026-11-22"),
    Source("ws-connection", "WebSocket connection requires authentication even for public channels",
           f"{DOCS}/websockets/websocket-connection.md", "official-docs", "2026-11-22"),
    Source("orderbook", "Order book returns bids only; best YES ask = 1 - best NO bid",
           f"{DOCS}/getting_started/orderbook_responses.md", "official-docs", "2026-11-22"),
    Source("candlesticks", "Candlesticks endpoint, period_interval 1/60/1440, 5000-period cap",
           f"{DOCS}/api-reference/market/get-market-candlesticks.md", "official-docs", "2026-11-22"),
    Source("market-lifecycle", "Market statuses and the filters that map to them",
           f"{DOCS}/getting_started/market_lifecycle.md", "official-docs", "2026-11-22"),
    Source("order-v2", "V2 order endpoint replaces the removed legacy order endpoints",
           f"{DOCS}/api-reference/orders/create-order-v2.md", "official-docs", "2026-11-22"),
    Source("order-direction", "outcome_side/book_side replace legacy action/side; bid == yes",
           f"{DOCS}/getting_started/order_direction.md", "official-docs", "2026-11-22"),
    Source("balance", "Balance endpoint and its separate rate-limit bucket",
           f"{DOCS}/api-reference/portfolio/get-balance.md", "official-docs", "2026-11-22"),
    Source("rate-limits", "Token buckets, X-RateLimit headers, 429 has no Retry-After",
           f"{DOCS}/getting_started/rate_limits.md", "official-docs", "2026-11-22"),
    Source("fixed-point", "Fixed-point conventions and price_ranges as tick source of truth",
           f"{DOCS}/getting_started/fixed_point_migration.md", "official-docs", "2026-11-22"),
    Source("get-events", "GET /events parameters including with_nested_markets and status",
           f"{DOCS}/api-reference/events/get-events.md", "official-docs", "2026-11-22"),
    Source("get-market", "Market object schema including result and settlement fields",
           f"{DOCS}/api-reference/markets/get-market.md", "official-docs", "2026-11-22"),
    Source("get-trades", "Public trades endpoint and Trade schema",
           f"{DOCS}/api-reference/market/get-trades.md", "official-docs", "2026-11-22"),
    Source("llms-index", "Documentation index used to enumerate every endpoint page",
           f"{DOCS}/llms.txt", "official-docs", "2026-11-22"),
    Source("demo-series-gas", "Gas-price series are Economics + tag Oil and energy, AAA settlement",
           f"{DEMO}/series?category=Economics&tags=Oil+and+energy&limit=3", "official-api", "2026-11-22"),
    Source("demo-series-golf", "Golf series are Sports + tag Golf",
           f"{DEMO}/series?category=Sports&tags=Golf&limit=3", "official-api", "2026-11-22"),
    Source("demo-series-elections", "Elections category contents",
           f"{DEMO}/series?category=Elections&limit=2", "official-api", "2026-11-22"),
    Source("demo-series-culture", "Culture category contents",
           f"{DEMO}/series?category=Culture&limit=2", "official-api", "2026-11-22"),
    Source("demo-series-crypto", "Crypto category contents",
           f"{DEMO}/series?category=Crypto&limit=20", "official-api", "2026-11-22"),
    Source("demo-series-bad-category", "category=Gas and category=Golf return null series",
           f"{DEMO}/series?category=Golf&limit=2", "official-api", "2026-11-22"),
    Source("kalshi-site-market", "Public market page for a series (human-readable odds page)",
           "https://kalshi.com/markets/kxaaagasd/kxaaagasd-26nov22", "official-site", "2026-11-22"),
)

SOURCE_BY_ID = {s.fact_id: s for s in SOURCES}


def cite(fact_id: str) -> str:
    """Return the canonical URL for a fact id (KeyError = broken citation)."""
    return SOURCE_BY_ID[fact_id].url
