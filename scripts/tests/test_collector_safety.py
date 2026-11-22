"""Regression tests for demo isolation and market lifecycle handling (offline)."""
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
spec = importlib.util.spec_from_file_location("collector", ROOT / "scripts/kalshi_collector.py")
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.state_path = str(Path(self.tmp.name) / "state.json")
        self.out = str(Path(self.tmp.name) / "output")
        self.patches = [patch.object(collector, "STATE_PATH", self.state_path),
                        patch.object(collector, "OUT_DIR", self.out),
                        patch.object(collector, "BASE", "https://demo.example/trade-api/v2"),
                        patch.object(collector, "TOPICS", {"crypto": {"label": "Crypto", "params": {}, "note": "test"}}),
                        patch.object(collector, "discover_series", return_value=[{"ticker": "S"}])]
        for p in self.patches:
            p.start()
            self.addCleanup(p.stop)

    def run_collection(self, children, lookups):
        event = {"event_ticker": "E", "series_ticker": "S", "title": "Event", "markets": children}
        def get(path, params=None):
            if path.endswith("/orderbook"):
                return {"orderbook_fp": {}}, collector.BASE + path
            return {"market": lookups[path.rsplit('/', 1)[-1]]}, collector.BASE + path
        with patch.object(collector, "fetch_open_events", return_value=[event]), patch.object(collector, "api_get", side_effect=get):
            self.assertEqual(collector.main(), 0)
        return json.loads(Path(self.state_path).read_text())

    def test_default_is_demo_even_without_environment(self):
        env = os.environ.copy()
        env.pop("KALSHI_BASE", None)
        output = subprocess.check_output([sys.executable, "-c", "import sys; sys.path.insert(0, 'scripts'); import kalshi_collector; print(kalshi_collector.BASE)"], cwd=ROOT, env=env, text=True)
        self.assertEqual(output.strip(), "https://external-api.demo.kalshi.co/trade-api/v2")

    def test_legacy_or_other_environment_state_is_not_overwritten(self):
        for payload in ({"history": {}}, {"api_base": "https://production.example"}):
            text = json.dumps(payload)
            Path(self.state_path).write_text(text)
            with self.assertRaises(ValueError):
                collector.main()
            self.assertEqual(Path(self.state_path).read_text(), text)

    def test_closed_child_is_not_live_and_only_final_result_settles(self):
        market = {"ticker": "M", "status": "active", "title": "Market", "last_price_dollars": "0.40"}
        self.run_collection([market], {})
        state = self.run_collection([{**market, "status": "determined"}], {"M": {"status": "determined", "result": "yes"}})
        self.assertFalse(state["markets"]["M"]["resolved"])
        self.assertEqual(json.loads((Path(self.out) / "markets.json").read_text())["markets"], [])
        state = self.run_collection([], {"M": {"status": "finalized", "result": "no", "settlement_value_dollars": "0.0000"}})
        self.assertTrue(state["markets"]["M"]["resolved"])
        self.assertEqual(state["markets"]["M"]["result"], "no")

    def test_resolution_checks_rotate_past_pending_backlog(self):
        state = collector.load_state()
        state["markets"] = {"A": {"resolved": False, "api_status_checked_at": "2026-01-01T00:00:00Z"},
                            "B": {"resolved": False}}
        Path(self.state_path).write_text(json.dumps(state))
        with patch.object(collector, "MAX_RESOLUTION_CHECKS", 1):
            state = self.run_collection([], {"B": {"status": "finalized", "result": "yes"}})
        self.assertTrue(state["markets"]["B"]["resolved"])
        self.assertFalse(state["markets"]["A"]["resolved"])


if __name__ == "__main__":
    unittest.main()
