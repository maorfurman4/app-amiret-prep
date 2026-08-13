'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface ActivityGuardValue {
  inProgress: boolean;
  setInProgress: (v: boolean) => void;
}

const ActivityGuardContext = createContext<ActivityGuardValue>({
  inProgress: false,
  setInProgress: () => {},
});

/**
 * Lets a page flag "the user has in-progress activity right now" (e.g.
 * mid-question in practice) so the bottom nav can require a confirming
 * second tap before navigating away to a different category, instead of
 * silently discarding progress on one accidental tap.
 */
export function ActivityGuardProvider({ children }: { children: ReactNode }) {
  const [inProgress, setInProgress] = useState(false);
  return (
    <ActivityGuardContext.Provider value={{ inProgress, setInProgress }}>
      {children}
    </ActivityGuardContext.Provider>
  );
}

export function useActivityGuard() {
  return useContext(ActivityGuardContext);
}
