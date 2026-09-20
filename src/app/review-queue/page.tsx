'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionCard } from '@/components/exam/QuestionCard';
import type { Question } from '@/types/exam';
import { BackNav } from '@/components/BackNav';
import { PenLine, RotateCcw, BookOpen, Languages, HelpCircle, AlertTriangle, PartyPopper, Trash2, Target, ThumbsUp, Check, X, type LucideIcon } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';

type Step = 'loading' | 'empty' | 'error' | 'overview' | 'reviewing' | 'done';

const CATEGORY_LABELS: Record<string, string> = {
  sentence_completion: 'השלמת משפטים',
  restatement: 'ניסוח מחדש',
  reading_comprehension: 'הבנת הנקרא',
  esra: 'אנגלית ESRA',
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  sentence_completion: PenLine,
  restatement: RotateCcw,
  reading_comprehension: BookOpen,
  esra: Languages,
};

function groupByCategory(list: Question[]): Record<string, Question[]> {
  return list.reduce<Record<string, Question[]>>((acc, q) => {
    (acc[q.type] ??= []).push(q);
    return acc;
  }, {});
}

function sortedCategories(groups: Record<string, unknown[]>): string[] {
  return Object.keys(groups).sort(
    (a, b) => (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b, 'he')
  );
}

export default function ReviewQueuePage() {
  const router = useRouter();

  const guestId = ''; // Ownership is resolved from the server cookie or account.
  const [step, setStep] = useState<Step>('loading');

  // Master list — everything currently due, source of truth for the category overview.
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);

  // Active reviewing session — a (possibly filtered-by-category) subset of allQuestions.
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);

  const fetchDueQuestions = useCallback((id: string) => authFetch(`/api/review-queue?guestId=${encodeURIComponent(id)}`).then(async res => {
      if (!res.ok) throw new Error('Unable to load review questions');
      const data = await res.json() as { questions: Question[]; count: number };
      if (!data.questions || data.questions.length === 0) {
        setAllQuestions([]);
        setStep('empty');
      } else {
        setAllQuestions(data.questions);
        setStep('overview');
      }
  }).catch(() => { setStep('error'); }), []);

  useEffect(() => { void fetchDueQuestions(''); }, [fetchDueQuestions]);

  // Begin a reviewing session — either every due question, or just one category.
  const handleStartReview = (categoryType?: string) => {
    const subset = categoryType ? allQuestions.filter(q => q.type === categoryType) : allQuestions;
    if (subset.length === 0) return;
    setQuestions(subset);
    setAnswers(Array(subset.length).fill(null));
    setCurrentIndex(0);
    setShowResult(false);
    setCorrectCount(0);
    setShowQuestionPicker(false);
    setStep('reviewing');
  };

  const handleSelect = useCallback((optionIndex: number) => {
    if (showResult) return;
    setAnswers(prev => {
      const next = [...prev];
      next[currentIndex] = optionIndex;
      return next;
    });
    setShowResult(true);

    const wasCorrect = optionIndex === questions[currentIndex].correct_answer;
    if (wasCorrect) setCorrectCount(c => c + 1);

    authFetch('/api/review-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId,
        questionId: questions[currentIndex].id,
        wasCorrect,
      }),
    }).catch(() => {});
  }, [showResult, currentIndex, questions, guestId]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1);
      setShowResult(false);
    } else {
      setStep('done');
    }
  }, [currentIndex, questions.length]);

  // Restart session (back to question 1, no DB change)
  const handleRestartSession = () => {
    setCurrentIndex(0);
    setAnswers(Array(questions.length).fill(null));
    setShowResult(false);
    setCorrectCount(0);
    setShowQuestionPicker(false);
  };

  // Delete a single question from the queue. Deleting a DIFFERENT question
  // than the one currently being viewed must not move the viewer — the old
  // code kept currentIndex as a raw number, so removing an earlier item
  // silently shifted every later index down by one and swapped in whatever
  // question now landed on that number, resetting showResult along with it
  // (reproduced live: reviewing question 3, deleting question 1 from the
  // picker silently jumped the view to question 4). Fixed by tracking the
  // active question by id and only touching currentIndex/showResult when
  // the deleted question IS the one being viewed.
  const handleDeleteQuestion = async (questionId: string) => {
    const newAll = allQuestions.filter(q => q.id !== questionId);
    setAllQuestions(newAll);

    if (step === 'reviewing' || showQuestionPicker) {
      const idx = questions.findIndex(q => q.id === questionId);
      if (idx !== -1) {
        const activeId = questions[currentIndex]?.id;
        const wasActive = activeId === questionId;
        const newQuestions = questions.filter(q => q.id !== questionId);
        const newAnswers = answers.filter((_, i) => i !== idx);
        if (newQuestions.length === 0) {
          setStep(newAll.length === 0 ? 'empty' : 'overview');
        } else {
          setQuestions(newQuestions);
          setAnswers(newAnswers);
          if (wasActive) {
            setCurrentIndex(Math.min(idx, newQuestions.length - 1));
            setShowResult(false);
          } else {
            const newIdx = newQuestions.findIndex(q => q.id === activeId);
            setCurrentIndex(newIdx === -1 ? Math.min(currentIndex, newQuestions.length - 1) : newIdx);
          }
          setShowQuestionPicker(false);
        }
      }
    } else if (newAll.length === 0) {
      setStep('empty');
    }

    authFetch(`/api/review-queue?guestId=${encodeURIComponent(guestId)}&questionId=${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  // Clear ALL questions
  const handleClearAll = async () => {
    if (!window.confirm(`למחוק את כל ${allQuestions.length} השאלות מרשימת החזרה?`)) return;
    authFetch(`/api/review-queue?guestId=${encodeURIComponent(guestId)}`, { method: 'DELETE' }).catch(() => {});
    setAllQuestions([]);
    setStep('empty');
  };

  // Clear all questions of one category at once
  const handleDeleteCategory = async (type: string) => {
    const inCategory = allQuestions.filter(q => q.type === type);
    if (inCategory.length === 0) return;
    if (!window.confirm(`למחוק את כל ${inCategory.length} השאלות בקטגוריית "${CATEGORY_LABELS[type] ?? type}"?`)) return;

    const newAll = allQuestions.filter(q => q.type !== type);
    setAllQuestions(newAll);

    if (step === 'reviewing' || showQuestionPicker) {
      const activeId = questions[currentIndex]?.id;
      const wasActive = questions[currentIndex]?.type === type;
      const newQuestions = questions.filter(q => q.type !== type);
      const newAnswers = questions.reduce<(number | null)[]>((acc, q, i) => {
        if (q.type !== type) acc.push(answers[i]);
        return acc;
      }, []);
      if (newQuestions.length === 0) {
        setStep(newAll.length === 0 ? 'empty' : 'overview');
      } else {
        setQuestions(newQuestions);
        setAnswers(newAnswers);
        if (wasActive) {
          setCurrentIndex(i => Math.min(i, newQuestions.length - 1));
          setShowResult(false);
        } else {
          const newIdx = newQuestions.findIndex(q => q.id === activeId);
          setCurrentIndex(newIdx === -1 ? Math.min(currentIndex, newQuestions.length - 1) : newIdx);
        }
      }
    } else if (newAll.length === 0) {
      setStep('empty');
    }

    authFetch(`/api/review-queue?guestId=${encodeURIComponent(guestId)}&type=${encodeURIComponent(type)}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  // Jump to a specific question
  const handleJumpTo = (index: number) => {
    setCurrentIndex(index);
    setShowResult(answers[index] !== null);
    setShowQuestionPicker(false);
  };

  useEffect(() => {
    if (step !== 'reviewing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showResult) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleNext(); }
      } else {
        const idx = parseInt(e.key) - 1;
        if (idx >= 0 && idx < (questions[currentIndex]?.options.length ?? 0)) {
          handleSelect(idx);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, showResult, currentIndex, questions, handleNext, handleSelect]);

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-exam-paper flex items-center justify-center" dir="rtl">
        <div className="text-exam-ink-soft text-lg">טוען שאלות לחזרה...</div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center space-y-4">
            <AlertTriangle className="w-12 h-12 mx-auto text-exam-alt" strokeWidth={1.5} aria-hidden />
            <h1 className="text-xl font-bold text-exam-ink">שגיאה בטעינה</h1>
            <p className="text-exam-ink-soft text-sm">לא ניתן לטעון את השאלות. בדוק חיבור אינטרנט.</p>
            <button
              onClick={() => fetchDueQuestions(guestId)}
              className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
            >
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'empty') {
    return (
      <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center space-y-6">
            <PartyPopper className="w-14 h-14 mx-auto text-exam-alt" strokeWidth={1.5} aria-hidden />
            <h1 className="text-2xl font-bold text-exam-ink">כל הכבוד!</h1>
            <p className="text-exam-ink-soft">אין שאלות לחזרה כרגע. בוא שוב מחר</p>
            <button
              onClick={() => router.push('/exam')}
              className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
            >
              חזרה לתפריט
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'overview') {
    const groups = groupByCategory(allQuestions);
    const order = sortedCategories(groups);

    return (
      <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex-1 px-4 py-8">
          <div className="w-full max-w-lg mx-auto space-y-6">
            <div className="text-center">
              <RotateCcw className="w-9 h-9 mx-auto mb-2 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
              <h1 className="text-2xl font-bold text-exam-ink">חזרה על טעויות</h1>
              <p className="text-exam-ink-soft mt-1">{allQuestions.length} שאלות ממתינות, מחולקות לפי קטגוריה</p>
            </div>

            <div className="space-y-3">
              {order.map(type => (
                <div
                  key={type}
                  className="flex items-center gap-3 p-4 bg-exam-surface rounded-md border border-exam-border"
                >
                  {(() => { const Icon = CATEGORY_ICONS[type] ?? HelpCircle; return <Icon className="w-6 h-6 text-exam-ink-soft flex-shrink-0" strokeWidth={1.75} aria-hidden />; })()}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-exam-ink">{CATEGORY_LABELS[type] ?? type}</div>
                    <div className="text-xs text-exam-ink-soft">{groups[type].length} שאלות</div>
                  </div>
                  <button
                    onClick={() => handleStartReview(type)}
                    className="px-3 py-2 bg-exam-alt text-white rounded-sm text-sm font-bold hover:opacity-90 transition-opacity flex-shrink-0"
                  >
                    תרגל ‹
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(type)}
                    className="w-9 h-9 flex items-center justify-center rounded-sm text-exam-ink-soft hover:text-exam-wrong hover:bg-exam-wrong-bg transition-colors text-base flex-shrink-0"
                    title={`מחק את כל שאלות ${CATEGORY_LABELS[type] ?? type}`}
                  >
                    <Trash2 className="w-4 h-4 mx-auto" aria-hidden />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => handleStartReview()}
                className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
              >
                <span className="inline-flex items-center gap-2"><Target className="w-4 h-4" aria-hidden />התחל חזרה על הכל ({allQuestions.length})</span>
              </button>
              <button
                onClick={handleClearAll}
                className="w-full py-3 bg-exam-surface border border-exam-wrong/40 text-exam-wrong rounded-sm font-medium hover:bg-exam-wrong-bg transition-colors"
              >
                <span className="inline-flex items-center gap-2"><Trash2 className="w-4 h-4" aria-hidden />מחק את כל השאלות</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const color = pct >= 80 ? 'text-exam-sage-strong' : pct >= 60 ? 'text-exam-alt' : 'text-exam-wrong';

    return (
      <div className="min-h-screen bg-exam-paper flex flex-col items-center justify-center px-4" dir="rtl">
        <div className="w-full max-w-sm text-center space-y-6">
          {pct >= 80 ? <PartyPopper className="w-14 h-14 mx-auto text-exam-sage-strong" strokeWidth={1.5} aria-hidden /> : pct >= 60 ? <ThumbsUp className="w-14 h-14 mx-auto text-exam-alt" strokeWidth={1.5} aria-hidden /> : <BookOpen className="w-14 h-14 mx-auto text-exam-ink-soft" strokeWidth={1.5} aria-hidden />}
          <div>
            <div className={`text-5xl font-black ${color}`}>{correctCount}/{questions.length}</div>
            <div className="text-exam-ink-soft mt-1 text-lg">{pct}% נכון בחזרה</div>
          </div>
          <div className="bg-exam-surface rounded-md border border-exam-border p-4 text-sm text-exam-ink-soft">
            {pct >= 80 && 'מצוין! אתה שולט בשאלות האלה.'}
            {pct >= 60 && pct < 80 && 'טוב! עוד קצת תרגול ותגיע לשלמות.'}
            {pct < 60 && 'הלמידה לוקחת זמן — ממשיכים לחזור!'}
          </div>
          <div className="space-y-3">
            <button
              onClick={handleRestartSession}
              className="w-full py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity"
            >
              חזרה על אותן שאלות מחדש
            </button>
            <button
              onClick={() => fetchDueQuestions(guestId)}
              className="w-full py-3 bg-exam-alt text-white rounded-sm font-bold hover:opacity-90 transition-opacity"
            >
              חזרה לרשימת קטגוריות
            </button>
            <button
              onClick={() => router.push('/exam')}
              className="w-full py-3 bg-exam-surface border border-exam-border text-exam-ink rounded-sm font-medium hover:bg-exam-paper-alt transition-colors"
            >
              חזרה לתפריט
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Question picker panel (mid-review — still grouped by category) ───────
  const pickerGroups = questions.reduce<Record<string, { q: Question; i: number }[]>>((acc, q, i) => {
    (acc[q.type] ??= []).push({ q, i });
    return acc;
  }, {});
  const pickerOrder = sortedCategories(pickerGroups);

  const questionPicker = (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowQuestionPicker(false)}>
      <div className="bg-exam-surface rounded-t-md w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-exam-border">
          <span className="font-bold text-exam-ink text-lg">בחר שאלה</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRestartSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-exam-accent/10 text-exam-accent rounded-sm text-sm font-semibold hover:bg-exam-accent/20 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden /> ריסטרט
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-exam-wrong-bg text-exam-wrong rounded-sm text-sm font-semibold hover:opacity-80 transition-opacity"
            >
              <span className="inline-flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" aria-hidden />נקה הכל</span>
            </button>
            <button onClick={() => setShowQuestionPicker(false)} className="text-exam-ink-soft hover:text-exam-ink text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
          {pickerOrder.map(type => (
            <div key={type}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold text-exam-ink-soft">
                  {CATEGORY_LABELS[type] ?? type} · {pickerGroups[type].length}
                </span>
                <button
                  onClick={() => handleDeleteCategory(type)}
                  className="flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-semibold text-exam-wrong hover:bg-exam-wrong-bg transition-colors"
                >
                  <span className="inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" aria-hidden />מחק קטגוריה</span>
                </button>
              </div>
              <div className="space-y-2">
                {pickerGroups[type].map(({ q, i }) => {
                  const answered = answers[i] !== null;
                  const correct = answered && answers[i] === q.correct_answer;
                  const wrong = answered && answers[i] !== q.correct_answer;
                  return (
                    <div key={q.id} className={`flex items-center gap-3 p-3 rounded-sm border transition-colors ${i === currentIndex ? 'border-exam-alt bg-exam-alt-bg' : 'border-exam-border bg-exam-paper-alt hover:bg-exam-border/20'}`}>
                      <button
                        onClick={() => handleJumpTo(i)}
                        className="flex-1 flex items-center gap-3 text-right"
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === currentIndex ? 'bg-exam-alt text-white' :
                          correct ? 'bg-exam-sage-strong text-white' :
                          wrong ? 'bg-exam-wrong text-white' :
                          'bg-exam-border text-exam-ink-soft'
                        }`}>
                          {correct ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : wrong ? <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                        </span>
                        <span className="text-sm text-exam-ink text-right leading-snug line-clamp-2 flex-1">
                          {q.text.length > 80 ? q.text.slice(0, 80) + '…' : q.text}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-sm text-exam-ink-soft hover:text-exam-wrong hover:bg-exam-wrong-bg transition-colors text-base"
                        title="הסר מהרשימה"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Reviewing ─────────────────────────────────────────────────────────────
  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-exam-paper" dir="rtl">
      {showQuestionPicker && questionPicker}

      <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-exam-ink">חזרה על טעויות</span>
              <span className="px-2 py-0.5 bg-exam-alt-bg text-exam-alt text-xs font-bold rounded-full">
                {CATEGORY_LABELS[question.type] ?? question.type}
              </span>
            </div>
            <div className="text-xs text-exam-ink-soft">
              {currentIndex + 1}/{questions.length} שאלות
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Clickable dots — tap to open picker */}
            <button
              onClick={() => setShowQuestionPicker(true)}
              className="flex gap-1 items-center p-1 rounded-sm hover:bg-exam-paper-alt transition-colors"
              title="בחר שאלה"
            >
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < currentIndex
                      ? answers[i] === questions[i].correct_answer ? 'bg-exam-sage-strong' : 'bg-exam-wrong'
                      : i === currentIndex ? 'bg-exam-alt' : 'bg-exam-border'
                  }`}
                />
              ))}
            </button>
            {/* Restart session button */}
            <button
              onClick={handleRestartSession}
              className="p-1.5 rounded-sm text-exam-ink-soft hover:text-exam-accent hover:bg-exam-accent/10 transition-colors text-lg"
              title="ריסטרט — חזרה לשאלה ראשונה"
              aria-label="ריסטרט — חזרה לשאלה ראשונה"
            >
              <RotateCcw className="w-4 h-4 mx-auto" aria-hidden />
            </button>
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
          isPractice={true}
          showResult={showResult}
          hideHeader
        />

        <div className="mt-6 flex items-center justify-between gap-3">
          {/* Delete current question */}
          <button
            onClick={() => handleDeleteQuestion(question.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-sm border border-exam-border text-exam-ink-soft hover:text-exam-wrong hover:border-exam-wrong/40 hover:bg-exam-wrong-bg transition-colors text-sm font-medium"
          >
            <span className="inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" aria-hidden />הסר שאלה</span>
          </button>

          {showResult && (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-exam-alt text-white rounded-sm font-bold hover:opacity-90 transition-opacity"
            >
              {isLast ? <span className="inline-flex items-center gap-1.5">סיום חזרה <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span> : 'שאלה הבאה ‹'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
