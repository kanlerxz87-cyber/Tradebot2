"""Empirical probes for the two deployment questions that documentation alone
cannot answer for a static site:

1. Does the Kalshi demo REST API allow a browser on the GitHub Pages origin to
   read public market data (CORS)?
2. Does the demo WebSocket accept an unauthenticated handshake?

Results are written verbatim to ``data/probe.json`` and published on the site.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any

import requests

from app.config import DEMO_REST, DEMO_REST_ALT, DEMO_WS, PROD_REST


def _iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _headers_subset(headers: Any) -> dict[str, str]:
    wanted = (
        "access-control-allow-origin",
        "access-control-allow-credentials",
        "access-control-allow-headers",
        "access-control-allow-methods",
        "access-control-expose-headers",
        "content-type",
        "x-ratelimit-limit",
        "x-ratelimit-remaining",
        "x-ratelimit-reset",
        "x-ratelimit-cost",
        "http_version",
    )
    return {k: v for k, v in headers.items() if k.lower() in wanted}


def probe_rest(origin: str) -> dict[str, Any]:
    out: dict[str, Any] = {"origin": origin, "hosts": []}
    for base in (DEMO_REST, DEMO_REST_ALT, PROD_REST):
        entry: dict[str, Any] = {"base": base}
        started = time.time()
        try:
            response = requests.get(
                f"{base}/exchange/status",
                headers={"Origin": origin, "Accept": "application/json"},
                timeout=20,
            )
            entry.update(
                {
                    "status": response.status_code,
                    "http_version": response.raw.version,
                    "elapsed_ms": round((time.time() - started) * 1000, 1),
                    "headers": _headers_subset(response.headers),
                    "body_head": response.text[:300],
                }
            )
        except Exception as exc:  # noqa: BLE001 - probe must record any failure
            entry.update({"status": None, "error": f"{type(exc).__name__}: {exc}"})

        try:
            preflight = requests.options(
                f"{base}/portfolio/orders",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": (
                        "kalshi-access-key,kalshi-access-signature,kalshi-access-timestamp,"
                        "content-type"
                    ),
                },
                timeout=20,
            )
            entry["preflight"] = {
                "status": preflight.status_code,
                "headers": _headers_subset(preflight.headers),
            }
        except Exception as exc:  # noqa: BLE001
            entry["preflight"] = {"status": None, "error": f"{type(exc).__name__}: {exc}"}
        out["hosts"].append(entry)
    return out


async def _ws_attempt(url: str) -> dict[str, Any]:
    entry: dict[str, Any] = {"url": url}
    try:
        import websockets
    except ImportError:
        return {**entry, "upgraded": None, "error": "websockets package not installed"}
    try:
        async with websockets.connect(url, open_timeout=15) as socket:
            await socket.send(
                json.dumps(
                    {
                        "id": 1,
                        "cmd": "subscribe",
                        "params": {"channels": ["ticker"], "market_tickers": []},
                    }
                )
            )
            try:
                message = await asyncio.wait_for(socket.recv(), timeout=8)
            except asyncio.TimeoutError:
                message = ""
            return {
                **entry,
                "upgraded": True,
                "response_head": str(message)[:500],
            }
    except Exception as exc:  # noqa: BLE001
        detail: dict[str, Any] = {}
        response = getattr(exc, "response", None)
        if response is not None:
            detail = {
                "http_status": getattr(response, "status_code", None),
                "headers": _headers_subset(response.headers),
                "body_head": (getattr(response, "body", b"") or b"")[:500].decode(
                    "utf-8", "replace"
                ),
            }
        return {
            **entry,
            "upgraded": False,
            "error": f"{type(exc).__name__}: {exc}",
            **detail,
        }


def probe_ws() -> dict[str, Any]:
    urls = (DEMO_WS, "wss://demo-api.kalshi.co/trade-api/ws/v2")
    results = [asyncio.run(_ws_attempt(url)) for url in urls]
    return {
        "generated_at": _iso(),
        "attempted_unauthenticated": True,
        "results": results,
    }


def run_probes(origin: str = "https://kanlerxz87-cyber.github.io") -> dict[str, Any]:
    rest = probe_rest(origin)
    ws = probe_ws()
    public_hosts = [h for h in rest["hosts"] if h["base"] in {DEMO_REST, DEMO_REST_ALT}]
    cors_ok = any(
        str((h.get("headers") or {}).get("access-control-allow-origin", "")).strip()
        in {origin, "*"}
        for h in public_hosts
    )
    return {
        "schema_version": 1,
        "generated_at": _iso(),
        "origin": origin,
        "runner": "GitHub Actions (ubuntu-latest)",
        "rest": rest,
        "cors_public_read_allowed": cors_ok,
        "ws": ws,
        "notes": [
            "CORS headers are decided by the server per request; a proxy, corporate "
            "network or browser policy can still block a visitor.",
            "The WebSocket API requires a signed handshake even for public channels "
            "(official docs); the probe records what the server actually did.",
        ],
    }


if __name__ == "__main__":
    print(json.dumps(run_probes(), indent=2)[:4000])
