#!/usr/bin/env python3
"""Static-site checks: every internal link resolves, every page exists, and the
required content markers are present.

Run in CI before publishing. Exits 1 on any broken internal link or missing page.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlparse

PAGES = [
    "index.html", "performance.html", "resolutions.html", "requirements.html",
    "sources.html", "flagged.html",
    "topics/gas.html", "topics/elections.html", "topics/culture.html",
    "topics/crypto.html", "topics/golf.html",
]
REQUIRED_SNIPPETS = {
    "index.html": ["chatAll", "chatRoi", "chartRanges", "chartCanvas", "topicTables", "kpis"],
    "performance.html": ["strategyRows", "topicRows", "sideRows", "openRows", "settledRows"],
    "resolutions.html": ["stateFilter", "rows"],
    "requirements.html": ["statusFilter", "rows"],
    "sources.html": ["rows"],
    "flagged.html": ["rows"],
}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.ids: set[str] = set()
        self.scripts: list[str] = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if "id" in d:
            self.ids.add(d["id"])
        if tag in ("a", "link"):
            href = d.get("href")
            if href:
                self.links.append(href)
        if tag == "script" and d.get("src"):
            self.scripts.append(d["src"])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    errors: list[str] = []
    checked = 0

    for page in PAGES:
        path = os.path.join(root, page)
        if not os.path.exists(path):
            errors.append(f"missing page: {page}")
            continue
        html = open(path, encoding="utf-8").read()
        parser = LinkParser()
        parser.feed(html)
        base = os.path.dirname(page)

        for snippet in REQUIRED_SNIPPETS.get(page, []):
            if snippet not in html:
                errors.append(f"{page}: required element id '{snippet}' is missing")

        for href in parser.links + parser.scripts:
            if href.startswith(("http://", "https://", "mailto:", "data:", "#", "//")):
                continue
            target = href.split("#")[0].split("?")[0]
            if not target:
                continue
            resolved = os.path.normpath(os.path.join(root, base, target))
            checked += 1
            if not os.path.exists(resolved):
                errors.append(f"{page}: broken link -> {href}")
            elif "#" in href and href.split("#")[1]:
                anchor = href.split("#")[1]
                frag_path = resolved
                if frag_path.endswith(".html"):
                    frag_html = open(frag_path, encoding="utf-8").read()
                    if f'id="{anchor}"' not in frag_html:
                        errors.append(f"{page}: anchor not found -> {href}")

        for snippet, label in [("flagged.html", "Flagged"), ("sources.html", "Sources")]:
            if f'href="{snippet}"' not in html and f'href="../{snippet}"' not in html:
                errors.append(f"{page}: navigation is missing the {label} link")

    for data_file in ("markets", "alerts", "resolutions", "analytics", "meta", "flags", "sources", "requirements"):
        if not os.path.exists(os.path.join(root, "data", f"{data_file}.json")):
            (errors if args.strict else []).append(f"missing data file: data/{data_file}.json")

    print(f"check_site: {len(PAGES)} pages, {checked} internal links checked")
    if errors:
        print(f"FAIL: {len(errors)} problem(s)")
        for e in errors[:60]:
            print("  -", e)
        return 1
    print("OK: no broken internal links, all required pages and anchors present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
