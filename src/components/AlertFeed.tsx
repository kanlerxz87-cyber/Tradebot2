import { BellRing, Radio, Sparkles } from 'lucide-react';
import { TOPIC_BY_ID } from '../data/topics';
import { formatPrice, formatSignedPrice, formatTime, truncate } from '../lib/format';
import type { MarketFeedItem } from '../types/kalshi';
import { EmptyState } from './EmptyState';
import { SourceLink } from './SourceLink';

interface AlertFeedProps {
  items: MarketFeedItem[];
  mode: 'all' | 'selected';
}

export function AlertFeed({ items, mode }: AlertFeedProps) {
  const selected = mode === 'selected';
  return (
    <section className={`feed-panel ${selected ? 'feed-panel--selected' : ''}`}>
      <header className="panel-header panel-header--feed">
        <div>
          <span className="panel-kicker">{selected ? 'MODEL SELECTIVITY' : 'MARKET TAPE'}</span>
          <h2>{selected ? 'Signal shortlist' : 'All event moves'}</h2>
        </div>
        <div className="feed-live"><span /> {selected ? 'score ≥ 65' : 'auto-scroll'}</div>
      </header>

      <div className="feed-scroll" aria-live="polite" aria-label={selected ? 'Selected swing alerts' : 'All market movements'}>
        {items.length === 0 ? (
          <EmptyState
            compact
            icon={selected ? Sparkles : Radio}
            title={selected ? 'No qualifying swing yet' : 'Waiting for a verified price change'}
            detail={selected
              ? 'A ≥10¢ move must also pass the documented spread, activity, depth, and price checks.'
              : 'New messages appear only when the official demo API reports a changed price or resolution.'}
          />
        ) : (
          items.map((item) => {
            const topic = item.topic ? TOPIC_BY_ID[item.topic] : null;
            return (
              <article className={`feed-item feed-item--${item.kind}`} key={item.id}>
                <div className="feed-item__rail">
                  <span style={{ background: topic?.accent ?? '#83918b' }} />
                </div>
                <div className="feed-item__body">
                  <div className="feed-item__topline">
                    <span className="feed-item__time">{formatTime(item.timestamp)}</span>
                    {item.kind === 'swing' && <span className="swing-badge"><BellRing size={10} /> ≥10¢ swing</span>}
                    {item.selectivityScore !== null && <span className="score-badge">score {item.selectivityScore}</span>}
                  </div>
                  <strong>{truncate(item.eventTitle, 78)}</strong>
                  <p>{item.message}</p>
                  {item.fromPrice !== null && item.toPrice !== null && (
                    <div className="feed-prices">
                      <span>{formatPrice(item.fromPrice)}</span>
                      <span className="feed-arrow">→</span>
                      <span>{formatPrice(item.toPrice)}</span>
                      <b className={(item.delta ?? 0) >= 0 ? 'positive' : 'negative'}>{formatSignedPrice(item.delta)}</b>
                    </div>
                  )}
                  <div className="feed-item__footer">
                    <span>{topic?.label ?? 'System'} · {item.ticker ?? 'monitor'}</span>
                    <SourceLink href={item.sourceUrl} label="API row" />
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
      <footer className="feed-footer">
        <span>Cause links remain blank unless verified</span>
        <span>{items.length} / 120 retained</span>
      </footer>
    </section>
  );
}
