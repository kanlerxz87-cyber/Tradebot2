import { Activity, BellRing, CircleDollarSign, Radio, WalletCards } from 'lucide-react';
import { AlertFeed } from '../components/AlertFeed';
import { MarketTable } from '../components/MarketTable';
import { MetricCard } from '../components/MetricCard';
import { OrderbookPanel } from '../components/OrderbookPanel';
import { PriceChart } from '../components/PriceChart';
import { SourceLink } from '../components/SourceLink';
import { TOPICS } from '../data/topics';
import { marketNotional24h } from '../lib/analytics';
import { formatCompact, formatMoney } from '../lib/format';
import { groupMarketsByEvent } from '../lib/events';
import { useOrderbook } from '../hooks/useOrderbook';
import type { DashboardMarket, MarketFeedItem, PaperPortfolio, PricePoint, TopicId } from '../types/kalshi';

interface OverviewPageProps {
  markets: DashboardMarket[];
  feed: MarketFeedItem[];
  selectedFeed: MarketFeedItem[];
  histories: Record<string, PricePoint[]>;
  selectedMarket: DashboardMarket | null;
  onSelectMarket: (market: DashboardMarket) => void;
  error: string | null;
  paperPortfolio: PaperPortfolio;
  paperEquity: number;
}

export function OverviewPage({
  markets,
  feed,
  selectedFeed,
  histories,
  selectedMarket,
  onSelectMarket,
  error,
  paperPortfolio,
  paperEquity,
}: OverviewPageProps) {
  const orderbook = useOrderbook(selectedMarket?.ticker ?? null);
  const openMarkets = markets.filter((market) => market.status === 'open');
  const eventCount = groupMarketsByEvent(openMarkets).length;
  const totalNotional = openMarkets.reduce((sum, market) => sum + (marketNotional24h(market) ?? 0), 0);
  const knownNotional = openMarkets.length > 0 && openMarkets.every((market) => marketNotional24h(market) !== null);
  const swingCount = feed.filter((item) => item.kind === 'swing').length;

  const counts = Object.fromEntries(
    TOPICS.map((topic) => [topic.id, groupMarketsByEvent(openMarkets.filter((market) => market.topic === topic.id)).length]),
  ) as Record<TopicId, number>;

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-card__copy">
          <span className="eyebrow-chip"><Radio size={12} /> SOURCE-FIRST MARKET MONITOR</span>
          <h2>See the move.<br /><em>Verify the signal.</em></h2>
          <p>
            A focused Kalshi demo desk for gas prices, elections, culture, crypto, and golf—ranked by calculated 24-hour contract notional, with every live row linked to its official API record.
          </p>
          <div className="hero-card__actions">
            <a className="button button--primary" href="#/strategies">View strategy logic</a>
            <SourceLink href="https://docs.kalshi.com/getting_started/quick_start_market_data" label="Market-data docs" />
          </div>
        </div>
        <div className="hero-card__visual" aria-label="Monitoring coverage">
          <div className="radar-orbit radar-orbit--outer" />
          <div className="radar-orbit radar-orbit--inner" />
          <div className="radar-sweep" />
          <div className="radar-center"><Activity size={24} /><span>10s</span><small>REST poll</small></div>
          {TOPICS.map((topic, index) => (
            <a
              key={topic.id}
              href={`#/topic/${topic.id}`}
              className={`radar-topic radar-topic--${index + 1}`}
              style={{ '--topic-color': topic.accent } as React.CSSProperties}
            >
              <i />
              <span>{topic.shortLabel}</span>
              <b>{counts[topic.id]}</b>
            </a>
          ))}
        </div>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span><BellRing size={16} /></span>
          <div><strong>Live demo data is delayed</strong><p>{error} Existing verified values remain visible; no fallback values were inserted.</p></div>
          <a href="#/review">Review constraint</a>
        </div>
      )}

      <section className="metric-grid" aria-label="Desk metrics">
        <MetricCard
          icon={Radio}
          label="Open contracts"
          value={openMarkets.length || '—'}
          detail={`${eventCount || '—'} sourced events across five topics`}
          tone="lime"
        />
        <MetricCard
          icon={CircleDollarSign}
          label="24h contract notional"
          value={knownNotional ? `$${formatCompact(totalNotional)}` : '—'}
          detail="Calculated: volume × contract notional"
          tone="blue"
        />
        <MetricCard
          icon={BellRing}
          label="Detected swings"
          value={swingCount}
          detail="Net move ≥10¢ between observed polls"
          tone="violet"
        />
        <MetricCard
          icon={WalletCards}
          label="Paper equity"
          value={formatMoney(paperEquity)}
          detail={`${paperPortfolio.trades.length} automated simulated trade${paperPortfolio.trades.length === 1 ? '' : 's'}`}
          tone="amber"
        />
      </section>

      <div className="chart-book-grid">
        <PriceChart market={selectedMarket} points={selectedMarket ? histories[selectedMarket.ticker] ?? [] : []} />
        <OrderbookPanel ticker={selectedMarket?.ticker ?? null} {...orderbook} />
      </div>

      <section className="content-card">
        <header className="panel-header">
          <div>
            <span className="panel-kicker">RANKED LIVE EVENTS</span>
            <h2>Highest 24h contract notional</h2>
            <p>Event totals are calculated from official <code>volume_24h_fp × notional_value_dollars</code>; they are not cash traded or liquidity.</p>
          </div>
          <div className="panel-header__actions">
            <span>{eventCount} events</span>
            <SourceLink href="https://docs.kalshi.com/api-reference/market/get-markets" label="Field schema" />
          </div>
        </header>
        <MarketTable markets={openMarkets} selectedTicker={selectedMarket?.ticker ?? null} onSelect={onSelectMarket} limit={12} />
        {eventCount > 12 && <footer className="card-footer"><span>Showing the top 12 sourced events</span><a href="#/topic/crypto">Explore by topic →</a></footer>}
      </section>

      <section className="feeds-section">
        <div className="section-heading">
          <div>
            <span className="panel-kicker">LIVE ALERTING</span>
            <h2>Two tapes, one threshold</h2>
          </div>
          <p>Every movement stays on the left. Only ≥10¢ swings passing the transparent selectivity score reach the shortlist.</p>
        </div>
        <div className="feed-grid">
          <AlertFeed items={feed} mode="all" />
          <AlertFeed items={selectedFeed} mode="selected" />
        </div>
      </section>

      <section className="topic-strip">
        {TOPICS.map((topic) => (
          <a href={`#/topic/${topic.id}`} key={topic.id} className="topic-card" style={{ '--topic-color': topic.accent } as React.CSSProperties}>
            <span>{topic.eyebrow}</span>
            <strong>{topic.label}</strong>
            <p>{topic.description}</p>
            <footer><b>{counts[topic.id]} events</b><span>Open desk →</span></footer>
          </a>
        ))}
      </section>
    </div>
  );
}
