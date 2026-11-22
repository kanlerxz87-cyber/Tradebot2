import math
from datetime import datetime, timedelta, timezone

import pytest

from app.alerts import Alert
from app.strategies import evaluate, fee_per_contract, order_fee, position_size


def alert(delta=0.12, before=0.40, after=0.52, topic="crypto"):
    return Alert(
        ticker="TEST-1",
        topic=topic,
        title="Test market",
        ts=1000,
        before=before,
        after=before + delta,
        basis="mid",
    )


def market(bid=0.50, ask=0.54, hours=48, volume=500, size=200, topic="crypto"):
    close = datetime.now(tz=timezone.utc) + timedelta(hours=hours)
    return {
        "ticker": "TEST-1",
        "title": "Test market",
        "topic": topic,
        "yes_bid_dollars": f"{bid:.4f}",
        "yes_ask_dollars": f"{ask:.4f}",
        "yes_ask_size_fp": f"{size:.2f}",
        "yes_bid_size_fp": f"{size:.2f}",
        "volume_24h_fp": f"{volume:.2f}",
        "open_interest_fp": "300.00",
        "close_time": close.isoformat().replace("+00:00", "Z"),
    }


def book(depth=100):
    return {
        "orderbook_fp": {
            "yes_dollars": [["0.48", f"{depth}"], ["0.50", f"{depth}"]],
            "no_dollars": [["0.44", f"{depth}"], ["0.46", f"{depth}"]],
        }
    }


def test_fee_matches_official_worked_example():
    # Official fee-rounding page: model fee $0.00363825 for one contract at $0.055.
    assert fee_per_contract(0.055) == pytest.approx(0.00363825, rel=1e-9)


def test_order_fee_rounds_up_to_six_decimals():
    assert order_fee(1, 0.055) == pytest.approx(0.003639)


def test_momentum_requires_a_ten_cent_move():
    assert evaluate(market(), alert=alert(delta=0.05), book=book(), strategy="momentum") is None
    assert evaluate(market(), alert=None, book=book(), strategy="momentum") is None


def test_momentum_goes_with_the_move():
    opp = evaluate(market(), alert=alert(delta=0.12), book=book(), strategy="momentum")
    assert opp is not None
    assert opp.side == "yes"
    assert opp.entry_price == pytest.approx(0.54)  # YES ask implied by NO bid 0.46
    assert opp.score > 0
    assert opp.est_roi > 0


def test_momentum_down_goes_no():
    opp = evaluate(
        market(bid=0.44, ask=0.48),
        alert=alert(delta=-0.12, before=0.56, after=0.44),
        book=book(),
        strategy="momentum",
    )
    assert opp is not None
    assert opp.side == "no"


def test_mean_reversion_requires_fifteen_cents():
    assert evaluate(market(), alert=alert(delta=0.12), book=book(), strategy="mean_reversion") is None
    assert evaluate(market(), alert=alert(delta=0.16), book=book(), strategy="mean_reversion") is not None


def test_favorite_drift_requires_high_price_and_near_close():
    assert evaluate(market(bid=0.60, ask=0.62), book=None, strategy="favorite_drift") is None
    assert evaluate(market(bid=0.88, ask=0.90, hours=60), book=None, strategy="favorite_drift") is None
    opp = evaluate(market(bid=0.88, ask=0.90, hours=6), book=None, strategy="favorite_drift")
    assert opp is not None
    assert opp.side == "yes"


def test_no_opportunity_without_two_sided_quote():
    m = market()
    m["yes_bid_dollars"] = "0.0000"
    m["yes_ask_dollars"] = "1.0000"
    assert evaluate(m, alert=alert(), book=None, strategy="momentum") is None


def test_position_size_is_capped_by_visible_depth():
    opp = evaluate(market(), alert=alert(), book=book(depth=40), strategy="momentum")
    assert opp is not None
    size = position_size(opp, bankroll=10_000)
    assert size <= 10  # 25% of 40 contracts
    assert size > 0


def test_score_is_bounded():
    opp = evaluate(market(), alert=alert(), book=book(), strategy="momentum")
    assert opp is not None
    assert 0 <= opp.score <= 100
    assert not math.isnan(opp.score)
