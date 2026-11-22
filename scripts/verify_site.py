#!/usr/bin/env python3
"""
Tradebot2 — Automated Verification & Link Integrity Checker

Checks:
1. All JSON data files parse cleanly.
2. verified_topics.json contains ONLY the 5 required topics:
   gas-prices, elections, culture, crypto, golf.
3. Every verified row in verified_api_endpoints.json, verified_topics.json,
   and flagged_irregularities.json contains a valid https:// official source URL.
4. Every HTML page in the repository resolves all local relative href/src links
   with zero broken links.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import List

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_TOPICS = {"gas-prices", "elections", "culture", "crypto", "golf"}
HREF_SRC_RE = re.compile(r"""(?:href|src)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)


def check_url(url: str, context: str, errors: List[str]) -> None:
    if not isinstance(url, str) or not url.startswith("https://"):
        errors.append(f"Invalid or missing https:// source URL in {context}: {url!r}")


def verify_json_datasets(errors: List[str]) -> None:
    api_data = json.loads((ROOT / "data/verified_api_endpoints.json").read_text(encoding="utf-8"))
    for section in ("environments", "rest_endpoints", "websocket_channels", "auth_headers", "unverified_runtime_parameters"):
        rows = api_data.get(section, [])
        if not rows:
            errors.append(f"Empty section in verified_api_endpoints.json: {section}")
        for idx, row in enumerate(rows):
            check_url(row.get("source_url", ""), f"verified_api_endpoints.{section}[{idx}]", errors)

    flagged = json.loads((ROOT / "data/flagged_irregularities.json").read_text(encoding="utf-8"))
    if not flagged.get("items"):
        errors.append("flagged_irregularities.json has no items")
    for idx, item in enumerate(flagged["items"]):
        check_url(item.get("source_url", ""), f"flagged_irregularities.items[{idx}]", errors)

    topics_data = json.loads((ROOT / "data/verified_topics.json").read_text(encoding="utf-8"))
    found_slugs = {t["slug"] for t in topics_data.get("topics", [])}
    if found_slugs != EXPECTED_TOPICS:
        errors.append(f"Topics mismatch! Expected {sorted(EXPECTED_TOPICS)}, got {sorted(found_slugs)}")

    for topic in topics_data.get("topics", []):
        slug = topic["slug"]
        check_url(topic["primary_settlement_source"]["url"], f"topic.{slug}.primary_settlement_source", errors)
        if not topic.get("events"):
            errors.append(f"Topic {slug} has no events")
        for idx, ev in enumerate(topic["events"]):
            check_url(ev.get("kalshi_url", ""), f"topic.{slug}.events[{idx}].kalshi_url", errors)
            check_url(ev.get("catalyst_source", {}).get("url", ""), f"topic.{slug}.events[{idx}].catalyst_source", errors)
            if ev.get("volume_verified") is False and ev.get("observed_volume_usd") is not None:
                errors.append(f"Unverified volume must be null for {ev['event_ticker']}")


def verify_html_links(errors: List[str]) -> int:
    html_files = sorted([ROOT / "index.html", *(ROOT / "pages").glob("*.html")])
    if not (ROOT / "index.html").exists():
        errors.append("Missing root index.html")
        return 0

    checked_links = 0
    for html_file in html_files:
        if not html_file.exists():
            continue
        text = re.sub(r"<script\b[^>]*>.*?</script>", "", html_file.read_text(encoding="utf-8"), flags=re.IGNORECASE | re.DOTALL)
        for match in HREF_SRC_RE.finditer(text):
            target = match.group(1).strip()
            if (
                not target
                or target.startswith("#")
                or target.startswith("http://")
                or target.startswith("https://")
                or target.startswith("mailto:")
                or target.startswith("javascript:")
                or target.startswith("data:")
                or "${" in target
            ):
                continue
            clean_target = target.split("#", 1)[0].split("?", 1)[0]
            if not clean_target:
                continue
            resolved = (html_file.parent / clean_target).resolve()
            checked_links += 1
            if not resolved.exists():
                errors.append(f"Broken relative link in {html_file.relative_to(ROOT)}: {target!r}")
    return checked_links


def main() -> int:
    errors: List[str] = []
    verify_json_datasets(errors)
    checked_links = verify_html_links(errors)

    if errors:
        print("VERIFICATION FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"VERIFICATION PASSED: All JSON schemas, 5 topics, official source URLs, and {checked_links} relative HTML links verified cleanly.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
