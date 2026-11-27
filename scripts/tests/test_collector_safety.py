"""Offline regression tests for demo-state isolation and settlement handling."""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("collector", ROOT / "scripts/kalshi_collector.py")
collector = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(collector)


class CollectorSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.state_path = str(Path(self.tmp.name) / "state.json")
        self.out_dir = str(Path(self.tmp.name) / "site-data")
        self.base = "https://external-api.demo.kalshi.co/trade-api/v2"
        self.patches = [
            patch.object(collector, "STATE_PATH", self.state_path),
            patch.object(collector, "OUT_DIR", self.out_dir),
            patch.object(collector, "BASE", self.base),
            patch.object(collector, "TOPICS", {
                "crypto": {"label": "Crypto", "params": {}, "note": "test topic"},
            }),
            patch.object(collector, "ORDERBOOK_TOP_N", 0),
            patch.object(collector, "CANDLE_MARKETS", 0),
            patch.object(collector, "TRADE_MARKETS", 0),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def run_collection(self, children=None, api_responses=None, *, max_resolution_checks=None):
        event_rows = []
        if children:
            event_rows.append({
                "event_ticker": "EVT-TEST",
                "series_ticker": "SER-TEST",
                "title": "Test event",
                "settlement_sources": [],
                "markets": children,
            })
        responses = api_responses or {}
        calls = []

        def fake_api_get(path, params=None):
            calls.append(path)
            ticker = path.rsplit("/", 1)[-1]
            if ticker not in responses:
                raise AssertionError(f"unexpected API request: {path}")
            return {"market": responses[ticker]}, f"{self.base}{path}"

        config_patch = []
        if max_resolution_checks is not None:
            config_patch.append(patch.object(collector, "MAX_RESOLUTION_CHECKS", max_resolution_checks))
        for item in config_patch:
            item.start()
            self.addCleanup(item.stop)
        with patch.object(collector, "discover_series", return_value=[{"ticker": "SER-TEST"}]), \
                patch.object(collector, "fetch_open_events", return_value=event_rows), \
                patch.object(collector, "api_get", side_effect=fake_api_get):
            exit_code = collector.main()
        self.assertEqual(exit_code, 0)
        return calls

    def read_state(self):
        return json.loads(Path(self.state_path).read_text(encoding="utf-8"))

    def test_default_collector_uses_demo_host_and_separate_state_path(self):
        env = os.environ.copy()
        env.pop("KALSHI_BASE", None)
        env.pop("STATE_PATH", None)
        output = subprocess.check_output(
            [sys.executable, "-c", "import sys; sys.path.insert(0, 'scripts'); "
             "import kalshi_collector as c; print(c.BASE); print(c.STATE_PATH)"],
            cwd=ROOT,
            env=env,
            text=True,
        ).splitlines()
        self.assertEqual(output[0], "https://external-api.demo.kalshi.co/trade-api/v2")
        self.assertEqual(output[1], "state/demo-state.json")
        self.assertEqual(
            collector._default_state_path("https://demo-api.kalshi.co/trade-api/v2"),
            "state/demo-state.json",
        )
        self.assertEqual(
            collector._default_state_path("https://api.example.test/trade-api/v2"),
            "state/custom-state.json",
        )

    def test_state_without_matching_api_base_is_rejected_without_modification(self):
        legacy_or_mismatched = [
            {"history": {}, "markets": {}},
            {"api_base": "https://other.example/trade-api/v2", "history": {}, "markets": {}},
        ]
        for payload in legacy_or_mismatched:
            with self.subTest(payload=payload):
                before = json.dumps(payload)
                Path(self.state_path).write_text(before, encoding="utf-8")
                with self.assertRaisesRegex(ValueError, "matching API base"):
                    collector.load_state()
                self.assertEqual(Path(self.state_path).read_text(encoding="utf-8"), before)

        Path(self.state_path).unlink()
        fresh = collector.load_state()
        self.assertEqual(fresh["api_base"], self.base)

    def test_only_active_children_are_collected(self):
        self.run_collection(children=[
            {"ticker": "ACTIVE-MARKET", "status": "active", "title": "Open child",
             "last_price_dollars": "0.40", "yes_bid_dollars": "0.39", "yes_ask_dollars": "0.41"},
            {"ticker": "DETERMINED-MARKET", "status": "determined", "title": "Pending settlement"},
            {"ticker": "FINAL-MARKET", "status": "finalized", "title": "Already settled"},
            {"ticker": "PAUSED-MARKET", "status": "inactive", "title": "Paused child"},
        ])
        state = self.read_state()
        markets = json.loads((Path(self.out_dir) / "markets.json").read_text(encoding="utf-8"))["markets"]
        self.assertEqual([m["ticker"] for m in markets], ["ACTIVE-MARKET"])
        self.assertEqual(set(state["markets"]), {"ACTIVE-MARKET"})
        self.assertEqual(state["markets"]["ACTIVE-MARKET"]["status"], "active")

    def test_determined_is_not_settled_and_final_yes_no_uses_official_time(self):
        child = {"ticker": "TEST-MARKET", "status": "active", "title": "Test contract",
                 "last_price_dollars": "0.40", "yes_bid_dollars": "0.39", "yes_ask_dollars": "0.41"}
        self.run_collection(children=[child])
        state = self.read_state()
        state["trades"] = [{
            "id": "paper-1", "opened_at": "2026-11-27T00:00:00Z", "ticker": "TEST-MARKET",
            "title": "Test contract", "topic": "crypto", "strategy": "follow_rise",
            "alert_direction": "up", "side": "YES", "qty": 1, "entry": 0.40,
            "target": 0.90, "stop": 0.10, "status": "open", "exit": None,
            "exit_at": None, "exit_reason": None, "pnl": None,
        }]
        Path(self.state_path).write_text(json.dumps(state), encoding="utf-8")

        self.run_collection(api_responses={"TEST-MARKET": {
            "status": "determined", "result": "yes", "settlement_ts": None,
        }})
        state = self.read_state()
        self.assertFalse(state["markets"]["TEST-MARKET"]["resolved"])
        self.assertEqual(state["markets"]["TEST-MARKET"]["status"], "determined")
        self.assertEqual(state["trades"][0]["status"], "open")

        settlement_ts = "2026-11-26T23:59:59Z"
        self.run_collection(api_responses={"TEST-MARKET": {
            "status": "finalized", "result": "no", "settlement_ts": settlement_ts,
            "settlement_value_dollars": "0.0000",
        }})
        state = self.read_state()
        resolved = state["markets"]["TEST-MARKET"]
        trade = state["trades"][0]
        rows = json.loads((Path(self.out_dir) / "resolved.json").read_text(encoding="utf-8"))["resolved"]
        self.assertTrue(resolved["resolved"])
        self.assertEqual(resolved["result"], "no")
        self.assertEqual(resolved["resolved_at"], settlement_ts)
        self.assertEqual(resolved["last_observed_while_active"], 0.4)
        self.assertEqual(resolved["resolution_observed_at"], resolved["api_status_checked_at"])
        self.assertEqual(trade["status"], "closed")
        self.assertEqual(trade["exit"], 0.0)
        self.assertEqual(trade["exit_at"], settlement_ts)
        self.assertIsNotNone(trade["exit_observed_at"])
        self.assertEqual(rows[0]["result"], "no")
        self.assertEqual(rows[0]["settlement_ts"], settlement_ts)
        self.assertTrue(rows[0]["source_url"].startswith(self.base + "/markets/"))

    def test_resolution_checks_rotate_after_failures_or_large_backlog(self):
        state = collector.load_state()
        state["markets"] = {
            "OLDER-CHECKED": {"ticker": "OLDER-CHECKED", "resolved": False,
                              "api_status_checked_at": "2026-01-01T00:00:00Z"},
            "NEVER-CHECKED": {"ticker": "NEVER-CHECKED", "resolved": False},
        }
        Path(self.state_path).write_text(json.dumps(state), encoding="utf-8")
        calls = self.run_collection(
            api_responses={"NEVER-CHECKED": {"status": "determined", "result": "yes"}},
            max_resolution_checks=1,
        )
        saved = self.read_state()
        self.assertEqual(calls, ["/markets/NEVER-CHECKED"])
        self.assertEqual(saved["markets"]["OLDER-CHECKED"]["api_status_checked_at"], "2026-01-01T00:00:00Z")
        self.assertNotEqual(saved["markets"]["NEVER-CHECKED"]["api_status_checked_at"], None)


if __name__ == "__main__":
    unittest.main()
