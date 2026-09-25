'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, RotateCcw, BookOpen, FileText, PartyPopper, ClipboardList, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { QuestionCard } from '@/components/exam/QuestionCard';
import type { Question } from '@/types/exam';
import { authFetch } from '@/lib/auth-fetch';
import { ErrorCauseTagger } from '@/components/exam/ErrorCauseTagger';
import type { ErrorCause } from '@/lib/error-cause';
import { heCount, agree } from '@/lib/hebrew-count';

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
  /** Per item id: latency and any error-cause tag already given. */
  responses?: Record<string, { latencyMs: number | null; errorCause: ErrorCause | null }>;
}

const TYPE_ICONS: Record<string, typeof PenLine> = {
  sentence_completion: PenLine,
  restatement: RotateCcw,
  reading_comprehension: BookOpen,
};

export default function ReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [loadToken, setLoadToken] = useState(0);
  const questionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const guestId = localStorage.getItem('amiret_guest_id') ?? '';
    authFetch(`/api/exam/review?sessionId=${sessionId}&guestId=${encodeURIComponent(guestId)}`)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then((d: ReviewData) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFetchError(true); });
    return () => { cancelled = true; };
  }, [sessionId, loadToken]);

  if (fetchError) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-exam-paper" dir="rtl">
        <div className="text-center">
          <div className="text-exam-wrong text-xl mb-3">לא הצלחנו לטעון את השאלות</div>
          <button onClick={() => { setFetchError(false); setLoadToken(t => t + 1); }} className="text-exam-accent underline text-sm">נסה שוב</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-exam-paper">
        <div className="text-exam-ink-soft">טוען שאלות...</div>
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

  const SectionIcon = TYPE_ICONS[question.sectionType] ?? FileText;

  return (
    <div className="min-h-dvh bg-exam-paper" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-exam-ink">סקירת מבחן</div>
              <div className="text-xs text-exam-ink-soft">
                {heCount(filteredIndices.length, 'question')}
                {filter === 'wrong' ? ` ${agree(filteredIndices.length, 'שגויה', 'שגויות')}` : filter === 'correct' ? ` ${agree(filteredIndices.length, 'נכונה', 'נכונות')}` : ''}
              </div>
            </div>
            <button
              onClick={() => router.push(`/results/${sessionId}`)}
              className="text-sm text-exam-accent hover:underline"
            >
              <span className="inline-flex items-center gap-1"><ArrowRight className="w-4 h-4" aria-hidden />חזרה לתוצאות</span>
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mt-3">
            {([
              { value: 'all', label: `הכל (${questions.length})` },
              { value: 'wrong', label: `טעויות (${wrongCount})` },
              { value: 'correct', label: `נכונות (${correctCount})` },
            ] as { value: Filter; label: string }[]).map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilter(opt.value); setCurrentIndex(0); }}
                className={`px-3 py-1.5 rounded-sm text-sm font-medium transition-colors border ${
                  filter === opt.value
                    ? 'bg-exam-accent text-exam-accent-ink border-exam-accent'
                    : 'bg-exam-paper-alt text-exam-ink-soft border-exam-border hover:bg-exam-border/30'
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
          <div className="sticky top-32 space-y-1 max-h-[calc(100dvh-10rem)] overflow-y-auto">
            {filteredIndices.map((flatIdx, pos) => {
              const isCorrect = selectedAnswers[flatIdx] === questions[flatIdx].correct_answer;
              return (
                <button
                  key={flatIdx}
                  onClick={() => goTo(pos)}
                  aria-label={`שאלה ${flatIdx + 1}${isCorrect ? ', נכונה' : ', שגויה'}`}
                  className={`w-full py-1.5 rounded-sm text-xs font-bold transition-all border ${
                    pos === currentIndex
                      ? 'bg-exam-accent text-exam-accent-ink border-exam-accent scale-105'
                      : isCorrect
                      ? 'bg-exam-sage-bg text-exam-sage-strong border-transparent hover:border-exam-sage/40'
                      : 'bg-exam-wrong-bg text-exam-wrong border-transparent hover:border-exam-wrong/40'
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
            <div className="text-center py-20 text-exam-ink-soft">
              {filter === 'wrong'
                ? <PartyPopper className="w-10 h-10 mx-auto mb-3" strokeWidth={1.5} aria-hidden />
                : <ClipboardList className="w-10 h-10 mx-auto mb-3" strokeWidth={1.5} aria-hidden />}
              <div>{filter === 'wrong' ? 'ענית נכון על הכול. אין כאן טעויות לסקור!' : 'אין כאן שאלות לסקור'}</div>
            </div>
          ) : (
            <>
              <div ref={questionRef}>
                <div className="text-xs text-exam-ink-soft mb-3 flex items-center gap-2">
                  <SectionIcon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden />
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
                  hideHeader
                />
                {selectedAnswer !== question.correct_answer && (
                  <ErrorCauseTagger
                    key={question.id}
                    target={{ sessionId, itemId: question.id }}
                    questionType={question.type}
                    latencyMs={data?.responses?.[question.id]?.latencyMs}
                    initialCause={data?.responses?.[question.id]?.errorCause ?? null}
                  />
                )}
              </div>

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => goTo(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 rounded-sm border border-exam-border text-exam-ink-soft disabled:opacity-40 hover:bg-exam-paper-alt text-sm"
                >
                  <span className="inline-flex items-center gap-1"><ChevronRight className="w-4 h-4" aria-hidden />קודם</span>
                </button>

                {/* Mobile dot nav */}
                <div className="flex gap-1.5 md:hidden flex-wrap justify-center max-w-xs">
                  {filteredIndices.map((flatIdx, pos) => {
                    const isCorrect = selectedAnswers[flatIdx] === questions[flatIdx].correct_answer;
                    return (
                      <button
                        key={flatIdx}
                        onClick={() => goTo(pos)}
                        aria-label={`שאלה ${flatIdx + 1}${isCorrect ? ', נכונה' : ', שגויה'}`}
                        className={`w-7 h-7 rounded-sm text-xs font-bold transition-all border ${
                          pos === currentIndex
                            ? 'bg-exam-accent text-exam-accent-ink border-exam-accent scale-110'
                            : isCorrect
                            ? 'bg-exam-sage-bg text-exam-sage-strong border-transparent'
                            : 'bg-exam-wrong-bg text-exam-wrong border-transparent'
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
                  className="px-4 py-2 rounded-sm border border-exam-border text-exam-ink-soft disabled:opacity-40 hover:bg-exam-paper-alt text-sm"
                >
                  <span className="inline-flex items-center gap-1">הבא<ChevronLeft className="w-4 h-4" aria-hidden /></span>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
