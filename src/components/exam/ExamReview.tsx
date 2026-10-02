'use client';

import { useRef, useState, type ReactNode } from 'react';
import { PartyPopper, ClipboardList, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { isCorrectAnswer, type Question } from '@/types/exam';
import { heCount, agree } from '@/lib/hebrew-count';

type Filter = 'all' | 'wrong' | 'correct';

interface ExamReviewProps<Q extends Question> {
  questions: Q[];
  selectedAnswers: (number | null)[];
  /** Header back button: label and action (e.g. back to the results). */
  backLabel: string;
  onBack: () => void;
  /** The small line above the question card (section/type, position, time). */
  renderMeta: (question: Q, index: number) => ReactNode;
  /** Shown under a wrong answer's card — the error-cause tagger. */
  renderWrongExtra?: (question: Q, index: number) => ReactNode;
  /** Empty "correct" filter copy, e.g. "במבחן הזה אין תשובות נכונות". */
  noCorrectText: string;
}

/**
 * "סקירת מבחן": filter tabs (all / wrong / correct), one question at a time
 * with its answer and explanation, and numbered cubes (green = correct,
 * red = wrong) to jump between questions — a sidebar on desktop, a grid
 * under the question on mobile. Shared by the exam review and practice's
 * speed-mode results.
 */
export function ExamReview<Q extends Question>({
  questions, selectedAnswers, backLabel, onBack, renderMeta, renderWrongExtra, noCorrectText,
}: ExamReviewProps<Q>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const questionRef = useRef<HTMLDivElement>(null);

  const correctAt = (i: number) => isCorrectAnswer(questions[i], selectedAnswers[i] ?? null);
  const wrongCount = questions.filter((_, i) => !correctAt(i)).length;
  const correctCount = questions.length - wrongCount;

  // Filtered indices
  const filteredIndices = questions
    .map((_, i) => ({ i, correct: correctAt(i) }))
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

  return (
    <div className="min-h-dvh bg-exam-paper" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-sm font-bold text-exam-ink">סקירת מבחן</h1>
              <div className="text-xs text-exam-ink-soft">
                {filteredIndices.length === 0
                  ? (filter === 'wrong' ? 'אין שאלות שגויות' : filter === 'correct' ? 'אין תשובות נכונות' : 'אין שאלות')
                  : <>
                      {heCount(filteredIndices.length, 'question')}
                      {filter === 'wrong' ? ` ${agree(filteredIndices.length, 'שגויה', 'שגויות')}` : filter === 'correct' ? ` ${agree(filteredIndices.length, 'נכונה', 'נכונות')}` : ''}
                    </>}
              </div>
            </div>
            <button
              onClick={onBack}
              className="hit-44 text-sm text-exam-accent hover:underline"
            >
              <span className="inline-flex items-center gap-1"><ArrowRight className="w-4 h-4" aria-hidden />{backLabel}</span>
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
                aria-pressed={filter === opt.value}
                onClick={() => { setFilter(opt.value); setCurrentIndex(0); }}
                className={`hit-44 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors border ${
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
              const isCorrect = correctAt(flatIdx);
              return (
                <button
                  key={flatIdx}
                  onClick={() => goTo(pos)}
                  aria-label={`שאלה ${flatIdx + 1}${isCorrect ? ', נכונה' : ', שגויה'}`}
                  aria-current={pos === currentIndex ? 'step' : undefined}
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
        <main id="main" className="flex-1 min-w-0">
          {filteredIndices.length === 0 ? (
            <div className="text-center py-20 text-exam-ink-soft">
              {filter === 'wrong'
                ? <PartyPopper className="w-10 h-10 mx-auto mb-3" strokeWidth={1.5} aria-hidden />
                : <ClipboardList className="w-10 h-10 mx-auto mb-3" strokeWidth={1.5} aria-hidden />}
              <div>{filter === 'wrong' ? 'ענית נכון על הכול. אין כאן טעויות לסקור!' : filter === 'correct' ? noCorrectText : 'אין כאן שאלות לסקור'}</div>
            </div>
          ) : (
            <>
              <div ref={questionRef}>
                <div className="text-xs text-exam-ink-soft mb-3 flex flex-wrap items-center gap-2">
                  {renderMeta(question, currentFlatIndex)}
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
                {!correctAt(currentFlatIndex) && renderWrongExtra?.(question, currentFlatIndex)}
              </div>

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => goTo(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="hit-44 px-4 py-2 rounded-sm border border-exam-border text-exam-ink-soft disabled:opacity-40 hover:bg-exam-paper-alt text-sm"
                >
                  <span className="inline-flex items-center gap-1"><ChevronRight className="w-4 h-4" aria-hidden />קודם</span>
                </button>

                {/* Mobile dot nav */}
                <div className="flex gap-1.5 md:hidden flex-wrap justify-center max-w-xs">
                  {filteredIndices.map((flatIdx, pos) => {
                    const isCorrect = correctAt(flatIdx);
                    return (
                      <button
                        key={flatIdx}
                        onClick={() => goTo(pos)}
                        aria-label={`שאלה ${flatIdx + 1}${isCorrect ? ', נכונה' : ', שגויה'}`}
                        aria-current={pos === currentIndex ? 'step' : undefined}
                        className={`hit-44 w-7 h-7 rounded-sm text-xs font-bold transition-all border ${
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
                  className="hit-44 px-4 py-2 rounded-sm border border-exam-border text-exam-ink-soft disabled:opacity-40 hover:bg-exam-paper-alt text-sm"
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
