#!/usr/bin/env python3
"""One full cycle: collect -> alerts -> resolutions -> paper trading -> analytics.

Designed to be run from GitHub Actions on a schedule (the only environment in
this project with network access to Kalshi).  Each stage is independent: a
failure is recorded in data/run_log.json and the remaining stages still run, so
a single flaky endpoint cannot leave the site with no fresh data.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import alerts as alerts_mod  # noqa: E402
import resolutions as res_mod  # noqa: E402
import collect as collect_mod  # noqa: E402
import trading as trading_mod  # noqa: E402
from kalshi import KalshiError, demo_client, read_json, write_json  # noqa: E402


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=os.path.join(ROOT, "data"))
    ap.add_argument("--max-orderbooks", type=int, default=collect_mod.MAX_ORDERBOOKS)
    ap.add_argument("--no-collect", action="store_true", help="reuse existing snapshots (tests)")
    ap.add_argument("--no-trade", action="store_true")
    args = ap.parse_args()
    data = os.path.abspath(args.data_dir)
    os.makedirs(data, exist_ok=True)

    run: dict[str, Any] = {"started_at": utc_now(), "stages": [], "warnings": []}

    def stage(name: str, fn) -> Any:
        t0 = time.time()
        try:
            out = fn()
            run["stages"].append({"stage": name, "ok": True, "seconds": round(time.time() - t0, 2)})
            return out
        except KalshiError as exc:
            run["stages"].append({"stage": name, "ok": False, "error": str(exc)[:500]})
            run["warnings"].append(f"{name}: {exc}")
            return None
        except Exception as exc:  # noqa: BLE001
            run["stages"].append({"stage": name, "ok": False, "error": f"{type(exc).__name__}: {exc}"})
            run["warnings"].append(f"{name}: {type(exc).__name__}: {exc}")
            run["traceback"] = traceback.format_exc()[-4000:]
            return None

    collect_mod.set_data_dir(data)
    if args.no_collect:
        run["stages"].append({"stage": "collect", "ok": True, "seconds": 0, "skipped": True})
    else:
        stage("collect", lambda: _run_collect(args, data))

    markets = (read_json(os.path.join(data, "markets.json"), {}) or {}).get("markets", [])

    def do_alerts():
        doc = alerts_mod.build(data, markets)
        write_json(os.path.join(data, "alerts.json"), doc)
        return doc

    def do_resolutions():
        doc = res_mod.build(data, markets)
        write_json(os.path.join(data, "resolutions.json"), doc)
        return doc

    def do_trading():
        doc = trading_mod.run(data, markets)
        write_json(os.path.join(data, "paper_trades.json"), {"generated_at": utc_now(),
                                                             "trades": doc["trades"]})
        write_json(os.path.join(data, "analytics.json"), doc["analytics"])
        write_json(os.path.join(data, "strategies.json"), {"strategies": trading_mod.STRATEGIES})
        return doc

    stage("alerts", do_alerts)
    stage("resolutions", do_resolutions)
    if not args.no_trade:
        stage("paper_trading", do_trading)
        stage("portfolio_sync", lambda: trading_mod.sync_demo_portfolio(data))

    run["finished_at"] = utc_now()
    run["ok"] = all(s.get("ok") for s in run["stages"])
    write_json(os.path.join(data, "run_log.json"), run)
    ok = run["ok"]
    print(f"run: {'OK' if ok else 'PARTIAL'} :: " +
          ", ".join(f"{s['stage']}={'ok' if s.get('ok') else 'FAIL'}" for s in run["stages"]))
    for w in run["warnings"]:
        print("  warning:", w[:300])
    return 0 if ok else 0  # exit 0: a partial run still publishes data; failure is recorded


def _run_collect(args, data: str) -> bool:
    argv = sys.argv
    try:
        sys.argv = ["collect", "--data-dir", data, "--max-orderbooks", str(args.max_orderbooks)]
        collect_mod.main()
    finally:
        sys.argv = argv
    return True


if __name__ == "__main__":
    raise SystemExit(main())
