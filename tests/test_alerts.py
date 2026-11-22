import pytest

from app.alerts import SwingDetector, quote_price, swings_from_candles


def market(bid, ask, last=None, ticker="TEST-1"):
    return {
        "ticker": ticker,
        "yes_bid_dollars": f"{bid:.4f}",
        "yes_ask_dollars": f"{ask:.4f}",
        "last_price_dollars": f"{last:.4f}" if last is not None else "0.0000",
        "volume_24h_fp": "120.00",
        "open_interest_fp": "40.00",
    }


def test_mid_price_is_used():
    price, basis = quote_price(market(0.40, 0.44))
    assert basis == "mid"
    assert price == pytest.approx(0.42)


def test_last_price_fallback_when_no_two_sided_quote():
    payload = {
        "ticker": "X",
        "yes_bid_dollars": "0.0000",
        "yes_ask_dollars": "1.0000",
        "last_price_dollars": "0.31",
    }
    price, basis = quote_price(payload)
    assert basis == "last"
    assert price == pytest.approx(0.31)


def test_crossed_book_yields_no_price():
    payload = {"ticker": "X", "yes_bid_dollars": "0.60", "yes_ask_dollars": "0.50"}
    price, _ = quote_price(payload)
    assert price is None


def test_threshold_just_below_does_not_alert():
    det = SwingDetector(threshold=0.10)
    assert det.observe(market(0.40, 0.40), ts=1) is None
    assert det.observe(market(0.49, 0.49), ts=2) is None


def test_threshold_exactly_ten_cents_alerts():
    det = SwingDetector(threshold=0.10)
    det.observe(market(0.40, 0.40), ts=1)
    alert = det.observe(market(0.50, 0.50), ts=2)
    assert alert is not None
    assert alert.delta == pytest.approx(0.10)
    assert alert.direction == "up"
    assert alert.source == "poll"


def test_downturn_alerts_and_direction_is_down():
    det = SwingDetector(threshold=0.10)
    det.observe(market(0.70, 0.70), ts=1)
    alert = det.observe(market(0.55, 0.55), ts=2)
    assert alert is not None
    assert alert.delta == pytest.approx(-0.15)
    assert alert.direction == "down"


def test_no_alert_without_previous_observation():
    det = SwingDetector(threshold=0.10)
    assert det.observe(market(0.40, 0.60), ts=1) is None


def test_duplicate_poll_same_timestamp_is_deduplicated():
    det = SwingDetector(threshold=0.10)
    det.observe(market(0.40, 0.40), ts=1)
    assert det.observe(market(0.55, 0.55), ts=2) is not None
    assert det.observe(market(0.55, 0.55), ts=2) is None


def test_candle_swings():
    candles = [
        {"end_period_ts": 60, "price": {"close_dollars": "0.40"}},
        {"end_period_ts": 120, "price": {"close_dollars": "0.52"}},
        {"end_period_ts": 180, "price": {"close_dollars": "0.53"}},
        {"end_period_ts": 240, "price": {"close_dollars": "0.40"}},
    ]
    alerts = swings_from_candles(
        candles, ticker="T", topic="crypto", title="T", threshold=0.10
    )
    assert len(alerts) == 2
    assert alerts[0].ts == 240
    assert alerts[0].delta == pytest.approx(-0.13)
    assert all(a.source == "candle" for a in alerts)
