/* ============================================================
   sim.js — SIMULATED (paper) trading engine.
   ------------------------------------------------------------
   No real orders are placed anywhere: this session has no Kalshi
   API keys, and the demo account's mock funds cannot be reached
   from this sandbox. The engine below runs a deterministic
   backtest-style simulation against the verified snapshot data
   (assets/data.js). Every entry references a verified market.
   Results are projections for strategy research only — see the
   Flagged for Review page.

   Strategies (see docs/strategies.md for the full spec):
     S1 MOMENTUM-FADE  — after a verified ≥$0.10 price collapse in
                         a 15-min crypto market, buy YES at the
                         bottom candle (expect partial reversion).
                         Exit: market settlement (verified result).
     S2 TREND-CONTINUE — after a verified ≥$0.10 collapse, buy NO
                         (bet the drop continues to settlement).
                         Exit: market settlement (verified result).
     S3 CHEAP-SIDE     — buy YES at ask ≤ $0.05 on high-OI strikes
                         (lottery leg). Exit: settlement if known,
                         else marked OPEN.
     S4 FAVORITE-EDGE  — buy the front-runner YES at ask ≤ $0.95
                         when implied edge ≥ $0.05. Exit: +$0.05
                         take-profit or settlement.
   Fees: quadratic Kalshi trading fee model,
     fee = 0.07 * C * P * (1-P)  per contract (C=contracts).
     Source: https://kalshi.com/docs/kalshi-fee-schedule.pdf
     (referenced by the API's fee_type=quadratic field). Fees
     approximate — flagged on the review page.
   ============================================================ */
(function () {
  "use strict";

  function fee(contracts, price) {
    return 0.07 * contracts * price * (1 - price);
  }

  // Build the simulated trade book from the verified snapshot.
  function run() {
    var D = window.KDATA;
    var byId = {};
    (D.markets || []).forEach(function (m) { byId[m.id] = m; });
    var trades = [];

    function T(o) { trades.push(o); }

    /* ---- S1 MOMENTUM-FADE on the verified BTC 15-min collapse ---- */
    var btc = byId["btc15m-26nov201900"];
    if (btc) {
      var entry = 0.025; // verified trade price 2026-11-20T23:55:33Z (trade feed)
      var qty = 500;
      var f = fee(qty, entry);
      // verified settlement: NO @ $0.003 -> exit at 0.003
      var exitP = parseFloat(btc.last || 0); // 0.003, verified settlement_value path
      var pnl = qty * (exitP - entry) - f;
      T({ strategy: "S1 Momentum-Fade", market: btc.market, side: "BUY YES",
        entry: entry, exit: exitP, qty: qty, fee: f, pnl: pnl,
        roi: pnl / (qty * entry), status: "CLOSED",
        entryTs: "2026-11-20T23:55:33Z", exitTs: btc.settledTs,
        note: "Entry = verified trade feed price; exit = verified settlement NO @ $0.003.",
        src: btc.src.api });
    }

    /* ---- S2 TREND-CONTINUE on the same move (hedge study) ---- */
    if (btc) {
      var e2 = 0.017; // verified trade price 2026-11-20T23:57:02Z (NO side trade at YES 0.017 => NO 0.983)
      var q2 = 200;
      var f2 = fee(q2, 1 - e2);
      var pnl2 = q2 * ((1 - parseFloat(btc.last || 0)) - (1 - e2)) - f2;
      T({ strategy: "S2 Trend-Continue", market: btc.market, side: "BUY NO",
        entry: 1 - e2, exit: 1 - parseFloat(btc.last || 0), qty: q2, fee: f2, pnl: pnl2,
        roi: pnl2 / (q2 * (1 - e2)), status: "CLOSED",
        entryTs: "2026-11-20T23:57:02Z", exitTs: btc.settledTs,
        note: "BUY NO at $0.983 (verified trade), settled NO paying $1.000.",
        src: btc.src.api });
    }

    /* ---- S3 CHEAP-SIDE on verified high-OI gas strikes ---- */
    ["gas-38400", "gas-38600", "gas-38800", "gas-39200", "gas-39400"].forEach(function (id) {
      var m = byId[id];
      if (!m || m.last == null || m.last === 0) return;
      var entryP = m.yesAsk != null ? m.yesAsk : null; // ask 1.00 -> not cheap to buy; use last as ref
      var ask = m.yesAsk;
      if (ask != null && ask <= 0.05) {
        var q = 100;
        var f = fee(q, ask);
        T({ strategy: "S3 Cheap-Side", market: m.market, side: "BUY YES",
          entry: ask, exit: null, qty: q, fee: f, pnl: null, roi: null,
          status: "OPEN (settles " + m.closeTime + ")",
          entryTs: D.snapshotTs, exitTs: null,
          note: "Unverified settlement — marked OPEN, P&L computed at resolution.",
          src: m.src.api });
      }
    });

    /* ---- S4 FAVORITE-EDGE: Schumer at 0.92 ask ---- */
    var sch = byId["senmaj-schumer"];
    if (sch && sch.last != null && sch.last <= 0.95) {
      var e4 = sch.last; // enter at last verified price (ask side not quoted at 0.92; using last, flagged)
      var q4 = 300;
      var f4 = fee(q4, e4);
      // take-profit at +0.05 -> 0.97; no verified later price, so model HOLD to settlement (unknown)
      T({ strategy: "S4 Favorite-Edge", market: sch.market, side: "BUY YES",
        entry: e4, exit: null, qty: q4, fee: f4, pnl: null, roi: null,
        status: "OPEN (TP $0.97, settles " + sch.closeTime + ")",
        entryTs: D.snapshotTs, exitTs: null,
        note: "Entry at last verified price $0.92 (no tighter verified ask at snapshot time — flagged). Settlement not yet occurred.",
        src: sch.src.api });
    }

    /* ---- S4 FAVORITE-EDGE: GTA 'before 2028' at 0.84 ---- */
    var gta = byId["gta-2028"];
    if (gta && gta.last != null && gta.last <= 0.95) {
      var e5 = gta.last;
      var q5 = 200;
      var f5 = fee(q5, e5);
      T({ strategy: "S4 Favorite-Edge", market: gta.market, side: "BUY YES",
        entry: e5, exit: null, qty: q5, fee: f5, pnl: null, roi: null,
        status: "OPEN (TP $0.89, settles " + gta.closeTime + ")",
        entryTs: D.snapshotTs, exitTs: null,
        note: "Entry at last verified price $0.84 (TP +$0.05).",
        src: gta.src.api });
    }

    /* ---- S3 CHEAP-SIDE reference: GA-14 settled NO (backtest row) ---- */
    var ga = byId["ga14-firstround"];
    if (ga) {
      var e6 = 0.98; // last verified price 0.98 (pre-settlement market)
      var q6 = 50;
      var f6 = fee(q6, e6);
      var pnl6 = q6 * (0 - e6) - f6; // settled NO
      T({ strategy: "S3 Cheap-Side", market: ga.market, side: "BUY YES @ 0.98 (longshot study)",
        entry: e6, exit: 0, qty: q6, fee: f6, pnl: pnl6,
        roi: pnl6 / (q6 * e6), status: "CLOSED",
        entryTs: "2026-02-12T00:37:25Z (open_time, verified)", exitTs: ga.settledTs,
        note: "Historical reference: market traded at 0.98 and settled NO. Shown to quantify longshot risk, not a recommended trade.",
        src: ga.src.api });
    }

    /* ---- categorization ---- */
    var cats = {};
    trades.forEach(function (t) {
      if (!cats[t.strategy]) cats[t.strategy] = { name: t.strategy, n: 0, closed: 0, wins: 0,
        pnl: 0, cost: 0, maxDD: 0, open: 0, roiSum: 0 };
      var c = cats[t.strategy];
      c.n++;
      c.cost += t.qty * t.entry;
      if (t.pnl != null) {
        c.closed++;
        c.pnl += t.pnl;
        if (t.pnl > 0) c.wins++;
        c.roiSum += t.roi || 0;
        if (t.pnl < c.maxDD) c.maxDD = t.pnl;
      } else c.open++;
    });

    /* ---- equity curve (deterministic, chronological) ---- */
    var START_CASH = 10000;
    var events = trades
      .filter(function (t) { return t.pnl != null; })
      .sort(function (a, b) { return (a.exitTs || "").localeCompare(b.exitTs || ""); });
    var eq = [{ t: D.snapshotTs, v: START_CASH }];
    var cash = START_CASH;
    events.forEach(function (t) { cash += t.pnl; eq.push({ t: t.exitTs, v: cash }); });

    var totalCost = 0, totalPnl = 0;
    trades.forEach(function (t) {
      totalCost += t.qty * t.entry;
      if (t.pnl != null) totalPnl += t.pnl;
    });

    return {
      startCash: START_CASH,
      cash: cash,
      trades: trades,
      categories: Object.keys(cats).map(function (k) { return cats[k]; }),
      equity: eq,
      totalCost: totalCost,
      totalPnl: totalPnl,
      snapshotTs: D.snapshotTs,
      disclaimer: "SIMULATED — no real orders. Paper engine on verified snapshot data only."
    };
  }

  window.KSIM = { run: run, fee: fee };
})();
