#!/usr/bin/env node
/* DOM smoke test for the static site.
 *
 * Loads each generated page in jsdom with a fetch() shim that serves site/data/*.json,
 * runs assets/app.js, and asserts that the page rendered real values from the data
 * (not an error state). Catches template/JS mismatches before deploy.
 *
 * Run:  node scripts/tests/smoke_dom.mjs
 * Needs: jsdom (npm i jsdom). Not part of the site build; CI runs the python checks.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { JSDOM } from "jsdom";

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..");
const site = path.join(root, "site");
const dataDir = path.join(site, "data");

if (!fs.existsSync(path.join(dataDir, "markets.json"))) {
  console.error("no site/data/markets.json — run the collector (or copy a snapshot) first");
  process.exit(1);
}

const PAGES = [
  ["index.html", ["top-events", /KX|Will|market/i], ["kpis", /Open demo markets/]],
  ["alerts.html", ["feed-all", /▲|▼|No .* alerts/i], ["alert-kpis", /Alerts in window/]],
  ["dashboard.html", ["mk-table", /Market|No traded/i], ["top-events", /./]],
  ["gas.html", ["mk-table", /./], ["topic-events", /./]],
  ["elections.html", ["mk-table", /./]],
  ["culture.html", ["mk-table", /./]],
  ["crypto.html", ["mk-table", /./]],
  ["golf.html", ["mk-table", /./]],
  ["chart.html", ["chart", /svg/i], ["mkinfo", /YES bid/]],
  ["portfolio.html", ["pf-kpis", /Paper equity|No trade/], ["trade-body", /strategy|trade|portfolio/i]],
  ["resolved.html", ["res-table", /Result|No resolutions/]],
  ["executive-summary.html", ["nav", /Kalshi/]],
  ["findings.html", ["nav", /Kalshi/]],
  ["sources.html", ["nav", /Kalshi/]],
  ["repo-review.html", ["nav", /Kalshi/]],
  ["suggestions.html", ["nav", /Kalshi/]],
  ["flagged.html", ["nav", /Kalshi/]],
];

const appJs = fs.readFileSync(path.join(site, "assets", "app.js"), "utf8");

let failures = 0;
for (const [file, ...checks] of PAGES) {
  // Inline app.js so jsdom runs it without network/resource loading.
  const html = fs.readFileSync(path.join(site, file), "utf8")
    .replace('<script src="assets/app.js" defer></script>', `<script>${appJs}</script>`);
  const errors = [];
  const dom = new JSDOM(html, {
    url: `https://example.test/${file}`,
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = async (input) => {
        const name = String(input).split("?")[0].replace(/^data\//, "");
        const p = path.join(dataDir, name);
        if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => null };
        const text = fs.readFileSync(p, "utf8");
        return { ok: true, status: 200, json: async () => JSON.parse(text) };
      };
      window.addEventListener("error", (e) => errors.push(e.message || String(e.error)));
    },
  });
  await new Promise((r) => setTimeout(r, 700));
  for (const [id, re] of checks) {
    const el = dom.window.document.getElementById(id);
    const text = el ? (el.textContent || "") : "";
    const hasSvg = el && el.querySelector && el.querySelector("svg");
    if (!el) { console.error(`FAIL ${file}: #${id} missing`); failures++; continue; }
    if (re.test(text) || (re.source === "svg" && hasSvg) || (id === "chart" && hasSvg)) {
      // ok
    } else {
      console.error(`FAIL ${file}: #${id} did not render expected content (len=${text.length})`);
      failures++;
    }
  }
  if (errors.length) { console.error(`FAIL ${file}: runtime error -> ${errors[0]}`); failures++; }
  console.log(`ok   ${file}`);
  dom.window.close();
}
console.log(failures ? `FAILED: ${failures}` : "OK: all pages rendered from site/data");
process.exit(failures ? 1 : 0);
