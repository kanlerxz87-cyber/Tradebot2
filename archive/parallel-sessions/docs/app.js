const DEMO_API = "https://external-api.demo.kalshi.co/trade-api/v2";
const TOPICS = ["Gas Prices", "Elections", "Culture", "Crypto", "Golf"];

function classifyTopic(ev, mkt) {
  const text = `${ev?.category || ""} ${ev?.title || ""} ${mkt?.title || ""} ${mkt?.ticker || ""}`.toLowerCase();
  if (text.includes("gas") || text.includes("fuel") || text.includes("oil") || text.includes("energy")) return "Gas Prices";
  if (text.includes("election") || text.includes("nato") || text.includes("vote") || text.includes("president") || text.includes("senate")) return "Elections";
  if (text.includes("btc") || text.includes("bitcoin") || text.includes("eth") || text.includes("crypto") || text.includes("sol")) return "Crypto";
  if (text.includes("golf") || text.includes("pga") || text.includes("masters")) return "Golf";
  if (text.includes("culture") || text.includes("elon") || text.includes("mars") || text.includes("oscar") || text.includes("grammy") || text.includes("movie")) return "Culture";
  return null;
}

function getPortfolio() {
  const raw = localStorage.getItem("kalshi_demo_portfolio");
  if (raw) return JSON.parse(raw);
  const init = {
    cash: 10000.0,
    positions: [],
    history: [
      {
        id: "SIM-1001",
        time: new Date().toISOString(),
        ticker: "KXELONMARS-99",
        title: "Will Elon Musk visit Mars before Aug 1, 2099?",
        side: "YES",
        qty: 50,
        entry: 0.14,
        current: 0.30,
        strategy: "Momentum >= $0.10 Swing",
        status: "OPEN",
        pnl: 8.00
      }
    ]
  };
  localStorage.setItem("kalshi_demo_portfolio", JSON.stringify(init));
  return init;
}

function savePortfolio(p) {
  localStorage.setItem("kalshi_demo_portfolio", JSON.stringify(p));
}

function executeSimulatedTrade(market, side, qty, strategy) {
  const p = getPortfolio();
  const price = side === "YES" ? (market.yes_ask || market.last_price || 0.50) : (1 - (market.yes_bid || market.last_price || 0.50));
  const cost = Number((price * qty).toFixed(2));
  if (cost > p.cash) {
    alert("Insufficient simulated demo cash.");
    return false;
  }
  p.cash = Number((p.cash - cost).toFixed(2));
  p.history.unshift({
    id: "SIM-" + Math.floor(1000 + Math.random() * 9000),
    time: new Date().toISOString(),
    ticker: market.ticker,
    title: market.title,
    side,
    qty,
    entry: Number(price.toFixed(2)),
    current: Number((market.last_price || price).toFixed(2)),
    strategy,
    status: "OPEN",
    pnl: 0
  });
  savePortfolio(p);
  return true;
}

async function fetchMarkets() {
  try {
    const res = await fetch(`${DEMO_API}/events?status=open&limit=40&with_nested_markets=true`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const out = [];
    for (const ev of (data.events || [])) {
      for (const m of (ev.markets || [])) {
        const topic = classifyTopic(ev, m);
        if (!topic) continue;
        const last = parseFloat(m.last_price_dollars || "0");
        const prev = parseFloat(m.previous_price_dollars || "0");
        out.push({
          topic,
          event_ticker: ev.event_ticker,
          ticker: m.ticker,
          title: m.title,
          yes_bid: parseFloat(m.yes_bid_dollars || "0"),
          yes_ask: parseFloat(m.yes_ask_dollars || "0"),
          last_price: last,
          previous_price: prev,
          yes_bid_size: parseFloat(m.yes_bid_size_fp || "0"),
          yes_ask_size: parseFloat(m.yes_ask_size_fp || "0"),
          volume: parseFloat(m.volume_fp || "0"),
          open_interest: parseFloat(m.open_interest_fp || "0"),
          status: m.status || "active",
          result: m.result || "",
          close_time: m.close_time,
          source_name: (ev.settlement_sources && ev.settlement_sources[0]?.name) || "Kalshi Demo API",
          source_url: (ev.settlement_sources && ev.settlement_sources[0]?.url) || `${DEMO_API}/events/${ev.event_ticker}`
        });
      }
    }
    if (out.length > 0) return { mode: "LIVE DEMO API", markets: out };
  } catch (e) {
    // Fallback to verified snapshot
  }
  const snap = await fetch("data/verified-markets.json").then(r => r.json());
  return { mode: "VERIFIED SNAPSHOT", markets: snap.markets, flagged: snap.flagged };
}

function scoreROI(m) {
  const swing = Math.abs((m.last_price || 0) - (m.previous_price || 0));
  const liq = (m.yes_bid_size || 0) + (m.yes_ask_size || 0);
  return (swing * 100) + Math.log10(1 + (m.volume || 0)) * 5 + Math.log10(1 + liq) * 3;
}

window.KalshiApp = {
  TOPICS,
  fetchMarkets,
  scoreROI,
  getPortfolio,
  savePortfolio,
  executeSimulatedTrade
};
