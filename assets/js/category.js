/* Category page: one topic only. Live price cells + verified resolution log. */
(function () {
  "use strict";
  const TB = window.TB;
  const UI = window.TBUI;

  document.addEventListener("DOMContentLoaded", async () => {
    const topic = document.body.getAttribute("data-topic");
    const meta = TB.TOPICS[topic];
    if (!meta) return;
    const data = await UI.loadAll(["snapshot.json", "probe.json"]);
    const snapshot = data["snapshot.json"];
    if (!snapshot) {
      document.querySelector("#topic-markets tbody").innerHTML = '<tr><td colspan="10"><div class="empty">Verified snapshot unavailable.</div></td></tr>';
      return;
    }
    UI.applySnapshotChrome(snapshot);
    const topicRow = (snapshot.topics || []).find((t) => t.key === topic) || {};
    const markets = (snapshot.markets || []).filter((m) => m.topic === topic);
    const resolutions = (snapshot.resolutions || []).filter((r) => r.topic === topic);
    const seed = (snapshot.alerts_seed || []).filter((a) => a.topic === topic);

    document.querySelectorAll("[data-topic-label]").forEach((el) => { el.textContent = meta.label; });
    document.querySelectorAll("[data-topic-open]").forEach((el) => { el.textContent = topicRow.open_markets !== undefined ? topicRow.open_markets : "—"; });
    document.querySelectorAll("[data-topic-tracked]").forEach((el) => { el.textContent = markets.length; });
    document.querySelectorAll("[data-topic-volume]").forEach((el) => { el.textContent = TB.compact(topicRow.volume_24h_contracts); });
    document.querySelectorAll("[data-topic-oi]").forEach((el) => { el.textContent = TB.compact(topicRow.open_interest_contracts); });
    document.querySelectorAll("[data-topic-resolved]").forEach((el) => { el.textContent = resolutions.length; });
    document.querySelectorAll("[data-topic-top]").forEach((el) => { el.textContent = TB.money(Math.max(0, ...markets.map((m) => m.volume.notional_24h_est || 0)), 0); });

    renderMarkets(markets, topic);
    renderResolutions(resolutions);
    renderSettlementSources(markets);
    renderSwings(seed);

    if (markets.length) {
      const feed = new TBLive.LiveFeed({
        markets: markets,
        onQuotes: (updates) => updatePrices(updates),
        onStatus: (status) => {
          if (status.status === "live") UI.setStatus("live", "LIVE · " + (TB.CONFIG.pollMs / 1000) + "s");
          else if (status.status === "connecting") UI.setStatus("connecting", "CONNECTING");
          else if (status.status === "degraded") UI.setStatus("degraded", "RETRYING");
          else if (status.status === "offline") UI.setStatus("offline", "SNAPSHOT");
        }
      });
      feed.start();
    }
  });

  function renderMarkets(markets, topic) {
    const body = document.querySelector("#topic-markets tbody");
    if (!body) return;
    if (!markets.length) {
      body.innerHTML = '<tr><td colspan="10"><div class="empty">No open ' + TB.esc(TB.TOPICS[topic].label.toLowerCase()) + ' markets were returned by the demo API at snapshot time. This is a coverage gap, not a zero price. See <a href="flagged.html">Flagged for review</a>.</div></td></tr>';
      return;
    }
    const groupKey = (m) => m.event_ticker || m.series_ticker || m.ticker;
    const sorted = markets.slice().sort((a, b) => {
      const ka = groupKey(a), kb = groupKey(b);
      if (ka !== kb) return ka < kb ? -1 : 1;
      return (b.volume.notional_24h_est || 0) - (a.volume.notional_24h_est || 0);
    });
    const counts = {};
    sorted.forEach((m) => { const k = groupKey(m); counts[k] = (counts[k] || 0) + 1; });
    let lastGroup = null;
    body.innerHTML = sorted.map((m) => {
      const k = groupKey(m);
      let groupRow = "";
      if (k !== lastGroup) {
        lastGroup = k;
        const label = m.event_title || m.series_ticker || k;
        groupRow = '<tr class="group-row"><td colspan="10"><span class="badge neutral">EVENT</span> <strong>' +
          TB.esc(label) + '</strong> <span class="sub mono">' + TB.esc(k) + ' · ' + counts[k] +
          ' market' + (counts[k] === 1 ? "" : "s") + '</span></td></tr>';
      }
      return groupRow + renderRow(m);
    }).join("");
  }

  function renderRow(m) {
    {
      const move = move24h(m);
      const liq = m.liquidity || {};
      return '<tr data-ticker="' + TB.esc(m.ticker) + '">' +
        '<td><a class="market-name" href="' + TB.esc(m.links.kalshi) + '" target="_blank" rel="noopener">' + TB.esc(m.title) + '</a>' +
        '<span class="sub mono">' + TB.esc(m.ticker) + '</span><span class="sub">' + TB.esc(m.event_title || "") + '</span></td>' +
        '<td class="num js-price">' + TB.money(TB.snapshotPrice(m).price) + '<span class="sub js-basis">' + TB.esc(TB.snapshotPrice(m).basis) + '</span></td>' +
        '<td class="num js-bid">' + TB.money(m.prices && m.prices.yes_bid) + '</td>' +
        '<td class="num js-ask">' + TB.money(m.prices && m.prices.yes_ask) + '</td>' +
        '<td class="num js-move ' + (move > 0 ? "up" : move < 0 ? "down" : "") + '">' + (move === null ? "—" : (move > 0 ? "+" : "") + TB.cents(move)) + '</td>' +
        '<td class="num">' + TB.compact(m.volume.last_24h_contracts) + '</td>' +
        '<td class="num">' + TB.compact(m.volume.open_interest_contracts) + '</td>' +
        '<td class="num"' + ' title="Computed estimate: 24h contracts × mid price, not an official dollar-volume field.">' + TB.money(m.volume.notional_24h_est, 0) + '</td>' +
        '<td class="num">' + (liq.spread === undefined || liq.spread === null ? "—" : TB.money(liq.spread)) + '<span class="sub">' + (liq.yes_depth_at_best !== undefined && liq.yes_depth_at_best !== null ? TB.compact(liq.yes_depth_at_best) + " at touch" : "depth n/a") + '</span></td>' +
        '<td class="small">' + TB.isoDate(m.close_time) + '<span class="sub"><span class="source-links"><a href="' + TB.esc(m.links.market_api) + '" target="_blank" rel="noopener">API ↗</a><a href="' + TB.esc(m.links.kalshi) + '" target="_blank" rel="noopener">Kalshi ↗</a></span></span></td>' +
        '</tr>';
    }
  }

  function updatePrices(updates) {
    Object.keys(updates).forEach((ticker) => {
      const row = document.querySelector('#topic-markets tr[data-ticker="' + ticker.replace(/"/g, '\\"') + '"]');
      if (!row) return;
      const q = updates[ticker];
      const price = row.querySelector(".js-price");
      if (price) price.innerHTML = TB.money(q.mid) + '<span class="sub">' + TB.esc(q.basis) + '</span>';
      const bid = row.querySelector(".js-bid");
      if (bid) bid.textContent = TB.money(q.bid);
      const ask = row.querySelector(".js-ask");
      if (ask) ask.textContent = TB.money(q.ask);
    });
  }

  function renderResolutions(resolutions) {
    const body = document.querySelector("#topic-resolutions tbody");
    if (!body) return;
    if (!resolutions.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty">No settled markets for this topic in the last 30 days.</div></td></tr>';
      return;
    }
    const sorted = resolutions.slice().sort((a, b) => String(b.close_time || "").localeCompare(String(a.close_time || "")));
    body.innerHTML = sorted.slice(0, 50).map((r) => {
      const result = r.result === "yes" ? '<span class="badge green">YES</span>' : '<span class="badge down">NO</span>';
      return '<tr><td><span class="market-name">' + TB.esc(r.title) + '</span><span class="sub mono">' + TB.esc(r.ticker) + '</span></td>' +
        '<td>' + result + '</td><td class="small">' + TB.isoDate(r.close_time) + '</td>' +
        '<td class="small mono">' + TB.esc(r.expiration_value || "—") + '</td>' +
        '<td class="small"><span class="source-links"><a href="' + TB.esc(r.links.market_api) + '" target="_blank" rel="noopener">API record ↗</a><a href="' + TB.esc(r.links.kalshi) + '" target="_blank" rel="noopener">Kalshi ↗</a></span></td></tr>';
    }).join("");
  }

  function renderSettlementSources(markets) {
    const host = document.querySelector("#settlement-sources");
    if (!host) return;
    const seen = new Map();
    markets.forEach((m) => {
      ((m.links || {}).settlement_sources || []).forEach((s) => {
        if (s && s.url) seen.set(s.name || s.url, s.url);
      });
    });
    if (!seen.size) {
      host.innerHTML = '<div class="empty">No settlement source was returned in the series metadata for these markets. See the event rules on Kalshi for the official source.</div>';
      return;
    }
    host.innerHTML = '<ul class="callout-list">' + Array.from(seen.entries()).slice(0, 12).map(([name, url]) =>
      '<li><a href="' + TB.esc(url) + '" target="_blank" rel="noopener">' + TB.esc(name) + '</a> <span class="muted small">— named in the series metadata returned by Kalshi</span></li>'
    ).join("") + "</ul>";
  }

  function renderSwings(seed) {
    const host = document.querySelector("#topic-swings");
    if (!host) return;
    if (!seed.length) {
      host.innerHTML = '<div class="empty">No ≥ $0.10 moves in the seeded 8-hour candle window for this topic. The live dashboard keeps watching.</div>';
      return;
    }
    host.innerHTML = seed.slice(0, 8).map((a) =>
      '<div class="msg ' + (a.direction === "up" ? "up" : "down") + ' history">' +
      '<div class="meta"><span class="time">' + TB.isoDate(new Date(a.ts * 1000)) + '</span>' +
      '<span class="badge ' + (a.direction === "up" ? "up" : "down") + '">' + (a.delta > 0 ? "+" : "") + TB.money(a.delta) + '</span>' +
      '<span class="badge neutral">history</span></div>' +
      '<div class="headline">' + TB.esc(a.title) + '</div>' +
      '<div class="numbers"><span>' + TB.money(a.before) + ' → ' + TB.money(a.after) + '</span><span>basis ' + TB.esc(a.basis) + '</span></div>' +
      UI.linkChips(a.links, { api: true, news: true, maxSources: 1 }) + '</div>'
    ).join("");
  }

  function move24h(market) {
    const rows = (market.candles || {})["1m"] || [];
    let first = null; let last = null;
    rows.forEach((row) => {
      if (row[1] === null || row[1] === undefined) return;
      if (first === null) first = row[1];
      last = row[1];
    });
    return first === null ? null : last - first;
  }
})();
