"""Regression tests for the public bootstrap adapter (no network)."""
from copy import deepcopy
import json
from pathlib import Path

import pytest
from tools.build_live_snapshot import BASE, build


def fixture():
    row = {"ticker": "TEST-ONE", "topic": "gas_prices", "event_ticker": "TEST", "series_ticker": "TEST",
           "title": "Test fixture, not a venue record", "status": "active", "result": None,
           "prices": {"last": 0, "yes_bid": 0.12, "yes_ask": 0.14},
           "volume": {"last_24h_contracts": 0}, "links": {"market_api": BASE + "/markets/TEST-ONE"}}
    return {"api_base": BASE, "generated_at": "2026-11-27T00:00:00Z", "markets": [row], "resolutions": []}


def test_projection_does_not_fill_unverified_values():
    out = build(fixture())
    m = out["markets"][0]
    assert m["last_price_dollars"] == 0 and m["volume_24h_fp"] == 0
    assert m["notional_value_dollars"] is None
    assert m["yes_bid_size_fp"] is None
    assert m["settlement_ts"] is None
    assert m["event_title"] is None
    assert m["observed_at"] == "2026-11-27T00:00:00Z"
    assert out["provenance"]["reverified_at"] is None


@pytest.mark.parametrize("url", ["https://kalshi.evil.test/trade-api/v2/markets/TEST-ONE",
                                  "https://demo-api.kalshi.co.evil.test/trade-api/v2/markets/TEST-ONE",
                                  "https://demo-api.kalshi.co/trade-api/v2/markets/OTHER",
                                  "http://demo-api.kalshi.co/trade-api/v2/markets/TEST-ONE"])
def test_rejects_non_official_or_mismatched_sources(url):
    s = fixture(); s["markets"][0]["links"]["market_api"] = url
    with pytest.raises(ValueError):
        build(s)


def test_verification_requires_every_selected_ticker_and_matching_identity():
    with pytest.raises(ValueError, match="not re-verified"):
        build(fixture(), {})
    with pytest.raises(ValueError, match="identity mismatch"):
        build(fixture(), {"TEST-ONE": {"ticker": "OTHER"}})
    raw = {"TEST-ONE": {"ticker": "TEST-ONE", "event_ticker": "TEST", "status": "finalized", "result": "yes"}}
    out = build(fixture(), raw, checked_at="2026-11-27T01:00:00Z")
    assert out["markets"][0]["status"] == "finalized"
    assert out["markets"][0]["last_price_dollars"] is None  # never retain a stale field omitted by a fresh response
    assert out["markets"][0]["observed_at"] == "2026-11-27T01:00:00Z"


def test_resolution_sample_is_bounded_and_does_not_infer_settlement_fields():
    s = fixture()
    for n in range(70):
        row = deepcopy(s["markets"][0]); row.update(ticker=f"TEST-{n}", result="yes", close_time=f"2026-11-27T{n:02}:00:00Z")
        row.pop("status"); row["links"]["market_api"] = BASE + f"/markets/TEST-{n}"
        s["resolutions"].append(row)
    out = build(s)
    assert len(out["resolutions"]) == 40
    assert all(r["status"] is None and r["settlement_value_dollars"] is None for r in out["resolutions"])


def test_committed_capture_is_small_and_every_row_has_official_exact_source():
    path = Path(__file__).resolve().parents[1] / "live/data/fallback-snapshot.json"
    s = json.loads(path.read_text())
    assert path.stat().st_size < 1_500_000
    assert s["schema_version"] == 2 and s["environment"] == "demo"
    from tools.build_live_snapshot import official_url
    for m in s["markets"] + s["resolutions"]:
        assert official_url(m["source_url"], m["ticker"])
        assert m["topic"] in {"gas", "elections", "culture", "crypto", "golf"}
