'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { classifyScore, isCorrectAnswer, type Question, type QuestionType } from '@/types/exam';
import { estimateThetaEAP, thetaToScore, routeNextDifficulty } from '@/lib/adaptive';
import { BackNav } from '@/components/BackNav';
import { authFetch } from '@/lib/auth-fetch';
import { ensureGuestIdentity } from '@/lib/guest';
import { useActivityGuard } from '@/lib/activity-guard';
import { useCountdown } from '@/lib/use-countdown';
import { PenLine, RotateCcw, BookOpen, Dices, Target, PartyPopper, ThumbsUp, Check, X, type LucideIcon } from 'lucide-react';

type Step = 'pick-type' | 'pick-difficulty' | 'pick-count' | 'practicing' | 'done';
type Difficulty = 1 | 2 | 3 | 4 | 5 | 'random';

const TYPE_OPTIONS: { type: QuestionType; label: string; desc: string; icon: LucideIcon }[] = [
  { type: 'sentence_completion', label: 'השלמת משפטים', desc: 'בחר את המילה החסרה במשפט', icon: PenLine },
  { type: 'restatement',        label: 'ניסוח מחדש',   desc: 'זהה את המשמעות הזהה במשפט', icon: RotateCcw },
  { type: 'reading_comprehension', label: 'הבנת הנקרא', desc: 'קרא קטע וענה על שאלות הבנה', icon: BookOpen },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; sublabel: string; range: string }[] = [
  { value: 1, label: '1', sublabel: 'קל מאוד',  range: '50–84'   },
  { value: 2, label: '2', sublabel: 'קל',         range: '85–99'   },
  { value: 3, label: '3', sublabel: 'בינוני',     range: '100–119' },
  { value: 4, label: '4', sublabel: 'קשה',         range: '120–133' },
  { value: 5, label: '5', sublabel: 'קשה מאוד',  range: '134–150' },
  { value: 'random', label: '', sublabel: 'מעורב', range: 'מכל הרמות' },
];

// Authentic AMIRNET section format: question count + hard section timer
const SECTION_FORMAT: Record<QuestionType, { count: number; seconds: number }> = {
  sentence_completion: { count: 4, seconds: 240 },
  restatement: { count: 3, seconds: 360 },
  reading_comprehension: { count: 5, seconds: 900 },
  esra: { count: 4, seconds: 240 },
};

const EXAM_TIMER_SECONDS: Record<QuestionType, number> = {
  sentence_completion: 45,
  restatement: 50,
  reading_comprehension: 90,
  esra: 45,
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PracticePage() {
  return <Suspense fallback={<div className="p-8 text-center">טוען תרגול...</div>}><PracticeContent /></Suspense>;
}

function PracticeContent() {
  const params = useSearchParams();
  const requestedType = params.get('type');
  const initialType = TYPE_OPTIONS.some(option => option.type === requestedType) ? requestedType as QuestionType : null;
  const requestedDiff = params.get('difficulty');
  const initialDiff: Difficulty | null = initialType && requestedDiff
    ? requestedDiff === 'random' ? 'random' : Math.max(1, Math.min(5, parseInt(requestedDiff, 10) || 3)) as Difficulty
    : null;
  const router = useRouter();
  const { setInProgress } = useActivityGuard();

  const [step, setStep]               = useState<Step>(initialType ? initialDiff ? 'pick-count' : 'pick-difficulty' : 'pick-type');
  const [selectedType, setType]       = useState<QuestionType | null>(initialType);
  const [selectedDiff, setDiff]       = useState<Difficulty | null>(initialDiff);
  const [selectedCount, setCount]     = useState<5 | 10>(5);
  const [examMode, setExamMode]       = useState(false);
  const [sectionMode, setSectionMode] = useState(false);
  // Wall-clock deadline (epoch ms) for section mode — fed through the same
  // useCountdown hook the real exam's timer uses, so this "true exam
  // conditions" mode actually behaves like the real one (accurate across a
  // backgrounded tab) instead of a naive per-second decrement.
  const [sectionExpiresAt, setSectionExpiresAt] = useState<number | null>(null);

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]         = useState<(number | null)[]>([]);
  const [showResult, setShowResult]   = useState(false);
  const [reviewCount, setReviewCount] = useState<number | null>(null);

  // Guest identity is a signed, HttpOnly cookie the server issues — this
  // just makes sure it exists before the very first request on a page a
  // guest might land on directly, rather than racing authFetch's own
  // internal ensureGuestIdentity() call on the first fetch below. (The
  // server never trusts a client-supplied guestId, so there's no query
  // param to pass here — see src/lib/guest.ts.)
  useEffect(() => { ensureGuestIdentity().catch(() => {}); }, []);

  useEffect(() => {
    authFetch('/api/review-queue')
      .then(r => r.ok ? r.json() : null)
      .then((d: { count: number } | null) => { if (d?.count) setReviewCount(d.count); })
      .catch(() => {});
  }, []);

  // Flag mid-question activity so the bottom nav asks for a confirming
  // second tap before navigating away to a different category.
  useEffect(() => {
    setInProgress(step === 'practicing');
    return () => setInProgress(false);
  }, [step, setInProgress]);

  // Warn before an actual tab close/refresh/external navigation during a
  // timed section run — the in-app nav confirmation above (setInProgress)
  // only catches switching categories inside the app, not this. Section
  // mode has no server session or draft to resume from, so losing the tab
  // mid-section loses the whole run with no warning otherwise.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sectionMode && step === 'practicing') {
        e.preventDefault();
        e.returnValue = 'אם תצא עכשיו, ההתקדמות במקבץ לא תישמר. לצאת בכל זאת?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sectionMode, step]);

  // Exam mode timer
  // Wall-clock deadline (epoch ms) for the current question in exam mode —
  // reset to a fresh deadline every time the question changes.
  const [questionExpiresAt, setQuestionExpiresAt] = useState<number | null>(null);

  const fetchQuestions = async (overrideDiff?: Difficulty) => {
    setLoading(true);
    setError(null);
    const diff = overrideDiff ?? selectedDiff;
    try {
      const guestId = localStorage.getItem('amiret_guest_id') ?? '';
      const params = new URLSearchParams({
        type: selectedType!,
        difficulty: String(diff),
        count: String(selectedCount),
        ...(guestId ? { guestId } : {}),
      });
      const res = await authFetch(`/api/practice/questions?${params}`);
      if (!res.ok) {
        setError('לא נמצאו שאלות. נסה רמת קושי אחרת.');
        setLoading(false);
        return;
      }
      const data = await res.json() as { questions: Question[] };
      const qs = sectionMode && selectedType
        ? data.questions.slice(0, SECTION_FORMAT[selectedType].count)
        : data.questions;
      if (qs.length === 0) {
        // The request itself succeeded (200), but this exact type/difficulty
        // combination has no unseen questions left right now — a real,
        // recoverable state, not the generic "unexpected error" fallback.
        setError('לא נמצאו שאלות מתאימות. נסה רמת קושי או סוג שאלה אחרים.');
        setLoading(false);
        return;
      }
      setQuestions(qs);
      setAnswers(Array(qs.length).fill(null));
      setCurrentIndex(0);
      setShowResult(false);
      if (selectedType) {
        setSectionExpiresAt(Date.now() + SECTION_FORMAT[selectedType].seconds * 1000);
        setQuestionExpiresAt(Date.now() + EXAM_TIMER_SECONDS[selectedType] * 1000);
      }
      setStep('practicing');
    } catch {
      setError('שגיאת רשת. בדוק חיבור אינטרנט.');
    } finally {
      setLoading(false);
    }
  };

  // Learn mode only: back to the previous question (re-shown as already
  // answered, read-only), or to the difficulty picker from question 1 —
  // untimed and non-adaptive, so revisiting a past question is safe.
  const handlePrevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setShowResult(true);
    } else {
      setStep('pick-difficulty');
    }
  };

  const handleSelect = (optionIndex: number) => {
    if (showResult) return;
    // Section mode: answers stay editable until the section is submitted,
    // and spaced-repetition tracking happens once at the end.
    if (sectionMode) {
      const next = [...answers];
      next[currentIndex] = optionIndex;
      setAnswers(next);
      return;
    }
    // In exam mode, only allow one selection per question
    if (examMode && answers[currentIndex] !== null) return;
    const next = [...answers];
    next[currentIndex] = optionIndex;
    setAnswers(next);
    if (!examMode) {
      setShowResult(true);
    }
    // Track answers for spaced repetition (fire-and-forget)
    const isCorrect = questions[currentIndex] ? isCorrectAnswer(questions[currentIndex], optionIndex) : false;
    const guestId = localStorage.getItem('amiret_guest_id') ?? 'guest';
    authFetch('/api/review-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, questionId: questions[currentIndex].id, wasCorrect: isCorrect }),
    }).catch(() => {});
  };

  // Section mode: submit the whole section (manually or on timeout)
  const finishSection = useCallback(() => {
    const guestId = localStorage.getItem('amiret_guest_id') ?? 'guest';
    questions.forEach((q, i) => {
      authFetch('/api/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, questionId: q.id, wasCorrect: isCorrectAnswer(q, answers[i]) }),
      }).catch(() => {});
    });
    setStep('done');
    authFetch('/api/activity/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, source: 'practice' }),
    }).catch(() => {});

  }, [questions, answers]);

  // Section mode: one hard countdown for the whole section, like the real
  // exam — auto-submits via onExpire once, the same wall-clock-accurate
  // hook the real exam's ExamTimer uses.
  const sectionRemainingMs = useCountdown({
    expiresAt: step === 'practicing' && sectionMode && selectedType ? sectionExpiresAt : null,
    onExpire: finishSection,
  });
  const sectionTimeLeft = sectionRemainingMs === null ? (selectedType ? SECTION_FORMAT[selectedType].seconds : 0) : Math.round(sectionRemainingMs / 1000);

  const handleRestart = () => {
    setStep('pick-type');
    setType(null);
    setDiff(null);
    setCount(5);
    setQuestions([]);
    setAnswers([]);
    setError(null);
    setExamMode(false);
    setSectionMode(false);
  };

  const correctCount = answers.filter((a, i) => questions[i] && isCorrectAnswer(questions[i], a)).length;

  // Keyboard shortcuts: 1-4 = select option, Space/Enter = next question
  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      // Learn mode's "prev" can land on an already-answered question; moving
      // forward again must keep it locked/read-only (showResult=true) rather
      // than unconditionally reopening it for a second answer — this was
      // letting a re-picked answer overwrite the original and double-post to
      // the review queue.
      const nextIndex = currentIndex + 1;
      if (examMode && selectedType) setQuestionExpiresAt(Date.now() + EXAM_TIMER_SECONDS[selectedType] * 1000);
      setCurrentIndex(nextIndex);
      setShowResult(answers[nextIndex] !== null);
    } else {
      setStep('done');
      const guestId = localStorage.getItem('amiret_guest_id') ?? 'guest';
      authFetch('/api/activity/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, source: 'practice' }),
      }).catch(() => {});
    }
  }, [currentIndex, questions.length, answers, examMode, selectedType]);

  // Exam mode: per-question countdown, reset to a fresh deadline whenever
  // the question changes (questionExpiresAt is set both on first load and
  // by handleNext above). Auto-advances via onExpire — the hook's effect
  // naturally tears down the previous interval whenever expiresAt changes
  // (new question, or leaving the practicing step entirely), so no separate
  // "stop timer" effect is needed.
  const questionRemainingMs = useCountdown({
    expiresAt: step === 'practicing' && examMode && !sectionMode && selectedType ? questionExpiresAt : null,
    onExpire: handleNext,
  });
  const timeLeft = questionRemainingMs === null ? (selectedType ? EXAM_TIMER_SECONDS[selectedType] : 0) : Math.ceil(questionRemainingMs / 1000);

  useEffect(() => {
    if (step !== 'practicing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (examMode || sectionMode) {
        // Exam/section mode: number keys select answer
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < (questions[currentIndex]?.options.length ?? 0)) {
          handleSelect(idx);
        }
      } else {
        if (showResult) {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleNext(); }
        } else {
          const idx = parseInt(e.key) - 1;
          if (idx >= 0 && idx < (questions[currentIndex]?.options.length ?? 0)) {
            handleSelect(idx);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, showResult, currentIndex, questions, handleNext, examMode]);

  // ── Timer color helper ─────────────────────────────────────────────────────
  function timerColor(t: number): string {
    if (t < 10) return 'text-exam-wrong';
    if (t < 20) return 'text-exam-alt';
    return 'text-exam-sage-strong';
  }

  // ── Screens ────────────────────────────────────────────────────────────────

  if (step === 'pick-type') {
    return (
      <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-bold text-exam-ink mb-1">תרגול סעיף</h1>
          <p className="text-exam-ink-soft mb-8 text-sm">בחר את סוג השאלות שתרצה לתרגל</p>
          <div className="space-y-3">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.type}
                onClick={() => { setType(opt.type); setStep('pick-difficulty'); }}
                className={`w-full text-right p-5 bg-exam-surface rounded-md border transition-colors flex items-center gap-4 ${
                  selectedType === opt.type ? 'border-exam-accent ring-1 ring-exam-accent/30' : 'border-exam-border hover:border-exam-border-strong'
                }`}
              >
                <opt.icon className="w-8 h-8 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />
                <div>
                  <div className="font-bold text-exam-ink text-lg">{opt.label}</div>
                  <div className="text-exam-ink-soft text-sm">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Review queue */}
          <div className="mt-4">
            <button
              onClick={() => router.push('/review-queue')}
              className="w-full text-right p-6 bg-exam-alt-bg rounded-md border border-exam-alt/40 hover:border-exam-alt transition-colors flex items-center gap-4"
            >
              <RotateCcw className="w-7 h-7 text-exam-alt flex-shrink-0" strokeWidth={1.75} aria-hidden />
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-exam-alt">חזרה על טעויות</div>
                  {reviewCount !== null && (
                    <span className="px-2 py-0.5 bg-exam-alt text-white text-xs font-bold rounded-sm">{reviewCount}</span>
                  )}
                </div>
                <div className="text-sm text-exam-alt leading-relaxed">חזור על שאלות שטעית בהן — מערכת חזרה מרווחת</div>
              </div>
            </button>
          </div>

          {/* Vocabulary link */}
          <div className="mt-4 text-center">
            <Link
              href="/vocabulary"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-exam-surface rounded-sm border border-exam-border hover:border-exam-border-strong transition-colors text-sm text-exam-ink-soft hover:text-exam-ink"
            >
              <BookOpen className="w-4 h-4" strokeWidth={1.75} aria-hidden />
              <span>אוצר מילים — כרטיסיות לימוד</span>
            </Link>
          </div>
        </div>
        </div>
      </div>
    );
  }

  if (step === 'pick-difficulty') {
    return (
      <div className="min-h-screen bg-exam-paper flex flex-col items-center justify-center px-4 py-12" dir="rtl">
        <div className="w-full max-w-lg">
          <button onClick={() => setStep('pick-type')} className="text-exam-ink-soft text-sm mb-6 hover:text-exam-ink">
            ← חזרה
          </button>
          <h1 className="text-2xl font-bold text-exam-ink mb-1">רמת קושי</h1>
          <p className="text-exam-ink-soft mb-8 text-sm">בחר את רמת הקושי של השאלות</p>
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => {
                  setDiff(opt.value);
                  setStep('pick-count');
                }}
                className={`p-4 bg-exam-surface rounded-md border transition-colors text-center ${
                  selectedDiff === opt.value ? 'border-exam-accent ring-1 ring-exam-accent/30' : 'border-exam-border hover:border-exam-border-strong'
                }`}
              >
                <div className="text-2xl font-black text-exam-ink">
                  {opt.value === 'random' ? <Dices className="w-6 h-6 mx-auto" aria-hidden /> : opt.label}
                </div>
                <div className="text-xs font-semibold text-exam-ink mt-1">{opt.sublabel}</div>
                <div className="text-xs text-exam-ink-soft mt-0.5">{opt.range}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'pick-count') {
    return (
      <div className="min-h-screen bg-exam-paper flex flex-col items-center justify-center px-4 py-12" dir="rtl">
        <div className="w-full max-w-lg">
          <button onClick={() => setStep('pick-difficulty')} className="text-exam-ink-soft text-sm mb-6 hover:text-exam-ink">
            ← חזרה
          </button>
          <h1 className="text-2xl font-bold text-exam-ink mb-1">כמות שאלות</h1>
          <p className="text-exam-ink-soft mb-8 text-sm">כמה שאלות תרצה לתרגל?</p>
          {error && (
            <div className="mb-4 p-3 bg-exam-wrong-bg border border-exam-wrong/40 rounded-sm text-exam-wrong text-sm">{error}</div>
          )}
          <div className={`grid grid-cols-2 gap-4 ${sectionMode ? 'hidden' : ''}`}>
            {([5, 10] as const).map(n => (
              <button
                key={n}
                onClick={() => { setCount(n); }}
                className={`p-6 rounded-md border transition-colors text-center ${
                  selectedCount === n
                    ? 'border-exam-accent bg-exam-accent/10 text-exam-accent'
                    : 'border-exam-border bg-exam-surface text-exam-ink hover:border-exam-border-strong'
                }`}
              >
                <div className="text-4xl font-black">{n}</div>
                <div className="text-sm mt-1">שאלות</div>
              </button>
            ))}
          </div>

          {/* Practice mode selector */}
          <div className="mt-6 space-y-2">
            {[
              { id: 'learn', title: 'למידה', desc: 'הסבר מיידי אחרי כל תשובה — בקצב שלך', active: !examMode && !sectionMode, on: () => { setExamMode(false); setSectionMode(false); } },
              { id: 'perQ', title: 'אימון מהירות', desc: 'טיימר לכל שאלה בנפרד, הסברים בסוף', active: examMode && !sectionMode, on: () => { setExamMode(true); setSectionMode(false); } },
              { id: 'section', title: 'מקבץ בתנאי אמת', desc: selectedType ? `בדיוק כמו במבחן: ${SECTION_FORMAT[selectedType].count} שאלות ב-${SECTION_FORMAT[selectedType].seconds / 60} דקות, ניווט חופשי, הסברים בסוף` : '', active: sectionMode, on: () => { setExamMode(false); setSectionMode(true); } },
            ].map(m => (
              <button
                key={m.id}
                onClick={m.on}
                className={`w-full text-right p-4 rounded-md border transition-colors ${
                  m.active
                    ? 'border-exam-accent bg-exam-accent/10'
                    : 'border-exam-border bg-exam-surface hover:border-exam-border-strong'
                }`}
              >
                <div className={`font-bold ${m.active ? 'text-exam-accent' : 'text-exam-ink'}`}>{m.title}</div>
                <div className="text-xs text-exam-ink-soft mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchQuestions()}
            disabled={loading}
            className="mt-8 w-full py-4 bg-exam-accent text-exam-accent-ink rounded-sm font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? 'טוען...' : sectionMode ? 'התחל מקבץ אמיתי' : examMode ? 'התחל בחינה' : 'התחל תרגול'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'practicing' && questions.length > 0) {
    const question = questions[currentIndex];
    const isLast = currentIndex === questions.length - 1;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-bold text-exam-ink flex items-center gap-2 flex-wrap">
                <span className="whitespace-nowrap">{TYPE_OPTIONS.find(t => t.type === selectedType)?.label}</span>
                {examMode && (
                  <span className="text-xs bg-exam-alt-bg text-exam-alt px-2 py-0.5 rounded-sm font-semibold whitespace-nowrap flex-shrink-0">
                    מצב בחינה
                  </span>
                )}
                {sectionMode && (
                  <span className="text-xs bg-exam-accent/10 text-exam-accent px-2 py-0.5 rounded-sm font-semibold whitespace-nowrap flex-shrink-0">
                    מקבץ בתנאי אמת
                  </span>
                )}
              </div>
              <div className="text-xs text-exam-ink-soft">
                שאלה {currentIndex + 1} מתוך {questions.length}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Timer (exam mode only) */}
              {examMode && !sectionMode && (
                <div className={`font-mono text-xl font-black tabular-nums ${timerColor(timeLeft)}`}>
                  {formatTime(timeLeft)}
                </div>
              )}
              {/* Section timer — one hard countdown for the whole section */}
              {sectionMode && (
                <div className={`font-mono text-xl font-black tabular-nums ${sectionTimeLeft <= 30 ? 'text-exam-wrong' : sectionTimeLeft <= 60 ? 'text-exam-alt' : 'text-exam-ink'}`}>
                  {formatTime(sectionTimeLeft)}
                </div>
              )}

              {/* Progress dots — clickable free navigation in section mode */}
              {sectionMode ? (
                <div className="flex gap-1.5">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentIndex(i)}
                      aria-label={`שאלה ${i + 1}`}
                      className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                        i === currentIndex ? 'bg-exam-accent text-exam-accent-ink ring-2 ring-exam-accent/30' :
                        answers[i] !== null ? 'bg-exam-accent/10 text-exam-accent' :
                        'bg-exam-paper-alt text-exam-ink-soft border border-dashed border-exam-border-strong'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              ) : (
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i < currentIndex
                        ? isCorrectAnswer(questions[i], answers[i]) ? 'bg-exam-sage-strong' : 'bg-exam-wrong'
                        : i === currentIndex ? 'bg-exam-accent' : 'bg-exam-border'
                    }`}
                  />
                ))}
              </div>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <QuestionCard
            question={question}
            questionNumber={currentIndex + 1}
            totalInSection={questions.length}
            selectedAnswer={answers[currentIndex] ?? null}
            onSelect={handleSelect}
            isPractice={!examMode && !sectionMode}
            showResult={examMode || sectionMode ? false : showResult}
            hideHeader
          />

          {/* Normal (learn) mode: back to previous question / picker + next */}
          {!examMode && !sectionMode && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={handlePrevQuestion}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                {currentIndex === 0 ? '← לרמת קושי' : 'קודם ›'}
              </button>
              {showResult && (
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  {isLast ? <span className="inline-flex items-center gap-1.5">ראה תוצאות <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span> : 'שאלה הבאה ‹'}
                </button>
              )}
            </div>
          )}

          {/* Section mode: free prev/next + finish */}
          {sectionMode && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
              >
                קודם ›
              </button>
              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
                  className="px-4 py-2 rounded-sm bg-exam-accent text-exam-accent-ink hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  ‹ הבא
                </button>
              ) : (
                <button
                  onClick={finishSection}
                  className="px-5 py-2 rounded-sm bg-exam-sage-strong text-white hover:opacity-90 transition-opacity text-sm font-bold"
                >
                  <span className="inline-flex items-center gap-1.5">סיים מקבץ <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span>
                </button>
              )}
            </div>
          )}

          {/* Exam mode: show Next button only after answer selected */}
          {examMode && !sectionMode && answers[currentIndex] !== null && (
            <div className="mt-6 flex justify-start">
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                {isLast ? <span className="inline-flex items-center gap-1.5">סיים בחינה <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span> : 'שאלה הבאה ‹'}
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (step === 'done') {
    const pct = Math.round((correctCount / questions.length) * 100);
    const color = pct >= 80 ? 'text-exam-sage-strong' : pct >= 60 ? 'text-exam-alt' : 'text-exam-wrong';

    // Level diagnosis via IRT — same 3PL model the adaptive exam uses.
    // Most meaningful in mixed mode, where questions span all 5 levels.
    const hasIrtParams = questions.every(q => isFinite(q.a) && isFinite(q.b) && isFinite(q.c));
    const diagTheta = hasIrtParams
      ? estimateThetaEAP(
          questions.map(q => ({ a: q.a, b: q.b, c: q.c })),
          questions.map((q, i) => (isCorrectAnswer(q, answers[i]) ? 1 : 0)),
        )
      : null;
    const diagScore = diagTheta !== null ? thetaToScore(diagTheta) : null;
    const diagLevel = diagTheta !== null ? routeNextDifficulty(diagTheta) : null;
    const diagClass = diagScore !== null ? classifyScore(diagScore) : null;

    return (
      <div className="min-h-screen bg-exam-paper px-4 py-8" dir="rtl">
        <div className="max-w-2xl mx-auto">
          {/* Score summary */}
          <div className="text-center space-y-4 mb-10">
            {pct >= 80 ? <PartyPopper className="w-14 h-14 mx-auto text-exam-sage-strong" strokeWidth={1.5} aria-hidden /> : pct >= 60 ? <ThumbsUp className="w-14 h-14 mx-auto text-exam-alt" strokeWidth={1.5} aria-hidden /> : <BookOpen className="w-14 h-14 mx-auto text-exam-ink-soft" strokeWidth={1.5} aria-hidden />}
            {(examMode || sectionMode) && (
              <div className="inline-block bg-exam-alt-bg text-exam-alt text-sm font-bold px-3 py-1 rounded-sm">
                {sectionMode ? 'תוצאת מקבץ בתנאי אמת' : 'תוצאת מצב בחינה'}
              </div>
            )}
            <div>
              <div className={`text-5xl font-black ${color}`}>{correctCount}/{questions.length}</div>
              <div className="text-slate-500 dark:text-slate-400 mt-1 text-lg">{pct}% נכון</div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
              {pct >= 80 && 'מצוין! אתה שולט בחומר הזה.'}
              {pct >= 60 && pct < 80 && 'טוב! עוד קצת תרגול ותגיע לשלמות.'}
              {pct < 60 && 'כדאי לחזור על החומר הזה ולתרגל שוב.'}
              {questions.length - correctCount > 0 && (
                <div className="mt-2 text-slate-400 dark:text-slate-500 text-xs">
                  {questions.length - correctCount} טעויות מתוך {questions.length} שאלות
                </div>
              )}
            </div>

            {/* Level diagnosis — IRT-based, like the real adaptive exam */}
            {diagLevel !== null && diagScore !== null && diagClass !== null && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 text-right">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-slate-700 dark:text-slate-200" strokeWidth={1.75} aria-hidden />
                  <span className="font-bold text-slate-900 dark:text-white">אבחון רמה</span>
                  {selectedDiff === 'random' && (
                    <span className="text-xs bg-exam-accent/10 text-exam-accent px-2 py-0.5 rounded-sm font-semibold">רמה מעורבת</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">הרמה המשוערת שלך</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">רמה {diagLevel}/5</div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-slate-500 dark:text-slate-400">אומדן פנימי</div>
                    <div className={`text-2xl font-black ${diagClass.color}`}>~{diagScore}</div>
                    <div className={`text-xs font-semibold ${diagClass.color}`}>{diagClass.label}</div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  הערכה סטטיסטית לפי מודל ה-IRT הפנימי של האתר — מבוססת על {questions.length} שאלות בלבד ואינה ציון רשמי של מאל&quot;ו.
                  {selectedDiff !== 'random' && ' לאומדן רחב יותר, תרגל ברמה מעורבת או בצע את סימולציית פרקי הליבה.'}
                  {' '}סף הפטור/הרמה עצמו נקבע בנפרד בכל מוסד — {diagClass.label} הוא הטווח הנפוץ, לא תקן מחייב אחיד.
                </p>
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={handleRestart}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                תרגול נוסף
              </button>
              <button
                onClick={() => router.push('/exam')}
                className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-300 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                חזרה לתפריט
              </button>
            </div>
          </div>

          {/* Exam mode: full question review with explanations */}
          {(examMode || sectionMode) && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-3">
                סקירת שאלות והסברים
              </h2>
              {questions.map((q, i) => {
                const isCorrect = isCorrectAnswer(q, answers[i]);
                return (
                  <div
                    key={q.id ?? i}
                    className={`rounded-md border overflow-hidden ${
                      isCorrect ? 'border-exam-sage/40' : 'border-exam-wrong/40'
                    }`}
                  >
                    {/* Status bar */}
                    <div className={`px-4 py-2 text-sm font-bold flex items-center gap-2 ${
                      isCorrect
                        ? 'bg-exam-sage-bg text-exam-sage-strong'
                        : 'bg-exam-wrong-bg text-exam-wrong'
                    }`}>
                      {isCorrect ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />}
                      <span>שאלה {i + 1}</span>
                      {answers[i] === null && (
                        <span className="text-exam-ink-soft font-normal">(לא נענתה — פג הזמן)</span>
                      )}
                    </div>
                    <div className="bg-white dark:bg-slate-800">
                      <QuestionCard
                        question={q}
                        questionNumber={i + 1}
                        totalInSection={questions.length}
                        selectedAnswer={answers[i] ?? null}
                        onSelect={() => {}}
                        isPractice={true}
                        showResult={true}
                        hideHeader
                      />
                    </div>
                  </div>
                );
              })}

              {/* Bottom action buttons repeated for convenience */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={handleRestart}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  תרגול נוסף
                </button>
                <button
                  onClick={() => router.push('/exam')}
                  className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-300 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  חזרה לתפריט
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading / error fallback
  return (
    <div className="min-h-screen bg-exam-paper flex items-center justify-center" dir="rtl">
      {loading
        ? <div className="text-exam-ink-soft">טוען שאלות...</div>
        : <div className="text-center">
            <div className="text-exam-wrong mb-3">{error ?? 'שגיאה לא צפויה'}</div>
            <button onClick={handleRestart} className="text-exam-accent underline text-sm">נסה שוב</button>
          </div>
      }
    </div>
  );
}
