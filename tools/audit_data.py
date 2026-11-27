#!/usr/bin/env python3
"""Audit the published data for *integrity*, not just for schema shape.

Why this exists
---------------
`tools/verify_data.py`, `tools/verify_site.py` and `tools/check_site.py` answer the
question "does every published row carry an official source URL?". They all pass on
a dataset where every list is empty, and that is exactly what happened on this
repository: `data/markets.json`, `events.json`, `orderbooks.json`, `alerts.json`,
`resolutions.json`, `paper_trades.json` and `series.json` were committed with 0 rows
while `data/meta.json` recorded a run in which every API call raised a TLS error. A
source check cannot see a row that does not exist.

So this audit re-derives what the site publishes and fails on disagreement:

  1. the snapshot the pages render must not be empty;
  2. `topics[].resolved_markets_30d` must sum to `stats.settled_markets_in_scope`
     (they are the two published statements of the same quantity);
  3. `stats.*` totals must equal the length of the arrays they describe;
  4. every resolution is `result: yes|no` and carries an official source link;
  5. every market is unique, tagged with a topic and linked to an official endpoint;
  6. every seeded swing clears the advertised $0.10 threshold;
  7. `meta.error_count` equals `len(meta.errors)`;
  8. a legacy data file that holds 0 rows must say why, in its own `note`;
  9. `snapshot.json` stays inside the size its own collector promises
     (< 1.5 MB, `app/collector.py` trim_resolutions), because the browser loads it
     on every page view and GitHub Pages serves the committed file.

Run: python3 tools/audit_data.py --data-dir data   (exit 1 on any finding)
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
from typing import Any
from urllib.parse import urlparse

OFFICIAL_HOSTS = {
    "kalshi.co", "demo-api.kalshi.co", "external-api.demo.kalshi.co",
    "external-api-ws.demo.kalshi.co", "api.elections.kalshi.com",
    "external-api.kalshi.com", "external-api-ws.kalshi.com",
    "docs.kalshi.com", "kalshi.com", "help.kalshi.com", "demo.kalshi.co",
}

findings: list[str] = []
notes: list[str] = []


def fail(msg: str) -> None:
    findings.append(msg)


def load(data_dir: str, name: str) -> Any:
    path = os.path.join(data_dir, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def official(url: str | None) -> bool:
    if not url or not isinstance(url, str):
        return False
    p = urlparse(url)
    return p.scheme in ("http", "https") and (p.hostname or "").lower() in OFFICIAL_HOSTS


SNAPSHOT_MAX_BYTES = 1_600_000  # 1.5 MB promise + headroom for new markets


def audit_snapshot_size(data_dir: str) -> None:
    path = os.path.join(data_dir, "snapshot.json")
    if not os.path.exists(path):
        return
    size = os.path.getsize(path)
    if size > SNAPSHOT_MAX_BYTES:
        fail(
            f"snapshot.json is {size / 1048576:.1f} MB, over the {SNAPSHOT_MAX_BYTES / 1048576:.1f} MB ceiling. "
            "app/collector.py trims resolutions to the newest 50 per topic to keep the browser load "
            "small; a file this size means a pipeline wrote resolutions without that trim."
        )
    else:
        notes.append(f"snapshot.json size: {size / 1024:.0f} KiB")


def audit_snapshot(snap: dict[str, Any]) -> None:
    markets = snap.get("markets") or []
    resolutions = snap.get("resolutions") or []
    seed = snap.get("alerts_seed") or []
    stats = snap.get("stats") or {}
    meta = snap.get("meta") or {}
    topics = snap.get("topics") or []

    if not markets:
        fail("snapshot.json: markets[] is empty; every topic table would render empty")
    if not seed:
        fail("snapshot.json: alerts_seed[] is empty; both scrolling chats would start blank")

    # (7) error bookkeeping
    if "error_count" in meta and meta.get("error_count") != len(meta.get("errors") or []):
        fail(
            f"snapshot.json: meta.error_count ({meta.get('error_count')}) != "
            f"len(meta.errors) ({len(meta.get('errors') or [])})"
        )

    # (3) array totals
    for key, actual in (("tracked_markets", len(markets)), ("seed_alerts", len(seed))):
        if key in stats and stats[key] != actual:
            fail(f"snapshot.json: stats.{key}={stats[key]} but the array holds {actual}")
    if stats.get("resolutions") is not None and stats["resolutions"] < len(resolutions):
        fail(
            f"snapshot.json: stats.resolutions={stats['resolutions']} is smaller than the "
            f"{len(resolutions)} records actually stored"
        )

    # (2) the two published statements of the settled count must agree
    per_topic_sum = sum(int(t.get("resolved_markets_30d") or 0) for t in topics)
    settled = stats.get("settled_markets_in_scope")
    if settled is not None and per_topic_sum != settled:
        fail(
            "snapshot.json: topics[].resolved_markets_30d sum to "
            f"{per_topic_sum} but stats.settled_markets_in_scope is {settled}. "
            "These are the same quantity published twice; a display cap or a truncated "
            "list must never reach either of them."
        )
    if settled and not per_topic_sum:
        fail("snapshot.json: settled markets exist but no topic reports any resolved count")

    # (4) resolutions are real YES/NO outcomes with an official source
    for row in resolutions:
        if row.get("result") not in ("yes", "no"):
            fail(f"snapshot.json: resolution {row.get('ticker')} has result={row.get('result')!r}")
            break
        links = row.get("links") or {}
        if not (official(links.get("market_api")) or official(links.get("kalshi"))):
            fail(f"snapshot.json: resolution {row.get('ticker')} has no official source link")
            break

    # (5) markets are unique, classified and sourced
    seen: set[str] = set()
    for m in markets:
        ticker = m.get("ticker")
        if not ticker:
            fail("snapshot.json: a market row has no ticker")
            break
        if ticker in seen:
            fail(f"snapshot.json: duplicate market ticker {ticker}")
            break
        seen.add(ticker)
        if not official((m.get("links") or {}).get("market_api")):
            fail(f"snapshot.json: market {ticker} has no official market_api link")
            break
        if not m.get("topic"):
            fail(f"snapshot.json: market {ticker} has no topic")
            break

    # (6) the advertised alert threshold is the one that was applied
    threshold = float(snap.get("threshold") or 0.1)
    below = [a for a in seed if abs(float(a.get("delta") or 0.0)) + 1e-9 < threshold]
    if below:
        fail(
            f"snapshot.json: {len(below)} seeded alert(s) fall below the advertised "
            f"threshold {threshold}, e.g. {below[0].get('ticker')} "
            f"delta={below[0].get('delta')}"
        )

    notes.append(
        f"snapshot: {len(markets)} markets / {len(resolutions)} resolution records / "
        f"{len(seed)} seeded swings across {len(topics)} topics; "
        f"{per_topic_sum} settled markets counted over 30 days"
    )


def audit_legacy(data_dir: str) -> None:
    """A file that carries a generated_at timestamp and 0 rows is indistinguishable
    from a successful empty result unless it says why it is empty."""
    for path in sorted(glob.glob(os.path.join(data_dir, "*.json"))):
        name = os.path.basename(path)
        if name == "snapshot.json":
            continue
        try:
            doc = load(data_dir, name)
        except json.JSONDecodeError:
            fail(f"{name}: not valid JSON")
            continue
        if not isinstance(doc, dict):
            continue
        rows = None
        for key in ("markets", "events", "orderbooks", "records", "trades", "series"):
            value = doc.get(key)
            if isinstance(value, list):
                rows = value
                break
            if isinstance(value, dict) and not value:
                rows = []
                break
        if rows != []:
            continue
        if doc.get("status") == "failed_run" and doc.get("note"):
            notes.append(f"{name}: empty and marked failed_run (superseded)")
            continue
        if not doc.get("note") and not doc.get("warning"):
            fail(
                f"{name}: 0 rows and no note explaining why. An empty file with a "
                "timestamp reads as a successful empty result."
            )


def audit_pages(root: str, data_dir: str) -> None:
    """Cross-check the pages that print a settled count against the snapshot.

    The topic pages are generated from `tools/build_category_pages.py`, so a stale
    page can disagree with freshly collected data. Any literal 'Resolved 30d' value
    baked into a page must match the snapshot it will be served with.
    """
    snap = load(data_dir, "snapshot.json") or {}
    counts = {t.get("key"): t.get("resolved_markets_30d") for t in snap.get("topics") or []}
    if not counts:
        return
    for path in sorted(glob.glob(os.path.join(root, "*.html"))):
        try:
            text = open(path, encoding="utf-8").read()
        except OSError:
            continue
        # The topic pages mount the count from data at runtime; only a hard-coded
        # number is a risk, so look for one directly after the label.
        for match in re.finditer(r"Resolved 30d[^0-9]{0,80}>(\d{2,})<", text):
            fail(
                f"{os.path.basename(path)}: hard-coded 'Resolved 30d' value "
                f"{match.group(1)} will not follow the data; mount it instead"
            )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()

    snap = load(args.data_dir, "snapshot.json")
    if snap is None:
        fail("snapshot.json is missing; the published pages render from it")
    else:
        audit_snapshot(snap)
    audit_snapshot_size(args.data_dir)
    audit_legacy(args.data_dir)
    audit_pages(args.root, args.data_dir)

    for n in notes:
        print("note:", n)
    if findings:
        print(f"\nFAILED: {len(findings)} data-integrity finding(s)")
        for f in findings:
            print(" -", f)
        return 1
    print("\nOK: published data is internally consistent and non-empty")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
