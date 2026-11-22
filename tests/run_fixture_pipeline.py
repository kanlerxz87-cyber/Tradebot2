#!/usr/bin/env python3
"""Run the full collector + analysis pipeline against recorded fixtures.

This is the offline equivalent of one production cycle: it proves the code paths
that write markets.json / alerts.json / resolutions.json / paper_trades.json /
analytics.json all work without touching the network.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLLECTOR = os.path.join(ROOT, "collector")


def main() -> int:
    tmp = tempfile.mkdtemp(prefix="tradebot2-fixture-")
    try:
        env = {**os.environ}
        env.pop("KALSHI_DEMO_API_KEY_ID", None)
        env.pop("KALSHI_DEMO_PRIVATE_KEY", None)
        subprocess.run([sys.executable, "collect.py", "--fixtures",
                        os.path.join(ROOT, "tests", "fixtures"), "--data-dir", tmp,
                        "--now", "2026-11-22T07:30:00Z"], cwd=COLLECTOR, check=True, env=env)
        # Give one market a multi-point walk so the alert engine has something to find.
        hist = os.path.join(tmp, "history", "KXAAAGASD-26NOV23-3.00.json")
        doc = json.load(open(hist, encoding="utf-8"))
        doc["points"] = [{"ts": 1795000000 + i * 300, "t": f"t{i}", "mid": p, "last": p,
                          "bid": round(p - 0.01, 2), "ask": round(p + 0.01, 2)}
                         for i, p in enumerate([0.42, 0.40, 0.36, 0.31, 0.28, 0.26])]
        json.dump(doc, open(hist, "w", encoding="utf-8"), indent=2)
        subprocess.run([sys.executable, "run.py", "--data-dir", tmp, "--no-collect"],
                       cwd=COLLECTOR, check=True, env=env)

        alerts = json.load(open(os.path.join(tmp, "alerts.json"), encoding="utf-8"))
        # Default detection window is 6 points; the walk above is a $0.16 drop
        # measured from the first point, so exactly one alert is expected here.
        assert alerts["counts"]["all"] >= 1, alerts["counts"]
        assert alerts["threshold_dollars"] == 0.10
        assert alerts["all_feed"][0]["direction"] == "down"
        trades = json.load(open(os.path.join(tmp, "paper_trades.json"), encoding="utf-8"))["trades"]
        assert trades, "no simulated trades were opened"
        analytics = json.load(open(os.path.join(tmp, "analytics.json"), encoding="utf-8"))
        assert len(analytics["by_strategy"]) == 5
        res = json.load(open(os.path.join(tmp, "resolutions.json"), encoding="utf-8"))
        assert res["counts"]["total"] >= 1
        print(f"fixture pipeline OK: {alerts['counts']['all']} alerts, {len(trades)} trades, "
              f"{res['counts']['total']} tracked markets")
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
