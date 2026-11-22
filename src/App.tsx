import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { SourceLink } from './components/SourceLink';
import { TOPICS, TOPIC_BY_ID, isTopicId } from './data/topics';
import { useMarketMonitor } from './hooks/useMarketMonitor';
import { usePaperPortfolio } from './hooks/usePaperPortfolio';
import { sortByNotional } from './lib/analytics';
import { groupMarketsByEvent } from './lib/events';
import { OverviewPage } from './pages/OverviewPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { ReviewPage } from './pages/ReviewPage';
import { SourcesPage } from './pages/SourcesPage';
import { StrategiesPage } from './pages/StrategiesPage';
import { SummaryPage } from './pages/SummaryPage';
import { TopicPage } from './pages/TopicPage';
import type { DashboardMarket, TopicId } from './types/kalshi';

function routeFromHash(): string {
  const route = window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return route || 'overview';
}

function useHashRoute() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const onChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.history.replaceState(null, '', '#/overview');
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' }), [route]);
  return route;
}

function topicFromRoute(route: string): TopicId | null {
  const [prefix, value] = route.split('/');
  return prefix === 'topic' && value && isTopicId(value) ? value : null;
}

function routeMeta(route: string) {
  const topicId = topicFromRoute(route);
  if (topicId) {
    const topic = TOPIC_BY_ID[topicId];
    return { eyebrow: topic.eyebrow, title: topic.label, detail: 'live topic desk' };
  }
  const values: Record<string, { eyebrow: string; title: string; detail?: string }> = {
    overview: { eyebrow: 'Kalshi demo intelligence', title: 'Market overview', detail: 'five-topic live monitor' },
    portfolio: { eyebrow: 'Performance & execution', title: 'Portfolio', detail: 'paper vs. authenticated' },
    strategies: { eyebrow: 'Transparent automation', title: 'Strategy lab', detail: 'rules, risk, results' },
    summary: { eyebrow: 'Decision brief', title: 'Executive summary', detail: 'scope & traceability' },
    sources: { eyebrow: 'Verification workspace', title: 'Sources & methods', detail: 'official links only' },
    review: { eyebrow: 'Exception register', title: 'Flagged for review', detail: 'open disclosures' },
  };
  return values[route] ?? { eyebrow: 'Kalshi demo intelligence', title: 'Market overview', detail: 'five-topic live monitor' };
}

export default function App() {
  const route = useHashRoute();
  const topicId = topicFromRoute(route);
  const monitor = useMarketMonitor();
  const paper = usePaperPortfolio(monitor.markets, monitor.selectedFeed);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const counts = useMemo(() => Object.fromEntries(
    TOPICS.map((topic) => [
      topic.id,
      groupMarketsByEvent(monitor.markets.filter((market) => market.topic === topic.id && market.status === 'open')).length,
    ]),
  ) as Record<TopicId, number>, [monitor.markets]);

  useEffect(() => {
    const current = monitor.markets.find((market) => market.ticker === selectedTicker);
    const candidates = sortByNotional(
      monitor.markets.filter((market) => market.status === 'open' && (!topicId || market.topic === topicId)),
    );
    if (!current || (topicId && current.topic !== topicId)) {
      setSelectedTicker(candidates[0]?.ticker ?? null);
    }
  }, [monitor.markets, selectedTicker, topicId]);

  const selectedMarket = monitor.markets.find((market) => market.ticker === selectedTicker) ?? null;
  const selectMarket = (market: DashboardMarket) => setSelectedTicker(market.ticker);
  const meta = routeMeta(route);

  let page;
  if (topicId) {
    page = (
      <TopicPage
        topicId={topicId}
        markets={monitor.markets}
        feed={monitor.feed}
        selectedFeed={monitor.selectedFeed}
        histories={monitor.histories}
        selectedMarket={selectedMarket}
        onSelectMarket={selectMarket}
      />
    );
  } else {
    switch (route) {
      case 'portfolio':
        page = <PortfolioPage portfolio={paper.portfolio} metrics={paper.metrics} />;
        break;
      case 'strategies':
        page = <StrategiesPage portfolio={paper.portfolio} />;
        break;
      case 'summary':
        page = <SummaryPage />;
        break;
      case 'sources':
        page = <SourcesPage />;
        break;
      case 'review':
        page = <ReviewPage />;
        break;
      case 'overview':
      default:
        page = (
          <OverviewPage
            markets={monitor.markets}
            feed={monitor.feed}
            selectedFeed={monitor.selectedFeed}
            histories={monitor.histories}
            selectedMarket={selectedMarket}
            onSelectMarket={selectMarket}
            error={monitor.error}
            paperPortfolio={paper.portfolio}
            paperEquity={paper.metrics.equity}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <Sidebar route={topicId ? `topic/${topicId}` : route} counts={counts} />
      <div className="app-main">
        <Topbar
          {...meta}
          connection={monitor.connection}
          lastSyncAt={monitor.lastSyncAt}
          nextSyncAt={monitor.nextSyncAt}
          refreshing={monitor.isRefreshing}
          onRefresh={monitor.refresh}
        />
        <main className="page-content">{page}</main>
        <footer className="site-footer">
          <div><strong>Signal Desk</strong><span>Independent research interface · not affiliated with or endorsed by Kalshi.</span></div>
          <p>Paper results are simulated. Nothing here is investment advice. Missing values remain blank.</p>
          <div><SourceLink href="https://docs.kalshi.com" label="Kalshi docs" /><a href="#/review">Open disclosures</a></div>
        </footer>
      </div>
    </div>
  );
}
