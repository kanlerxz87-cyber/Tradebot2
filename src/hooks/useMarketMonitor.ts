import { useCallback, useEffect, useRef, useState } from 'react';
import { applyMarketSnapshot, mergeDiscovery, prependFeed } from '../lib/marketMonitor';
import { DISCOVERY_INTERVAL_MS, fetchMarketsByTickers, fetchTargetMarkets, POLL_INTERVAL_MS } from '../services/kalshi';
import type { DashboardMarket, MonitorState } from '../types/kalshi';

const INITIAL_STATE: MonitorState = {
  markets: [],
  feed: [],
  selectedFeed: [],
  histories: {},
  connection: 'connecting',
  lastSyncAt: null,
  nextSyncAt: null,
  error: null,
  isRefreshing: false,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Kalshi demo API error.';
}

export function useMarketMonitor() {
  const [state, setState] = useState<MonitorState>(INITIAL_STATE);
  const marketsRef = useRef<DashboardMarket[]>([]);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    marketsRef.current = state.markets;
  }, [state.markets]);

  const handleFailure = useCallback((error: unknown) => {
    if (!mountedRef.current) return;
    setState((previous) => ({
      ...previous,
      connection: previous.markets.length > 0 ? 'degraded' : 'offline',
      error: errorMessage(error),
      isRefreshing: false,
      nextSyncAt: Date.now() + POLL_INTERVAL_MS,
    }));
  }, []);

  const discover = useCallback(async (force = false) => {
    if (busyRef.current && !force) return;
    busyRef.current = true;
    if (mountedRef.current) setState((previous) => ({ ...previous, isRefreshing: true }));

    try {
      const discovered = await fetchTargetMarkets();
      const now = Date.now();
      if (!mountedRef.current) return;
      setState((previous) => {
        const result = mergeDiscovery(previous, discovered, now);
        return {
          ...previous,
          markets: result.markets,
          histories: result.histories,
          feed: prependFeed(previous.feed, result.feedItems),
          selectedFeed: prependFeed(previous.selectedFeed, result.selectedItems),
          connection: 'live',
          lastSyncAt: now,
          nextSyncAt: now + POLL_INTERVAL_MS,
          error: null,
          isRefreshing: false,
        };
      });
    } catch (error) {
      handleFailure(error);
    } finally {
      busyRef.current = false;
    }
  }, [handleFailure]);

  const poll = useCallback(async () => {
    if (busyRef.current || marketsRef.current.length === 0) return;
    busyRef.current = true;

    try {
      const updates = await fetchMarketsByTickers(marketsRef.current.map((market) => market.ticker));
      const now = Date.now();
      if (!mountedRef.current) return;
      setState((previous) => {
        const result = applyMarketSnapshot(previous.markets, updates, previous.histories, now);
        return {
          ...previous,
          markets: result.markets,
          histories: result.histories,
          feed: prependFeed(previous.feed, result.feedItems),
          selectedFeed: prependFeed(previous.selectedFeed, result.selectedItems),
          connection: 'live',
          lastSyncAt: now,
          nextSyncAt: now + POLL_INTERVAL_MS,
          error: null,
          isRefreshing: false,
        };
      });
    } catch (error) {
      handleFailure(error);
    } finally {
      busyRef.current = false;
    }
  }, [handleFailure]);

  useEffect(() => {
    mountedRef.current = true;
    void discover();

    const pollingTimer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    const discoveryTimer = window.setInterval(() => void discover(), DISCOVERY_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void discover();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearInterval(pollingTimer);
      window.clearInterval(discoveryTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [discover, poll]);

  return {
    ...state,
    refresh: () => discover(true),
  };
}
