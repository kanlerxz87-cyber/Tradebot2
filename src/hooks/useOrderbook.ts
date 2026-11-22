import { useEffect, useState } from 'react';
import { fetchOrderbook } from '../services/kalshi';
import type { OrderbookLevel } from '../types/kalshi';

export function useOrderbook(ticker: string | null) {
  const [levels, setLevels] = useState<OrderbookLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!ticker) {
      setLevels([]);
      setError(null);
      setUpdatedAt(null);
      return undefined;
    }

    const load = async () => {
      setLoading(true);
      try {
        const next = await fetchOrderbook(ticker);
        if (!active) return;
        setLevels(next);
        setUpdatedAt(Date.now());
        setError(null);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Order-book request failed.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ticker]);

  return { levels, loading, error, updatedAt };
}
