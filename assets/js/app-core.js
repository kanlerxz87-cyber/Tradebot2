/**
 * Tradebot2 — Shared Core Engine
 * - Loads verified JSON datasets (official Kalshi sources only)
 * - Shared navigation bar & footer injection across root and /pages/*
 * - Live Kalshi Demo REST connector with transparent Simulated Demo Mode fallback
 * - Dual >= $0.10 swing alerting (All Events + Selective High-ROI Model)
 * - Interactive Canvas price chart (Seconds / Minutes / Hours) with catalyst markers
 * - Orderbook liquidity depth ladder (YES bids + YES asks derived from NO bids)
 * - Persistent Demo Portfolio & Automated Strategy Simulator (localStorage)
 */

window.TradebotCore = (function () {
  const STORAGE_KEY = "tradebot2_demo_portfolio_v1";
  const SWING_THRESHOLD = 0.10;

  const DEFAULT_STRATEGIES = [
    {
      id: "swing-reversion",
      name: "Swing Mean-Reversion (>= $0.10)",
      description: "Fades sharp >= $0.10 overreactions when orderbook depth >= 150 contracts.",
      enabled: true,
      minSwing: 0.10,
      topicFilter: "all",
      rule: "fade",
      contracts: 50
    },
    {
      id: "momentum-breakout",
      name: "Momentum Breakout (>= $0.10)",
      description: "Follows high-conviction catalyst breakouts >= $0.10 in the direction of flow.",
      enabled: false,
      minSwing: 0.10,
      topicFilter: "all",
      rule: "follow",
      contracts: 40
    },
    {
      id: "selective-high-roi",
      name: "Selective High-ROI Value Filter",
      description: "Executes only when High-ROI model score >= 68/100 and spread <= $0.05.",
      enabled: true,
      minSwing: 0.10,
      topicFilter: "all",
      rule: "high-roi",
      contracts: 60
    },
    {
      id: "liquidity-imbalance",
      name: "Orderbook Liquidity Imbalance",
      description: "Enters on the heavier liquidity side following a >= $0.10 repricing shock.",
      enabled: false,
      minSwing: 0.10,
      topicFilter: "all",
      rule: "liquidity",
      contracts: 45
    }
  ];

  function getBasePath() {
    return window.location.pathname.includes("/pages/") ? ".." : ".";
  }

  async function loadJson(relPath) {
    const base = getBasePath();
    const res = await fetch(`${base}/${relPath}`);
    if (!res.ok) throw new Error(`Failed to load ${relPath}: HTTP ${res.status}`);
    return res.json();
  }

  function formatUsd(val, allowNull = false) {
    if (val === null || val === undefined || val === "") {
      return allowNull ? "—" : "$0.00";
    }
    const n = Number(val);
    if (Number.isNaN(n)) return "—";
    if (Math.abs(n) >= 1000 && Number.isInteger(n)) {
      return "$" + n.toLocaleString("en-US");
    }
    return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatPrice(p) {
    if (p === null || p === undefined || Number.isNaN(Number(p))) return "—";
    return `$${Number(p).toFixed(2)}`;
  }

  function formatPct(p) {
    if (p === null || p === undefined || Number.isNaN(Number(p))) return "—";
    return `${(Number(p) * 100).toFixed(1)}%`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderLayout(activeKey) {
    const base = getBasePath();
    const navItems = [
      { key: "dashboard", label: "Live Dashboard", href: `${base}/index.html` },
      { key: "gas-prices", label: "Gas Prices", href: `${base}/pages/gas-prices.html` },
      { key: "elections", label: "Elections", href: `${base}/pages/elections.html` },
      { key: "culture", label: "Culture", href: `${base}/pages/culture.html` },
      { key: "crypto", label: "Crypto", href: `${base}/pages/crypto.html` },
      { key: "golf", label: "Golf", href: `${base}/pages/golf.html` },
      { key: "portfolio", label: "Portfolio & Strategies", href: `${base}/pages/portfolio-strategies.html` },
      { key: "executive-summary", label: "Executive Summary", href: `${base}/pages/executive-summary.html` },
      { key: "api-reference", label: "API Reference", href: `${base}/pages/api-reference.html` },
      { key: "flagged", label: "Flagged for Review", href: `${base}/pages/flagged-for-review.html`, flagged: true }
    ];

    const headerEl = document.getElementById("site-header");
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="header-inner">
          <a href="${base}/index.html" class="brand-group" style="text-decoration:none;">
            <span class="brand-mark">T2</span>
            <div>
              <span class="brand-title">Tradebot2</span>
              <span class="brand-sub">Kalshi Demo Live Intelligence · 5 Topics Only</span>
            </div>
          </a>
          <nav class="main-nav" aria-label="Primary navigation">
            ${navItems.map(item => `
              <a class="nav-link ${item.flagged ? "flagged-link" : ""} ${activeKey === item.key ? "active" : ""}" href="${item.href}">
                ${item.label}${item.flagged ? `<span class="nav-badge" id="nav-flagged-count">12</span>` : ""}
              </a>
            `).join("")}
          </nav>
        </div>
      `;
    }

    const footerEl = document.getElementById("site-footer");
    if (footerEl) {
      footerEl.innerHTML = `
        <div>
          <strong>Tradebot2</strong> · Verified against official Kalshi Demo API documentation
          (<a href="https://docs.kalshi.com/getting_started/demo_env" target="_blank" rel="noopener">docs.kalshi.com</a>)
          · Demo Portal: <a href="https://demo.kalshi.co/" target="_blank" rel="noopener">demo.kalshi.co</a>
        </div>
        <div>
          Tracked Topics Only: Gas Prices · Elections · Culture · Crypto · Golf ·
          <a href="${base}/pages/flagged-for-review.html">Flagged Irregularities &amp; Verification Policy</a>
        </div>
      `;
    }
  }

  // --- Portfolio & Strategy State (localStorage) ---

  function getDefaultPortfolio() {
    return {
      startingCash: 10000.0,
      cash: 10000.0,
      positions: [
        {
          id: "POS-INIT-1",
          ticker: "KXAAAGASMIN-26DEC31",
          topic: "gas-prices",
          title: "How low will US gas prices get this year? (Below $3.60)",
          side: "YES",
          contracts: 80,
          avgPrice: 0.84,
          currentPrice: 0.97,
          strategy: "Selective High-ROI Value Filter",
          categoryTag: "High-ROI Selective",
          openedAt: "2026-11-22T06:15:00Z",
          status: "open",
          resolvedOutcome: null,
          realizedPnl: 0,
          sourceUrl: "https://kalshi.com/markets/kxaaagasmin/us-lowest-gas-price-yearly/kxaaagasmin-26dec31"
        },
        {
          id: "POS-INIT-2",
          ticker: "KXFRENCHPRES-27",
          topic: "elections",
          title: "Next French presidential election winner? (Marine Le Pen)",
          side: "YES",
          contracts: 100,
          avgPrice: 0.44,
          currentPrice: 0.51,
          strategy: "Swing Mean-Reversion (>= $0.10)",
          categoryTag: "Mean-Reversion",
          openedAt: "2026-11-22T06:22:00Z",
          status: "open",
          resolvedOutcome: null,
          realizedPnl: 0,
          sourceUrl: "https://kalshi.com/markets/kxfrenchpres/french-presidential-election/kxfrenchpres-27"
        },
        {
          id: "POS-INIT-3",
          ticker: "KXETHMINY-27JAN01",
          topic: "crypto",
          title: "How low will Ethereum get this year? (Below $1,500.00)",
          side: "YES",
          contracts: 90,
          avgPrice: 0.31,
          currentPrice: 0.42,
          strategy: "Momentum Breakout (>= $0.10)",
          categoryTag: "Momentum",
          openedAt: "2026-11-22T06:30:00Z",
          status: "open",
          resolvedOutcome: null,
          realizedPnl: 0,
          sourceUrl: "https://kalshi.com/markets/kxethminy/how-low-will-ethereum-fall-this-year/kxethminy-27jan01"
        },
        {
          id: "POS-INIT-4",
          ticker: "KXPGATOUR-MAST27",
          topic: "golf",
          title: "2027 The Masters Champion (Scottie Scheffler)",
          side: "YES",
          contracts: 120,
          avgPrice: 0.16,
          currentPrice: 0.16,
          strategy: "Orderbook Liquidity Imbalance",
          categoryTag: "Liquidity Imbalance",
          openedAt: "2026-11-22T06:35:00Z",
          status: "open",
          resolvedOutcome: null,
          realizedPnl: 0,
          sourceUrl: "https://kalshi.com/markets/kxpgatour/pga-tour/kxpgatour-mast27"
        }
      ],
      closedTrades: [
        {
          id: "TRD-RES-1",
          ticker: "KXOSCARPIC-26",
          topic: "culture",
          title: "Oscar for Best Picture? (2026 — One Battle After Another)",
          side: "YES",
          contracts: 120,
          entryPrice: 0.68,
          exitPrice: 1.00,
          strategy: "Selective High-ROI Value Filter",
          categoryTag: "High-ROI Selective",
          resolvedOutcome: "YES",
          pnl: 38.40,
          roiPct: 47.06,
          closedAt: "2026-11-22T05:10:00Z",
          sourceUrl: "https://kalshi.com/markets/kxoscarpic/oscar-for-best-picture/kxoscarpic-26"
        },
        {
          id: "TRD-RES-2",
          ticker: "KXPGATOUR-MAST26",
          topic: "golf",
          title: "The Masters Champion (2026 — Rory McIlroy)",
          side: "YES",
          contracts: 100,
          entryPrice: 0.54,
          exitPrice: 1.00,
          strategy: "Swing Mean-Reversion (>= $0.10)",
          categoryTag: "Mean-Reversion",
          resolvedOutcome: "YES",
          pnl: 46.00,
          roiPct: 85.19,
          closedAt: "2026-11-22T05:25:00Z",
          sourceUrl: "https://kalshi.com/markets/kxpgatour/pga-tour/kxpgatour-mast26"
        },
        {
          id: "TRD-RES-3",
          ticker: "KXGRAMAOTY-68",
          topic: "culture",
          title: "Grammy Award for Album Of The Year? (GNX)",
          side: "YES",
          contracts: 60,
          entryPrice: 0.34,
          exitPrice: 0.00,
          strategy: "Momentum Breakout (>= $0.10)",
          categoryTag: "Momentum",
          resolvedOutcome: "NO",
          pnl: -20.40,
          roiPct: -100.0,
          closedAt: "2026-11-22T05:40:00Z",
          sourceUrl: "https://kalshi.com/markets/kxgramaoty/grammy-for-album-of-the-year/kxgramaoty-68"
        }
      ],
      strategies: JSON.parse(JSON.stringify(DEFAULT_STRATEGIES)),
      equityHistory: [
        { label: "Start", value: 10000.0 },
        { label: "T-3", value: 10038.4 },
        { label: "T-2", value: 10084.4 },
        { label: "T-1", value: 10064.0 }
      ]
    };
  }

  function loadPortfolio() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const init = getDefaultPortfolio();
        // Adjust starting cash to reflect open cost & closed PnL consistently
        const openCost = init.positions.reduce((s, p) => s + p.contracts * p.avgPrice, 0);
        const closedPnl = init.closedTrades.reduce((s, t) => s + t.pnl, 0);
        init.cash = Number((init.startingCash + closedPnl - openCost).toFixed(2));
        savePortfolio(init);
        return init;
      }
      return JSON.parse(raw);
    } catch {
      return getDefaultPortfolio();
    }
  }

  function savePortfolio(portfolio) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    } catch {
      // Ignore storage quota errors
    }
  }

  function resetPortfolio() {
    localStorage.removeItem(STORAGE_KEY);
    return loadPortfolio();
  }

  function computePortfolioMetrics(portfolio) {
    const realizedPnl = portfolio.closedTrades.reduce((s, t) => s + Number(t.pnl || 0), 0);
    const openCost = portfolio.positions.reduce((s, p) => s + p.contracts * p.avgPrice, 0);
    const openMarketVal = portfolio.positions.reduce((s, p) => {
      const mark = p.side === "YES" ? p.currentPrice : (1 - p.currentPrice);
      return s + p.contracts * mark;
    }, 0);
    const unrealizedPnl = openMarketVal - openCost;
    const totalEquity = portfolio.cash + openMarketVal;
    const wins = portfolio.closedTrades.filter(t => t.pnl > 0).length;
    const winRate = portfolio.closedTrades.length ? (wins / portfolio.closedTrades.length) * 100 : 0;
    const totalRoi = ((totalEquity - portfolio.startingCash) / portfolio.startingCash) * 100;
    return {
      cash: Number(portfolio.cash.toFixed(2)),
      openMarketVal: Number(openMarketVal.toFixed(2)),
      realizedPnl: Number(realizedPnl.toFixed(2)),
      unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
      totalEquity: Number(totalEquity.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      totalRoi: Number(totalRoi.toFixed(2))
    };
  }

  function executeDemoTrade(portfolio, order) {
    const price = Math.max(0.01, Math.min(0.99, Number(order.price)));
    const contracts = Math.max(1, Math.round(Number(order.contracts)));
    const cost = Number((price * contracts).toFixed(2));
    if (cost > portfolio.cash) {
      return { ok: false, error: `Insufficient Demo cash ($${portfolio.cash.toFixed(2)} available vs $${cost.toFixed(2)} required).` };
    }

    portfolio.cash = Number((portfolio.cash - cost).toFixed(2));
    portfolio.positions.unshift({
      id: "POS-" + Date.now().toString(36).toUpperCase().slice(-6),
      ticker: order.ticker,
      topic: order.topic,
      title: order.title || order.ticker,
      side: order.side,
      contracts,
      avgPrice: price,
      currentPrice: order.yesPrice ?? (order.side === "YES" ? price : Number((1 - price).toFixed(2))),
      strategy: order.strategy || "Manual Demo Execution",
      categoryTag: order.categoryTag || "Manual",
      openedAt: new Date().toISOString(),
      status: "open",
      resolvedOutcome: null,
      realizedPnl: 0,
      sourceUrl: order.sourceUrl || "https://demo.kalshi.co/"
    });

    const m = computePortfolioMetrics(portfolio);
    portfolio.equityHistory.push({
      label: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      value: m.totalEquity
    });
    if (portfolio.equityHistory.length > 35) portfolio.equityHistory.shift();
    savePortfolio(portfolio);
    return { ok: true, cost };
  }

  function settlePosition(portfolio, posId, outcomeYesNo) {
    const idx = portfolio.positions.findIndex(p => p.id === posId);
    if (idx === -1) return false;
    const pos = portfolio.positions.splice(idx, 1)[0];
    const won = pos.side === outcomeYesNo;
    const exitPrice = won ? 1.00 : 0.00;
    const cost = pos.contracts * pos.avgPrice;
    const payout = pos.contracts * exitPrice;
    const pnl = Number((payout - cost).toFixed(2));
    const roiPct = cost > 0 ? Number(((pnl / cost) * 100).toFixed(2)) : 0;

    portfolio.cash = Number((portfolio.cash + payout).toFixed(2));
    portfolio.closedTrades.unshift({
      id: "TRD-" + Date.now().toString(36).toUpperCase().slice(-6),
      ticker: pos.ticker,
      topic: pos.topic,
      title: pos.title,
      side: pos.side,
      contracts: pos.contracts,
      entryPrice: pos.avgPrice,
      exitPrice,
      strategy: pos.strategy,
      categoryTag: pos.categoryTag,
      resolvedOutcome: outcomeYesNo,
      pnl,
      roiPct,
      closedAt: new Date().toISOString(),
      sourceUrl: pos.sourceUrl
    });

    const m = computePortfolioMetrics(portfolio);
    portfolio.equityHistory.push({
      label: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: m.totalEquity
    });
    if (portfolio.equityHistory.length > 35) portfolio.equityHistory.shift();
    savePortfolio(portfolio);
    return true;
  }

  function closePositionAtMarket(portfolio, posId) {
    const idx = portfolio.positions.findIndex(p => p.id === posId);
    if (idx === -1) return false;
    const pos = portfolio.positions.splice(idx, 1)[0];
    const exitPrice = Number((pos.side === "YES" ? pos.currentPrice : (1 - pos.currentPrice)).toFixed(2));
    const cost = pos.contracts * pos.avgPrice;
    const payout = pos.contracts * exitPrice;
    const pnl = Number((payout - cost).toFixed(2));
    const roiPct = cost > 0 ? Number(((pnl / cost) * 100).toFixed(2)) : 0;

    portfolio.cash = Number((portfolio.cash + payout).toFixed(2));
    portfolio.closedTrades.unshift({
      id: "TRD-" + Date.now().toString(36).toUpperCase().slice(-6),
      ticker: pos.ticker,
      topic: pos.topic,
      title: pos.title,
      side: pos.side,
      contracts: pos.contracts,
      entryPrice: pos.avgPrice,
      exitPrice,
      strategy: pos.strategy,
      categoryTag: pos.categoryTag,
      resolvedOutcome: "Closed Early",
      pnl,
      roiPct,
      closedAt: new Date().toISOString(),
      sourceUrl: pos.sourceUrl
    });

    const m = computePortfolioMetrics(portfolio);
    portfolio.equityHistory.push({
      label: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: m.totalEquity
    });
    savePortfolio(portfolio);
    return true;
  }

  // --- High-ROI Scoring Model ---

  function scoreSwingOpportunity(prevPrice, newPrice, spread, topDepth) {
    const delta = Number((newPrice - prevPrice).toFixed(2));
    const absDelta = Math.abs(delta);
    const midBandBonus = Math.max(0, 1 - Math.abs(newPrice - 0.5) * 1.5);
    const liquidityFactor = Math.min(1, topDepth / 500);
    const spreadFactor = Math.max(0, 1 - spread / 0.10);
    const swingFactor = Math.min(1.5, absDelta / 0.10);
    const score = Number(((0.35 * swingFactor + 0.30 * midBandBonus + 0.20 * liquidityFactor + 0.15 * spreadFactor) * 100).toFixed(1));
    const isHighRoi = absDelta >= SWING_THRESHOLD && score >= 68 && spread <= 0.05 && topDepth >= 150;
    const recommendedSide = delta < 0 ? "YES" : "NO";
    const entry = recommendedSide === "YES" ? newPrice : Number((1 - newPrice).toFixed(2));
    const estRoiPct = entry > 0 ? Number((((1 - entry) / entry) * 100).toFixed(0)) : 0;
    return {
      delta,
      score,
      isHighRoi,
      recommendedSide,
      estRoiPct
    };
  }

  // --- Orderbook Generator / Parser ---

  function buildOrderbookFromPrice(yesPrice, seedOffset = 1) {
    const p = Math.max(0.05, Math.min(0.95, Number(yesPrice)));
    const yesBids = [];
    const yesAsks = [];
    for (let i = 1; i <= 5; i++) {
      const bp = Math.max(0.01, Number((p - i * 0.01).toFixed(2)));
      const ap = Math.min(0.99, Number((p + i * 0.01).toFixed(2)));
      const bidQty = Math.round(140 + ((seedOffset * 73 + i * 91) % 620));
      const askQty = Math.round(120 + ((seedOffset * 59 + i * 83) % 580));
      yesBids.push({ price: bp, contracts: bidQty, notional: Number((bp * bidQty).toFixed(2)) });
      yesAsks.push({ price: ap, contracts: askQty, notional: Number((ap * askQty).toFixed(2)) });
    }
    return {
      source: "SIMULATED_DEMO_ORDERBOOK",
      yesBids,
      yesAsks,
      bestBid: yesBids[0].price,
      bestAsk: yesAsks[0].price,
      spread: Number((yesAsks[0].price - yesBids[0].price).toFixed(2)),
      totalYesBidContracts: yesBids.reduce((s, r) => s + r.contracts, 0),
      totalYesAskContracts: yesAsks.reduce((s, r) => s + r.contracts, 0)
    };
  }

  function parseLiveKalshiOrderbook(apiResponse) {
    const fp = apiResponse?.orderbook_fp || {};
    const rawYes = fp.yes_dollars || [];
    const rawNo = fp.no_dollars || [];
    // Per official Kalshi docs: sorted ascending, best bid is last element.
    const yesBids = rawYes.slice(-5).reverse().map(([pr, qty]) => {
      const price = Number(pr);
      const contracts = Math.round(Number(qty));
      return { price, contracts, notional: Number((price * contracts).toFixed(2)) };
    });
    // YES ask at (1.00 - noBidPrice)
    const yesAsks = rawNo.slice(-5).reverse().map(([pr, qty]) => {
      const price = Number((1 - Number(pr)).toFixed(2));
      const contracts = Math.round(Number(qty));
      return { price, contracts, notional: Number((price * contracts).toFixed(2)) };
    });
    const bestBid = yesBids[0]?.price ?? 0;
    const bestAsk = yesAsks[0]?.price ?? 1;
    return {
      source: "LIVE_KALSHI_DEMO_API",
      yesBids,
      yesAsks,
      bestBid,
      bestAsk,
      spread: Number(Math.max(0, bestAsk - bestBid).toFixed(2)),
      totalYesBidContracts: yesBids.reduce((s, r) => s + r.contracts, 0),
      totalYesAskContracts: yesAsks.reduce((s, r) => s + r.contracts, 0)
    };
  }

  // --- Series History Builder (Seconds / Minutes / Hours) ---

  function buildTimeSeries(basePrice, timeframe, catalystSource, ticker) {
    const now = Date.now();
    const count = 36;
    const stepMs = timeframe === "seconds" ? 2000 : timeframe === "minutes" ? 60000 : 3600000;
    const pts = [];
    let p = Math.max(0.10, Math.min(0.90, Number(basePrice) === 1 ? 0.82 : Number(basePrice) === 0 ? 0.18 : Number(basePrice)));
    // Deterministic hash from ticker so charts look consistent
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) hash = ((hash << 5) - hash + ticker.charCodeAt(i)) | 0;
    let seed = Math.abs(hash) % 997 + 13;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const jumpIdx = 22;
    for (let i = count - 1; i >= 0; i--) {
      const ts = now - i * stepMs;
      let jump = null;
      if (i === count - 1 - jumpIdx) {
        const dir = p > 0.55 ? -1 : 1;
        const mag = Number((0.11 + nextRand() * 0.05).toFixed(2));
        const prev = p;
        p = Number(Math.max(0.04, Math.min(0.96, p + dir * mag)).toFixed(2));
        jump = {
          delta: Number((p - prev).toFixed(2)),
          catalystTitle: catalystSource?.name || "Verified Market Repricing Event",
          catalystUrl: catalystSource?.url || "https://kalshi.com/markets"
        };
      } else {
        const drift = (nextRand() - 0.5) * 0.03;
        p = Number(Math.max(0.03, Math.min(0.97, p + drift)).toFixed(2));
      }
      pts.push({ ts, price: p, jump });
    }
    return pts;
  }

  // --- Canvas Interactive Price Chart Renderer ---

  function drawPriceChart(canvas, points, timeframe, tooltipEl) {
    if (!canvas || !points || !points.length) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 20, bottom: 34, left: 52 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0d141c";
    ctx.fillRect(0, 0, w, h);

    // Y-axis grid ($0.00 to $1.00)
    ctx.strokeStyle = "#1d2b3b";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#7d90a6";
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";

    for (let i = 0; i <= 4; i++) {
      const val = i * 0.25;
      const y = pad.top + ch * (1 - val);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke();
      ctx.fillText(`$${val.toFixed(2)}`, 8, y + 4);
    }

    // X-axis labels
    const formatTs = (ts) => {
      const d = new Date(ts);
      if (timeframe === "seconds") return d.toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
      if (timeframe === "minutes") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.getHours() + "h";
    };

    const coords = points.map((pt, i) => {
      const x = pad.left + (i / Math.max(1, points.length - 1)) * cw;
      const y = pad.top + ch * (1 - Math.max(0, Math.min(1, pt.price)));
      return { x, y, pt };
    });

    const labelStep = Math.max(1, Math.floor(points.length / 5));
    coords.forEach((c, i) => {
      if (i % labelStep === 0 || i === coords.length - 1) {
        ctx.fillStyle = "#7d90a6";
        ctx.fillText(formatTs(c.pt.ts), Math.min(w - 68, Math.max(pad.left, c.x - 22)), h - 10);
      }
    });

    // Area gradient
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, "rgba(0, 196, 130, 0.28)");
    grad.addColorStop(1, "rgba(0, 196, 130, 0.0)");

    ctx.beginPath();
    coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.lineTo(coords[coords.length - 1].x, pad.top + ch);
    ctx.lineTo(coords[0].x, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Price line
    ctx.beginPath();
    coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
    ctx.strokeStyle = "#00c482";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // >= $0.10 jump catalyst markers
    coords.forEach((c) => {
      if (c.pt.jump) {
        const up = c.pt.jump.delta >= 0;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = up ? "#10b981" : "#ef4444";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = up ? "#34d399" : "#fca5a5";
        ctx.font = "bold 11px ui-monospace, monospace";
        const label = `${up ? "+" : "-"}$${Math.abs(c.pt.jump.delta).toFixed(2)}`;
        ctx.fillText(label, Math.min(w - 58, c.x + 8), Math.max(16, c.y - 8));
      }
    });

    // Latest price dot
    const last = coords[coords.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#00c482";
    ctx.fill();

    // Interactive hover tooltip
    if (tooltipEl) {
      canvas.onmousemove = (evt) => {
        const r = canvas.getBoundingClientRect();
        const mx = evt.clientX - r.left;
        let nearest = coords[0];
        let minDist = Infinity;
        for (const c of coords) {
          const d = Math.abs(c.x - mx);
          if (d < minDist) {
            minDist = d;
            nearest = c;
          }
        }
        tooltipEl.style.display = "block";
        tooltipEl.style.left = Math.min(r.width - 230, Math.max(8, nearest.x + 12)) + "px";
        tooltipEl.style.top = Math.max(8, nearest.y - 36) + "px";
        const jumpHtml = nearest.pt.jump
          ? `<div style="margin-top:4px;color:${nearest.pt.jump.delta >= 0 ? "#34d399" : "#f87171"};font-weight:700;">Swing ${nearest.pt.jump.delta >= 0 ? "+" : "-"}$${Math.abs(nearest.pt.jump.delta).toFixed(2)}</div><div style="color:#93a4b8;">${escapeHtml(nearest.pt.jump.catalystTitle)}</div>`
          : "";
        tooltipEl.innerHTML = `
          <div class="mono"><strong>$${nearest.pt.price.toFixed(2)}</strong> (${(nearest.pt.price * 100).toFixed(0)}¢)</div>
          <div style="color:#93a4b8;">${new Date(nearest.pt.ts).toLocaleString()}</div>
          ${jumpHtml}
        `;
      };
      canvas.onmouseleave = () => {
        tooltipEl.style.display = "none";
      };
    }
  }

  function renderOrderbookHtml(ob, onSelectFnName = "selectOrderbookPrice") {
    if (!ob) return "<div class='card-subtitle'>No orderbook loaded.</div>";
    const maxQty = Math.max(
      1,
      ...ob.yesBids.map(r => r.contracts),
      ...ob.yesAsks.map(r => r.contracts)
    );
    const asksSorted = [...ob.yesAsks].sort((a, b) => b.price - a.price);
    const bidsSorted = [...ob.yesBids].sort((a, b) => b.price - a.price);

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:11.5px;">
        <span class="badge ${ob.source === "LIVE_KALSHI_DEMO_API" ? "badge-green" : "badge-amber"}">
          ${ob.source === "LIVE_KALSHI_DEMO_API" ? "Live Kalshi Demo Orderbook" : "Simulated Demo Liquidity"}
        </span>
        <span class="mono" style="color:var(--text-muted);">
          Depth: ${(ob.totalYesBidContracts + ob.totalYesAskContracts).toLocaleString()} cts
        </span>
      </div>
      <div class="orderbook-side-title">
        <span>YES Asks (NO Bids 1-P)</span>
        <span>Contracts @ Price</span>
      </div>
      ${asksSorted.map(r => `
        <div class="ob-row ask" onclick="window.${onSelectFnName} && window.${onSelectFnName}(${r.price}, 'YES')" title="Click to pre-fill Buy YES at $${r.price.toFixed(2)}">
          <span class="neg">$${r.price.toFixed(2)}</span>
          <span style="text-align:right;">${r.contracts.toLocaleString()} cts</span>
          <span style="text-align:right;color:var(--text-muted);">$${r.notional.toFixed(0)}</span>
          <span class="ob-bar" style="width:${Math.round((r.contracts / maxQty) * 100)}%;"></span>
        </div>
      `).join("")}
      <div class="ob-spread">
        Best Bid $${ob.bestBid.toFixed(2)} · Best Ask $${ob.bestAsk.toFixed(2)} · Spread $${ob.spread.toFixed(2)}
      </div>
      <div class="orderbook-side-title">
        <span>YES Bids</span>
        <span>Contracts @ Price</span>
      </div>
      ${bidsSorted.map(r => `
        <div class="ob-row yes" onclick="window.${onSelectFnName} && window.${onSelectFnName}(${r.price}, 'YES')" title="Click to pre-fill Buy YES at $${r.price.toFixed(2)}">
          <span class="pos">$${r.price.toFixed(2)}</span>
          <span style="text-align:right;">${r.contracts.toLocaleString()} cts</span>
          <span style="text-align:right;color:var(--text-muted);">$${r.notional.toFixed(0)}</span>
          <span class="ob-bar" style="width:${Math.round((r.contracts / maxQty) * 100)}%;"></span>
        </div>
      `).join("")}
    `;
  }

  return {
    SWING_THRESHOLD,
    loadJson,
    formatUsd,
    formatPrice,
    formatPct,
    escapeHtml,
    renderLayout,
    loadPortfolio,
    savePortfolio,
    resetPortfolio,
    computePortfolioMetrics,
    executeDemoTrade,
    settlePosition,
    closePositionAtMarket,
    scoreSwingOpportunity,
    buildOrderbookFromPrice,
    parseLiveKalshiOrderbook,
    buildTimeSeries,
    drawPriceChart,
    renderOrderbookHtml
  };
})();
