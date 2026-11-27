"""Optional local live server.

The published GitHub Pages site is a static client that reads the Kalshi public
API directly from the browser. This server adds what a static site cannot do:

  * server-side polling plus a persistent alert log (SSE stream)
  * paper-trading state that survives a browser refresh
  * authenticated demo-account reads and opt-in order placement

Run:
    pip install -r app/requirements.txt
    python -m app.server
"""

from __future__ import annotations

import asyncio
import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .alerts import SwingDetector, quote_price
from .config import DATA_DIR, REPO_ROOT, Settings, load_settings
from .kalshi import KalshiClient, KalshiError
from .paper import PaperBroker
from .strategies import STRATEGIES, best_opportunity

STATE_PATH = DATA_DIR / "paper_state.json"
SNAPSHOT_PATH = DATA_DIR / "snapshot.json"


def _iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


class LiveEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = KalshiClient(
            base_url=settings.rest_base,
            api_key_id=settings.api_key_id,
            private_key=KalshiClient.from_settings(settings).private_key,
        )
        self.detector = SwingDetector(threshold=settings.swing_threshold)
        self.broker = PaperBroker(starting_cash=settings.starting_cash, strategies=tuple(STRATEGIES))
        self.lock = threading.Lock()
        self.alerts: list[dict[str, Any]] = []
        self.quotes: dict[str, dict[str, Any]] = {}
        self.snapshot: dict[str, Any] = {}
        self.last_poll: str | None = None
        self.last_error: str | None = None
        self.running = False
        self.tickers: list[str] = []
        self.subscribers: list[asyncio.Queue] = []
        self._load_snapshot()
        self._load_state()

    # -- persistence ----------------------------------------------------------
    def _load_snapshot(self) -> None:
        if SNAPSHOT_PATH.exists():
            try:
                self.snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
                self.tickers = [
                    str(m["ticker"]) for m in self.snapshot.get("markets", []) if m.get("ticker")
                ]
                for market in self.snapshot.get("markets", []):
                    self.quotes[str(market["ticker"])] = {
                        "ticker": market["ticker"],
                        "title": market.get("title"),
                        "topic": market.get("topic"),
                        "prices": market.get("prices"),
                        "volume": market.get("volume"),
                        "links": market.get("links"),
                    }
            except (json.JSONDecodeError, KeyError) as exc:
                self.last_error = f"snapshot load failed: {exc}"

    def _load_state(self) -> None:
        if not STATE_PATH.exists():
            return
        try:
            payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return
        for account in payload.get("accounts", []):
            acct = self.broker.account(account.get("strategy", ""))
            acct.cash = float(account.get("cash", acct.cash))
            acct.starting_cash = float(account.get("starting_cash", acct.starting_cash))
            acct.realized_pnl = float(account.get("realized_pnl", 0.0))
        self.alerts = payload.get("alerts", [])[-300:]

    def save_state(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "saved_at": _iso(),
            "mode": "paper",
            "accounts": [
                {
                    "strategy": acct.strategy,
                    "cash": acct.cash,
                    "starting_cash": acct.starting_cash,
                    "realized_pnl": acct.realized_pnl,
                }
                for acct in self.broker.accounts.values()
            ],
            "open_positions": [
                pos.to_dict()
                for acct in self.broker.accounts.values()
                for pos in acct.positions.values()
            ],
            "alerts": self.alerts[-300:],
        }
        STATE_PATH.write_text(json.dumps(payload, indent=1), encoding="utf-8")

    # -- polling --------------------------------------------------------------
    def poll_once(self) -> None:
        if not self.tickers:
            self._load_snapshot()
        if not self.tickers:
            return
        with self.lock:
            # The demo API supports a comma-separated ticker filter; keep batches
            # small so one bad ticker cannot blank the whole feed.
            quotes: list[dict[str, Any]] = []
            for start in range(0, len(self.tickers), 25):
                batch = self.tickers[start : start + 25]
                try:
                    quotes.extend(self.client.get_markets_by_tickers(batch))
                except (KalshiError, Exception) as exc:  # noqa: BLE001
                    self.last_error = f"poll: {exc}"
            now = time.time()
            marks: dict[str, float] = {}
            for market in quotes:
                ticker = str(market.get("ticker"))
                price, basis = quote_price(market)
                existing = self.quotes.get(ticker) or {}
                previous = existing.get("prices") or {}
                topic = existing.get("topic") or next(
                    (
                        m.get("topic", "")
                        for m in self.snapshot.get("markets", [])
                        if m.get("ticker") == ticker
                    ),
                    "",
                )
                links = existing.get("links") or next(
                    (
                        m.get("links")
                        for m in self.snapshot.get("markets", [])
                        if m.get("ticker") == ticker
                    ),
                    None,
                )
                self.quotes[ticker] = {
                    "ticker": ticker,
                    "title": market.get("title"),
                    "topic": topic,
                    "links": links,
                    "event_ticker": market.get("event_ticker"),
                    "prices": {
                        "yes_bid": market.get("yes_bid_dollars"),
                        "yes_ask": market.get("yes_ask_dollars"),
                        "last": market.get("last_price_dollars"),
                        "mid": price,
                        "basis": basis,
                        "previous_mid": previous.get("mid"),
                    },
                    "volume": {
                        "last_24h_contracts": market.get("volume_24h_fp"),
                        "open_interest_contracts": market.get("open_interest_fp"),
                    },
                }
                alert = self.detector.observe(
                    market, topic=topic, title=str(market.get("title") or ticker), ts=now
                )
                if alert:
                    self._on_alert(alert)
                if price is not None:
                    marks[ticker] = price
            self.broker.mark(marks, ts=now)
            self._settle()
            self.last_poll = _iso()

    def _on_alert(self, alert: Any) -> None:
        payload = alert.to_dict()
        market = self.quotes.get(alert.ticker) or {}
        payload["links"] = market.get("links")
        self.alerts.append(payload)
        self.alerts = self.alerts[-500:]
        for queue in list(self.subscribers):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                pass
        # Automatic paper trading from the model feed.
        for strategy in STRATEGIES:
            opp = best_opportunity(
                {
                    "ticker": alert.ticker,
                    "title": alert.title,
                    "topic": alert.topic,
                    "yes_bid_dollars": (market.get("prices") or {}).get("yes_bid"),
                    "yes_ask_dollars": (market.get("prices") or {}).get("yes_ask"),
                    "volume_24h_fp": (market.get("volume") or {}).get("last_24h_contracts"),
                },
                alert=alert,
                book=None,
                strategies=(strategy,),
            )
            if opp is None or opp.score < 55:
                continue
            acct = self.broker.account(strategy)
            if any(p.ticker == alert.ticker for p in acct.positions.values()):
                continue
            self.broker.open(opp)

    def _settle(self) -> None:
        resolutions = {
            str(row["ticker"]): str(row["result"])
            for row in self.snapshot.get("resolutions", [])
            if row.get("result") in {"yes", "no"}
        }
        if resolutions:
            self.broker.settle_resolved(resolutions)

    def start(self) -> None:
        if self.running:
            return
        self.running = True

        def loop() -> None:
            while self.running:
                try:
                    self.poll_once()
                except Exception as exc:  # noqa: BLE001
                    self.last_error = f"poll loop: {exc}"
                time.sleep(max(1.0, self.settings.poll_seconds))

        threading.Thread(target=loop, name="kalshi-poller", daemon=True).start()

    def stop(self) -> None:
        self.running = False

    def status(self) -> dict[str, Any]:
        return {
            "environment": self.settings.environment,
            "api_base": self.settings.rest_base,
            "poll_seconds": self.settings.poll_seconds,
            "tickers": len(self.tickers),
            "last_poll": self.last_poll,
            "last_error": self.last_error,
            "alerts": len(self.alerts),
            "threshold": self.settings.swing_threshold,
            "credentials_configured": self.settings.has_credentials,
            "trading_active": self.settings.trading_active,
            "snapshot_generated_at": self.snapshot.get("generated_at"),
            "mode": "paper" if not self.settings.trading_active else "demo-order-capable",
        }


settings = load_settings()
engine = LiveEngine(settings)
app = FastAPI(title="Kalshi demo dashboard", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    engine.start()


@app.on_event("shutdown")
def _shutdown() -> None:
    engine.save_state()
    engine.stop()


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", **engine.status()}


@app.get("/api/snapshot")
def snapshot() -> JSONResponse:
    return JSONResponse(engine.snapshot or {"error": "no snapshot"})


@app.get("/api/live")
def live() -> dict[str, Any]:
    with engine.lock:
        marks = {
            ticker: (quote.get("prices") or {}).get("mid")
            for ticker, quote in engine.quotes.items()
            if (quote.get("prices") or {}).get("mid") is not None
        }
        return {
            "status": engine.status(),
            "quotes": engine.quotes,
            "alerts": engine.alerts[-100:],
            "portfolio": engine.broker.snapshot(marks),
        }


@app.get("/api/alerts")
def alerts(limit: int = Query(default=100, ge=1, le=500)) -> dict[str, Any]:
    return {"alerts": engine.alerts[-limit:], "server_time": _iso()}


@app.get("/api/stream")
async def stream() -> StreamingResponse:
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    engine.subscribers.append(queue)

    async def generator():
        try:
            yield 'event: hello\ndata: {"ok":true}\n\n'
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: alert\ndata: {json.dumps(payload)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            if queue in engine.subscribers:
                engine.subscribers.remove(queue)

    return StreamingResponse(generator(), media_type="text/event-stream")


@app.get("/api/markets")
def markets(tickers: str = "") -> dict[str, Any]:
    wanted = [t for t in tickers.split(",") if t]
    try:
        data = engine.client.get_markets_by_tickers(wanted)
        return {"markets": data, "server_time": _iso()}
    except KalshiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/market/{ticker}/orderbook")
def orderbook(ticker: str, depth: int = 10) -> dict[str, Any]:
    try:
        return engine.client.get_orderbook(ticker, depth=depth)
    except KalshiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/market/{series}/{ticker}/candles")
def candles(series: str, ticker: str, hours: int = 6, period: int = 1) -> dict[str, Any]:
    now = int(time.time())
    try:
        return engine.client.get_candlesticks(
            series_ticker=series,
            ticker=ticker,
            start_ts=now - hours * 3600,
            end_ts=now,
            period_interval=period,
        )
    except KalshiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/portfolio")
def portfolio() -> dict[str, Any]:
    marks = {
        ticker: (quote.get("prices") or {}).get("mid")
        for ticker, quote in engine.quotes.items()
        if (quote.get("prices") or {}).get("mid") is not None
    }
    return engine.broker.snapshot(marks)


@app.get("/api/demo/portfolio")
def demo_portfolio() -> dict[str, Any]:
    if not engine.settings.has_credentials:
        return {
            "connected": False,
            "verified": False,
            "reason": "KALSHI_API_KEY_ID / KALSHI_PRIVATE_KEY_PATH not configured",
        }
    try:
        return {
            "connected": True,
            "verified": True,
            "environment": engine.settings.environment,
            "balance": engine.client.get_balance(),
            "positions": engine.client.get_positions(),
            "orders": engine.client.get_orders(status="resting"),
            "fetched_at": _iso(),
        }
    except KalshiError as exc:
        return {"connected": True, "verified": False, "error": str(exc)}


@app.post("/api/demo/order")
def demo_order(payload: dict[str, Any]) -> dict[str, Any]:
    if not engine.settings.trading_active:
        raise HTTPException(
            status_code=403,
            detail=(
                "Real order placement is disabled. Set TRADEBOT_ENABLE_TRADING=true, "
                "TRADEBOT_PAPER_ONLY=false and provide demo API credentials."
            ),
        )
    try:
        return engine.client.create_event_order(
            ticker=str(payload["ticker"]),
            side=str(payload.get("side", "bid")),
            price=float(payload["price"]),
            count=float(payload.get("count", 1)),
            time_in_force=str(payload.get("time_in_force", "immediate_or_cancel")),
            self_trade_prevention_type=str(
                payload.get("self_trade_prevention_type", "taker_at_cross")
            ),
        )
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KalshiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/")
def index() -> FileResponse:
    return FileResponse(REPO_ROOT / "index.html")


app.mount("/", StaticFiles(directory=str(REPO_ROOT), html=True), name="site")


def main() -> None:
    import uvicorn

    uvicorn.run("app.server:app", host="0.0.0.0", port=int(__import__("os").getenv("PORT", "8000")))


if __name__ == "__main__":
    main()
