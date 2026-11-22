import { BookOpenCheck, Calculator, CheckCircle2, Database, Tags } from 'lucide-react';
import { SourceLink } from '../components/SourceLink';
import { OFFICIAL_SOURCES } from '../data/sources';
import { TOPICS } from '../data/topics';

const calculations = [
  { name: '24h contract notional', formula: 'volume_24h_fp × notional_value_dollars', boundary: 'Ranking measure; not cash traded or liquidity.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { name: 'Observed price move', formula: 'current last_price_dollars − prior observed last_price_dollars', boundary: 'Net movement between successful polls only.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { name: 'Displayed YES spread', formula: 'yes_ask_dollars − yes_bid_dollars', boundary: 'Blank if either official input is absent.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { name: 'Paper NO mark', formula: '1 − official last YES price', boundary: 'Binary-contract arithmetic; not a fill quote.', source: 'https://docs.kalshi.com/api-reference/market/get-markets' },
  { name: 'Paper P&L', formula: '(mark or exit − paper entry) × quantity', boundary: 'Fees, queue, partial fills, and added slippage excluded.', source: 'https://docs.kalshi.com/getting_started/quick_start_create_order' },
];

export function SourcesPage() {
  return (
    <div className="page-stack prose-page">
      <section className="source-hero">
        <div><span className="eyebrow-chip"><BookOpenCheck size={12} /> SOURCE REGISTER</span><h2>Trace the field,<br /><em>not the claim.</em></h2></div>
        <div className="source-hero__policy"><CheckCircle2 size={22} /><div><strong>Official-source-only policy</strong><p>Live table rows link to Kalshi’s demo API record. Product claims link to Kalshi’s official documentation. Missing data stays blank.</p></div></div>
      </section>

      <section className="method-cards">
        <article><Database size={18} /><strong>Direct</strong><p>A value returned by the official API, displayed without substitution.</p></article>
        <article><Calculator size={18} /><strong>Calculated</strong><p>Arithmetic over named direct fields, visibly labeled “calc.”</p></article>
        <article><Tags size={18} /><strong>Classified</strong><p>A local, disclosed keyword rule—not an official Kalshi topic assignment.</p></article>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">CLAIM REGISTER</span><h2>Official verification sources</h2><p>Manually reviewed against official Kalshi documentation on 2026-11-22 UTC.</p></div><span className="verified-chip"><CheckCircle2 size={13} /> {OFFICIAL_SOURCES.length} reviewed</span></header>
        <div className="table-wrap"><table className="market-table source-table"><thead><tr><th>Area</th><th>Verified claim</th><th>Implementation note</th><th>Checked</th><th>Official source</th></tr></thead><tbody>{OFFICIAL_SOURCES.map((source) => (
          <tr key={source.id}><td><span className="mono-label">{source.area}</span></td><td><strong>{source.verifiedClaim}</strong></td><td>{source.note}</td><td>{source.verifiedAt}</td><td><SourceLink href={source.officialUrl} label="Review" /></td></tr>
        ))}</tbody></table></div>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">DERIVED VALUES</span><h2>Calculation register</h2><p>These are analyses, not fields asserted to come directly from Kalshi.</p></div><Calculator size={20} /></header>
        <div className="table-wrap"><table className="market-table"><thead><tr><th>Displayed value</th><th>Exact formula</th><th>Boundary</th><th>Official input source</th></tr></thead><tbody>{calculations.map((row) => (
          <tr key={row.name}><td><strong>{row.name}</strong></td><td><code>{row.formula}</code></td><td>{row.boundary}</td><td><SourceLink href={row.source} label="Fields" /></td></tr>
        ))}</tbody></table></div>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">LOCAL TOPIC RULES</span><h2>Five inclusion lanes</h2><p>Rules run over official event title, subtitle, market title, YES subtitle, and category fields. Broad lanes such as Sports still require title evidence.</p></div><SourceLink href="https://docs.kalshi.com/api-reference/events/get-events" label="Event fields" /></header>
        <div className="table-wrap"><table className="market-table"><thead><tr><th>Dashboard topic</th><th>Included title concepts</th><th>Official category aid</th><th>Source</th></tr></thead><tbody>{TOPICS.map((topic) => (
          <tr key={topic.id}><td><span className="topic-pill" style={{ '--topic-color': topic.accent } as React.CSSProperties}>{topic.label}</span></td><td><code>{topic.titleTerms.source.replaceAll('\\b', '')}</code></td><td>{topic.categoryTerms.join(', ') || '—'}</td><td><SourceLink href="https://docs.kalshi.com/api-reference/events/get-events" label="Schema" /></td></tr>
        ))}</tbody></table></div>
      </section>

      <section className="verification-protocol">
        <div><span>01</span><strong>Acquire</strong><p>Request only the recommended demo REST host with no credential material.</p></div>
        <div><span>02</span><strong>Validate</strong><p>Require event/market identity fields and reject malformed response shapes.</p></div>
        <div><span>03</span><strong>Preserve</strong><p>Retain exact source URLs and timestamps alongside observations.</p></div>
        <div><span>04</span><strong>Disclose</strong><p>Label calculations, local classification, assumptions, and constraints in place.</p></div>
      </section>
    </div>
  );
}
