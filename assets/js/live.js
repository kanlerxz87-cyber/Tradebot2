/* Tradebot2 live feed — reads Kalshi's public REST market-data endpoints
   directly from the browser. Public reads need no API key (official docs).
   If the network, CORS or the exchange blocks a request, the caller gets a
   status change and the UI falls back to the verified snapshot; no values are
   invented. */
(function () {
  "use strict";

  const TB = window.TB;

  async function getJSON(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), (options && options.timeout) || 12000);
    try {
      const response = await fetch(url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) {
        const text = await response.text();
        const err = new Error("HTTP " + response.status + " " + text.slice(0, 200));
        err.status = response.status;
        throw err;
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  class LiveFeed {
    constructor(opts) {
      this.markets = opts.markets || [];
      this.meta = new Map(this.markets.map((m) => [m.ticker, m]));
      this.onQuotes = opts.onQuotes || function () {};
      this.onAlert = opts.onAlert || function () {};
      this.onOpportunity = opts.onOpportunity || function () {};
      this.onStatus = opts.onStatus || function () {};
      this.detector = new TB.SwingDetector(TB.CONFIG.threshold);
      this.quotes = {};
      this.ticks = {};
      this.alerts = [];
      this.status = "idle";
      this.lastSuccessAt = 0;
      this.errorCount = 0;
      this.lastError = "";
      this.pollTimer = null;
      this.opportunitySeen = new Map();
      this.seed = opts.seed || [];
      this.paused = false;
      this._bindVisibility();
    }

    start() {
      if (this.pollTimer) return;
      this.poll();
      this.pollTimer = setInterval(() => { if (!this.paused) this.poll(); }, TB.CONFIG.pollMs);
      this._schedule();
    }
    _schedule() {
      if (this._visibilityHandler) document.removeEventListener("visibilitychange", this._visibilityHandler);
      this._visibilityHandler = () => {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
          this.pollTimer = setInterval(() => { if (!this.paused) this.poll(); }, document.hidden ? TB.CONFIG.hiddenPollMs : TB.CONFIG.pollMs);
        }
        if (!document.hidden) this.poll();
      };
      document.addEventListener("visibilitychange", this._visibilityHandler);
    }
    _bindVisibility() { this._schedule(); }

    stop() {
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    setPaused(flag) { this.paused = !!flag; }

    setStatus(status, message) {
      if (this.status === status && this.lastError === (message || "")) return;
      this.status = status;
      if (message) this.lastError = message;
      this.onStatus({ status: status, error: this.lastError, at: Date.now() });
    }

    seedAlerts() {
      if (!this.seed || !this.seed.length) return;
      const list = this.seed.slice().sort((a, b) => a.ts - b.ts);
      list.forEach((a) => {
        const enriched = Object.assign({}, a, {
          source: "candle",
          history: true,
          links: (this.meta.get(a.ticker) || {}).links || a.links || null
        });
        this.alerts.push(enriched);
        this.onAlert(enriched, true);
      });
    }

    async poll() {
      const tickers = this.markets.map((m) => m.ticker).filter(Boolean);
      if (!tickers.length) return;
      if (!this.lastSuccessAt) this.setStatus("connecting");
      else if (this.errorCount) this.setStatus("degraded");
      try {
        const chunks = [];
        for (let i = 0; i < tickers.length; i += 40) chunks.push(tickers.slice(i, i + 40));
        const pages = await Promise.all(chunks.map((chunk) =>
          getJSON(TB.CONFIG.apiBase + "/markets?tickers=" + encodeURIComponent(chunk.join(",")))
        ));
        const received = [];
        pages.forEach((page) => (page.markets || []).forEach((m) => received.push(m)));
        if (!received.length) throw new Error("API returned no markets for the tracked tickers");
        this.errorCount = 0;
        this.lastError = "";
        this.lastSuccessAt = Date.now();
        const now = this.lastSuccessAt / 1000;
        const updates = {};
        received.forEach((m) => {
          const meta = this.meta.get(m.ticker) || {};
          const q = TB.quotePrice(m);
          updates[m.ticker] = {
            ticker: m.ticker, mid: q.price, basis: q.basis, bid: q.bid, ask: q.ask,
            last: TB.num(m.last_price_dollars),
            volume_24h: TB.num(m.volume_24h_fp),
            open_interest: TB.num(m.open_interest_fp),
            ts: now,
            market: m
          };
          this.quotes[m.ticker] = updates[m.ticker];
          if (q.price !== null) {
            const ticks = this.ticks[m.ticker] || (this.ticks[m.ticker] = []);
            ticks.push({ ts: now, price: q.price });
            if (ticks.length > 2400) ticks.splice(0, ticks.length - 2400);
            const alert = this.detector.observe(m, meta, now);
            if (alert) {
              alert.links = meta.links || null;
              alert.yes_sub_title = m.yes_sub_title;
              this.alerts.push(alert);
              this.onAlert(alert, false);
            }
          }
          if (meta.topic) this._scoreMarket(m, meta, updates[m.ticker]);
        });
        this.setStatus("live");
        this.onQuotes(updates, this);
      } catch (error) {
        this.errorCount += 1;
        this.lastError = String(error && error.message ? error.message : error);
        this.setStatus(this.errorCount >= 2 ? "offline" : "degraded", this.lastError);
      }
    }

    _scoreMarket(raw, meta, quote) {
      const market = Object.assign({}, meta, raw, {
        topic: meta.topic,
        __book: meta.__book
      });
      const recentAlert = this.alerts.slice(-6).reverse().find((a) => a.ticker === raw.ticker && a.source === "live");
      const opp = TB.bestOpportunity(market, recentAlert || null);
      if (!opp) return;
      if (opp.score < TB.CONFIG.modelScoreFloor || opp.estRoi < TB.CONFIG.modelRoiFloor) return;
      const key = opp.ticker + "|" + opp.strategy;
      const last = this.opportunitySeen.get(key) || 0;
      if (Date.now() - last < 180000) return;
      this.opportunitySeen.set(key, Date.now());
      opp.links = meta.links || null;
      opp.ts = Math.floor(Date.now() / 1000);
      opp.source = "model";
      this.onOpportunity(opp);
    }

    async refreshOrderbook(ticker, maxAgeMs) {
      const meta = this.meta.get(ticker) || {};
      const maxAge = maxAgeMs || 12000;
      if (meta.__book && Date.now() - (meta.__bookAt || 0) < maxAge) return meta.__book;
      const data = await getJSON(TB.CONFIG.apiBase + "/markets/" + encodeURIComponent(ticker) + "/orderbook?depth=10");
      meta.__book = data;
      meta.__bookAt = Date.now();
      this.meta.set(ticker, meta);
      return data;
    }

    async fetchCandles(market, hours, period) {
      if (!market || !market.series_ticker) throw new Error("series ticker unavailable");
      const end = Math.floor(Date.now() / 1000);
      const start = end - Math.round(hours * 3600);
      const url = TB.CONFIG.apiBase + "/series/" + encodeURIComponent(market.series_ticker) +
        "/markets/" + encodeURIComponent(market.ticker) + "/candlesticks" +
        "?start_ts=" + start + "&end_ts=" + end + "&period_interval=" + period +
        "&include_latest_before_start=true";
      return await getJSON(url, { timeout: 20000 });
    }

    async fetchMarket(ticker) {
      const data = await getJSON(TB.CONFIG.apiBase + "/markets/" + encodeURIComponent(ticker));
      return data.market || data;
    }

    async fetchTrades(ticker, limit) {
      const data = await getJSON(
        TB.CONFIG.apiBase + "/markets/trades?ticker=" + encodeURIComponent(ticker) + "&limit=" + (limit || 100),
        { timeout: 12000 }
      );
      return data.trades || [];
    }

    getTicks(ticker) { return this.ticks[ticker] || []; }
  }

  async function loadData(name) {
    const response = await fetch("data/" + name, { cache: "no-store" });
    if (!response.ok) throw new Error("could not load data/" + name + " (HTTP " + response.status + ")");
    return await response.json();
  }

  function candlePoints(payload) {
    const rows = (payload && (payload.candlesticks || payload.candles)) || [];
    const points = [];
    rows.forEach((row) => {
      const price = row && row.price ? TB.num(row.price.close_dollars) : null;
      const ts = row && TB.num(row.end_period_ts);
      if (price !== null && ts !== null) points.push({ ts: ts, price: price });
    });
    return points;
  }

  function compactPoints(rows) {
    return (rows || []).map((row) => ({ ts: row[0], price: row[1] })).filter((p) => p.price !== null && p.price !== undefined);
  }

  function normalizeBackendLive(payload, meta) {
    const updates = {};
    const quotes = (payload && payload.quotes) || {};
    Object.keys(quotes).forEach((ticker) => {
      const q = quotes[ticker] || {};
      const prices = q.prices || {};
      updates[ticker] = {
        ticker: ticker,
        mid: TB.num(prices.mid),
        bid: TB.num(prices.yes_bid),
        ask: TB.num(prices.yes_ask),
        last: TB.num(prices.last),
        volume_24h: TB.num((q.volume || {}).last_24h_contracts),
        open_interest: TB.num((q.volume || {}).open_interest_contracts),
        ts: Date.now() / 1000,
        market: { ticker: ticker, title: q.title },
        topic: (meta.get(ticker) || {}).topic
      };
    });
    return updates;
  }

  window.TBLive = { LiveFeed, loadData, candlePoints, compactPoints, normalizeBackendLive, getJSON };
})();
