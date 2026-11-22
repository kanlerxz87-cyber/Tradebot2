/* Landing dashboard: live feed sweep, two alert chats, price chart + depth ladder. */
(async () => {
  const { $, money, cents, numf, esc, isoTime, THRESHOLD } = T2;
  const state = T2.state;
  let selected = null;
  let windowMin = 60;
  let view = "live"; // live | snapshot
  let snapshotData = null;

  /* ---------- data ---------- */
  async function boot() {
    await Shell.paintStatus();
    const st = await T2.status();
    if (!st.ok) {
      view = "snapshot";
      snapshotData = await T2.snapshot();
      renderSnapshotBanner(st.error);
      renderSnapshotAll();
      return;
    }
    T2.start(8000);
    T2.on(renderLive);
    pollLoop();
  }

  function renderSnapshotBanner(err) {
    const el = $("#feedNote");
    if (el) el.innerHTML = `<div class="notice danger"><b>Live feed unavailable in this browser.</b>
      The demo API call failed (${esc(err || "network/CORS")}). Showing the committed snapshot captured
      ${esc(snapshotData.markets.snapshot_ts)} instead. Nothing below is invented — it is the captured
      response data. <a href="${T2.DEMO}/exchange/status" target="_blank" rel="noopener">test the endpoint ↗</a></div>`;
  }

  /* ---------- live rendering ---------- */
  function allMarkets() { return Array.from(state.markets.values()); }

  function renderLive() {
    const markets = allMarkets().filter((m) => m.topic);
    $("#kpiMode").textContent = "LIVE";
    $("#kpiMode").className = "badge live";
    $("#kpiPolls").textContent = state.polls;
    $("#kpiMarkets").textContent = markets.length;
    $("#kpiAlerts").textContent = state.alerts.length;
    $("#kpiHigh").textContent = state.alerts.filter((a) => a.high_roi).length;
    $("#feedNote").innerHTML = `<span class="muted small">polling every 8 s · last sweep
      ${state.lastPoll ? new Date(state.lastPoll).toISOString().slice(11, 19) + "Z" : "-"} ·
      ${state.errors} failed request(s) so far · threshold ${cents(THRESHOLD)} either direction</span>`;

    renderChats(state.alerts);
    renderTopicTable(markets);
    if (!selected && markets.length) select(markets[0].ticker);
    if (selected) renderDetail();
  }

  function renderChats(alerts) {
    const all = alerts.map((a) => chatRow(a));
    $("#chatAll").innerHTML = all.length ? all.join("") : '<div class="chat-empty">No ≥ $0.10 moves yet. The detector compares each 8-second sweep against the previous one.</div>';
    const hi = alerts.filter((a) => a.high_roi).map((a) => chatRow(a));
    $("#chatHigh").innerHTML = hi.length ? hi.join("") : '<div class="chat-empty">No high-ROI alerts yet. An alert enters this feed when the published ROI score is ≥ 55.</div>';
  }

  function chatRow(a) {
    const t = new Date(a.ts * 1000).toISOString().slice(11, 19);
    return `<div class="msg ${a.direction}">
      <div class="row1">
        <span class="time">${t}Z</span>
        <span class="mv">${a.direction === "up" ? "▲" : "▼"} ${cents(a.delta)}</span>
        <span class="mono">${cents(a.before)} → ${cents(a.after)}</span>
        ${Shell.topicBadge(a.topic)}
        <span class="badge score">ROI ${a.score}</span>
      </div>
      <div class="title">${esc(a.title)}</div>
      <div class="meta">
        <span>liquidity ${a.liquidity == null ? "—" : numf(a.liquidity, 0) + " ct"}</span>
        <span>spread ${a.spread == null ? "—" : cents(a.spread)}</span>
        <span>${esc(a.basis)}</span>
        <a href="${esc(a.source_url)}" target="_blank" rel="noopener">market ↗</a>
        <a href="${esc(a.kalshi_url)}" target="_blank" rel="noopener">event page ↗</a>
      </div>
    </div>`;
  }

  /* ---------- table ---------- */
  function renderTopicTable(markets) {
    const rows = markets
      .slice()
      .sort((a, b) => (b.volume || 0) - (a.volume || 0))
      .map((m) => `<tr data-ticker="${esc(m.ticker)}" class="${selected === m.ticker ? "sel" : ""}">
        <td>${Shell.topicBadge(m.topic)}</td>
        <td class="tick">${esc(m.ticker)}</td>
        <td>${esc(m.title)}<div class="small dim">${esc(m.event_title || "")}</div></td>
        <td class="num">${m.price == null ? '<span class="unverified">—</span>' : cents(m.price)}</td>
        <td class="num">${m.yes_bid == null ? "—" : cents(m.yes_bid)}</td>
        <td class="num">${m.yes_ask == null ? "—" : cents(m.yes_ask)}</td>
        <td class="num">${numf(m.bid_size, 0)}</td>
        <td class="num">${numf(m.volume, 0)}</td>
        <td>${Shell.srcLink(m.source_url, "kalshi api")}</td>
      </tr>`).join("");
    $("#marketTable tbody").innerHTML = rows || `<tr><td colspan="9" class="chat-empty">No live markets for the five topics right now. See the topic pages for the verified series catalogue.</td></tr>`;
    T2.$$("#marketTable tbody tr").forEach((tr) => tr.addEventListener("click", () => select(tr.dataset.ticker)));
  }

  /* ---------- detail: chart + ladder ---------- */
  function select(ticker) {
    selected = ticker;
    T2.$$("#marketTable tbody tr").forEach((tr) => tr.classList.toggle("sel", tr.dataset.ticker === ticker));
    renderDetail();
  }

  async function renderDetail() {
    const m = state.markets.get(selected);
    if (!m) return;
    $("#detailTitle").textContent = m.title;
    $("#detailMeta").innerHTML = `${Shell.topicBadge(m.topic)} <span class="mono small">${esc(m.ticker)}</span>
      · ${Shell.srcLink(m.source_url, "api")} · ${Shell.srcLink(m.kalshi_url, "event page")}
      · closes ${esc(m.close_time || "—")} ${m.minutes_to_close != null ? `(${numf(m.minutes_to_close, 0)} min)` : ""}`;

    const path = (state.history.get(selected) || []);
    const cutoff = Date.now() / 1000 - windowMin * 60;
    const points = path.filter((p) => p.ts >= cutoff);
    T2.lineChart($("#priceChart"), points, { markers: state.alerts.filter((a) => a.ticker === selected && a.ts >= cutoff) });

    try {
      const book = await T2.api(`/markets/${encodeURIComponent(selected)}/orderbook`, { depth: 20 });
      const ladder = T2.ladderFromBook(book);
      T2.depthChart($("#depthChart"), ladder);
      $("#ladderMeta").innerHTML = `best bid ${ladder.bestBid == null ? "—" : cents(ladder.bestBid)} ·
        best ask ${ladder.bestAsk == null ? "—" : cents(ladder.bestAsk)} ·
        contracts bid within 1c: <b>${numf(T2.depthWithin(ladder.bids), 0)}</b> ·
        <a href="${esc(T2.DEMO)}/markets/${esc(selected)}/orderbook?depth=20" target="_blank" rel="noopener">raw book ↗</a>`;
      const rows = (side) => side.slice(0, 8).map((l) => `<tr><td class="num">${cents(l.price)}</td>
        <td class="num">${numf(l.contracts, 0)}</td></tr>`).join("");
      $("#bidLadder").innerHTML = ladder.bids.length ? rows(ladder.bids) : '<tr><td colspan="2" class="unverified">no bids</td></tr>';
      $("#askLadder").innerHTML = ladder.asks.length ? rows(ladder.asks) : '<tr><td colspan="2" class="unverified">no offers (derived from NO bids)</td></tr>';
    } catch (e) {
      $("#ladderMeta").innerHTML = `<span class="badge err">order book request failed: ${esc(e.message)}</span>`;
    }
  }

  function pollLoop() {
    setInterval(() => { if (selected) renderDetail(); }, 15000);
  }

  /* ---------- snapshot mode ---------- */
  function renderSnapshotAll() {
    const { markets, alerts } = snapshotData;
    $("#kpiMode").textContent = "SNAPSHOT";
    $("#kpiMode").className = "badge snap";
    $("#kpiPolls").textContent = "0";
    $("#kpiMarkets").textContent = markets.counts.markets;
    $("#kpiAlerts").textContent = alerts.summary.count;
    $("#kpiHigh").textContent = alerts.summary.high_roi;

    const chat = (list) => list.map((a) => {
      const t = new Date(a.ts * 1000).toISOString().slice(11, 19);
      return `<div class="msg ${a.direction}"><div class="row1">
        <span class="time">${t}Z</span><span class="mv">${a.direction === "up" ? "▲" : "▼"} ${cents(Number(a.delta))}</span>
        <span class="mono">${cents(Number(a.before))} → ${cents(Number(a.after))}</span>
        ${Shell.topicBadge(a.topic === "off-topic (Politics)" ? null : a.topic)}
        <span class="badge score">ROI ${a.roi_score}</span></div>
        <div class="title">${esc(a.title)}</div>
        <div class="meta"><span>${esc(a.basis)}</span>
          <a href="${esc(a.source_url)}" target="_blank" rel="noopener">candles ↗</a>
          <a href="${esc(a.evidence_url || "#")}" target="_blank" rel="noopener">official source ↗</a></div></div>`;
    }).join("");
    $("#chatAll").innerHTML = chat(alerts.alerts) || '<div class="chat-empty">none recorded</div>';
    $("#chatHigh").innerHTML = chat(alerts.alerts.filter((a) => a.high_roi)) || '<div class="chat-empty">none recorded</div>';

    const rows = markets.rows.filter((r) => r.row_type === "market").map((m) => `<tr>
      <td>${Shell.topicBadge(m.topic)}</td><td class="tick">${esc(m.ticker)}</td>
      <td>${esc(m.title)}</td><td class="num">${cents(Number(m.last_price))}</td>
      <td class="num">${cents(Number(m.yes_bid))}</td><td class="num">${cents(Number(m.yes_ask))}</td>
      <td class="num">${numf(Number(m.yes_bid_size), 0)}</td>
      <td class="num">${numf(Number(m.volume), 2)}</td>
      <td>${Shell.srcLink(m.source_url, "kalshi api")}</td></tr>`).join("");
    $("#marketTable tbody").innerHTML = rows;

    // chart the recorded candles for the one instrument that has them
    const cand = snapshotData.candles.series["KXELONMARS-99"];
    if (cand) {
      T2.lineChart($("#priceChart"), cand.rows.map((r) => ({ ts: r.ts, price: r.price == null ? null : Number(r.price) })),
        { markers: alerts.alerts.map((a) => ({ ts: a.ts, after: Number(a.after), direction: a.direction })) });
      T2.depthChart($("#depthChart"), { bids: [], asks: [] });
      $("#detailTitle").textContent = "Recorded path · KXELONMARS-99 (off-topic example)";
      $("#detailMeta").innerHTML = `The only demo instrument with recorded candles in the snapshot.
        Null bars are hours with no trade and are drawn as gaps. ${Shell.srcLink(cand.source_url, "candlesticks api")}`;
    }
  }

  /* ---------- controls ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    T2.$$("[data-window]").forEach((b) => b.addEventListener("click", () => {
      windowMin = Number(b.dataset.window);
      T2.$$("[data-window]").forEach((x) => x.classList.toggle("on", x === b));
      renderDetail();
    }));
    $("#refreshBtn")?.addEventListener("click", () => { if (view === "live") T2.pollOnce(); });
    boot();
  });
})();
