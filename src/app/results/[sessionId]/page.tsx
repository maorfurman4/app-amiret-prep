'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthCTA } from '@/components/AuthCTA';
import { AlertTriangle } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { ResultsScorePrompt } from '@/components/official-score/ResultsScorePrompt';
import { localDateStr, todayLocalStr } from '@/lib/date-local';
import { loadFailure, type LoadFailure } from '@/lib/session-lookup';
import { SessionStreakCelebration } from '@/components/home/StreakCelebration';
import { ResultsView, type ResultsSession } from '@/components/results/ResultsView';

export default function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<ResultsSession | null>(null);
  const [error, setError] = useState<LoadFailure | null>(null);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    authFetch(`/api/exam/results?sessionId=${sessionId}&guestId=${encodeURIComponent(guestId)}`)
      .then(r => {
        // Not finished yet — the API refuses (403); send them back into the exam.
        if (r.status === 403) { router.replace(`/exam/${sessionId}`); return null; }
        if (!r.ok) { if (!cancelled) setError(loadFailure(r.status)); return null; }
        return r.json();
      })
      .then((d: { session: ResultsSession } | null) => {
        if (cancelled) return;
        if (d?.session) setSession(d.session);
      })
      .catch(() => { if (!cancelled) setError('failed'); });
    return () => { cancelled = true; };
  }, [sessionId, loadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <main id="main" className="min-h-dvh flex items-center justify-center bg-exam-paper px-4" dir="rtl">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="w-10 h-10 mx-auto text-exam-wrong" strokeWidth={1.5} aria-hidden />
          <p className="text-exam-ink-soft text-sm">
            {error === 'missing'
              ? 'לא מצאנו את המבחן הזה. ייתכן שהקישור שגוי, או שהמבחן שייך לחשבון אחר.'
              : error === 'busy'
                ? 'יותר מדי בקשות בזמן קצר. חכה כדקה ונסה שוב.'
                : 'לא הצלחנו לטעון את התוצאות. בדוק את החיבור ונסה שוב.'}
          </p>
          {error !== 'missing' && <button
            onClick={() => { setError(null); setLoadToken(t => t + 1); }}
            className="px-6 py-2.5 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-semibold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
          >
            נסה שוב
          </button>}
          <div>
            <Link href="/" className="text-exam-accent underline text-sm">לדף הבית</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main id="main" className="min-h-dvh flex items-center justify-center bg-exam-paper">
        <div className="text-exam-ink-soft">טוען תוצאות...</div>
      </main>
    );
  }

  return (
    <ResultsView
      session={session}
      sessionId={sessionId}
      between={<>
        {/* Only the exam just finished can have earned today's streak — not a
            results page reopened from history. */}
        {session.completed_at && localDateStr(new Date(session.completed_at)) === todayLocalStr() && <SessionStreakCelebration />}
        {!session.is_practice && <ResultsScorePrompt />}
        <AuthCTA message="התחבר כדי לשמור את הציון הזה ולהמשיך מכל מכשיר. כל מה שעשית עד עכשיו יעבור אוטומטית לחשבון." />
      </>}
    />
  );
}
