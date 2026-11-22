"""Pipeline-level invariants that do not need the network."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from collector.topics import classify  # noqa: E402


def test_unrelated_sports_are_not_matched():
    assert classify({"ticker": "KXNBA", "tags": ["Basketball"], "categories": ["Sports"],
                     "category": "Sports", "title": "NBA"}) == []


def test_golf_matches_on_official_tag():
    assert classify({"ticker": "KXPGAMASTERS", "tags": ["Golf"], "categories": ["Sports"],
                     "category": "Sports", "title": "Masters"}) == [("golf", "series tag ∈ {Golf}")]


def test_crude_oil_production_is_excluded_from_gas():
    assert classify({"ticker": "KXNDKOIL", "tags": ["Oil and energy"], "categories": ["Economics"],
                     "category": "Economics", "title": "North Dakota crude oil production"}) == []


def test_fixtures_are_valid_json():
    fx = os.path.join(ROOT, "tests", "fixtures")
    for name in os.listdir(fx):
        with open(os.path.join(fx, name), encoding="utf-8") as fh:
            json.load(fh)


if __name__ == "__main__":
    fails = 0
    for n, f in sorted(globals().items()):
        if n.startswith("test_") and callable(f):
            try:
                f(); print("PASS", n)
            except AssertionError as e:
                fails += 1; print("FAIL", n, e)
    raise SystemExit(1 if fails else 0)
