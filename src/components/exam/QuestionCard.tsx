'use client';

import { useState } from 'react';
import { Check, X, Lightbulb, CheckCircle2, XCircle, ListChecks } from 'lucide-react';
import type { Question } from '@/types/exam';

interface ExplanationData {
  correct_reason: string;
  options_analysis: string[];
  strategy: string;
}

function parseExplanation(raw: string | undefined): ExplanationData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ExplanationData;
    if (parsed.correct_reason && Array.isArray(parsed.options_analysis)) return parsed;
  } catch {
    return { correct_reason: raw, options_analysis: [], strategy: '' };
  }
  return null;
}

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalInSection: number;
  selectedAnswer: number | null;
  onSelect: (index: number) => void;
  isPractice?: boolean;
  showResult?: boolean;
  hideHeader?: boolean;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function QuestionCard({
  question,
  questionNumber,
  totalInSection,
  selectedAnswer,
  onSelect,
  isPractice = false,
  showResult = false,
  hideHeader = false,
}: QuestionCardProps) {
  const [hintQuestionId, setHintQuestionId] = useState<string | null>(null);
  const hintVisible = hintQuestionId === question.id;
  const explanation = isPractice && showResult ? parseExplanation(question.explanation) : null;
  const hintStrategy = (question as Question & { hint?: string }).hint
    ?? parseExplanation(question.explanation)?.strategy
    ?? null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Question header — omitted when the parent page already shows question progress */}
      {!hideHeader && (
        <div className="flex items-center justify-between mb-5" dir="rtl">
          <span className="text-sm text-exam-ink-soft font-medium">
            שאלה {questionNumber} מתוך {totalInSection}
          </span>
          {/* Ultra-thin progress bar — replaces the old dot row */}
          <div className="w-28 h-[3px] bg-exam-border rounded-full overflow-hidden">
            <div
              className="h-full bg-exam-ink transition-all duration-300"
              style={{ width: `${(questionNumber / totalInSection) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Passage for reading comprehension — paper-like box, serif, LTR */}
      {question.passage && (
        <div
          dir="ltr"
          lang="en"
          className="font-serif mb-6 p-5 bg-exam-paper-alt border border-exam-border rounded-md text-[15px] leading-[1.75] text-exam-ink max-h-56 overflow-y-auto text-left"
        >
          <div className="font-sans text-[11px] uppercase tracking-wider text-exam-ink-soft mb-2 not-italic">
            Reading Passage
          </div>
          {question.passage.text}
        </div>
      )}

      {/* Restatement — original sentence to reformulate */}
      {question.type === 'restatement' && (
        <div className="mb-6 px-4 py-3 bg-exam-paper-alt border border-exam-border border-r-[3px] border-r-exam-ink rounded-sm" dir="rtl">
          <div className="text-xs text-exam-ink-soft font-semibold mb-2 uppercase tracking-wide">
            המשפט המקורי — מצא את הניסוח השקול
          </div>
          <div dir="ltr" lang="en" className="font-serif text-lg text-exam-ink leading-relaxed text-left">
            {question.text}
          </div>
        </div>
      )}

      {/* Question text */}
      {question.type !== 'restatement' && (
        <div dir="ltr" lang="en" className="font-serif mb-6 text-lg text-exam-ink leading-relaxed text-left">
          {question.text}
        </div>
      )}

      {/* Options — flat, tactile, English answers laid out LTR */}
      <div className="space-y-2.5" dir="ltr">
        {question.options.map((option, i) => {
          const isSelected = selectedAnswer === i;
          const isCorrect = question.correct_answer === i;
          const isWrong = showResult && isSelected && !isCorrect;
          const showCorrect = showResult && isCorrect;

          return (
            <button
              key={option.id ?? i}
              onClick={() => onSelect(i)}
              disabled={showResult}
              className={`w-full text-left px-4 py-3 rounded-sm border transition-colors flex items-center gap-3 ${
                showCorrect  ? 'border-exam-sage bg-exam-sage-bg text-exam-sage-strong' :
                isWrong      ? 'border-exam-wrong bg-exam-wrong-bg text-exam-wrong' :
                isSelected   ? 'border-exam-accent bg-exam-paper-alt text-exam-ink font-medium' :
                               'border-exam-border bg-exam-surface text-exam-ink hover:bg-exam-paper-alt hover:border-exam-border-strong'
              }`}
            >
              <span className={`flex-shrink-0 w-7 h-7 rounded-sm border flex items-center justify-center text-xs font-semibold font-sans ${
                showCorrect  ? 'border-exam-sage bg-exam-sage text-on-emerald' :
                isWrong      ? 'border-exam-wrong bg-exam-wrong text-on-danger' :
                isSelected   ? 'border-exam-accent bg-exam-accent text-exam-accent-ink' :
                               'border-exam-border text-exam-ink-soft'
              }`}>
                {OPTION_LABELS[i]}
              </span>
              <span className="flex-1 font-serif">{option.text}</span>
              {showResult && isCorrect && <Check className="w-4 h-4 text-exam-sage flex-shrink-0" strokeWidth={3} aria-hidden />}
              {isWrong && <X className="w-4 h-4 text-exam-wrong flex-shrink-0" strokeWidth={3} aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* Hint — practice only, before answer */}
      {isPractice && !showResult && hintStrategy && (
        <div className="mt-4" dir="rtl">
          {!hintVisible ? (
            <button
              onClick={() => setHintQuestionId(question.id)}
              className="text-sm text-exam-alt hover:opacity-80 flex items-center gap-1.5 transition-opacity"
            >
              <Lightbulb className="w-4 h-4" aria-hidden />
              <span>רמז — כיוון לפתרון</span>
            </button>
          ) : (
            <div className="p-3 bg-exam-alt-bg border border-exam-alt/40 rounded-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="w-4 h-4 text-exam-alt" aria-hidden />
                <span className="text-xs font-bold text-exam-alt">רמז — כיוון לפתרון</span>
              </div>
              <p className="text-sm text-exam-ink leading-relaxed">{hintStrategy}</p>
            </div>
          )}
        </div>
      )}

      {/* Practice explanation — after answer */}
      {isPractice && showResult && explanation && (
        <div className="mt-6 space-y-3" dir="rtl">
          <div className="p-4 bg-exam-sage-bg border border-exam-sage/40 rounded-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-exam-sage-strong" aria-hidden />
              <span className="font-bold text-exam-sage-strong text-sm">מדוע התשובה הנכונה נכונה</span>
            </div>
            <p className="text-exam-ink text-sm leading-relaxed">{explanation.correct_reason}</p>
          </div>

          {explanation.options_analysis.length > 0 && (
            <div className="p-4 bg-exam-surface border border-exam-border rounded-sm">
              <div className="font-bold text-exam-ink text-sm mb-3 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4" aria-hidden />
                שלבי שלילה:
              </div>
              <div className="space-y-2">
                {question.options.map((opt, i) => {
                  const correct = i === question.correct_answer;
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 text-sm p-2.5 rounded-sm ${correct ? 'bg-exam-sage-bg' : 'bg-exam-wrong-bg'}`}
                    >
                      <span className={`font-bold text-xs mt-0.5 flex-shrink-0 flex items-center gap-1 ${correct ? 'text-exam-sage-strong' : 'text-exam-wrong'}`}
                        style={{ minWidth: '4.5rem' }}>
                        {correct
                          ? <><CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />{`שלב ${i+1}: בחר`}</>
                          : <><XCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />{`שלב ${i+1}: שלל`}</>}
                      </span>
                      <div dir="ltr" lang="en" className="flex-1">
                        <span className="font-serif font-medium text-exam-ink">{opt.text}</span>
                        {explanation.options_analysis[i] && (
                          <p className={`mt-1 text-xs leading-relaxed font-sans ${correct ? 'text-exam-sage-strong' : 'text-exam-wrong'}`} dir="rtl">
                            {explanation.options_analysis[i]}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {explanation.strategy && (
            <div className="p-4 bg-exam-paper-alt border border-exam-border rounded-sm">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-exam-ink" aria-hidden />
                <span className="font-bold text-exam-ink text-sm">טיפ אסטרטגי</span>
              </div>
              <p className="text-exam-ink text-sm leading-relaxed">{explanation.strategy}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
