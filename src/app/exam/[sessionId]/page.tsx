'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExamTimer } from '@/components/exam/ExamTimer';
import { PaceGauge } from '@/components/exam/PaceGauge';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { SectionProgress } from '@/components/exam/SectionProgress';
import { SECTION_CONFIGS, type Question } from '@/types/exam';
import { authFetch } from '@/lib/auth-fetch';
import { clearExamDraft, readExamDraft, writeExamDraft } from '@/lib/exam-draft';
import { heCount } from '@/lib/hebrew-count';
import { focusedControlOwnsKey } from '@/lib/keyboard-shortcuts';
import { ExamProgressSaver, lateNoticeText, saveResultFromStatus, type Answers } from '@/lib/exam-progress';

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

const EMPTY_QUESTIONS: Question[] = [];

// Prev · question dots · next fits on one line only above a width that grows
// with the dot count (measured at the last question, where "סיים פרק" is
// widest: 3 dots 336px, 4 dots 382px, 5 dots 416px). Below it the dots move
// to their own centered line, so the page never scrolls sideways (WCAG 1.4.10).
// Literal class strings, so Tailwind generates each container query.
const NAV_DOTS_STACK: Record<number, string> = {
  3: '@max-[21rem]:order-first @max-[21rem]:w-full @max-[21rem]:justify-center',
  4: '@max-[24rem]:order-first @max-[24rem]:w-full @max-[24rem]:justify-center',
  5: '@max-[26rem]:order-first @max-[26rem]:w-full @max-[26rem]:justify-center',
};

export default function ExamPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<SessionState | null>(null);
  // Estimated serverClock - clientClock, so the section timer counts down
  // to the true (server) deadline instead of this device's own clock — see
  // loadSession and /api/exam/state's serverNow.
  const [clockSkewMs, setClockSkewMs] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  // Set when the previous section reached the server after its deadline:
  // how many of the answers sent then didn't count (they weren't saved in time).
  const [lateNotice, setLateNotice] = useState<{ notCounted: number } | null>(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  // The exit confirmation opens above the question; move focus there so a
  // keyboard / screen-reader user lands on it (the safe "stay" choice).
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (exitConfirm) stayButtonRef.current?.focus(); }, [exitConfirm]);

  // Practice mode: track which question indices have been answered (locked)
  const [lockedAnswers, setLockedAnswers] = useState<Set<number>>(new Set());

  // Pace tracking: seconds spent per question in the current section
  const timingsRef = useRef<number[]>([]);
  const lastTickRef = useRef<number>(0);
  const prevIndexRef = useRef(0);

  // In-section answers only reach the server on section submit, so a
  // refresh / closed tab / dead network mid-section used to lose them while
  // the server timer kept running. Mirror every pick to localStorage and
  // restore it on load; the draft is dropped once the section is submitted.
  const readDraft = useCallback((section: number, count: number) => {
    try { return readExamDraft(localStorage, sessionId, section, count); } catch { return null; }
  }, [sessionId]);
  const writeDraft = useCallback((section: number, arr: (number | null)[]) => {
    try { writeExamDraft(localStorage, sessionId, section, arr); } catch { /* Storage unavailable. */ }
  }, [sessionId]);
  const clearDraft = useCallback((section: number) => {
    try { clearExamDraft(localStorage, sessionId, section); } catch { /* Storage unavailable. */ }
  }, [sessionId]);

  // Every pick is also saved to the server while the section runs
  // (src/lib/exam-progress.ts), so the answers chosen in time survive a
  // locked phone or an app switch — the frozen page's auto-submit then
  // arrives late, and a late section is scored on what was saved in time.
  // One saver per section; timed exams only.
  const saverRef = useRef<{ section: number; saver: ExamProgressSaver } | null>(null);
  const progressSaver = useCallback((section: number) => {
    if (saverRef.current?.section !== section) {
      saverRef.current?.saver.stop();
      saverRef.current = {
        section,
        saver: new ExamProgressSaver({
          send: (answers: Answers) => authFetch('/api/exam/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, sectionIndex: section, answers }),
            // Survives the page being frozen or closed right after the pick.
            keepalive: true,
          }).then(res => saveResultFromStatus(res.status)),
        }),
      };
    }
    return saverRef.current.saver;
  }, [sessionId]);
  const stopProgressSaver = useCallback(() => {
    saverRef.current?.saver.stop();
    saverRef.current = null;
  }, []);
  useEffect(() => stopProgressSaver, [stopProgressSaver]);

  // Locking the screen or switching apps hides the page just before the
  // phone freezes it: the last chance to get unsaved picks to the server.
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') saverRef.current?.saver.flush(); };
    const onPageHide = () => saverRef.current?.saver.flush();
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // Load or recover session state from server
  const loadSession = useCallback(() => {
    const requestStartedAt = Date.now();
    return authFetch(`/api/exam/state?sessionId=${sessionId}`).then(async res => {
    if (res.status === 429) { setError('יותר מדי בקשות בזמן קצר. חכה כדקה ולחץ "נסה שוב".'); return; }
    if (!res.ok) { setError('לא הצלחנו לטעון את המבחן'); return; }
    const data = await res.json() as { session: SessionState; serverNow?: string };

    if (data.serverNow) {
      // Round-trip midpoint estimate (like NTP): assume the server's
      // timestamp was generated halfway through this request's flight time.
      const roundTripMs = Date.now() - requestStartedAt;
      const assumedServerSampleAt = requestStartedAt + roundTripMs / 2;
      setClockSkewMs(new Date(data.serverNow).getTime() - assumedServerSampleAt);
    }

    if (data.session.completed_at) {
      router.replace(`/results/${sessionId}`);
      return;
    }

    const section = data.session.current_section_index;
    const existingAnswers = (data.session.answers_by_section as Record<number, (number | null)[]>)[section];
    const questionCount = (data.session.questions_by_section as Record<number, Question[]>)[section]?.length ?? 0;

    setError(null);
    setSession(data.session);
    // This device's draft is never older than the server's copy (every pick
    // is written here first), so it wins; then the server's in-progress
    // copy (another device, cleared storage); then a blank section.
    const restored: (number | null)[] = readDraft(section, questionCount) ?? existingAnswers ?? Array(questionCount).fill(null);
    setAnswers(restored);
    // Picks the server may not have yet (a save failed before the reload).
    if (!data.session.is_practice && restored.some(a => a !== null)) progressSaver(section).save(restored);

    // Reset pace tracking for the new section
    timingsRef.current = [];
    lastTickRef.current = Date.now();
    prevIndexRef.current = 0;

    }).catch(() => {
      setError('לא הצלחנו להתחבר. בדוק את החיבור ונסה שוב.');
    });
  }, [sessionId, router, readDraft, progressSaver]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const currentSection = session?.current_section_index ?? 1;
  const currentCfg = SECTION_CONFIGS[currentSection - 1];
  const currentQuestions = session?.questions_by_section[currentSection] ?? EMPTY_QUESTIONS;
  const completedSections = session
    ? Object.keys(session.answers_by_section).map(Number).filter(n => n < currentSection)
    : [];

  // Accumulate time on the question we just left
  useEffect(() => {
    const now = Date.now();
    const prev = prevIndexRef.current;
    timingsRef.current[prev] = (timingsRef.current[prev] ?? 0) + (now - (lastTickRef.current || now)) / 1000;
    lastTickRef.current = now;
    prevIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  // Warn before leaving mid-exam (non-practice only)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session && !session.is_practice && !session.completed_at) {
        e.preventDefault();
        e.returnValue = 'אם תצא עכשיו, ההתקדמות במבחן לא תישמר. לצאת בכל זאת?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  const handleAnswer = useCallback((questionIndex: number, optionIndex: number) => {
    if (isSubmittingRef.current) return;
    setAnswers(prev => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      if (session) {
        writeDraft(session.current_section_index, next);
        if (!session.is_practice) progressSaver(session.current_section_index).save(next);
      }
      return next;
    });
    if (session?.is_practice) {
      setLockedAnswers(prev => new Set([...prev, questionIndex]));
    }
  }, [session, writeDraft, progressSaver]);

  // Keyboard shortcuts: 1-4 select answer, Enter/Space go next question
  useEffect(() => {
    if (!session || currentQuestions.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      // Enter/Space on a focused button (סיים פרק, יציאה, קודם…) is that button's.
      if (focusedControlOwnsKey(e.target, e.key)) return;
      if (isSubmittingRef.current) return;
      const locked = session.is_practice && lockedAnswers.has(currentQuestionIndex);
      const idx = parseInt(e.key) - 1;
      if (!locked && idx >= 0 && idx < currentQuestions[currentQuestionIndex]?.options.length) {
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
  }, [session, currentQuestions, currentQuestionIndex, answers, lockedAnswers, handleAnswer]);

  const submitSection = useCallback(async (sess: SessionState, sectionAnswers: (number | null)[]) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const requestBody = JSON.stringify({
        sessionId: sess.id,
        sectionIndex: sess.current_section_index,
        answers: sectionAnswers,
        // Millisecond precision (as fractional seconds) — the server keeps
        // the raw value for the responses log and rounds for display.
        timings: sectionAnswers.map((_, i) => Math.round(1000 * (
          (timingsRef.current[i] ?? 0) + (i === prevIndexRef.current ? (Date.now() - lastTickRef.current) / 1000 : 0)
        )) / 1000),
      });

      // A shared-IP rate limit (school computer lab, office) shouldn't be
      // allowed to strand someone mid-section while the server-side timer
      // keeps counting toward the late-submission grace window — retry a
      // couple of times with a short backoff before giving up and showing
      // the dead-end error.
      let res: Response;
      let attempt = 0;
      while (true) {
        res = await authFetch('/api/exam/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody,
        });
        if (res.status !== 429 || attempt >= 2) break;
        attempt++;
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }

      if (res.status === 429) {
        setError('יותר מדי בקשות בזמן קצר, והתשובות שלך לא נשלחו. חכה כדקה ולחץ "נסה שוב".');
        return;
      }
      if (res.status === 409) {
        // This section was already processed (double submit / second tab /
        // timed-out retry). The server is the source of truth — resync.
        stopProgressSaver();
        clearDraft(sess.current_section_index);
        await loadSession();
        setCurrentQuestionIndex(0);
        setLockedAnswers(new Set());
        return;
      }
      if (!res.ok) {
        setError('לא הצלחנו לשלוח את התשובות. נסה שוב.');
        return;
      }

      const data = await res.json() as { isComplete: boolean; nextSectionIndex: number; nextExpiresAt: string; lateSubmission?: boolean; notCountedAnswers?: number };
      stopProgressSaver();
      clearDraft(sess.current_section_index);
      setLateNotice(data.lateSubmission ? { notCounted: data.notCountedAnswers ?? 0 } : null);

      if (data.isComplete) {
        router.push(`/results/${sess.id}`);
      } else {
        // Refresh session state and reset practice tracking
        await loadSession();
        setCurrentQuestionIndex(0);
        setLockedAnswers(new Set());
      }
    } catch {
      setError('לא הצלחנו לשלוח את התשובות. נסה שוב.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [loadSession, router, clearDraft, stopProgressSaver]);

  const handleTimerExpire = useCallback(() => {
    if (!session) return;
    submitSection(session, answers);
  }, [session, answers, submitSection]);

  const handleNext = () => {
    if (isSubmittingRef.current) return;
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
    }
  };

  const handlePrev = () => {
    if (isSubmittingRef.current) return;
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(i => i - 1);
  };

  const handleSubmitSection = () => {
    if (!session) return;
    const unanswered = answers.filter(a => a === null).length;
    // NITE rule: a section cannot be ended while questions are still blank —
    // only the timer moves you on. Practice mode stays free.
    if (unanswered > 0 && !session.is_practice) {
      setSubmitWarning(
        `${unanswered === 1 ? 'נשארה שאלה אחת שלא ענית עליה' : `נשארו ${heCount(unanswered, 'question')} שלא ענית עליהן`}. כמו במבחן האמיתי, אי אפשר לסיים פרק לפני שעונים על כולן. ואם לא יודעים, מנחשים.`
      );
      return;
    }
    setSubmitWarning(null);
    submitSection(session, answers);
  };

  const [isExiting, setIsExiting] = useState(false);
  const handleConfirmExit = async () => {
    setIsExiting(true);
    try {
      const response = await authFetch(`/api/exam/state?sessionId=${sessionId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Discard failed');
      stopProgressSaver();
      for (let i = 1; i <= SECTION_CONFIGS.length; i++) clearDraft(i);
      router.push('/');
    } catch {
      setError('לא הצלחנו לבטל את המבחן. ההתקדמות נשמרה; נסה שוב.');
      setExitConfirm(false);
    } finally {
      setIsExiting(false);
    }
  };

  if (error) {
    return (
      <main id="main" className="min-h-dvh flex items-center justify-center bg-exam-paper" dir="rtl">
        <div className="text-center">
          <div role="alert" className="text-exam-wrong text-xl mb-4 font-sans">{error}</div>
          <button onClick={loadSession} className="text-exam-ink underline font-sans">נסה שוב</button>
        </div>
      </main>
    );
  }

  if (!session || currentQuestions.length === 0) {
    return (
      <main id="main" className="min-h-dvh flex items-center justify-center bg-exam-paper" dir="rtl">
        <div role="status" className="text-exam-ink-soft text-lg font-sans">טוען מבחן...</div>
      </main>
    );
  }

  const question = currentQuestions[currentQuestionIndex];

  return (
    <div className="min-h-dvh bg-exam-paper font-sans" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => setExitConfirm(true)}
              disabled={isSubmitting}
              aria-label="יציאה מהמבחן"
              className="hit-44 flex-shrink-0 w-8 h-8 rounded-sm border border-exam-border text-exam-ink-soft hover:bg-exam-paper-alt hover:text-exam-ink transition-colors flex items-center justify-center disabled:opacity-40"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
            <div className="flex flex-col flex-1">
              <h1 className="text-sm font-bold text-exam-ink">סימולציית פרקי הליבה</h1>
              <span className="text-xs text-exam-ink-soft">
                פרק {currentSection} — {currentCfg?.type === 'sentence_completion' ? 'השלמת משפטים' :
                  currentCfg?.type === 'restatement' ? 'ניסוח מחדש' :
                  currentCfg?.type === 'reading_comprehension' ? 'הבנת הנקרא' : 'אנגלית ESRA'}
                {currentCfg?.experimental && (
                  <span className="mr-1 px-1.5 py-0.5 rounded-sm bg-exam-alt-bg text-exam-alt font-semibold">תרגול חלופי</span>
                )}
              </span>
              {!session.is_practice && currentCfg && (
                <div className="mt-1 h-6 flex items-center">
                  {/* Height reserved up front: the gauge appears mid-section without shifting the page. */}
                  {/* Keyed by section: a new section starts with a clean slate. */}
                  <PaceGauge
                    key={currentSection}
                    type={currentCfg.type}
                    durationSec={currentCfg.durationSeconds}
                    expiresAt={session.current_section_expires_at}
                    clockSkewMs={clockSkewMs}
                    answered={answers.filter(a => a !== null).length}
                    total={currentQuestions.length}
                  />
                </div>
              )}
            </div>
            <ExamTimer
              expiresAt={session.current_section_expires_at}
              isPractice={session.is_practice}
              clockSkewMs={clockSkewMs}
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
      <main id="main" className="max-w-2xl mx-auto px-4 py-8">
        {/* Exit confirmation */}
        {exitConfirm && (
          <div role="alert" className="mb-6 p-4 bg-exam-wrong-bg border border-exam-wrong/40 rounded-sm" dir="rtl">
            <p className="text-exam-wrong text-sm font-semibold mb-3">
              לצאת מהמבחן? ההתקדמות בו לא תישמר, ותוכל להתחיל מבחן חדש מתי שתרצה.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmExit}
                disabled={isSubmitting || isExiting}
                className="px-4 py-2 rounded-sm bg-exam-wrong text-on-danger text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isExiting ? 'יוצא...' : 'כן, לצאת מהמבחן'}
              </button>
              <button
                ref={stayButtonRef}
                onClick={() => setExitConfirm(false)}
                disabled={isExiting}
                className="px-4 py-2 rounded-sm border border-exam-border text-exam-ink-soft text-sm hover:bg-exam-paper-alt transition-colors disabled:opacity-50"
              >
                המשך במבחן
              </button>
            </div>
          </div>
        )}

        {lateNotice && (
          <div role="status" className="mb-6 p-3 bg-exam-alt-bg border border-exam-alt/40 rounded-sm text-sm text-exam-alt flex items-center justify-between gap-3" dir="rtl">
            <span>{lateNoticeText(lateNotice.notCounted)}</span>
            <button onClick={() => setLateNotice(null)} className="text-xs underline flex-shrink-0">הבנתי</button>
          </div>
        )}
        {currentCfg?.experimental && (
          <div className="mb-6 p-4 bg-exam-alt-bg border border-exam-alt/40 rounded-sm text-sm text-exam-ink">
            <p>
              <span className="font-bold">תרגול חלופי: לא חלק מהדמיית הליבה.</span> בבחינת אמירנ&quot;ט
              הפרקים האחרונים עשויים להיות שני פרקים ניסיוניים מסוגים חדשים, או מטלת כתיבה אחת.
              האתר עדיין לא מדמה את סוגי השמע, יצירת המילים, הדקדוק בהקשר או הכתיבה. התרגול החלופי כאן{' '}
              <span className="font-semibold">לא מוריד</span> את האומדן הפנימי, ותשובות נכונות יכולות{' '}
              <span className="font-semibold">להעלות</span> אותו במעט (עד 2 נקודות).
            </p>
            <button
              onClick={() => session && submitSection(session, answers)}
              disabled={isSubmitting}
              className="hit-44 mt-3 px-4 py-2 rounded-sm border border-exam-alt/50 text-exam-alt text-sm font-semibold hover:bg-exam-alt-bg transition-colors disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1">דלג על התרגול החלופי וסיים<ChevronLeft className="w-4 h-4" aria-hidden /></span>
            </button>
          </div>
        )}
        <div className={isSubmitting ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
          <QuestionCard
            question={question}
            questionNumber={currentQuestionIndex + 1}
            totalInSection={currentQuestions.length}
            selectedAnswer={answers[currentQuestionIndex] ?? null}
            onSelect={(idx) => handleAnswer(currentQuestionIndex, idx)}
            isPractice={session.is_practice}
            showResult={session.is_practice && lockedAnswers.has(currentQuestionIndex)}
          />
        </div>
        {/* Always mounted so the "sending" message is announced. */}
        <div role="status">
          {isSubmitting && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-exam-ink-soft" dir="rtl">
              <span className="w-4 h-4 border-2 border-exam-border border-t-exam-ink rounded-full animate-spin" aria-hidden />
              שולח את הפרק וטוען את הבא. רגע אחד...
            </div>
          )}
        </div>

        {/* Inline submit warning */}
        {submitWarning && (
          <div role="alert" className="mt-4 p-3 bg-exam-alt-bg border border-exam-alt/40 rounded-sm flex items-center justify-between gap-3" dir="rtl">
            <p className="text-exam-alt text-sm">{submitWarning}</p>
            <button onClick={() => setSubmitWarning(null)} className="hit-44 text-xs px-3 py-1.5 rounded-sm border border-exam-alt/50 text-exam-alt hover:bg-exam-alt-bg flex-shrink-0">הבנתי</button>
          </div>
        )}

        {/* Navigation */}
        <div className="@container mt-8">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0 || isSubmitting}
            className="hit-44 px-4 py-2 rounded-sm border border-exam-border text-exam-ink-soft disabled:opacity-40 hover:bg-exam-paper-alt transition-colors text-sm"
          >
            <span className="inline-flex items-center gap-1"><ChevronRight className="w-4 h-4" aria-hidden />קודם</span>
          </button>

          {/* Question nav dots */}
          <div className={`flex gap-2 ${NAV_DOTS_STACK[currentQuestions.length] ?? NAV_DOTS_STACK[5]}`}>
            {currentQuestions.map((_, i) => (
              <button
                key={i}
                onClick={() => { if (!isSubmitting) setCurrentQuestionIndex(i); }}
                disabled={isSubmitting}
                aria-label={`שאלה ${i + 1}${answers[i] === null ? ', עוד לא ענית' : ''}`}
                aria-current={i === currentQuestionIndex ? 'step' : undefined}
                className={`hit-44 w-8 h-8 rounded-sm text-xs font-bold transition-colors disabled:opacity-40 border ${
                  i === currentQuestionIndex ? 'bg-exam-accent border-exam-accent text-exam-accent-ink' :
                  answers[i] !== null ? 'bg-exam-paper-alt border-exam-border text-exam-ink' :
                  'bg-exam-surface text-exam-ink-soft border-dashed border-exam-border hover:border-exam-border-strong'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQuestionIndex < currentQuestions.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="hit-44 px-4 py-2 rounded-sm bg-exam-accent text-exam-accent-ink hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1">הבא<ChevronLeft className="w-4 h-4" aria-hidden /></span>
            </button>
          ) : (
            <button
              onClick={handleSubmitSection}
              disabled={isSubmitting}
              className="hit-44 px-5 py-2 rounded-sm bg-exam-sage-strong text-on-emerald hover:opacity-90 transition-opacity text-sm font-bold disabled:opacity-60"
            >
              {isSubmitting ? 'שולח...' : currentSection < SECTION_CONFIGS.length ? <span className="inline-flex items-center gap-1">סיים פרק<ChevronLeft className="w-4 h-4" aria-hidden /></span> : (
              <span className="inline-flex items-center gap-1.5">סיים מבחן <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span>
            )}
            </button>
          )}
        </div>
        </div>

        {/* Official AMIRNET guidance */}
        {!session.is_practice && (
          <p className="mt-6 text-center text-xs text-exam-ink-soft">
            שאלה שלא ענית עליה נספרת כטעות, ואין קנס על טעות. אז אם אינך בטוח, נחש.
          </p>
        )}
      </main>
    </div>
  );
}
