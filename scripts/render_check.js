#!/usr/bin/env node
/* Headless render check for the published site.
 *
 * The dashboard has to work in two modes: live (demo API answers) and snapshot
 * (it does not). This script executes every page's real JavaScript against an
 * offline fetch stub, so the snapshot path is guaranteed to render without
 * errors, with the nav mounted once, tables populated, and no "loading…"
 * placeholder left behind. CI runs it after the Python gate.
 *
 * Requires: npm install --no-save jsdom   (CI does this; not a repo dependency)
 */
const path = require("path");
const fs = require("fs");

let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch (e) {
  console.log("jsdom is not installed — skipping render check (npm install --no-save jsdom)");
  process.exit(0);
}

const ROOT = path.resolve(__dirname, "..", "docs");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

function offlineFetch(url) {
  const m = String(url).match(/data\/([a-z\-]+\.json)$/);
  if (!m) return Promise.reject(new Error("offline: " + url));
  const file = path.join(ROOT, "data", m[1]);
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(JSON.parse(fs.readFileSync(file, "utf8"))),
  });
}

(async () => {
  let failures = 0;
  for (const page of pages) {
    const errors = [];
    const dom = new JSDOM(fs.readFileSync(path.join(ROOT, page), "utf8"), {
      url: "http://localhost/" + page, runScripts: "outside-only", pretendToBeVisual: true,
    });
    const w = dom.window;
    w.fetch = offlineFetch;
    w.HTMLCanvasElement.prototype.getContext = function () {
      return new Proxy({}, { get: (t, k) => (k === "canvas" ? this : () => {}), set: () => true });
    };
    w.addEventListener("error", (e) => errors.push("onerror: " + e.message));
    let rejected = null;
    w.addEventListener("unhandledrejection", (e) => { rejected = (e.reason && e.reason.message) || String(e.reason); });

    for (const node of Array.from(w.document.querySelectorAll("script"))) {
      const src = node.getAttribute("src");
      const code = src ? fs.readFileSync(path.join(ROOT, src), "utf8") : node.textContent;
      try { w.eval(code); } catch (e) { errors.push((src || "inline") + ": " + e.message); }
    }
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
    await new Promise((r) => setTimeout(r, 800));
    if (rejected) errors.push("unhandled rejection: " + rejected);

    const nav = w.document.querySelectorAll("nav.links a").length;
    const rows = w.document.querySelectorAll("tbody tr").length;
    const loading = w.document.body.textContent.includes("loading…");
    if (nav < 10) errors.push("nav links = " + nav);
    if (rows < 1) errors.push("no table rows rendered");
    if (loading) errors.push("placeholder still says loading…");

    console.log(`${(errors.length ? "FAIL" : "ok  ")} ${page.padEnd(24)} nav=${nav} rows=${rows}`);
    errors.slice(0, 4).forEach((e) => console.log("       ↳ " + e));
    if (errors.length) failures++;
  }
  console.log(`\n${pages.length - failures}/${pages.length} pages rendered offline`);
  process.exit(failures ? 1 : 0);
})();
