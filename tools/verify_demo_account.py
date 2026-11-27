#!/usr/bin/env python3
"""Read-only demo-account evidence; never sends an order or logs credentials.

The Actions job supplies secrets in its environment. Their availability is a
property of that job, not something inferred from GitHub's secret-list API.
Reuse the existing collector's signed GET sync without changing its ownership.
Official contract: https://docs.kalshi.com/api-reference/portfolio/get-balance
Authentication: https://docs.kalshi.com/getting_started/quick_start_authenticated_requests
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://external-api.demo.kalshi.co/trade-api/v2"
PUBLIC_FIELDS = ("balance", "balance_dollars", "portfolio_value", "updated_ts",
                 "market_positions", "event_positions")


def verify(*, credentials_available=None, sync=None, now=None, run_url=None):
    now = now or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if credentials_available is None:
        credentials_available = bool(os.environ.get("KALSHI_DEMO_API_KEY_ID", "").strip()
                                     and os.environ.get("KALSHI_DEMO_PRIVATE_KEY", "").strip())
    doc = {"schema_version": 1, "environment": "demo", "generated_at": now,
           "configured": None, "verified_account_read": False, "read_only": True,
           "orders_submitted": 0, "credentials_available_to_job": credentials_available,
           "actions_run": run_url,
           "balance_source_url": BASE + "/portfolio/balance",
           "positions_source_url": BASE + "/portfolio/positions?settlement_status=all&limit=200",
           "docs": "https://docs.kalshi.com/getting_started/quick_start_authenticated_requests",
           **{field: None for field in PUBLIC_FIELDS}}
    if not credentials_available:
        doc.update(configured=False, status="no_credentials_available_to_this_job",
                   note="Demo credentials were not available to this Actions job. No signed request or account order was sent; account values remain unverified.")
        return doc
    try:
        if sync is None:
            sys.path.insert(0, str(ROOT))
            from collector.trading import sync_demo_portfolio
            sync = sync_demo_portfolio
        # No prior ledger is imported. Temporary files hold only returned demo
        # account data, never the keys; only the allowlisted fields are exported.
        with tempfile.TemporaryDirectory(prefix="tradebot-demo-read-") as directory:
            result = sync(directory)
        if result.get("configured") is not True or result.get("environment") != "demo":
            raise ValueError("signed demo capture was not confirmed")
        doc.update({field: result.get(field) for field in PUBLIC_FIELDS})
        doc.update(configured=True, verified_account_read=True, status="signed_demo_gets_succeeded",
                   note="Dated authenticated DEMO balance/positions read, not streaming. No order was submitted. Positions are the returned first page (limit 200); completeness and strategy attribution are not inferred.")
    except Exception as exc:
        # Never serialize exception messages, response bodies, request headers,
        # private keys or account identifiers into a public error/log.
        doc.update(status="authenticated_read_unverified", error_type=type(exc).__name__,
                   note="Credentials were available to this job, but the signed demo account read could not be verified. Account values remain blank; no account order was sent.")
    return doc


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "live/data/account-verification.json")
    args = parser.parse_args()
    run_id, repository = os.environ.get("GITHUB_RUN_ID"), os.environ.get("GITHUB_REPOSITORY")
    run_url = f"https://github.com/{repository}/actions/runs/{run_id}" if run_id and repository else None
    doc = verify(run_url=run_url)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    temp = args.out.with_suffix(".tmp")
    temp.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(args.out)
    print(f"Read-only DEMO verification: {doc['status']}; orders submitted: 0")


if __name__ == "__main__":
    main()
