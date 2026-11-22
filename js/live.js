/* Tradebot2 live layer.
 *
 * Everything here talks to the Kalshi demo REST API from the *viewer's*
 * browser (the build sandbox cannot reach it). Documented behaviour this file
 * relies on:
 *   - public market data needs no credentials:
 *     https://docs.kalshi.com/getting_started/quick_start_rest
 *   - order book is bids only, best YES ask = 1 - best NO bid:
 *     https://docs.kalshi.com/getting_started/orderbook_responses.md
 *   - candlesticks: period_interval in {1,60,1440}, max 5000 periods/request:
 *     https://docs.kalshi.com/api-reference/market/get-market-candlesticks.md
 *   - rate limits are token buckets and 429 carries no Retry-After:
 *     https://docs.kalshi.com/getting_started/rate_limits.md
 *
 * If the API is unreachable or the browser blocks it (CORS/preflight), the UI
 * says so and falls back to the committed snapshot files. It never fabricates a
 * price: a missing number renders as "-".
 */
const T2 = (() => {
  const DEMO = "https://external-api.demo.kalshi.co/trade-api/v2";
  const THRESHOLD = 0.10;
  const HIGH_ROI = 55;
  const TOPICS = [
    { key: "gas", label: "Gas prices" },
    { key: "elections", label: "Elections" },
    { key: "culture", label: "Culture" },
    { key: "crypto", label: "Crypto" },
    { key: "golf", label: "Golf" },
  ];

  /* ---------- small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const money = (v) => (v === null || Number.isNaN(v) ? "-" : "$" + Number(v).toFixed(v < 1 ? 4 : 2));
  const cents = (v) => (v === null ? "-" : (Number(v) * 100).toFixed(1) + "c");
  const numf = (v, d = 2) => (v === null || v === undefined ? "-" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isoTime = (ts) => new Date(ts * 1000).toISOString().slice(11, 19) + "Z";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- API ---------- */
  async function api(path, params = {}) {
    const url = new URL(DEMO + path);
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (res.status === 429) throw new Error("rate limited (429)");
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  async function status() {
    try {
      const s = await api("/exchange/status");
      return { ok: true, exchange_active: s.exchange_active, trading_active: s.trading_active };
    } catch (e) { return { ok: false, error: String(e.message || e) }; }
  }

  /* Order book -> ladder. Bids ascending from the API; we show best first. */
  function ladderFromBook(book) {
    const fp = (book && book.orderbook_fp) || {};
    const parse = (arr) => (arr || []).map(([p, c]) => ({ price: Number(p), contracts: Number(c) })).filter((l) => l.contracts > 0);
    const bids = parse(fp.yes_dollars).sort((a, b) => b.price - a.price);
    const asks = parse(fp.no_dollars).map((l) => ({ price: 1 - l.price, contracts: l.contracts })).sort((a, b) => a.price - b.price);
    return { bids, asks, bestBid: bids[0]?.price ?? null, bestAsk: asks[0]?.price ?? null };
  }

  function depthWithin(bids, cents = 0.01) {
    if (!bids.length) return null;
    const best = bids[0].price;
    return bids.filter((l) => l.price >= best - cents).reduce((s, l) => s + l.contracts, 0);
  }

  /* ---------- ROI heuristic (identical to engine/alerts.py) ---------- */
  function roiScore(delta, liquidity, spread, volume, minutesToClose) {
    const move = Math.min(Math.abs(delta) / 0.25, 1);
    const liq = Math.min((liquidity || 0) / 2000, 1);
    const tight = spread == null ? 1 : 1 - Math.min(spread / 0.10, 1);
    const act = Math.min(Math.log10(1 + (volume || 0)) / 4, 1);
    const urgency = minutesToClose != null && minutesToClose >= 0 && minutesToClose <= 60 ? 1 : 0;
    return Math.round((45 * move + 25 * liq + 15 * tight + 10 * act + 5 * urgency) * 10) / 10;
  }

  /* ---------- live market normalisation ---------- */
  function normalise(market, event) {
    const yesBid = num(market.yes_bid_dollars);
    const noBid = num(market.no_bid_dollars);
    const derivedAsk = noBid != null && noBid > 0 && noBid < 1 ? 1 - noBid : null;
    const quotedAsk = num(market.yes_ask_dollars);
    const ask = derivedAsk ?? (quotedAsk != null && quotedAsk > 0 && quotedAsk < 1 ? quotedAsk : null);
    const last = num(market.last_price_dollars);
    let price = null, basis = "no price";
    if (yesBid != null && ask != null && ask > yesBid && ask < 1) { price = (yesBid + ask) / 2; basis = "mid"; }
    else if (last != null) { price = last; basis = "last"; }
    else if (yesBid != null) { price = yesBid; basis = "bid"; }
    const closeTs = market.close_time ? Date.parse(market.close_time) / 1000 : null;
    return {
      ticker: market.ticker,
      event_ticker: market.event_ticker || event?.event_ticker,
      title: (event?.title ? event.title + " — " : "") + (market.yes_sub_title || market.title || market.ticker),
      series_ticker: (market.ticker.split("-")[0] || ""),
      event_title: event?.title || "",
      category: event?.category || "",
      price, basis,
      yes_bid: yesBid, yes_ask: ask, last,
      volume: num(market.volume_fp),
      volume_24h: num(market.volume_24h_fp),
      open_interest: num(market.open_interest_fp),
      bid_size: num(market.yes_bid_size_fp),
      status: market.status,
      result: market.result || "",
      close_time: market.close_time || null,
      minutes_to_close: closeTs ? Math.round((closeTs - Date.now() / 1000) / 60) : null,
      source_url: `${DEMO}/markets/${market.ticker}`,
      kalshi_url: `https://kalshi.com/markets/${(market.ticker.split("-")[0] || "").toLowerCase()}`,
    };
  }

  /* Topic assignment from official category/tags, mirroring engine/topics.py.
     `category` is exact; gas/golf need the tag, which only the series endpoint
     carries, so tickers are matched against verified prefixes. */
  const PREFIX = {
    gas: ["KXAAAGAS"],
    elections: ["PRESPARTY", "KXSENATE", "KXGOV", "KXHOUSE", "KXPRES", "KXELECT", "KXMAYOR", "KXNEXTNATO"],
    culture: ["KXX", "KXOSCAR", "KXGRAMMY", "KXEMMY", "KXCELEB", "KXTIME"],
    crypto: ["KXBTC", "KXBTCD", "KXBTC15M", "KXETH", "KXSOL", "KXXRP", "KXDOGE", "KXHYPE", "KXNEAR", "KXTON", "KXBNB", "KXFDV"],
    golf: ["KXPGA", "KXDPWT", "KXLPGA", "KXGOLF"],
  };
  function topicOf(m) {
    const cat = (m.category || "").toLowerCase();
    if (cat === "elections") return "elections";
    if (cat === "culture") return "culture";
    if (cat === "crypto") return "crypto";
    const t = (m.series_ticker || "").toUpperCase();
    for (const [key, prefixes] of Object.entries(PREFIX)) {
      if (prefixes.some((p) => t.startsWith(p))) return key;
    }
    return null;
  }

  /* ---------- polling engine ---------- */
  const state = {
    mode: "connecting",
    markets: new Map(),     // ticker -> latest normalised market
    history: new Map(),     // ticker -> [{ts, price, bid, ask}]
    alerts: [],             // all >= $0.10 alerts
    lastPoll: null,
    polls: 0,
    errors: 0,
    listeners: new Set(),
  };

  function emit() { state.listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }
  function on(fn) { state.listeners.add(fn); return () => state.listeners.delete(fn); }

  const TOPIC_SERIES = {
    gas: ["KXAAAGASD"],
    crypto: ["KXBTCD"],
    golf: ["KXPGAWINMARGIN", "KXPGAROUNDLOW"],
    culture: ["KXXBANNEDGROK", "KXXBANNEDMURRAYHILLGUY1"],
    elections: ["KXSENATEID", "KXGOVHINOMR"],
  };

  async function pollOnce() {
    const seen = [];
    // 1) broad sweep: open events with nested markets (cheap: one request)
    try {
      const data = await api("/events", { status: "open", limit: 60, with_nested_markets: "true" });
      for (const ev of data.events || []) {
        for (const mk of ev.markets || []) {
          if (mk.status !== "active") continue;
          const m = normalise(mk, ev);
          m.topic = topicOf(m);
          seen.push(m);
        }
      }
    } catch (e) { state.errors++; }

    // 2) guaranteed coverage of the five topics even when the sweep is thin
    for (const [topic, series] of Object.entries(TOPIC_SERIES)) {
      for (const s of series) {
        try {
          const data = await api("/markets", { status: "open", series_ticker: s, limit: 8 });
          for (const mk of data.markets || []) {
            if (mk.status !== "active") continue;
            const m = normalise(mk, null);
            m.topic = topic;
            seen.push(m);
          }
        } catch (e) { state.errors++; }
        await sleep(120);
      }
    }

    const now = Math.floor(Date.now() / 1000);
    for (const m of seen) {
      const prev = state.markets.get(m.ticker);
      if (m.price != null) {
        const path = state.history.get(m.ticker) || [];
        path.push({ ts: now, price: m.price, bid: m.yes_bid, ask: m.yes_ask, depth: m.bid_size });
        if (path.length > 720) path.shift();
        state.history.set(m.ticker, path);
      }
      if (prev && prev.price != null && m.price != null) {
        const delta = m.price - prev.price;
        if (Math.abs(delta) >= THRESHOLD - 1e-9) {
          const score = roiScore(delta, m.bid_size, m.yes_ask != null && m.yes_bid != null ? m.yes_ask - m.yes_bid : null, m.volume, m.minutes_to_close);
          state.alerts.unshift({
            ts: now, ticker: m.ticker, title: m.title, topic: m.topic,
            before: prev.price, after: m.price, delta: Math.abs(delta),
            direction: delta > 0 ? "up" : "down", basis: m.basis,
            liquidity: m.bid_size, spread: m.yes_ask != null && m.yes_bid != null ? m.yes_ask - m.yes_bid : null,
            score, high_roi: score >= HIGH_ROI,
            source_url: m.source_url, kalshi_url: m.kalshi_url,
          });
        }
      }
      state.markets.set(m.ticker, m);
    }
    if (state.alerts.length > 400) state.alerts.length = 400;
    state.lastPoll = Date.now();
    state.polls++;
    emit();
  }

  async function start(intervalMs = 8000) {
    const st = await status();
    if (!st.ok) {
      state.mode = "offline";
      state.error = st.error;
      emit();
      return;
    }
    state.mode = "live";
    state.trading_active = st.trading_active;
    emit();
    pollOnce();
    setInterval(pollOnce, Math.max(5000, intervalMs));
  }

  /* ---------- snapshot fallback ---------- */
  async function snapshot() {
    const [markets, alerts, candles, backtest, sources] = await Promise.all(
      ["markets.json", "alerts.json", "candles.json", "backtest.json", "sources.json"].map((f) =>
        fetch("data/" + f).then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.json(); })
      )
    );
    return { markets, alerts, candles, backtest, sources };
  }

  /* ---------- canvas chart (no dependency) ---------- */
  function lineChart(canvas, series, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 600;
    const cssH = canvas.clientHeight || 300;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const pad = { l: 46, r: 14, t: 14, b: 26 };
    const w = cssW - pad.l - pad.r, h = cssH - pad.t - pad.b;

    const pts = series.filter((p) => p.price != null);
    const marks = opts.markers || [];
    const all = pts.concat(marks.map((m) => ({ ts: m.ts, price: m.after })));
    if (!all.length) {
      ctx.fillStyle = "#64748b"; ctx.font = "12px -apple-system, system-ui, sans-serif";
      ctx.fillText(opts.empty || "no observations in this window", pad.l, cssH / 2);
      return;
    }
    const xMin = Math.min(...all.map((p) => p.ts)), xMax = Math.max(...all.map((p) => p.ts));
    const yVals = all.map((p) => p.price);
    let yMin = Math.min(...yVals), yMax = Math.max(...yVals);
    if (yMax - yMin < 0.05) { const c = (yMax + yMin) / 2; yMin = Math.max(0, c - 0.025); yMax = Math.min(1, c + 0.025); }
    yMin = Math.max(0, yMin - 0.02); yMax = Math.min(1, yMax + 0.02);
    const X = (ts) => pad.l + (xMax === xMin ? w / 2 : ((ts - xMin) / (xMax - xMin)) * w);
    const Y = (v) => pad.t + h - ((v - yMin) / (yMax - yMin || 1)) * h;

    // grid + y labels
    ctx.strokeStyle = "#182438"; ctx.fillStyle = "#64748b"; ctx.font = "11px ui-monospace, monospace"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const v = yMin + ((yMax - yMin) * i) / 4;
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
      ctx.fillText((v * 100).toFixed(1) + "c", 6, y + 4);
    }
    // x labels
    ctx.textAlign = "center";
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const ts = xMin + ((xMax - xMin) * i) / ticks;
      ctx.fillText(new Date(ts * 1000).toISOString().slice(11, 16), X(ts), cssH - 8);
    }
    ctx.textAlign = "left";

    // line with gap support (null price = break, never interpolate)
    ctx.strokeStyle = "#5b8def"; ctx.lineWidth = 2; ctx.lineJoin = "round";
    ctx.beginPath();
    let pen = false;
    series.forEach((p) => {
      if (p.price == null) { pen = false; return; }
      const x = X(p.ts), y = Y(p.price);
      if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // last point
    const last = pts[pts.length - 1];
    if (last) {
      ctx.fillStyle = "#9dbcf7";
      ctx.beginPath(); ctx.arc(X(last.ts), Y(last.price), 3, 0, Math.PI * 2); ctx.fill();
    }

    // alert markers: triangle up/down at the price after the move
    marks.forEach((mk) => {
      const x = X(mk.ts), y = Y(mk.after);
      ctx.fillStyle = mk.direction === "up" ? "#22c98a" : "#f2555a";
      ctx.beginPath();
      ctx.moveTo(x, y - 7); ctx.lineTo(x - 5, y + 3); ctx.lineTo(x + 5, y + 3);
      ctx.closePath(); ctx.fill();
    });
  }

  /* ---------- depth (step) chart ---------- */
  function depthChart(canvas, ladder) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 520, cssH = canvas.clientHeight || 200;
    canvas.width = cssW * dpr; canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const pad = { l: 44, r: 12, t: 12, b: 24 };
    const w = cssW - pad.l - pad.r, h = cssH - pad.t - pad.b;
    const all = ladder.bids.concat(ladder.asks);
    if (!all.length) {
      ctx.fillStyle = "#64748b"; ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("order book is empty (no bids and no offers)", pad.l, cssH / 2);
      return;
    }
    const maxC = Math.max(...all.map((l) => l.contracts));
    const X = (p) => pad.l + (p <= 1 ? p : 1) * w;
    const Y = (c) => pad.t + h - (c / (maxC || 1)) * h;

    ctx.strokeStyle = "#182438"; ctx.fillStyle = "#64748b"; ctx.font = "11px ui-monospace, monospace";
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
      const x = X(p);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + h); ctx.stroke();
      ctx.fillText(p.toFixed(2), x - 10, cssH - 8);
    });

    const drawSide = (levels, colour, cumulative) => {
      if (!levels.length) return;
      ctx.strokeStyle = colour; ctx.lineWidth = 2; ctx.beginPath();
      let acc = 0;
      levels.forEach((l, i) => {
        acc += cumulative ? l.contracts : 0;
        const v = cumulative ? acc : l.contracts;
        const x = X(l.price), y = Y(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    drawSide(ladder.bids.slice().sort((a, b) => a.price - b.price), "#22c98a", true);
    drawSide(ladder.asks, "#7a6ae0", true);

    ctx.fillStyle = "#64748b"; ctx.fillText("cumulative contracts vs price", pad.l + 4, pad.t + 10);
  }

  /* ---------- static table renderers used by the topic pages ---------- */
  function riskBadge(row) {
    if (row.row_type === "resolved") return `<span class="badge ${row.result === "yes" ? "ok" : "err"}">${esc(row.result || "?")}</span>`;
    if (row.row_type === "gap") return '<span class="badge void">no data</span>';
    return `<span class="badge ${row.status === "active" ? "live" : "snap"}">${esc(row.status || "series")}</span>`;
  }

  return { DEMO, THRESHOLD, HIGH_ROI, TOPICS, $, $$, num, money, cents, numf, esc, isoTime,
           api, status, ladderFromBook, depthWithin, roiScore, normalise, topicOf,
           state, on, start, pollOnce, snapshot, lineChart, depthChart, riskBadge };
})();
window.T2 = T2;
