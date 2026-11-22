#!/usr/bin/env python3
"""
Tradebot2 — Verified Kalshi Demo REST & WebSocket Client

Official documentation references:
- Demo environment: https://docs.kalshi.com/getting_started/demo_env
- API environments: https://docs.kalshi.com/getting_started/api_environments
- WebSockets quick start: https://docs.kalshi.com/getting_started/quick_start_websockets
- API keys & signing: https://docs.kalshi.com/getting_started/api_keys
- Create Order (V2): https://docs.kalshi.com/api-reference/orders/create-order-v2
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

DEMO_REST_RECOMMENDED = "https://external-api.demo.kalshi.co/trade-api/v2"
DEMO_REST_LEGACY = "https://demo-api.kalshi.co/trade-api/v2"
DEMO_WS_RECOMMENDED = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2"
DEMO_WS_LEGACY = "wss://demo-api.kalshi.co/trade-api/ws/v2"
DEMO_USER_WS = "wss://user-ws.demo.kalshi.co/trade-api/ws/v2"

API_PREFIX = "/trade-api/v2"
SWING_THRESHOLD_DOLLARS = 0.10

ALLOWED_TOPIC_SERIES: Dict[str, List[str]] = {
    "gas-prices": [
        "KXAAAGASMIN",
        "KXAAAGASMINCA",
        "KXAAAGASCDTX",
        "KXAAAGASCDCA",
        "KXAAAGASCDAK",
    ],
    "elections": [
        "KXFRENCHPRES",
        "CONTROLS",
        "KXPRESPARTY",
        "POWER",
        "KXSPEAKERMAJLEADCOMBO",
    ],
    "culture": [
        "KXOSCARPIC",
        "KXGRAMAOTY",
        "KXGAMEAWARDS",
        "KXGTAPRICE",
    ],
    "crypto": [
        "KXBTCMAX100",
        "KXETHMINY",
        "KXBTC70VS100",
        "KXBTCMAXY",
        "KXCRYPTORETURNY",
    ],
    "golf": [
        "KXPGATOUR",
        "KXPGAMASTERS",
    ],
}


@dataclass
class SwingAlert:
    ts_utc: str
    ticker: str
    topic: str
    prev_price: float
    new_price: float
    delta: float
    high_roi_score: float
    is_selective_high_roi: bool
    reason: str


class KalshiDemoSigner:
    """Signs Kalshi API requests using RSA-PSS SHA-256 or Ed25519 per official docs."""

    def __init__(self, key_id: str, private_key_pem: bytes) -> None:
        from cryptography.hazmat.primitives import serialization

        self.key_id = key_id
        self.private_key = serialization.load_pem_private_key(
            private_key_pem, password=None
        )

    def sign_text(self, message: str) -> str:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

        raw = message.encode("utf-8")
        if isinstance(self.private_key, Ed25519PrivateKey):
            sig = self.private_key.sign(raw)
        else:
            sig = self.private_key.sign(
                raw,
                padding.PSS(
                    mgf=padding.MGF1(hashes.SHA256()),
                    salt_length=padding.PSS.DIGEST_LENGTH,
                ),
                hashes.SHA256(),
            )
        return base64.b64encode(sig).decode("utf-8")

    def headers(self, method: str, full_path: str) -> Dict[str, str]:
        """
        full_path must start at the API root (e.g. '/trade-api/v2/portfolio/balance'
        or '/trade-api/ws/v2') and exclude hostname and query parameters.
        """
        ts_ms = str(int(time.time() * 1000))
        clean_path = full_path.split("?", 1)[0]
        signature = self.sign_text(f"{ts_ms}{method.upper()}{clean_path}")
        return {
            "Content-Type": "application/json",
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-TIMESTAMP": ts_ms,
            "KALSHI-ACCESS-SIGNATURE": signature,
        }


class KalshiDemoClient:
    """REST client targeting Kalshi Demo Trade API v2."""

    def __init__(
        self,
        base_url: str = DEMO_REST_RECOMMENDED,
        key_id: Optional[str] = None,
        private_key_path: Optional[str] = None,
        timeout: int = 15,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.signer: Optional[KalshiDemoSigner] = None
        if key_id and private_key_path:
            with open(private_key_path, "rb") as fh:
                self.signer = KalshiDemoSigner(key_id, fh.read())

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        auth: bool = False,
    ) -> Dict[str, Any]:
        import requests

        endpoint_path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
        headers: Dict[str, str] = {"Accept": "application/json"}
        if auth:
            if not self.signer:
                raise RuntimeError(
                    "Demo API credentials required. Set KALSHI_KEY_ID and KALSHI_PRIVATE_KEY_PATH."
                )
            headers.update(self.signer.headers(method, f"{API_PREFIX}{endpoint_path}"))

        resp = requests.request(
            method=method.upper(),
            url=f"{self.base_url}{endpoint_path}",
            params=params,
            json=json_body,
            headers=headers,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    # --- Public Market Data (no API key required) ---

    def get_events(
        self,
        status: str = "open",
        with_nested_markets: bool = True,
        limit: int = 100,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "status": status,
            "with_nested_markets": str(with_nested_markets).lower(),
            "limit": limit,
        }
        if cursor:
            params["cursor"] = cursor
        return self._request("GET", "/events", params=params, auth=False)

    def get_markets(
        self,
        series_ticker: Optional[str] = None,
        event_ticker: Optional[str] = None,
        status: str = "open",
        limit: int = 100,
    ) -> Dict[str, Any]:
        params: Dict[str, Any] = {"status": status, "limit": limit}
        if series_ticker:
            params["series_ticker"] = series_ticker
        if event_ticker:
            params["event_ticker"] = event_ticker
        return self._request("GET", "/markets", params=params, auth=False)

    def get_orderbook(self, ticker: str, depth: int = 20) -> Dict[str, Any]:
        """
        Official rule: returns YES bids and NO bids sorted ascending (best bid last).
        YES ask at price P equals NO bid at (1.00 - P).
        """
        return self._request(
            "GET",
            f"/markets/{ticker}/orderbook",
            params={"depth": max(0, min(depth, 100))},
            auth=False,
        )

    def batch_get_orderbooks(self, tickers: Iterable[str]) -> Dict[str, Any]:
        ticker_list = list(tickers)[:100]
        return self._request(
            "GET",
            "/markets/orderbooks",
            params={"tickers": ",".join(ticker_list)},
            auth=False,
        )

    def get_candlesticks(
        self,
        series_ticker: str,
        market_ticker: str,
        start_ts: int,
        end_ts: int,
        period_interval: int = 1,
    ) -> Dict[str, Any]:
        """Valid period_interval values per official docs: 1 (min), 60 (hr), 1440 (day)."""
        if period_interval not in (1, 60, 1440):
            raise ValueError("period_interval must be 1, 60, or 1440 per Kalshi API docs")
        return self._request(
            "GET",
            f"/series/{series_ticker}/markets/{market_ticker}/candlesticks",
            params={
                "start_ts": start_ts,
                "end_ts": end_ts,
                "period_interval": period_interval,
            },
            auth=False,
        )

    def get_historical_cutoff(self) -> Dict[str, Any]:
        return self._request("GET", "/historical/cutoff", auth=False)

    # --- Authenticated Demo Portfolio & V2 Order Execution ---

    def get_balance(self, subaccount: int = 0) -> Dict[str, Any]:
        return self._request(
            "GET", "/portfolio/balance", params={"subaccount": subaccount}, auth=True
        )

    def get_positions(self, settlement_status: str = "all") -> Dict[str, Any]:
        return self._request(
            "GET",
            "/portfolio/positions",
            params={"settlement_status": settlement_status},
            auth=True,
        )

    def get_fills(self, limit: int = 100) -> Dict[str, Any]:
        return self._request("GET", "/portfolio/fills", params={"limit": limit}, auth=True)

    def create_order_v2(
        self,
        ticker: str,
        side: str,
        price_dollars: float,
        count: float,
        time_in_force: str = "good_till_canceled",
        client_order_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Submit an event-market order using V2 endpoint POST /trade-api/v2/portfolio/events/orders
        (avoids 10x write token penalty on legacy /portfolio/orders).
        side: 'bid' or 'ask'
        """
        if side not in ("bid", "ask"):
            raise ValueError("V2 event-order side must be 'bid' or 'ask'")
        payload = {
            "ticker": ticker,
            "client_order_id": client_order_id or str(uuid.uuid4()),
            "side": side,
            "count": f"{count:.2f}",
            "price": f"{price_dollars:.4f}",
            "time_in_force": time_in_force,
        }
        return self._request("POST", "/portfolio/events/orders", json_body=payload, auth=True)


def evaluate_high_roi_swing(
    ticker: str,
    topic: str,
    prev_price: float,
    new_price: float,
    bid_ask_spread: float = 0.02,
    top_depth_contracts: int = 500,
) -> Optional[SwingAlert]:
    """
    Detect sudden price swings >= $0.10 in either direction and score for the
    Selective High-ROI alert stream.
    """
    delta = round(new_price - prev_price, 4)
    if abs(delta) < SWING_THRESHOLD_DOLLARS:
        return None

    # Transparent model: favors large overreaction swings with liquid books,
    # tight spreads, and non-extreme pricing where mean-reversion / value ROI is highest.
    mid_band_bonus = max(0.0, 1.0 - abs(new_price - 0.50) * 1.6)
    liquidity_factor = min(1.0, top_depth_contracts / 500.0)
    spread_penalty = max(0.0, 1.0 - (bid_ask_spread / 0.10))
    swing_magnitude = min(1.5, abs(delta) / 0.10)

    score = round((0.35 * swing_magnitude + 0.30 * mid_band_bonus + 0.20 * liquidity_factor + 0.15 * spread_penalty) * 100, 1)
    is_selective = score >= 68.0 and bid_ask_spread <= 0.05 and top_depth_contracts >= 150

    direction = "UP" if delta > 0 else "DOWN"
    reason = (
        f"{direction} swing of ${abs(delta):.2f}; spread=${bid_ask_spread:.2f}, "
        f"depth={top_depth_contracts} contracts, ROI score={score}/100"
    )
    return SwingAlert(
        ts_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        ticker=ticker,
        topic=topic,
        prev_price=prev_price,
        new_price=new_price,
        delta=delta,
        high_roi_score=score,
        is_selective_high_roi=is_selective,
        reason=reason,
    )


async def stream_demo_websocket(
    tickers: List[str],
    ws_url: str = DEMO_WS_RECOMMENDED,
    key_id: Optional[str] = None,
    private_key_path: Optional[str] = None,
) -> None:
    """
    Connect to Kalshi Demo WebSocket API and subscribe to ticker, orderbook_delta,
    and market_lifecycle_v2 channels. Emits >= $0.10 swing alerts in real time.
    """
    import websockets

    if not key_id or not private_key_path:
        raise RuntimeError(
            "Kalshi WebSocket requires authenticated handshake headers. "
            "Provide KALSHI_KEY_ID and KALSHI_PRIVATE_KEY_PATH."
        )

    with open(private_key_path, "rb") as fh:
        signer = KalshiDemoSigner(key_id, fh.read())

    ws_headers = signer.headers("GET", "/trade-api/ws/v2")
    last_prices: Dict[str, float] = {}

    async with websockets.connect(ws_url, additional_headers=ws_headers) as ws:
        sub_msg = {
            "id": 1,
            "cmd": "subscribe",
            "params": {
                "channels": ["ticker", "orderbook_delta", "market_lifecycle_v2"],
                "market_tickers": tickers,
            },
        }
        await ws.send(json.dumps(sub_msg))
        print(f"Connected to {ws_url}; subscribed to {len(tickers)} markets.")

        async for raw_msg in ws:
            event = json.loads(raw_msg)
            msg_type = event.get("type")
            msg = event.get("msg", {})
            ticker = msg.get("market_ticker")

            if msg_type == "ticker" and ticker:
                price_str = msg.get("price_dollars") or msg.get("yes_bid_dollars")
                if price_str is not None:
                    price = float(price_str)
                    if ticker in last_prices:
                        alert = evaluate_high_roi_swing(
                            ticker=ticker,
                            topic="live-demo",
                            prev_price=last_prices[ticker],
                            new_price=price,
                        )
                        if alert:
                            stream_tag = "[HIGH-ROI]" if alert.is_selective_high_roi else "[ALL-SWINGS]"
                            print(f"{alert.ts_utc} {stream_tag} {alert.ticker}: {alert.reason}")
                    last_prices[ticker] = price
            elif msg_type == "market_lifecycle_v2":
                print(
                    f"LIFECYCLE {ticker}: event_type={msg.get('event_type')} "
                    f"settlement_value={msg.get('settlement_value')}"
                )


def main() -> None:
    parser = argparse.ArgumentParser(description="Tradebot2 Kalshi Demo API CLI")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("KALSHI_DEMO_REST_URL", DEMO_REST_RECOMMENDED),
        help="Kalshi Demo REST base URL",
    )
    parser.add_argument(
        "--ws-url",
        default=os.environ.get("KALSHI_DEMO_WS_URL", DEMO_WS_RECOMMENDED),
        help="Kalshi Demo WebSocket URL",
    )
    parser.add_argument(
        "--mode",
        choices=["demo-status", "public-markets", "stream-ws"],
        default="demo-status",
    )
    parser.add_argument(
        "--tickers",
        default="KXAAAGASMIN-26DEC31,KXPRESPARTY-2028,KXGAMEAWARDS-2026,KXETHMINY-27JAN01,KXPGATOUR-MAST27",
        help="Comma-separated market tickers for WebSocket mode",
    )
    args = parser.parse_args()

    key_id = os.environ.get("KALSHI_KEY_ID")
    key_path = os.environ.get("KALSHI_PRIVATE_KEY_PATH")

    if args.mode == "demo-status":
        print(
            json.dumps(
                {
                    "recommended_demo_rest": DEMO_REST_RECOMMENDED,
                    "also_supported_demo_rest": DEMO_REST_LEGACY,
                    "recommended_demo_ws": DEMO_WS_RECOMMENDED,
                    "also_supported_demo_ws": DEMO_WS_LEGACY,
                    "allowed_topics": list(ALLOWED_TOPIC_SERIES.keys()),
                    "swing_threshold_dollars": SWING_THRESHOLD_DOLLARS,
                    "credentials_configured": bool(key_id and key_path),
                },
                indent=2,
            )
        )
    elif args.mode == "public-markets":
        client = KalshiDemoClient(base_url=args.base_url)
        data = client.get_events(status="open", with_nested_markets=True, limit=25)
        print(json.dumps(data, indent=2))
    elif args.mode == "stream-ws":
        tickers = [t.strip() for t in args.tickers.split(",") if t.strip()]
        asyncio.run(
            stream_demo_websocket(
                tickers=tickers,
                ws_url=args.ws_url,
                key_id=key_id,
                private_key_path=key_path,
            )
        )


if __name__ == "__main__":
    main()
