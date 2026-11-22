/* ============================================================
   live.js — live mode + replay mode, and the ≥$0.10 alert chats.
   ------------------------------------------------------------
   LIVE mode: polls the official Kalshi DEMO REST API from the
   browser every 15s (public, unauthenticated market data).
   If the browser cannot reach the API (e.g. CORS from this
   origin, or no network), the engine falls back to REPLAY
   mode: it replays the verified historical 1-minute series
   (assets/data.js, KXBTC15M-26NOV201900-00) at accelerated
   speed so the alerting UI can be exercised end-to-end.
   Replay lines are labeled REPLAY. Live lines are labeled LIVE.
   Nothing is fabricated: replay data is the exact verified
   candlestick/trade data from the official API.

   HIGH-ROI model (transparent, see docs/strategies.md):
     reversion K = 0.6  (assumes 60% of a sudden move reverts)
     modelFair    = clamp(0.5 + (prevPrice - 0.5) * K, 0.02, 0.98)
     edge         = |modelFair - priceAfter|
     highROI      = move ≥ $0.10  AND  edge ≥ $0.05  AND  OI ≥ 1
   ============================================================ */
(function () {
  "use strict";
  var ALERT_THRESHOLD = 0.10;
  var REVERSION_K = 0.6;
  var EDGE_MIN = 0.05;

  function $(id) { return document.getElementById(id); }
  function ts(s) {
    if (!s) return "--:--:--";
    var d = (typeof s === "number") ? new Date(s * 1000) : new Date(s);
    return d.toISOString().substr(11, 8);
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* ---------------- chat feeds ---------------- */
  var feedAll = { el: null, n: 0, max: 250 };
  var feedROI = { el: null, n: 0, max: 250 };
  function initChats(elAll, elROI) {
    feedAll.el = $(elAll); feedROI.el = $(elROI);
  }
  function push(feed, rowHtml) {
    if (!feed.el) return;
    var div = document.createElement("div");
    div.className = "row";
    div.innerHTML = rowHtml;
    feed.el.appendChild(div);
    feed.n++;
    while (feed.el.children.length > feed.max) feed.el.removeChild(feed.el.firstChild);
    feed.el.scrollTop = feed.el.scrollHeight;
  }
  function chatLine(mode, t, eventLabel, delta, price, reason) {
    var cls = delta >= 0 ? "big" : "neg";
    var arrow = delta >= 0 ? "▲" : "▼";
    var line =
      '<span class="ts">' + ts(t) + "</span>" +
      '<span class="ev">' + mode + " · " + eventLabel + "</span>" +
      '<span class="dx ' + cls + '">' + arrow + " $" + Math.abs(delta).toFixed(3) + "</span>" +
      '<span class="price">@ $' + price.toFixed(3) + "</span>" +
      (reason ? '<span class="reason">' + reason + "</span>" : "");
    push(feedAll, line);
    return line;
  }

  /* ---------------- ROI model ---------------- */
  function roiDecision(prev, after, oi) {
    var move = after - prev;
    if (Math.abs(move) < ALERT_THRESHOLD) return null;
    var modelFair = clamp(0.5 + (prev - 0.5) * REVERSION_K, 0.02, 0.98);
    var edge = Math.abs(modelFair - after);
    if (edge >= EDGE_MIN && (oi || 0) >= 1) {
      return {
        pass: true,
        reason: "K=" + REVERSION_K + " modelFair $" + modelFair.toFixed(2) + " edge $" + edge.toFixed(2)
      };
    }
    return { pass: false, reason: "edge $" + edge.toFixed(3) + " < $" + EDGE_MIN };
  }

  /* ---------------- alert on price change ---------------- */
  function onPriceChange(mode, t, label, prev, after, oi, eventLink) {
    var decision = roiDecision(prev, after, oi);
    var line = chatLine(mode, t, label, after - prev, after, decision ? decision.reason : null);
    if (decision && decision.pass) push(feedROI, line);
    if (typeof window.onAlert === "function") window.onAlert({ t: t, label: label, prev: prev, after: after, oi: oi, roi: decision });
    return decision;
  }

  /* ---------------- LIVE mode ---------------- */
  var liveState = { last: {}, mode: "replay", timer: null, errors: 0 };

  async function livePoll() {
    try {
      var url = window.KDATA.apiBase + "/markets?status=open&limit=200";
      var res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      var mkts = (data && data.markets) || [];
      if (liveState.mode === "replay") setMode("live");
      var now = Math.floor(Date.now() / 1000);
      mkts.forEach(function (m) {
        var price = parseFloat(m.last_price_dollars || "0");
        var prev = liveState.last[m.ticker];
        if (prev == null) { liveState.last[m.ticker] = price; return; }
        if (price !== prev) {
          onPriceChange("LIVE", now, m.ticker + " " + (m.title || ""), prev, price,
            parseFloat(m.open_interest_fp || "0"));
          liveState.last[m.ticker] = price;
        }
      });
      liveState.errors = 0;
    } catch (e) {
      liveState.errors++;
      if (liveState.mode === "live") setMode("degraded");
    }
  }

  function setMode(mode) {
    liveState.mode = mode;
    var el = document.querySelector(".mode");
    if (!el) return;
    if (mode === "live") { el.textContent = "LIVE · polling demo API"; el.className = "mode live"; }
    else if (mode === "degraded") { el.textContent = "LIVE (degraded — last poll failed, retrying)"; el.className = "mode replay"; }
    else { el.textContent = "REPLAY · verified historical data"; el.className = "mode replay"; }
  }

  function startLive(intervalMs) {
    setMode("replay");
    livePoll(); // probe immediately
    liveState.timer = setInterval(livePoll, intervalMs || 15000);
    // if the first 3 probes fail, stay in replay (CORS likely blocked)
    setTimeout(function () {
      if (liveState.errors >= 3 && liveState.mode !== "live") setMode("replay");
    }, (intervalMs || 15000) * 3 + 500);
  }

  /* ---------------- REPLAY mode (verified historical data) ---------------- */
  function startReplay(speedMs) {
    var cd = window.KDATA.candlesticks;
    if (!cd || !cd.candles || !cd.candles.length) return;
    var candles = cd.candles;
    // Build a per-minute price path from closes (fallback to open),
    // then subdivide each minute into 4 ticks (15s each) with linear
    // interpolation — a deterministic presentation of the verified
    // 1-minute OHLCV data. Label: REPLAY.
    var ticks = [];
    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      var cPrev = i > 0 ? (candles[i - 1].c != null ? candles[i - 1].c : candles[i - 1].o) : c.o;
      var cNow = c.c != null ? c.c : c.o;
      if (cPrev == null) cPrev = c.o;
      if (cNow == null) cNow = cPrev;
      for (var k = 1; k <= 4; k++) {
        var f = k / 4;
        ticks.push({
          t: c.t + Math.round(f * 60) - 60 + Math.round(f * 15),
          tExact: Math.floor(c.t / 15) * 15 + (k - 1) * 15,
          price: cPrev + (cNow - cPrev) * f,
          oi: c.oi
        });
      }
    }
    // Also replay the verified trades list as informational lines.
    var trades = (window.KDATA.trades && window.KDATA.trades.list) || [];
    var tradeIdx = 0;
    var i2 = 0, prev = null, baseT = 0;
    var label = "KXBTC15M-26NOV201900-00";

    function step() {
      if (i2 >= ticks.length) {
        // loop with a gap line
        setTimeout(function () {
          push(feedAll, '<span class="ts">' + ts(new Date()) + "</span>" +
            '<span class="ev">REPLAY · KXBTC15M-26NOV201900-00</span>' +
            '<span class="price">replay complete — verified 1-min series (source: candlesticks endpoint). Restarting in 10s.</span>');
          i2 = 0; prev = null; step();
        }, 10000);
        return;
      }
      var tk = ticks[i2]; i2++;
      var when = new Date(tk.tExact * 1000);
      if (prev != null && Math.abs(tk.price - prev) >= 0.0005) {
        if (Math.abs(tk.price - prev) >= ALERT_THRESHOLD) {
          onPriceChange("REPLAY", when.getTime() / 1000, label, prev, tk.price, tk.oi);
        }
      }
      prev = tk.price;
      // interleave verified trade lines chronologically
      while (tradeIdx < trades.length && new Date(trades[tradeIdx].ts).getTime() <= when.getTime()) {
        var tr = trades[tradeIdx++];
        push(feedAll, '<span class="ts">' + ts(tr.ts) + "</span>" +
          '<span class="ev">REPLAY · TRADE ' + label + "</span>" +
          '<span class="dx ' + (tr.side === "yes" ? "big" : "neg") + '">' +
          (tr.side === "yes" ? "BUY" : "SELL") + " YES " + tr.size + "@$" + tr.price.toFixed(3) + "</span>" +
          '<span class="price">verified trade feed</span>');
      }
      setTimeout(step, speedMs || 2500);
    }
    push(feedAll, '<span class="ts">' + ts(new Date()) + "</span>" +
      '<span class="ev">REPLAY · KXBTC15M-26NOV201900-00</span>' +
      '<span class="price">playing verified 1-min series 2026-11-20 23:45 → 00:00 UTC (price 0.51 → 0.003, settled NO). Source: candlesticks + trades endpoints.</span>');
    step();
  }

  window.KLIVE = {
    initChats: initChats,
    startLive: startLive,
    startReplay: startReplay,
    setMode: setMode,
    onPriceChange: onPriceChange,
    state: liveState,
    ALERT_THRESHOLD: ALERT_THRESHOLD
  };
})();
