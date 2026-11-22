/* tools/make-relative.js —
   Converts root-absolute "/dash/..." links in the dash/ HTML pages into
   per-page RELATIVE links, so the site works on GitHub Pages (served under
   /{repo}/), local servers, and file://. Shared JS (dash/assets/*.js) is NOT
   touched — it builds links from the runtime root (window.DASHROOT). */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const DASH = path.join(ROOT, "dash");

let count = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) {
      const relDir = path.relative(DASH, path.dirname(p)); // "" | "alerts" | "topics/gas" | "docs/sources"
      const depth = relDir === "" ? 0 : relDir.split(path.sep).length;
      const rel = depth === 0 ? "./" : "../".repeat(depth);
      let html = fs.readFileSync(p, "utf8");
      const before = (html.match(/\/dash\//g) || []).length;
      html = html.split("/dash/").join(rel);
      fs.writeFileSync(p, html);
      count += before;
      console.log(path.relative(ROOT, p) + ": " + before + " links -> depth " + depth + " (" + rel + ")");
    }
  }
})(DASH);
console.log("make-relative: " + count + " link occurrences rewritten");
