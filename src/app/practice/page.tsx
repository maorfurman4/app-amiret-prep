'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { classifyScore, isCorrectAnswer, type Question, type QuestionType } from '@/types/exam';
import { estimateThetaEAP, thetaToScore, routeNextDifficulty, itemIrtParams } from '@/lib/adaptive';
import { BackNav } from '@/components/BackNav';
import { authFetch } from '@/lib/auth-fetch';
import { ensureGuestIdentity } from '@/lib/guest';
import { useActivityGuard } from '@/lib/activity-guard';
import { useCountdown } from '@/lib/use-countdown';
import { DwellTimer, logResponses, responseEntry } from '@/lib/response-log-client';
import { pickContextualTip } from '@/lib/strategy-tip';
import { ContextualStrategyCard } from '@/components/strategies/ContextualStrategyCard';
import { ErrorCauseTagger } from '@/components/exam/ErrorCauseTagger';
import { PaceGauge } from '@/components/exam/PaceGauge';
import type { ResponseLogEntry } from '@/lib/response-log-client';
import { PenLine, RotateCcw, BookOpen, Dices, Target, PartyPopper, ThumbsUp, Check, X, Shuffle, type LucideIcon, ChevronLeft, ChevronRight, ArrowRight, Plus, Minus, Info } from 'lucide-react';
import { heCount } from '@/lib/hebrew-count';
import { focusedControlOwnsKey } from '@/lib/keyboard-shortcuts';
import {
  MIXED_DEFAULT, MIXED_LIMITS, MIXED_PRESETS, RC_PER_PASSAGE,
  interleaveMixed, planIsValid, planMinutes, planQuestionCount, samePlan,
  type MixedPlan, type MixedTypeKey,
} from '@/lib/mixed-practice';
import { SessionStreakCelebration } from '@/components/home/StreakCelebration';

type Step = 'pick-type' | 'pick-difficulty' | 'pick-count' | 'starting' | 'practicing' | 'done';
type Difficulty = 1 | 2 | 3 | 4 | 5 | 'random';
// A real question type, or the UI-only "mixed" option that interleaves all
// of them in one session (see /api/practice/questions' `mixed` branch).
type PracticeType = QuestionType | 'mixed';

const TYPE_OPTIONS: { type: PracticeType; label: string; desc: string; icon: LucideIcon }[] = [
  { type: 'sentence_completion', label: 'השלמת משפטים', desc: 'בחר את המילה החסרה במשפט', icon: PenLine },
  { type: 'restatement',        label: 'ניסוח מחדש',   desc: 'מצא את המשפט שאומר אותו הדבר', icon: RotateCcw },
  { type: 'reading_comprehension', label: 'הבנת הנקרא', desc: 'קרא קטע וענה על שאלות הבנה', icon: BookOpen },
  { type: 'mixed', label: 'מעורב סוגים', desc: 'כל סוגי השאלות באותו תרגול. הכי קרוב למבחן האמיתי', icon: Shuffle },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; sublabel: string; range: string }[] = [
  { value: 1, label: '1', sublabel: 'קל מאוד',  range: '50–84'   },
  { value: 2, label: '2', sublabel: 'קל',         range: '85–99'   },
  { value: 3, label: '3', sublabel: 'בינוני',     range: '100–119' },
  { value: 4, label: '4', sublabel: 'קשה',         range: '120–133' },
  { value: 5, label: '5', sublabel: 'קשה מאוד',  range: '134–150' },
  { value: 'random', label: '', sublabel: 'מעורב', range: 'מכל הרמות' },
];

// Authentic AMIRNET section format: question count + hard section timer.
// "מקבץ בתנאי אמת" (section mode) is disabled for mixed type in the UI —
// a real exam section is always one question type — so the `mixed` entry
// here only exists to satisfy the Record type; it's never actually read.
const SECTION_FORMAT: Record<PracticeType, { count: number; seconds: number }> = {
  sentence_completion: { count: 4, seconds: 240 },
  restatement: { count: 3, seconds: 360 },
  reading_comprehension: { count: 5, seconds: 900 },
  esra: { count: 4, seconds: 240 },
  mixed: { count: 8, seconds: 480 },
};

// Speed-mode seconds per question. A mixed session times each question by
// its own type (see questionSeconds) — the `mixed` entry is only a fallback.
const EXAM_TIMER_SECONDS: Record<PracticeType, number> = {
  sentence_completion: 45,
  restatement: 50,
  reading_comprehension: 90,
  esra: 45,
  mixed: 55,
};

function questionSeconds(practiceType: PracticeType, question: Question | undefined): number {
  return EXAM_TIMER_SECONDS[practiceType === 'mixed' && question ? question.type : practiceType];
}

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
  const initialType = TYPE_OPTIONS.some(option => option.type === requestedType) ? requestedType as PracticeType : null;
  const requestedDiff = params.get('difficulty');
  const initialDiff: Difficulty | null = initialType && requestedDiff
    ? requestedDiff === 'random' ? 'random' : Math.max(1, Math.min(5, parseInt(requestedDiff, 10) || 3)) as Difficulty
    : null;
  // start=1 (e.g. the diagnostic's "Start here"): type + level are already
  // decided, so skip the count picker and go straight into a default
  // 5-question learn-mode session.
  const autoStart = params.get('start') === '1' && initialType !== null && initialType !== 'mixed' && initialDiff !== null;
  const router = useRouter();
  const { setInProgress } = useActivityGuard();

  const [step, setStep]               = useState<Step>(autoStart ? 'starting' : initialType ? initialDiff ? 'pick-count' : 'pick-difficulty' : 'pick-type');
  const [selectedType, setType]       = useState<PracticeType | null>(initialType);
  const [selectedDiff, setDiff]       = useState<Difficulty | null>(initialDiff);
  const [selectedCount, setCount]     = useState<5 | 10>(5);
  // Mixed only: how many of each type (rc in passages) — replaces the 5/10 count.
  const [mixPlan, setMixPlan]         = useState<MixedPlan>(MIXED_DEFAULT);
  // Mixed only: set when a pool couldn't fill the requested mix.
  const [mixNotice, setMixNotice]     = useState<string | null>(null);
  const [examMode, setExamMode]       = useState(false);
  const [sectionMode, setSectionMode] = useState(false);
  // Wall-clock deadline (epoch ms) for section mode — fed through the same
  // useCountdown hook the real exam's timer uses, so this "true exam
  // conditions" mode actually behaves like the real one (accurate across a
  // backgrounded tab) instead of a naive per-second decrement.
  const [sectionExpiresAt, setSectionExpiresAt] = useState<number | null>(null);

  const [loading, setLoading]         = useState(autoStart);
  const [error, setError]             = useState<string | null>(null);
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]         = useState<(number | null)[]>([]);
  const [showResult, setShowResult]   = useState(false);
  const [reviewCount, setReviewCount] = useState<number | null>(null);
  // Logged entries by question id — the client ref lets a later error-cause
  // tag find its row (see ErrorCauseTagger).
  const [logged, setLogged] = useState<Record<string, Pick<ResponseLogEntry, 'clientRef' | 'latencyMs'>>>({});
  const logAnswers = useCallback((entries: ResponseLogEntry[]) => {
    logResponses(entries);
    setLogged(prev => ({ ...prev, ...Object.fromEntries(entries.map(e => [e.itemId, { clientRef: e.clientRef, latencyMs: e.latencyMs }])) }));
  }, []);

  // Per-question time on screen, for the responses log's latency.
  const dwellRef = useRef(new DwellTimer());
  useEffect(() => {
    dwellRef.current.focus(step === 'practicing' ? questions[currentIndex]?.id ?? null : null);
  }, [step, currentIndex, questions]);

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
    const isMixed = selectedType === 'mixed';
    if (isMixed && !planIsValid(mixPlan)) {
      setError(planQuestionCount(mixPlan) === 0 ? 'בחר לפחות שאלה אחת' : `עד ${MIXED_LIMITS.total} שאלות בתרגול אחד`);
      return;
    }
    setLoading(true);
    setError(null);
    setMixNotice(null);
    const diff = overrideDiff ?? selectedDiff;
    try {
      const guestId = localStorage.getItem('amiret_guest_id') ?? '';
      // Section mode always trims the response down to the real AMIRNET
      // section size (SECTION_FORMAT), which is smaller than the count
      // picker's own choice for sentence_completion/restatement (4/3 vs.
      // the 5/10 the picker offers — RC already returns exactly 5 either
      // way, so it never needs this). Without deferSeen, the server would
      // mark every fetched question seen before the trim happens, burning
      // the trimmed-off surplus from the pool for questions the student
      // never actually saw.
      const deferSeen = sectionMode && selectedType && selectedType !== 'reading_comprehension';
      const params = new URLSearchParams({
        type: selectedType!,
        difficulty: String(diff),
        count: String(selectedCount),
        ...(isMixed ? { sc: String(mixPlan.sc), rs: String(mixPlan.rs), rc: String(mixPlan.rc) } : {}),
        ...(guestId ? { guestId } : {}),
        ...(deferSeen ? { deferSeen: '1' } : {}),
      });
      const res = await authFetch(`/api/practice/questions?${params}`);
      if (!res.ok) {
        setError('לא נמצאו שאלות. נסה רמת קושי אחרת.');
        setLoading(false);
        return;
      }
      const data = await res.json() as { questions: Question[]; mix?: { requested: MixedPlan; served: MixedPlan } };
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
      if (deferSeen) {
        authFetch('/api/practice/questions/mark-seen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: qs.map(q => q.id) }),
        }).catch(() => {});
      }
      if (data.mix) setMixNotice(mixShortfallNotice(data.mix.requested, data.mix.served));
      dwellRef.current.reset();
      setQuestions(qs);
      setAnswers(Array(qs.length).fill(null));
      setCurrentIndex(0);
      setShowResult(false);
      if (selectedType) {
        setSectionExpiresAt(Date.now() + SECTION_FORMAT[selectedType].seconds * 1000);
        setQuestionExpiresAt(Date.now() + questionSeconds(selectedType, qs[0]) * 1000);
      }
      setStep('practicing');
    } catch {
      setError('אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // Deferred a microtask so the fetch's own state updates land outside the
  // effect body (loading already starts true for an auto-start). The ref
  // keeps a re-run effect (StrictMode) from fetching — and marking seen —
  // a second batch.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    Promise.resolve().then(() => fetchQuestions());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSelect = useCallback((optionIndex: number) => {
    if (showResult) return;
    // Section mode: answers stay editable until the section is submitted,
    // and spaced-repetition tracking happens once at the end.
    if (sectionMode) {
      setAnswers(prev => {
        const next = [...prev];
        next[currentIndex] = optionIndex;
        return next;
      });
      return;
    }
    // In exam mode, only allow one selection per question
    if (examMode && answers[currentIndex] !== null) return;
    setAnswers(prev => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
    if (!examMode) {
      setShowResult(true);
    }
    // Logging the answer also feeds spaced repetition (server-side).
    const answered = questions[currentIndex];
    if (answered) logAnswers([responseEntry(answered, optionIndex, 'practice', dwellRef.current.elapsedMs(answered.id))]);
  }, [showResult, sectionMode, examMode, answers, currentIndex, questions, logAnswers]);

  // Section mode: submit the whole section (manually or on timeout)
  const finishSection = useCallback(() => {
    // Every question in the section is logged, blanks included — same as a
    // real exam section, where an unanswered item was still presented.
    // Logging also feeds spaced repetition (server-side).
    logAnswers(questions.map((q, i) =>
      responseEntry(q, answers[i], 'practice', dwellRef.current.elapsedMs(q.id))));
    setStep('done');
  }, [questions, answers, logAnswers]);

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
    setMixPlan(MIXED_DEFAULT);
    setMixNotice(null);
    setQuestions([]);
    setAnswers([]);
    setError(null);
    setExamMode(false);
    setSectionMode(false);
  };

  const correctCount = answers.filter((a, i) => questions[i] && isCorrectAnswer(questions[i], a)).length;

  // Keyboard shortcuts: 1-4 = select option, Space/Enter = next question
  const handleNext = useCallback(() => {
    // Speed mode advances on timeout even with no answer — the question was
    // still presented, so it's logged as a blank.
    const leaving = questions[currentIndex];
    if (examMode && !sectionMode && leaving && answers[currentIndex] === null) {
      logAnswers([responseEntry(leaving, null, 'practice', dwellRef.current.elapsedMs(leaving.id))]);
    }
    if (currentIndex < questions.length - 1) {
      // Learn mode's "prev" can land on an already-answered question; moving
      // forward again must keep it locked/read-only (showResult=true) rather
      // than unconditionally reopening it for a second answer — this was
      // letting a re-picked answer overwrite the original and double-post to
      // the review queue.
      const nextIndex = currentIndex + 1;
      if (examMode && selectedType) setQuestionExpiresAt(Date.now() + questionSeconds(selectedType, questions[nextIndex]) * 1000);
      setCurrentIndex(nextIndex);
      setShowResult(answers[nextIndex] !== null);
    } else {
      setStep('done');
    }
  }, [currentIndex, questions, answers, examMode, sectionMode, selectedType, logAnswers]);

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
  const timeLeft = questionRemainingMs === null ? (selectedType ? questionSeconds(selectedType, questions[currentIndex]) : 0) : Math.ceil(questionRemainingMs / 1000);

  useEffect(() => {
    if (step !== 'practicing') return;
    const onKey = (e: KeyboardEvent) => {
      if (focusedControlOwnsKey(e.target, e.key)) return;
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
  }, [step, showResult, currentIndex, questions, handleNext, handleSelect, examMode, sectionMode]);

  // ── Timer color helper ─────────────────────────────────────────────────────
  function timerColor(t: number): string {
    if (t < 10) return 'text-exam-wrong';
    if (t < 20) return 'text-exam-alt';
    return 'text-exam-sage-strong';
  }

  // ── Screens ────────────────────────────────────────────────────────────────

  if (step === 'pick-type') {
    return (
      <div className="min-h-dvh bg-exam-paper flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <main id="main" className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-bold text-exam-ink mb-1">תרגול סעיף</h1>
          <p className="text-exam-ink-soft mb-8 text-sm">בחר את סוג השאלות שתרצה לתרגל</p>
          <div className="space-y-3">
            {TYPE_OPTIONS.map((opt, i) => (
              <button
                key={opt.type}
                onClick={() => { setType(opt.type); setStep('pick-difficulty'); }}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`w-full text-right p-5 bg-exam-surface rounded-2xl border shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform flex items-center gap-4 animate-fade-up ${
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
          <div className="mt-4 animate-fade-up [animation-delay:210ms]">
            <button
              onClick={() => router.push('/review-queue')}
              className="w-full text-right p-6 bg-exam-alt-bg rounded-2xl border border-exam-alt/40 shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] hover:border-exam-alt transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform flex items-center gap-4"
            >
              <RotateCcw className="w-7 h-7 text-exam-alt flex-shrink-0" strokeWidth={1.75} aria-hidden />
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-exam-alt">חזרה על טעויות</div>
                  {reviewCount !== null && (
                    <span className="px-2 py-0.5 bg-exam-alt text-on-amber text-xs font-bold rounded-sm">{reviewCount}</span>
                  )}
                </div>
                <div className="text-sm text-exam-alt leading-relaxed">שאלות שטעית בהן חוזרות אליך במרווחים שמותאמים לזיכרון</div>
              </div>
            </button>
          </div>

          {/* Vocabulary link */}
          <div className="mt-4 text-center animate-fade-up [animation-delay:280ms]">
            <Link
              href="/vocabulary"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-exam-surface rounded-2xl border border-exam-border shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] hover:border-exam-border-strong transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform text-sm text-exam-ink-soft hover:text-exam-ink"
            >
              <BookOpen className="w-4 h-4" strokeWidth={1.75} aria-hidden />
              <span>אוצר מילים: כרטיסיות לימוד</span>
            </Link>
          </div>
        </div>
        </main>
      </div>
    );
  }

  if (step === 'pick-difficulty') {
    return (
      <main id="main" className="min-h-dvh bg-exam-paper flex flex-col items-center justify-center px-4 py-12" dir="rtl">
        <div className="w-full max-w-lg">
          <button
            onClick={() => {
              // Mode flags are type-specific (SECTION_FORMAT/EXAM_TIMER_SECONDS
              // are keyed by type) — carrying sectionMode/examMode back into a
              // fresh type pick let a stale sectionMode=true reach the "mixed"
              // type, whose section-mode UI is filtered out but whose state
              // was never actually cleared. Reset here, same as handleRestart
              // does when it lands on this same step.
              setExamMode(false);
              setSectionMode(false);
              setStep('pick-type');
            }}
            className="text-exam-ink-soft text-sm mb-6 hover:text-exam-ink"
          >
            <span className="inline-flex items-center gap-1"><ArrowRight className="w-4 h-4" aria-hidden />חזרה</span>
          </button>
          <h1 className="text-2xl font-bold text-exam-ink mb-1">רמת קושי</h1>
          <p className="text-exam-ink-soft mb-8 text-sm">בחר את רמת הקושי של השאלות</p>
          {/* A scale reads low → high, left → right, even inside the RTL page. */}
          <div dir="ltr" className="grid grid-cols-3 gap-3">
            {DIFFICULTY_OPTIONS.map((opt, i) => (
              <button
                key={String(opt.value)}
                dir="rtl"
                onClick={() => {
                  setDiff(opt.value);
                  setStep('pick-count');
                }}
                style={{ animationDelay: `${i * 50}ms` }}
                className={`p-4 bg-exam-surface rounded-2xl border shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.95] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform text-center animate-fade-up ${
                  selectedDiff === opt.value ? 'border-exam-accent ring-1 ring-exam-accent/30' : 'border-exam-border hover:border-exam-border-strong'
                }`}
              >
                <div className="text-2xl font-bold text-exam-ink">
                  {opt.value === 'random' ? <Dices className="w-6 h-6 mx-auto" aria-hidden /> : opt.label}
                </div>
                <div className="text-xs font-semibold text-exam-ink mt-1">{opt.sublabel}</div>
                <div className="text-xs text-exam-ink-soft mt-0.5"><bdi dir="ltr">{opt.range}</bdi></div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (step === 'pick-count') {
    return (
      <main id="main" className="min-h-dvh bg-exam-paper flex flex-col items-center justify-center px-4 py-12" dir="rtl">
        <div className="w-full max-w-lg">
          <button onClick={() => setStep('pick-difficulty')} className="text-exam-ink-soft text-sm mb-6 hover:text-exam-ink">
            <span className="inline-flex items-center gap-1"><ArrowRight className="w-4 h-4" aria-hidden />חזרה</span>
          </button>
          <h1 className="text-2xl font-bold text-exam-ink mb-1">{selectedType === 'mixed' ? 'הרכב התרגול' : 'כמות שאלות'}</h1>
          <p className="text-exam-ink-soft mb-8 text-sm">
            {selectedType === 'mixed' ? 'כמה מכל סוג? ברירת המחדל שומרת על היחס שבמבחן' : 'כמה שאלות תרצה לתרגל?'}
          </p>
          {error && (
            <div role="alert" className="mb-4 p-3 bg-exam-wrong-bg border border-exam-wrong/40 rounded-sm text-exam-wrong text-sm">{error}</div>
          )}
          {selectedType === 'mixed' ? (
            <MixedPlanPicker plan={mixPlan} onChange={p => { setMixPlan(p); setError(null); }} />
          ) : (
          <div className={`grid grid-cols-2 gap-4 ${sectionMode ? 'hidden' : ''}`}>
            {([5, 10] as const).map((n, i) => (
              <button
                key={n}
                onClick={() => { setCount(n); }}
                style={{ animationDelay: `${i * 60}ms` }}
                className={`p-6 rounded-2xl border shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform text-center animate-fade-up ${
                  selectedCount === n
                    ? 'border-exam-accent bg-exam-accent/10 text-exam-accent'
                    : 'border-exam-border bg-exam-surface text-exam-ink hover:border-exam-border-strong'
                }`}
              >
                <div className="text-4xl font-bold">{n}</div>
                <div className="text-sm mt-1">שאלות</div>
              </button>
            ))}
          </div>
          )}

          {/* Practice mode selector */}
          <div className="mt-6 space-y-2">
            {[
              { id: 'learn', title: 'למידה', desc: 'הסבר מיידי אחרי כל תשובה, בקצב שלך', active: !examMode && !sectionMode, on: () => { setExamMode(false); setSectionMode(false); } },
              { id: 'perQ', title: 'אימון מהירות', desc: 'טיימר לכל שאלה בנפרד, הסברים בסוף', active: examMode && !sectionMode, on: () => { setExamMode(true); setSectionMode(false); } },
              // A real exam section is always a single question type, so
              // "true exam conditions" mode doesn't map onto a mixed-type
              // session — filtered out below rather than shown disabled.
              ...(selectedType !== 'mixed' ? [{ id: 'section', title: 'מקבץ בתנאי אמת', desc: selectedType ? `בדיוק כמו במבחן: ${SECTION_FORMAT[selectedType].count} שאלות ב-${SECTION_FORMAT[selectedType].seconds / 60} דקות, ניווט חופשי, הסברים בסוף` : '', active: sectionMode, on: () => { setExamMode(false); setSectionMode(true); } }] : []),
            ].map((m, i) => (
              <button
                key={m.id}
                onClick={m.on}
                style={{ animationDelay: `${120 + i * 60}ms` }}
                className={`w-full text-right p-4 rounded-2xl border shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform animate-fade-up ${
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
            className="mt-8 w-full py-4 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-bold text-lg transition-[opacity,box-shadow,transform] duration-300 ease-spring will-change-transform disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-raised"
          >
            {loading ? 'טוען...' : sectionMode ? 'התחל מקבץ אמיתי' : examMode ? 'התחל בחינה' : 'התחל תרגול'}
          </button>
        </div>
      </main>
    );
  }

  if (step === 'practicing' && questions.length > 0) {
    const question = questions[currentIndex];
    const isLast = currentIndex === questions.length - 1;

    return (
      <div className="min-h-dvh bg-exam-paper" dir="rtl">
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
              {sectionMode && selectedType && sectionExpiresAt !== null && (
                <div className="mt-1 h-6 flex items-center">
                  {/* Height reserved up front: the gauge appears mid-section without shifting the page. */}
                  <PaceGauge
                    type={selectedType}
                    durationSec={SECTION_FORMAT[selectedType].seconds}
                    expiresAt={new Date(sectionExpiresAt).toISOString()}
                    answered={answers.filter(a => a !== null).length}
                    total={questions.length}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Timer (exam mode only) */}
              {examMode && !sectionMode && (
                <div className={`font-mono text-xl font-bold tabular-nums ${timerColor(timeLeft)}`}>
                  {formatTime(timeLeft)}
                </div>
              )}
              {/* Section timer — one hard countdown for the whole section */}
              {sectionMode && (
                <div className={`font-mono text-xl font-bold tabular-nums ${sectionTimeLeft <= 30 ? 'text-exam-wrong' : sectionTimeLeft <= 60 ? 'text-exam-alt' : 'text-exam-ink'}`}>
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

        <main id="main" className="max-w-2xl mx-auto px-4 py-8">
          {mixNotice && (
            <div role="status" className="mb-6 flex items-start gap-2 p-3 bg-exam-alt-bg border border-exam-alt/40 rounded-xl text-exam-alt text-sm">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
              <p className="flex-1 leading-relaxed">{mixNotice}</p>
              <button
                onClick={() => setMixNotice(null)}
                aria-label="סגור הודעה"
                className="hit-44 -m-1 p-1 rounded-sm hover:bg-exam-alt/10 flex-shrink-0"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          )}
          <QuestionCard
            question={question}
            questionNumber={currentIndex + 1}
            totalInSection={questions.length}
            selectedAnswer={answers[currentIndex] ?? null}
            onSelect={handleSelect}
            isPractice={!examMode && !sectionMode}
            showResult={examMode || sectionMode ? false : showResult}
            hideHeader
            premium
          />

          {!examMode && !sectionMode && showResult && !isCorrectAnswer(question, answers[currentIndex] ?? null) && logged[question.id] && (
            <ErrorCauseTagger
              key={question.id}
              target={{ clientRef: logged[question.id].clientRef }}
              questionType={question.type}
              latencyMs={logged[question.id].latencyMs}
            />
          )}

          {/* Normal (learn) mode: back to previous question / picker + next */}
          {!examMode && !sectionMode && (
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={handlePrevQuestion}
                className="hit-44 px-4 py-2 rounded-xl border border-exam-border text-exam-ink-soft hover:bg-exam-paper-alt hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-[background-color,transform] duration-300 ease-spring will-change-transform text-sm"
              >
                {<span className="inline-flex items-center gap-1"><ChevronRight className="w-4 h-4" aria-hidden />{currentIndex === 0 ? 'לרמת קושי' : 'קודם'}</span>}
              </button>
              {showResult && (
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] font-bold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
                >
                  {isLast ? <span className="inline-flex items-center gap-1.5">ראה תוצאות <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span> : <span className="inline-flex items-center gap-1">שאלה הבאה<ChevronLeft className="w-4 h-4" aria-hidden /></span>}
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
                className="px-4 py-2 rounded-xl border border-exam-border text-exam-ink-soft disabled:opacity-40 hover:bg-exam-paper-alt hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-[background-color,transform] duration-300 ease-spring will-change-transform text-sm"
              >
                <span className="inline-flex items-center gap-1"><ChevronRight className="w-4 h-4" aria-hidden />קודם</span>
              </button>
              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
                  className="px-4 py-2 rounded-xl bg-exam-accent text-exam-accent-ink shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-[box-shadow,transform] duration-300 ease-spring will-change-transform text-sm font-medium"
                >
                  <span className="inline-flex items-center gap-1">הבא<ChevronLeft className="w-4 h-4" aria-hidden /></span>
                </button>
              ) : (
                <button
                  onClick={finishSection}
                  className="px-5 py-2 rounded-xl bg-exam-sage-strong text-on-emerald shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-[box-shadow,transform] duration-300 ease-spring will-change-transform text-sm font-bold"
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
                className="px-6 py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.97] font-bold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
              >
                {isLast ? <span className="inline-flex items-center gap-1.5">סיים בחינה <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span> : <span className="inline-flex items-center gap-1">שאלה הבאה<ChevronLeft className="w-4 h-4" aria-hidden /></span>}
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
    const hasIrtParams = questions.every(q => isFinite(q.b));
    const diagTheta = hasIrtParams
      ? estimateThetaEAP(
          questions.map(itemIrtParams),
          questions.map((q, i) => (isCorrectAnswer(q, answers[i]) ? 1 : 0)),
        )
      : null;
    const diagScore = diagTheta !== null ? thetaToScore(diagTheta) : null;
    const diagLevel = diagTheta !== null ? routeNextDifficulty(diagTheta) : null;
    const diagClass = diagScore !== null ? classifyScore(diagScore) : null;
    const strategyTip = pickContextualTip(
      questions.map((q, i) => ({ id: q.id, type: q.type, correct: isCorrectAnswer(q, answers[i]) })),
    );

    return (
      <main id="main" className="min-h-dvh bg-exam-paper px-4 py-8" dir="rtl">
        <SessionStreakCelebration />
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
              <div className={`text-5xl font-bold ${color}`}>{correctCount}/{questions.length}</div>
              <div className="text-exam-ink-soft mt-1 text-lg">{pct}% תשובות נכונות</div>
            </div>
            <div className="bg-exam-surface rounded-2xl shadow-surface border border-exam-border p-4 text-sm text-exam-ink-soft">
              {pct >= 80 && 'מצוין! אתה שולט בחומר הזה.'}
              {pct >= 60 && pct < 80 && 'טוב! עוד קצת תרגול ותגיע לשלמות.'}
              {pct < 60 && 'כדאי לחזור על החומר הזה ולתרגל שוב.'}
              {questions.length - correctCount > 0 && (
                <div className="mt-2 text-exam-ink-soft text-xs">
                  {questions.length - correctCount === 1 ? `טעית בשאלה אחת מתוך ${questions.length}` : `טעית ב-${questions.length - correctCount} מתוך ${questions.length} שאלות`}
                </div>
              )}
            </div>

            {/* Level diagnosis — IRT-based, like the real adaptive exam */}
            {diagLevel !== null && diagScore !== null && diagClass !== null && (
              <div className="bg-exam-surface rounded-2xl shadow-surface border border-exam-border p-5 text-right">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-exam-ink" strokeWidth={1.75} aria-hidden />
                  <span className="font-bold text-exam-ink">אבחון רמה</span>
                  {selectedDiff === 'random' && (
                    <span className="text-xs bg-exam-accent/10 text-exam-accent px-2 py-0.5 rounded-sm font-semibold">רמה מעורבת</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-exam-ink-soft">הרמה המשוערת שלך</div>
                    <div className="text-2xl font-bold text-exam-ink">רמה {diagLevel}/5</div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-exam-ink-soft">אומדן פנימי</div>
                    <div className={`text-2xl font-bold ${diagClass.color}`}><bdi dir="ltr">~{diagScore}</bdi></div>
                    <div className={`text-xs font-semibold ${diagClass.color}`}>{diagClass.label}</div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-exam-ink-soft">
                  הערכה סטטיסטית לפי מודל ה-IRT הפנימי של האתר, על סמך {heCount(questions.length, 'question')} בלבד. זה לא ציון רשמי של מאל&quot;ו.
                  {selectedDiff !== 'random' && ' לאומדן מדויק יותר, תרגל ברמה מעורבת או עשה סימולציה של פרקי הליבה.'}
                  {' '}כל מוסד קובע בעצמו את הסף לפטור ולכל רמה; {diagClass.label} הוא הטווח הנפוץ.
                </p>
              </div>
            )}

            {strategyTip && <ContextualStrategyCard tip={strategyTip} />}

            <div className="space-y-3">
              <button
                onClick={handleRestart}
                className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-bold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
              >
                תרגול נוסף
              </button>
              <button
                onClick={() => router.push('/exam')}
                className="w-full py-3 bg-exam-surface border border-exam-border text-exam-ink rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] hover:bg-exam-paper-alt font-medium transition-[background-color,box-shadow,transform] duration-300 ease-spring will-change-transform"
              >
                חזרה לתפריט
              </button>
            </div>
          </div>

          {/* Exam mode: full question review with explanations */}
          {(examMode || sectionMode) && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-exam-ink border-b border-exam-border pb-3">
                סקירת שאלות והסברים
              </h2>
              {questions.map((q, i) => {
                const isCorrect = isCorrectAnswer(q, answers[i]);
                return (
                  <div
                    key={q.id ?? i}
                    style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                    className={`rounded-2xl border shadow-surface overflow-hidden animate-fade-up ${
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
                        <span className="text-exam-ink-soft font-normal">(לא ענית, הזמן נגמר)</span>
                      )}
                    </div>
                    <div className="bg-exam-surface">
                      <QuestionCard
                        question={q}
                        questionNumber={i + 1}
                        totalInSection={questions.length}
                        selectedAnswer={answers[i] ?? null}
                        onSelect={() => {}}
                        isPractice={true}
                        showResult={true}
                        hideHeader
                        premium
                      />
                      {!isCorrect && logged[q.id] && (
                        <div className="px-4 pb-4">
                          <ErrorCauseTagger
                            target={{ clientRef: logged[q.id].clientRef }}
                            questionType={q.type}
                            latencyMs={logged[q.id].latencyMs}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Bottom action buttons repeated for convenience */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={handleRestart}
                  className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-bold transition-[box-shadow,transform] duration-300 ease-spring will-change-transform"
                >
                  תרגול נוסף
                </button>
                <button
                  onClick={() => router.push('/exam')}
                  className="w-full py-3 bg-exam-surface border border-exam-border text-exam-ink rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] hover:bg-exam-paper-alt font-medium transition-[background-color,box-shadow,transform] duration-300 ease-spring will-change-transform"
                >
                  חזרה לתפריט
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Loading / error fallback
  return (
    <main id="main" className="min-h-dvh bg-exam-paper flex items-center justify-center" dir="rtl">
      {loading
        ? <div className="text-exam-ink-soft">טוען שאלות...</div>
        : <div className="text-center">
            <div className="text-exam-wrong mb-3">{error ?? 'משהו השתבש. נסה שוב.'}</div>
            <button onClick={handleRestart} className="text-exam-accent underline text-sm">נסה שוב</button>
          </div>
      }
    </main>
  );
}

const PASSAGE_NOUN = { one: 'קטע', many: 'קטעים', gender: 'm' } as const;

// `max` and `unit` render as "<bdi>0–max</bdi> unit" — the range is isolated
// so the RTL line doesn't flip it into "12–0".
const MIX_ROWS: { key: MixedTypeKey; label: string; unit: string }[] = [
  { key: 'sc', label: 'השלמת משפטים', unit: 'שאלות' },
  { key: 'rs', label: 'ניסוח מחדש', unit: 'שאלות' },
  { key: 'rc', label: 'הבנת הנקרא', unit: `קטעים · ${RC_PER_PASSAGE} שאלות לקטע` },
];

// Swatches for the sample-order strip, one per type.
const MIX_SWATCH: Record<MixedTypeKey, { cls: string; letter: string }> = {
  sc: { cls: 'bg-exam-accent/10 text-exam-accent', letter: 'ה' },
  rs: { cls: 'bg-exam-sage-bg text-exam-sage-strong', letter: 'נ' },
  rc: { cls: 'bg-exam-alt-bg text-exam-alt', letter: 'ק' },
};

/** "Served fewer than asked" copy for a mixed session, or null when it's full. */
function mixShortfallNotice(requested: MixedPlan, served: MixedPlan): string | null {
  const short = MIX_ROWS
    .filter(r => served[r.key] < requested[r.key])
    .map(r => `${r.label} ${served[r.key]} מתוך ${requested[r.key]}`);
  if (short.length === 0) return null;
  return `לא נמצאו מספיק שאלות לכל ההרכב שבחרת, ולכן התרגול קצר יותר: ${short.join(', ')}.`;
}

/**
 * Mixed practice's count step: a stepper per type (reading comprehension in
 * whole passages), presets scaled from the exam's own mix, and a live total.
 */
function MixedPlanPicker({ plan, onChange }: { plan: MixedPlan; onChange: (plan: MixedPlan) => void }) {
  const total = planQuestionCount(plan);
  const overCap = (next: MixedPlan) => planQuestionCount(next) > MIXED_LIMITS.total;
  const step = (key: MixedTypeKey, delta: number) => {
    const next = { ...plan, [key]: Math.max(0, Math.min(MIXED_LIMITS[key], plan[key] + delta)) };
    if (!overCap(next)) onChange(next);
  };
  // Some type still has room under its own limit but the total cap blocks it.
  const capReached = MIX_ROWS.some(r => plan[r.key] < MIXED_LIMITS[r.key] && overCap({ ...plan, [r.key]: plan[r.key] + 1 }));
  const order = interleaveMixed(
    Array<MixedTypeKey>(plan.sc).fill('sc'),
    Array<MixedTypeKey>(plan.rs).fill('rs'),
    Array.from({ length: plan.rc }, () => Array<MixedTypeKey>(RC_PER_PASSAGE).fill('rc')),
    () => 0,
  );

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap gap-2 mb-4">
        {MIXED_PRESETS.map(p => {
          const active = samePlan(plan, p.plan);
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.plan)}
              aria-pressed={active}
              className={`hit-44 px-3 py-1.5 rounded-xl border text-sm transition-[background-color,border-color] duration-300 ease-spring ${
                active ? 'border-exam-accent bg-exam-accent/10 text-exam-accent font-semibold' : 'border-exam-border bg-exam-surface text-exam-ink-soft hover:border-exam-border-strong'
              }`}
            >
              {p.label} <bdi dir="ltr" className="tabular-nums">{p.plan.sc}·{p.plan.rs}·{p.plan.rc}</bdi>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {MIX_ROWS.map(row => {
          const value = plan[row.key];
          const canAdd = value < MIXED_LIMITS[row.key] && !overCap({ ...plan, [row.key]: value + 1 });
          return (
            <div key={row.key} className="flex items-center justify-between gap-3 p-4 bg-exam-surface rounded-2xl border border-exam-border shadow-surface">
              <div className="min-w-0">
                <div className="font-bold text-exam-ink">{row.label}</div>
                <div className="text-xs text-exam-ink-soft"><bdi dir="ltr">0–{MIXED_LIMITS[row.key]}</bdi> {row.unit}</div>
              </div>
              {/* A count reads low → high, left → right, like the difficulty scale. */}
              <div dir="ltr" className="flex items-center gap-1 flex-shrink-0" role="group" aria-label={row.label}>
                <button
                  onClick={() => step(row.key, -1)}
                  disabled={value === 0}
                  aria-label={`פחות ${row.label}`}
                  className="w-11 h-11 rounded-full border border-exam-border text-exam-ink flex items-center justify-center hover:bg-exam-paper-alt active:scale-[0.94] transition-[background-color,transform] duration-300 ease-spring disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Minus className="w-4 h-4" aria-hidden />
                </button>
                <span aria-live="polite" className="w-8 text-center text-xl font-bold text-exam-ink tabular-nums">{value}</span>
                <button
                  onClick={() => step(row.key, 1)}
                  disabled={!canAdd}
                  aria-label={`יותר ${row.label}`}
                  className="w-11 h-11 rounded-full border border-exam-border text-exam-ink flex items-center justify-center hover:bg-exam-paper-alt active:scale-[0.94] transition-[background-color,transform] duration-300 ease-spring disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Plus className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-exam-ink">סה״כ <span className="font-bold">{heCount(total, 'question')}</span></span>
        {total > 0 && <span className="text-exam-ink-soft">כ-{heCount(planMinutes(plan), 'minute')} בקצב המבחן</span>}
      </div>
      <p className="mt-1 text-xs text-exam-ink-soft">
        {capReached ? `עד ${MIXED_LIMITS.total} שאלות בתרגול אחד. ` : ''}
        {plan.rc > 0 ? `${heCount(plan.rc, PASSAGE_NOUN)} קריאה, כל אחד ברצף של ${RC_PER_PASSAGE} שאלות.` : 'בלי קטעי קריאה.'}
      </p>

      {order.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-exam-ink-soft mb-1.5">סדר לדוגמה</div>
          <div className="flex flex-wrap gap-1" aria-hidden>
            {order.map((k, i) => (
              <span key={i} className={`w-5 h-5 rounded-sm text-[11px] font-bold flex items-center justify-center ${MIX_SWATCH[k].cls}`}>{MIX_SWATCH[k].letter}</span>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-exam-ink-soft" aria-hidden>
            {MIX_ROWS.map(r => (
              <span key={r.key} className="inline-flex items-center gap-1">
                <span className={`w-4 h-4 rounded-sm text-[10px] font-bold inline-flex items-center justify-center ${MIX_SWATCH[r.key].cls}`}>{MIX_SWATCH[r.key].letter}</span>
                {r.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
