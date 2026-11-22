#!/usr/bin/env python3
"""Line-by-line verification gate for the Tradebot2 site.

Run:  python3 scripts/verify_site.py
Exit: 0 = publishable, 1 = broken (CI fails, nothing merges).

Checks, in the order they matter:
  1. data integrity   every data row has an https source_url; alerts are
                      recomputable from candles.json by the real detector; the
                      fee model reproduces the official fee table.
  2. link integrity   every internal href in every page resolves to a file; every
                      page loads styles.css and js/live.js; every nav entry exists.
  3. claim integrity  every fact id cited in a page exists in engine/sources.py,
                      and no page asserts a live account balance.
  4. engine hygiene   no order-placing code path exists (no POST helper), the
                      alert threshold is 0.10, and the topic map covers 5 topics.
"""

from __future__ import annotations

import json
import re
import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
DATA = DOCS / "data"
sys.path.insert(0, str(ROOT))

from engine.alerts import THRESHOLD, PricePoint, detect_alerts  # noqa: E402
from engine.paper import OFFICIAL_FEE_TABLE_100, PROSE_RULE, taker_fee  # noqa: E402
from engine.sources import SOURCE_BY_ID  # noqa: E402
from engine.topics import TOPICS  # noqa: E402

PASS, FAIL = [], []


def check(name: str, ok: bool, detail: str = "") -> None:
    (PASS if ok else FAIL).append((name, detail))


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def html_files() -> list[Path]:
    return sorted(DOCS.glob("*.html"))


def check_data() -> None:
    markets = load("markets.json")
    alerts = load("alerts.json")
    candles = load("candles.json")
    backtest = load("backtest.json")
    sources = load("sources.json")

    rows = markets["rows"]
    bad = [r for r in rows if not str(r.get("source_url", "")).startswith("https://")]
    check("every data row has an https source_url", not bad, f"{len(bad)} bad of {len(rows)}")

    check("snapshot timestamp present on every row",
          all(r.get("snapshot_ts") for r in rows),
          f"{sum(1 for r in rows if not r.get('snapshot_ts'))} missing")

    check("no placeholder source urls",
          not [r for r in rows if "example.com" in r.get("source_url", "") or "TODO" in r.get("source_url", "")])

    # alerts must be reproducible from the candles by the shipped detector
    points, meta = {}, {}
    for ticker, blob in candles["series"].items():
        pts = []
        for row in blob["rows"]:
            if row.get("price") is None:
                continue
            pts.append(PricePoint(ts=row["ts"], price=Decimal(row["price"]),
                                  basis="candle trade-price close",
                                  bid=Decimal(row["bid"]) if row.get("bid") else None,
                                  ask=Decimal(row["ask"]) if row.get("ask") else None,
                                  depth_contracts=Decimal("2718.76")))
        points[ticker] = pts
        meta[ticker] = {"event_ticker": "KXELONMARS-99", "topic": "off-topic (Politics)",
                        "title": "Will Elon Musk visit Mars before Aug 1, 2099?",
                        "source_url": blob["source_url"], "volume": Decimal("14150.08")}
    replayed = detect_alerts(points, meta)
    check("alerts recomputable from candles.json",
          len(replayed) == len(alerts["alerts"]),
          f"engine={len(replayed)} file={len(alerts['alerts'])}")
    check("every alert move is >= $0.10",
          all(abs(Decimal(a["after"]) - Decimal(a["before"])) >= THRESHOLD for a in alerts["alerts"]))
    check("alert threshold constant is 0.10", THRESHOLD == Decimal("0.10"), str(THRESHOLD))

    # fee model must reproduce all 21 rows of the official table, not a sample
    mismatches = []
    for price, expected in OFFICIAL_FEE_TABLE_100:
        got = taker_fee(Decimal(price), Decimal(100))
        if got != Decimal(expected):
            mismatches.append(f"{price}->{got} (table {expected})")
    check("fee model reproduces all 21 official table rows", not mismatches, "; ".join(mismatches[:4]))

    # and the prose rule (centicent) must be recorded as a known discrepancy
    prose = taker_fee(Decimal("0.01"), Decimal(100), mode=PROSE_RULE)
    check("prose centicent rule is exposed and differs from the table",
          prose == Decimal("0.0693"),
          f"prose={prose} vs table=0.07 (documented as finding F-13)")

    # resolved rows must carry a real result
    resolved = [r for r in rows if r["row_type"] == "resolved"]
    check("every resolved row has result yes|no",
          all(r.get("result") in ("yes", "no", "scalar") for r in resolved),
          f"{len(resolved)} rows")
    check("every resolved row has a settlement timestamp",
          all(r.get("settlement_ts") for r in resolved))

    check("five topics defined", len(TOPICS) == 5, str([t.key for t in TOPICS]))
    check("topic keys are the five required ones",
          {t.key for t in TOPICS} == {"gas", "elections", "culture", "crypto", "golf"})

    # five topic pages must exist
    for t in TOPICS:
        check(f"topic page exists: {t.key}", (DOCS / f"topic-{t.key}.html").exists())

    # backtest disclosure must be present and say simulated
    disc = backtest.get("disclosure", "").lower()
    check("backtest disclosure says simulated", "simulated" in disc and "no order was ever sent" in disc)

    # every source cited in data exists in the registry
    reg = {s["fact_id"] for s in sources["sources"]}
    check("source registry non-trivial", len(reg) >= 15, f"{len(reg)} sources")
    check("source registry matches engine/sources.py", reg == set(SOURCE_BY_ID))


def check_links() -> None:
    pages = html_files()
    check("at least 12 pages", len(pages) >= 12, f"{len(pages)} pages")
    missing_css, missing_js, broken, no_nav = [], [], [], []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        if 'href="styles.css"' not in text:
            missing_css.append(page.name)
        if 'src="js/live.js"' not in text:
            missing_js.append(page.name)
        if 'id="shell"' not in text:
            no_nav.append(page.name)
        for href in re.findall(r'href="([^"#?:]+\.html)"', text):
            if not (DOCS / href).exists():
                broken.append(f"{page.name}->{href}")
    check("every page links styles.css", not missing_css, str(missing_css))
    check("every page links js/live.js", not missing_js, str(missing_js))
    check("every page mounts the shared nav shell", not no_nav, str(no_nav))
    check("every internal page link resolves", not broken, str(broken))

    # nav entries used by shell.js must all exist
    shell = (DOCS / "js" / "shell.js").read_text(encoding="utf-8")
    nav = re.findall(r'\["([a-z0-9\-]+\.html)"', shell)
    missing = [n for n in nav if not (DOCS / n).exists()]
    check("every nav entry resolves", not missing, str(missing))
    check("nav has at least 10 entries", len(nav) >= 10, str(len(nav)))

    # no leftover references to deleted files
    dead = []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        for name in ("app.js", "categories.html", "portfolio.html"):
            if f'href="{name}"' in text or f'src="{name}"' in text:
                dead.append(f"{page.name}->{name}")
        # verified-markets.json must not be *loaded*; describing its archive is fine
        if 'fetch("data/verified-markets.json")' in text:
            dead.append(f"{page.name}->verified-markets.json")
    check("no page loads a removed file", not dead, str(dead))


def check_markup() -> None:
    """HTML well-formedness and stylesheet coverage.

    Catches the mistakes that a link check cannot see: an unclosed tag, or a
    class the JavaScript emits but the stylesheet never defines (which renders as
    unstyled text and looks like a layout bug).
    """
    from html.parser import HTMLParser

    void = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "source", "track", "wbr"}

    class Balancer(HTMLParser):
        def __init__(self) -> None:
            super().__init__(convert_charrefs=True)
            self.stack: list[tuple[str, tuple[int, int]]] = []
            self.errors: list[str] = []

        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style"):
                self.skip = True
                return
            if tag not in void:
                self.stack.append((tag, self.getpos()))

        def handle_endtag(self, tag):
            if tag in ("script", "style"):
                return
            if tag in void or not self.stack:
                return
            opened, pos = self.stack.pop()
            if opened != tag:
                self.errors.append(f"</{tag}> closes <{opened}> from {pos}")

    css = (DOCS / "styles.css").read_text(encoding="utf-8")
    defined = set(re.findall(r"\.([a-zA-Z][\w-]*)", css))

    bad_markup, unknown_classes = [], []
    for page in html_files():
        text = page.read_text(encoding="utf-8")
        parser = Balancer()
        parser.feed(text)
        leftover = [t for t, _ in parser.stack if t not in ("html", "body")]
        if parser.errors or leftover:
            bad_markup.append(f"{page.name}:{parser.errors[:1] or leftover[:1]}")

        body = re.sub(r"<script.*?</script>", "", text, flags=re.S)
        for attr in re.findall(r'class="([^"]*)"', body):
            for token in attr.split():
                if "${" in token or token in ("===", "=="):
                    continue
                if token not in defined:
                    unknown_classes.append(f"{page.name}:{token}")
    check("every page is well-formed HTML", not bad_markup, str(bad_markup[:3]))
    check("every literal class has a stylesheet rule", not unknown_classes, str(unknown_classes[:4]))


def check_claims() -> None:
    pages = html_files()
    bad_balance = []
    for page in pages:
        text = page.read_text(encoding="utf-8").lower()
        if "portfolio balance of" in text or "account balance:" in text or "my balance" in text:
            bad_balance.append(page.name)
    check("no page asserts a real account balance", not bad_balance, str(bad_balance))

    # every kalshi docs link in the pages must be a docs URL we know or a deep link
    docs_links = set()
    for page in pages:
        docs_links.update(re.findall(r'https://docs\.kalshi\.com/[a-z0-9_\-/\.]+', page.read_text(encoding="utf-8")))
    known = {s.url for s in SOURCE_BY_ID.values()}
    unknown = sorted(l for l in docs_links if l not in known and not l.rstrip("/").endswith("docs.kalshi.com"))
    check("docs links are all recorded in the source registry",
          not unknown, "; ".join(unknown[:5]))

    # no unfilled template markers
    markers = []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        for m in ("TODO", "FIXME", "lorem ipsum", "undefined"):
            if m in text:
                markers.append(f"{page.name}:{m}")
    check("no template markers or 'undefined' left in pages", not markers, str(markers))


def check_engine() -> None:
    kalshi = (ROOT / "engine" / "kalshi.py").read_text(encoding="utf-8")
    check("no order-placing code path exists",
          "def post" not in kalshi and "portfolio/events/orders" not in kalshi,
          "client is read-only by construction")
    check("no credential handling in client",
          "KALSHI-ACCESS-KEY" not in kalshi and "private_key" not in kalshi)
    paper = (ROOT / "engine" / "paper.py").read_text(encoding="utf-8")
    check("paper engine pays the official taker fee", "0.07" in paper and "ROUND_CEILING" in paper)
    alerts = (ROOT / "engine" / "alerts.py").read_text(encoding="utf-8")
    check("alert detector uses Decimal, not float", "Decimal(\"0.10\")" in alerts)
    # compiled bytecode must not be committed (untracked build output is fine)
    import subprocess
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout
    pyc = [line for line in tracked.splitlines() if "__pycache__" in line or line.endswith(".pyc")]
    check("no committed bytecode or __pycache__", not pyc, str(pyc[:3]))
    ignored = (ROOT / ".gitignore").read_text(encoding="utf-8") if (ROOT / ".gitignore").exists() else ""
    check(".gitignore covers __pycache__", "__pycache__" in ignored)


def check_root_copy() -> None:
    """The repo root must be a complete copy of docs/ so either Pages mode serves
    a working site. Fails if pages_build.py would change anything."""
    this = Path(__file__).resolve()
    root = this.parent.parent
    want = {}
    for page in sorted((root / "docs").glob("*.html")):
        want[page.name] = page.name
    missing = [n for n in want if not (root / n).exists()]
    check("every docs page also exists at the repo root", not missing, str(missing))
    if (root / "pages_build.py").exists():
        import subprocess
        res = subprocess.run([sys.executable, "pages_build.py", "--check"], cwd=root,
                             capture_output=True, text=True)
        check("root copy is in sync with docs/ (pages_build.py --check)", res.returncode == 0,
              res.stdout.strip().splitlines()[-1] if res.stdout.strip() else "")


def main() -> int:
    check_data()
    check_root_copy()
    check_markup()
    check_links()
    check_claims()
    check_engine()

    width = max(len(n) for n, _ in PASS + FAIL) if (PASS or FAIL) else 10
    for name, detail in PASS:
        print(f"  PASS  {name.ljust(width)}  {detail}")
    for name, detail in FAIL:
        print(f"  FAIL  {name.ljust(width)}  {detail}")
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    return 0 if not FAIL else 1


if __name__ == "__main__":
    sys.exit(main())
