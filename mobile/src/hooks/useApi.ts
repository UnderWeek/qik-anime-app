import { useCallback, useEffect, useRef, useState } from 'react';

// Mirrors anime-site useApi: fetch with loading/error/refetch.
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
): { data: T | null; loading: boolean; error: Error | null; refetch: () => Promise<T | null> } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mounted = useRef(true);
  const requestIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (requestId === requestIdRef.current) {
        if (mounted.current) setData(result);
        return result;
      }
      return null;
    } catch (e: any) {
      if (requestId === requestIdRef.current) {
        if (mounted.current) setError(e);
      }
      return null;
    } finally {
      if (requestId === requestIdRef.current && mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    refetch();
    return () => {
      mounted.current = false;
    };
  }, [refetch]);

  return { data, loading, error, refetch };
}
