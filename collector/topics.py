"""Topic definitions for the dashboard.

Kalshi groups contracts as Series -> Event -> Market, and a series carries a
primary `category`, a `categories` list and subcategory `tags`
(https://docs.kalshi.com/getting_started/terms).  This module turns the five
requested topics into explicit, auditable matching rules against those
official fields *only*: no keyword guessing on market titles.

Each series that matches a topic records which rule matched it and the exact
API URL the record came from, so every row on the site can be traced back to a
response the collector actually received.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Rule:
    """One auditable matching rule.

    kind:
      tag      -- series `tags` contains one of `values` (case-insensitive)
      category -- series `categories`/`category` contains one of `values`
                  AND (if set) the series title matches `title_regex`
    """
    kind: str
    values: list[str]
    title_regex: str | None = None
    note: str = ""

    def matches(self, series: dict[str, Any]) -> bool:
        haystack = [str(t) for t in (series.get("tags") or [])]
        haystack += [str(c) for c in (series.get("categories") or [])]
        haystack.append(str(series.get("category") or ""))
        low = {h.strip().lower() for h in haystack if h}
        if self.kind == "tag":
            if not any(v.lower() in low for v in self.values):
                return False
        elif self.kind == "category":
            if not any(v.lower() in low for v in self.values):
                return False
            if self.title_regex and not re.search(self.title_regex, str(series.get("title") or ""), re.I):
                return False
        else:  # pragma: no cover - guarded by construction
            return False
        return True

    def label(self) -> str:
        vals = " | ".join(self.values)
        if self.kind == "tag":
            return f"series tag ∈ {{{vals}}}"
        extra = f", title ~ /{self.title_regex}/i" if self.title_regex else ""
        return f"series category ∈ {{{vals}}}{extra}"


@dataclass
class Topic:
    id: str
    name: str
    blurb: str
    rules: list[Rule] = field(default_factory=list)
    # Series deliberately excluded, with the reason, so exclusions are reviewable.
    exclude_series: dict[str, str] = field(default_factory=dict)


TOPICS: list[Topic] = [
    Topic(
        id="gas",
        name="Gas prices",
        blurb=("Retail gasoline price contracts. Kalshi's gas series are sourced "
               "from AAA (https://gasprices.aaa.com) per each series' settlement sources."),
        rules=[
            Rule("tag", ["Oil & Gas"],
                 note="Kalshi tags gasoline-price series with `Oil & Gas` (Commodities subcategory)."),
            Rule("category", ["Economics", "Commodities"], title_regex=r"gas(oline)?\s*pric",
                 note="Economics/Commodities series whose title names a gas/gasoline price."),
        ],
        # Crude-oil *production* is not a gas price; excluded explicitly so the
        # exclusion is reviewable rather than silent.
        exclude_series={"KXNDKOIL": "North Dakota crude oil production volume, not a retail gas price."},
    ),
    Topic(
        id="elections",
        name="Elections",
        blurb=("Election contracts: US and international elections, nominations, and "
               "leadership races, matched on Kalshi's official Elections category and tags."),
        rules=[
            Rule("category", ["Elections"],
                 note="Series whose primary category or categories list includes `Elections`."),
            Rule("tag", ["US Elections", "International elections", "Presidential winner",
                         "Senate", "House", "Governor", "Primaries", "Nomination race",
                         "Leadership races", "Referendums", "Mayors & local", "Election Combos"],
                 note="Election subcategory tags from /search/tags_by_categories."),
        ],
    ),
    Topic(
        id="culture",
        name="Culture",
        blurb=("Culture & entertainment contracts: Kalshi category `Culture` plus the "
               "`Entertainment` and `Mentions` categories that carry pop-culture markets."),
        rules=[
            Rule("category", ["Culture", "Entertainment", "Mentions"],
                 note="Kalshi `Culture`, `Entertainment`, `Mentions` categories."),
            Rule("tag", ["Music", "Awards", "Movies", "Television", "People", "Video games",
                         "Oscars", "Grammys", "Collectibles", "Critics Choice Awards",
                         "Reality TV", "Music charts", "Art", "Food"],
                 note="Entertainment/Culture subcategory tags."),
        ],
    ),
    Topic(
        id="crypto",
        name="Crypto",
        blurb=("Crypto price and milestone contracts: Kalshi category `Crypto` and its "
               "asset tags (BTC, ETH, SOL, XRP, DOGE, ...)."),
        rules=[
            Rule("category", ["Crypto"], note="Kalshi `Crypto` category."),
            Rule("tag", ["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "HYPE", "ZEC", "NEAR",
                         "Shiba Inu", "Crypto", "Bitcoin", "Ethereum", "Solana", "Zcash"],
                 note="Crypto asset subcategory tags."),
        ],
    ),
    Topic(
        id="golf",
        name="Golf",
        blurb=("Golf contracts (PGA, DP World Tour, LIV, majors). Kalshi exposes golf "
               "as the `Golf` subcategory tag under category `Sports`."),
        rules=[
            Rule("tag", ["Golf"], note="Sports subcategory tag `Golf` from /search/tags_by_categories."),
        ],
        exclude_series={},
    ),
]

TOPIC_INDEX = {t.id: t for t in TOPICS}


def classify(series: dict[str, Any]) -> list[tuple[str, str]]:
    """Return [(topic_id, matched rule label)] for a series object."""
    hits: list[tuple[str, str]] = []
    for topic in TOPICS:
        if series.get("ticker") in topic.exclude_series:
            continue
        for rule in topic.rules:
            if rule.matches(series):
                hits.append((topic.id, rule.label()))
                break
    return hits
