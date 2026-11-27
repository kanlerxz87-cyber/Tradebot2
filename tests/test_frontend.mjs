#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

const root = process.cwd();

function makeFetch(url) {
  const clean = String(url).split("?")[0].replace(/^https?:\/\/[^/]+\//, "").replace(/^\.\//, "");
  if (clean.startsWith("data/")) {
    const p = path.join(root, clean);
    if (fs.existsSync(p)) {
      const txt = fs.readFileSync(p, "utf8");
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(JSON.parse(txt)),
        text: () => Promise.resolve(txt),
      });
    }
  }
  return Promise.reject(new Error("offline test fetch: " + url));
}

async function bootPage(htmlFile) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  const dom = new JSDOM(html, {
    url: "https://kanlerxz87-cyber.github.io/Tradebot2/" + htmlFile,
    runScripts: "outside-only",
  });
  const win = dom.window;
  win.fetch = makeFetch;
  win.alert = () => {};
  win.confirm = () => true;
  win.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  const errors = [];
  win.addEventListener("error", (e) => errors.push(e.message));
  for (const s of win.document.querySelectorAll("script")) {
    const src = s.getAttribute("src");
    if (src) win.eval(fs.readFileSync(path.join(root, src), "utf8"));
    else if (s.textContent.trim()) win.eval(s.textContent);
  }
  await new Promise((r) => setTimeout(r, 300));
  return { dom, win, doc: win.document, errors };
}

// 1. Canonical dashboard renders both chats (including model picks from snapshot), grouped board, true 30d count, and simulated ticket
const dash = await bootPage("dashboard.html");
assert.equal(dash.errors.length, 0, "dashboard errors: " + dash.errors.join("; "));
const allMsgs = dash.doc.querySelectorAll("#chat-all .msg").length;
const modelMsgs = dash.doc.querySelectorAll("#chat-model .msg").length;
assert.ok(allMsgs > 0, "expected seeded swing alerts in #chat-all");
assert.ok(modelMsgs > 0, "expected seeded model picks in #chat-model (was 0 before normalized-quote fix)");
assert.equal(dash.doc.querySelector("#kpi-resolutions").textContent, "44,192");
assert.equal(dash.doc.querySelectorAll("#market-table .topic-group-row").length, 5);
dash.doc.querySelector("#sim-qty").value = "4";
dash.doc.querySelector("#sim-submit").click();
await new Promise((r) => setTimeout(r, 40));
assert.match(dash.doc.querySelector("#kpi-paper-foot").textContent, /1 open/);

// Wide book (1c/99c) must not emit 50c mid in TB.quotePrice
const wideQ = dash.win.TB.quotePrice({ prices: { yes_bid: 0.01, yes_ask: 0.99, last: 0 } });
assert.equal(wideQ.price, null);
dash.win.close();

// 2. Topic pages display true 30d totals instead of capped 40/50 counts
const crypto = await bootPage("crypto.html");
assert.equal(crypto.errors.length, 0);
assert.equal(crypto.doc.querySelector("[data-topic-resolved]").textContent, "41,260");
crypto.win.close();

// 3. Portfolio custom strategy builder backtests snapshot candles and creates a live paper sleeve
const pf = await bootPage("portfolio.html");
assert.equal(pf.errors.length, 0);
pf.doc.querySelector("#cs-test").click();
pf.doc.querySelector("#cs-save").click();
await new Promise((r) => setTimeout(r, 40));
assert.match(pf.doc.querySelector("#cs-result").textContent, /trades/);
assert.equal(pf.doc.querySelectorAll("#pf-accounts tbody tr").length, 4);
pf.win.close();

// 4. Unified sources.html loads official docs + snapshot status
const src = await bootPage("sources.html");
assert.equal(src.errors.length, 0);
assert.ok(src.doc.querySelectorAll("#rows tr").length >= 10);
assert.match(src.doc.querySelector("#st-snapshot").textContent, /44,192 resolved/);
src.win.close();

console.log(`PASS frontend regression suite: dashboard (${allMsgs} alerts, ${modelMsgs} model picks), crypto (41,260 30d), portfolio custom lab, sources`);
