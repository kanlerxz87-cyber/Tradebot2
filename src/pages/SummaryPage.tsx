import { CheckCircle2, LockKeyhole, Radio, ShieldCheck, TriangleAlert } from 'lucide-react';
import { SourceLink } from '../components/SourceLink';

const endpoints = [
  { surface: 'REST Trade API', role: 'Recommended demo host', url: 'https://external-api.demo.kalshi.co/trade-api/v2', used: 'Yes — public market data' },
  { surface: 'REST Trade API', role: 'Supported shared host', url: 'https://demo-api.kalshi.co/trade-api/v2', used: 'No — documented fallback only' },
  { surface: 'WebSocket API', role: 'Recommended demo host', url: 'wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2', used: 'No — authenticated relay required' },
  { surface: 'WebSocket API', role: 'Supported shared host', url: 'wss://demo-api.kalshi.co/trade-api/ws/v2', used: 'No — authenticated relay required' },
];

const coverage = [
  { requirement: 'Highest-amount live events in five requested topics', status: 'Implemented', detail: 'Open events are locally classified and ranked by calculated 24h contract notional.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { requirement: 'Price-swing alerts at ≥ $0.10 either direction', status: 'Implemented', detail: 'Exact threshold over consecutive successful REST observations.', source: 'https://docs.kalshi.com/getting_started/quick_start_market_data' },
  { requirement: 'All-events and selective scrolling feeds', status: 'Implemented', detail: 'All changed prices vs. score-gated ≥10¢ shortlist.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { requirement: 'Track YES / NO resolution', status: 'Implemented in-session', detail: 'Observed contracts remain tracked and display official result when reported.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { requirement: 'Automated simulated trades', status: 'Implemented', detail: 'One-contract local paper strategy, automatic entry, mark, and exit.', source: 'https://docs.kalshi.com/getting_started/quick_start_create_order' },
  { requirement: 'Demo-account portfolio and trade execution', status: 'Blocked safely', detail: 'Authenticated fields remain blank because no signing credentials or secure backend exist.', source: 'https://docs.kalshi.com/getting_started/quick_start_authenticated_requests' },
  { requirement: 'Interactive price graph by seconds/minutes/hours', status: 'Implemented', detail: '60-second, 15-minute, and 1-hour local observation windows.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { requirement: 'Liquidity at price levels', status: 'Implemented', detail: 'Official YES/NO bid price and contract quantity; no order count is claimed.', source: 'https://docs.kalshi.com/api-reference/market/get-market-orderbook' },
  { requirement: 'Links that caused sharp jumps', status: 'Not inferred', detail: 'Alerts say “cause unverified”; no correlation is mislabeled as causality.', source: 'https://docs.kalshi.com/api-reference/events/get-events' },
  { requirement: 'Category subpages and source-linked tables', status: 'Implemented', detail: 'Five topic desks plus portfolio, strategy, summary, source, and review pages.', source: 'https://docs.kalshi.com/api-reference/events/get-events' },
];

export function SummaryPage() {
  return (
    <div className="page-stack prose-page">
      <section className="summary-hero">
        <div><span className="eyebrow-chip"><ShieldCheck size={12} /> EXECUTIVE BRIEF · VERIFIED 2026-11-22</span><h2>A live-first demo desk with<br /><em>hard truth boundaries.</em></h2></div>
        <p>Signal Desk organizes five Kalshi topic lanes, polls official demo market data, detects net price swings, exposes depth and source records, and runs an autonomous browser-local paper strategy. It never fabricates missing values and never places authenticated orders without secure credentials.</p>
      </section>

      <section className="executive-grid">
        <article><span><Radio size={17} /></span><strong>What is live</strong><p>Public demo events, market fields, status, result, prices, volume, top-of-book size, and bid depth are requested automatically.</p><SourceLink href="https://docs.kalshi.com/getting_started/quick_start_market_data" label="Official guide" /></article>
        <article><span><CheckCircle2 size={17} /></span><strong>What is calculated</strong><p>Price differences, contract notional, selectivity score, and paper P&amp;L are labeled calculations over sourced inputs.</p><SourceLink href="https://docs.kalshi.com/api-reference/market/get-markets" label="Input schema" /></article>
        <article><span><LockKeyhole size={17} /></span><strong>What stays blank</strong><p>Demo-account balance, positions, fills, and orders are blank until a private-key signing service is deployed.</p><SourceLink href="https://docs.kalshi.com/getting_started/quick_start_authenticated_requests" label="Auth guide" /></article>
        <article><span><TriangleAlert size={17} /></span><strong>What is not claimed</strong><p>No ROI guarantee, causal news attribution, complete archive, WebSocket stream, fill realism, or investment recommendation.</p><SourceLink href="https://docs.kalshi.com/getting_started/historical_data" label="History guide" /></article>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">OFFICIAL DEMO SURFACES</span><h2>Endpoints</h2><p>The recommended dedicated hosts are selected; supported shared hosts are documented but not mixed into live data.</p></div><SourceLink href="https://docs.kalshi.com/getting_started/api_environments" label="Environment reference" /></header>
        <div className="table-wrap"><table className="market-table"><thead><tr><th>Surface</th><th>Role</th><th>Official endpoint</th><th>This release</th><th>Source</th></tr></thead><tbody>{endpoints.map((endpoint) => (
          <tr key={endpoint.url}><td><strong>{endpoint.surface}</strong></td><td>{endpoint.role}</td><td><code>{endpoint.url}</code></td><td>{endpoint.used}</td><td><SourceLink href="https://docs.kalshi.com/getting_started/api_environments" label="Official" /></td></tr>
        ))}</tbody></table></div>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">REQUIREMENT TRACEABILITY</span><h2>Delivered vs. constrained</h2><p>“Blocked safely” is intentional: the static site refuses to expose or invent authenticated behavior.</p></div></header>
        <div className="table-wrap"><table className="market-table coverage-table"><thead><tr><th>Requirement</th><th>Status</th><th>Implementation detail</th><th>Source</th></tr></thead><tbody>{coverage.map((row) => (
          <tr key={row.requirement}><td><strong>{row.requirement}</strong></td><td><span className={`coverage-status coverage-status--${row.status.toLowerCase().replaceAll(' ', '-')}`}>{row.status}</span></td><td>{row.detail}</td><td><SourceLink href={row.source} label="Official" /></td></tr>
        ))}</tbody></table></div>
      </section>

      <section className="brief-columns">
        <article className="content-card"><span className="panel-kicker">OPERATING LOOP</span><h2>How the desk works</h2><ol><li>Discover open demo events with nested markets every 60 seconds.</li><li>Apply five auditable topic keyword rules.</li><li>Poll tracked contracts every 10 seconds and retain them through observed resolution.</li><li>Compare official last-price observations and alert on any change; elevate net moves at least $0.10.</li><li>Fetch the selected contract’s official order-book bids every 15 seconds.</li><li>Paper trade only selected alerts with a usable displayed ask.</li></ol></article>
        <article className="content-card"><span className="panel-kicker">DECISION NOTES</span><h2>Important interpretation</h2><ul><li><strong>“Live” means polling:</strong> transient intrapoll moves can be missed.</li><li><strong>Notional is calculated:</strong> volume × contract notional is not traded cash.</li><li><strong>Depth is bids:</strong> the endpoint does not provide order counts.</li><li><strong>Topic is local:</strong> Kalshi’s category remains visible separately.</li><li><strong>Paper is not demo execution:</strong> assumptions omit fees and queue behavior.</li><li><strong>Blank means unverified:</strong> the interface never fills an absent field.</li></ul></article>
      </section>
    </div>
  );
}
