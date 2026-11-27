#!/usr/bin/env python3
"""Line-by-line checks that must pass before the site is published.

Fails (exit 1) on:
  * a broken local link or missing asset in any published HTML page
  * a market/resolution row without an official source link
  * an out-of-range price, unknown topic, or invalid settlement result
  * missing data files or unparseable JSON
  * placeholder text that would imply invented values

Warnings (exit 0) are printed for facts that are legitimately not yet available
(for example a missing CORS probe on a local-only run).
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

REQUIRED_PAGES = [
    "index.html",
    "dashboard.html",
    "portfolio.html",
    "executive-summary.html",
    "methodology.html",
    "sources.html",
    "suggestions.html",
    "flagged.html",
    "gas-prices.html",
    "elections.html",
    "culture.html",
    "crypto.html",
    "golf.html",
]

TOPICS = {"gas_prices", "elections", "culture", "crypto", "golf"}
OFFICIAL_HOSTS = {
    "demo-api.kalshi.co",
    "external-api.demo.kalshi.co",
    "api.elections.kalshi.com",
    "external-api.kalshi.com",
    "docs.kalshi.com",
    "kalshi.com",
    "assets.kalshi.com",
}

LINK_RE = re.compile(r'(?:href|src)\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
PLACEHOLDER_RE = re.compile(r"\b(TODO|TBD|lorem ipsum|PLACEHOLDER|FIXME)\b", re.IGNORECASE)

errors: list[str] = []
warnings: list[str] = []


def check_page_links() -> int:
    checked = 0
    for page in REQUIRED_PAGES:
        path = ROOT / page
        if not path.exists():
            errors.append(f"missing page: {page}")
            continue
        text = path.read_text(encoding="utf-8")
        match = PLACEHOLDER_RE.search(text)
        if match:
            errors.append(f"{page}: placeholder text '{match.group(0)}'")
        for raw in LINK_RE.findall(text):
            url = raw.strip()
            if not url or url.startswith(("#", "mailto:", "data:", "javascript:")):
                continue
            parsed = urlparse(url)
            if parsed.scheme in {"http", "https"}:
                host = parsed.netloc.lower()
                if host and host not in OFFICIAL_HOSTS and "github.io" not in host and "google.com" not in host and "kalshi" not in host and "eia.gov" not in host and "aaa.com" not in host and "pga" not in host and "cfbenchmarks" not in host:
                    warnings.append(f"{page}: non-official external link {url}")
                continue
            target = (path.parent / parsed.path).resolve()
            if parsed.path and not target.exists():
                errors.append(f"{page}: broken local link {url}")
            checked += 1
    return checked


def load_json(name: str) -> dict:
    path = DATA / name
    if not path.exists():
        errors.append(f"missing data file: {path.relative_to(ROOT)}")
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{name}: invalid JSON: {exc}")
        return {}


def check_snapshot(snapshot: dict) -> None:
    if not snapshot:
        return
    for field in ("generated_at", "api_base", "topics", "markets", "resolutions", "meta"):
        if field not in snapshot:
            errors.append(f"snapshot missing field: {field}")
    if snapshot.get("api_base") not in {
        "https://external-api.demo.kalshi.co/trade-api/v2",
        "https://demo-api.kalshi.co/trade-api/v2",
    }:
        errors.append(f"snapshot api_base is not an official demo host: {snapshot.get('api_base')}")

    try:
        generated = datetime.fromisoformat(str(snapshot.get("generated_at")).replace("Z", "+00:00"))
        age_hours = (datetime.now(tz=timezone.utc) - generated).total_seconds() / 3600
        if age_hours > 24:
            warnings.append(f"snapshot is {age_hours:.1f}h old")
    except (TypeError, ValueError):
        errors.append("snapshot generated_at is not ISO-8601")

    seen_topics = set()
    for market in snapshot.get("markets", []):
        ticker = market.get("ticker")
        topic = market.get("topic")
        if topic not in TOPICS:
            errors.append(f"{ticker}: unknown topic {topic!r}")
        seen_topics.add(topic)
        links = market.get("links") or {}
        api = str(links.get("market_api") or "")
        if not api.startswith("https://"):
            errors.append(f"{ticker}: missing official API source link")
        elif urlparse(api).netloc not in OFFICIAL_HOSTS:
            errors.append(f"{ticker}: source link is not an official Kalshi host: {api}")
        prices = market.get("prices") or {}
        for key in ("yes_bid", "yes_ask", "last", "mid"):
            value = prices.get(key)
            if value is not None and not (0.0 <= float(value) <= 1.0):
                errors.append(f"{ticker}: {key} out of range: {value}")
        result = market.get("result")
        if result not in (None, "yes", "no"):
            errors.append(f"{ticker}: invalid result {result!r}")
        if not market.get("title"):
            errors.append(f"{ticker}: empty title")
        for row in (market.get("candles") or {}).get("1m", []):
            if not isinstance(row, list) or len(row) != 6:
                errors.append(f"{ticker}: malformed candle row {row!r}")
                break
            if row[1] is not None and not (0.0 <= float(row[1]) <= 1.0):
                errors.append(f"{ticker}: candle close out of range {row[1]}")
                break

    if seen_topics and seen_topics != TOPICS:
        warnings.append(f"topics without tracked markets: {sorted(TOPICS - seen_topics)}")

    for row in snapshot.get("resolutions", []):
        if row.get("result") not in {"yes", "no"}:
            errors.append(f"resolution {row.get('ticker')}: invalid result {row.get('result')!r}")
        api = str((row.get("links") or {}).get("market_api") or "")
        if urlparse(api).netloc not in OFFICIAL_HOSTS:
            errors.append(f"resolution {row.get('ticker')}: missing official source link")

    for alert in snapshot.get("alerts_seed", []):
        if abs(float(alert.get("delta") or 0)) < 0.10 - 1e-9:
            errors.append(f"seed alert {alert.get('ticker')}: delta below threshold")


def check_backtest(backtest: dict) -> None:
    if not backtest:
        return
    portfolio = backtest.get("portfolio") or {}
    if "analytics" not in portfolio:
        errors.append("backtest missing analytics")
    for account in portfolio.get("accounts", []):
        for trade in account.get("open_positions", []):
            for field in ("ticker", "side", "entry_price", "pnl"):
                if field not in trade:
                    errors.append(f"backtest trade missing {field}")


def main() -> int:
    links = check_page_links()
    snapshot = load_json("snapshot.json")
    check_snapshot(snapshot)
    check_backtest(load_json("backtest.json"))
    probe_path = DATA / "probe.json"
    if probe_path.exists():
        probe = load_json("probe.json")
        if not probe.get("cors_public_read_allowed"):
            warnings.append("CORS probe did not confirm public browser reads; site must show fallback")
    else:
        warnings.append("no probe.json; CORS/WS status will show as not measured")

    markets = len(snapshot.get("markets", []))
    resolutions = len(snapshot.get("resolutions", []))
    print(f"pages: {len(REQUIRED_PAGES)}, local links checked: {links}")
    print(f"markets: {markets}, resolutions: {resolutions}")
    for warning in warnings:
        print(f"WARN  {warning}")
    for error in errors[:50]:
        print(f"ERROR {error}")
    if len(errors) > 50:
        print(f"... {len(errors) - 50} more errors")
    if errors:
        print(f"FAILED with {len(errors)} error(s)")
        return 1
    print("OK: data and links verified against the published schema")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
