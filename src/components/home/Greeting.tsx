'use client';

import { useDashboardSummary } from '@/lib/dashboard-context';
import { localHour } from '@/lib/date-local';

const WELCOME = 'ברוך הבא ל-134+';

export function greetingFor(hour: number, name: string | null): string {
  if (!name) return WELCOME;
  const part = hour >= 5 && hour < 12 ? 'בוקר טוב' : hour >= 12 && hour < 17 ? 'צהריים טובים' : 'ערב טוב';
  return `${part}, ${name}`;
}

/**
 * The line under the logo: a time-of-day greeting by first name, or a
 * welcome for a guest. Rendered only once the summary has settled (the
 * hour is the device's, so the server can't render it), in a slot that
 * holds its height meanwhile so nothing below jumps.
 */
export function Greeting() {
  const { data, loading } = useDashboardSummary();
  return (
    <p className="mt-3.5 min-h-[1.3em] text-[22px] leading-[1.3] font-extrabold tracking-[-0.02em] text-exam-ink">
      {!loading && <span className="animate-fade-up">{greetingFor(localHour(), data?.displayName ?? null)}</span>}
    </p>
  );
}
