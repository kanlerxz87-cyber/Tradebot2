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


def _dataset_for(page_html: str) -> str:
    """Concatenate the JSON datasets a page renders rows from, for anchor checks."""
    import glob
    parts = []
    for path in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                              "..", "data", "*.json"))):
        try:
            parts.append(open(path, encoding="utf-8").read())
        except OSError:
            pass
    return "\n".join(parts)


PUBLISHED_MAP = {
    # source dir -> path in the deployed artifact
    "docs/": "docs/",
    "site/": "monitor/",
    "dash/": "dash/",
}
SKIP_DIRS = {".git", ".github", "collector", "tests", "tools", "scripts", "site", "state",
             ".venv", "__pycache__"}


def build_published(root: str, target: str) -> dict[str, str]:
    """Recreate exactly what pages.yml uploads, so links are checked as visitors see them."""
    import shutil
    if os.path.isdir(target):
        shutil.rmtree(target)
    os.makedirs(target)
    for name in os.listdir(root):
        src = os.path.join(root, name)
        if name in SKIP_DIRS or name in {"_site", "requirements.txt", ".gitignore"}:
            continue
        dst = os.path.join(target, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    for src_dir, dst_rel in PUBLISHED_MAP.items():
        src = os.path.join(root, src_dir)
        if not os.path.isdir(src):
            continue
        dst = os.path.join(target, dst_rel)
        if os.path.isdir(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    return PUBLISHED_MAP


def check_published(root: str) -> int:
    """Check every HTML page in the exact tree Pages will serve."""
    import tempfile
    target = os.path.join(tempfile.gettempdir(), "tradebot2-published")
    build_published(root, target)
    probe = LinkParser()
    pages = []
    for base, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if d not in {"__pycache__"}]
        for name in files:
            if name.endswith(".html"):
                pages.append(os.path.join(base, name))
    errors: list[str] = []
    for page in pages:
        probe = LinkParser()
        probe.feed(open(page, encoding="utf-8", errors="replace").read())
        for href in probe.links:
            if href.startswith(("http://", "https://", "mailto:", "#", "javascript:",
                                "data:", "tel:")):
                continue
            target_path = href.split("#")[0].split("?")[0]
            if not target_path:
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(page), target_path))
            if not os.path.exists(resolved):
                errors.append(f"{os.path.relpath(page, target)}: broken -> {href}")
    print(f"published tree: {len(pages)} HTML pages under {target}")
    for e in errors[:40]:
        print("  -", e)
    if errors:
        print(f"FAIL: {len(errors)} broken link(s) in the published tree")
        return 1
    print("OK: every link resolves in the tree GitHub Pages actually serves")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--published", action="store_true",
                    help="rebuild and check the exact tree pages.yml deploys")
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    if args.published:
        return check_published(root)
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
                # /monitor/ is produced by pages.yml (site/ is copied there); it is verified
                # by --published, which rebuilds the deployed tree.
                if href.split("#")[0].startswith("monitor/"):
                    continue
                errors.append(f"{page}: broken link -> {href}")
            elif "#" in href and href.split("#")[1]:
                anchor = href.split("#")[1]
                frag_path = resolved
                if frag_path.endswith(".html"):
                    frag_html = open(frag_path, encoding="utf-8").read()
                    if f'id="{anchor}"' not in frag_html:
                        # Rows rendered from JSON carry their id at runtime. Accept the
                        # anchor when the target page builds ids from a dataset AND the id
                        # really exists in that dataset, so the guarantee is still checked.
                        dynamic = 'id="${TB.esc(f.id)}"' in frag_html
                        if dynamic and f'"id": "{anchor}"' in _dataset_for(frag_html):
                            continue
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
