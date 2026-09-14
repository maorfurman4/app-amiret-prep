'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { getOrCreateGuestId } from '@/lib/guest';
import type { DashboardSummary } from '@/app/api/dashboard-summary/route';

interface DashboardContextValue {
  data: DashboardSummary | null;
  loading: boolean;
}

const DashboardContext = createContext<DashboardContextValue>({ data: null, loading: true });

/**
 * Fetches the home-page personalization payload exactly once and hands it
 * to every consumer below via context, instead of each card doing its own
 * fetch. Deliberately fails soft: on any error `data` just stays null and
 * consumers fall back to the same static copy the page always showed —
 * see the "no data yet" contract on useDashboardSummary below.
 */
export function DashboardSummaryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const guestId = getOrCreateGuestId();
    authFetch(`/api/dashboard-summary?guestId=${encodeURIComponent(guestId)}`)
      .then(r => (r.ok ? r.json() as Promise<DashboardSummary> : null))
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { /* stays null — consumers show default copy */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardContext.Provider value={{ data, loading }}>
      {children}
    </DashboardContext.Provider>
  );
}

/**
 * Contract for consumers: while `loading` is true OR `data` is null (no
 * signed-in/guest identity, network failure, or a brand-new user with
 * zero rows everywhere), render the exact same default UI the page has
 * always shown. Only branch on personalized copy once `data` is non-null
 * AND the specific field you need is non-zero/non-null — never show a
 * loading spinner or skeleton here, so there is no flash/CLS on a page
 * this central.
 */
export function useDashboardSummary(): DashboardContextValue {
  return useContext(DashboardContext);
}
