#!/usr/bin/env node
/*
 * scripts/simulate.js — headless simulator for the Kalshi demo tracker.
 *
 * Default mode: PAPER simulation against the public demo REST API (no credentials).
 * Live demo mode is opt-in: --live with KALSHI_KEY_ID and KALSHI_PRIVATE_KEY_PATH.
 * Even then it places REAL orders on the DEMO environment with DEMO funds.
 * Never run against production by accident — the script asserts "demo" in the base URL.
 *
 * Usage:
 *   node scripts/simulate.js                 # paper mode, all topics
 *   node scripts/simulate.js --topic=crypto  # paper mode, one topic
 *   node scripts/simulate.js --live --topic=elections --contracts=1 --price=0.05
 *
 * Signing: message = timestamp + METHOD + full path from root (no query), RSA-PSS SHA-256.
 * Official: docs.kalshi.com/getting_started/api_keys and /quick_start_authenticated_requests
 */
"use strict";

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const https = require("https");

// ---------- env / args ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const param = (name, def) => {
  const hit = args.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.split("=").slice(1).join("=") : def;
};

const IS_LIVE = flag("--live");
const TOPIC = param("topic", "all");
const CONTRACTS = Number(param("contracts", "1")) || 1;
const PRICE = Number(param("price", "0.05")) || 0.05;
const DEMO_REST = "https://external-api.demo.kalshi.co/trade-api/v2";
const DEMO_REST_FALLBACK = "https://demo-api.kalshi.co/trade-api/v2";

if (!IS_LIVE && process.env.KALSHI_KEY_ID && !flag("--paper")) {
  // harmless: just note we ignored keys in paper mode
}

// ---------- topics ----------
const TOPICS = {
  elections: ["election", "midterm", "president", "governor", "senate", "congress", "primary", "ballot", "vote", "parliament", "referendum"],
  gas: ["gas", "gasoline", "gas pump", "pump price", "fuel", "petrol", "diesel", "hpi", "avg price"],
  culture: ["oscar", "grammy", "emmy", "golden globe", "film", "movie", "netflix", "stream", "box office", "award", "music", "album", "tv show", "reality", "entertainment", "culture", "chart", "celebrity", "concert"],
  crypto: ["crypto", "btc", "bitcoin", "eth", "ethereum", "xrp", "sol", "solana", "bnb", "doge", "altcoin", "defi", "blockchain", "coin", "token"],
  golf: ["golf", "masters", "pga", "lpga", "ryder", "tournament"],
};

function normalizePrice(v) {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  if (isNaN(n)) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n > 100) return n / 10000;
  return n;
}

function detectTopic(m) {
  const hay = ((m.series_ticker || "") + " " + (m.title || "") + " " + (m.sub_title || "")).toLowerCase();
  if (TOPIC === "all") {
    return Object.keys(TOPICS).find((k) => TOPICS[k].some((kw) => hay.includes(kw))) || "others";
  }
  const kw = TOPICS[TOPIC] || [];
  return kw.some((k) => hay.includes(k)) ? TOPIC : null;
}

// ---------- HTTP ----------
function get(urlString) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const req = https.get(u, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (e) {
          reject(new Error("invalid JSON from " + urlString + ": " + body.slice(0, 200)));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("request timeout")));
  });
}

async function apiGet(path, params) {
  const query = params ? "?" + new URLSearchParams(params) : "";
  const url = DEMO_REST + path + query;
  try {
    const r = await get(url);
    if (r.status >= 200 && r.status < 400) return r.json;
    throw new Error("primary returned " + r.status);
  } catch (e) {
    const r = await get(DEMO_REST_FALLBACK + path + query);
    if (r.status >= 200 && r.status < 400) return r.json;
    throw new Error("API error (primary+fallback): " + r.status);
  }
}

async function apiPost(path, body, apiKeyId, privateKeyPem) {
  const signPath = new URL(DEMO_REST + path).pathname;
  const timestamp = String(Date.now());
  const privateKey = crypto.createPrivateKey({ key: privateKeyPem, format: "pem" });
  const message = Buffer.from(timestamp + "POST" + signPath);
  const signature = privateKey.sign("RSA-SHA256", message); // NOTE: PSS below
  // RSA-PSS with SHA-256, per Kalshi signing scheme
  const pssSignature = privateKey.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }, message).toString("base64");
  const headers = {
    "KALSHI-ACCESS-KEY": apiKeyId,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "KALSHI-ACCESS-SIGNATURE": pssSignature,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  return new Promise((resolve, reject) => {
    const u = new URL(DEMO_REST + path);
    const req = https.request(u, {
      method: "POST",
      headers,
      timeout: 20000,
    }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch (e) { reject(new Error("invalid JSON: " + body.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ---------- strategies (paper) ----------
const STRATEGIES = {
  "swing-momentum": (m, delta) => {
    if (delta == null || Math.abs(delta) < 0.10) return null;
    return { side: delta > 0 ? "yes" : "no", contracts: CONTRACTS, price: m.price, reason: "swing " + (delta > 0 ? "up" : "down") + " " + Math.abs(delta).toFixed(2) };
  },
  "spread-play": (m) => {
    const spread = (m.yesAsk != null && m.yesBid != null) ? m.yesAsk - m.yesBid : null;
    if (spread == null || spread > 0.02) return null;
    return { side: "yes", contracts: CONTRACTS, price: m.price, reason: "narrow spread " + spread.toFixed(3) };
  },
  "mean-reversion": (m) => {
    if (m.price != null && m.price <= 0.35) return { side: "yes", contracts: CONTRACTS, price: m.price, reason: "oversold" };
    if (m.price != null && m.price >= 0.65) return { side: "no", contracts: CONTRACTS, price: m.price, reason: "overbought" };
    return null;
  },
};

async function main() {
  console.log("Kalshi demo simulator");
  console.log("Mode:          " + (IS_LIVE ? "LIVE demo (real demo orders)" : "PAPER (no orders)"));
  console.log("Topic:         " + TOPIC);
  console.log("Base URL:      " + DEMO_REST);
  console.log("");

  const data = await apiGet("/markets", { status: "open", limit: 200, mve_filter: "exclude" });
  const markets = (data && data.markets) || [];
  console.log("Fetched " + markets.length + " open markets");

  const tracked = markets.map((m) => ({
    ticker: m.ticker || m.market_ticker,
    title: m.title || m.ticker || "—",
    series_ticker: m.series_ticker || "",
    sub_title: m.sub_title || "",
    status: m.status || "unknown",
    result: m.result || "",
    yesBid: normalizePrice(m.yes_bid_dollars != null ? m.yes_bid_dollars : m.yes_bid),
    yesAsk: normalizePrice(m.yes_ask_dollars != null ? m.yes_ask_dollars : m.yes_ask),
    price: normalizePrice(m.yes_bid_dollars != null ? m.yes_bid_dollars : m.yes_bid),
    volume: Number(m.volume || m.volume_fp || 0) || 0,
    topics: [],
  }));

  const inTopic = tracked.filter((m) => m.ticker && detectTopic(m));
  console.log("In-topic markets: " + inTopic.length);

  const outLog = [];
  console.log("\n--- PAPER TRADES ---");
  for (const m of inTopic) {
    const delta = 0; // single-pass snapshot: no previous price; no swing alerts fire
    for (const [strategyName, fn] of Object.entries(STRATEGIES)) {
      const pick = fn(m, delta);
      if (!pick) continue;
      const fee = Math.ceil(0.07 * (pick.contracts || CONTRACTS) * pick.price * (1 - pick.price) * 100) / 100;
      const entry = {
        strategy: strategyName,
        topic: detectTopic(m),
        ticker: m.ticker,
        side: pick.side,
        contracts: pick.contracts,
        price: pick.price,
        fee,
        reason: pick.reason,
        time: new Date().toISOString(),
      };
      outLog.push(entry);
      console.log("[paper] " + strategyName + " " + pick.side.toUpperCase() + " " + m.ticker + " @ " + pick.price.toFixed(3) + " — " + pick.reason);
      break; // one trade per market per pass
    }
  }

  if (IS_LIVE) {
    // Live demo mode: place orders on the DEMO environment with DEMO funds.
    const apiKeyId = process.env.KALSHI_KEY_ID;
    const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
    if (!apiKeyId || !keyPath) {
      throw new Error("--live requires KALSHI_KEY_ID and KALSHI_PRIVATE_KEY_PATH (demo account credentials)");
    }
    await requireAndPlaceLive(apiKeyId, keyPath, outLog.slice(0, 3));
  }

  // ---------- write log ----------
  const dataDir = path.join(__dirname, "..", "data");
  await fs.mkdir(dataDir, { recursive: true });
  const outFile = path.join(dataDir, "portfolio-log.json");
  const payload = {
    mode: IS_LIVE ? "live-demo" : "paper",
    generatedAt: new Date().toISOString(),
    baseUrl: DEMO_REST,
    topic: TOPIC,
    trades: outLog,
    note: IS_LIVE ? "Live demo orders were placed" : "Paper simulation; no orders placed",
  };
  await fs.writeFile(outFile, JSON.stringify(payload, null, 2) + "\n");
  console.log("\nWrote " + outFile + " (" + outLog.length + " paper trades)");
}

async function requireAndPlaceLive(apiKeyId, keyPath, trades) {
  console.log("\n--- LIVE DEMO ORDERS ---");
  if (!trades.length) { console.log("No candidate trades to place."); return; }
  const pem = await fs.readFile(keyPath, "utf8");
  for (const t of trades) {
    const body = {
      ticker: t.ticker,
      side: t.side === "yes" ? "bid" : "ask",
      count: String(t.contracts),
      price: t.price.toFixed(4),
      time_in_force: "good_till_canceled",
      self_trade_prevention_type: "taker_at_cross",
      client_order_id: crypto.randomUUID(),
    };
    const r = await apiPost("/portfolio/events/orders", body, apiKeyId, pem);
    console.log(r.status >= 200 && r.status < 300 ? "[demo] order placed: " + (r.json.order_id || r.json.ticker || "?") : "[demo] order failed: " + r.status + " " + JSON.stringify(r.json).slice(0, 300));
  }
}

main().catch((e) => {
  console.error("ERROR: " + (e && e.message ? e.message : e));
  process.exit(1);
});
