#!/usr/bin/env python3
"""Place a single order on the Kalshi DEMO account through the documented V2 endpoint.

Endpoint and payload shape: https://docs.kalshi.com/api-reference/orders/create-order-v2
  POST /portfolio/events/orders
  required: ticker, side (bid|ask), count, price, time_in_force, self_trade_prevention_type
  side is the YES leg only: bid = buy YES, ask = sell YES.

Safety rails, because this writes real state to a (demo) account:
  * refuses to run without KALSHI_DEMO_API_KEY_ID / KALSHI_DEMO_PRIVATE_KEY
  * refuses to run without --confirm
  * caps count and price via --max-contracts / --max-cost
  * prints the exact signed request it is about to make and the response verbatim

Usage
  python tools/execute_demo_order.py --ticker KXAAAGASD-26NOV30-5.00 --side bid \
      --count 1 --price 0.05 --confirm
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "collector"))

from kalshi_auth import DEMO_BASE, signed_request  # noqa: E402

ENDPOINT_DOC = "https://docs.kalshi.com/api-reference/orders/create-order-v2"


def decimals_for(ticker: str) -> int:
    """Prices on Kalshi markets sit on a documented per-market grid
    (price_ranges / price_level_structure, fixed_point_migration docs). Without
    re-reading the market we keep 4 decimals, which the API accepts."""
    return 4


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ticker", required=True)
    ap.add_argument("--side", choices=["bid", "ask"], required=True,
                    help="bid = buy YES, ask = sell YES (per BookSide docs)")
    ap.add_argument("--count", type=float, default=1.0)
    ap.add_argument("--price", type=float, required=True)
    ap.add_argument("--time-in-force", default="good_till_canceled",
                    choices=["fill_or_kill", "good_till_canceled", "immediate_or_cancel"])
    ap.add_argument("--self-trade-prevention", default="taker_at_cross",
                    choices=["taker_at_cross", "maker"])
    ap.add_argument("--max-contracts", type=float, default=25.0)
    ap.add_argument("--max-cost", type=float, default=25.0)
    ap.add_argument("--confirm", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.count <= 0 or args.count > args.max_contracts:
        print(f"refusing: count {args.count} outside 0..{args.max_contracts}")
        return 2
    if not (0.0 < args.price < 1.0):
        print("refusing: price must be strictly between $0.00 and $1.00")
        return 2
    if args.count * args.price > args.max_cost:
        print(f"refusing: notional ${args.count * args.price:.2f} exceeds --max-cost ${args.max_cost:.2f}")
        return 2

    body = {
        "ticker": args.ticker,
        "side": args.side,
        "count": f"{args.count:.2f}",
        "price": f"{args.price:.{decimals_for(args.ticker)}f}",
        "time_in_force": args.time_in_force,
        "self_trade_prevention_type": args.self_trade_prevention,
    }
    print("POST", DEMO_BASE + "/portfolio/events/orders")
    print("body:", json.dumps(body, indent=2))
    print("docs:", ENDPOINT_DOC)

    key_id = os.environ.get("KALSHI_DEMO_API_KEY_ID", "").strip()
    pem = os.environ.get("KALSHI_DEMO_PRIVATE_KEY", "").strip()
    if args.dry_run:
        print("dry run: not sending")
        return 0
    if not args.confirm:
        print("refusing: pass --confirm to actually send this order (or --dry-run to print only)")
        return 2
    if not key_id or not pem:
        print("refusing: KALSHI_DEMO_API_KEY_ID and KALSHI_DEMO_PRIVATE_KEY must be set "
              "(repository secrets when run from Actions)")
        return 2

    resp = signed_request(key_id, pem, "POST", "/portfolio/events/orders", body=body)
    print("response:", json.dumps(resp, indent=2))
    # A 201 means accepted, not necessarily resting: check remaining_count
    # (stated in the endpoint's own description).
    if resp.get("remaining_count") in ("0", "0.00"):
        print("note: remaining_count is 0 — the order was fully filled or fully cancelled on arrival")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
