/* =============================================================================
   Tradebot2 live dashboard — core library (no dependencies, no build step)
   -----------------------------------------------------------------------------
   Every value that reaches the screen is either (a) read from the official Kalshi
   demo Trade API at request time, or (b) computed from those values by code in
   this file, which says how. Nothing is hard-coded as a market "fact".

   Official endpoints used (verified against docs.kalshi.com, 2026-11-22):
     GET /exchange/status                       api-reference/exchange/get-exchange-status
     GET /search/tags_by_categories             api-reference/search/get-tags-for-series-categories
     GET /series?category=&tags=&include_volume api-reference/market/get-series-list
     GET /events?status=&with_nested_markets=   api-reference/events/get-events
     GET /series/{series}/markets/{ticker}/candlesticks?period_interval=1|60|1440
                                                api-reference/market/get-market-candlesticks
     GET /markets/{ticker}/orderbook?depth=     api-reference/market/get-market-orderbook
     GET /markets/trades?ticker=&limit=         api-reference/market/get-trades
   ============================================================================= */
'use strict';

var TB = (() => {

  /* ---------- environments (docs.kalshi.com/getting_started/api_environments) */
  const ENVS = {
    demo: {
      label: 'Demo',
      rest: 'https://external-api.demo.kalshi.co/trade-api/v2',
      restAlt: 'https://demo-api.kalshi.co/trade-api/v2',
      ws: 'wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2',
      site: 'https://demo.kalshi.co'
    },
    prod: {
      label: 'Production',
      rest: 'https://external-api.kalshi.com/trade-api/v2',
      restAlt: 'https://api.elections.kalshi.com/trade-api/v2',
      ws: 'wss://external-api-ws.kalshi.com/trade-api/ws/v2',
      site: 'https://kalshi.com'
    }
  };

  /* ---------- topics ---------------------------------------------------------
     Filter values are exact strings returned by the official
     GET /search/tags_by_categories response on the demo host (2026-11-22):
       Elections     -> category "Elections"
       Crypto        -> category "Crypto"
       Entertainment -> category "Entertainment"  (the "Culture" topic)
       Commodities   -> tag "Oil & Gas"           (the "Gas prices" topic)
       Sports        -> tag "Golf"                (the "Golf" topic)
     There is no "Gas" or "Culture" category in the verified taxonomy; the mapping
     is shown on the site and flagged (see flagged.html).
     ------------------------------------------------------------------------- */
  const TOPICS = [
    { id: 'gas', name: 'Gas prices', icon: '⛽', filter: { category: 'Commodities', tags: 'Oil & Gas' },
      note: 'Retail gasoline series in the verified capture (AAA rules). Broader Oil & Gas discovery is not treated as retail gasoline; see F-02.' },
    { id: 'elections', name: 'Elections', icon: '🗳️', filter: { category: 'Elections' },
      note: 'Kalshi category “Elections”.' },
    { id: 'culture', name: 'Culture', icon: '🎭', filter: { category: 'Entertainment' },
      note: 'No “Culture” category exists; mapped to Kalshi category “Entertainment”. See flagged F-03.' },
    { id: 'crypto', name: 'Crypto', icon: '🪙', filter: { category: 'Crypto' },
      note: 'Kalshi category “Crypto”.' },
    { id: 'golf', name: 'Golf', icon: '⛳', filter: { category: 'Sports', tags: 'Golf' },
      note: 'Kalshi category “Sports”, tag “Golf”.' }
  ];
  const topicById = id => TOPICS.find(t => t.id === id) || null;

  /* ---------- constants with a cited source -------------------------------- */
  const ALERT_THRESHOLD = 0.10;   // task requirement: flag any move >= $0.10 either way
  const DEFAULTS = {
    pollSeconds: 60,              // public REST polling cadence (docs: responses are cached a few seconds)
    refreshCandlesSeconds: 300,   // candlesticks are 1-minute minimum resolution
    env: 'demo'
  };
  const LS = {
    env: 'tb.env', settings: 'tb.settings', paper: 'tb.paper', star: 'tb.star',
    snooze: 'tb.snooze', seen: 'tb.seenIntro'
  };

  /* ======================= small helpers ================================= */
  function num(v) {
    if (v === null || v === undefined || typeof v === 'boolean' || (typeof v === 'string' && !v.trim())) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  /** Fixed-point dollar strings: "0.5600" -> 0.56 (docs.kalshi.com/getting_started/fixed_point_migration).
      We measure price in CENTS so "$0.10" is exactly 10 cents with no float drift. */
  function cents(v) {
    const n = num(v);
    return n === null ? null : Math.round(n * 10000) / 100;   // dollars -> cents, 4dp preserved
  }
  function dollar(v, dp = 2) {
    const n = num(v);
    if (n === null) return '—';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
  function centsLabel(c) {
    if (c === null || c === undefined) return '—';
    return '¢' + (Math.round(c * 100) / 100).toFixed(Math.abs(c * 100 % 1) > 0 ? 2 : 0);
  }
  function compact(n) {
    const v = num(n);
    if (v === null) return '—';
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(v * 100) / 100);
  }
  function pct(v, dp = 1) {
    const n = num(v);
    if (n === null) return '—';
    return (n * 100).toFixed(dp) + '%';
  }
  function timeShort(ts, withSeconds = false) {
    if (!ts) return '—';
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}) });
  }
  function dateShort(ts) {
    if (!ts) return '—';
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function relTime(ts) {
    if (!ts) return '—';
    const ms = Date.now() - (ts instanceof Date ? ts.getTime() : new Date(ts).getTime());
    if (!Number.isFinite(ms)) return '—';
    if (ms < -5000) return 'in ' + Math.round(-ms / 60000) + 'm';
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's ago';
    const m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    if (h < 48) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (html != null) n.innerHTML = html;
    return n;
  }
  const script = [...document.scripts].find(s => /assets\/js\/core\.js/.test(s.getAttribute('src') || ''));
  const liveRoot = new URL('../../', script ? script.src : new URL('assets/js/core.js', location.href));
  const pageUrl = path => new URL(path, liveRoot).toString();
  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => [...(root || document).querySelectorAll(sel)];

  /* ======================= settings / storage ============================ */
  const store = {
    get(k, dflt) {
      try { const v = localStorage.getItem(k); return v === null ? dflt : JSON.parse(v); }
      catch (e) { return dflt; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function settings() {
    return Object.assign({ env: DEFAULTS.env, pollSeconds: DEFAULTS.pollSeconds, threshold: ALERT_THRESHOLD, sound: false }, store.get(LS.settings, {}));
  }
  function saveSettings(patch) { store.set(LS.settings, Object.assign(settings(), patch)); return settings(); }

  /* ======================= API client ==================================== */
  const api = (() => {
    let envKey = settings().env === 'prod' ? 'prod' : 'demo';
    let alt = false;
    const cache = new Map();       // url -> {t, data}
    const log = [];                // recent request log for the "sources" panel
    let okCount = 0, failCount = 0, blockedUntil = 0;

    function base() { const e = ENVS[envKey]; return alt ? e.restAlt : e.rest; }
    function setEnv(k) {
      envKey = ENVS[k] ? k : 'demo'; alt = false; cache.clear();
      saveSettings({ env: envKey });
      return envKey;
    }
    const getEnv = () => envKey;

    function url(path, params) {
      const u = new URL(base() + path);
      if (params) for (const k in params) {
        if (params[k] === undefined || params[k] === null || params[k] === '') continue;
        u.searchParams.set(k, params[k]);
      }
      return u.toString();
    }

    /** GET with a small in-memory TTL cache. Throws a descriptive Error on failure. */
    async function get(path, params, opts) {
      const ttl = opts && opts.ttl != null ? opts.ttl : 8000;
      if (Date.now() < blockedUntil) throw new Error('Kalshi rate-limit cooldown; next scheduled refresh will retry.');
      const u = url(path, params);
      const hit = cache.get(u);
      if (hit && Date.now() - hit.t < ttl) return hit.data;
      const t0 = performance.now();
      let res;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        res = await fetch(u, { headers: { accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
      } catch (err) {
        clearTimeout(timeout);
        failCount++;
        pushLog(u, 'network/CORS error', null, performance.now() - t0);
        if (!alt) { alt = true; return get(path, params, Object.assign({}, opts, { ttl: 0 })); }
        throw new Error('Network or CORS error reaching ' + new URL(u).host + '. ' + (err && err.message ? err.message : ''));
      }
      clearTimeout(timeout);
      if (!res.ok) {
        failCount++;
        pushLog(u, 'HTTP ' + res.status, null, performance.now() - t0);
        const body = await res.text().catch(() => '');
        if (res.status === 429) {
          const retry = Number(res.headers.get('retry-after'));
          blockedUntil = Date.now() + (Number.isFinite(retry) && retry > 0 ? Math.min(retry, 300) : 60) * 1000;
          throw new Error('Rate limited (HTTP 429); requests paused until the next retry window.');
        }
        if (res.status === 401) throw new Error('HTTP 401 — this endpoint needs signed API-key authentication.');
        throw new Error('HTTP ' + res.status + ' from ' + new URL(u).pathname + (body ? ' — ' + body.slice(0, 160) : ''));
      }
      const data = await res.json();
      okCount++;
      pushLog(u, '200 OK', res.headers.get('access-control-allow-origin'), performance.now() - t0);
      cache.set(u, { t: Date.now(), data });
      if (cache.size > 300) cache.delete(cache.keys().next().value);
      return data;
    }

    function pushLog(u, status, cors, ms) {
      log.unshift({ u, status, cors, ms: Math.round(ms), at: Date.now() });
      if (log.length > 80) log.pop();
    }

    return {
      setEnv, getEnv, url, get,
      stats: () => ({ ok: okCount, fail: failCount, log: log.slice(0, 30), base: base(), alt }),
      exchangeStatus: () => get('/exchange/status'),
      tagsByCategories: () => get('/search/tags_by_categories', null, { ttl: 600000 }),
      series: (f) => get('/series', Object.assign({ include_volume: true }, f), { ttl: 120000 }),
      events: (f) => get('/events', f),
      markets: (tickers) => get('/markets', { tickers: tickers.join(',') }, { ttl: 0 }),
      candlesticks: (seriesTicker, ticker, interval, startTs, endTs) => get(
        `/series/${encodeURIComponent(seriesTicker)}/markets/${encodeURIComponent(ticker)}/candlesticks`,
        { start_ts: startTs, end_ts: endTs, period_interval: interval }, { ttl: 30000 }),
      orderbook: (ticker, depth) => get(`/markets/${encodeURIComponent(ticker)}/orderbook`, depth ? { depth } : null, { ttl: 4000 }),
      trades: (f) => get('/markets/trades', Object.assign({ limit: 50 }, f), { ttl: 8000 })
    };
  })();

  /* ======================= market normalisation ==========================
     Field names accepted by the API (docs.kalshi.com/api-reference/market/get-markets):
       ticker, event_ticker, title, yes_sub_title, status, result,
       yes_bid_dollars, yes_ask_dollars, no_bid_dollars, no_ask_dollars,
       yes_bid_size_fp, yes_ask_size_fp, last_price_dollars, previous_price_dollars,
       volume_fp, volume_24h_fp, open_interest_fp, close_time, expected_expiration_time,
       latest_expiration_time, settlement_ts, settlement_value_dollars, rules_primary,
       price_level_structure, price_ranges, can_close_early, notional_value_dollars
     Status enum: initialized|inactive|active|closed|determined|disputed|amended|finalized
     (only the ones the docs list are mapped; anything else is passed through verbatim).
     ====================================================================== */
  const STATUS_MAP = {
    initialized: 'Not open', inactive: 'Paused', active: 'Trading', closed: 'Closed',
    determined: 'Determined', disputed: 'Disputed', amended: 'Amended', finalized: 'Settled'
  };
  /**
   * A quoted zero is not a price.
   *
   * The API returns fixed-point strings, and an ABSENT resting order is sent as
   * "0.0000" with a size of "0.00" — it is not a bid at zero cents. Measured on
   * the demo host 2026-11-27T19:42Z, GET /markets?status=open&series_ticker=KXBTCMAXY
   * returns yes_bid_dollars "0.0000", yes_bid_size_fp "0.00" on a market that last
   * traded at 0.0700-0.5000, and
   * GET /markets/KXBTCMAXY-26DEC31-109999.99/orderbook returns "yes_dollars": [].
   * docs.kalshi.com/api-reference/market/get-markets
   *
   * Printing "0¢" there invents a $0.10 move off a real quote, so a zero is only
   * kept as a price when the API also reports a non-zero size behind it. Anything
   * else becomes null, and every caller renders that as "—".
   */
  function quotedPrice(price, size) {
    const p = num(price);
    if (p === null) return null;
    if (p <= 0) {
      const q = num(size);
      return (q !== null && q > 0) ? p : null;
    }
    return p;
  }
  function normMarket(m, ctx) {
    const yesBid = quotedPrice(m.yes_bid_dollars, m.yes_bid_size_fp);
    const yesAsk = quotedPrice(m.yes_ask_dollars, m.yes_ask_size_fp);
    const last = quotedPrice(m.last_price_dollars, null);
    const prev = quotedPrice(m.previous_price_dollars, null);
    const mid = (yesBid !== null && yesAsk !== null && yesAsk >= yesBid) ? Math.round((yesBid + yesAsk) / 2 * 10000) / 10000 : null;
    return {
      ticker: m.ticker,
      eventTicker: m.event_ticker || null,
      seriesTicker: ctx && ctx.seriesTicker || (m.ticker ? m.ticker.split('-')[0] : null),
      topic: ctx && ctx.topic || null,
      title: m.title || m.yes_sub_title || m.ticker,
      yesSubTitle: m.yes_sub_title || null,
      status: m.status || null,
      statusLabel: STATUS_MAP[m.status] || (m.status || '—'),
      result: (m.result === 'yes' || m.result === 'no') ? m.result : (m.result || ''),
      marketType: m.market_type || null,
      observedAt: ctx && ctx.observedAt != null ? ctx.observedAt : null,
      fallback: !!(ctx && ctx.fallback),
      sourceUrl: ctx && ctx.sourceUrl || api.url(`/markets/${encodeURIComponent(m.ticker)}`),
      yesBid, yesAsk, noBid: num(m.no_bid_dollars), noAsk: num(m.no_ask_dollars),
      yesBidSize: num(m.yes_bid_size_fp), yesAskSize: num(m.yes_ask_size_fp),
      last, prev, mid,
      /* price used for swings/charts: last trade if present, else bid/ask mid. Tagged with which. */
      price: last !== null ? last : mid,
      priceKind: last !== null ? 'last' : (mid !== null ? 'mid' : null),
      /* The spread is only knowable when BOTH sides are quoted; an absent side is
         not a 100¢ book. Null -> the UI prints "—" (see quotedPrice above). */
      spread: (yesBid !== null && yesAsk !== null) ? Math.round((yesAsk - yesBid) * 10000) / 10000 : null,
      volume: num(m.volume_fp),
      volume24h: num(m.volume_24h_fp),
      oi: num(m.open_interest_fp),
      notional: num(m.notional_value_dollars),
      closeTime: m.close_time || null,
      expirationTime: m.expected_expiration_time || m.latest_expiration_time || null,
      latestExpiration: m.latest_expiration_time || null,
      settlementTs: m.settlement_ts || null,
      settlementValue: num(m.settlement_value_dollars),
      rules: m.rules_primary || '',
      rulesSecondary: m.rules_secondary || '',
      priceStructure: m.price_level_structure || null,
      canCloseEarly: !!m.can_close_early,
      raw: m
    };
  }

  /** Is the market still live (trading or awaiting determination)? */
  function isLive(m) {
    return m.status === 'active';
  }
  function isClosed(m) {
    return m.status === 'closed' || m.status === 'determined' || m.status === 'disputed' || m.status === 'amended';
  }
  function isSettled(m) { return m.status === 'finalized'; }

  /* ======================= freshness / staleness ========================= */
  const startedAt = Date.now();
  function freshness(snapshotTs, isFallback) {
    const ts = snapshotTs || startedAt;
    if (isFallback) {
      return { level: 'warn', label: 'SNAPSHOT', text: 'recorded ' + (ts ? new Date(ts).toLocaleString() : 'unknown') + ' — not live' };
    }
    const ageMs = Date.now() - ts;
    if (ageMs < 120000) return { level: 'live', label: 'LIVE', text: 'fetched ' + relTime(ts) };
    if (ageMs < 3600000) return { level: 'snap', label: 'RECENT', text: 'fetched ' + relTime(ts) };
    return { level: 'warn', label: 'STALE', text: 'fetched ' + relTime(ts) };
  }

  /* ======================= navigation / page shell ======================= */
  const NAV = [
    { href: 'index.html', label: 'Dashboard' },
    { href: 'topics/gas.html', label: 'Gas' },
    { href: 'topics/elections.html', label: 'Elections' },
    { href: 'topics/culture.html', label: 'Culture' },
    { href: 'topics/crypto.html', label: 'Crypto' },
    { href: 'topics/golf.html', label: 'Golf' },
    { href: 'alerts.html', label: 'Alerts' },
    { href: 'liquidity.html', label: 'Charts & liquidity' },
    { href: 'portfolio.html', label: 'Portfolio & strategies' },
    { href: 'resolutions.html', label: 'Resolutions' },
    { href: 'executive-summary.html', label: 'Summary' },
    { href: 'verification.html', label: 'Sources' },
    { href: 'flagged.html', label: 'Flagged' }
  ];
  function renderHeader(activeHref) {
    const host = qs('#site-head');
    if (!host) return;
    const links = NAV.map(n =>
      `<a href="${pageUrl(n.href)}"${n.href === activeHref ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
    host.className = 'site-head';
    host.innerHTML = `<div class="bar">
      <a class="brand" href="${pageUrl('index.html')}">
        <span class="mark">TB</span>
        <span>Tradebot2<span class="sub" style="display:block">Kalshi demo · live</span></span>
      </a>
      <nav class="main" aria-label="Main">${links}</nav>
      <div class="head-tools">
        <span class="pill snap" id="hdr-env" title="API environment">DEMO</span>
        <label class="sr-only" for="hdr-envs">Environment</label>
        <select id="hdr-envs" title="Choose the API environment">
          <option value="demo">Demo (mock funds)</option>
          <option value="prod">Production (read-only)</option>
        </select>
      </div>
    </div>`;
    const sel = qs('#hdr-envs');
    sel.value = api.getEnv();
    const pill = qs('#hdr-env');
    pill.textContent = api.getEnv() === 'prod' ? 'PROD · read-only' : 'DEMO';
    pill.className = 'pill ' + (api.getEnv() === 'prod' ? 'warn' : 'snap');
    sel.addEventListener('change', () => {
      api.setEnv(sel.value);
      location.reload();
    });
  }
  function renderFooter() {
    const host = qs('#site-foot');
    if (!host) return;
    host.className = 'foot';
    host.innerHTML = `<div class="in">
      <div>Tradebot2 · data © Kalshi via the official Trade API · simulated trades only · not investment advice</div>
      <div><a href="${pageUrl('verification.html')}">Sources &amp; verification</a> · <a href="${pageUrl('flagged.html')}">Flagged for review</a> · <a href="https://docs.kalshi.com/">docs.kalshi.com</a></div>
    </div>`;
  }
  function pageShell(activeHref) {
    renderHeader(activeHref);
    renderFooter();
    document.addEventListener('DOMContentLoaded', () => { /* head runs after DOM ready in our pages */ });
  }

  /* ======================= misc UI ====================================== */
  function setStatusPill(node, level, text) {
    if (!node) return;
    node.className = 'pill ' + level;
    node.innerHTML = (level === 'live' ? '<span class="dot"></span>' : '') + esc(text);
  }
  function noDataRow(tbody, cols, message) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="t-blank">${esc(message)}</td></tr>`;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('clipboard unavailable'));
  }

  /* ======================= exported surface ============================== */
  return {
    ENVS, TOPICS, topicById, ALERT_THRESHOLD, DEFAULTS, LS,
    num, cents, dollar, centsLabel, compact, pct, timeShort, dateShort, relTime, esc, el, qs, qsa,
    store, settings, saveSettings,
    api, normMarket, quotedPrice, STATUS_MAP, isLive, isClosed, isSettled,
    freshness, NAV, renderHeader, renderFooter, pageShell, setStatusPill, noDataRow, copyText,
    startedAt, pageUrl
  };
})();
