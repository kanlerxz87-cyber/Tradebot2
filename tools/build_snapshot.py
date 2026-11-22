#!/usr/bin/env python3
"""Collect the Kalshi demo snapshot, backtest, and CORS/WS probes into data/.

Run from the repository root:

    python tools/build_snapshot.py

Requires outbound network access to the Kalshi demo API. Exits non-zero when no
markets could be collected, so a CI job does not publish an empty site.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.backtest import run_backtest  # noqa: E402
from app.collector import collect  # noqa: E402
from tools.probe import run_probes  # noqa: E402


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, separators=(",", ":"), ensure_ascii=False)
        handle.write("\n")
    tmp.replace(path)
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KiB)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", default="demo")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "data"))
    parser.add_argument("--per-topic", type=int, default=8)
    parser.add_argument("--candle-hours", type=int, default=8)
    parser.add_argument("--origin", default=os.getenv("SITE_ORIGIN", "https://kanlerxz87-cyber.github.io"))
    parser.add_argument("--skip-probe", action="store_true")
    args = parser.parse_args()

    out = Path(args.out)
    snapshot = collect(
        environment=args.environment,
        per_topic=args.per_topic,
        candle_hours=args.candle_hours,
    )
    print("stats:", json.dumps(snapshot["stats"]))
    if snapshot["meta"]["errors"]:
        print(f"collector errors: {snapshot['meta']['error_count']}")
        for error in snapshot["meta"]["errors"][:10]:
            print("  -", error)

    if snapshot["stats"]["open_markets_in_scope"] == 0:
        print("FATAL: no in-scope markets collected; refusing to publish empty data")
        return 2

    write_json(out / "snapshot.json", snapshot)

    backtest = run_backtest(snapshot["markets"], threshold=snapshot["threshold"])
    write_json(out / "backtest.json", backtest)

    if not args.skip_probe:
        probe = run_probes(args.origin)
        write_json(out / "probe.json", probe)
        print("cors_public_read_allowed:", probe["cors_public_read_allowed"])
        for result in probe["ws"]["results"]:
            print("ws:", result.get("url"), "upgraded=", result.get("upgraded"), result.get("error", ""))

    print("done at", snapshot["generated_at"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
