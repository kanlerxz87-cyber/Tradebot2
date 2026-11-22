"""Minimal, dependency-light client for the Kalshi Trade API v2 (public reads).

Every path and query parameter used here is taken from the official docs at
https://docs.kalshi.com (links are recorded in SOURCES.md).  Nothing about the
response is assumed: fields are read by their documented names and any missing
field is surfaced as None rather than guessed.
"""
from __future__ import annotations

import json
import os
import random
import time
from typing import Any, Iterable
from urllib.parse import urlencode

import requests

DEMO_HOSTS = [
    "https://external-api.demo.kalshi.co/trade-api/v2",
    "https://demo-api.kalshi.co/trade-api/v2",
]
PROD_HOSTS = [
    "https://external-api.kalshi.com/trade-api/v2",
    "https://api.elections.kalshi.com/trade-api/v2",
]
USER_AGENT = "tradebot2-collector/1.0 (+https://github.com/kanlerxz87-cyber/Tradebot2)"


class KalshiError(RuntimeError):
    pass


class KalshiClient:
    """Public (unauthenticated) reads with host fallback and polite backoff."""

    def __init__(self, env: str = "demo", timeout: int = 25, pause: float = 0.12,
                 session: requests.Session | None = None,
                 max_transport_failures: int = 3) -> None:
        self.env = env
        self.hosts = DEMO_HOSTS if env == "demo" else PROD_HOSTS
        self.host = self.hosts[0]
        self.timeout = timeout
        self.pause = pause
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
        self.calls: list[dict[str, Any]] = []
        self.transport_failures = 0
        self.max_transport_failures = max_transport_failures

    # -- transport ---------------------------------------------------------
    def _url(self, path: str, params: dict[str, Any] | None) -> str:
        url = self.host + path
        if params:
            clean = {k: v for k, v in params.items() if v is not None}
            if clean:
                url += "?" + urlencode(clean)
        return url

    def get(self, path: str, params: dict[str, Any] | None = None, *, retries: int = 4) -> dict[str, Any]:
        last_exc: Exception | None = None
        for attempt in range(retries):
            url = self._url(path, params)
            started = time.time()
            try:
                resp = self.session.get(url, timeout=self.timeout)
                if resp.status_code == 429:
                    time.sleep(min(2 ** attempt, 20) + random.random())
                    last_exc = KalshiError(f"429 rate limited: {url}")
                    continue
                if resp.status_code >= 500:
                    time.sleep(min(2 ** attempt, 20))
                    last_exc = KalshiError(f"{resp.status_code} server error: {url}")
                    continue
                if resp.status_code >= 400:
                    raise KalshiError(f"{resp.status_code} {resp.text[:300]} for {url}")
                payload = resp.json()
                self.calls.append({"url": url, "status": resp.status_code,
                                   "ms": int((time.time() - started) * 1000)})
                if self.pause:
                    time.sleep(self.pause)
                return payload
            except KalshiError:
                raise
            except Exception as exc:  # network errors -> rotate host, then retry
                last_exc = exc
                self.transport_failures += 1
                self.host = self.hosts[(self.hosts.index(self.host) + 1) % len(self.hosts)]
                if self.transport_failures >= self.max_transport_failures:
                    raise KalshiError(
                        "network transport to Kalshi failed repeatedly "
                        f"({self.transport_failures} attempts, last: {type(exc).__name__}: {exc}). "
                        "This sandbox/proxy appears to block kalshi.co; run the collector in "
                        "GitHub Actions (see .github/workflows/collect.yml).") from exc
                time.sleep(min(2 ** attempt, 20))
        raise KalshiError(f"GET failed after {retries} attempts: {path} ({last_exc})")

    # -- documented endpoints ---------------------------------------------
    def exchange_status(self) -> dict[str, Any]:
        return self.get("/exchange/status")

    def markets(self, **params: Any) -> list[dict[str, Any]]:
        return self._paged("/markets", params, "markets")

    def events(self, **params: Any) -> list[dict[str, Any]]:
        return self._paged("/events", params, "events")

    def series_list(self, **params: Any) -> list[dict[str, Any]]:
        return self._paged("/series", params, "series", max_pages=40)

    def series_page(self, **params: Any) -> list[dict[str, Any]]:
        """One page of /series. Discovery uses this: it never re-reads a page
        that the host returned unfiltered (see collect._server_filters)."""
        params.setdefault("limit", 200)
        payload = self.get("/series", params)
        rows = payload.get("series", []) or []
        if not rows:
            return []
        return rows

    def market(self, ticker: str) -> dict[str, Any]:
        return self.get(f"/markets/{ticker}").get("market", {})

    def orderbook(self, ticker: str, depth: int | None = None) -> dict[str, Any]:
        return self.get(f"/markets/{ticker}/orderbook", {"depth": depth})

    def trades(self, **params: Any) -> list[dict[str, Any]]:
        return self._paged("/markets/trades", params, "trades", max_pages=20)

    def candlesticks(self, series_ticker: str, ticker: str, start_ts: int, end_ts: int,
                     period_interval: int = 1) -> list[dict[str, Any]]:
        payload = self.get(f"/series/{series_ticker}/markets/{ticker}/candlesticks",
                           {"start_ts": start_ts, "end_ts": end_ts,
                            "period_interval": period_interval})
        return payload.get("candlesticks", [])

    # -- helpers -----------------------------------------------------------
    def _paged(self, path: str, params: dict[str, Any], key: str, max_pages: int = 40) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        cursor: str | None = None
        query = dict(params)
        query.setdefault("limit", 200)
        for _ in range(max_pages):
            page = self.get(path, {**query, "cursor": cursor})
            out.extend(page.get(key, []) or [])
            cursor = page.get("cursor") or None
            if not cursor:
                break
        return out


def demo_client() -> KalshiClient:
    return KalshiClient(env=os.environ.get("KALSHI_ENV", "demo"))


def as_float(value: Any, default: float | None = None) -> float | None:
    """Parse a fixed-point string ('0.5600', '10.00') or number to float.

    Returns `default` for None/'' so callers can distinguish 'unknown' from 0.
    """
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def write_json(path: str, payload: Any) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
        fh.write("\n")
    os.replace(tmp, path)


def read_json(path: str, default: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return default
