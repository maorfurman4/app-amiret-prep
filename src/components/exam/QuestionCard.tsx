'use client';

import { useState, useEffect } from 'react';
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
}

const OPTION_LABELS = ['1', '2', '3', '4'];

export function QuestionCard({
  question,
  questionNumber,
  totalInSection,
  selectedAnswer,
  onSelect,
  isPractice = false,
  showResult = false,
}: QuestionCardProps) {
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => { setHintVisible(false); }, [question.id]);
  const explanation = isPractice && showResult ? parseExplanation(question.explanation) : null;
  const hintStrategy = (question as Question & { hint?: string }).hint
    ?? parseExplanation(question.explanation)?.strategy
    ?? null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Question header */}
      <div className="flex items-center justify-between mb-4" dir="rtl">
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          שאלה {questionNumber} מתוך {totalInSection}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: totalInSection }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < questionNumber - 1 ? 'bg-blue-500' :
                i === questionNumber - 1 ? 'bg-blue-700' :
                'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Passage for reading comprehension */}
      {question.passage && (
        <div dir="ltr" className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm leading-relaxed text-slate-700 dark:text-slate-300 font-medium max-h-56 overflow-y-auto text-left">
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-2 font-normal">Reading Passage</div>
          {question.passage.text}
        </div>
      )}

      {/* Restatement — amber banner + original sentence */}
      {question.type === 'restatement' && (
        <div className="mb-6 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-r-4 border-amber-400 dark:border-amber-600 rounded-xl" dir="rtl">
          <div className="text-xs text-amber-700 dark:text-amber-400 font-bold mb-2 uppercase tracking-wide">
            📌 המשפט המקורי — מצא את הניסוח השקול:
          </div>
          <div className="text-base font-semibold text-amber-900 dark:text-amber-100 leading-relaxed" dir="ltr">
            {question.text}
          </div>
        </div>
      )}

      {/* Question text */}
      {question.type !== 'restatement' && (
        <div dir="ltr" className="mb-6 text-lg font-semibold text-slate-900 dark:text-white leading-relaxed text-left">
          {question.text}
        </div>
      )}

      {/* Options — English answers are always laid out LTR */}
      <div className="space-y-3" dir="ltr">
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
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                showCorrect  ? 'border-green-500 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300' :
                isWrong      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300' :
                isSelected   ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-medium' :
                               'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:border-blue-300 hover:bg-blue-50/40 dark:hover:bg-slate-700'
              }`}
            >
              <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                showCorrect  ? 'border-green-500 bg-green-500 text-white' :
                isWrong      ? 'border-red-500 bg-red-500 text-white' :
                isSelected   ? 'border-blue-500 bg-blue-500 text-white' :
                               'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
              }`}>
                {OPTION_LABELS[i]}
              </span>
              <span className="flex-1">{option.text}</span>
              {showResult && isCorrect && <span className="text-green-600 font-bold">✓</span>}
              {isWrong && <span className="text-red-500 font-bold">✗</span>}
            </button>
          );
        })}
      </div>

      {/* Hint — practice only, before answer */}
      {isPractice && !showResult && hintStrategy && (
        <div className="mt-4" dir="rtl">
          {!hintVisible ? (
            <button
              onClick={() => setHintVisible(true)}
              className="text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <span>💡</span>
              <span>רמז — כיוון לפתרון</span>
            </button>
          ) : (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">💡</span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">רמז — כיוון לפתרון</span>
              </div>
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{hintStrategy}</p>
            </div>
          )}
        </div>
      )}

      {/* Practice explanation — after answer */}
      {isPractice && showResult && explanation && (
        <div className="mt-6 space-y-3" dir="rtl">
          <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✅</span>
              <span className="font-bold text-green-800 dark:text-green-300 text-sm">מדוע התשובה הנכונה נכונה</span>
            </div>
            <p className="text-green-900 dark:text-green-200 text-sm leading-relaxed">{explanation.correct_reason}</p>
          </div>

          {explanation.options_analysis.length > 0 && (
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-3">🔍 שלבי שלילה:</div>
              <div className="space-y-2">
                {question.options.map((opt, i) => {
                  const correct = i === question.correct_answer;
                  return (
                    <div
                      key={i}
                      className={`flex gap-3 text-sm p-2.5 rounded-lg ${correct ? 'bg-green-50 dark:bg-green-950/30' : 'bg-red-50/60 dark:bg-red-950/20'}`}
                    >
                      <span className={`font-bold text-xs mt-0.5 flex-shrink-0 ${correct ? 'text-green-600' : 'text-red-400'}`}
                        style={{ minWidth: '4.5rem' }}>
                        {correct ? `✅ שלב ${i+1}: בחר` : `❌ שלב ${i+1}: שלל`}
                      </span>
                      <div dir="ltr" className="flex-1">
                        <span className="font-medium text-slate-800 dark:text-slate-100">{opt.text}</span>
                        {explanation.options_analysis[i] && (
                          <p className={`mt-1 text-xs leading-relaxed ${correct ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} dir="rtl">
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
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💡</span>
                <span className="font-bold text-blue-800 dark:text-blue-300 text-sm">טיפ אסטרטגי</span>
              </div>
              <p className="text-blue-900 dark:text-blue-200 text-sm leading-relaxed">{explanation.strategy}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
