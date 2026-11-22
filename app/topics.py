"""Topic classification for the five topics in scope.

The brief restricts the dashboard to gas prices, elections, culture, crypto and
golf. Kalshi exposes a `category` on events/series (for example "Crypto" or
"Culture") but the categories are broader than the requested topics (golf sits
inside "Sports", elections inside "Politics", gas prices inside "Economics" /
"Climate and Weather" depending on the series). Classification therefore uses
the official category as a strong signal *plus* explicit keyword rules.

Rules are deliberately narrow: a market that cannot be tied to one of the five
topics is returned as `None` rather than guessed into a bucket.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

TOPIC_LABELS = {
    "gas_prices": "Gas prices",
    "elections": "Elections",
    "culture": "Culture",
    "crypto": "Crypto",
    "golf": "Golf",
}

TOPIC_DESCRIPTIONS = {
    "gas_prices": "US retail gasoline price markets (AAA weekly / monthly series).",
    "elections": "Election, presidential, congressional, state and local races.",
    "culture": "Entertainment, awards, celebrities, film, music and internet culture.",
    "crypto": "Bitcoin, Ethereum, Solana and other digital-asset markets.",
    "golf": "PGA Tour, LPGA, majors, Ryder Cup and other golf events.",
}

# Kalshi market page path segment (used only to build a human link).
TOPIC_KLINK = {
    "gas_prices": "gas-prices",
    "elections": "elections",
    "culture": "culture",
    "crypto": "crypto",
    "golf": "golf",
}

# Series-ticker prefixes seen in the demo/production catalogs. Prefix matches are
# case-insensitive and must be followed by a non-letter (or end of string).
TICKER_PREFIXES: dict[str, tuple[str, ...]] = {
    # Gasoline tickers, plus the crude / natural-gas series that Kalshi files
    # under `Commodities > Oil & Gas`. The latter are a proxy: see
    # flagged.html F-02 ("no retail gasoline series was live at collection").
    "gas_prices": (
        "KXAAAGASW",
        "KXAAAGASM",
        "KXAAAGASD",
        "KXAAAGAS",
        "KXGASPRICE",
        "KXGAS",
        "KXWTI",
        "KXNGAS",
        "KXBRENT",
        "KXHEATOIL",
    ),
    "elections": (
        "KXPRESPERSON",
        "KXPRESNOMD",
        "KXPRESNOMR",
        "KXPRES",
        "KXSENMAJ",
        "KXSENATEIAD",
        "KXSENATE",
        "KXHOUSE",
        "KXCONTROLH",
        "KXCONTROLS",
        "KXCONTROL",
        "KXGOV",
        "KXMAYOR",
        "KXELECT",
        "KXCONGRESS",
        "KXVOTE",
        "KXGA14",
        "KXNEXTNATOSECGEN",
    ),
    "culture": (
        "KXOSCARPIC",
        "KXOSCAR",
        "KXGRAMMY",
        "KXEMMY",
        "KXNETFLIXRANKSHOWGLOBAL",
        "KXNETFLIX",
        "KXGTAONLINE",
        "KXGTA",
        "KXELONMARS",
        "NOBELLIT",
        "KXNOBEL",
        "KXGROK",
        "KXTIKTOK",
        "KXBILLBOARD",
        "KXBOXOFFICE",
        "KXSPOTIFY",
        "KXTIME",
    ),
    "crypto": (
        "KXBTCD",
        "KXBTCY",
        "KXBTCMAXY",
        "KXBTC15M",
        "KXBTC",
        "KXETHD",
        "KXETHY",
        "KXETH15M",
        "KXETH",
        "KXBT",
        "KXET",
        "KXSOL15M",
        "KXSOL",
        "KXXRP15M",
        "KXXRP",
        "KXDOGE15M",
        "KXDOGE",
        "KXADA",
        "KXCRYPTO",
        "KXSTABLE",
        "KXCOIN",
        "BTCD",
        "ETHD",
        "KXHYPE",
        "KXBNB",
        "KXDEMOFUTHOURLY",
    ),
    "golf": (
        "KXPGATOUR",
        "KXLPGATOUR",
        "KXPGAMAKECUT",
        "KXPRESCUPMATCH",
        "KXPRESCUP",
        "KXNELKRTS",
        "KXGOLF",
        "KXLPGA",
        "KXRYDER",
        "KXMASTERS",
        "KXSOLHEIM",
    ),
}

# Keyword rules. Use word boundaries; avoid short ambiguous tokens where a
# substring match would create false positives ("eth" in "Netherlands").
KEYWORDS: dict[str, tuple[str, ...]] = {
    "gas_prices": (
        r"\bgas prices?\b",
        r"\bwti\b",
        r"\bcrude\b",
        r"\bnatural gas\b",
        r"\bbrent\b",
        r"\bheating oil\b",
        r"\boil & gas\b",
        r"\bgasoline\b",
        r"\bpump prices?\b",
        r"\baaa\b",
        r"\bregular gas\b",
        r"\bnational average gas\b",
    ),
    "elections": (
        r"\belections?\b",
        r"\bpresidential\b",
        r"\bpresident\b",
        r"\bsenate\b",
        r"\bsenator\b",
        r"\bhouse of representatives\b",
        r"\bcongress(ional)?\b",
        r"\bgovernor\b",
        r"\bgubernatorial\b",
        r"\bmayor\b",
        r"\bprimary election\b",
        r"\belectoral college\b",
        r"\bmidterms?\b",
        r"\bballot\b",
        r"\bvote share\b",
    ),
    "culture": (
        r"\bbox office\b",
        r"\bmovie\b",
        r"\bfilm\b",
        r"\balbum\b",
        r"\bgrammy",
        r"\boscars?\b",
        r"\bemmy",
        r"\btony award",
        r"\bbillboard\b",
        r"\bnetflix\b",
        r"\btv show\b",
        r"\bcelebrity\b",
        r"\btaylor swift\b",
        r"\bmusic\b",
        r"\bconcert\b",
        r"\baward show\b",
        r"\btime person of the year\b",
        r"\bgta\b",
        r"\bgrand theft auto\b",
        r"\bnobel prize in literature\b",
    ),
    "crypto": (
        r"\bbitcoin\b",
        r"\bbtc\b",
        r"\bethereum\b",
        r"\bether\b",
        r"\beth\b",
        r"\bsolana\b",
        r"\bsol\b",
        r"\bxrp\b",
        r"\bripple\b",
        r"\bdogecoin\b",
        r"\bdoge\b",
        r"\bcardano\b",
        r"\bcrypto(currenc(y|ies))?\b",
        r"\bstablecoins?\b",
        r"\bblockchain\b",
        r"\bdefi\b",
        r"\bcoinbase\b",
        r"\bbinance\b",
        r"\bsatoshi\b",
    ),
    "golf": (
        r"\bgolf(er|ers)?\b",
        r"\bpga\b",
        r"\blpga\b",
        r"\bryder cup\b",
        r"\bsolheim cup\b",
        r"\bmasters tournament\b",
        r"\bthe masters\b",
        r"\bopen championship\b",
        r"\bbritish open\b",
        r"\bfedex(cup)?\b",
        r"\bwm phoenix open\b",
        r"\bplayers championship\b",
        r"\bpresidents cup\b",
        r"\brsm classic\b",
        r"\bcme group tour championship\b",
        r"\bgolf tournament\b",
    ),
}

# Category names as published by Kalshi that map directly to a topic.
CATEGORY_MAP = {
    "crypto": "crypto",
    "culture": "culture",
}

# Words that, when present, veto a keyword match (protects against common
# false positives such as "Las Vegas" matching "gas").
VETOES: dict[str, tuple[str, ...]] = {
    "gas_prices": (r"\blas vegas\b", r"\bvegas\b", r"\bgascogne\b", r"\bgascony\b"),
    "crypto": (r"\bnetherlands\b", r"\bnetherland\b", r"\bethiopia\b"),
    "golf": (),
}

_COMPILED = {
    topic: [re.compile(p, re.IGNORECASE) for p in patterns] for topic, patterns in KEYWORDS.items()
}
_VETO_COMPILED = {
    topic: [re.compile(p, re.IGNORECASE) for p in patterns] for topic, patterns in VETOES.items()
}


@dataclass
class Classification:
    topic: str | None
    reason: str
    matched: list[str] = field(default_factory=list)

    @property
    def is_topic(self) -> bool:
        return self.topic is not None


def _as_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return " ".join(str(v) for v in value)
    if isinstance(value, dict):
        return " ".join(f"{k} {v}" for k, v in value.items())
    return str(value)


def _ticker_matches(topic: str, *tickers: str) -> str | None:
    for prefix in TICKER_PREFIXES.get(topic, ()):
        p = prefix.upper()
        for ticker in tickers:
            t = (ticker or "").upper()
            if not t:
                continue
            if t == p or t.startswith(p + "-") or t.startswith(p + "_"):
                return prefix
    return None


def classify(
    *,
    title: str = "",
    subtitle: str = "",
    event_title: str = "",
    series_title: str = "",
    rules: str = "",
    category: str = "",
    tags: object = None,
    market_ticker: str = "",
    event_ticker: str = "",
    series_ticker: str = "",
) -> Classification:
    """Return the single in-scope topic for a market, or ``None``.

    ``category`` is the official Kalshi category (event/series). The official
    category alone is only trusted for Crypto and Culture; for Golf/Elections/
    Gas prices the catalog categories are too broad, so keywords/tickers decide.
    """

    tickers = (series_ticker, event_ticker, market_ticker)
    category_norm = (category or "").strip()

    # 1) Strong, explicit ticker prefixes.
    for topic in ("golf", "gas_prices", "elections", "crypto", "culture"):
        prefix = _ticker_matches(topic, *tickers)
        if prefix:
            return Classification(topic, f"series ticker prefix {prefix}")

    # 2) Official category for the two subjects where the category is exact.
    direct = CATEGORY_MAP.get(category_norm.lower())
    if direct:
        return Classification(direct, f"official Kalshi category '{category_norm}'")

    # 3) Keyword rules over title/subtitle/rules/series title/tags.
    haystack = " ".join(
        _as_text(part)
        for part in (title, subtitle, event_title, series_title, rules, tags)
    )
    scores: list[tuple[int, str, list[str]]] = []
    for topic in ("golf", "gas_prices", "crypto", "culture", "elections"):
        matched = [p.pattern for p in _COMPILED[topic] if p.search(haystack)]
        if not matched:
            continue
        if any(v.search(haystack) for v in _VETO_COMPILED.get(topic, ())):
            continue
        # Weight specific multi-word phrases higher than single tokens.
        score = sum(2 if " " in pattern.replace(r"\b", " ").strip() else 1 for pattern in matched)
        scores.append((score, topic, matched))

    if not scores:
        return Classification(None, "no in-scope topic matched")

    scores.sort(key=lambda item: (-item[0], item[1]))
    _, topic, matched = scores[0]
    return Classification(topic, "keyword match", matched)
