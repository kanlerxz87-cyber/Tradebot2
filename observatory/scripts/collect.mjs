import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  API,
  TOPICS,
  topicFor,
  normalize,
  swing,
  runPaper,
  emptyPaper,
  isOpen,
  exposure,
} from "../src/engine.js";
const file =
  process.env.SNAPSHOT_FILE ||
  fileURLToPath(new URL("../data/snapshot.json", import.meta.url));
let old;
try {
  old = JSON.parse(await readFile(file, "utf8"));
} catch {
  old = {};
}
const errors = [],
  started = Date.now();
let calls = 0;
async function get(path) {
  if (Date.now() - started > 210000)
    throw new Error("Collection time budget exceeded; coverage incomplete");
  for (let i = 0; i < 3; i++) {
    calls++;
    await new Promise((r) =>
      setTimeout(r, Number(process.env.COLLECT_REQUEST_DELAY_MS ?? 150)),
    );
    try {
      const r = await fetch(API + path, { signal: AbortSignal.timeout(20000) });
      if ([429, 500, 502, 503, 504].includes(r.status) && i < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${path}`);
      return await r.json();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
}
const history = old.history || {},
  previous = new Map((old.markets || []).map((m) => [m.ticker, m]));
const markets = new Map(),
  events = new Set();
let complete = true,
  seriesCount = 0;
try {
  const all = await get("/series?include_product_metadata=true");
  if (!Array.isArray(all.series)) throw new Error("Invalid series response");
  const series = new Map(
    all.series.filter((s) => topicFor(s)).map((s) => [s.ticker, s]),
  );
  seriesCount = series.size;
  let cursor = "",
    seen = new Set();
  do {
    const page = await get(
      `/events?status=open&with_nested_markets=true&limit=200${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
    );
    if (!Array.isArray(page.events)) throw new Error("Invalid events response");
    for (const e of page.events) {
      const s = series.get(e.series_ticker);
      if (!s) continue;
      events.add(e.event_ticker);
      for (const raw of e.markets || []) {
        const m = normalize(raw, e, s, new Date().toISOString());
        markets.set(m.ticker, m);
      }
    }
    cursor = page.cursor || "";
    if (cursor && seen.has(cursor))
      throw new Error("Repeated pagination cursor");
    seen.add(cursor);
  } while (cursor);
} catch (e) {
  complete = false;
  errors.push(e.message);
}
// Preserve all prior records before any refresh, even after partial discovery.
const pending = [];
for (const m of previous.values())
  if (!markets.has(m.ticker)) {
    markets.set(m.ticker, m);
    if (!(m.status === "settled" && m.result)) pending.push(m);
  }
for (let i = 0; i < pending.length; i += 50) {
  if (Date.now() - started > 200000) {
    complete = false;
    errors.push(
      "Prior-contract refresh budget exceeded; remaining prior observations retained with original timestamps.",
    );
    break;
  }
  const batch = pending.slice(i, i + 50);
  try {
    const data = await get(
      "/markets?tickers=" +
        batch.map((m) => encodeURIComponent(m.ticker)).join(","),
    );
    if (!Array.isArray(data.markets))
      throw Error("Invalid prior-contract response");
    const returned = new Map(data.markets.map((m) => [m.ticker, m]));
    for (const m of batch) {
      const raw = returned.get(m.ticker);
      if (!raw) {
        complete = false;
        errors.push(
          `${m.ticker}: not returned by current market API; retained, unresolved. Historical reconciliation may be needed.`,
        );
        continue;
      }
      const updated = normalize(
        raw,
        {
          event_ticker: m.eventTicker,
          title: m.eventTitle,
          settlement_sources: m.settlementSources,
        },
        {
          ticker: m.seriesTicker,
          category: m.officialCategory,
          categories: m.officialCategories || [m.officialCategory],
          tags: m.officialTags,
          product_metadata: { scope: m.officialScope },
        },
        new Date().toISOString(),
      );
      markets.set(m.ticker, updated);
    }
  } catch (e) {
    complete = false;
    errors.push("Prior-contract batch: " + e.message);
  }
}
const alerts = [];
for (const m of markets.values()) {
  const p = previous.get(m.ticker);
  const a = swing(p, m, m.observedAt);
  if (a) alerts.push(a);
  const h = (history[m.ticker] ||= []);
  if (m.last !== null && m.observedAt !== p?.observedAt)
    h.push({ time: m.observedAt, price: m.last });
  // Bounded raw observations, not fabricated/interpolated seconds data.
  history[m.ticker] = h.slice(-2000);
}
// A second short-window sample enables scheduled experiments without mislabeling five-minute gaps as sudden swings.
const sampleIds = [
  ...new Set(
    [...markets.values()]
      .filter(isOpen)
      .sort((a, b) => (exposure(b) ?? -1) - (exposure(a) ?? -1))
      .slice(0, 100)
      .map((m) => m.ticker)
      .concat(
        (old.paper?.trades || [])
          .filter((t) => !t.closedAt)
          .map((t) => t.ticker),
      ),
  ),
];
if (sampleIds.length && Date.now() - started < 180000) {
  await new Promise((r) =>
    setTimeout(r, Number(process.env.LIVE_SAMPLE_DELAY_MS ?? 10000)),
  );
  for (let i = 0; i < sampleIds.length; i += 50) {
    try {
      const data = await get(
        "/markets?tickers=" +
          sampleIds
            .slice(i, i + 50)
            .map(encodeURIComponent)
            .join(","),
      );
      if (!Array.isArray(data.markets))
        throw Error("Invalid live sample schema");
      for (const raw of data.markets) {
        const p = markets.get(raw.ticker);
        if (!p) continue;
        const m = normalize(
          raw,
          {
            title: p.eventTitle,
            event_ticker: p.eventTicker,
            settlement_sources: p.settlementSources,
          },
          {
            ticker: p.seriesTicker,
            category: p.officialCategory,
            categories: p.officialCategories || [p.officialCategory],
            tags: p.officialTags,
            product_metadata: { scope: p.officialScope },
          },
          new Date().toISOString(),
        );
        const a = swing(p, m, m.observedAt);
        if (a) alerts.push(a);
        markets.set(m.ticker, m);
        if (m.last !== null) {
          (history[m.ticker] ||= []).push({
            time: m.observedAt,
            price: m.last,
          });
          history[m.ticker] = history[m.ticker].slice(-2000);
        }
      }
    } catch (e) {
      complete = false;
      errors.push("Short-window sample: " + e.message);
    }
  }
}
const now = new Date().toISOString();
const paper = runPaper(
  old.paper || emptyPaper(),
  [...markets.values()],
  alerts,
  now,
);
// Retain dense history for high-exposure contracts and strategy evidence, not 90k repeated empty timelines.
const ranked = [...markets.values()].sort(
  (a, b) => (exposure(b) ?? -1) - (exposure(a) ?? -1),
);
const historyIds = new Set(
  [
    ...ranked.slice(0, 100),
    ...TOPICS.flatMap((t) => ranked.filter((m) => m.topic === t).slice(0, 20)),
  ]
    .map((m) => m.ticker)
    .concat(
      paper.trades.filter((t) => !t.closedAt).map((t) => t.ticker),
      [...(old.alerts || []), ...alerts].slice(-1000).map((a) => a.ticker),
    ),
);
for (const id of Object.keys(history))
  if (!historyIds.has(id)) delete history[id];
// Large repeated rule/source prose is intentionally omitted. Direct official market and series links remain on every row.
for (const m of markets.values()) {
  delete m.rules;
  delete m.settlementSources;
}
const result = {
  schemaVersion: 1,
  observedAt: now,
  status: complete ? "ok" : "partial",
  markets: [...markets.values()],
  history,
  alerts: [...(old.alerts || []), ...alerts].slice(-1000),
  paper,
  coverage: {
    complete,
    series: seriesCount,
    events: events.size,
    calls,
    scope:
      "Exact series categories/tags only; non-multivariate open events plus previously tracked markets.",
  },
  errors,
};
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(result));
console.log(
  JSON.stringify({
    status: result.status,
    markets: result.markets.length,
    coverage: result.coverage,
    errors,
  }),
);
if (!result.markets.length) process.exitCode = 1;
