> **Parallel integration note:** This standalone module lives exclusively in `observatory/`; run commands from that directory (or use `npm --prefix observatory ...`). The `/observatory/` public URL is a requested integration path, not a confirmed deployment. Shared root Pages/navigation are owned by the final integration session. `workflow-examples/` are inactive references, not installed competing workflows. Current main's other dashboards have not been independently certified by this module's tests.

# Tradebot2 · Kalshi demo observatory

A responsive, source-linked market dashboard for **gas prices, elections, culture, crypto and golf**. Includes grouped event tables, price charts, two scrolling ≥10¢ swing feeds, order-book depth, automated paper strategies, source register and Flagged for Review page.

**Site:** https://kanlerxz87-cyber.github.io/Tradebot2/observatory/
**Executive brief:** [docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md)
**Coordination / audit trail:** [COORDINATION.md](COORDINATION.md)

## Run

Node 22+; runtime has no external dependencies.

```sh
npm ci
npm test
npm run verify
npm run build
npm run dev                  # 0.0.0.0:4173
npm run collect              # needs outbound access to official Kalshi demo API
```

UI tests: `npx playwright install --with-deps chromium && npx playwright test`. The browser tests use labeled fixtures for deterministic behavior; fixtures are not published as market data.

## Data, limits and honesty

- Market data originates only from the recommended [official demo REST API](https://docs.kalshi.com/getting_started/demo_env). Topic membership uses exact official series metadata. Missing values stay blank.
- Event ranking is **derived face-value open interest**, not dollar turnover. Contract volume is never mislabeled dollars.
- Browser attempts 10-second polling for the top 100 active tracked contracts plus selected/open-paper contracts when visible; the universe refreshes each minute. CORS/network failures are surfaced as snapshot mode. Server snapshots use GitHub Actions on a requested five-minute schedule; this is not continuous data.
- Alerts compare last-price observations within 120 seconds, ≥$0.10 either way. Unobserved intrapoll movements cannot be recovered.
- Candidate feed is a **liquidity screen**, not a high-ROI model. Expected ROI and unverified news causes are blank.
- Paper Momentum/Reversion strategies are YES-only and transparent. Entry at the reported ask is an assumption, not an exchange fill. Fees are unknown; P&L is gross. Official settled status, result and settlement value are required for exit.
- Browser paper records are local and separate from the scheduled collector paper records. Clear browser storage to lose/reset the local experiment. No account balance, fee or account return is invented.
- Scheduled snapshots retain up to 2,000 observations per contract and 1,000 alerts in an Actions cache. Cache eviction may lose history. Use a durable database for audited trading.
- Public Pages contains no credentials or authenticated account data. No actual orders were executed during implementation.

## Private demo integration (not enabled / not end-to-end verified)

`scripts/demo-account.mjs` is **not** copied into the Pages build. It supports Ed25519 and RSA-PSS signing, read-only balance/fill/position/settlement snapshots, and an explicitly gated demo-only YES order method. The API host is hardcoded to the official demo host. Do not put any keys in browser code, public files, chat, or Git.

A private-host operator may configure `KALSHI_DEMO_KEY_ID` and `KALSHI_DEMO_PRIVATE_KEY_FILE` securely outside Git. Running `node scripts/demo-account.mjs` only reads the account and writes `private/demo-account.json` (ignored, mode 0600). There is no request for credentials from this dashboard, and no public account endpoint.

The `placeYes` method additionally requires `KALSHI_DEMO_EXECUTION=enabled`, a fresh (≤15s) official topic observation, the liquidity screen, ≤10 contracts / ≤$10, and writes an exclusive durable submission lock before a single immediate-or-cancel V2 order. It does **not** auto-retry ambiguous writes. The lock requires private reconciliation before any further submission. This deliberately conservative scaffold is not an unattended execution service. Actual account fills, fees, historical data and cash flows must be reconciled before calculating net performance.

Official references: [authentication](https://docs.kalshi.com/getting_started/api_keys), [V2 orders](https://docs.kalshi.com/api-reference/orders/create-order-v2), [fills](https://docs.kalshi.com/api-reference/portfolio/get-fills), [settlement](https://docs.kalshi.com/getting_started/market_settlement).

## Deployment

`workflow-examples/pages.yml` tests the app, restores bounded public observation history, attempts official collection, builds static files and deploys with the Pages Actions API. It runs on main updates, dispatch and schedule, serializing deployments. A collection failure never manufactures a replacement price: last data and an explicit partial/error status remain visible.

`workflow-examples/check.yml` runs unit/build/schema verification and a separately labeled official API collection attempt, uploading its snapshot for manual audit. No account credentials are used by either workflow.

See [the executive summary](docs/EXECUTIVE_SUMMARY.md) and [Flagged for Review](https://kanlerxz87-cyber.github.io/Tradebot2/observatory/#/review) for what remains unverified. This is independent research software, not an official Kalshi product or investment advice.

Scheduled collection also requests a second real observation after 10 seconds for its top 100 active tracked contracts plus open scheduled-paper positions. This creates short sampling windows for the scheduled experiments; it does not eliminate the gaps between scheduled runs. Both the scheduled and browser paper ledgers are selectable on the portfolio page.

Payload architecture: the built landing page loads only the ten highest face-value events per topic (with all their collected contracts). Topic navigation automatically loads the complete collected topic shard; topic cards show snapshot-wide observed event counts. Repeated rule and settlement-source prose is omitted from bulk records; direct official market/series links remain. Scheduled history is retained for the top 100 overall and top 20 per topic plus open paper and recent-alert contracts, up to 2,000 observations each. Other contracts have current snapshots and begin browser history when observed. Browser polling ranks its loaded subset, not the entire unseen universe.

The current integration pipeline copies repository static files into its artifact, so the source module also includes five small topic-shard files partitioning the same 15 official seed records. This supports raw static hosting without running this module's Node build. These are explicitly partial, timestamped seed observations, not a fresh full-universe collection. The optional scheduled full-universe collector integration remains a final-owner request; direct browser polling reports its own success/failure. No active shared workflow was changed to publish this module.

Safety after relocation: the collector’s default data file and all authenticated private-account files are anchored to this module’s directory, not the invoking shell’s current directory. Private outputs remain under ignored `observatory/private/` even if invoked from the repository root. The module build excludes server scripts/private files; raw-source publication may expose script source, never private credentials or ignored account outputs.
