import {
  API,
  TOPICS,
  number,
  normalize,
  isOpen,
  exposure,
  groupEvents,
  swing,
  runPaper,
  emptyPaper,
  paperStats,
  levels,
} from "./engine.js";
import { sources, flags, requirements } from "./research.js";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const money = (n) => (n === null || n === undefined ? "" : currency.format(n));
const compact = (n) =>
  n === null || n === undefined
    ? ""
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n);
const cents = (n) =>
  n === null || n === undefined ? "" : `${+(n * 100).toFixed(2)}¢`;
const num = (n) =>
  n === null || n === undefined
    ? ""
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
const date = (t) =>
  t
    ? new Date(t).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    : "";
const external = (url, text = "Source ↗") =>
  safeUrl(url)
    ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`
    : "";
function safeUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
const theme = {
  "Gas prices": [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M2 20h14M6 7h6v5H6zM14 12h2a2 2 0 0 1 2 2v3a1 1 0 0 0 3 0V9l-3-3M19 7v4h2"/></svg>',
    "#f4f0e6",
    "#a28c51",
  ],
  Elections: ["▥", "#eaf0fc", "#738cc0"],
  Culture: ["✳", "#f5eaf9", "#b17cbd"],
  Crypto: ["◇", "#fff3e5", "#c39753"],
  Golf: ["⚑", "#edf4e8", "#7d9c60"],
};
const style = (t) =>
  `--tint:${theme[t]?.[1] || "#edf4e8"};--tcolor:${theme[t]?.[2] || "#7d9c60"}`;
const slug = (t) => t.toLowerCase().replaceAll(" ", "-");
let snapshot = {
    markets: [],
    history: {},
    alerts: [],
    errors: [],
    coverage: {},
    paper: emptyPaper(),
  },
  markets = [],
  history = {},
  alerts = [],
  paper = emptyPaper();
let page = "overview",
  topic = null,
  filter = "All topics",
  search = "",
  selected = null,
  range = 3600000,
  chartUnit = "minutes",
  feedTab = "all",
  portfolioMode = "scheduled",
  tablePage = 0,
  paused = false,
  connection = "Loading official snapshot",
  failures = 0,
  polling = false;
let book = null,
  bookTicker = null,
  bookTime = null,
  bookError = "",
  lastSuccess = null;
const localKey = "tradebot-paper-v1";
const loadedTopics = new Map(),
  loadingTopics = new Set();
function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(localKey));
    if (d?.paper?.version === 1) {
      paper = d.paper;
      return d;
    }
  } catch {}
  return null;
}
function saveLocal() {
  try {
    localStorage.setItem(
      localKey,
      JSON.stringify({
        paper,
        alerts: alerts.slice(-1000),
        history: Object.fromEntries(
          Object.entries(history).map(([k, v]) => [k, v.slice(-1000)]),
        ),
      }),
    );
  } catch {
    toast(
      "Browser storage is unavailable or full; this session’s new paper observations are not persisted.",
    );
  }
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  setTimeout(() => ($("#toast").hidden = true), 5000);
}
$("#topic-nav").innerHTML = TOPICS.map(
  (t) =>
    `<a href="#/topics/${slug(t)}" data-topic="${esc(t)}"><span style="color:${theme[t][2]}">${theme[t][0]}</span>${t}</a>`,
).join("");
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  page = parts[0] || "overview";
  topic = page === "topics" ? TOPICS.find((t) => slug(t) === parts[1]) : null;
  if (page === "topics" && !topic) page = "overview";
  if (
    ![
      "overview",
      "topics",
      "alerts",
      "portfolio",
      "strategies",
      "summary",
      "sources",
      "review",
    ].includes(page)
  )
    page = "overview";
  filter = "All topics";
  search = "";
  tablePage = 0;
  render();
  if (topic) loadTopic(topic);
}
const titles = {
  overview: [
    "Market overview",
    "Follow the money. Catch the move. Stay ahead of the market.",
  ],
  alerts: [
    "Live alerts",
    "Every observed 10¢ swing. Two feeds. No noise disguised as certainty.",
  ],
  portfolio: [
    "Paper portfolio",
    "Track the experiment, not an imaginary return.",
  ],
  strategies: [
    "Strategy lab",
    "Simple rules. Transparent assumptions. Measurable outcomes.",
  ],
  summary: [
    "Executive summary",
    "The brief: what is built, what is verified, and what comes next.",
  ],
  sources: [
    "Source register",
    "Official documentation. Direct evidence. A traceable research trail.",
  ],
  review: [
    "Flagged for review",
    "Known limits and unverified items, in plain sight.",
  ],
};
function currentMarkets() {
  const ids =
    !topic && snapshot.viewScope
      ? new Set(snapshot.markets.map((m) => m.ticker))
      : null;
  return markets.filter(
    (m) =>
      (!ids || ids.has(m.ticker)) &&
      (!topic || m.topic === topic) &&
      (filter === "All topics" || m.topic === filter) &&
      (!search ||
        `${m.title} ${m.eventTitle} ${m.ticker}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
}
function render() {
  const [title, description] = topic
    ? [
        `${topic} markets`,
        "One topic. Every tracked event. Follow each contract through settlement.",
      ]
    : titles[page];
  $("#page-title").innerHTML = esc(title) + '<span class="title-dot">.</span>';
  $("#page-description").textContent = description;
  $("#crumb").textContent = title;
  document.title = `${title} / Tradebot`;
  document
    .querySelectorAll("nav a")
    .forEach((a) =>
      a.classList.toggle(
        "active",
        a.dataset.page === page || a.dataset.topic === topic,
      ),
    );
  $("#alert-count").textContent = alerts.length;
  if (["overview", "topics"].includes(page)) renderOverview();
  if (page === "alerts") renderAlerts();
  if (page === "portfolio") renderPortfolio();
  if (page === "strategies") renderStrategies();
  if (page === "sources") renderSources();
  if (page === "review") renderReview();
  if (page === "summary") renderSummary();
  updateConnection();
}
function updateConnection() {
  const age = lastSuccess ? Date.now() - Date.parse(lastSuccess) : Infinity;
  const healthy = failures === 0 && age < 45000;
  const state = $("#connection");
  state.className = `connection${healthy ? "" : " warning"}`;
  state.innerHTML = `<span class="dot"></span><strong>${esc(paused ? "Browser polling paused" : lastSuccess && age >= 45000 ? "Live observation stale · showing last confirmed prices" : connection)}</strong><span>${lastSuccess ? "Last browser observation: " + esc(date(lastSuccess)) : "Published snapshot: " + esc(date(snapshot.observedAt) || "not yet available")} · ${snapshot.coverage.complete ? "Scoped discovery complete" : "Coverage incomplete"} · <a href="#/review">Details ↗</a></span>`;
}
function stat(label, value, note, icon) {
  return `<article class="stat"><div class="stat-label">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${value || '<span class="muted" title="Unverified / unavailable">—</span>'}</div><div class="stat-note">${note}</div></article>`;
}
function statsHtml(ms) {
  const live = ms.filter(isOpen),
    values = live.map(exposure);
  const total =
    values.length && !values.includes(null)
      ? values.reduce((a, b) => a + b, 0)
      : null;
  return `<div class="stats">${stat("Tracked face-value exposure", total === null ? "" : money(total), "<em>Open interest × face value</em> · derived", "$")}${stat("Active events", num(new Set(live.map((m) => m.eventTicker)).size), "Across the selected topic universe", "▦")}${stat("Price swing alerts", num(alerts.filter((a) => !topic || a.topic === topic).length), "<em>≥ 10¢ either direction</em> · observed intervals", "ϟ")}${stat("Paper realized P&L", money(paperStats({ ...paper, trades: paper.trades.filter((t) => !topic || t.topic === topic) }, ms).realized), "Browser experiment · before unknown fees", "↗")}</div>`;
}
function renderOverview() {
  const ms = currentMarkets();
  const live = ms.filter(isOpen);
  if (!selected || !ms.some((m) => m.ticker === selected))
    selected =
      [...live].sort((a, b) => (exposure(b) ?? -1) - (exposure(a) ?? -1))[0]
        ?.ticker ||
      ms[0]?.ticker ||
      null;
  $("#content").innerHTML =
    statsHtml(ms) +
    (snapshot.viewScope
      ? `<div class="callout">${esc(topic ? (loadedTopics.get(topic) === snapshot.observedAt ? "Full collected topic loaded · " + num(ms.length) + " contracts." : "Topic view is loading / not yet confirmed; only available observations are shown.") : snapshot.viewScope)}</div>`
      : "") +
    `<div class="section-top"><div><h2>${topic ? "Topic workspace" : "Explore markets"}</h2><p>Five focused topics. One connected view.</p></div><a class="text-link" href="#/summary">Read the executive brief ↗</a></div>
 <div class="topic-cards">${TOPICS.map((t) => `<a class="topic-card" style="${style(t)}" href="#/topics/${slug(t)}"><span class="topic-icon">${theme[t][0]}</span><div><strong>${t}</strong><small>${snapshot.topicCounts?.[t]?.events ?? new Set(markets.filter((m) => m.topic === t && isOpen(m)).map((m) => m.eventTicker)).size} observed active events</small></div><span class="arrow">↗</span></a>`).join("")}</div>
 <div class="workspace-grid"><section class="panel" aria-label="Contract price chart">${chartPanel()}</section><section class="panel" aria-label="Price movement feed">${feedPanel(false)}</section></div>
 <section class="panel" aria-label="Events ranked by face-value exposure"><div class="panel-head"><div><h2>Market watchlist <span class="metric-sub">/ ${topic || "All topics"}</span></h2><p>Grouped by event · ranked by tracked open-interest face value, not dollars traded</p></div><span class="live-pill"><span class="dot"></span>${lastSuccess ? "OBSERVED" : "SNAPSHOT"}</span></div>
 ${filtersHtml()}<div id="market-table">${marketTable()}</div></section>
 <div class="below-grid"><section class="panel"><div class="panel-head"><div><h2>Liquidity at a glance</h2><p>Reported YES / NO bids · quantities at each price</p></div><button class="button" id="book-refresh">↻ Refresh</button></div><div id="book">${bookHtml()}</div></section><section class="panel"><div class="panel-head"><h2>The context behind the move</h2><span class="review-status">EVIDENCE FIRST</span></div><div class="panel-body"><h3>No cause without a source.</h3><p>Sharp movements are marked on the chart. A jump alone does not establish why a price moved. No verified, event-specific news attribution is available.</p><p>${external("https://docs.kalshi.com/api-reference/market/get-market", "Market rules & settlement sources ↗")}</p><div class="rules">${esc(markets.find((m) => m.ticker === selected)?.rules || "")}</div></div><div class="news-empty"><strong>News-cause fields are blank / unverified</strong>Settlement sources are not evidence of a price-movement cause.</div></section></div>`;
  bindOverview();
  drawChart();
}
function filtersHtml() {
  return `<div class="filters">${["All topics", ...TOPICS].map((t) => `<button class="chip ${filter === t ? "active" : ""}" data-filter="${t}">${t}</button>`).join("")}<label class="search"><input id="search" type="search" placeholder="Search events…" aria-label="Search events" value="${esc(search)}"></label></div>`;
}
function marketTable() {
  const groups = groupEvents(currentMarkets()),
    flat = groups.flatMap((e) =>
      e.markets
        .sort((a, b) => (exposure(b) ?? -1) - (exposure(a) ?? -1))
        .map((m, i) => ({ m, e, first: i === 0 })),
    );
  const start = tablePage * 15,
    rows = flat.slice(start, start + 15);
  return `<div class="table-wrap"><table><thead><tr><th>EVENT / CONTRACT</th><th>TOPIC</th><th>YES PRICE</th><th>SPREAD</th><th>FACE-VALUE OI ↓</th><th>24H CONTRACTS</th><th>STATUS / RESULT</th><th>OFFICIAL SOURCE</th></tr></thead><tbody>${rows.map(({ m, e, first }, i) => `${first ? `<tr><td colspan="8" style="background:#fcfdfb;padding:8px 18px"><strong>${esc(e.title || e.ticker)} <small style="display:inline"> · ${e.markets.length} contracts · ${money(e.dollars)} tracked face value</small></strong> ${external(`${API}/events/${encodeURIComponent(e.ticker)}`, "Event source ↗")}</td></tr>` : ""}<tr class="selectable ${selected === m.ticker ? "selected-row" : ""}" data-ticker="${esc(m.ticker)}"><td><button class="sort" data-select="${esc(m.ticker)}"><strong>${esc(m.title || m.ticker)}</strong></button><small>${esc(m.ticker)}</small></td><td><span class="topic-badge" style="${style(m.topic)}">${esc(m.topic)}</span></td><td>${m.last !== null ? `<span class="price-badge">${cents(m.last)}</span>` : ""}</td><td>${m.ask !== null && m.bid !== null ? cents(m.ask - m.bid) : ""}</td><td>${money(exposure(m))}</td><td>${compact(m.volume24h)}</td><td><span class="${m.result ? "up" : ""}">${esc(m.status)}${m.result ? " / " + m.result.toUpperCase() : ""}</span></td><td>${external(m.source)}<small>${esc(date(m.observedAt))}${Date.now() - Date.parse(m.observedAt) > 120000 ? " · stale" : ""}</small></td></tr>`).join("") || `<tr><td colspan="8">${empty("No confirmed markets in this view", "Unavailable values are left blank. Try another topic or wait for the next official collection.", "▦")}</td></tr>`}</tbody></table></div><div class="table-bottom"><span>${rows.length ? start + 1 : 0}–${Math.min(start + 15, flat.length)} of ${flat.length} tracked contracts · Blank = unverified / unavailable</span><div class="pagination"><button id="prev" ${tablePage === 0 ? "disabled" : ""}>←</button><button id="next" ${start + 15 >= flat.length ? "disabled" : ""}>→</button></div></div>`;
}
function empty(title, description, symbol = "◌") {
  return `<div class="empty"><span class="empty-symbol">${symbol}</span><strong>${title}</strong><small>${description}</small></div>`;
}
function chartPanel() {
  const m = markets.find((m) => m.ticker === selected);
  return `<div class="panel-head"><div><h2>Contract price</h2><p>YES last traded price · USD / contract</p></div><div class="chart-tools"><div class="segmented">${[
    ["seconds", "60s"],
    ["minutes", "60m"],
    ["hours", "24h"],
  ]
    .map(
      ([u, l]) =>
        `<button data-range="${u}" class="${chartUnit === u ? "selected" : ""}">${l}</button>`,
    )
    .join(
      "",
    )}</div></div></div><div class="chart-summary"><div class="chart-market">${esc(m?.title || "Awaiting official market observations")}<small>${esc(m?.ticker || "No synthetic price history")}</small></div><div class="chart-price">${cents(m?.last)}<small>YES contract</small></div></div><div id="chart" class="chart-area"></div><div class="chart-foot"><span class="legend"><i></i> Observed price <span style="margin-left:9px">◆ ≥10¢ swing</span></span><span>Time (UTC) · ${chartUnit} · ${m ? external(m.source, "Official data ↗") : ""}</span></div>`;
}
function drawChart() {
  const el = $("#chart");
  if (!el) return;
  const m = markets.find((m) => m.ticker === selected);
  const raw = history[selected] || [];
  const latest = raw.length
    ? Math.max(Date.now(), Date.parse(raw.at(-1).time))
    : Date.now();
  const start = latest - range;
  const points = raw.filter(
    (p) => Date.parse(p.time) >= start && Number.isFinite(p.price),
  );
  const width = 650,
    height = 205,
    left = 40,
    right = 15,
    top = 10,
    bottom = 32;
  const x = (t) =>
    left + ((Date.parse(t) - start) / range) * (width - left - right);
  const y = (p) => top + (1 - p) * (height - top - bottom);
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="YES contract price from zero to one US dollar over time in UTC"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a0c48d" stop-opacity=".22"/><stop offset="1" stop-color="#c7ddbc" stop-opacity="0"/></linearGradient></defs>`;
  for (const v of [0, 0.25, 0.5, 0.75, 1])
    svg += `<line x1="${left}" y1="${y(v)}" x2="${width - right}" y2="${y(v)}" stroke="#edf0eb" stroke-dasharray="3 4"/><text x="3" y="${y(v) + 3}" fill="#a4aea1" font-size="9">$${v.toFixed(2)}</text>`;
  for (let i = 0; i <= 4; i++) {
    const t = start + (range * i) / 4;
    svg += `<text x="${left + ((width - left - right) * i) / 4}" y="${height - 9}" text-anchor="${i === 0 ? "start" : i === 4 ? "end" : "middle"}" fill="#a4aea1" font-size="9">${new Date(t).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", ...(chartUnit === "seconds" ? { second: "2-digit" } : {}) })}</text>`;
  }
  // Never join across an observation gap of >120s; scheduled snapshots are separate observations.
  const segments = [];
  let segment = [];
  for (const p of points) {
    if (
      segment.length &&
      Date.parse(p.time) - Date.parse(segment.at(-1).time) > 120000
    ) {
      segments.push(segment);
      segment = [];
    }
    segment.push(p);
  }
  if (segment.length) segments.push(segment);
  for (const s of segments) {
    const d = s
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${x(p.time).toFixed(1)},${y(p.price).toFixed(1)}`,
      )
      .join(" ");
    if (s.length > 1)
      svg += `<path d="${d} L${x(s.at(-1).time)},${y(0)} L${x(s[0].time)},${y(0)} Z" fill="url(#fill)"/><path d="${d}" fill="none" stroke="#689469" stroke-width="2" stroke-linejoin="round"/>`;
    for (const p of s)
      svg += `<circle cx="${x(p.time)}" cy="${y(p.price)}" r="${s.length === 1 ? 3 : 2}" fill="#689469"><title>${esc(date(p.time))} · ${cents(p.price)}</title></circle>`;
  }
  for (const a of alerts.filter(
    (a) => a.ticker === selected && Date.parse(a.time) >= start,
  )) {
    svg += `<path d="M${x(a.time)},${y(a.to) - 5}l4,5 -4,5 -4,-5Z" fill="${a.delta > 0 ? "#6d9d57" : "#ce8a73"}"><title>${esc(date(a.time))} · ${a.delta > 0 ? "+" : ""}${cents(a.delta)} · News cause unverified</title></path>`;
  }
  svg += "</svg>";
  el.innerHTML =
    svg +
    (!points.length
      ? `<div class="chart-empty">No observations in this time window<span>${raw.length ? "Choose a longer window. Gaps are never interpolated." : "History begins when official data is observed."}</span></div>`
      : "");
}
function feedPanel(full, candidates = false) {
  const list = alerts
    .filter(
      (a) =>
        (!topic || a.topic === topic) &&
        (!(full ? candidates : feedTab === "candidates") || a.candidate),
    )
    .slice(-150)
    .reverse();
  return `<div class="panel-head"><div><h2>${full ? (candidates ? "Strategy candidates" : "All price swings") : "Live alert feed"}</h2><p>≥ $0.10 in either direction · observed intervals ≤ 120s</p></div><span class="live-pill"><span class="dot"></span>MONITOR</span></div>${!full ? `<div class="feed-tabs"><button data-feed="all" class="${feedTab === "all" ? "active" : ""}">All movements <b>${alerts.length}</b></button><button data-feed="candidates" class="${feedTab === "candidates" ? "active" : ""}">Strategy candidates ✧</button></div>` : ""}<div class="chat" role="log" aria-label="${candidates ? "Candidate alerts" : "All swing alerts"}" aria-live="off">${list.map((a) => `<article class="chat-item"><div class="chat-avatar" style="${style(a.topic)}">${theme[a.topic]?.[0] || "ϟ"}</div><div class="chat-body"><div class="chat-meta"><b>${esc(a.topic)} <span class="${a.delta > 0 ? "up" : "down"}">${a.delta > 0 ? "↗ +" : "↘ "}${cents(a.delta)}</span></b><time>${esc(new Date(a.time).toLocaleTimeString("en-GB", { timeZone: "UTC" }))} UTC</time></div>${external(a.source, a.title || a.ticker)}<small>${cents(a.from)} → ${cents(a.to)} · ${num(a.windowSeconds)}s window${a.candidate ? " · liquidity screen passed" : ""}</small><small>Expected ROI: unverified · News cause: unverified</small></div></article>`).join("") || empty(candidates ? "Waiting for a qualifying candidate" : "Listening for the next meaningful move", candidates ? "A candidate must pass the liquidity screen. Positive expected ROI has not been established." : "No qualifying swing observed yet. We never seed the feed with made-up alerts.", "ϟ")}</div><div class="feed-foot"><span>${candidates ? "Heuristic screen ≠ proven edge" : "Newest first · Observations, not recommendations"}</span><span>${paused ? "Paused" : "Auto-updating"}</span></div>`;
}
function bindOverview() {
  document.querySelectorAll("[data-range]").forEach(
    (b) =>
      (b.onclick = () => {
        chartUnit = b.dataset.range;
        range = { seconds: 60000, minutes: 3600000, hours: 86400000 }[
          chartUnit
        ];
        render();
      }),
  );
  document.querySelectorAll("[data-feed]").forEach(
    (b) =>
      (b.onclick = () => {
        feedTab = b.dataset.feed;
        render();
      }),
  );
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.filter;
        tablePage = 0;
        render();
      }),
  );
  $("#search").oninput = (e) => {
    search = e.target.value;
    tablePage = 0;
    $("#market-table").innerHTML = marketTable();
    bindRows();
  };
  $("#book-refresh").onclick = () => fetchBook();
  bindRows();
}
function bindRows() {
  document.querySelectorAll("[data-ticker]").forEach(
    (row) =>
      (row.onclick = (e) => {
        if (e.target.closest("a")) return;
        selected = row.dataset.ticker;
        book = null;
        bookTicker = null;
        render();
        fetchBook();
      }),
  );
  if ($("#prev"))
    $("#prev").onclick = () => {
      tablePage--;
      $("#market-table").innerHTML = marketTable();
      bindRows();
    };
  if ($("#next"))
    $("#next").onclick = () => {
      tablePage++;
      $("#market-table").innerHTML = marketTable();
      bindRows();
    };
}
function bookHtml() {
  if (bookTicker !== selected || !book)
    return empty(
      "Depth is not yet confirmed",
      bookError ||
        "Select a contract or refresh to request its official order book.",
      "≋",
    );
  const rows = levels(book);
  const max = Math.max(1, ...rows.map((l) => l.quantity));
  return `<div class="tabbed-book"><table><thead><tr><th>SIDE</th><th>BID PRICE</th><th>CONTRACTS</th><th>SOURCE</th></tr></thead><tbody>${rows.map((l) => `<tr><td>${l.side.toUpperCase()} bid</td><td>${cents(l.price)}</td><td>${num(l.quantity)}<span class="book-bar" style="width:${(l.quantity / max) * 100}px"></span></td><td>${external(`${API}/markets/${encodeURIComponent(selected)}/orderbook`)}</td></tr>`).join("") || `<tr><td colspan="4">No price levels returned.</td></tr>`}</tbody></table></div><div class="status-line">Observed ${esc(date(bookTime))}. Bids only; no invented ask liquidity.</div>`;
}
async function fetchBook() {
  if (!selected) return;
  const id = selected;
  try {
    const r = await fetch(
      `${API}/markets/${encodeURIComponent(id)}/orderbook`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const b = await r.json();
    if (!b.orderbook_fp) throw Error("Unrecognized book schema");
    if (id !== selected) return;
    book = b;
    bookTicker = id;
    bookTime = new Date().toISOString();
    bookError = "";
  } catch (e) {
    book = null;
    bookTicker = null;
    bookError = `Unavailable: ${e.message}. Browser CORS or network policy may block direct access.`;
  }
  if ($("#book")) $("#book").innerHTML = bookHtml();
}
function renderAlerts() {
  $("#content").innerHTML =
    `<div class="callout"><strong>Two feeds, one observable truth.</strong> The candidate feed screens for ≤ 3¢ spread, ≥ 10 YES contracts at the ask, and ≥ 100 contracts of 24h volume. It does not predict a winning outcome. Expected ROI remains blank / unverified.</div><div class="section-top"><div><h2>Live movement monitor</h2><p>Polling the top 100 active tracked contracts plus open paper positions, every 10 seconds when this tab is visible.</p></div><button id="pause" class="button">${paused ? "▶ Resume" : "Ⅱ Pause"} browser polling</button></div><div class="two-feeds"><section class="panel">${feedPanel(true, false)}</section><section class="panel">${feedPanel(true, true)}</section></div>`;
  $("#pause").onclick = () => {
    paused = !paused;
    render();
  };
}
function renderPortfolio() {
  const ledger =
    portfolioMode === "scheduled" ? snapshot.paper || emptyPaper() : paper;
  const stats = paperStats(ledger, markets);
  $("#content").innerHTML =
    `<div class="callout warning"><strong>Paper ledger, not your Kalshi account.</strong> No authenticated demo account is connected. These are ${portfolioMode === "scheduled" ? "scheduled-collector" : "browser-local"} simulated trades with a $1,000 starting allocation per strategy. Execution and fees are not verified. ${external("https://docs.kalshi.com/api-reference/portfolio/get-balance", "Demo account API ↗")}</div><div class="stats">${stat("Realized P&L · gross", money(stats.realized), "Only officially settled contracts", "$")}${stat("Open mark-to-bid · gross", money(stats.unrealized), "Unavailable marks remain blank", "↗")}${stat("Simulated trades", num(stats.count), `${stats.open} open · ${stats.count - stats.open} settled`, "◴")}${stat("Settled win rate", stats.winRate === null ? "" : (stats.winRate * 100).toFixed(1) + "%", "No settled sample = no claim", "◎")}</div><div class="section-top"><div><h2>Experiment ledger</h2><p>Scheduled runs persist bounded history in Actions cache; browser runs persist only on this device.</p></div><div class="segmented"><button data-ledger="scheduled" class="${portfolioMode === "scheduled" ? "selected" : ""}">Scheduled</button><button data-ledger="browser" class="${portfolioMode === "browser" ? "selected" : ""}">This browser</button></div></div><section class="panel"><div class="panel-head"><div><h2>Trade journal</h2><p>One entry per strategy / contract while open · market settlement controls exit</p></div><button id="export-journal" class="button">↓ Export journal</button></div><div class="table-wrap"><table><thead><tr><th>CONTRACT</th><th>TOPIC / STRATEGY</th><th>SIDE / QTY</th><th>ENTRY</th><th>EXIT / RESULT</th><th>GROSS P&L</th><th>OPENED / SETTLED</th><th>OFFICIAL INPUT</th></tr></thead><tbody>${
      ledger.trades
        .slice()
        .reverse()
        .map(
          (t) =>
            `<tr><td><strong>${esc(t.title)}</strong><small>${esc(t.execution)}</small></td><td>${esc(t.topic)} / ${esc(t.strategy)}</td><td>YES / ${num(t.quantity)}</td><td>${cents(t.entry)}</td><td>${cents(t.exit)} ${esc(t.result || "")}</td><td>${money(t.pnl)}</td><td>${esc(date(t.openedAt))}<small>${esc(date(t.closedAt))}</small></td><td>${external(t.source)}</td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="8">${empty("The experiment is waiting for a signal", "Trades are created automatically only after a fresh, qualifying swing. No past performance is invented.", "◴")}</td></tr>`
    }</tbody></table></div></section><div class="below-grid"><section class="panel"><div class="panel-head"><h2>By topic</h2></div>${breakdown(TOPICS, "topic", ledger)}</section><section class="panel"><div class="panel-head"><h2>By strategy</h2></div>${breakdown(["Momentum", "Reversion"], "strategy", ledger)}</section></div>`;
  $("#export-journal").onclick = () =>
    download("tradebot-paper-journal.json", ledger);
  document.querySelectorAll("[data-ledger]").forEach(
    (b) =>
      (b.onclick = () => {
        portfolioMode = b.dataset.ledger;
        render();
      }),
  );
}
function breakdown(groups, key, ledger = paper) {
  return `<div class="table-wrap"><table><thead><tr><th>GROUP</th><th>TRADES</th><th>REALIZED GROSS</th><th>SOURCE</th></tr></thead><tbody>${groups
    .map((g) => {
      const ts = ledger.trades.filter((t) => t[key] === g);
      return `<tr><td>${g}</td><td>${ts.length}</td><td>${money(ts.reduce((a, t) => a + (t.pnl || 0), 0))}</td><td>${external("https://docs.kalshi.com/getting_started/market_settlement", "Settlement basis ↗")}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function renderStrategies() {
  $("#content").innerHTML =
    `<div class="summary-hero"><div class="eyebrow">RESEARCH, NOT A PROMISE</div><h2>Test the rule. Question the edge.</h2><p>Two deliberately simple YES-only strategies run automatically on fresh, source-linked observations. There is no trained forecasting model, no validated high-ROI claim, and no real-money execution.</p></div><div class="below-grid">${[
      "Momentum",
      "Reversion",
    ]
      .map((s) => {
        const st = paperStats(snapshot.paper || emptyPaper(), markets, s);
        return `<section class="panel"><div class="panel-head"><h2>${s}</h2><span class="live-pill">PAPER EXPERIMENT</span></div><div class="panel-body"><h3>${s === "Momentum" ? "Follow an upward swing" : "Buy after a downward swing"}</h3><p>${s === "Momentum" ? "Buy YES after a ≥10¢ observed increase." : "Buy YES after a ≥10¢ observed decrease."} Hold until official settlement. Both must pass the same liquidity screen.</p><ul><li>Maximum 10 contracts and $10 entry cost per signal.</li><li>Maximum 20 open positions / strategy; $1,000 initial allocation / strategy.</li><li>Observed YES ask and ask quantity required. No fabricated fills.</li><li>Unknown trading fees stay blank. P&L shown gross only.</li></ul><p>Scheduled ledger: ${st.count} simulated trades · ${money(st.realized)} gross realized P&L</p>${external("https://docs.kalshi.com/getting_started/market_settlement", "Official settlement mechanics ↗")} · <a href="https://github.com/kanlerxz87-cyber/Tradebot2/blob/main/src/engine.js" target="_blank" rel="noopener noreferrer">Inspect research rules ↗</a></div></section>`;
      })
      .join(
        "",
      )}</div><div class="callout"><strong>High ROI cannot be verified from liquidity.</strong> A calibrated probability estimate, holdout evaluation, actual fees, slippage and sufficient settled observations are required before reporting expected return. No such values are filled in here.</div><section class="panel"><div class="panel-head"><h2>Suggested improvements · prioritized</h2></div><div class="panel-body"><ol><li>Deploy a private, always-on authenticated WebSocket relay for second-level observations and sequence-gap recovery.</li><li>Reconcile demo orders with fills, fees, positions and settlements before reporting account P&L.</li><li>Attach timestamped first-party releases to chart markers; label correlation separately from verified causation.</li><li>Compare strategy results by topic and time period with walk-forward holdouts, calibration and maximum drawdown.</li><li>Add opt-in push / audio alerts, pinned contracts and a compact keyboard-first trading workspace.</li></ol>${external("https://docs.kalshi.com/websockets/websocket-connection", "Official WebSocket requirements ↗")}</div></section>`;
}
function renderSources() {
  $("#content").innerHTML =
    `<div class="callout"><strong>Verified documentation, not a blanket certification.</strong> Each claim below was checked against an official source on 2026-11-22. A documented API schema does not verify an account balance or a market value. Market rows link directly to their official API resource.</div><section class="panel"><div class="panel-head"><h2>Official source register</h2><span class="metric-sub">${sources.length} references</span></div><div class="table-wrap"><table class="review-table"><thead><tr><th>REFERENCE</th><th>WHAT WAS CHECKED</th><th>VERIFICATION</th><th>OFFICIAL SOURCE</th></tr></thead><tbody>${sources.map((s) => `<tr><td><strong>${esc(s.title)}</strong></td><td>${esc(s.claim)}</td><td>${esc(s.status)}</td><td>${external(s.url, "Review source ↗")}</td></tr>`).join("")}</tbody></table></div></section><div class="below-grid"><section class="panel"><div class="panel-head"><h2>Data definitions</h2></div><div class="panel-body"><p><strong>Face-value open interest</strong> = reported open_interest_fp × notional_value_dollars, summed across tracked contracts in an event. This derived exposure metric is not executed dollar turnover, capital at risk, or guaranteed available liquidity.</p><p><strong>Price</strong> = last_price_dollars. <strong>Liquidity</strong> = reported bid-level contract quantities; market YES ask size is separately reported. <strong>Alert</strong> = ≥10¢ change between consecutive observations no more than 120 seconds apart.</p><p><strong>Topic membership</strong> uses exact series tags / categories. Gasoline uses official product_metadata.scope = Gasoline. Culture includes Culture and Entertainment. Elections excludes generic Politics unless tagged Elections.</p>${external("https://docs.kalshi.com/api-reference/market/get-series-list", "Official series schema ↗")}</div></section><section class="panel"><div class="panel-head"><h2>Collection & retention</h2></div><div class="panel-body"><p>Pages publishes scheduled snapshots (requested every five minutes; timing is not guaranteed). The visible browser polls the top 100 active tracked contracts by exposure plus open paper positions every 10 seconds. It refreshes the published universe every 60 seconds. Browser restrictions may block requests.</p><p>History is retained for the top 100 overall / top 20 per topic plus open-paper and recent-alert contracts, up to 2,000 observations each; 1,000 alerts are retained in the scheduled cache. Cache expiry can lose history. Browser-local paper records persist until site storage is cleared. No private credentials or authenticated account data are published.</p><p>Observed ${esc(date(snapshot.observedAt) || "not yet available")}. ${num(snapshot.coverage.series)} matched series, ${num(snapshot.coverage.events)} open events. Coverage: ${snapshot.coverage.complete ? "complete for stated discovery scope" : "incomplete / unverified"}.</p>${external("https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule", "Schedule limitations ↗")}</div></section></div>`;
}
function renderReview() {
  const dynamic = (snapshot.errors || []).map((e, i) => ({
    title: `Collector finding ${i + 1}`,
    detail: e,
    status: "Needs review",
    url: API + "/events?status=open&limit=1",
  }));
  $("#content").innerHTML =
    `<div class="callout warning"><strong>Transparency is part of the product.</strong> Unconfirmed financial values stay blank. No news, return, trade, resolution or liquidity is invented to make this dashboard look active.</div><section class="panel"><div class="panel-head"><div><h2>Flagged for review</h2><p>These items do not block the static site; they do limit what it can honestly claim.</p></div><span class="review-status">${flags.length + dynamic.length} OPEN ITEMS</span></div><div class="table-wrap"><table class="review-table"><thead><tr><th>ITEM</th><th>FINDING / IMPACT</th><th>STATUS</th><th>OFFICIAL REFERENCE</th></tr></thead><tbody>${[...flags, ...dynamic].map((f) => `<tr><td><strong>${esc(f.title)}</strong></td><td>${esc(f.detail)}</td><td><span class="review-status">${esc(f.status)}</span></td><td>${external(f.url, "Review source ↗")}</td></tr>`).join("")}</tbody></table></div></section>`;
}
function renderSummary() {
  $("#content").innerHTML =
    `<div class="summary-hero"><div class="eyebrow">EXECUTIVE BRIEF / 22 NOV 2026</div><h2>A focused observatory. An honest trading lab.</h2><p>Tradebot brings five market topics into a source-linked workspace: gas prices, elections, culture, crypto and golf. It prioritizes observable market data and transparent experiments over unsupported predictions.</p></div><section class="panel"><div class="panel-head"><h2>Requirements & delivery status</h2><a class="text-link" href="./docs/EXECUTIVE_SUMMARY.md" target="_blank">Download full brief ↗</a></div><div class="table-wrap"><table class="review-table"><thead><tr><th>REQUIREMENT</th><th>IMPLEMENTATION / FINDING</th><th>STATUS</th><th>OFFICIAL BASIS</th></tr></thead><tbody>${requirements.map((r) => `<tr><td><strong>${esc(r.title)}</strong></td><td>${esc(r.detail)}</td><td><span class="${r.status === "Implemented" ? "live-pill" : "review-status"}">${r.status}</span></td><td>${external(r.url, "Reference ↗")}</td></tr>`).join("")}</tbody></table></div></section><div class="below-grid"><section class="panel"><div class="panel-head"><h2>Important distinctions</h2></div><div class="panel-body"><ul><li>Demo funds and market behavior are not production performance.</li><li>Face-value open interest is a ranking proxy, not dollar turnover.</li><li>Strategy candidates are liquidity-screened, not validated high-ROI predictions.</li><li>Closed is not settled. Outcomes come only from official YES / NO results and settlement values.</li><li>Paper ledger, demo-account fills and actual cash are separate concepts.</li></ul>${external("https://docs.kalshi.com/getting_started/demo_env", "Kalshi demo caveats ↗")}</div></section><section class="panel"><div class="panel-head"><h2>What to do next</h2></div><div class="panel-body"><p>The highest-impact upgrade is a private always-on relay with authenticated WebSockets, a durable observation store, and demo-account fill reconciliation. GitHub Pages remains a public read-only presentation layer.</p><p>Nothing secret belongs in the browser. Existing public market monitoring and paper experiments operate without asking for account credentials.</p><p><a href="#/review">See every flagged limitation ↗</a> · <a href="#/strategies">Explore the strategy lab ↗</a></p></div></section></div>`;
}
async function poll() {
  if (polling || paused || document.hidden || !markets.length) return;
  polling = true;
  try {
    const ids = new Set([
      ...markets
        .filter(isOpen)
        .sort((a, b) => (exposure(b) ?? -1) - (exposure(a) ?? -1))
        .slice(0, 100)
        .map((m) => m.ticker),
      ...paper.trades.filter((t) => !t.closedAt).map((t) => t.ticker),
      ...(selected ? [selected] : []),
    ]);
    const old = new Map(markets.map((m) => [m.ticker, m]));
    const newAlerts = [];
    let received = 0;
    const list = [...ids];
    for (let i = 0; i < list.length; i += 50) {
      const r = await fetch(
        `${API}/markets?tickers=${list
          .slice(i, i + 50)
          .map(encodeURIComponent)
          .join(",")}`,
        { signal: AbortSignal.timeout(12000) },
      );
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data.markets)) throw Error("Invalid API response");
      const now = new Date().toISOString();
      for (const raw of data.markets) {
        const p = old.get(raw.ticker);
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
          now,
        );
        old.set(m.ticker, m);
        const a = swing(p, m, now);
        if (a) newAlerts.push(a);
        if (m.last !== null) {
          (history[m.ticker] ||= []).push({ time: now, price: m.last });
          history[m.ticker] = history[m.ticker].slice(-2000);
        }
        received++;
      }
    }
    if (!received) throw Error("No matching observations returned");
    const merged = new Map(markets.map((m) => [m.ticker, m]));
    for (const [id, m] of old) {
      if (
        !merged.has(id) ||
        Date.parse(m.observedAt) >= Date.parse(merged.get(id).observedAt)
      )
        merged.set(id, m);
    }
    markets = [...merged.values()];
    alerts = [...alerts, ...newAlerts].slice(-1000);
    lastSuccess = new Date().toISOString();
    failures = 0;
    connection = `Demo API connected · ${received} contracts observed · 10s polling`;
    runPaper(paper, markets, newAlerts, lastSuccess);
    saveLocal();
    if (newAlerts.length)
      toast(
        `${newAlerts.length} price swing${newAlerts.length === 1 ? "" : "s"} observed ≥10¢.`,
      );
    render();
  } catch (e) {
    failures++;
    connection = `Snapshot mode · live request unavailable (${e.message})`;
    updateConnection();
  } finally {
    polling = false;
  }
}
async function loadTopic(t) {
  if (
    loadingTopics.has(t) ||
    (loadedTopics.get(t) === snapshot.observedAt && loadedTopics.has(t))
  )
    return;
  loadingTopics.add(t);
  try {
    const r = await fetch(`./data/topics/${slug(t)}.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data.markets)) throw Error("Invalid topic schema");
    const byId = new Map(markets.map((m) => [m.ticker, m]));
    for (const m of data.markets) {
      if (m.topic !== t) continue;
      const p = byId.get(m.ticker);
      if (!p || Date.parse(m.observedAt) > Date.parse(p.observedAt))
        byId.set(m.ticker, m);
    }
    markets = [...byId.values()];
    for (const [k, v] of Object.entries(data.history || {}))
      history[k] = [
        ...new Map(
          [...v, ...(history[k] || [])].map((p) => [p.time, p]),
        ).values(),
      ]
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        .slice(-2000);
    loadedTopics.set(t, snapshot.observedAt);
    if (topic === t) render();
  } catch (e) {
    toast(
      `${t}: full topic data unavailable (${e.message}); displayed observations are a subset.`,
    );
  } finally {
    loadingTopics.delete(t);
  }
}
async function getSnapshot(initial = false) {
  try {
    const r = await fetch(`./data/snapshot.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const s = await r.json();
    if (s.schemaVersion !== 1 || !Array.isArray(s.markets))
      throw Error("Unknown snapshot schema");
    snapshot = s;
    const byId = new Map(markets.map((m) => [m.ticker, m]));
    for (const m of s.markets) {
      if (
        !byId.has(m.ticker) ||
        Date.parse(m.observedAt) > Date.parse(byId.get(m.ticker).observedAt)
      )
        byId.set(m.ticker, m);
    }
    markets = [...byId.values()];
    for (const [k, v] of Object.entries(s.history || {})) {
      const combined = [...v, ...(history[k] || [])];
      history[k] = [...new Map(combined.map((p) => [p.time, p])).values()]
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        .slice(-2000);
    }
    alerts = [
      ...new Map(
        [...(s.alerts || []), ...alerts].map((a) => [a.id, a]),
      ).values(),
    ]
      .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
      .slice(-1000);
    // Browser ledger is intentionally separate from scheduled collector paper ledger.
    if (initial) {
      const d = loadLocal();
      if (d) {
        for (const [k, v] of Object.entries(d.history || {})) {
          history[k] = [
            ...new Map(
              [...(history[k] || []), ...v].map((p) => [p.time, p]),
            ).values(),
          ]
            .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
            .slice(-2000);
        }
        alerts = [
          ...new Map(
            [...alerts, ...(d.alerts || [])].map((a) => [a.id, a]),
          ).values(),
        ]
          .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
          .slice(-1000);
      }
    }
    runPaper(paper, markets, [], new Date().toISOString());
    connection = lastSuccess
      ? connection
      : "Official snapshot loaded · attempting live browser connection";
    render();
    if (topic) loadTopic(topic);
    for (const t of new Set(
      paper.trades.filter((t) => !t.closedAt).map((t) => t.topic),
    ))
      loadTopic(t);
  } catch (e) {
    connection = `Data unavailable (${e.message}) · no financial values inferred`;
    render();
  }
}
function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#refresh").onclick = async () => {
  const b = $("#refresh");
  b.disabled = true;
  await getSnapshot();
  await poll();
  await fetchBook();
  b.disabled = false;
  toast(
    "Refresh complete. Connection status reflects which sources were reachable.",
  );
};
$("#export").onclick = () =>
  download("tradebot-observations.json", {
    exportedAt: new Date().toISOString(),
    markets,
    history,
    alerts,
    coverage: snapshot.coverage,
    source: API,
  });
window.addEventListener("hashchange", route);
route();
setInterval(() => {
  $("#utc-clock").textContent =
    new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }) + " · UTC";
  updateConnection();
}, 1000);
await getSnapshot(true);
await poll();
fetchBook();
setInterval(() => {
  if (failures < 3 || Date.now() % 60000 < 10000) poll();
}, 10000);
setInterval(() => {
  if (!document.hidden) getSnapshot();
}, 60000);
