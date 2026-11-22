import { Activity, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SourceLink } from './SourceLink';
import type { ConnectionState } from '../types/kalshi';
import { timeAgo } from '../lib/format';

interface TopbarProps {
  eyebrow: string;
  title: string;
  detail?: string;
  connection: ConnectionState;
  lastSyncAt: number | null;
  nextSyncAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
}

const statusLabels: Record<ConnectionState, string> = {
  connecting: 'Connecting',
  live: 'Polling live',
  degraded: 'Data delayed',
  offline: 'API offline',
};

export function Topbar({
  eyebrow,
  title,
  detail,
  connection,
  lastSyncAt,
  nextSyncAt,
  refreshing,
  onRefresh,
}: TopbarProps) {
  const [, setClock] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const secondsToSync = nextSyncAt ? Math.max(0, Math.ceil((nextSyncAt - Date.now()) / 1000)) : null;
  const StatusIcon = connection === 'offline' ? WifiOff : connection === 'live' ? Activity : Wifi;

  return (
    <header className="topbar">
      <div className="topbar__title">
        <p>{eyebrow}</p>
        <div className="topbar__heading-row">
          <h1>{title}</h1>
          {detail && <span className="topbar__detail">{detail}</span>}
        </div>
      </div>
      <div className="topbar__actions">
        <SourceLink href="https://docs.kalshi.com/getting_started/api_environments" label="Demo API" />
        <div className={`connection-pill connection-pill--${connection}`} role="status">
          <StatusIcon aria-hidden="true" size={14} />
          <span>{statusLabels[connection]}</span>
          <small>
            {connection === 'live' && secondsToSync !== null ? `next ${secondsToSync}s` : timeAgo(lastSyncAt)}
          </small>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh market data now">
          <RefreshCw aria-hidden="true" size={16} className={refreshing ? 'spin' : ''} />
        </button>
      </div>
    </header>
  );
}
