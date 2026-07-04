'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionCard } from '@/components/exam/QuestionCard';
import type { Question } from '@/types/exam';
import { BackNav } from '@/components/BackNav';

type Step = 'loading' | 'empty' | 'error' | 'reviewing' | 'done';

export default function ReviewQueuePage() {
  const router = useRouter();

  const [guestId, setGuestId] = useState<string>('');
  const [step, setStep] = useState<Step>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showQuestionPicker, setShowQuestionPicker] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem('amiret_guest_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('amiret_guest_id', id);
    }
    setGuestId(id);
  }, []);

  useEffect(() => {
    if (!guestId) return;
    fetchDueQuestions(guestId);
  }, [guestId]);

  const fetchDueQuestions = async (id: string) => {
    setStep('loading');
    try {
      const res = await fetch(`/api/review-queue?guestId=${encodeURIComponent(id)}`);
      const data = await res.json() as { questions: Question[]; count: number };
      if (!data.questions || data.questions.length === 0) {
        setStep('empty');
      } else {
        setQuestions(data.questions);
        setAnswers(Array(data.questions.length).fill(null));
        setCurrentIndex(0);
        setShowResult(false);
        setCorrectCount(0);
        setStep('reviewing');
      }
    } catch {
      setStep('error');
    }
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

    fetch('/api/review-queue', {
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

  // Delete a single question from the queue
  const handleDeleteQuestion = async (questionId: string) => {
    const idx = questions.findIndex(q => q.id === questionId);
    const newQuestions = questions.filter(q => q.id !== questionId);
    const newAnswers = answers.filter((_, i) => i !== idx);

    if (newQuestions.length === 0) {
      setStep('empty');
    } else {
      setQuestions(newQuestions);
      setAnswers(newAnswers);
      if (currentIndex >= newQuestions.length) {
        setCurrentIndex(newQuestions.length - 1);
      }
      setShowResult(false);
      setShowQuestionPicker(false);
    }

    fetch(`/api/review-queue?guestId=${encodeURIComponent(guestId)}&questionId=${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  // Clear ALL questions
  const handleClearAll = async () => {
    if (!window.confirm(`למחוק את כל ${questions.length} השאלות מרשימת החזרה?`)) return;
    fetch(`/api/review-queue?guestId=${encodeURIComponent(guestId)}`, { method: 'DELETE' }).catch(() => {});
    setStep('empty');
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center" dir="rtl">
        <div className="text-slate-400 dark:text-slate-500 text-lg">טוען שאלות לחזרה...</div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">שגיאה בטעינה</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">לא ניתן לטעון את השאלות. בדוק חיבור אינטרנט.</p>
            <button
              onClick={() => fetchDueQuestions(guestId)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir="rtl">
        <BackNav backHref="/exam" backLabel="מבחן" />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">כל הכבוד!</h1>
            <p className="text-slate-500 dark:text-slate-400">אין שאלות לחזרה כרגע. בוא שוב מחר 🎉</p>
            <button
              onClick={() => router.push('/exam')}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              חזרה לתפריט
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const color = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-4" dir="rtl">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="text-6xl">{pct >= 80 ? '🎉' : pct >= 60 ? '💪' : '📚'}</div>
          <div>
            <div className={`text-5xl font-black ${color}`}>{correctCount}/{questions.length}</div>
            <div className="text-slate-500 dark:text-slate-400 mt-1 text-lg">{pct}% נכון בחזרה</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
            {pct >= 80 && 'מצוין! אתה שולט בשאלות האלה.'}
            {pct >= 60 && pct < 80 && 'טוב! עוד קצת תרגול ותגיע לשלמות.'}
            {pct < 60 && 'הלמידה לוקחת זמן — ממשיכים לחזור!'}
          </div>
          <div className="space-y-3">
            <button
              onClick={handleRestartSession}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              חזרה על אותן שאלות מחדש
            </button>
            <button
              onClick={() => fetchDueQuestions(guestId)}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
            >
              טען שאלות חדשות
            </button>
            <button
              onClick={() => router.push('/exam')}
              className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-300 text-slate-700 dark:text-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              חזרה לתפריט
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Question picker panel ─────────────────────────────────────────────────
  const QuestionPicker = () => (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setShowQuestionPicker(false)}>
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <span className="font-bold text-slate-900 dark:text-white text-lg">בחר שאלה</span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRestartSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
            >
              <span>↺</span> ריסטרט
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
            >
              🗑 נקה הכל
            </button>
            <button onClick={() => setShowQuestionPicker(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 text-2xl leading-none">×</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {questions.map((q, i) => {
            const answered = answers[i] !== null;
            const correct = answered && answers[i] === q.correct_answer;
            const wrong = answered && answers[i] !== q.correct_answer;
            return (
              <div key={q.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${i === currentIndex ? 'border-orange-400 bg-orange-50' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100'}`}>
                <button
                  onClick={() => handleJumpTo(i)}
                  className="flex-1 flex items-center gap-3 text-right"
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === currentIndex ? 'bg-orange-500 text-white' :
                    correct ? 'bg-green-500 text-white' :
                    wrong ? 'bg-red-400 text-white' :
                    'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {correct ? '✓' : wrong ? '✗' : i + 1}
                  </span>
                  <span className="text-sm text-slate-700 dark:text-slate-200 text-right leading-snug line-clamp-2 flex-1">
                    {q.text.length > 80 ? q.text.slice(0, 80) + '…' : q.text}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors text-base"
                  title="הסר מהרשימה"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── Reviewing ─────────────────────────────────────────────────────────────
  const question = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
      {showQuestionPicker && <QuestionPicker />}

      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">חזרה על טעויות</span>
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">חזרה</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {currentIndex + 1}/{questions.length} שאלות
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Clickable dots — tap to open picker */}
            <button
              onClick={() => setShowQuestionPicker(true)}
              className="flex gap-1 items-center p-1 rounded-lg hover:bg-slate-100 transition-colors"
              title="בחר שאלה"
            >
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < currentIndex
                      ? answers[i] === questions[i].correct_answer ? 'bg-green-500' : 'bg-red-400'
                      : i === currentIndex ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </button>
            {/* Restart session button */}
            <button
              onClick={handleRestartSession}
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors text-lg"
              title="ריסטרט — חזרה לשאלה ראשונה"
            >
              ↺
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
        />

        <div className="mt-6 flex items-center justify-between gap-3">
          {/* Delete current question */}
          <button
            onClick={() => handleDeleteQuestion(question.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors text-sm font-medium"
          >
            🗑 הסר שאלה
          </button>

          {showResult && (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors"
            >
              {isLast ? 'סיום חזרה ✓' : 'שאלה הבאה ‹'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
