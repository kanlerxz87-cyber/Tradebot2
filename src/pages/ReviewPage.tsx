import { AlertTriangle, CheckCircle2, Flag, ShieldAlert } from 'lucide-react';
import { SourceLink } from '../components/SourceLink';
import { REVIEW_FLAGS } from '../data/sources';

export function ReviewPage() {
  return (
    <div className="page-stack prose-page">
      <section className="review-hero">
        <div className="review-hero__icon"><ShieldAlert size={32} /></div>
        <div><span className="eyebrow-chip"><Flag size={12} /> TRANSPARENT EXCEPTIONS</span><h2>Flagged for review</h2><p>Unverified values do not block publication—but they do not enter the dashboard. These open constraints explain every deliberate blank or reduced capability.</p></div>
        <div className="review-hero__count"><strong>{REVIEW_FLAGS.length}</strong><small>open disclosures</small></div>
      </section>

      <section className="review-summary">
        <div><CheckCircle2 size={17} /><span><strong>0</strong> fabricated values</span></div>
        <div><AlertTriangle size={17} /><span><strong>{REVIEW_FLAGS.filter((flag) => flag.severity === 'constraint').length}</strong> product constraints</span></div>
        <div><Flag size={17} /><span><strong>{REVIEW_FLAGS.filter((flag) => flag.severity === 'needs review').length}</strong> environment check</span></div>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">OPEN REGISTER</span><h2>Irregularities &amp; boundaries</h2><p>Each row includes the official documentation used to establish the boundary.</p></div></header>
        <div className="table-wrap"><table className="market-table review-table"><thead><tr><th>ID / severity</th><th>Item</th><th>Verified detail</th><th>Product impact</th><th>Status</th><th>Source</th></tr></thead><tbody>{REVIEW_FLAGS.map((flag) => (
          <tr key={flag.id}>
            <td><code>{flag.id}</code><span className={`severity severity--${flag.severity.replace(' ', '-')}`}>{flag.severity}</span></td>
            <td><strong>{flag.title}</strong></td><td>{flag.detail}</td><td>{flag.impact}</td>
            <td><span className="status-badge status-badge--open">{flag.status}</span></td>
            <td><SourceLink href={flag.sourceUrl} label="Official" /></td>
          </tr>
        ))}</tbody></table></div>
      </section>

      <section className="review-note">
        <AlertTriangle size={20} />
        <div><strong>Review principle</strong><p>A flag is not silently “resolved” by guessing. Close it only after a secure capability exists or an official source directly confirms the missing value.</p></div>
        <SourceLink href="https://docs.kalshi.com/getting_started/quick_start_market_data" label="Official data guide" />
      </section>
    </div>
  );
}
