'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { classifyScore, type Question, type QuestionType } from '@/types/exam';
import { estimateThetaEAP, thetaToScore, routeNextDifficulty } from '@/lib/adaptive';
import { BackNav } from '@/components/BackNav';

type Step = 'pick-type' | 'pick-difficulty' | 'pick-count' | 'practicing' | 'done';
type Difficulty = 1 | 2 | 3 | 4 | 5 | 'random';

const TYPE_OPTIONS: { type: QuestionType; label: string; desc: string; icon: string }[] = [
  { type: 'sentence_completion', label: 'השלמת משפטים', desc: 'בחר את המילה החסרה במשפט', icon: '✏️' },
  { type: 'restatement',        label: 'ניסוח מחדש',   desc: 'זהה את המשמעות הזהה במשפט', icon: '🔄' },
  { type: 'reading_comprehension', label: 'הבנת הנקרא', desc: 'קרא קטע וענה על שאלות הבנה', icon: '📖' },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; sublabel: string; range: string }[] = [
  { value: 1, label: '1', sublabel: 'קל מאוד',  range: '50–84'   },
  { value: 2, label: '2', sublabel: 'קל',         range: '85–99'   },
  { value: 3, label: '3', sublabel: 'בינוני',     range: '100–119' },
  { value: 4, label: '4', sublabel: 'קשה',         range: '120–133' },
  { value: 5, label: '5', sublabel: 'קשה מאוד',  range: '134–150' },
  { value: 'random', label: '🎲', sublabel: 'מעורב', range: 'מכל הרמות' },
];

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
  const router = useRouter();

  const [step, setStep]               = useState<Step>('pick-type');
  const [selectedType, setType]       = useState<QuestionType | null>(null);
  const [selectedDiff, setDiff]       = useState<Difficulty | null>(null);
  const [selectedCount, setCount]     = useState<5 | 10>(5);
  const [examMode, setExamMode]       = useState(false);

  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]         = useState<(number | null)[]>([]);
  const [showResult, setShowResult]   = useState(false);

  // Exam mode timer
  const [timeLeft, setTimeLeft]       = useState<number>(0);
  const timerRef                      = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartedRef               = useRef(false);

  const fetchQuestions = async (overrideDiff?: Difficulty) => {
    setLoading(true);
    setError(null);
    const diff = overrideDiff ?? selectedDiff;
    try {
      const params = new URLSearchParams({
        type: selectedType!,
        difficulty: String(diff),
        count: String(selectedCount),
      });
      const res = await fetch(`/api/practice/questions?${params}`);
      if (!res.ok) {
        setError('לא נמצאו שאלות. נסה רמת קושי אחרת.');
        setLoading(false);
        return;
      }
      const data = await res.json() as { questions: Question[] };
      setQuestions(data.questions);
      setAnswers(Array(data.questions.length).fill(null));
      setCurrentIndex(0);
      setShowResult(false);
      setStep('practicing');
    } catch {
      setError('שגיאת רשת. בדוק חיבור אינטרנט.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (optionIndex: number) => {
    if (showResult) return;
    // In exam mode, only allow one selection per question
    if (examMode && answers[currentIndex] !== null) return;
    const next = [...answers];
    next[currentIndex] = optionIndex;
    setAnswers(next);
    if (!examMode) {
      setShowResult(true);
    }
    // Track answers for spaced repetition (fire-and-forget)
    const isCorrect = optionIndex === questions[currentIndex]?.correct_answer;
    const guestId = localStorage.getItem('amiret_guest_id') ?? 'guest';
    fetch('/api/review-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId, questionId: questions[currentIndex].id, wasCorrect: isCorrect }),
    }).catch(() => {});
  };

  const handleRestart = () => {
    setStep('pick-type');
    setType(null);
    setDiff(null);
    setCount(5);
    setQuestions([]);
    setAnswers([]);
    setError(null);
    setExamMode(false);
  };

  const correctCount = answers.filter((a, i) => a === questions[i]?.correct_answer).length;

  // Keyboard shortcuts: 1-4 = select option, Space/Enter = next question
  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setShowResult(false);
    } else {
      setStep('done');
    }
  }, [currentIndex, questions.length]);

  // Exam mode: reset timer when question changes
  useEffect(() => {
    if (step !== 'practicing' || !examMode || !selectedType) return;

    // Clear any existing interval
    if (timerRef.current) clearInterval(timerRef.current);

    const duration = EXAM_TIMER_SECONDS[selectedType];
    timerStartedRef.current = false;
    setTimeLeft(duration);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          timerStartedRef.current = true;
          return 0;
        }
        timerStartedRef.current = true;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, examMode, selectedType, currentIndex]);

  // Auto-advance when timeLeft hits 0 in exam mode (only after timer actually started)
  useEffect(() => {
    if (!examMode || step !== 'practicing' || timeLeft !== 0 || !timerStartedRef.current) return;
    handleNext();
  }, [timeLeft, examMode, step, handleNext]);

  // Stop timer when leaving practicing step
  useEffect(() => {
    if (step !== 'practicing' && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'practicing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (examMode) {
        // In exam mode: number keys select answer
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
    if (t < 10) return 'text-red-600';
    if (t < 20) return 'text-yellow-500';
    return 'text-green-600';
  }

  // ── Screens ────────────────────────────────────────────────────────────────

  if (step === 'pick-type') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">תרגול סעיף</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">בחר את סוג השאלות שתרצה לתרגל</p>
          <div className="space-y-3">
            {TYPE_OPTIONS.map(opt => (
              <button
                key={opt.type}
                onClick={() => { setType(opt.type); setStep('pick-difficulty'); }}
                className="w-full text-right p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-4"
              >
                <span className="text-3xl">{opt.icon}</span>
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-lg">{opt.label}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-sm">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        </div>
      </div>
    );
  }

  if (step === 'pick-difficulty') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-4 py-12" dir="rtl">
        <div className="w-full max-w-lg">
          <button onClick={() => setStep('pick-type')} className="text-slate-400 dark:text-slate-500 text-sm mb-6 hover:text-slate-600">
            ← חזרה
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">רמת קושי</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">בחר את רמת הקושי של השאלות</p>
          <div className="grid grid-cols-3 gap-3">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => {
                  setDiff(opt.value);
                  setStep('pick-count');
                }}
                className="p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition-all text-center"
              >
                <div className="text-2xl font-black text-slate-900 dark:text-white">{opt.label}</div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1">{opt.sublabel}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.range}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'pick-count') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-4 py-12" dir="rtl">
        <div className="w-full max-w-lg">
          <button onClick={() => setStep('pick-difficulty')} className="text-slate-400 dark:text-slate-500 text-sm mb-6 hover:text-slate-600">
            ← חזרה
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">כמות שאלות</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">כמה שאלות תרצה לתרגל?</p>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {([5, 10] as const).map(n => (
              <button
                key={n}
                onClick={() => { setCount(n); }}
                className={`p-6 rounded-2xl border-2 transition-all text-center ${
                  selectedCount === n
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="text-4xl font-black">{n}</div>
                <div className="text-sm mt-1">שאלות</div>
              </button>
            ))}
          </div>

          {/* Exam mode toggle */}
          <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 dark:text-white">מצב בחינה</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ללא הסברים מיידיים, עם טיימר לכל שאלה</div>
              </div>
              <button
                role="switch"
                aria-checked={examMode}
                onClick={() => setExamMode(v => !v)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  examMode ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-slate-800 shadow transition-transform ${
                    examMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            onClick={() => fetchQuestions()}
            disabled={loading}
            className="mt-8 w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'טוען...' : examMode ? 'התחל בחינה' : 'התחל תרגול'}
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
        <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {TYPE_OPTIONS.find(t => t.type === selectedType)?.label}
                {examMode && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                    מצב בחינה
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                שאלה {currentIndex + 1} מתוך {questions.length}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Timer (exam mode only) */}
              {examMode && (
                <div className={`font-mono text-xl font-black tabular-nums ${timerColor(timeLeft)}`}>
                  {formatTime(timeLeft)}
                </div>
              )}

              {/* Progress dots */}
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i < currentIndex
                        ? answers[i] === questions[i].correct_answer ? 'bg-green-500' : 'bg-red-400'
                        : i === currentIndex ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
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
            isPractice={!examMode}
            showResult={examMode ? false : showResult}
          />

          {/* Normal mode: show Next button after answering */}
          {!examMode && showResult && (
            <div className="mt-6 flex justify-start">
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                {isLast ? 'ראה תוצאות ✓' : 'שאלה הבאה ‹'}
              </button>
            </div>
          )}

          {/* Exam mode: show Next button only after answer selected */}
          {examMode && answers[currentIndex] !== null && (
            <div className="mt-6 flex justify-start">
              <button
                onClick={handleNext}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                {isLast ? 'סיים בחינה ✓' : 'שאלה הבאה ‹'}
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (step === 'done') {
    const pct = Math.round((correctCount / questions.length) * 100);
    const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';

    // Level diagnosis via IRT — same 3PL model the adaptive exam uses.
    // Most meaningful in mixed mode, where questions span all 5 levels.
    const hasIrtParams = questions.every(q => isFinite(q.a) && isFinite(q.b) && isFinite(q.c));
    const diagTheta = hasIrtParams
      ? estimateThetaEAP(
          questions.map(q => ({ a: q.a, b: q.b, c: q.c })),
          questions.map((q, i) => (answers[i] === q.correct_answer ? 1 : 0)),
        )
      : null;
    const diagScore = diagTheta !== null ? thetaToScore(diagTheta) : null;
    const diagLevel = diagTheta !== null ? routeNextDifficulty(diagTheta) : null;
    const diagClass = diagScore !== null ? classifyScore(diagScore) : null;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-8" dir="rtl">
        <div className="max-w-2xl mx-auto">
          {/* Score summary */}
          <div className="text-center space-y-4 mb-10">
            <div className="text-6xl">{pct >= 80 ? '🎉' : pct >= 60 ? '💪' : '📚'}</div>
            {examMode && (
              <div className="inline-block bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full">
                תוצאת מצב בחינה
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
                  <span className="text-xl">🎯</span>
                  <span className="font-bold text-slate-900 dark:text-white">אבחון רמה</span>
                  {selectedDiff === 'random' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">רמה מעורבת</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">הרמה המשוערת שלך</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">רמה {diagLevel}/5</div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm text-slate-500 dark:text-slate-400">ציון אמירנ"ט משוער</div>
                    <div className={`text-2xl font-black ${diagClass.color}`}>~{diagScore}</div>
                    <div className={`text-xs font-semibold ${diagClass.color}`}>{diagClass.label}</div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  הערכה סטטיסטית לפי מודל ה-IRT של המבחן האדפטיבי — מבוססת על {questions.length} שאלות בלבד.
                  {selectedDiff !== 'random' && ' לאבחון מדויק יותר, תרגל ברמה מעורבת או עשה מבחן מלא.'}
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
          {examMode && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-3">
                סקירת שאלות והסברים
              </h2>
              {questions.map((q, i) => {
                const isCorrect = answers[i] === q.correct_answer;
                return (
                  <div
                    key={q.id ?? i}
                    className={`rounded-2xl border-2 overflow-hidden ${
                      isCorrect ? 'border-green-300' : 'border-red-300'
                    }`}
                  >
                    {/* Status bar */}
                    <div className={`px-4 py-2 text-sm font-bold flex items-center gap-2 ${
                      isCorrect
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      <span>{isCorrect ? '✓' : '✗'}</span>
                      <span>שאלה {i + 1}</span>
                      {answers[i] === null && (
                        <span className="text-slate-500 dark:text-slate-400 font-normal">(לא נענתה — פג הזמן)</span>
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center" dir="rtl">
      {loading
        ? <div className="text-slate-400 dark:text-slate-500">טוען שאלות...</div>
        : <div className="text-center">
            <div className="text-red-500 mb-3">{error ?? 'שגיאה לא צפויה'}</div>
            <button onClick={handleRestart} className="text-blue-600 underline text-sm">נסה שוב</button>
          </div>
      }
    </div>
  );
}
