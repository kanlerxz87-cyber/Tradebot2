"""Minimal, dependency-light Kalshi Trade API v2 client.

Endpoints and semantics are taken from the official documentation (links in
``docs/api-verification.md``). Public market-data calls need no authentication;
portfolio and order calls are signed with an API key.

Signing (official docs):
    message = timestamp_ms + METHOD + path_without_query
    signature = base64(Ed25519(message)) or base64(RSA-PSS-SHA256(message))
    headers  = KALSHI-ACCESS-KEY / -TIMESTAMP / -SIGNATURE

No credential is ever read from the repository; only environment variables.
"""

from __future__ import annotations

import base64
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any, Iterator
from urllib.parse import urlparse

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from .config import DEMO_REST, DEMO_REST_ALT, PROD_REST, Settings


class KalshiError(RuntimeError):
    def __init__(self, status: int, code: str, message: str, body: Any = None) -> None:
        super().__init__(f"[{status}] {code}: {message}")
        self.status = status
        self.code = code
        self.message = message
        self.body = body


@dataclass
class KalshiClient:
    base_url: str = DEMO_REST
    api_key_id: str | None = None
    private_key: Any = None
    timeout: float = 30.0
    session: requests.Session | None = None

    # -- construction ---------------------------------------------------------
    @classmethod
    def from_settings(cls, settings: Settings) -> "KalshiClient":
        key = None
        if settings.api_key_id:
            if settings.private_key_pem:
                pem = settings.private_key_pem
                if "BEGIN" not in pem:
                    pem = base64.b64decode(pem).decode()
                key = serialization.load_pem_private_key(pem.encode(), password=None)
            elif settings.private_key_path:
                with open(settings.private_key_path, "rb") as handle:
                    key = serialization.load_pem_private_key(handle.read(), password=None)
        return cls(
            base_url=settings.rest_base,
            api_key_id=settings.api_key_id,
            private_key=key,
        )

    def __post_init__(self) -> None:
        if self.session is None:
            self.session = requests.Session()
            self.session.headers.update({"User-Agent": "tradebot2-dashboard/1.0"})

    # -- signing --------------------------------------------------------------
    @property
    def authenticated(self) -> bool:
        return bool(self.api_key_id and self.private_key is not None)

    def _signed_path(self, path: str) -> str:
        """Return the full API path from host root without query parameters.

        Per https://docs.kalshi.com/getting_started/api_environments#request-signing,
        Kalshi verifies signatures against the full path from the API root (for
        example ``/trade-api/v2/portfolio/orders``), never a base-URL-relative
        suffix and never with query parameters.
        """
        clean = path.split("?", 1)[0]
        if not clean.startswith("/"):
            clean = "/" + clean
        base_prefix = urlparse(self.base_url).path.rstrip("/")
        if base_prefix and clean != base_prefix and not clean.startswith(base_prefix + "/"):
            clean = f"{base_prefix}{clean}"
        return clean

    def sign(self, timestamp_ms: str, method: str, path: str) -> str:
        """Sign ``timestamp + METHOD + full_path`` (query string stripped)."""
        if self.private_key is None:
            raise KalshiError(401, "missing_private_key", "No private key configured")
        clean_path = self._signed_path(path)
        message = f"{timestamp_ms}{method.upper()}{clean_path}".encode("utf-8")
        if isinstance(self.private_key, Ed25519PrivateKey):
            signature = self.private_key.sign(message)
        else:
            signature = self.private_key.sign(
                message,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.DIGEST_LENGTH,
                ),
                hashes.SHA256(),
            )
        return base64.b64encode(signature).decode("ascii")

    def auth_headers(self, method: str, path: str) -> dict[str, str]:
        timestamp = str(int(time.time() * 1000))
        return {
            "KALSHI-ACCESS-KEY": str(self.api_key_id),
            "KALSHI-ACCESS-TIMESTAMP": timestamp,
            "KALSHI-ACCESS-SIGNATURE": self.sign(timestamp, method, path),
        }

    # -- transport ------------------------------------------------------------
    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_body: dict[str, Any] | None = None,
        auth: bool = False,
        retries: int = 2,
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = {"Accept": "application/json"}
        if json_body is not None:
            headers["Content-Type"] = "application/json"
        if auth:
            if not self.authenticated:
                raise KalshiError(401, "not_authenticated", "API key/private key not configured")
            headers.update(self.auth_headers(method, path))

        last_error: Exception | None = None
        for attempt in range(retries + 1):
            response = self.session.request(  # type: ignore[union-attr]
                method,
                url,
                params=params,
                data=json.dumps(json_body) if json_body is not None else None,
                headers=headers,
                timeout=self.timeout,
            )
            if response.status_code == 429 and attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            if response.status_code >= 400:
                code = "http_error"
                message = response.text[:500]
                body: Any = None
                try:
                    body = response.json()
                    if isinstance(body, dict):
                        err = body.get("error") if isinstance(body.get("error"), dict) else body
                        code = str(err.get("code") or err.get("error") or code)
                        message = str(err.get("message") or message)
                except ValueError:
                    body = response.text[:2000]
                raise KalshiError(response.status_code, code, message, body)
            if not response.content:
                return {}
            try:
                return response.json()
            except ValueError:
                return {"raw": response.text}
        raise KalshiError(429, "too_many_requests", str(last_error or "rate limited"))

    # -- public market data ---------------------------------------------------
    def exchange_status(self) -> dict[str, Any]:
        return self.request("GET", "/exchange/status")

    def get_markets(
        self,
        *,
        status: str | None = None,
        limit: int = 1000,
        cursor: str | None = None,
        tickers: list[str] | None = None,
        event_ticker: str | None = None,
        series_ticker: str | None = None,
        min_close_ts: int | None = None,
        max_close_ts: int | None = None,
        min_settled_ts: int | None = None,
        mve_filter: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if status:
            params["status"] = status
        if cursor:
            params["cursor"] = cursor
        if tickers:
            params["tickers"] = ",".join(tickers)
        if event_ticker:
            params["event_ticker"] = event_ticker
        if series_ticker:
            params["series_ticker"] = series_ticker
        if min_close_ts:
            params["min_close_ts"] = min_close_ts
        if max_close_ts:
            params["max_close_ts"] = max_close_ts
        if min_settled_ts:
            params["min_settled_ts"] = min_settled_ts
        if mve_filter:
            params["mve_filter"] = mve_filter
        return self.request("GET", "/markets", params=params)

    def iter_markets(self, *, status: str, max_pages: int = 20, **kwargs: Any) -> Iterator[dict[str, Any]]:
        cursor: str | None = None
        for _ in range(max_pages):
            page = self.get_markets(status=status, cursor=cursor, **kwargs)
            for market in page.get("markets", []):
                yield market
            cursor = page.get("cursor") or ""
            if not cursor:
                break

    def get_market(self, ticker: str) -> dict[str, Any]:
        return self.request("GET", f"/markets/{ticker}")

    def get_markets_by_tickers(self, tickers: list[str]) -> list[dict[str, Any]]:
        if not tickers:
            return []
        payload = self.request("GET", "/markets", params={"tickers": ",".join(tickers)})
        return payload.get("markets", [])

    def get_events(self, *, status: str | None = None, limit: int = 200, cursor: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if status:
            params["status"] = status
        if cursor:
            params["cursor"] = cursor
        return self.request("GET", "/events", params=params)

    def get_event(self, event_ticker: str) -> dict[str, Any]:
        return self.request("GET", f"/events/{event_ticker}")

    def get_series_list(
        self,
        *,
        category: str | None = None,
        tags: str | None = None,
        limit: int = 200,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """`GET /series` — the official way to enumerate a category/tag."""
        params: dict[str, Any] = {"limit": limit}
        if category:
            params["category"] = category
        if tags:
            params["tags"] = tags
        if cursor:
            params["cursor"] = cursor
        return self.request("GET", "/series", params=params)

    def get_series(self, series_ticker: str) -> dict[str, Any]:
        return self.request("GET", f"/series/{series_ticker}")

    def get_orderbook(self, ticker: str, depth: int = 10) -> dict[str, Any]:
        return self.request("GET", f"/markets/{ticker}/orderbook", params={"depth": depth})

    def get_trades(
        self,
        *,
        ticker: str | None = None,
        limit: int = 100,
        min_ts: int | None = None,
        max_ts: int | None = None,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if ticker:
            params["ticker"] = ticker
        if min_ts:
            params["min_ts"] = min_ts
        if max_ts:
            params["max_ts"] = max_ts
        if cursor:
            params["cursor"] = cursor
        return self.request("GET", "/markets/trades", params=params)

    def get_candlesticks(
        self,
        *,
        series_ticker: str,
        ticker: str,
        start_ts: int,
        end_ts: int,
        period_interval: int = 1,
        include_latest_before_start: bool = True,
    ) -> dict[str, Any]:
        return self.request(
            "GET",
            f"/series/{series_ticker}/markets/{ticker}/candlesticks",
            params={
                "start_ts": start_ts,
                "end_ts": end_ts,
                "period_interval": period_interval,
                "include_latest_before_start": str(include_latest_before_start).lower(),
            },
        )

    # -- authenticated portfolio ---------------------------------------------
    def get_balance(self) -> dict[str, Any]:
        return self.request("GET", "/portfolio/balance", auth=True)

    def get_positions(self, *, limit: int = 200, cursor: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        return self.request("GET", "/portfolio/positions", params=params, auth=True)

    def get_orders(self, *, limit: int = 100, status: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"limit": limit}
        if status:
            params["status"] = status
        return self.request("GET", "/portfolio/orders", params=params, auth=True)

    def get_settlements(self, *, limit: int = 100) -> dict[str, Any]:
        return self.request("GET", "/portfolio/settlements", params={"limit": limit}, auth=True)

    def create_event_order(
        self,
        *,
        ticker: str,
        side: str,
        price: float,
        count: float,
        time_in_force: str = "immediate_or_cancel",
        self_trade_prevention_type: str = "taker_at_cross",
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        """Place an order using the current V2 event-order shape.

        ``side`` is expressed on the YES leg (docs: "bid means buy YES, ask means
        sell YES"). Selling YES is economically equivalent to buying NO.
        Per https://docs.kalshi.com/api-reference/orders/create-order-v2,
        ``ticker``, ``side``, ``count``, ``price``, ``time_in_force`` and
        ``self_trade_prevention_type`` are all required fields.
        """

        if side not in {"bid", "ask"}:
            raise ValueError("side must be 'bid' (buy YES) or 'ask' (sell YES / buy NO)")
        if not (0.01 <= price <= 0.99):
            raise ValueError("price must be between $0.01 and $0.99")
        if count <= 0:
            raise ValueError("count must be positive")
        if time_in_force not in {"fill_or_kill", "good_till_canceled", "immediate_or_cancel"}:
            raise ValueError(
                "time_in_force must be 'fill_or_kill', 'good_till_canceled', or 'immediate_or_cancel'"
            )
        if self_trade_prevention_type not in {"taker_at_cross", "maker"}:
            raise ValueError("self_trade_prevention_type must be 'taker_at_cross' or 'maker'")
        body = {
            "ticker": ticker,
            "client_order_id": client_order_id or str(uuid.uuid4()),
            "side": side,
            "count": f"{count:.2f}",
            "price": f"{price:.4f}",
            "time_in_force": time_in_force,
            "self_trade_prevention_type": self_trade_prevention_type,
        }
        return self.request("POST", "/portfolio/events/orders", json_body=body, auth=True)

    def cancel_order(
        self,
        order_id: str,
        *,
        market_ticker: str | None = None,
        exchange_index: int | None = None,
    ) -> dict[str, Any]:
        """Cancel an event order via ``DELETE /portfolio/events/orders/{order_id}``.

        Per https://docs.kalshi.com/api-reference/orders/cancel-order-v2, shard
        auto-routing requires ``market_ticker`` when ``exchange_index`` is omitted.
        """
        params: dict[str, Any] = {}
        if market_ticker:
            params["market_ticker"] = market_ticker
        if exchange_index is not None:
            params["exchange_index"] = exchange_index
        return self.request(
            "DELETE",
            f"/portfolio/events/orders/{order_id}",
            params=params or None,
            auth=True,
        )


def public_client(environment: str = "demo") -> KalshiClient:
    return KalshiClient(base_url=DEMO_REST if environment == "demo" else PROD_REST)
