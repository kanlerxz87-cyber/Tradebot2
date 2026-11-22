import pytest

from app.paper import PaperBroker, analytics
from app.strategies import Opportunity


def opp(ticker="TEST-1", side="yes", entry=0.50, strategy="momentum", topic="crypto", score=70):
    return Opportunity(
        ticker=ticker,
        topic=topic,
        title="Test",
        strategy=strategy,
        side=side,
        entry_price=entry,
        model_prob=0.60,
        market_prob=0.50,
        edge=0.10,
        est_roi=0.20,
        score=score,
        liquidity={"yes_depth": 100, "no_depth": 100},
        target_price=entry + 0.15,
        stop_price=entry - 0.10,
    )


def test_open_respects_cash_and_depth():
    broker = PaperBroker(starting_cash=1000, strategies=["momentum"])
    pos = broker.open(opp(), ts=1)
    assert pos is not None
    assert 0 < pos.contracts <= 50  # depth 100 * 0.25
    assert broker.account("momentum").cash < 1000


def test_close_records_profit_and_cash():
    broker = PaperBroker(starting_cash=1000, strategies=["momentum"])
    pos = broker.open(opp(), ts=1)
    assert pos
    cash_after_open = broker.account("momentum").cash
    closed = broker.close("momentum", pos.id, 0.70, "take profit", ts=2)
    assert closed is not None
    assert closed.pnl() > 0
    assert broker.account("momentum").cash > cash_after_open


def test_settlement_yes_pays_one_dollar():
    broker = PaperBroker(starting_cash=1000, strategies=["momentum"])
    pos = broker.open(opp(side="yes", entry=0.50), ts=1)
    assert pos
    settled = broker.settle("momentum", pos.id, "yes", ts=2)
    assert settled is not None
    assert settled.pnl() == pytest.approx(pos.contracts * 1.0 - pos.cost)


def test_settlement_no_pays_zero_for_yes_holder():
    broker = PaperBroker(starting_cash=1000, strategies=["momentum"])
    pos = broker.open(opp(side="yes", entry=0.50), ts=1)
    assert pos
    settled = broker.settle("momentum", pos.id, "no", ts=2)
    assert settled is not None
    assert settled.pnl() == pytest.approx(-pos.cost)


def test_no_position_wins_when_result_no():
    broker = PaperBroker(starting_cash=1000, strategies=["momentum"])
    pos = broker.open(opp(side="no", entry=0.40), ts=1)
    assert pos
    settled = broker.settle("momentum", pos.id, "no", ts=2)
    assert settled is not None
    assert settled.pnl() > 0


def test_mark_take_profit():
    broker = PaperBroker(starting_cash=1000, strategies=["momentum"])
    pos = broker.open(opp(entry=0.50), ts=1)
    assert pos
    closed = broker.mark({"TEST-1": 0.70}, ts=2, take_profit=0.15, stop_loss=0.10)
    assert len(closed) == 1
    assert closed[0].close_reason == "take profit"


def test_analytics_groups_and_win_rate():
    broker = PaperBroker(starting_cash=1000, strategies=["momentum", "mean_reversion"])
    p1 = broker.open(opp(ticker="A", entry=0.50, strategy="momentum"), ts=1)
    p2 = broker.open(opp(ticker="B", entry=0.50, strategy="mean_reversion", topic="golf"), ts=1)
    assert p1 and p2
    broker.close("momentum", p1.id, 0.70, "take profit", ts=2)
    broker.close("mean_reversion", p2.id, 0.30, "stop loss", ts=2)
    result = analytics(broker)
    assert result["closed_trades"] == 2
    assert result["wins"] == 1
    assert result["win_rate"] == pytest.approx(0.5)
    assert {row["key"] for row in result["by_strategy"]} == {"momentum", "mean_reversion"}
    assert {row["key"] for row in result["by_topic"]} == {"crypto", "golf"}
    assert result["max_drawdown_pct"] >= 0
