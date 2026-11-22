"""Unit checks for alert detection, ROI filter and settlement arithmetic.

Each assertion states the arithmetic explicitly so the expected value can be
re-derived by hand from the official formulas (fee schedule + $1.00 payout).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collector.alerts import detect, roi_view, qualifies, THRESHOLD  # noqa: E402
from collector.strategy import build_trade, settle_trade, fee_dollars, STRATEGY_INDEX  # noqa: E402


def _points(walk, base=1795000000):
    return [{"ts": base + i * 60, "t": f"t{i}", "mid": p, "last": p, "bid": round(p - .01, 2),
             "ask": round(p + .01, 2)} for i, p in enumerate(walk)]


def test_window_compares_against_n_snapshots_back():
    """window=2 compares each price with the one two snapshots earlier."""
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    pts = _points([0.30, 0.35, 0.45, 0.50])
    # i=2 compares pts[0]=0.30 -> pts[2]=0.45 (+0.15): fires.
    # i=3 compares pts[1]=0.35 -> pts[3]=0.50 (+0.15): suppressed until re-arm.
    a = detect(m, pts, window=2)
    assert [(x["from_price"], x["to_price"]) for x in a] == [(0.30, 0.45)], a


def test_threshold_is_ten_cents():
    assert THRESHOLD == 0.10


def test_alert_fires_at_exactly_ten_cents():
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    pts = _points([0.40, 0.45, 0.50])          # 0.40 -> 0.50 = exactly $0.10
    alerts = detect(m, pts, window=6)
    assert len(alerts) == 1, alerts
    assert abs(alerts[0]["move_dollars"] - 0.10) < 1e-12


def test_alert_does_not_fire_below_ten_cents():
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    assert detect(m, _points([0.40, 0.44, 0.49]), window=6) == []


def test_moves_in_both_directions_are_recorded():
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    # window=1 compares consecutive snapshots: down $0.12, then up $0.12.
    # (With a 6-point window both readings would compare against the first point,
    #  so the second move would be $0.00 -- see the window-autopsy test below.)
    # -$0.12 (alert, latch at 0.60), retrace to 0.61 (re-arm), then -$0.15 (alert).
    pts = _points([0.60, 0.48, 0.61, 0.46])
    alerts = detect(m, pts, window=1)
    assert [a["direction"] for a in alerts] == ["down", "down"], alerts


def test_a_sustained_move_does_not_realert_every_cycle():
    """Regression: a market that jumps once and stays put must alert once."""
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    pts = _points([0.40, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52])
    assert len(detect(m, pts, window=1)) == 1


def test_alert_latch_holds_until_the_price_retraces():
    """A down move that keeps falling must not alert on every snapshot."""
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    pts = _points([0.90, 0.78, 0.66, 0.54, 0.42])
    a = detect(m, pts, window=1)
    assert len(a) == 1 and a[0]["direction"] == "down", a


def test_alert_rearms_after_a_retrace():
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    # jump to 0.42, fall back to 0.30 (a retrace back to the pre-alert level
    # clears the latch), then jump again: two alerts, both "up".
    pts = _points([0.30, 0.42, 0.30, 0.45])
    a = detect(m, pts, window=1)
    assert [x["direction"] for x in a] == ["up", "up"], a


def test_trending_market_does_not_realert_on_every_snapshot():
    m = {"ticker": "T", "topic": "gas", "title": "t", "subtitle": "s"}
    # six straight +0.10 steps with no retrace: exactly one alert
    pts = _points([0.10, 0.20, 0.30, 0.40, 0.50, 0.60])
    assert len(detect(m, pts, window=1)) == 1


def test_roi_filter_rejects_extreme_prices():
    # A move to $0.02 gives a huge ROI number but sits outside the $0.10-$0.90 band.
    a = {"direction": "up", "to_price": 0.02}
    assert qualifies(roi_view(a)) is False
    # A move to $0.70 with the same reference trade passes.
    b = {"direction": "up", "to_price": 0.70}
    b = roi_view(b)
    assert b["model"]["side"] == "no"
    assert qualifies(b) is True


def test_settlement_yes_pays_one_dollar_per_contract():
    # 10 YES contracts at $0.44, taker fee = ceil_to_cent(0.07*10*0.44*0.56) = $0.18
    fee = fee_dollars(0.44, 10)
    assert fee == 0.18, fee
    trade = {"entry": {"side": "yes", "contracts": 10, "entry_price": 0.44, "fee_dollars": fee}}
    out = settle_trade(trade, "yes", "1.0000", "2026-01-01T00:00:00Z")
    # payout 10.00 - cost 4.40 - fee 0.18 = 5.42
    assert out["realized_pnl_dollars"] == 5.42, out["realized_pnl_dollars"]
    assert out["status"] == "settled"


def test_settlement_no_pays_nothing():
    fee = fee_dollars(0.44, 10)
    trade = {"entry": {"side": "yes", "contracts": 10, "entry_price": 0.44, "fee_dollars": fee}}
    out = settle_trade(trade, "no", "0.0000", "2026-01-01T00:00:00Z")
    # payout 0.00 - cost 4.40 - fee 0.18 = -4.58
    assert out["realized_pnl_dollars"] == -4.58, out["realized_pnl_dollars"]


def test_no_side_contract_from_implied_price():
    # Buying NO at $0.30 and a 'no' result pays $1.00 per contract.
    trade = {"entry": {"side": "no", "contracts": 10, "entry_price": 0.30,
                       "fee_dollars": fee_dollars(0.30, 10)}}
    out = settle_trade(trade, "no", "0.0000", "2026-01-01T00:00:00Z")
    # 10.00 - 3.00 - 0.15 = 6.85
    assert out["realized_pnl_dollars"] == 6.85, out["realized_pnl_dollars"]


def test_momentum_strategy_buys_direction_of_move():
    s = STRATEGY_INDEX["S1_MOMENTUM"]
    m = {"ticker": "T", "topic": "crypto", "title": "t", "subtitle": "s"}
    ob = {"best_yes_bid": 0.54, "best_yes_ask": 0.56, "contracts_bid": 500, "contracts_ask": 500,
          "spread_dollars": 0.02}
    pts = _points([0.40, 0.42, 0.45, 0.48, 0.50, 0.52])
    trade = build_trade(s, m, ob, pts, "test")
    assert trade and trade["entry"]["side"] == "yes" and trade["entry"]["entry_price"] == 0.56
    down = build_trade(STRATEGY_INDEX["S2_MEAN_REVERT"], m, ob, pts, "test")
    assert down["entry"]["side"] == "no"


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except AssertionError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}")
    raise SystemExit(1 if failures else 0)
