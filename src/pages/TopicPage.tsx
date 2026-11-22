import { BellRing, CheckCircle2, CircleDollarSign, Layers3, Radio } from 'lucide-react';
import { AlertFeed } from '../components/AlertFeed';
import { MarketTable } from '../components/MarketTable';
import { MetricCard } from '../components/MetricCard';
import { OrderbookPanel } from '../components/OrderbookPanel';
import { PriceChart } from '../components/PriceChart';
import { SourceLink } from '../components/SourceLink';
import { TOPIC_BY_ID } from '../data/topics';
import { useOrderbook } from '../hooks/useOrderbook';
import { marketNotional24h } from '../lib/analytics';
import { groupMarketsByEvent } from '../lib/events';
import { formatCompact } from '../lib/format';
import type { DashboardMarket, MarketFeedItem, PricePoint, TopicId } from '../types/kalshi';

interface TopicPageProps {
  topicId: TopicId;
  markets: DashboardMarket[];
  feed: MarketFeedItem[];
  selectedFeed: MarketFeedItem[];
  histories: Record<string, PricePoint[]>;
  selectedMarket: DashboardMarket | null;
  onSelectMarket: (market: DashboardMarket) => void;
}

export function TopicPage({ topicId, markets, feed, selectedFeed, histories, selectedMarket, onSelectMarket }: TopicPageProps) {
  const topic = TOPIC_BY_ID[topicId];
  const topicMarkets = markets.filter((market) => market.topic === topicId);
  const open = topicMarkets.filter((market) => market.status === 'open');
  const resolved = topicMarkets.filter((market) => market.result === 'yes' || market.result === 'no');
  const groups = groupMarketsByEvent(open);
  const notional = open.reduce((sum, market) => sum + (marketNotional24h(market) ?? 0), 0);
  const hasNotional = open.length > 0 && open.every((market) => marketNotional24h(market) !== null);
  const topicFeed = feed.filter((item) => item.topic === topicId);
  const topicSelectedFeed = selectedFeed.filter((item) => item.topic === topicId);
  const orderbook = useOrderbook(selectedMarket?.ticker ?? null);

  return (
    <div className="page-stack">
      <section className="topic-hero" style={{ '--topic-color': topic.accent } as React.CSSProperties}>
        <div>
          <span className="eyebrow-chip"><Radio size={12} /> {topic.eyebrow.toUpperCase()}</span>
          <h2>{topic.label}<em>.</em></h2>
          <p>{topic.description} Classification is a documented local keyword rule over official event titles and categories.</p>
          <div className="topic-hero__sources">
            <SourceLink href="https://docs.kalshi.com/api-reference/events/get-events" label="Event schema" />
            <a href="#/sources">Read classification method →</a>
          </div>
        </div>
        <div className="topic-hero__signal">
          <span>EVENTS ON DESK</span>
          <strong>{groups.length}</strong>
          <small>{open.length} open contracts</small>
          <div className="signal-bars" aria-hidden="true">{[28, 54, 38, 82, 60, 96, 46, 70, 34, 58].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
        </div>
      </section>

      <section className="metric-grid metric-grid--three">
        <MetricCard icon={Radio} label="Live events" value={groups.length} detail={`${open.length} official open contracts`} />
        <MetricCard icon={CircleDollarSign} label="24h contract notional" value={hasNotional ? `$${formatCompact(notional)}` : '—'} detail="Calculated, not cash volume" tone="blue" />
        <MetricCard icon={BellRing} label="Qualifying swings" value={topicSelectedFeed.length} detail="Score ≥65 after a ≥10¢ move" tone="violet" />
      </section>

      <div className="chart-book-grid">
        <PriceChart market={selectedMarket} points={selectedMarket ? histories[selectedMarket.ticker] ?? [] : []} />
        <OrderbookPanel ticker={selectedMarket?.ticker ?? null} {...orderbook} />
      </div>

      <section className="content-card">
        <header className="panel-header">
          <div>
            <span className="panel-kicker">{topic.label.toUpperCase()} · OPEN</span>
            <h2>Organized by event</h2>
            <p>Leading contracts are selected by calculated 24-hour notional; expand the chart by choosing a row.</p>
          </div>
          <div className="panel-header__icon"><Layers3 size={18} /></div>
        </header>
        <MarketTable
          markets={open}
          selectedTicker={selectedMarket?.ticker ?? null}
          onSelect={onSelectMarket}
          showTopic={false}
          emptyTitle={`No verified open ${topic.label.toLowerCase()} events`}
        />
      </section>

      <div className="feed-grid">
        <AlertFeed items={topicFeed} mode="all" />
        <AlertFeed items={topicSelectedFeed} mode="selected" />
      </div>

      <section className="content-card">
        <header className="panel-header">
          <div>
            <span className="panel-kicker">OBSERVED RESOLUTIONS</span>
            <h2>YES / NO outcomes</h2>
            <p>Only contracts observed by this browser and later reported with an official result appear here.</p>
          </div>
          <div className="panel-header__actions"><CheckCircle2 size={16} /><span>{resolved.length} resolved</span></div>
        </header>
        <MarketTable
          markets={resolved}
          selectedTicker={selectedMarket?.ticker ?? null}
          onSelect={onSelectMarket}
          showTopic={false}
          emptyTitle="No observed resolutions yet"
          emptyDetail="This is a live session tracker, not a fabricated historical archive."
        />
      </section>
    </div>
  );
}
