import { Layers3 } from 'lucide-react';
import { formatContracts, formatPrice, timeAgo } from '../lib/format';
import type { OrderbookLevel } from '../types/kalshi';
import { EmptyState } from './EmptyState';
import { SourceLink } from './SourceLink';

interface OrderbookPanelProps {
  ticker: string | null;
  levels: OrderbookLevel[];
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
}

function BookSide({ side, levels }: { side: 'yes' | 'no'; levels: OrderbookLevel[] }) {
  const visible = levels.filter((level) => level.side === side).sort((a, b) => b.price - a.price).slice(0, 6);
  return (
    <div className="book-side">
      <div className="book-side__header">
        <span className={`side-label side-label--${side}`}>{side.toUpperCase()} bids</span>
        <small>price / contracts</small>
      </div>
      {visible.length === 0 ? (
        <p className="book-empty">No levels returned</p>
      ) : (
        <div className="book-levels">
          {visible.map((level) => {
            const width = Math.min(100, Math.max(4, level.quantity / Math.max(...visible.map((item) => item.quantity)) * 100));
            return (
              <div className="book-level" key={`${side}-${level.price}`}>
                <span className="book-level__bar" style={{ width: `${width}%` }} />
                <strong>{formatPrice(level.price)}</strong>
                <span>{formatContracts(level.quantity)}</span>
                <SourceLink href={level.sourceUrl} label="Row" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OrderbookPanel({ ticker, levels, loading, error, updatedAt }: OrderbookPanelProps) {
  return (
    <section className="orderbook-card">
      <header className="panel-header panel-header--compact">
        <div>
          <span className="panel-kicker">LIQUIDITY DEPTH</span>
          <h2>Order book</h2>
        </div>
        <span className="book-updated">{loading ? 'Updating…' : timeAgo(updatedAt)}</span>
      </header>
      {!ticker ? (
        <EmptyState compact icon={Layers3} title="Select a contract" detail="Verified bid depth will appear here." />
      ) : error ? (
        <EmptyState compact icon={Layers3} title="Order book unavailable" detail={error} />
      ) : (
        <div className="book-grid">
          <BookSide side="yes" levels={levels} />
          <BookSide side="no" levels={levels} />
        </div>
      )}
      <footer className="book-footer">
        <span>Bid levels only · not order count</span>
        <SourceLink href="https://docs.kalshi.com/api-reference/market/get-market-orderbook" label="Field guide" />
      </footer>
    </section>
  );
}
