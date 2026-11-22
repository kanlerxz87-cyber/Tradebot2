import { CircleDollarSign, LockKeyhole, Scale, Trophy, WalletCards } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { EquityChart } from '../components/EquityChart';
import { MetricCard } from '../components/MetricCard';
import { SourceLink } from '../components/SourceLink';
import { TOPIC_BY_ID } from '../data/topics';
import { formatDateTime, formatMoney, formatPercent, formatPrice } from '../lib/format';
import type { PaperPortfolio, PaperTrade, TopicId } from '../types/kalshi';

interface PortfolioMetrics {
  equity: number;
  realizedPnl: number;
  winRate: number | null;
  openTrades: number;
  closedTrades: number;
}

interface PortfolioPageProps {
  portfolio: PaperPortfolio;
  metrics: PortfolioMetrics;
}

function TradeTable({ trades }: { trades: PaperTrade[] }) {
  if (trades.length === 0) {
    return <EmptyState icon={WalletCards} title="No automated paper trades yet" detail="The simulator waits for a sourced ≥10¢ swing that also scores at least 65. No placeholder trades are inserted." />;
  }

  return (
    <div className="table-wrap">
      <table className="market-table trade-table">
        <thead><tr><th>Opened / event</th><th>Topic</th><th>Strategy</th><th>Side</th><th>Entry</th><th>Mark / exit</th><th>P&amp;L</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id}>
              <td className="market-name-cell"><strong>{trade.eventTitle}</strong><small>{formatDateTime(trade.openedAt)} · {trade.ticker}</small></td>
              <td><span className="topic-pill" style={{ '--topic-color': TOPIC_BY_ID[trade.topic].accent } as React.CSSProperties}>{TOPIC_BY_ID[trade.topic].shortLabel}</span></td>
              <td><span className="mono-label">swing-momentum-v1</span></td>
              <td><span className={`side-label side-label--${trade.side}`}>BUY {trade.side.toUpperCase()}</span><small className="cell-note">{trade.quantity} paper contract</small></td>
              <td>{formatPrice(trade.entryPrice)}</td>
              <td>{formatPrice(trade.exitPrice ?? trade.markPrice)}</td>
              <td><strong className={(trade.realizedPnl ?? trade.unrealizedPnl) >= 0 ? 'positive' : 'negative'}>{formatMoney(trade.realizedPnl ?? trade.unrealizedPnl)}</strong><small className="cell-note">{trade.status === 'closed' ? 'realized' : 'unrealized'}</small></td>
              <td><span className={`status-badge status-badge--${trade.status}`}>{trade.status}</span>{trade.exitReason && <small className="cell-note">{trade.exitReason}</small>}</td>
              <td><SourceLink href={trade.sourceUrl} label="Market" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopicPerformance({ trades }: { trades: PaperTrade[] }) {
  const rows = (Object.keys(TOPIC_BY_ID) as TopicId[]).map((topic) => {
    const matching = trades.filter((trade) => trade.topic === topic);
    const closed = matching.filter((trade) => trade.status === 'closed');
    const pnl = matching.reduce((sum, trade) => sum + (trade.realizedPnl ?? trade.unrealizedPnl), 0);
    return { topic, matching, closed, pnl, source: matching[0]?.sourceUrl };
  }).filter((row) => row.matching.length > 0);

  if (rows.length === 0) return <EmptyState compact icon={Scale} title="No category results yet" detail="Category analytics populate from sourced paper trades only." />;

  return (
    <div className="table-wrap">
      <table className="market-table compact-table">
        <thead><tr><th>Topic</th><th>Trades</th><th>Closed</th><th>Calculated P&amp;L</th><th>Source input</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.topic}>
            <td><span className="topic-pill" style={{ '--topic-color': TOPIC_BY_ID[row.topic].accent } as React.CSSProperties}>{TOPIC_BY_ID[row.topic].label}</span></td>
            <td>{row.matching.length}</td><td>{row.closed.length}</td>
            <td className={row.pnl >= 0 ? 'positive' : 'negative'}>{formatMoney(row.pnl)}</td>
            <td>{row.source && <SourceLink href={row.source} label="First market" />}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function PortfolioPage({ portfolio, metrics }: PortfolioPageProps) {
  const returnValue = (metrics.equity - portfolio.startingCash) / portfolio.startingCash;

  return (
    <div className="page-stack">
      <section className="account-gate">
        <div className="account-gate__icon"><LockKeyhole size={24} /></div>
        <div>
          <span className="panel-kicker">KALSHI DEMO ACCOUNT</span>
          <h2>Authenticated portfolio values intentionally blank</h2>
          <p>No signing key was supplied, and GitHub Pages cannot safely retain one. This release does not invent a balance, position, fill, or order—and does not expose a credential form in the browser.</p>
        </div>
        <div className="account-gate__fields" aria-label="Unavailable authenticated values">
          <span><small>Demo balance</small><strong>—</strong></span>
          <span><small>Demo positions</small><strong>—</strong></span>
          <span><small>Demo fills</small><strong>—</strong></span>
        </div>
        <div className="account-gate__links">
          <SourceLink href="https://docs.kalshi.com/getting_started/quick_start_authenticated_requests" label="Auth requirement" />
          <a href="#/review">See FR-001 →</a>
        </div>
      </section>

      <div className="section-heading section-heading--spread">
        <div><span className="panel-kicker">LOCAL AUTOMATION</span><h2>Paper portfolio</h2></div>
        <div className="automation-live"><span /> Autonomous simulator active</div>
      </div>

      <section className="metric-grid">
        <MetricCard icon={WalletCards} label="Paper equity" value={formatMoney(metrics.equity)} detail={`${formatPercent(returnValue)} from configured $10,000 start`} />
        <MetricCard icon={CircleDollarSign} label="Realized P&L" value={formatMoney(metrics.realizedPnl)} detail={`${metrics.closedTrades} closed simulated trades`} tone="blue" />
        <MetricCard icon={Trophy} label="Win rate" value={metrics.winRate === null ? '—' : `${(metrics.winRate * 100).toFixed(1)}%`} detail="Positive-P&L closed paper trades" tone="violet" />
        <MetricCard icon={Scale} label="Open exposure" value={metrics.openTrades} detail={`${formatMoney(portfolio.cash)} unallocated paper cash`} tone="amber" />
      </section>

      <section className="content-card equity-card">
        <header className="panel-header"><div><span className="panel-kicker">PERFORMANCE</span><h2>Paper equity curve</h2><p>Calculated locally from assumed one-contract paper fills; fees are excluded.</p></div><SourceLink href="https://docs.kalshi.com/api-reference/portfolio/get-positions" label="Live position fields" /></header>
        <EquityChart points={portfolio.equityHistory} />
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">TRADE JOURNAL</span><h2>Automated entries &amp; exits</h2><p>Each row links to the official market record that supplied the signal and mark.</p></div><span className="panel-count">{portfolio.trades.length} total</span></header>
        <TradeTable trades={portfolio.trades} />
      </section>

      <section className="content-card">
        <header className="panel-header"><div><span className="panel-kicker">CATEGORY ANALYSIS</span><h2>Performance by topic</h2><p>Open P&amp;L is marked from the official last YES price; NO marks are calculated as 1 − YES.</p></div></header>
        <TopicPerformance trades={portfolio.trades} />
      </section>

      <section className="assumption-grid">
        <article><span>01</span><strong>Entry</strong><p>One paper contract at the displayed ask after a selected ≥10¢ swing. If the ask is blank, no trade.</p></article>
        <article><span>02</span><strong>Risk</strong><p>Exit at +10¢, −8¢, six hours, or official resolution—whichever is observed first.</p></article>
        <article><span>03</span><strong>Boundaries</strong><p>No fees, queue position, partial fills, latency, or slippage beyond the displayed ask. Results are not live-account results.</p></article>
      </section>
    </div>
  );
}
