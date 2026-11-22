#!/usr/bin/env python3
"""Site checks run before publishing (see .github/workflows/pages.yml).

1. Every internal href/src in site/*.html resolves to a file (no broken links).
2. Every page in the nav list (site/assets/app.js) exists.
3. Every row of a static table with class "sourced" links to an https source.
4. Every record in the generated site/data/*.json carries a source URL (if data exists).
Exit code 1 if any check fails.
"""
import glob
import json
import os
import re
import sys
from html.parser import HTMLParser

SITE = os.environ.get("SITE_DIR", "site")
failures, notes = [], []


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.tables = []        # list of dicts: {"sourced": bool, "rows": [[bool_has_https_link,...]]}
        self._stack = []
        self._in_tbody = False
        self._row = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append(a[key])
        if tag == "table":
            self.tables.append({"sourced": "sourced" in (a.get("class") or "").split(), "rows": []})
        elif tag == "tbody":
            self._in_tbody = True
        elif tag == "tr" and self._in_tbody and self.tables:
            self._row = {"link": False}
        elif tag == "a" and self._row is not None:
            href = a.get("href", "")
            if href.startswith("https://"):
                self._row["link"] = True

    def handle_endtag(self, tag):
        if tag == "tbody":
            self._in_tbody = False
        elif tag == "tr" and self._row is not None:
            self.tables[-1]["rows"].append(self._row["link"])
            self._row = None


def check_links(path, page):
    base = os.path.dirname(path)
    for ref in page.refs:
        if re.match(r"^(https?:|mailto:|data:|#)", ref):
            continue
        target = ref.split("#")[0].split("?")[0]
        if not target:
            continue
        full = os.path.normpath(os.path.join(base, target))
        if not os.path.exists(full):
            failures.append(f"{path}: broken internal link -> {ref}")


def links_only(root):
    """Check internal links across every HTML file under root (used on the assembled site)."""
    files = sorted(glob.glob(os.path.join(root, "**", "*.html"), recursive=True))
    for path in files:
        with open(path, encoding="utf-8") as f:
            p = Page()
            p.feed(f.read())
        check_links(path, p)
    print(f"links checked in {len(files)} HTML files under {root}")
    if failures:
        print(f"FAILED: {len(failures)} broken internal link(s)")
        for f_ in failures:
            print(" -", f_)
        return 1
    print("OK: no broken internal links in the assembled site.")
    return 0


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--links-only-root":
        return links_only(sys.argv[2])
    pages = sorted(glob.glob(os.path.join(SITE, "*.html")))
    if not pages:
        failures.append(f"no HTML pages found in {SITE}/")
    for path in pages:
        with open(path, encoding="utf-8") as f:
            text = f.read()
        p = Page()
        p.feed(text)
        check_links(path, p)
        if 'id="nav"' not in text or "assets/app.js" not in text:
            failures.append(f"{path}: missing nav container or app.js include")
        for ti, t in enumerate(p.tables):
            if not t["sourced"]:
                continue
            if not t["rows"]:
                notes.append(f"{path}: sourced table {ti} has no body rows")
            for ri, has in enumerate(t["rows"]):
                if not has:
                    failures.append(f"{path}: sourced table {ti} row {ri + 1} has no https source link")
        if re.search(r"\bTODO\b|lorem ipsum", text, re.I):
            failures.append(f"{path}: placeholder text found")

    # nav targets
    appjs = os.path.join(SITE, "assets", "app.js")
    if os.path.exists(appjs):
        js = open(appjs, encoding="utf-8").read()
        for target in re.findall(r'\["([a-z\-]+\.html)",\s*"', js):
            if not os.path.exists(os.path.join(SITE, target)):
                failures.append(f"nav target missing: {target}")
    else:
        failures.append("site/assets/app.js missing")

    # generated data: every record must carry a source URL
    data_dir = os.path.join(SITE, "data")
    checked = 0
    if os.path.isdir(data_dir):
        def need(name, key, rows):
            nonlocal checked
            for i, r in enumerate(rows):
                checked += 1
                src = r.get(key) if isinstance(r, dict) else None
                if not isinstance(src, str) or not src.startswith("http"):
                    failures.append(f"data/{name}: record {i} ({r.get('ticker', r.get('id', '?')) if isinstance(r, dict) else '?'}) has no source URL")
        for name, field in (("markets.json", "markets"), ("alerts.json", "alerts"), ("resolved.json", "resolved")):
            fp = os.path.join(data_dir, name)
            if os.path.exists(fp):
                rows = json.load(open(fp, encoding="utf-8")).get(field, [])
                need(name, "source_url", rows)
        fp = os.path.join(data_dir, "trades.json")
        if os.path.exists(fp):
            tr = json.load(open(fp, encoding="utf-8"))
            need("trades.json", "source_url", tr.get("open_trades", []) + tr.get("closed_trades", []))
        for name in ("markets.json", "alerts.json", "resolved.json", "trades.json", "meta.json", "history.json", "orderbooks.json"):
            if not os.path.exists(os.path.join(data_dir, name)):
                failures.append(f"data/{name} missing (collector did not run?)")
    else:
        notes.append("site/data not present: data checks skipped (run scripts/kalshi_collector.py first)")

    print(f"pages checked: {len(pages)}; data records checked: {checked}")
    for n in notes:
        print("NOTE:", n)
    if failures:
        print(f"FAILED: {len(failures)} problem(s)")
        for f_ in failures:
            print(" -", f_)
        return 1
    print("OK: no broken internal links; every sourced row links to an official source.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
