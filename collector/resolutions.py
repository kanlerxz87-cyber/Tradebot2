"""Resolution tracker: follows tracked markets until they settle, then records
how each one resolved (yes / no) from the exchange's own `result` field.

Sources
  Market lifecycle & status values: https://docs.kalshi.com/getting_started/market_lifecycle
  Market object `result` enum:      https://docs.kalshi.com/api-reference/market/get-market
  Settlement payouts:               https://docs.kalshi.com/getting_started/market_settlement
  Historical archive:               https://docs.kalshi.com/getting_started/historical_data
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

try:
    from .kalshi import KalshiClient, as_float, demo_client, read_json, write_json
except ImportError:  # direct execution
    from kalshi import KalshiClient, as_float, demo_client, read_json, write_json  # type: ignore

RESOLVED = {"determined", "finalized", "disputed", "amended"}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build(data_dir: str, markets: list[dict], client: KalshiClient | None = None) -> dict:
    path = os.path.join(data_dir, "resolutions.json")
    doc = read_json(path, {"records": [], "generated_at": None})
    known = {r["ticker"]: r for r in doc.get("records", [])}

    # 1. Track every market we have seen, open or already resolved.
    for m in markets:
        rec = known.setdefault(m["ticker"], {
            "ticker": m["ticker"], "series_ticker": m.get("series_ticker"),
            "event_ticker": m.get("event_ticker"), "topic": m.get("topic"),
            "title": m.get("title"), "subtitle": m.get("subtitle"),
            "first_seen": utc_now(), "source_url": m.get("api_url"),
            "close_time": m.get("close_time"),
        })
        for key in ("status", "result", "settlement_ts", "settlement_value_dollars",
                    "expiration_value", "close_time", "last_price_dollars"):
            rec[key] = m.get(key, rec.get(key))
        rec["state"] = "resolved" if (m.get("result") in ("yes", "no")) else "open"
        rec["last_seen"] = utc_now()

    # 2. Ask the exchange for the current state of anything not yet resolved,
    #    including markets that disappeared from the open list.
    unresolved = [t for t, r in known.items() if r.get("state") != "resolved"]
    if client is None and unresolved:
        try:
            client = demo_client()
        except Exception:  # noqa: BLE001 - offline test runs
            client = None
    if client is not None:
        for ticker in unresolved[:200]:
            try:
                mk = client.market(ticker)
            except Exception:  # noqa: BLE001
                continue
            if not mk:
                continue
            rec = known[ticker]
            rec.update({
                "status": mk.get("status"), "result": mk.get("result") or None,
                "close_time": mk.get("close_time"),
                "settlement_ts": mk.get("settlement_ts"),
                "settlement_value_dollars": mk.get("settlement_value_dollars"),
                "expiration_value": mk.get("expiration_value"),
                "last_price_dollars": mk.get("last_price_dollars"),
                "last_seen": utc_now(), "source_url": client.calls[-1]["url"] if client.calls else rec.get("source_url"),
            })
            if mk.get("result") in ("yes", "no"):
                rec["state"] = "resolved"
                rec["resolved_at"] = mk.get("settlement_ts") or utc_now()
            elif mk.get("status") in ("closed", "determined", "finalized"):
                rec["state"] = "awaiting_result"

    records = sorted(known.values(), key=lambda r: (r.get("state") != "resolved",
                                                    r.get("resolved_at") or "", r["ticker"]))
    out = {
        "generated_at": utc_now(),
        "source": "https://docs.kalshi.com/api-reference/market/get-market",
        "records": records,
        "counts": {
            "total": len(records),
            "resolved": sum(1 for r in records if r.get("state") == "resolved"),
            "resolved_yes": sum(1 for r in records if r.get("result") == "yes"),
            "resolved_no": sum(1 for r in records if r.get("result") == "no"),
            "open": sum(1 for r in records if r.get("state") == "open"),
            "awaiting_result": sum(1 for r in records if r.get("state") == "awaiting_result"),
        },
    }
    return out
