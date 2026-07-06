'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { BackNav } from '@/components/BackNav';
import { classifyScore, type Question, type QuestionType } from '@/types/exam';
import { estimateThetaEAP, thetaToScore, routeNextDifficulty } from '@/lib/adaptive';

/**
 * Quick adaptive diagnostic: 3 stages × 4 questions (~10 minutes).
 * Stage 1: sentence completion at level 3; each next stage is routed
 * by the cumulative IRT theta — the same 3PL model as the full exam.
 * Pure statistics, no AI.
 */

type Stage = { type: QuestionType; label: string };
const STAGES: Stage[] = [
  { type: 'sentence_completion', label: 'השלמת משפטים' },
  { type: 'restatement', label: 'ניסוח מחדש' },
  { type: 'sentence_completion', label: 'השלמת משפטים' },
];
const PER_STAGE = 4;

type Phase = 'intro' | 'loading' | 'answering' | 'done' | 'error';

export default function DiagnosticPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [stageIdx, setStageIdx] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);      // current stage
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [doneQuestions, setDoneQuestions] = useState<Question[]>([]); // all answered
  const [doneAnswers, setDoneAnswers] = useState<number[]>([]);
  const [levelsSeen, setLevelsSeen] = useState<number[]>([]);

  const thetaOf = (qs: Question[], ans: number[]) =>
    qs.length === 0 ? 0 : estimateThetaEAP(
      qs.map(q => ({ a: q.a, b: q.b, c: q.c })),
      qs.map((q, i) => (ans[i] === q.correct_answer ? 1 : 0)),
    );

  const loadStage = async (idx: number, allQs: Question[], allAns: number[]) => {
    setPhase('loading');
    const level = idx === 0 ? 3 : routeNextDifficulty(thetaOf(allQs, allAns));
    try {
      const res = await fetch(`/api/practice/questions?type=${STAGES[idx].type}&difficulty=${level}&count=5`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { questions: Question[] };
      const seenIds = new Set(allQs.map(q => q.id));
      const fresh = data.questions.filter(q => !seenIds.has(q.id)).slice(0, PER_STAGE);
      if (fresh.length === 0) throw new Error();
      setQuestions(fresh);
      setLevelsSeen(prev => [...prev, level]);
      setQIdx(0);
      setSelected(null);
      setStageIdx(idx);
      setPhase('answering');
    } catch {
      setPhase('error');
    }
  };

  const handleNext = () => {
    if (selected === null) return;
    const newDoneQs = [...doneQuestions, questions[qIdx]];
    const newDoneAns = [...doneAnswers, selected];
    setDoneQuestions(newDoneQs);
    setDoneAnswers(newDoneAns);
    setSelected(null);

    if (qIdx < questions.length - 1) {
      setQIdx(qIdx + 1);
    } else if (stageIdx < STAGES.length - 1) {
      loadStage(stageIdx + 1, newDoneQs, newDoneAns);
    } else {
      setPhase('done');
    }
  };

  const totalAnswered = doneQuestions.length;
  const totalPlanned = STAGES.length * PER_STAGE;

  /* ── Intro ── */
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir="rtl">
        <BackNav backHref="/" backLabel="דף הבית" />
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg text-center space-y-6">
            <div className="text-5xl">🩺</div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">אבחון רמה מהיר</h1>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              12 שאלות אדפטיביות בכ-10 דקות. השאלות מתאימות את עצמן לרמה שלך תוך כדי —
              בדיוק כמו במבחן האמיתי — ובסוף תקבל רמה מאובחנת, ציון משוער והמלצה מאיפה להתחיל.
            </p>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400 text-right space-y-1.5">
              <div>✏️ 8 שאלות השלמת משפטים + 🔄 4 ניסוח מחדש</div>
              <div>⏱️ ללא טיימר — אבל נסה לענות בקצב טבעי</div>
              <div>📊 האבחון מבוסס על אותו מודל סטטיסטי (IRT) של המבחן המלא</div>
            </div>
            <button
              onClick={() => loadStage(0, [], [])}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-lg font-bold transition-colors"
            >
              התחל אבחון
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center" dir="rtl">
        <div className="text-slate-400 dark:text-slate-500">מתאים את השאלות הבאות לרמה שלך...</div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3">
          <div className="text-red-500">שגיאה בטעינת שאלות</div>
          <button onClick={() => loadStage(stageIdx, doneQuestions, doneAnswers)} className="text-blue-600 underline text-sm">נסה שוב</button>
        </div>
      </div>
    );
  }

  /* ── Results ── */
  if (phase === 'done') {
    const theta = thetaOf(doneQuestions, doneAnswers);
    const score = thetaToScore(theta);
    const level = routeNextDifficulty(theta);
    const band = classifyScore(score);

    const byType: Record<string, { correct: number; total: number }> = {};
    doneQuestions.forEach((q, i) => {
      const t = q.type;
      if (!byType[t]) byType[t] = { correct: 0, total: 0 };
      byType[t].total++;
      if (doneAnswers[i] === q.correct_answer) byType[t].correct++;
    });
    const TYPE_LABELS: Record<string, string> = { sentence_completion: 'השלמת משפטים', restatement: 'ניסוח מחדש' };
    const weakest = Object.entries(byType).sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];
    const weakLabel = weakest ? TYPE_LABELS[weakest[0]] : '';
    const weakTipHref = weakest?.[0] === 'restatement' ? '/tips/restatement' : '/tips/sentence-completion';
    const totalCorrect = doneAnswers.filter((a, i) => a === doneQuestions[i].correct_answer).length;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-8" dir="rtl">
        <div className="max-w-lg mx-auto space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-2">🩺</div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">תוצאות האבחון</h1>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">הרמה המאובחנת שלך</div>
            <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">רמה {level}/5</div>
            <div className={`text-lg font-bold ${band.color}`}>ציון משוער: ~{score} — {band.label}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {totalCorrect}/{totalAnswered} נכונות · נותבת דרך רמות {levelsSeen.join(' ← ')}
            </div>
          </div>

          {/* Per-type breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm mb-3">פירוט לפי סוג שאלה</h2>
            <div className="space-y-3">
              {Object.entries(byType).map(([t, d]) => {
                const pct = Math.round((d.correct / d.total) * 100);
                return (
                  <div key={t}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 dark:text-slate-200">{TYPE_LABELS[t]}</span>
                      <span className="text-slate-500 dark:text-slate-400">{d.correct}/{d.total}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
            <h2 className="font-bold text-blue-900 dark:text-blue-300 text-sm mb-2">💡 מאיפה להתחיל</h2>
            <ul className="text-sm text-blue-900 dark:text-blue-200 space-y-1.5 leading-relaxed">
              {weakest && weakest[1].correct / weakest[1].total < 0.75 && (
                <li>• הנקודה החלשה שלך: <span className="font-bold">{weakLabel}</span> — קרא את <Link href={weakTipHref} className="underline font-semibold">מדריך הטכניקה</Link> ו<Link href={`/practice?type=${weakest[0]}&difficulty=${level}`} className="underline font-semibold">תרגל אותה ממוקד ברמה {level}</Link>.</li>
              )}
              <li>• תרגל ב<Link href={`/practice?type=sentence_completion&difficulty=${level}`} className="underline font-semibold">תרגול ממוקד</Link> ברמה {level}{level < 5 ? ` ואז עלה ל-${level + 1}` : ''}.</li>
              <li>• כשאתה מרגיש מוכן — <Link href="/exam" className="underline font-semibold">מבחן מלא</Link> ייתן ציון מדויק יותר (כולל הבנת הנקרא).</li>
              {score < 100 && <li>• חזק את הבסיס עם <Link href="/vocabulary" className="underline font-semibold">אוצר המילים</Link> — 10 דקות ביום.</li>}
            </ul>
          </div>

          <div className="flex gap-3">
            <Link href="/exam" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-center transition-colors">למבחן מלא</Link>
            <Link href="/practice" className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-700">לתרגול ממוקד</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Answering ── */
  const q = questions[qIdx];
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">🩺 אבחון מהיר</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">{STAGES[stageIdx].label}</span>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{totalAnswered + 1}/{totalPlanned}</span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(totalAnswered / totalPlanned) * 100}%` }} />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <QuestionCard
          question={q}
          questionNumber={qIdx + 1}
          totalInSection={questions.length}
          selectedAnswer={selected}
          onSelect={setSelected}
        />
        <div className="mt-8 flex justify-start">
          <button
            onClick={handleNext}
            disabled={selected === null}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {totalAnswered + 1 === totalPlanned ? 'סיים וקבל אבחון ✓' : 'הבא ‹'}
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          אין כאן נכון/לא נכון מיידי — ענה לפי תחושת הבטן, בדיוק כמו במבחן.
        </p>
      </main>
    </div>
  );
}
