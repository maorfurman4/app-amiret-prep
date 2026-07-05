'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionCard } from '@/components/exam/QuestionCard';
import type { Question } from '@/types/exam';
import { authFetch } from '@/lib/auth-fetch';

type Filter = 'all' | 'wrong' | 'correct';

interface ReviewQuestion extends Question {
  sectionIndex: number;
  sectionType: string;
}

interface SectionBreak {
  sectionIndex: number;
  startAt: number;
  label: string;
}

interface ReviewData {
  questions: ReviewQuestion[];
  selectedAnswers: (number | null)[];
  sectionBreaks: SectionBreak[];
}

export default function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const questionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    authFetch(`/api/exam/review?sessionId=${sessionId}&guestId=${encodeURIComponent(guestId)}`)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then((d: ReviewData) => setData(d))
      .catch(() => setFetchError(true));
  }, [sessionId]);

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-800/60" dir="rtl">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-3">שגיאה בטעינת השאלות</div>
          <button onClick={() => { setFetchError(false); window.location.reload(); }} className="text-blue-600 underline text-sm">נסה שוב</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-800/60">
        <div className="text-slate-400 dark:text-slate-500">טוען שאלות...</div>
      </div>
    );
  }

  const { questions, selectedAnswers } = data;

  const wrongCount = questions.filter((q, i) => selectedAnswers[i] !== q.correct_answer).length;
  const correctCount = questions.length - wrongCount;

  // Filtered indices
  const filteredIndices = questions
    .map((q, i) => ({ i, correct: selectedAnswers[i] === q.correct_answer }))
    .filter(({ correct }) =>
      filter === 'all' ? true : filter === 'correct' ? correct : !correct
    )
    .map(({ i }) => i);

  const currentFlatIndex = filteredIndices[currentIndex] ?? 0;
  const question = questions[currentFlatIndex];
  const selectedAnswer = selectedAnswers[currentFlatIndex] ?? null;

  const goTo = (pos: number) => {
    setCurrentIndex(pos);
    questionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const TYPE_ICONS: Record<string, string> = {
    sentence_completion: '✏️',
    restatement: '🔄',
    reading_comprehension: '📖',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">סקירת מבחן</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {filteredIndices.length} שאלות
                {filter === 'wrong' ? ' שגויות' : filter === 'correct' ? ' נכונות' : ''}
              </div>
            </div>
            <button
              onClick={() => router.push(`/results/${sessionId}`)}
              className="text-sm text-blue-600 hover:underline"
            >
              ← חזרה לתוצאות
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-3">
            {([
              { value: 'all', label: `הכל (${questions.length})` },
              { value: 'wrong', label: `❌ טעויות (${wrongCount})` },
              { value: 'correct', label: `✅ נכון (${correctCount})` },
            ] as { value: Filter; label: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setCurrentIndex(0); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 flex gap-6">
        {/* Question number sidebar — desktop */}
        <aside className="hidden md:block w-20 flex-shrink-0">
          <div className="sticky top-32 space-y-1 max-h-[calc(100vh-10rem)] overflow-y-auto">
            {filteredIndices.map((flatIdx, pos) => {
              const isCorrect = selectedAnswers[flatIdx] === questions[flatIdx].correct_answer;
              return (
                <button
                  key={flatIdx}
                  onClick={() => goTo(pos)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
                    pos === currentIndex
                      ? 'bg-blue-600 text-white scale-105'
                      : isCorrect
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  {flatIdx + 1}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main question area */}
        <main className="flex-1 min-w-0">
          {filteredIndices.length === 0 ? (
            <div className="text-center py-20 text-slate-400 dark:text-slate-500">
              <div className="text-4xl mb-3">{filter === 'wrong' ? '🎉' : '📋'}</div>
              <div>{filter === 'wrong' ? 'אין טעויות! ענית נכון על הכל' : 'לא נמצאו שאלות'}</div>
            </div>
          ) : (
            <>
              <div ref={questionRef}>
                <div className="text-xs text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-2">
                  <span>{TYPE_ICONS[question.sectionType] ?? '📝'}</span>
                  <span>פרק {question.sectionIndex}</span>
                  <span>·</span>
                  <span>שאלה {currentFlatIndex + 1} מתוך {questions.length}</span>
                </div>
                <QuestionCard
                  question={question}
                  questionNumber={currentIndex + 1}
                  totalInSection={filteredIndices.length}
                  selectedAnswer={selectedAnswer}
                  onSelect={() => {}}
                  isPractice={true}
                  showResult={true}
                />
              </div>

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => goTo(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 text-sm"
                >
                  קודם &rsaquo;
                </button>

                {/* Mobile dot nav */}
                <div className="flex gap-1.5 md:hidden flex-wrap justify-center max-w-xs">
                  {filteredIndices.map((flatIdx, pos) => {
                    const isCorrect = selectedAnswers[flatIdx] === questions[flatIdx].correct_answer;
                    return (
                      <button
                        key={flatIdx}
                        onClick={() => goTo(pos)}
                        className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                          pos === currentIndex
                            ? 'bg-blue-600 text-white scale-110'
                            : isCorrect
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-600'
                        }`}
                      >
                        {flatIdx + 1}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => goTo(Math.min(filteredIndices.length - 1, currentIndex + 1))}
                  disabled={currentIndex === filteredIndices.length - 1}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 text-sm"
                >
                  &lsaquo; הבא
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
