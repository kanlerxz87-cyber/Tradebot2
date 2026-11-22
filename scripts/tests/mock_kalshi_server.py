#!/usr/bin/env python3
"""Offline mock of the documented Kalshi read endpoints, used to test the collector.

Shapes follow the official docs (events/get-events, market/get-series-list,
market/get-market-orderbook). Prices come from MOCK_FILE so a test can move them
between two collector runs. Usage:  python3 mock_kalshi_server.py PORT MOCK_FILE
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

PORT = int(sys.argv[1])
MOCK_FILE = sys.argv[2]

SERIES = {
    "KXPGAGOLFERSCORE": {"category": "Sports", "tags": ["Golf"], "title": "Golf Round Strokes", "volume_fp": "900.00"},
    "KXBTC": {"category": "Crypto", "tags": ["BTC"], "title": "Bitcoin", "volume_fp": "5000.00"},
}
SERIES_BY_FILTER = {
    ("category", "Sports", "tags", "Golf"): ["KXPGAGOLFERSCORE"],
    ("category", "Crypto"): ["KXBTC"],
    ("category", "Elections"): [],
    ("category", "Entertainment"): [],
    ("category", "Commodities", "tags", "Oil & Gas"): [],
}


def load():
    with open(MOCK_FILE) as f:
        return json.load(f)


def market_json(ticker, d):
    return {
        "ticker": ticker, "event_ticker": ticker.rsplit("-", 1)[0], "status": "active",
        "title": f"Mock market {ticker}", "yes_sub_title": "Yes side",
        "close_time": "2099-01-01T00:00:00Z",
        "last_price_dollars": f"{d['last']:.4f}", "yes_bid_dollars": f"{d['bid']:.4f}",
        "yes_ask_dollars": f"{d['ask']:.4f}", "no_bid_dollars": f"{1 - d['ask']:.4f}",
        "no_ask_dollars": f"{1 - d['bid']:.4f}", "yes_bid_size_fp": "120.00",
        "yes_ask_size_fp": f"{d.get('ask_size', 200):.2f}", "volume_fp": "4000.00",
        "volume_24h_fp": f"{d.get('vol24', 500):.2f}", "open_interest_fp": "900.00",
        "result": d.get("result", ""), "settlement_value_dollars": d.get("settle", None),
    }


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        path = u.path.replace("/trade-api/v2", "")
        mk = load()
        if path == "/series":
            key = tuple(x for k in ("category", "tags") if k in q for x in (k, q[k]))
            tickers = SERIES_BY_FILTER.get(key, [])
            out = [{"ticker": t, **{k: v for k, v in SERIES[t].items() if k != "volume_fp"},
                    "volume_fp": SERIES[t]["volume_fp"]} for t in tickers]
            return self._send(200, {"series": out, "cursor": ""})
        if path == "/events":
            st = q.get("series_ticker")
            if st == "KXPGAGOLFERSCORE":
                markets = [market_json(t, d) for t, d in mk["golf"].items()]
                ev = {"event_ticker": "KXPGAGOLF-26", "series_ticker": st, "title": "Golf event",
                      "category": "Sports", "settlement_sources": [{"name": "PGA TOUR", "url": "https://www.pgatour.com/"}],
                      "markets": markets}
                return self._send(200, {"events": [ev], "cursor": ""})
            if st == "KXBTC":
                markets = [market_json(t, d) for t, d in mk["btc"].items()]
                ev = {"event_ticker": "KXBTC-26", "series_ticker": st, "title": "BTC event",
                      "category": "Crypto", "settlement_sources": [{"name": "CF Benchmarks", "url": "https://www.cfbenchmarks.com/"}],
                      "markets": markets}
                return self._send(200, {"events": [ev], "cursor": ""})
            return self._send(200, {"events": [], "cursor": ""})
        if path.startswith("/markets/") and path.endswith("/orderbook"):
            t = path[len("/markets/"):-len("/orderbook")]
            return self._send(200, {"orderbook_fp": {
                "yes_dollars": [[f"{mk['all'][t]['bid']:.4f}", "120.00"], [f"{mk['all'][t]['bid']-0.01:.4f}", "300.00"]],
                "no_dollars": [[f"{1-mk['all'][t]['ask']:.4f}", "80.00"]]}})
        if path.startswith("/markets/"):
            t = path[len("/markets/"):]
            if t in mk["all"]:
                return self._send(200, {"market": market_json(t, mk["all"][t])})
            return self._send(404, {"code": "not_found", "message": "no", "details": ""})
        return self._send(404, {"code": "not_found", "message": "no", "details": ""})


HTTPServer(("127.0.0.1", PORT), H).serve_forever()
