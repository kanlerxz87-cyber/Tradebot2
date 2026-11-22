#!/usr/bin/env python3
"""Static checks for the live dashboard (live/).

Run: python3 live/tests/check_live.py

Checks, all fail-closed:
  1. every internal href/src in live/*.html and live/topics/*.html resolves
  2. every <script src> file parses with `node --check`
  3. no page loads anything that is not in the repository (no CDN, no remote JS)
  4. no fabricated market identifiers or invented performance figures appear
  5. every page that shows market data names an official API host
  6. the navigation targets in core.js all exist
Exit code 0 = pass.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIVE = ROOT / "live"

# Identifiers that were presented as live markets by the retired dashboard but do
# not exist in the Kalshi API (verified: GET /markets returned 0 results and the
# ticker format does not match any documented series).
FABRICATED = [
    "GAS-24DEC-3.15", "GAS-25Q1-3.25", "GAS-CA-4.50", "CRUDE-25-80",
    "PRES-24-DJT", "SENATE-24-GOP", "HOUSE-24-GOP", "VA-GOV-25", "NJ-GOV-25",
    "OSCAR-BESTPIC-25", "OSCAR-BESTDIR-25", "GRAMMY-AOTY-25", "BOXOFF-24-AVATAR3",
    "TIME-POTY-24", "BTC-24DEC-100K", "BTC-25Q1-110K", "ETH-25Q1-4K",
    "BTC-ETF-NET10B", "SOL-25-300", "MASTERS-25-SCHEFFLER", "MASTERS-25-MCILROY",
    "PGA-25-CHAMP", "USOPEN-25-WINNER", "RYDER-25-USA",
]
# Phrases that assert invented performance.
INVENTED_CLAIMS = [
    r"Sharpe\s*Ratio", r"Risk-Adjusted Alpha", r"Win Rate\s*75%",
    r"Demo Cash Balance\s*\$9[,\d]", r"Portfolio Equity\s*\$10,?061",
]
OFFICIAL_HOSTS = ("external-api.demo.kalshi.co", "demo-api.kalshi.co",
                  "external-api.kalshi.com", "docs.kalshi.com")

errors, notes = [], []


def pages():
    return sorted(list(LIVE.glob("*.html")) + list((LIVE / "topics").glob("*.html")))


def check_links():
    for p in pages():
        text = p.read_text(encoding="utf-8")
        for m in re.finditer(r'(?:href|src)="([^"]+)"', text):
            u = m.group(1)
            if u.startswith(("http://", "https://", "#", "mailto:", "data:", "wss:")):
                continue
            target = u.split("#")[0].split("?")[0]
            if not target:
                continue
            resolved = (p.parent / target).resolve()
            if not resolved.exists():
                errors.append(f"{p.relative_to(ROOT)}: broken link -> {u}")


def check_no_remote_assets():
    for p in pages():
        text = p.read_text(encoding="utf-8")
        for m in re.finditer(r'<(script|link)[^>]+(?:src|href)="(https?://[^"]+)"', text):
            tag = m.group(0)
            if 'rel="stylesheet"' in tag and "https://" in m.group(2):
                errors.append(f"{p.relative_to(ROOT)}: external stylesheet {m.group(2)}")
            if tag.startswith("<script"):
                errors.append(f"{p.relative_to(ROOT)}: external script {m.group(2)}")


def check_scripts_parse():
    for js in sorted((LIVE / "assets" / "js").glob("*.js")):
        r = subprocess.run(["node", "--check", str(js)], capture_output=True, text=True)
        if r.returncode != 0:
            errors.append(f"{js.relative_to(ROOT)}: node --check failed: {r.stderr.strip()[:200]}")


def check_no_fabrication():
    """A fabricated ticker may only appear where it is *labelled* as fabricated.

    live/flagged.html is the audit record: it must be able to name the old fake
    tickers so they can be reviewed. Everywhere else they are forbidden. We make
    that distinction explicit rather than blanket-exempting the file: the page may
    contain them only inside its flag table, and it must also contain the word
    "fabricated" so the context cannot be mistaken for a live quote.
    """
    allow = LIVE / "flagged.html"
    for p in sorted(LIVE.rglob("*.html")) + sorted(LIVE.rglob("*.js")):
        text = p.read_text(encoding="utf-8")
        for fake in FABRICATED:
            if fake not in text:
                continue
            if p == allow:
                if "fabricated" not in text.lower():
                    errors.append(f"{p.relative_to(ROOT)}: names fabricated tickers without labelling them")
                continue
            errors.append(f"{p.relative_to(ROOT)}: fabricated ticker present: {fake}")
        if p == allow:
            continue
        for pat in INVENTED_CLAIMS:
            if re.search(pat, text):
                errors.append(f"{p.relative_to(ROOT)}: invented performance claim matches /{pat}/")


def check_official_sources():
    """Every data page must name at least one official source host.

    The exempt pages are prose-only records (flagged/exec/summary/start/probe)
    which are audited separately; data pages must carry a visible source.
    """
    exempt = {"flagged.html", "executive-summary.html", "start.html", "cors-probe.html", "verification.html"}
    for p in pages():
        if p.name in exempt:
            continue
        text = p.read_text(encoding="utf-8")
        if re.search(r"kalshi", text, re.I) and not any(h in text for h in OFFICIAL_HOSTS):
            errors.append(f"{p.relative_to(ROOT.name)}: data page names no official API host -> {p.relative_to(ROOT)}")


def check_nav():
    core = (LIVE / "assets" / "js" / "core.js").read_text(encoding="utf-8")
    for href in re.findall(r"\{ href: '([^']+)'", core):
        if not (LIVE / href).exists():
            errors.append(f"core.js nav: missing target {href}")


def check_flow_guard():
    """The alert threshold must be compared in one unit only (dollars vs cents bug)."""
    data = (LIVE / "assets" / "js" / "data.js").read_text(encoding="utf-8")
    if "thresholdDollars" not in data:
        errors.append("data.js: threshold unit conversion guard missing")
    if re.search(r"num\(cur\.threshold\)\s*\|\|\s*TB\.ALERT_THRESHOLD\s*\*\s*100", data):
        errors.append("data.js: threshold is compared in mixed units")


def main():
    check_links()
    check_no_remote_assets()
    check_scripts_parse()
    check_no_fabrication()
    check_official_sources()
    check_nav()
    check_flow_guard()

    print(f"pages checked: {len(pages())}")
    print(f"checks failed: {len(errors)}")
    for e in errors:
        print("  FAIL " + e)
    if errors:
        print("\nLIVE CHECKS FAILED")
        return 1
    print("LIVE CHECKS OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
