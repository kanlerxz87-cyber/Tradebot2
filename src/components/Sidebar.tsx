import {
  BarChart3,
  Bitcoin,
  BookOpenCheck,
  CircleDollarSign,
  Clapperboard,
  FileCheck2,
  Flag,
  FlaskConical,
  Gauge,
  ShieldAlert,
  Vote,
  WalletCards,
} from 'lucide-react';
import { TOPICS } from '../data/topics';
import type { TopicId } from '../types/kalshi';

interface SidebarProps {
  route: string;
  counts: Record<TopicId, number>;
}

const topicIcons = {
  'gas-prices': CircleDollarSign,
  elections: Vote,
  culture: Clapperboard,
  crypto: Bitcoin,
  golf: Flag,
} as const;

const primary = [
  { route: 'overview', label: 'Market overview', icon: Gauge },
  { route: 'portfolio', label: 'Paper portfolio', icon: WalletCards },
  { route: 'strategies', label: 'Strategy lab', icon: FlaskConical },
];

const research = [
  { route: 'summary', label: 'Executive summary', icon: FileCheck2 },
  { route: 'sources', label: 'Sources & methods', icon: BookOpenCheck },
  { route: 'review', label: 'Flagged for review', icon: ShieldAlert },
];

function NavItem({ item, active }: { item: { route: string; label: string; icon: typeof BarChart3 }; active: boolean }) {
  const Icon = item.icon;
  return (
    <a className={`nav-item ${active ? 'nav-item--active' : ''}`} href={`#/${item.route}`} aria-current={active ? 'page' : undefined}>
      <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
      <span>{item.label}</span>
    </a>
  );
}

export function Sidebar({ route, counts }: SidebarProps) {
  return (
    <aside className="sidebar">
      <a href="#/overview" className="brand" aria-label="Signal Desk home">
        <span className="brand__mark"><BarChart3 aria-hidden="true" size={21} strokeWidth={2.4} /></span>
        <span>
          <strong>Signal Desk</strong>
          <small>KALSHI DEMO</small>
        </span>
      </a>

      <nav aria-label="Main navigation" className="sidebar__nav">
        <div className="nav-group">
          <p className="nav-group__label">Desk</p>
          {primary.map((item) => <NavItem key={item.route} item={item} active={route === item.route} />)}
        </div>

        <div className="nav-group">
          <p className="nav-group__label">Live topics</p>
          {TOPICS.map((topic) => {
            const Icon = topicIcons[topic.id];
            const topicRoute = `topic/${topic.id}`;
            return (
              <a
                key={topic.id}
                className={`nav-item ${route === topicRoute ? 'nav-item--active' : ''}`}
                href={`#/${topicRoute}`}
                aria-current={route === topicRoute ? 'page' : undefined}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.9} />
                <span>{topic.label}</span>
                <span className="nav-item__count">{counts[topic.id]}</span>
              </a>
            );
          })}
        </div>

        <div className="nav-group nav-group--research">
          <p className="nav-group__label">Research</p>
          {research.map((item) => <NavItem key={item.route} item={item} active={route === item.route} />)}
        </div>
      </nav>

      <div className="sidebar__footer">
        <span className="security-dot" />
        <div>
          <strong>Public data only</strong>
          <small>No credentials in browser</small>
        </div>
      </div>
    </aside>
  );
}
