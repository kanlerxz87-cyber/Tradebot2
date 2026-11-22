"""Topic taxonomy for the five requested topics, with verified provenance.

Every mapping here was checked against live responses from the Kalshi demo API
on 2026-11-22 and is cited on the site's verification page. Two of them were
*not* obvious and both are flagged on `flagged.html`:

* **Gas prices** are the ``KXAAAGAS*`` series (US + state, daily/weekly/monthly).
  They live in category ``Economics`` with the tag ``Oil and energy`` and settle
  from AAA (https://gasprices.aaa.com/).
* **Golf** markets are the ``KXPGA*`` / ``KXDPWT*`` series in category ``Sports``
  with the tag ``Golf``. ``category=Golf`` returns ``{"series": null}``.

``category=Culture``, ``category=Crypto`` and ``category=Elections`` are real
category values and are used directly.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TopicRule:
    key: str  # stable slug used in URLs and JSON
    label: str  # display name
    category: str | None  # exact /series?category value, or None
    tag: str | None  # exact tag filter inside the category
    ticker_prefixes: tuple[str, ...]  # fallback matcher for market tickers
    title_keywords: tuple[str, ...]  # last-resort matcher, flagged when used
    evidence_url: str  # official page proving the mapping
    note: str


TOPICS: tuple[TopicRule, ...] = (
    TopicRule(
        key="gas",
        label="Gas prices",
        category="Economics",
        tag="Oil and energy",
        ticker_prefixes=("KXAAAGAS", "KXAAAGASD", "KXAAAGASW", "KXAAAGASM", "KXAAAGASCD", "KXAAAGASD"),
        title_keywords=("gas price", "gas prices", "gallon"),
        evidence_url="https://docs.kalshi.com/api-reference/series/get-series-list.md",
        note="Series family KXAAAGAS* settles from AAA average pump prices. "
        "Category 'Gas' does not exist on the API.",
    ),
    TopicRule(
        key="elections",
        label="Elections",
        category="Elections",
        tag=None,
        ticker_prefixes=("PRESPARTY", "KXSENATE", "KXGOV", "KXHOUSE", "KXPRES", "KXELECT", "KXMAYOR",
                         "KXNEXTNATO"),
        title_keywords=("election", "senate", "governor", "presidential", "primary", "ballot"),
        evidence_url="https://docs.kalshi.com/api-reference/series/get-series-list.md",
        note="Official category 'Elections' (verified: KXSENATEID, KXGOVHINOMR, PRESPARTYMN).",
    ),
    TopicRule(
        key="culture",
        label="Culture",
        category="Culture",
        tag=None,
        ticker_prefixes=("KXX", "KXOSCAR", "KXGRAMMY", "KXEMMY", "KXTIME", "KXCELEB"),
        title_keywords=("movie", "album", "award", "oscar", "grammy", "celebrity", "banned"),
        evidence_url="https://docs.kalshi.com/api-reference/series/get-series-list.md",
        note="Official category 'Culture' (verified: KXXBANNEDGROK, KXXBANNEDMURRAYHILLGUY1).",
    ),
    TopicRule(
        key="crypto",
        label="Crypto",
        category="Crypto",
        tag=None,
        ticker_prefixes=("KXBTC", "KXETH", "KXSOL", "KXXRP", "KXDOGE", "KXHYPE", "KXBTCD", "KXBTC15M"),
        title_keywords=("bitcoin", "ethereum", "crypto", "solana", "dogecoin"),
        evidence_url="https://docs.kalshi.com/api-reference/series/get-series-list.md",
        note="Official category 'Crypto' (verified: KXBTCD, KXBTC15M, KXHYPE15M, KXBTCMAX100INAUG).",
    ),
    TopicRule(
        key="golf",
        label="Golf",
        category="Sports",
        tag="Golf",
        ticker_prefixes=("KXPGA", "KXDPWT", "KXLPGA", "KXMLB", "KXGOLF"),
        title_keywords=("golf", "pga", "eagle", "birdie", "round score", "masters"),
        evidence_url="https://docs.kalshi.com/api-reference/series/get-series-list.md",
        note="Golf lives under category Sports with tag 'Golf' (verified: KXPGAWINMARGIN, "
        "KXPGAROUNDLOW, KXPGAEAGLE, KXDPWTTOP5). Category 'Golf' does not exist.",
    ),
)

TOPIC_BY_KEY = {t.key: t for t in TOPICS}
TOPIC_LABELS = {t.key: t.label for t in TOPICS}


def match_topic(series_ticker: str, category: str | None, tags: list[str] | None,
                title: str = "") -> tuple[str | None, str]:
    """Assign one of the five topics.

    Returns ``(topic_key, basis)`` where basis is one of
    ``category+tag`` / ``category`` / ``ticker-prefix`` / ``title-keyword`` /
    ``none``. The basis is published next to every row so a reader can see how
    a market was assigned instead of trusting an opaque guess.
    """
    ticker = (series_ticker or "").upper()
    cat = (category or "").strip()
    tagset = {(t or "").strip().lower() for t in (tags or [])}

    for topic in TOPICS:
        if topic.category and cat == topic.category:
            if topic.tag is None or topic.tag.lower() in tagset:
                return topic.key, "category+tag" if topic.tag else "category"

    # Category may be absent from a nested market object; fall back to ticker.
    for topic in TOPICS:
        for prefix in topic.ticker_prefixes:
            if ticker.startswith(prefix.upper()):
                return topic.key, "ticker-prefix"

    low_title = (title or "").lower()
    for topic in TOPICS:
        if any(k in low_title for k in topic.title_keywords):
            return topic.key, "title-keyword"

    return None, "none"


def topic_order(key: str | None) -> int:
    order = {"gas": 0, "elections": 1, "culture": 2, "crypto": 3, "golf": 4}
    return order.get(key or "", 99)
