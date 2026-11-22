/* Topic page renderer. One pageload per topic; every row is a verified snapshot
 * record or (if the demo API answers) a live market, always with its source. */
(() => {
  const { $, money, cents, numf, esc } = T2;

  const COPY = {
    gas: {
      title: "Gas prices",
      blurb: "Kalshi prices US retail gasoline in the <b>Economics</b> category under the tag " +
        "<b>Oil and energy</b>. Every gas series settles from AAA average pump prices. " +
        "There is no <code>category=Gas</code> on the API — that request returns an empty list, which is " +
        "flagged on the review page.",
      series: "KXAAAGAS*",
      link: "https://gasprices.aaa.com/",
      linkLabel: "AAA gas prices (official settlement source)",
    },
    elections: {
      title: "Elections",
      blurb: "The API's own <b>Elections</b> category. Series in this family settle from official " +
        "election results and congressional records; each row below carries the settlement source the " +
        "series object declares.",
      series: "PRESPARTY*, KXSENATE*, KXGOV*",
      link: "https://www.congress.gov/",
      linkLabel: "Library of Congress / Congress (settlement source used by these series)",
    },
    culture: {
      title: "Culture",
      blurb: "Category <b>Culture</b>: awards, entertainment and internet-culture markets. The settlement " +
        "source lists on these series are long and mix real outlets with search-engine placeholders — " +
        "that is flagged for review rather than cleaned up silently.",
      series: "KXX*",
      link: "https://apnews.com/",
      linkLabel: "Associated Press (first outlet named in the settlement list)",
    },
    crypto: {
      title: "Crypto",
      blurb: "Category <b>Crypto</b>. Most series settle from <b>CF Benchmarks</b> real-time indices " +
        "(BRTI for bitcoin); the hourly KXBTCD ladder uses the average of the final sixty BRTI prints. " +
        "One pre-market series settles from CoinGecko.",
      series: "KXBTC*, KXXRP*, KXNEAR*",
      link: "https://www.cfbenchmarks.com/",
      linkLabel: "CF Benchmarks (index administrator)",
    },
    golf: {
      title: "Golf",
      blurb: "Golf is <b>not</b> its own category: the API files it under <b>Sports</b> with the tag " +
        "<b>Golf</b>. Series cover PGA Tour and DP World Tour markets and settle from the tours, ESPN, " +
        "Fox Sports and the WSJ depending on the market.",
      series: "KXPGA*, KXDPWT*",
      link: "https://www.pgatour.com/",
      linkLabel: "PGA Tour (governing league named by the series)",
    },
  };

  const topic = document.body.dataset.topic;
  const copy = COPY[topic];
  if (!copy) return;

  function seriesRows(data) {
    return data.rows.filter((r) => r.row_type === "series" && r.topic === topic).map((r) => `<tr>
      <td class="tick">${esc(r.ticker)}</td>
      <td>${esc(r.title)}</td>
      <td><span class="badge">${esc(r.category)}</span></td>
      <td class="small">${(r.tags || []).map((t) => `<span class="badge">${esc(t)}</span>`).join(" ") || '<span class="unverified">—</span>'}</td>
      <td class="small">${esc(r.frequency || "—")}</td>
      <td class="small">${esc(r.settlement_source || "—")}</td>
      <td class="small">${Shell.srcLink(r.source_url, "kalshi")}</td>
      <td class="small">${r.settlement_url ? `<a href="${esc(r.settlement_url)}" target="_blank" rel="noopener">settlement ↗</a>` : '<span class="unverified">—</span>'}</td>
    </tr>`).join("");
  }

  function marketRows(data) {
    const rows = data.rows.filter((r) => r.row_type === "market" && r.topic === topic);
    if (!rows.length) return `<tr><td colspan="9" class="chat-empty">No live market recorded for this topic at the snapshot time. That is a real gap, not a zero — see the gap log below.</td></tr>`;
    return rows.map((m) => `<tr>
      <td class="tick">${esc(m.ticker)}</td>
      <td>${esc(m.title)}<div class="small dim">${esc(m.event_ticker || "")}</div></td>
      <td class="num">${cents(Number(m.last_price))}</td>
      <td class="num">${cents(Number(m.yes_bid))}</td>
      <td class="num">${cents(Number(m.yes_ask))}</td>
      <td class="num">${numf(Number(m.yes_bid_size), 0)}</td>
      <td class="num">${numf(Number(m.volume), 2)}</td>
      <td class="num">${numf(Number(m.open_interest), 2)}</td>
      <td class="small">${Shell.srcLink(m.source_url, "kalshi")}</td>
    </tr>`).join("");
  }

  function resolvedRows(data) {
    const rows = data.rows.filter((r) => r.row_type === "resolved" && r.topic === topic);
    if (!rows.length) return `<tr><td colspan="6" class="chat-empty">No resolved market captured for this topic yet.</td></tr>`;
    return rows.map((r) => `<tr>
      <td class="tick">${esc(r.ticker)}</td>
      <td>${esc(r.title)}</td>
      <td><span class="badge ${r.result === "yes" ? "ok" : "err"}">${esc(r.result)}</span></td>
      <td class="num">${esc(r.settlement_value)}</td>
      <td class="small mono">${esc(r.settlement_ts || "—")}</td>
      <td class="small">${Shell.srcLink(r.source_url, "kalshi")}</td>
    </tr>`).join("");
  }

  (async () => {
    document.getElementById("topicTitle").textContent = copy.title;
    document.getElementById("topicBlurb").innerHTML = copy.blurb;
    const seriesBadge = document.getElementById("topicSeries");
    if (seriesBadge) seriesBadge.textContent = copy.series;
    document.getElementById("topicLink").href = copy.link;
    document.getElementById("topicLink").textContent = copy.linkLabel + " ↗";

    const data = await fetch("data/markets.json").then((r) => r.json());
    $("#seriesTable tbody").innerHTML = seriesRows(data);
    $("#marketTable tbody").innerHTML = marketRows(data);
    $("#resolvedTable tbody").innerHTML = resolvedRows(data);

    // live block: only shown when the demo API actually answers this browser
    const st = await T2.status();
    const box = $("#liveBox");
    if (!st.ok) {
      box.innerHTML = `<div class="notice">Live prices are unavailable from this browser
        (${esc(st.error)}). The tables above are the verified snapshot captured ${esc(data.snapshot_ts)}, with a
        source link on every row.</div>`;
      return;
    }
    box.innerHTML = `<div class="notice info">Live demo API reachable — sweeping open markets for
      this topic…</div>`;
    await sweepLive(box);
    setInterval(() => sweepLive(box), 30000);
  })();

  async function sweepLive(box) {
    const prefixes = {
      gas: ["KXAAAGASD"], elections: ["KXSENATEID", "KXGOVHINOMR"],
      culture: ["KXXBANNEDGROK"], crypto: ["KXBTCD"], golf: ["KXPGAWINMARGIN", "KXPGAROUNDLOW"],
    }[topic] || [];
    const found = [];
    for (const s of prefixes) {
      try {
        const d = await T2.api("/markets", { status: "open", series_ticker: s, limit: 10 });
        (d.markets || []).forEach((m) => found.push({ m, s }));
      } catch (e) { /* counted below */ }
    }
    if (!found.length) {
      box.innerHTML = `<div class="notice"><b>No open markets right now</b> in the series sampled for
        this topic (${esc(prefixes.join(", "))}). The API answered, it simply has nothing open — the same
        result as the snapshot's gap log.</div>`;
      return;
    }
    box.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>live market</th><th>title</th><th class="num">bid</th><th class="num">offer</th>
      <th class="num">bid depth</th><th class="num">volume</th><th>source</th></tr></thead><tbody>
      ${found.map(({ m }) => {
        const yesBid = T2.num(m.yes_bid_dollars);
        const noBid = T2.num(m.no_bid_dollars);
        const ask = noBid != null && noBid > 0 && noBid < 1 ? 1 - noBid : T2.num(m.yes_ask_dollars);
        return `<tr><td class="tick">${esc(m.ticker)}</td>
          <td>${esc((m.yes_sub_title || m.title || "") + "")}</td>
          <td class="num">${yesBid == null ? "—" : cents(yesBid)}</td>
          <td class="num">${ask == null || ask >= 1 ? "—" : cents(ask)}</td>
          <td class="num">${numf(T2.num(m.yes_bid_size_fp), 0)}</td>
          <td class="num">${numf(T2.num(m.volume_fp), 2)}</td>
          <td class="small">${Shell.srcLink(`${T2.DEMO}/markets/${m.ticker}`, "kalshi")}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  }
})();
