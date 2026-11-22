"""Kalshi Demo REST client (standard library only).

Every endpoint, parameter and response shape used here is traced to the official
documentation or to a live demo response captured on 2026-11-22; the `SOURCE`
constants in `sources.py` hold the URLs that `verify.py` checks.

Design notes
------------
* Fixed-point strings are parsed to ``Decimal`` and never to binary floats on the
  write path (``*_dollars`` are up to 4-6 dp strings, ``*_fp`` are 2 dp strings).
* Public market-data endpoints need no credentials. Authenticated endpoints
  (``/portfolio/*``) are *not* called anywhere: this environment has no API key,
  so every trade in this repository is explicitly a simulation.
* The client is deliberately tolerant of missing optional fields; a missing
  value stays ``None`` and is rendered as blank + "unverified" by the site.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable

# Official environments, all four hosts, from
# https://docs.kalshi.com/getting_started/api_environments.md
REST_HOSTS = {
    "demo": "https://external-api.demo.kalshi.co/trade-api/v2",
    "demo_alt": "https://demo-api.kalshi.co/trade-api/v2",
    "prod": "https://external-api.kalshi.com/trade-api/v2",
    "prod_alt": "https://api.elections.kalshi.com/trade-api/v2",
}
WS_HOSTS = {
    "demo": "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
    "demo_alt": "wss://demo-api.kalshi.co/trade-api/ws/v2",
    "prod": "wss://external-api-ws.kalshi.com/trade-api/ws/v2",
}
USER_WS_DEMO = "wss://user-ws.demo.kalshi.co/trade-api/ws/v2"


def usd(value: Any) -> Decimal | None:
    """Parse a fixed-point dollar string such as "0.4200" without float error."""
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def contracts(value: Any) -> Decimal | None:
    """Parse a fixed-point contract count such as "13.00"."""
    return usd(value)


@dataclass
class Level:
    price: Decimal
    contracts: Decimal


@dataclass
class Orderbook:
    """One market's two-sided ladder.

    The official shape (https://docs.kalshi.com/getting_started/orderbook_responses.md)
    is bids only, ascending by price, best bid last:

        {"orderbook_fp": {"yes_dollars": [["0.4200","13.00"], ...],
                          "no_dollars":  [["0.5600","10.00"], ...]}}

    The best YES *ask* is therefore ``1 - best NO bid``.
    """

    ticker: str
    yes_bids: list[Level] = field(default_factory=list)
    no_bids: list[Level] = field(default_factory=list)

    @property
    def best_yes_bid(self) -> Decimal | None:
        return self.yes_bids[-1].price if self.yes_bids else None

    @property
    def best_yes_ask(self) -> Decimal | None:
        if not self.no_bids:
            return None
        return Decimal(1) - self.no_bids[-1].price

    @property
    def mid(self) -> Decimal | None:
        bid, ask = self.best_yes_bid, self.best_yes_ask
        if bid is None or ask is None:
            return None
        return (bid + ask) / 2

    @property
    def spread(self) -> Decimal | None:
        bid, ask = self.best_yes_bid, self.best_yes_ask
        if bid is None or ask is None:
            return None
        return ask - bid

    def ask_ladder(self) -> list[Level]:
        """REST publishes NO bids; a NO bid at p is a YES offer at 1-p."""
        return sorted(
            (Level(price=Decimal(1) - lvl.price, contracts=lvl.contracts) for lvl in self.no_bids),
            key=lambda lvl: lvl.price,
        )

    def contracts_within(self, cents: Decimal = Decimal("0.01")) -> tuple[Decimal, Decimal]:
        """Contracts bid within `cents` of the best bid (a depth measure)."""
        best = self.best_yes_bid
        if best is None:
            return Decimal(0), Decimal(0)
        total = sum((lvl.contracts for lvl in self.yes_bids if lvl.price >= best - cents), Decimal(0))
        return best, total

    def as_chart(self) -> dict[str, list[list[str]]]:
        return {
            "yes_bids": [[str(l.price), str(l.contracts)] for l in self.yes_bids],
            "yes_asks": [[str(l.price), str(l.contracts)] for l in self.ask_ladder()],
        }


class KalshiError(RuntimeError):
    def __init__(self, status: int, body: str, url: str):
        super().__init__(f"HTTP {status} for {url}: {body[:300]}")
        self.status = status
        self.body = body
        self.url = url


class KalshiDemoClient:
    """Unauthenticated reader for the Kalshi demo (or production) REST API.

    Rate limits: token buckets, 10 tokens per public read by default, and the
    429 body carries no ``Retry-After``
    (https://docs.kalshi.com/getting_started/rate_limits.md), so this client
    sleeps ``retry_sleep`` and retries with a simple linear backoff.
    """

    def __init__(
        self,
        env: str = "demo",
        timeout: float = 20.0,
        user_agent: str = "Tradebot2-collector/1.0 (+github pages dashboard)",
        retries: int = 3,
        retry_sleep: float = 2.0,
    ):
        if env not in REST_HOSTS:
            raise ValueError(f"unknown environment {env!r}")
        self.env = env
        self.base = REST_HOSTS[env]
        self.timeout = timeout
        self.user_agent = user_agent
        self.retries = retries
        self.retry_sleep = retry_sleep
        self.calls = 0

    # -- plumbing ---------------------------------------------------------
    def _url(self, path: str, params: dict[str, Any] | None) -> str:
        url = f"{self.base}{path}"
        if params:
            clean = {k: v for k, v in params.items() if v is not None and v != ""}
            if clean:
                url += "?" + urllib.parse.urlencode(clean, doseq=True)
        return url

    def get(self, path: str, **params: Any) -> dict[str, Any]:
        url = self._url(path, params)
        last: Exception | None = None
        for attempt in range(self.retries + 1):
            req = urllib.request.Request(url, headers={"User-Agent": self.user_agent, "Accept": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    self.calls += 1
                    raw = resp.read().decode("utf-8")
                    return json.loads(raw) if raw else {}
            except urllib.error.HTTPError as exc:  # 429/5xx are worth a retry
                body = exc.read().decode("utf-8", "replace")
                last = KalshiError(exc.code, body, url)
                if exc.code not in (429, 500, 502, 503, 504):
                    raise last
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                last = exc  # type: ignore[assignment]
            if attempt < self.retries:
                time.sleep(self.retry_sleep * (attempt + 1))
        raise RuntimeError(f"request failed after {self.retries + 1} attempts: {last}")

    # -- public market data ----------------------------------------------
    def exchange_status(self) -> dict[str, Any]:
        return self.get("/exchange/status")

    def series(self, category: str | None = None, tags: str | None = None, limit: int = 200) -> list[dict]:
        """GET /series. `category` is an exact, case-sensitive value; `tags`
        filters within it. Note `Gas` and `Golf` are NOT categories (verified:
        both return ``{"series": null}``), they are tags."""
        out: list[dict] = []
        cursor = None
        for _ in range(10):
            page = self.get("/series", category=category, tags=tags, limit=limit, cursor=cursor)
            out.extend(page.get("series") or [])
            cursor = page.get("cursor")
            if not cursor:
                break
        return out

    def series_one(self, ticker: str) -> dict | None:
        page = self.get(f"/series/{ticker}")
        return page.get("series")

    def events(
        self,
        status: str | None = None,
        series_ticker: str | None = None,
        limit: int = 200,
        with_nested_markets: bool = True,
        min_close_ts: int | None = None,
    ) -> list[dict]:
        out: list[dict] = []
        cursor = None
        while len(out) < limit:
            page = self.get(
                "/events",
                status=status,
                series_ticker=series_ticker,
                limit=min(200, limit - len(out)),
                with_nested_markets="true" if with_nested_markets else None,
                min_close_ts=min_close_ts,
                cursor=cursor,
            )
            batch = page.get("events") or []
            out.extend(batch)
            cursor = page.get("cursor")
            if not cursor or not batch:
                break
        return out

    def markets(
        self,
        status: str | None = "open",
        series_ticker: str | None = None,
        event_ticker: str | None = None,
        limit: int = 200,
        mve_filter: str = "exclude",
    ) -> list[dict]:
        """GET /markets. `mve_filter=exclude` drops multivariate combo markets,
        whose tickers are not topic-specific (verified in the demo payloads)."""
        out: list[dict] = []
        cursor = None
        while len(out) < limit:
            page = self.get(
                "/markets",
                status=status,
                series_ticker=series_ticker,
                event_ticker=event_ticker,
                limit=min(1000, limit - len(out)),
                mve_filter=mve_filter,
                cursor=cursor,
            )
            batch = page.get("markets") or []
            out.extend(batch)
            cursor = page.get("cursor")
            if not cursor or not batch:
                break
        return out

    def market(self, ticker: str) -> dict | None:
        page = self.get(f"/markets/{ticker}")
        return page.get("market")

    def orderbook(self, ticker: str, depth: int | None = None) -> Orderbook:
        page = self.get(f"/markets/{ticker}/orderbook", depth=depth)
        raw = (page.get("orderbook_fp") or {})
        def levels(key: str) -> list[Level]:
            out = []
            for price, count in raw.get(key) or []:
                p, c = usd(price), contracts(count)
                if p is not None and c is not None:
                    out.append(Level(price=p, contracts=c))
            return out
        return Orderbook(ticker=ticker, yes_bids=levels("yes_dollars"), no_bids=levels("no_dollars"))

    def candlesticks(
        self,
        series_ticker: str,
        ticker: str,
        start_ts: int,
        end_ts: int,
        period_interval: int = 1,
    ) -> list[dict]:
        """GET /series/{series}/markets/{ticker}/candlesticks.

        ``period_interval`` is limited to 1, 60 or 1440 minutes and a single
        request may span at most 5,000 periods, so long ranges are split.
        ``start_ts``/``end_ts`` are seconds, not milliseconds.
        """
        if period_interval not in (1, 60, 1440):
            raise ValueError("period_interval must be 1, 60 or 1440")
        max_span = 5000 * period_interval * 60
        out: list[dict] = []
        cursor = start_ts
        while cursor < end_ts:
            chunk_end = min(end_ts, cursor + max_span - period_interval * 60)
            page = self.get(
                f"/series/{series_ticker}/markets/{ticker}/candlesticks",
                start_ts=cursor,
                end_ts=chunk_end,
                period_interval=period_interval,
            )
            out.extend(page.get("candlesticks") or [])
            cursor = chunk_end + period_interval * 60
        return out

    def trades(self, ticker: str, limit: int = 100, min_ts: int | None = None) -> list[dict]:
        page = self.get("/markets/trades", ticker=ticker, limit=limit, min_ts=min_ts)
        return page.get("trades") or []

    # -- convenience ------------------------------------------------------
    def health(self) -> dict[str, Any]:
        started = time.time()
        try:
            status = self.exchange_status()
            return {
                "ok": True,
                "env": self.env,
                "base_url": self.base,
                "latency_ms": int((time.time() - started) * 1000),
                "exchange_active": status.get("exchange_active"),
                "trading_active": status.get("trading_active"),
            }
        except Exception as exc:  # noqa: BLE001 - reported, never raised to the UI
            return {
                "ok": False,
                "env": self.env,
                "base_url": self.base,
                "latency_ms": int((time.time() - started) * 1000),
                "error": str(exc)[:300],
            }


def market_mid_price(market: dict) -> tuple[Decimal | None, str]:
    """Best available price for a market plus the label describing its basis.

    Preference order: order-book mid > last trade. The basis is always returned
    so the UI can say *what* the number is instead of implying a mid exists.
    """
    bid = usd(market.get("yes_bid_dollars"))
    ask = usd(market.get("yes_ask_dollars"))
    if bid is not None and ask is not None and bid > 0 and ask < 1 and ask >= bid:
        return (bid + ask) / 2, "mid of quoted yes bid/ask"
    last = usd(market.get("last_price_dollars"))
    if last is not None:
        return last, "last trade price"
    if bid is not None:
        return bid, "quoted yes bid"
    return None, "no price"


def yes_ask_from_market(market: dict) -> Decimal | None:
    """Derived YES ask = 1 - best NO bid, per the orderbook docs; falls back to
    the quoted ``yes_ask_dollars`` when the book is unavailable."""
    no_bid = usd(market.get("no_bid_dollars"))
    if no_bid is not None and no_bid > 0:
        return Decimal(1) - no_bid
    return usd(market.get("yes_ask_dollars"))


def iter_markets(events: Iterable[dict]) -> Iterable[tuple[dict, dict]]:
    for event in events:
        for market in event.get("markets") or []:
            yield event, market
