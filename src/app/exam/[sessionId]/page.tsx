'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { ExamTimer } from '@/components/exam/ExamTimer';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { SectionProgress } from '@/components/exam/SectionProgress';
import { SECTION_CONFIGS, type Question } from '@/types/exam';

interface SessionState {
  id: string;
  current_section_index: number;
  current_section_expires_at: string | null;
  theta: number;
  questions_by_section: Record<number, Question[]>;
  answers_by_section: Record<number, (number | null)[]>;
  is_practice: boolean;
  completed_at: string | null;
}

export default function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);

  // Practice mode: track which question indices have been answered (locked)
  const [lockedAnswers, setLockedAnswers] = useState<Set<number>>(new Set());

  const [guestId, setGuestId] = useState<string | null>(null);

  // Read guestId after hydration — avoids SSR/client mismatch
  useEffect(() => {
    setGuestId(localStorage.getItem('amiret_guest_id') ?? null);
  }, []);

  // Load or recover session state from server
  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/exam/state?sessionId=${sessionId}&guestId=${encodeURIComponent(guestId ?? '')}`);
    if (!res.ok) { setError('לא ניתן לטעון את המבחן'); return; }
    const data = await res.json() as { session: SessionState; remainingMs: number; timerExpired: boolean };

    if (data.session.completed_at) {
      router.replace(`/results/${sessionId}`);
      return;
    }

    const section = data.session.current_section_index;
    const existingAnswers = (data.session.answers_by_section as Record<number, (number | null)[]>)[section];
    const questionCount = (data.session.questions_by_section as Record<number, Question[]>)[section]?.length ?? 0;

    setSession(data.session);
    setAnswers(existingAnswers ?? Array(questionCount).fill(null));

    // If timer already expired on server, submit immediately
    if (data.timerExpired) {
      await submitSection(data.session, Array(questionCount).fill(null));
    }
  }, [sessionId, guestId]); // guestId must be here — loaded async after hydration

  // Only run once guestId is resolved (null = not yet read from localStorage)
  useEffect(() => {
    if (guestId !== null) loadSession();
  }, [loadSession]);

  const currentSection = session?.current_section_index ?? 1;
  const currentCfg = SECTION_CONFIGS[currentSection - 1];
  const currentQuestions = (session?.questions_by_section[currentSection] ?? []) as Question[];
  const completedSections = session
    ? Object.keys(session.answers_by_section).map(Number).filter(n => n < currentSection)
    : [];

  // Keyboard shortcuts: 1-4 select answer, Enter/Space go next question
  useEffect(() => {
    if (!session || currentQuestions.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < currentQuestions[currentQuestionIndex]?.options.length) {
        handleAnswer(currentQuestionIndex, idx);
      } else if ((e.key === 'Enter' || e.key === ' ') && answers[currentQuestionIndex] !== null) {
        e.preventDefault();
        if (currentQuestionIndex < currentQuestions.length - 1) {
          setCurrentQuestionIndex(i => i + 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, currentQuestions, currentQuestionIndex, answers]);

  // Warn before leaving mid-exam (non-practice only)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session && !session.is_practice && !session.completed_at) {
        e.preventDefault();
        e.returnValue = 'המבחן בעיצומו — יציאה עלולה לגרום לאיבוד הנתונים. להמשיך?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers(prev => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
    if (session?.is_practice) {
      setLockedAnswers(prev => new Set([...prev, questionIndex]));
    }
  };

  const submitSection = useCallback(async (sess: SessionState, sectionAnswers: (number | null)[]) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/exam/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sess.id,
          sectionIndex: sess.current_section_index,
          answers: sectionAnswers,
          guestId,
        }),
      });

      const data = await res.json() as { isComplete: boolean; nextSectionIndex: number; nextExpiresAt: string };

      if (data.isComplete) {
        router.push(`/results/${sess.id}`);
      } else {
        // Refresh session state and reset practice tracking
        await loadSession();
        setCurrentQuestionIndex(0);
        setLockedAnswers(new Set());
      }
    } catch {
      setError('שגיאה בשליחת התשובות. נסה שוב.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [loadSession, router]);

  const handleTimerExpire = useCallback(() => {
    if (!session) return;
    submitSection(session, answers);
  }, [session, answers, submitSection]);

  const handleNext = () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(i => i - 1);
  };

  const handleSubmitSection = () => {
    if (!session) return;
    const unanswered = answers.filter(a => a === null).length;
    if (unanswered > 0 && !session.is_practice) {
      setSubmitWarning(`השארת ${unanswered} שאלות ללא מענה — תשובה ריקה נחשבת שגויה. לחץ שוב לאישור.`);
      return;
    }
    setSubmitWarning(null);
    submitSection(session, answers);
  };

  const handleConfirmSubmit = () => {
    if (!session) return;
    setSubmitWarning(null);
    submitSection(session, answers);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">{error}</div>
          <button onClick={loadSession} className="text-blue-600 underline">נסה שוב</button>
        </div>
      </div>
    );
  }

  if (!session || currentQuestions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-slate-400 text-lg">טוען מבחן...</div>
      </div>
    );
  }

  const question = currentQuestions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">מבחן אמירנ"ט</span>
              <span className="text-xs text-slate-500">
                פרק {currentSection} — {currentCfg?.type === 'sentence_completion' ? 'השלמת משפטים' :
                  currentCfg?.type === 'restatement' ? 'ניסוח מחדש' :
                  currentCfg?.type === 'reading_comprehension' ? 'הבנת הנקרא' : 'ESRA'}
                {currentCfg?.experimental && (
                  <span className="mr-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">ניסיוני</span>
                )}
              </span>
            </div>
            <ExamTimer
              expiresAt={session.current_section_expires_at}
              isPractice={session.is_practice}
              onExpire={handleTimerExpire}
            />
          </div>
          <div className="mt-3">
            <SectionProgress
              currentSection={currentSection}
              completedSections={completedSections}
            />
          </div>
        </div>
      </header>

      {/* Main exam area */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {currentCfg?.experimental && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-900">
            <span className="font-bold">פרק ניסיוני</span> — בדיוק כמו במבחן האמיתי: טעויות בפרק זה{' '}
            <span className="font-semibold">לא מורידות</span> את הציון, אבל תשובות נכונות יכולות{' '}
            <span className="font-semibold">להעלות</span> אותו. שווה להשקיע!
          </div>
        )}
        <QuestionCard
          question={question}
          questionNumber={currentQuestionIndex + 1}
          totalInSection={currentQuestions.length}
          selectedAnswer={answers[currentQuestionIndex] ?? null}
          onSelect={(idx) => handleAnswer(currentQuestionIndex, idx)}
          isPractice={session.is_practice}
          showResult={session.is_practice && lockedAnswers.has(currentQuestionIndex)}
        />

        {/* Inline submit warning */}
        {submitWarning && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between gap-3" dir="rtl">
            <p className="text-orange-800 text-sm">{submitWarning}</p>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setSubmitWarning(null)} className="text-xs px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-100">ביטול</button>
              <button onClick={handleConfirmSubmit} className="text-xs px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600">אישור</button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40 hover:bg-slate-100 transition-colors text-sm"
          >
            קודם &rsaquo;
          </button>

          {/* Question nav dots */}
          <div className="flex gap-2">
            {currentQuestions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQuestionIndex(i)}
                aria-label={`שאלה ${i + 1}${answers[i] === null ? ' — לא נענתה' : ''}`}
                className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  i === currentQuestionIndex ? 'bg-blue-600 text-white scale-110 ring-2 ring-blue-300' :
                  answers[i] !== null ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-400 border-2 border-dashed border-slate-300 hover:border-slate-400'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQuestionIndex < currentQuestions.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              &lsaquo; הבא
            </button>
          ) : (
            <button
              onClick={handleSubmitSection}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-sm font-bold disabled:opacity-60"
            >
              {isSubmitting ? 'שולח...' : currentSection < SECTION_CONFIGS.length ? 'סיים פרק →' : 'סיים מבחן ✓'}
            </button>
          )}
        </div>

        {/* Official AMIRNET guidance */}
        {!session.is_practice && (
          <p className="mt-6 text-center text-xs text-slate-400">
            שאלה ללא מענה נחשבת לתשובה שגויה — אם אינך בטוח, כדאי לנחש. אין קנס על טעות.
          </p>
        )}
      </main>
    </div>
  );
}
