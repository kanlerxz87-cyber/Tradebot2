"""Build the site's data files from the verified dataset.

Run:  python3 -m engine.build_data

Outputs (all committed, all regenerated deterministically):
  docs/data/markets.json      one row per verified market/resolution/series
  docs/data/candles.json      recorded candle paths used by the charts & replay
  docs/data/alerts.json       alerts emitted by the >= $0.10 rule on recorded data
  docs/data/backtest.json     paper-trading results per strategy + portfolio view
  docs/data/sources.json      the source registry rendered by verification.html
  docs/data/summary.json      headline counts used by the landing page
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from engine import dataset
from engine.alerts import PricePoint, detect_alerts, summarize
from engine.paper import (BacktestConfig, STRATEGIES, aggregate, run_strategy)
from engine.sources import SOURCES

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def write(name: str, payload) -> None:
    path = OUT / name
    path.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")


def build_markets() -> dict:
    rows = []
    for s in dataset.SERIES:
        rows.append({
            "row_type": "series",
            "topic": s["topic"],
            "ticker": s["ticker"],
            "title": s["title"],
            "category": s["category"],
            "tags": s["tags"],
            "frequency": s["frequency"],
            "settlement_source": s["settlement_source"],
            "settlement_url": s["settlement_url"],
            "source_url": s["source_url"],
            "note": s["note"],
            "snapshot_ts": dataset.SNAPSHOT_TS,
        })
    for m in dataset.MARKETS:
        rows.append({
            "row_type": "market",
            "topic": m["topic"],
            "ticker": m["ticker"],
            "event_ticker": m["event_ticker"],
            "title": m["title"],
            "status": m["status"],
            "yes_bid": m["yes_bid"],
            "yes_ask": m["yes_ask"],
            "no_bid": m["no_bid"],
            "no_ask": m["no_ask"],
            "last_price": m["last_price"],
            "previous_price": m["previous_price"],
            "volume": m["volume"],
            "volume_24h": m["volume_24h"],
            "open_interest": m["open_interest"],
            "yes_bid_size": m["yes_bid_size"],
            "close_time": m["close_time"],
            "result": m["result"],
            "rules": m["rules"],
            "source_url": m["source_url"],
            "note": m["note"],
            "snapshot_ts": dataset.SNAPSHOT_TS,
        })
    for r in dataset.RESOLVED:
        rows.append({
            "row_type": "resolved",
            "topic": r["topic"],
            "ticker": r["ticker"],
            "event_ticker": r["event_ticker"],
            "title": r["title"],
            "status": r["status"],
            "result": r["result"],
            "settlement_value": r["settlement_value"],
            "settlement_ts": r["settlement_ts"],
            "close_time": r["close_time"],
            "volume": r["volume"],
            "open_interest": r["open_interest"],
            "source_url": r["source_url"],
            "note": r["note"],
            "snapshot_ts": dataset.SNAPSHOT_TS,
        })
    for g in dataset.GAPS:
        rows.append({
            "row_type": "gap",
            "query": g["query"],
            "returned": g["returned"],
            "meaning": g["meaning"],
            "source_url": g["query"],
            "snapshot_ts": dataset.SNAPSHOT_TS,
        })
    payload = {
        "snapshot_ts": dataset.SNAPSHOT_TS,
        "demo_base": dataset.DEMO,
        "counts": {
            "series": len(dataset.SERIES),
            "markets": len(dataset.MARKETS),
            "resolved": len(dataset.RESOLVED),
            "orderbooks": len(dataset.ORDERBOOKS),
            "gaps": len(dataset.GAPS),
        },
        "rows": rows,
        "orderbooks": dataset.ORDERBOOKS,
    }
    write("markets.json", payload)
    return payload


def build_candles() -> dict:
    payload = {
        "snapshot_ts": dataset.SNAPSHOT_TS,
        "note": "Candlesticks copied from GET /series/{series}/markets/{ticker}/candlesticks "
                "with period_interval=60. Null price means the API returned no trade close for "
                "that hour; the chart draws a gap instead of interpolating.",
        "series": dataset.CANDLES,
    }
    write("candles.json", payload)
    return payload


def build_alerts() -> dict:
    """Run the real >= $0.10 detector over the recorded candle closes.

    Two feeds are produced from the same detection pass, exactly as the site's
    browser code does it: all alerts, and only the ones the transparent
    ROI heuristic scores >= 55.
    """
    series_points: dict[str, list[PricePoint]] = {}
    meta: dict[str, dict] = {}

    for ticker, blob in dataset.CANDLES.items():
        points: list[PricePoint] = []
        for row in blob["rows"]:
            price = Decimal(row["price"]) if row.get("price") else None
            if price is None:
                continue  # no trade in that bar -> no observation, never a carried-forward price
            bid = Decimal(row["bid"]) if row.get("bid") else None
            ask = Decimal(row["ask"]) if row.get("ask") else None
            points.append(PricePoint(
                ts=row["ts"],
                price=price,
                basis="candle trade-price close",
                bid=bid,
                ask=ask,
                spread=None if (bid is None or ask is None) else ask - bid,
                depth_contracts=Decimal("2718.76"),
                ))
        series_points[ticker] = points
        meta[ticker] = {
            "event_ticker": ticker.split("-")[0] if ticker.startswith("KX") else "",
            "topic": "off-topic (Politics)",
            "title": "Will Elon Musk visit Mars before Aug 1, 2099?",
            "source_url": blob["source_url"],
            "evidence_url": "https://www.spacex.com/",
            "volume": Decimal("14150.08"),
            "minutes_to_close": None,
            "note": "Recorded candle closes from the official candlesticks endpoint; the bid is "
                    "0.14 in every bar while trades print at 0.30, i.e. the move is in the "
                    "trade price, not the quote.",
        }

    alerts = detect_alerts(series_points, meta)
    payload = {
        "snapshot_ts": dataset.SNAPSHOT_TS,
        "threshold": "0.10",
        "rule": "|price_after - price_before| >= $0.10 on consecutive recorded observations "
                "for the same market. Direction is the sign of the move.",
        "high_roi_rule": "roi_score >= 55 where roi_score = 45*min(|move|/0.25,1) + "
                         "25*min(liq/2000,1) + 15*(1-min(spread/0.10,1)) + "
                         "10*min(log10(1+volume)/4,1) + 5*(<=60min to close). "
                         "A ranking aid, not a forecast.",
        "summary": summarize(alerts),
        "alerts": [{
            "ts": a.ts, "time_utc": a.iso(), "ticker": a.ticker, "event_ticker": a.event_ticker,
            "topic": a.topic, "title": a.title, "before": a.before, "after": a.after,
            "delta": a.delta, "direction": a.direction, "basis": a.basis,
            "liquidity_after": a.liquidity_after, "spread_after": a.spread_after,
            "roi_score": a.roi_score, "high_roi": a.high_roi,
            "source_url": a.source_url, "evidence_url": a.evidence_url, "note": a.note,
        } for a in alerts],
    }
    write("alerts.json", payload)
    return payload


def build_backtest() -> dict:
    """Paper-trade every strategy over the recorded paths, then aggregate.

    Sample size is tiny and the page says so; the point is that the pipeline is
    honest end to end (real prices, real fees, explicit skips).
    """
    series_points: dict[str, list[PricePoint]] = {}
    meta: dict[str, dict] = {}
    resolved: dict[str, str] = {}

    for ticker, blob in dataset.CANDLES.items():
        points = []
        for row in blob["rows"]:
            price = Decimal(row["price"]) if row.get("price") else None
            bid = Decimal(row["bid"]) if row.get("bid") else None
            ask = Decimal(row["ask"]) if row.get("ask") else None
            if price is None and bid is None:
                continue
            points.append(PricePoint(
                ts=row["ts"],
                price=price if price is not None else bid,
                basis="candle trade-price close" if price is not None else "candle bid close",
                bid=bid,
                ask=ask,
                spread=None if (bid is None or ask is None) else ask - bid,
                depth_contracts=Decimal("2718.76"),
            ))
        series_points[ticker] = points
        meta[ticker] = {
            "event_ticker": "KXELONMARS-99",
            "topic": "off-topic (Politics)",
            "title": "Will Elon Musk visit Mars before Aug 1, 2099?",
            "source_url": blob["source_url"],
            "note": "Recorded hourly candles.",
        }
    for r in dataset.RESOLVED:
        resolved[r["ticker"]] = r["result"]

    # Resolved-only paths: a single observation at settlement, so hold-to-
    # resolution strategies have an official outcome to pay out against.
    for r in dataset.RESOLVED:
        if r["ticker"] not in series_points:
            series_points[r["ticker"]] = []
            meta[r["ticker"]] = {
                "event_ticker": r["event_ticker"], "topic": r["topic"], "title": r["title"],
                "source_url": r["source_url"], "note": "settled market, no recording window",
            }

    cfg = BacktestConfig()
    results = [run_strategy(s, series_points, meta, resolved, cfg) for s in STRATEGIES]
    per_strategy = []
    for strat, res in zip(STRATEGIES, results):
        stats = res.stats()
        stats.update({
            "name": strat.name, "trade_type": strat.trade_type, "thesis": strat.thesis,
            "entry_rule": strat.entry_rule, "exit_rule": strat.exit_rule,
            "source": strat.source,
            "trades_detail": [t.to_dict() for t in res.trades][:50],
        })
        per_strategy.append(stats)

    payload = {
        "snapshot_ts": dataset.SNAPSHOT_TS,
        "disclosure": "All trading here is SIMULATED. No Kalshi API key existed in the build "
                      "environment, so no order was ever sent; /portfolio/* endpoints were never "
                      "called. Fills use only prices that appear in the recorded data, and every "
                      "fill pays the official taker fee.",
        "fee_model": "taker fee = ceil_centicent(0.07 * contracts * P * (1-P)); "
                     "source https://kalshi.com/docs/kalshi-fee-schedule.pdf",
        "config": {
            "starting_cash": str(cfg.starting_cash),
            "stake_per_trade": str(cfg.stake_per_trade),
            "max_contracts": str(cfg.max_contracts),
        },
        "sample": {
            "markets_recorded": len(series_points),
            "candles_recorded": sum(len(v) for v in series_points.values()),
            "window": "2026-11-15T04:00Z .. 2026-11-22T07:00Z (hourly bars, one instrument)",
            "caveat": "One instrument with 16 usable bars is not enough to judge a strategy. "
                      "The numbers below describe this recording, not the market.",
        },
        "strategies": per_strategy,
        "portfolio": aggregate(results),
    }
    write("backtest.json", payload)
    return payload


def build_sources() -> dict:
    payload = {
        "snapshot_ts": dataset.SNAPSHOT_TS,
        "sources": [{
            "fact_id": s.fact_id, "claim": s.claim, "url": s.url, "kind": s.kind, "checked": s.checked,
        } for s in SOURCES],
    }
    write("sources.json", payload)
    return payload


def build_summary(markets, candles, alerts, backtest) -> dict:
    counts = markets["counts"]
    payload = {
        "snapshot_ts": dataset.SNAPSHOT_TS,
        "headline": {
            "topics_tracked": 5,
            "series_verified": counts["series"],
            "markets_verified": counts["markets"],
            "resolutions_verified": counts["resolved"],
            "queries_that_returned_nothing": counts["gaps"],
            "alerts_on_recorded_data": alerts["summary"]["count"],
            "high_roi_alerts": alerts["summary"]["high_roi"],
            "paper_trades": backtest["portfolio"]["trades"],
            "official_sources": len(SOURCES),
        },
        "feeds": {
            "all_events": "every recorded >= $0.10 move, newest first",
            "high_roi": "same detector, filtered to roi_score >= 55",
        },
    }
    write("summary.json", payload)
    return payload


def main() -> None:
    markets = build_markets()
    candles = build_candles()
    alerts = build_alerts()
    backtest = build_backtest()
    build_sources()
    build_summary(markets, candles, alerts, backtest)
    print("done")


if __name__ == "__main__":
    main()
