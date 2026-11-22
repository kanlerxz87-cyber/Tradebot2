import { Activity, ArrowRight, Bot, Gauge, ShieldCheck, Sparkles, TimerReset } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { SourceLink } from '../components/SourceLink';
import { MODEL_SCORE_THRESHOLD, SWING_THRESHOLD } from '../lib/analytics';
import { formatMoney, formatPercent } from '../lib/format';
import type { PaperPortfolio } from '../types/kalshi';

interface StrategiesPageProps {
  portfolio: PaperPortfolio;
}

const scoreRows = [
  { check: 'Observed net swing', test: 'Absolute price change ≥ $0.10', points: 30, field: 'last_price_dollars' },
  { check: 'Tight displayed spread', test: 'YES ask − YES bid ≤ $0.05', points: 25, field: 'yes_bid_dollars / yes_ask_dollars' },
  { check: 'Recent activity', test: '24-hour volume ≥ 100 contracts', points: 20, field: 'volume_24h_fp' },
  { check: 'Displayed depth', test: 'Max YES bid/ask size ≥ 10 contracts', points: 15, field: 'yes_bid_size_fp / yes_ask_size_fp' },
  { check: 'Away from endpoints', test: 'Last YES price from $0.15 through $0.85', points: 10, field: 'last_price_dollars' },
];

export function StrategiesPage({ portfolio }: StrategiesPageProps) {
  const strategyTrades = portfolio.trades.filter((trade) => trade.strategy === 'swing-momentum-v1');
  const closed = strategyTrades.filter((trade) => trade.status === 'closed');
  const pnl = strategyTrades.reduce((sum, trade) => sum + (trade.realizedPnl ?? trade.unrealizedPnl), 0);
  const wins = closed.filter((trade) => (trade.realizedPnl ?? 0) > 0).length;
  const winRate = closed.length ? wins / closed.length : null;

  return (
    <div className="page-stack">
      <section className="strategy-hero">
        <div>
          <span className="eyebrow-chip"><Bot size={12} /> AUDITABLE AUTOMATION</span>
          <h2>Simple rules.<br /><em>No black box.</em></h2>
          <p>The “model likes” feed is a deterministic market-quality filter—not an ROI forecast. Every check, threshold, assumed fill, and exit is visible below.</p>
        </div>
        <div className="strategy-hero__score">
          <small>SELECTIVITY GATE</small>
          <strong>{MODEL_SCORE_THRESHOLD}<span>/100</span></strong>
          <p>minimum score after a {Math.round(SWING_THRESHOLD * 100)}¢ move</p>
          <div className="score-ring"><Sparkles size={22} /></div>
        </div>
      </section>

      <section className="pipeline" aria-label="Automated paper strategy pipeline">
        <div><span><Activity size={18} /></span><strong>Observe</strong><small>10s REST snapshots</small></div><ArrowRight />
        <div><span><Gauge size={18} /></span><strong>Score</strong><small>5 transparent checks</small></div><ArrowRight />
        <div><span><ShieldCheck size={18} /></span><strong>Guard</strong><small>ask &amp; cash required</small></div><ArrowRight />
        <div><span><Bot size={18} /></span><strong>Paper trade</strong><small>1 contract only</small></div><ArrowRight />
        <div><span><TimerReset size={18} /></span><strong>Exit</strong><small>target, stop, time, result</small></div>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">MODEL CARD · V1</span><h2>Selectivity score</h2><p>Passing this filter does not establish expected return, probability accuracy, or suitability.</p></div><SourceLink href="https://docs.kalshi.com/api-reference/market/get-markets" label="Input schema" /></header>
        <div className="table-wrap">
          <table className="market-table score-table">
            <thead><tr><th>Check</th><th>Exact test</th><th>Points</th><th>Official input field</th><th>Source</th></tr></thead>
            <tbody>{scoreRows.map((row) => (
              <tr key={row.check}><td><strong>{row.check}</strong></td><td>{row.test}</td><td><span className="points-chip">+{row.points}</span></td><td><code>{row.field}</code></td><td><SourceLink href="https://docs.kalshi.com/api-reference/market/get-markets" label="Schema" /></td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="strategy-grid">
        <article className="strategy-card strategy-card--active">
          <header><div><span>ACTIVE PAPER STRATEGY</span><h3>Swing momentum v1</h3></div><i>ON</i></header>
          <p>Follow the observed direction only when the selectivity score reaches 65 and the corresponding displayed ask is present.</p>
          <dl>
            <div><dt>Position</dt><dd>1 paper contract</dd></div>
            <div><dt>Take profit</dt><dd>+10¢ / contract</dd></div>
            <div><dt>Stop loss</dt><dd>−8¢ / contract</dd></div>
            <div><dt>Time limit</dt><dd>6 hours</dd></div>
            <div><dt>Fees</dt><dd>Excluded</dd></div>
            <div><dt>Persistence</dt><dd>This browser</dd></div>
          </dl>
        </article>
        <article className="strategy-card">
          <header><div><span>OBSERVED RESULTS</span><h3>Live session scorecard</h3></div></header>
          {strategyTrades.length === 0 ? (
            <EmptyState compact icon={Bot} title="No qualifying entry yet" detail="Blank is accurate: the monitor has not produced a selected alert with a usable ask." />
          ) : (
            <div className="strategy-results">
              <div><small>Trades</small><strong>{strategyTrades.length}</strong></div>
              <div><small>Closed</small><strong>{closed.length}</strong></div>
              <div><small>P&amp;L</small><strong className={pnl >= 0 ? 'positive' : 'negative'}>{formatMoney(pnl)}</strong></div>
              <div><small>Win rate</small><strong>{winRate === null ? '—' : formatPercent(winRate).replace('+', '')}</strong></div>
            </div>
          )}
          <SourceLink href="https://docs.kalshi.com/getting_started/quick_start_create_order" label="Compare live order lifecycle" />
        </article>
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">INTERACTIVITY ROADMAP</span><h2>Safe ways to make the desk more live</h2><p>Recommendations are separated from implemented features so planned work is never mistaken for current capability.</p></div></header>
        <div className="roadmap-list">
          <article><span>01</span><div><strong>Secret-bearing relay for WebSockets</strong><p>Add a small authenticated backend that signs the handshake, normalizes ticker and order-book messages, and streams sanitized data to the browser.</p></div><em>Recommended</em><SourceLink href="https://docs.kalshi.com/getting_started/quick_start_websockets" label="Official guide" /></article>
          <article><span>02</span><div><strong>Server-side demo execution adapter</strong><p>Keep signing keys in a secret manager, enforce allowlisted demo hosts and order limits, and persist idempotent client order IDs.</p></div><em>Blocked: credentials</em><SourceLink href="https://docs.kalshi.com/getting_started/quick_start_create_order" label="Official guide" /></article>
          <article><span>03</span><div><strong>Verified catalyst review queue</strong><p>Capture timestamped candidate links but publish no causal label until a human verifies provenance and relevance.</p></div><em>Needs review</em><SourceLink href="https://docs.kalshi.com/api-reference/events/get-events" label="Settlement-source fields" /></article>
          <article><span>04</span><div><strong>Durable research database</strong><p>Store snapshots, alerts, fills, and resolved outcomes outside local storage, with API source URL and collection time on every record.</p></div><em>Recommended</em><SourceLink href="https://docs.kalshi.com/getting_started/historical_data" label="Historical boundaries" /></article>
        </div>
      </section>
    </div>
  );
}
