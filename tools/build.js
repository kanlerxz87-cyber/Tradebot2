/* tools/build.js —
   1) emits data/snapshot.json (machine-readable copy of assets/data.js)
   2) generates the five topic pages (tools/gen-topics.js)
   3) link check: every internal href in the static site must exist on disk;
      external links are the verified-official list (checked in-session). */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* ---------- 1) snapshot.json ---------- */
global.window = {};
require(path.join(ROOT, "dash", "assets", "data.js"));
const D = global.window.KDATA;
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
const snapshot = {
  generated: new Date().toISOString(),
  snapshotTs: D.snapshotTs,
  note: "Machine-readable copy of assets/data.js. Every record carries the exact official source query used to verify it. Values are verbatim from the Kalshi demo REST API; null = not present in the verified snapshot (never inferred).",
  markets: D.markets,
  orderbooks: D.orderbooks,
  candlesticks: D.candlesticks,
  trades: D.trades,
  series: D.series,
  demoSiteHighlights: D.demoSiteHighlights
};
fs.writeFileSync(path.join(ROOT, "data", "snapshot.json"), JSON.stringify(snapshot, null, 2));
console.log("wrote data/snapshot.json (" + D.markets.length + " markets)");

/* ---------- 2) topic pages ---------- */
require(path.join(__dirname, "gen-topics.js"));

/* ---------- 2b) relative links (GitHub Pages base-path safety) ---------- */
require(path.join(__dirname, "make-relative.js"));

/* ---------- 3) link check ---------- */
const INTERNAL_OK_EXT = [".html", "/"];
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "tools", "dash/assets"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) files.push(p);
  }
})(ROOT);

let bad = 0;
const seenExternal = new Set();
for (const f of files) {
  let html = fs.readFileSync(f, "utf8");
  html = html.replace(/<script[\s\S]*?<\/script>/g, ""); // ignore JS-built hrefs
  const re = /(?:href|src)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    let u = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(u)) {
      if (u.startsWith("http")) seenExternal.add(u.split("#")[0]);
      continue;
    }
    if (u.startsWith("javascript:")) continue;
    const clean = u.split("#")[0].split("?")[0];
    if (!clean) continue; // "" / bare anchor = current page, nothing to check
    // root-absolute links resolve from repo root; relative links from the file's dir
    const rel = clean.startsWith("/")
      ? path.join(ROOT, decodeURIComponent(clean))
      : path.normalize(path.join(path.dirname(f), decodeURIComponent(clean)));
    let exists = fs.existsSync(rel);
    if (exists && fs.statSync(rel).isDirectory()) {
      exists = fs.existsSync(path.join(rel, "index.html"));
    }
    if (!exists) {
      bad++;
      console.log("BROKEN: " + path.relative(ROOT, f) + " -> " + u);
    }
  }
}
console.log("\ninternal link check: " + files.length + " html files, " + (bad ? bad + " BROKEN" : "all internal links OK"));
console.log("external links referenced: " + seenExternal.size);
console.log([...seenExternal].sort().join("\n"));
process.exit(bad ? 1 : 0);
