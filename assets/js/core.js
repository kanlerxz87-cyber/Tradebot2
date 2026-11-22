/* Tradebot2 core — shared client logic.
   No external libraries. Everything here is deterministic and inspectable, and
   mirrors app/alerts.py, app/strategies.py and app/paper.py. */
(function () {
  "use strict";

  const CONFIG = {
    // Official recommended demo host (docs.kalshi.com/getting_started/api_environments).
    apiBase: "https://external-api.demo.kalshi.co/trade-api/v2",
    apiBaseAlt: "https://demo-api.kalshi.co/trade-api/v2",
    wsUrl: "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
    threshold: 0.1,
    pollMs: 5000,
    hiddenPollMs: 30000,
    modelScoreFloor: 55,
    modelRoiFloor: 0.05,
    paperCash: 10000,
    maxOpenPerStrategy: 4,
    maxContracts: 250,
    feeRate: 0.07,
    docs: {
      environments: "https://docs.kalshi.com/getting_started/api_environments.md",
      marketData: "https://docs.kalshi.com/getting_started/quick_start_market_data.md",
      websockets: "https://docs.kalshi.com/getting_started/quick_start_websockets.md",
      apiKeys: "https://docs.kalshi.com/getting_started/api_keys.md",
      fees: "https://docs.kalshi.com/getting_started/fee_rounding.md",
      orderbook: "https://docs.kalshi.com/api-reference/market/get-market-orderbook.md",
      candles: "https://docs.kalshi.com/api-reference/market/get-market-candlesticks.md",
      markets: "https://docs.kalshi.com/api-reference/market/get-markets.md"
    }
  };

  const TOPICS = {
    gas_prices: { label: "Gas prices", icon: "⛽", page: "gas-prices.html", blurb: "AAA weekly / monthly US retail gasoline markets." },
    elections: { label: "Elections", icon: "🗳️", page: "elections.html", blurb: "Presidential, congressional, state and local races." },
    culture: { label: "Culture", icon: "🎬", page: "culture.html", blurb: "Film, music, awards, celebrities and internet culture." },
    crypto: { label: "Crypto", icon: "₿", page: "crypto.html", blurb: "Bitcoin, Ethereum, Solana and digital-asset markets." },
    golf: { label: "Golf", icon: "⛳", page: "golf.html", blurb: "PGA Tour, LPGA, majors and international team events." }
  };

  const STRATEGIES = {
    momentum: { label: "Momentum", color: "#2fe3b0", edge: 0.25, minMove: 0.1, blurb: "Follow a ≥ $0.10 move when the book and volume confirm it." },
    mean_reversion: { label: "Mean reversion", color: "#6aa9ff", edge: 0.18, minMove: 0.15, blurb: "Fade an outsized ≥ $0.15 move toward the pre-move price." },
    favorite_drift: { label: "Favorite drift", color: "#ffc857", edge: 0.10, minMove: 0, blurb: "In the final 24h, buy a ≥ $0.85 favourite if depth supports it." }
  };

  /* ---------------- numbers & formatting ---------------- */
  function num(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function money(value, digits) {
    const n = num(value);
    if (n === null) return "—";
    const d = digits === undefined ? (Math.abs(n) < 1 ? 2 : 2) : digits;
    return "$" + n.toFixed(d);
  }
  function cents(value) {
    const n = num(value);
    return n === null ? "—" : Math.round(n * 100) + "¢";
  }
  function pct(value, digits) {
    const n = num(value);
    return n === null ? "—" : (n * 100).toFixed(digits === undefined ? 1 : digits) + "%";
  }
  function signed(value, formatter) {
    const n = num(value);
    if (n === null) return "—";
    return (n > 0 ? "+" : "") + (formatter ? formatter(n) : n.toFixed(2));
  }
  function compact(value) {
    const n = num(value);
    if (n === null) return "—";
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return n.toFixed(0);
  }
  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function isoDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }
  function clock(ts) {
    if (!ts) return "—";
    const d = new Date(Number(ts) * 1000);
    return d.toLocaleTimeString(undefined, { hour12: false });
  }
  function relative(ts) {
    if (!ts) return "—";
    const d = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
    const secs = Math.round((Date.now() - d) / 1000);
    if (secs < 60) return secs + "s ago";
    if (secs < 3600) return Math.round(secs / 60) + "m ago";
    if (secs < 86400) return Math.round(secs / 3600) + "h ago";
    return Math.round(secs / 86400) + "d ago";
  }
  function hoursToClose(market) {
    const raw = market && (market.close_time || market.expected_expiration_time);
    if (!raw) return null;
    const t = new Date(raw).getTime();
    if (isNaN(t)) return null;
    return (t - Date.now()) / 3600000;
  }

  /* ---------------- quotes ---------------- */
  function quotePrice(market) {
    let bid = num(market.yes_bid_dollars);
    let ask = num(market.yes_ask_dollars);
    if (bid === null && num(market.yes_bid) !== null) bid = num(market.yes_bid) / 100;
    if (ask === null && num(market.yes_ask) !== null) ask = num(market.yes_ask) / 100;
    if (bid !== null && ask !== null && bid > 0 && bid <= ask && ask <= 1) {
      return { price: Math.round(((bid + ask) / 2) * 1e6) / 1e6, basis: "mid", bid: bid, ask: ask };
    }
    let last = num(market.last_price_dollars);
    if (last === null && num(market.last_price) !== null) last = num(market.last_price) / 100;
    if (last !== null && last >= 0 && last <= 1) return { price: last, basis: "last", bid: bid, ask: ask };
    return { price: null, basis: "none", bid: bid, ask: ask };
  }

  function bookMetrics(book) {
    const out = { yes: [], no: [], bestYesBid: null, bestNoBid: null, bestYesAsk: null, bestNoAsk: null, spread: null, yesDepth: null, noDepth: null };
    if (!book) return out;
    const fp = book.orderbook_fp || book.orderbook || book;
    const parse = (levels) => {
      const rows = [];
      (levels || []).forEach((item) => {
        if (!Array.isArray(item) || item.length < 2) return;
        let p = num(item[0]); const c = num(item[1]);
        if (p === null || c === null) return;
        if (p > 1) p = p / 100;
        rows.push({ price: Math.round(p * 1e4) / 1e4, contracts: Math.round(c * 100) / 100 });
      });
      rows.sort((a, b) => a.price - b.price);
      return rows;
    };
    out.yes = parse(fp.yes_dollars || fp.yes);
    out.no = parse(fp.no_dollars || fp.no);
    if (out.yes.length) { out.bestYesBid = out.yes[out.yes.length - 1].price; out.yesDepth = out.yes[out.yes.length - 1].contracts; }
    if (out.no.length) { out.bestNoBid = out.no[out.no.length - 1].price; out.noDepth = out.no[out.no.length - 1].contracts; }
    if (out.bestNoBid !== null) out.bestYesAsk = Math.round((1 - out.bestNoBid) * 1e4) / 1e4;
    if (out.bestYesBid !== null) out.bestNoAsk = Math.round((1 - out.bestYesBid) * 1e4) / 1e4;
    if (out.bestYesAsk !== null && out.bestYesBid !== null) out.spread = Math.round((out.bestYesAsk - out.bestYesBid) * 1e4) / 1e4;
    return out;
  }

  /* ---------------- swing detection ---------------- */
  class SwingDetector {
    constructor(threshold) {
      this.threshold = threshold || CONFIG.threshold;
      this.last = new Map();
      this.seen = new Set();
    }
    observe(market, meta, ts) {
      const ticker = market.ticker;
      if (!ticker) return null;
      const q = quotePrice(market);
      if (q.price === null) return null;
      const now = ts || Date.now() / 1000;
      const prev = this.last.get(ticker);
      this.last.set(ticker, { price: q.price, ts: now });
      if (!prev) return null;
      const delta = q.price - prev.price;
      if (Math.abs(delta) + 1e-9 < this.threshold) return null;
      const fp = [ticker, Math.round(now * 10), prev.price.toFixed(4), q.price.toFixed(4)].join("|");
      if (this.seen.has(fp)) return null;
      this.seen.add(fp);
      if (this.seen.size > 5000) this.seen = new Set(Array.from(this.seen).slice(-2500));
      return {
        ticker: ticker,
        topic: (meta && meta.topic) || market.topic || "",
        title: (meta && meta.title) || market.title || ticker,
        ts: now,
        before: Math.round(prev.price * 1e4) / 1e4,
        after: Math.round(q.price * 1e4) / 1e4,
        delta: Math.round(delta * 1e4) / 1e4,
        direction: delta > 0 ? "up" : "down",
        basis: q.basis,
        source: "live",
        volume_24h: num(market.volume_24h_fp),
        open_interest: num(market.open_interest_fp),
        yes_bid: q.bid,
        yes_ask: q.ask
      };
    }
  }

  /* ---------------- fees & model ---------------- */
  function orderFee(contracts, price) {
    return Math.ceil(CONFIG.feeRate * contracts * price * (1 - price) * 1e6 - 1e-9) / 1e6;
  }

  function evaluate(market, alert, strategy) {
    const cfg = STRATEGIES[strategy];
    if (!cfg || !market || !market.ticker) return null;
    let q = quotePrice(market);
    let bid = q.bid; let ask = q.ask;
    const liq = bookMetrics(market.__book);
    if (liq.bestYesBid !== null) bid = liq.bestYesBid;
    if (liq.bestYesAsk !== null) ask = liq.bestYesAsk;
    if (bid === null || ask === null || ask <= 0 || ask >= 1 || ask < bid) return null;
    const mid = (bid + ask) / 2;
    const spread = ask - bid;
    const delta = alert ? alert.delta : 0;
    const absDelta = Math.abs(delta);
    let modelProb; let side;

    if (strategy === "momentum") {
      if (!alert || absDelta < 0.1) return null;
      modelProb = clamp(mid + cfg.edge * Math.tanh(delta / 0.2), 0.01, 0.99);
      side = delta > 0 ? "yes" : "no";
    } else if (strategy === "mean_reversion") {
      if (!alert || absDelta < 0.15) return null;
      modelProb = clamp(mid - cfg.edge * Math.tanh(delta / 0.2), 0.01, 0.99);
      side = delta > 0 ? "no" : "yes";
    } else {
      const hours = hoursToClose(market);
      if (hours === null || hours < 0 || hours > 24 || mid < 0.85) return null;
      modelProb = clamp(mid + cfg.edge, 0.01, 0.99);
      side = "yes";
    }

    const entry = side === "yes" ? ask : Math.round((1 - bid) * 1e4) / 1e4;
    if (entry <= 0 || entry >= 1) return null;
    if (side === "no") modelProb = 1 - modelProb;
    const edge = modelProb - entry;
    if (edge <= 0) return null;
    const fee = CONFIG.feeRate * entry * (1 - entry);
    const estRoi = (edge - fee) / entry;
    const depth = side === "yes" ? (liq.yesDepth || 0) : (liq.noDepth || 0);
    const depthScore = clamp(Math.log10(depth + 1) / 2, 0, 1);
    const spreadScore = clamp(1 - spread / 0.2, 0, 1);
    const volume = num(market.volume_24h_fp) || 0;
    const volumeScore = clamp(Math.log10(volume + 1) / 3, 0, 1);
    const hours = hoursToClose(market);
    let timeScore = 0.4;
    if (hours !== null) {
      timeScore = hours < 0 ? 0 : clamp(hours / 72, 0, 1) * (hours < 1 ? 0.5 : 1);
    }
    const edgeScore = clamp(estRoi / 0.25, 0, 1);
    const score = 100 * (0.4 * edgeScore + 0.2 * depthScore + 0.15 * spreadScore + 0.15 * volumeScore + 0.1 * timeScore);
    const move = Math.max(0.05, 1.5 * absDelta);
    const target = Math.round(clamp(entry + move, 0.01, 0.99) * 1e4) / 1e4;
    const stop = Math.round(clamp(entry - Math.max(0.05, 0.75 * absDelta), 0.01, 0.99) * 1e4) / 1e4;

    const reasons = [];
    if (alert) reasons.push("swing " + signed(alert.delta, (n) => "$" + Math.abs(n).toFixed(2)) + " (" + money(alert.before) + " → " + money(alert.after) + ")");
    reasons.push((side === "yes" ? "YES" : "NO") + " entry " + money(entry) + ", model probability " + modelProb.toFixed(2));
    reasons.push("heuristic edge " + money(edge) + "/contract, est. ROI " + pct(estRoi) + " before slippage");
    reasons.push((depth ? Math.round(depth) + " contracts at the touch" : "depth unavailable") + ", spread " + money(spread));
    if (hours !== null) reasons.push(hours < 1 ? "less than 1h to close" : hours.toFixed(1) + "h to close");
    return {
      ticker: market.ticker, topic: market.topic || "", title: market.title || market.ticker,
      strategy: strategy, strategyLabel: cfg.label, side: side, entry, modelProb,
      marketProb: side === "yes" ? mid : 1 - mid, edge, estRoi, score, reasons,
      liquidity: liq, target, stop, hoursToClose: hours, alertTs: alert ? alert.ts : null
    };
  }

  function bestOpportunity(market, alert) {
    const results = Object.keys(STRATEGIES).map((s) => evaluate(market, alert, s)).filter(Boolean);
    results.sort((a, b) => b.score - a.score);
    return results[0] || null;
  }

  function positionSize(opp, bankroll) {
    if (!opp || opp.entry <= 0) return 0;
    const stopDistance = Math.max(0.02, opp.entry - (opp.stop || 0));
    const byRisk = Math.floor((Math.max(0, bankroll) * 0.02) / stopDistance);
    const depth = opp.side === "yes" ? (opp.liquidity.yesDepth || 0) : (opp.liquidity.noDepth || 0);
    const byDepth = depth > 0 ? Math.floor(depth * 0.25) : 25;
    const byCash = Math.floor((bankroll * 0.25) / opp.entry);
    return Math.max(0, Math.min(byRisk, byDepth, byCash, CONFIG.maxContracts));
  }

  /* ---------------- paper broker ---------------- */
  const STORE_KEY = "tb2.paper.v2";
  function blankState() {
    const accounts = {};
    Object.keys(STRATEGIES).forEach((s) => {
      accounts[s] = { strategy: s, starting_cash: CONFIG.paperCash, cash: CONFIG.paperCash, realized_pnl: 0, positions: [], history: [] };
    });
    return { version: 2, created_at: Math.floor(Date.now() / 1000), accounts: accounts };
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return blankState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 2) return blankState();
      Object.keys(STRATEGIES).forEach((s) => { if (!parsed.accounts[s]) parsed.accounts[s] = blankState().accounts[s]; });
      return parsed;
    } catch (e) { return blankState(); }
  }
  function saveState(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* quota / private mode */ }
  }
  function accountEquity(acct, quotes) {
    let value = acct.cash;
    acct.positions.forEach((p) => {
      const q = quotes && quotes[p.ticker];
      const mark = q && q.mid !== null && q.mid !== undefined ? (p.side === "yes" ? q.mid : 1 - q.mid) : p.entry_price;
      value += p.contracts * mark;
    });
    return value;
  }
  function openTrade(state, opp, quotes) {
    const acct = state.accounts[opp.strategy];
    if (!acct) return null;
    if (acct.positions.length >= CONFIG.maxOpenPerStrategy) return null;
    if (acct.positions.some((p) => p.ticker === opp.ticker)) return null;
    const equity = accountEquity(acct, quotes);
    let contracts = positionSize(opp, equity);
    if (contracts <= 0) return null;
    let fee = orderFee(contracts, opp.entry);
    let cost = contracts * opp.entry + fee;
    if (cost > acct.cash) {
      contracts = Math.floor((acct.cash - fee) / opp.entry);
      if (contracts <= 0) return null;
      fee = orderFee(contracts, opp.entry);
      cost = contracts * opp.entry + fee;
    }
    const pos = {
      id: "p" + Math.random().toString(36).slice(2, 10),
      ticker: opp.ticker, topic: opp.topic, title: opp.title, strategy: opp.strategy,
      side: opp.side, contracts: contracts, entry_price: opp.entry, entry_fee: fee,
      opened_ts: Math.floor(Date.now() / 1000), target: opp.target, stop: opp.stop,
      score: Math.round(opp.score * 10) / 10, est_roi: opp.estRoi, status: "open"
    };
    acct.cash -= cost;
    acct.positions.push(pos);
    saveState(state);
    return pos;
  }
  function closeTrade(state, strategy, positionId, price, reason) {
    const acct = state.accounts[strategy];
    if (!acct) return null;
    const idx = acct.positions.findIndex((p) => p.id === positionId);
    if (idx < 0) return null;
    const pos = acct.positions.splice(idx, 1)[0];
    const fee = orderFee(pos.contracts, price);
    const cost = pos.contracts * pos.entry_price + pos.entry_fee;
    const proceeds = pos.contracts * price - fee;
    const pnl = proceeds - cost;
    acct.cash += proceeds;
    acct.realized_pnl += pnl;
    pos.status = "closed";
    pos.exit_price = price;
    pos.exit_fee = fee;
    pos.closed_ts = Math.floor(Date.now() / 1000);
    pos.close_reason = reason;
    pos.pnl = Math.round(pnl * 100) / 100;
    pos.roi = cost > 0 ? pnl / cost : 0;
    acct.history.push(pos);
    saveState(state);
    return pos;
  }
  function settleTrades(state, resolutions) {
    const settled = [];
    Object.keys(state.accounts).forEach((s) => {
      const acct = state.accounts[s];
      acct.positions.slice().forEach((pos) => {
        const result = resolutions[pos.ticker];
        if (result !== "yes" && result !== "no") return;
        const idx = acct.positions.findIndex((p) => p.id === pos.id);
        if (idx < 0) return;
        acct.positions.splice(idx, 1);
        const won = (pos.side === "yes" && result === "yes") || (pos.side === "no" && result === "no");
        const payout = pos.contracts * (won ? 1 : 0);
        const cost = pos.contracts * pos.entry_price + pos.entry_fee;
        const pnl = payout - cost;
        acct.cash += payout;
        acct.realized_pnl += pnl;
        pos.status = "settled";
        pos.resolved_result = result;
        pos.closed_ts = Math.floor(Date.now() / 1000);
        pos.close_reason = "settled " + result.toUpperCase();
        pos.pnl = Math.round(pnl * 100) / 100;
        pos.roi = cost > 0 ? pnl / cost : 0;
        acct.history.push(pos);
        settled.push(pos);
      });
    });
    if (settled.length) saveState(state);
    return settled;
  }
  function markTrades(state, quotes) {
    const closed = [];
    Object.keys(state.accounts).forEach((s) => {
      const acct = state.accounts[s];
      acct.positions.slice().forEach((pos) => {
        const q = quotes[pos.ticker];
        if (!q || q.mid === null || q.mid === undefined) return;
        const mark = pos.side === "yes" ? q.mid : 1 - q.mid;
        const gain = mark - pos.entry_price;
        if (gain >= 0.15) closed.push(closeTrade(state, s, pos.id, mark, "take profit"));
        else if (gain <= -0.10) closed.push(closeTrade(state, s, pos.id, mark, "stop loss"));
      });
    });
    return closed.filter(Boolean);
  }
  function priceBucket(p) {
    const low = Math.floor(clamp(p, 0, 0.999) * 10) * 10;
    return "$" + (low / 100).toFixed(2) + "–$" + ((low + 10) / 100).toFixed(2);
  }
  function groupRows(trades, keyFn) {
    const buckets = {};
    trades.forEach((t) => {
      const k = keyFn(t) || "unknown";
      (buckets[k] = buckets[k] || []).push(t);
    });
    return Object.keys(buckets).map((k) => {
      const items = buckets[k];
      const wins = items.filter((t) => t.pnl > 0);
      return {
        key: k, trades: items.length, wins: wins.length,
        win_rate: items.length ? wins.length / items.length : 0,
        pnl: items.reduce((a, t) => a + t.pnl, 0),
        avg_roi: items.reduce((a, t) => a + (t.roi || 0), 0) / items.length
      };
    }).sort((a, b) => b.trades - a.trades);
  }
  function analytics(state) {
    let closed = [];
    Object.keys(state.accounts).forEach((s) => { closed = closed.concat(state.accounts[s].history); });
    const wins = closed.filter((t) => t.pnl > 0);
    const losses = closed.filter((t) => t.pnl <= 0);
    const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));
    const totalPnl = closed.reduce((a, t) => a + t.pnl, 0);
    const events = closed.map((t) => ({ ts: t.closed_ts || t.opened_ts, pnl: t.pnl })).sort((a, b) => a.ts - b.ts);
    let equity = CONFIG.paperCash * Object.keys(state.accounts).length;
    let peak = equity; let maxDd = 0;
    const curve = [{ ts: 0, equity: equity }];
    events.forEach((e) => {
      equity += e.pnl; peak = Math.max(peak, equity);
      if (peak > 0) maxDd = Math.max(maxDd, (peak - equity) / peak);
      curve.push({ ts: e.ts, equity: Math.round(equity * 100) / 100 });
    });
    return {
      closed_trades: closed.length,
      open_trades: Object.keys(state.accounts).reduce((a, s) => a + state.accounts[s].positions.length, 0),
      wins: wins.length, losses: losses.length,
      win_rate: closed.length ? wins.length / closed.length : 0,
      total_pnl: totalPnl,
      avg_roi: closed.length ? closed.reduce((a, t) => a + (t.roi || 0), 0) / closed.length : 0,
      expectancy: closed.length ? totalPnl / closed.length : 0,
      profit_factor: grossLoss > 0 ? grossWin / grossLoss : null,
      max_drawdown_pct: maxDd * 100,
      by_strategy: groupRows(closed, (t) => t.strategy),
      by_topic: groupRows(closed, (t) => t.topic),
      by_price: groupRows(closed, (t) => priceBucket(t.entry_price)),
      by_side: groupRows(closed, (t) => t.side),
      equity_curve: curve,
      trades: closed.slice().reverse()
    };
  }

  /* ---------------- chart ---------------- */
  function drawChart(svg, points, opts) {
    opts = opts || {};
    const width = 820, height = 300;
    const padL = 46, padR = 14, padT = 14, padB = 34;
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("preserveAspectRatio", "none");
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const ns = "http://www.w3.org/2000/svg";
    const make = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
      return el;
    };
    const clean = (points || []).filter((p) => p && p.ts && Number.isFinite(Number(p.price)) && p.price >= 0 && p.price <= 1);
    if (!clean.length) {
      svg.appendChild(make("text", { x: width / 2, y: height / 2, "text-anchor": "middle", fill: "#6f829b" })).textContent = "No price points for this window yet.";
      return null;
    }
    let minP = Math.min(...clean.map((p) => p.price));
    let maxP = Math.max(...clean.map((p) => p.price));
    if (maxP - minP < 0.04) { const mid = (maxP + minP) / 2; minP = mid - 0.02; maxP = mid + 0.02; }
    const pad = (maxP - minP) * 0.12;
    minP = clamp(minP - pad, 0, 1); maxP = clamp(maxP + pad, 0, 1);
    if (maxP - minP < 0.01) { minP = Math.max(0, minP - 0.01); maxP = Math.min(1, maxP + 0.01); }
    const t0 = Number(opts.start || clean[0].ts);
    const t1 = Number(opts.end || clean[clean.length - 1].ts);
    const span = Math.max(1, t1 - t0);
    const x = (t) => padL + ((Number(t) - t0) / span) * (width - padL - padR);
    const y = (p) => padT + (1 - (p - minP) / (maxP - minP)) * (height - padT - padB);

    const defs = make("defs", {});
    const grad = make("linearGradient", { id: "areaFill", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(make("stop", { offset: "0%", "stop-color": "#2fe3b0", "stop-opacity": "0.24" }));
    grad.appendChild(make("stop", { offset: "100%", "stop-color": "#2fe3b0", "stop-opacity": "0" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    for (let i = 0; i <= 4; i++) {
      const price = minP + ((maxP - minP) * i) / 4;
      const yy = y(price);
      svg.appendChild(make("line", { class: "grid-line", x1: padL, y1: yy, x2: width - padR, y2: yy }));
      const label = make("text", { x: padL - 7, y: yy + 3, "text-anchor": "end" });
      label.textContent = Math.round(price * 100) + "¢";
      svg.appendChild(label);
    }
    for (let i = 0; i <= 4; i++) {
      const t = t0 + (span * i) / 4;
      const xx = x(t);
      svg.appendChild(make("line", { class: "grid-line", x1: xx, y1: padT, x2: xx, y2: height - padB }));
      const label = make("text", { x: xx, y: height - padB + 15, "text-anchor": i === 0 ? "start" : i === 4 ? "end" : "middle" });
      label.textContent = opts.labelFor ? opts.labelFor(t) : clock(t);
      svg.appendChild(label);
    }
    svg.appendChild(make("line", { class: "axis-line", x1: padL, y1: height - padB, x2: width - padR, y2: height - padB }));

    let d = "";
    clean.forEach((p, i) => { d += (i === 0 ? "M" : "L") + x(p.ts).toFixed(2) + " " + y(p.price).toFixed(2); });
    const area = d + "L" + x(clean[clean.length - 1].ts).toFixed(2) + " " + (height - padB) + "L" + x(clean[0].ts).toFixed(2) + " " + (height - padB) + "Z";
    svg.appendChild(make("path", { class: "price-area", d: area }));
    svg.appendChild(make("path", { class: "price-line", d: d }));

    if (opts.bid !== null && opts.bid !== undefined) {
      svg.appendChild(make("line", { class: "quote-line", x1: padL, y1: y(opts.bid), x2: width - padR, y2: y(opts.bid), stroke: "#2fe3b0", opacity: "0.5" }));
    }
    if (opts.ask !== null && opts.ask !== undefined) {
      svg.appendChild(make("line", { class: "quote-line", x1: padL, y1: y(opts.ask), x2: width - padR, y2: y(opts.ask), stroke: "#ff5f7e", opacity: "0.5" }));
    }
    (opts.markers || []).forEach((m) => {
      if (m.ts < t0 || m.ts > t1) return;
      const cx = x(m.ts);
      const cy = y(clamp(m.after, 0, 1));
      svg.appendChild(make("circle", { class: "alert-dot", cx: cx, cy: cy, r: 3.2 }));
    });
    const cross = make("line", { class: "crosshair", x1: 0, y1: padT, x2: 0, y2: height - padB, opacity: "0" });
    svg.appendChild(cross);
    svg._chartGeometry = { width, height, padL, padR, padT, padB, t0, t1, minP, maxP, x, y, points: clean };
    return { minP, maxP, t0, t1, points: clean };
  }

  function attachCrosshair(svg, tooltip, formatter) {
    if (!svg || !svg._chartGeometry) return;
    const geo = svg._chartGeometry;
    const cross = svg.querySelector(".crosshair");
    if (svg._crosshairMove) svg.removeEventListener("pointermove", svg._crosshairMove);
    if (svg._crosshairLeave) svg.removeEventListener("pointerleave", svg._crosshairLeave);
    svg._crosshairMove = (event) => {
      const rect = svg.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * geo.width;
      if (px < geo.padL || px > geo.width - geo.padR) return;
      const t = geo.t0 + ((px - geo.padL) / (geo.width - geo.padL - geo.padR)) * (geo.t1 - geo.t0);
      let nearest = geo.points[0];
      let best = Infinity;
      geo.points.forEach((p) => { const d = Math.abs(Number(p.ts) - t); if (d < best) { best = d; nearest = p; } });
      const xx = geo.x(nearest.ts);
      cross.setAttribute("x1", xx); cross.setAttribute("x2", xx); cross.setAttribute("opacity", "1");
      if (tooltip) {
        tooltip.innerHTML = formatter ? formatter(nearest) : (clock(nearest.ts) + " · " + money(nearest.price));
        tooltip.classList.remove("hidden");
        const pctX = (xx / geo.width) * 100;
        tooltip.style.left = clamp(pctX, 12, 88) + "%";
        tooltip.style.top = "8px";
      }
    };
    svg._crosshairLeave = () => {
      cross.setAttribute("opacity", "0");
      if (tooltip) tooltip.classList.add("hidden");
    };
    svg.addEventListener("pointermove", svg._crosshairMove);
    svg.addEventListener("pointerleave", svg._crosshairLeave);
  }

  window.TB = {
    CONFIG, TOPICS, STRATEGIES,
    num, clamp, money, cents, pct, signed, compact, esc, isoDate, clock, relative, hoursToClose,
    quotePrice, bookMetrics, SwingDetector, orderFee, evaluate, bestOpportunity, positionSize,
    paper: {
      key: STORE_KEY, blankState, loadState, saveState, accountEquity,
      openTrade, closeTrade, settleTrades, markTrades, analytics
    },
    drawChart, attachCrosshair
  };
})();
