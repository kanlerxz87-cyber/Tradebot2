#!/usr/bin/env python3
"""Probe the Kalshi demo Trade API and write a machine-readable verification record.

Run by .github/workflows/probe-api.yml on a GitHub runner, because the build
sandbox used by the agent sessions has no network egress to Kalshi hosts.
Every claim this script records is read straight off an HTTP response or a
WebSocket handshake; nothing is inferred.

Usage: python3 tools/probe_api.py [--json-out data/verify-api.json]
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import ssl
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests

REST_HOSTS = [
    "https://external-api.demo.kalshi.co/trade-api/v2",
    "https://demo-api.kalshi.co/trade-api/v2",
]
ORIGIN = os.environ.get("PROBE_ORIGIN", "https://kanlerxz87-cyber.github.io")
UA = "tradebot2-verify/1.0 (+https://github.com/kanlerxz87-cyber/Tradebot2)"
TIMEOUT = 25


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def public_paths() -> list[tuple[str, str]]:
    out = [
        ("exchange_status", "/exchange/status"),
        ("markets_open", "/markets?limit=5&status=open"),
        ("events_open", "/events?limit=5&status=open"),
        ("series_list", "/series?category=Economics&limit=5"),
        ("trades", "/markets/trades?limit=5"),
    ]
    return out


def probe_rest() -> dict[str, Any]:
    records: list[dict[str, Any]] = []
    for host in REST_HOSTS:
        for name, path in public_paths():
            url = host + path
            rec: dict[str, Any] = {"name": name, "url": url, "host": host, "path": path,
                                   "requested_at": now_iso()}
            try:
                r = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": UA})
                rec.update({
                    "http_status": r.status_code,
                    "content_type": r.headers.get("content-type", ""),
                    "allow_origin_echo": r.headers.get("access-control-allow-origin", ""),
                    "allow_credentials": r.headers.get("access-control-allow-credentials", ""),
                    "expose_headers": r.headers.get("access-control-expose-headers", ""),
                    "body_bytes": len(r.content),
                    "body_sha256": hashlib.sha256(r.content).hexdigest(),
                    "ok": 200 <= r.status_code < 300 and len(r.content) > 0,
                })
                try:
                    body = r.json()
                    rec["top_level_keys"] = sorted(body.keys())[:12] if isinstance(body, dict) else []
                except Exception:
                    rec["top_level_keys"] = []
            except Exception as exc:  # noqa: BLE001 - record, never hide
                rec.update({"http_status": None, "ok": False, "error": f"{type(exc).__name__}: {exc}"})
            records.append(rec)
    return {"checked_at": now_iso(), "hosts": REST_HOSTS, "records": records}


def probe_cors_preflight() -> dict[str, Any]:
    """Ask the demo host whether a browser at the Pages origin may send a
    preflight for a *signed* request. Records the raw allow-* headers."""
    url = REST_HOSTS[0] + "/portfolio/balance"
    requested = "kalshi-access-key, kalshi-access-signature, kalshi-access-timestamp, content-type"
    rec: dict[str, Any] = {"url": url, "origin": ORIGIN, "requested_headers": requested,
                           "requested_at": now_iso()}
    try:
        r = requests.options(url, timeout=TIMEOUT, headers={
            "User-Agent": UA,
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": requested,
        })
        rec.update({
            "http_status": r.status_code,
            "allow_origin": r.headers.get("access-control-allow-origin", ""),
            "allow_methods": r.headers.get("access-control-allow-methods", ""),
            "allow_headers": r.headers.get("access-control-allow-headers", ""),
            "allow_credentials": r.headers.get("access-control-allow-credentials", ""),
        })
    except Exception as exc:  # noqa: BLE001
        rec.update({"http_status": None, "error": f"{type(exc).__name__}: {exc}"})
    return rec


def probe_unauthenticated_portfolio() -> dict[str, Any]:
    """A signed endpoint called with no signature: records the status an
    unsigned browser request would receive."""
    url = REST_HOSTS[0] + "/portfolio/balance"
    rec: dict[str, Any] = {"url": url, "requested_at": now_iso()}
    try:
        r = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": UA, "Origin": ORIGIN})
        rec.update({"http_status": r.status_code, "allow_origin": r.headers.get("access-control-allow-origin", ""),
                    "body_head": r.text[:300]})
    except Exception as exc:  # noqa: BLE001
        rec.update({"http_status": None, "error": f"{type(exc).__name__}: {exc}"})
    return rec


async def _ws_try(url: str, headers: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {"url": url, "headers_used": sorted(headers.keys())}
    try:
        import websockets  # type: ignore
    except Exception as exc:  # noqa: BLE001
        out.update({"connected": None, "error": f"websockets library unavailable: {exc}"})
        return out
    try:
        ctx = ssl.create_default_context()
        async with websockets.connect(url, additional_headers=headers, open_timeout=20, ssl=ctx) as ws:
            sub = {"id": 1, "cmd": "subscribe", "params": {"channels": ["ticker"]}}
            await ws.send(json.dumps(sub))
            first = await asyncio.wait_for(ws.recv(), timeout=20)
            out.update({"connected": True, "first_message": first[:600]})
    except Exception as exc:  # noqa: BLE001
        out.update({"connected": False, "error": f"{type(exc).__name__}: {exc}"})
    return out


def probe_websockets() -> dict[str, Any]:
    urls = [
        "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
        "wss://demo-api.kalshi.co/trade-api/ws/v2",
    ]
    results = {"checked_at": now_iso(), "unauthenticated": [], "authenticated": []}
    for url in urls:
        results["unauthenticated"].append(asyncio.run(_ws_try(url, {})))
    key = os.environ.get("KALSHI_DEMO_API_KEY_ID", "").strip()
    pem = os.environ.get("KALSHI_DEMO_PRIVATE_KEY", "").strip()
    if key and pem:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
        from kalshi_auth import ws_headers  # noqa: WPS433
        for url in urls:
            results["authenticated"].append(asyncio.run(_ws_try(url, ws_headers(key, pem))))
    else:
        results["authenticated_note"] = (
            "Skipped: no KALSHI_DEMO_API_KEY_ID / KALSHI_DEMO_PRIVATE_KEY secrets configured."
        )
    return results


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json-out", default="data/verify-api.json")
    args = ap.parse_args()
    payload = {
        "generated_by": "tools/probe_api.py",
        "generated_at": now_iso(),
        "environment": "Kalshi demo",
        "rest": probe_rest(),
        "cors_preflight_signed": probe_cors_preflight(),
        "unauthenticated_portfolio": probe_unauthenticated_portfolio(),
        "websockets": probe_websockets(),
    }
    os.makedirs(os.path.dirname(args.json_out) or ".", exist_ok=True)
    with open(args.json_out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, sort_keys=True)
    ok = sum(1 for r in payload["rest"]["records"] if r.get("ok"))
    total = len(payload["rest"]["records"])
    print(f"probe written to {args.json_out}: {ok}/{total} REST probes ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
