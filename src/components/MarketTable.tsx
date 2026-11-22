import { BarChart3, ChevronRight } from 'lucide-react';
import { TOPIC_BY_ID } from '../data/topics';
import { marketDayChange, marketPrice, topBookSize } from '../lib/analytics';
import { groupMarketsByEvent } from '../lib/events';
import { formatCompact, formatContracts, formatDateTime, formatPrice, formatSignedPrice } from '../lib/format';
import type { DashboardMarket } from '../types/kalshi';
import { EmptyState } from './EmptyState';
import { SourceLink } from './SourceLink';

interface MarketTableProps {
  markets: DashboardMarket[];
  selectedTicker: string | null;
  onSelect: (market: DashboardMarket) => void;
  limit?: number;
  showTopic?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
}

export function MarketTable({
  markets,
  selectedTicker,
  onSelect,
  limit,
  showTopic = true,
  emptyTitle = 'No verified markets returned',
  emptyDetail = 'The demo API has not returned an open contract matching this dashboard topic.',
}: MarketTableProps) {
  const groups = groupMarketsByEvent(markets);
  const visible = typeof limit === 'number' ? groups.slice(0, limit) : groups;

  if (visible.length === 0) {
    return <EmptyState icon={BarChart3} title={emptyTitle} detail={emptyDetail} />;
  }

  return (
    <div className="table-wrap">
      <table className="market-table">
        <thead>
          <tr>
            <th>Event / leading contract</th>
            {showTopic && <th>Topic</th>}
            <th>YES</th>
            <th>24h move</th>
            <th><span className="th-with-note">24h notional <small>calc.</small></span></th>
            <th>Top size</th>
            <th>Closes</th>
            <th><span className="sr-only">Source</span></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((group) => {
            const market = group.leadMarket;
            const change = marketDayChange(market);
            const topic = TOPIC_BY_ID[group.topic];
            const selected = selectedTicker === market.ticker;
            return (
              <tr key={group.eventTicker} className={selected ? 'market-row--selected' : ''}>
                <td className="market-name-cell">
                  <button type="button" onClick={() => onSelect(market)} className="market-name-button">
                    <span className="market-status-dot" data-status={market.status} />
                    <span>
                      <strong>{group.title}</strong>
                      <small>{market.yes_sub_title || market.title || market.ticker}</small>
                      <span className="market-meta">{group.markets.length} contract{group.markets.length === 1 ? '' : 's'} · {group.eventTicker}</span>
                    </span>
                  </button>
                </td>
                {showTopic && (
                  <td><span className="topic-pill" style={{ '--topic-color': topic.accent } as React.CSSProperties}>{topic.shortLabel}</span></td>
                )}
                <td><strong className="price-value">{formatPrice(marketPrice(market))}</strong></td>
                <td>
                  <span className={change === null ? 'muted' : change >= 0 ? 'positive' : 'negative'}>
                    {formatSignedPrice(change)}
                  </span>
                </td>
                <td>
                  <strong>{group.notional24h === null ? '—' : `$${formatCompact(group.notional24h)}`}</strong>
                  <small className="cell-note">volume × notional</small>
                </td>
                <td>
                  <strong>{formatContracts(topBookSize(market))}</strong>
                  <small className="cell-note">contracts</small>
                </td>
                <td>
                  <span>{formatDateTime(market.close_time)}</span>
                  {market.result === 'yes' || market.result === 'no' ? (
                    <small className={`resolution resolution--${market.result}`}>{market.result.toUpperCase()}</small>
                  ) : <small className="cell-note">{market.status}</small>}
                </td>
                <td className="source-cell">
                  <SourceLink href={group.sourceUrl} label="Event" />
                  <button type="button" className="row-open" onClick={() => onSelect(market)} aria-label={`Open chart for ${group.title}`}>
                    <ChevronRight aria-hidden="true" size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
