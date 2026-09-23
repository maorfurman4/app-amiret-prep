'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Stethoscope, PenLine, RotateCcw, Timer, BarChart3, Check, Lightbulb } from 'lucide-react';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { BackNav } from '@/components/BackNav';
import { AuthCTA } from '@/components/AuthCTA';
import { classifyScore, isCorrectAnswer, type Question, type QuestionType } from '@/types/exam';
import { estimateThetaEAP, thetaToScore, routeNextDifficulty } from '@/lib/adaptive';
import { authFetch } from '@/lib/auth-fetch';
import { ensureGuestIdentity } from '@/lib/guest';

/**
 * Quick adaptive diagnostic: 4 stages × 3 questions (~10 minutes),
 * alternating sentence completion / restatement (see STAGES below).
 * Stage 1 starts at level 3; each next stage is routed by the
 * cumulative IRT theta — the same 3PL model as the full exam.
 * Pure statistics, no AI.
 */

type Stage = { type: QuestionType; label: string };
// 6/6 split between the two types the diagnostic can adaptively route
// within (no reading comprehension — that always requires a full 5-question
// passage, which would roughly double the diagnostic's length). Previously
// 8 sentence-completion / 4 restatement, which made the restatement
// per-category score swing by 25% per question — too noisy to act on.
const STAGES: Stage[] = [
  { type: 'sentence_completion', label: 'השלמת משפטים' },
  { type: 'restatement', label: 'ניסוח מחדש' },
  { type: 'sentence_completion', label: 'השלמת משפטים' },
  { type: 'restatement', label: 'ניסוח מחדש' },
];
const PER_STAGE = 3;
const LOW_SAMPLE_THRESHOLD = 5;

type Phase = 'intro' | 'loading' | 'answering' | 'done' | 'error';

export default function DiagnosticPage() {
  // Guest identity is a signed, HttpOnly cookie the server issues — this
  // just makes sure it exists before the first request on a page a guest
  // might land on directly (see src/lib/guest.ts).
  useEffect(() => { ensureGuestIdentity().catch(() => {}); }, []);

  const [phase, setPhase] = useState<Phase>('intro');

  // Warn before leaving mid-diagnostic — unlike the real exam, this has no
  // server session or localStorage draft, so a refresh or accidental
  // navigation loses the whole ~10-minute run with no way to resume it.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (phase === 'loading' || phase === 'answering') {
        e.preventDefault();
        e.returnValue = 'אם תצא עכשיו, האבחון לא יישמר ותצטרך להתחיל מחדש. לצאת בכל זאת?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase]);
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
      qs.map((q, i) => (isCorrectAnswer(q, ans[i]) ? 1 : 0)),
    );

  const loadStage = async (idx: number, allQs: Question[], allAns: number[]) => {
    setPhase('loading');
    const level = idx === 0 ? 3 : routeNextDifficulty(thetaOf(allQs, allAns));
    try {
      const guestId = localStorage.getItem('amiret_guest_id') ?? '';
      const gidParam = guestId ? `&guestId=${encodeURIComponent(guestId)}` : '';
      // deferSeen=1: we over-fetch 10 candidates to survive same-run overlap
      // filtering below but only ever show 3 of them — marking all 10 "seen"
      // would burn 7 questions the user never actually saw from the shared
      // pool every stage. We tell the server which 3 were really used right
      // after picking them (fire-and-forget; losing this call only means
      // those 3 might resurface a little sooner, never a broken session).
      const res = await authFetch(`/api/practice/questions?type=${STAGES[idx].type}&difficulty=${level}&count=10&deferSeen=1${gidParam}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { questions: Question[] };
      const seenIds = new Set(allQs.map(q => q.id));
      const fresh = data.questions.filter(q => !seenIds.has(q.id)).slice(0, PER_STAGE);
      // Stage 1 and 3 share a question type (sentence_completion), so the fetched
      // batch can partially overlap with stage 1's questions. Requesting 10
      // candidates instead of 5 makes that rare, but if it still happens, fail
      // into the existing error/retry screen rather than silently serving a
      // short stage (this caused diagnostic sessions to end at 11/12 instead
      // of 12/12, with a wrong "X מתוך Y" count on the final stage).
      if (fresh.length < PER_STAGE) throw new Error();
      authFetch('/api/practice/questions/mark-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: fresh.map(q => q.id) }),
      }).catch(() => {});
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
      const guestId = localStorage.getItem('amiret_guest_id') ?? 'guest';
      authFetch('/api/activity/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, source: 'diagnostic', units: newDoneQs.length }),
      }).catch(() => {});
      newDoneQs.forEach((q, i) => {
        authFetch('/api/review-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId, questionId: q.id, wasCorrect: isCorrectAnswer(q, newDoneAns[i]) }),
        }).catch(() => {});
      });
    }
  };

  const totalAnswered = doneQuestions.length;
  const totalPlanned = STAGES.length * PER_STAGE;

  /* ── Intro ── */
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
        <BackNav backHref="/" backLabel="דף הבית" />
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg text-center space-y-6">
            <Stethoscope className="w-12 h-12 mx-auto text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-3xl font-bold text-exam-ink">אבחון רמה מהיר</h1>
            <p className="text-exam-ink-soft leading-relaxed">
              12 שאלות אדפטיביות בכ-10 דקות. השאלות מתאימות את עצמן לרמה שלך תוך כדי,
              ובסוף תקבל הערכת רמה פנימית והמלצה מאיפה להתחיל. זהו אבחון קצר, לא סימולציה של הבחינה.
            </p>
            <div className="bg-exam-surface rounded-md border border-exam-border p-4 text-sm text-exam-ink-soft text-right space-y-1.5">
              <div className="flex items-center gap-2"><PenLine className="w-4 h-4 flex-shrink-0" aria-hidden />6 שאלות השלמת משפטים <RotateCcw className="w-4 h-4 flex-shrink-0" aria-hidden />6 ניסוח מחדש</div>
              <div className="flex items-center gap-2"><Timer className="w-4 h-4 flex-shrink-0" aria-hidden />ללא טיימר — אבל נסה לענות בקצב טבעי</div>
              <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 flex-shrink-0" aria-hidden />האבחון משתמש במודל ה-IRT הפנימי של האתר</div>
            </div>
            <button
              onClick={() => loadStage(0, [], [])}
              className="w-full py-4 bg-exam-accent hover:opacity-90 text-exam-accent-ink rounded-md text-lg font-bold transition-opacity"
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
      <div className="min-h-screen bg-exam-paper flex items-center justify-center" dir="rtl">
        <div className="text-exam-ink-soft">מתאים את השאלות הבאות לרמה שלך...</div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-exam-paper flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-3">
          <div className="text-exam-wrong">שגיאה בטעינת שאלות</div>
          <button onClick={() => loadStage(stageIdx, doneQuestions, doneAnswers)} className="text-exam-accent underline text-sm">נסה שוב</button>
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
      if (isCorrectAnswer(q, doneAnswers[i])) byType[t].correct++;
    });
    const TYPE_LABELS: Record<string, string> = { sentence_completion: 'השלמת משפטים', restatement: 'ניסוח מחדש' };
    const weakest = Object.entries(byType).sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];
    const weakLabel = weakest ? TYPE_LABELS[weakest[0]] : '';
    const weakTipHref = weakest?.[0] === 'restatement' ? '/tips/restatement' : '/tips/sentence-completion';
    const totalCorrect = doneAnswers.filter((a, i) => isCorrectAnswer(doneQuestions[i], a)).length;

    return (
      <div className="min-h-screen bg-exam-paper px-4 py-8" dir="rtl">
        <div className="max-w-lg mx-auto space-y-5">
          <div className="text-center">
            <Stethoscope className="w-10 h-10 mx-auto mb-2 text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-2xl font-bold text-exam-ink">תוצאות האבחון</h1>
          </div>

          <div className="bg-exam-surface rounded-md p-6 border border-exam-border text-center">
            <div className="text-sm text-exam-ink-soft mb-1">הרמה המאובחנת שלך</div>
            <div className="text-5xl font-bold text-exam-ink mb-2">רמה {level}/5</div>
            <div className={`text-lg font-bold ${band.color}`}>אומדן פנימי: ~{score} — {band.label}</div>
            <div className="text-xs text-exam-ink-soft mt-2">
              {totalCorrect}/{totalAnswered} נכונות · נותבת דרך רמות {levelsSeen.join(' ← ')}
            </div>
            <div className="text-[11px] text-exam-ink-soft mt-2">
              סף הפטור/הרמה נקבע בנפרד בכל מוסד — {band.label} הוא הטווח הנפוץ, לא תקן מחייב אחיד
            </div>
          </div>

          <AuthCTA message="התחבר כדי לשמור את האבחון הזה ולעקוב אחרי ההתקדמות שלך לאורך זמן." />

          {/* Per-type breakdown */}
          <div className="bg-exam-surface rounded-md p-5 border border-exam-border">
            <h2 className="font-bold text-exam-ink text-sm mb-3">פירוט לפי סוג שאלה</h2>
            <div className="space-y-3">
              {Object.entries(byType).map(([t, d]) => {
                const pct = Math.round((d.correct / d.total) * 100);
                const lowSample = d.total < LOW_SAMPLE_THRESHOLD;
                return (
                  <div key={t}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-exam-ink">{TYPE_LABELS[t]}</span>
                      <span className="text-exam-ink-soft">{d.correct}/{d.total}</span>
                    </div>
                    <div className="h-2 bg-exam-paper-alt rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 75 ? 'bg-exam-sage-strong' : pct >= 50 ? 'bg-exam-alt' : 'bg-exam-wrong'}`} style={{ width: `${pct}%` }} />
                    </div>
                    {lowSample && (
                      <div className="text-[11px] text-exam-ink-soft mt-1">
                        עוד מעט נתונים — {d.total} שאלות בלבד, האחוז עוד לא מדויק מספיק להסתמך עליו
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-exam-alt-bg border border-exam-alt/40 rounded-md p-5">
            <h2 className="font-bold text-exam-ink text-sm mb-2 flex items-center gap-2"><Lightbulb className="w-4 h-4" aria-hidden />מאיפה להתחיל</h2>
            <ul className="text-sm text-exam-ink space-y-1.5 leading-relaxed">
              {weakest && weakest[1].correct / weakest[1].total < 0.75 && (
                <li>• הנקודה החלשה שלך: <span className="font-bold">{weakLabel}</span> — קרא את <Link href={weakTipHref} className="underline font-semibold text-exam-accent">מדריך הטכניקה</Link> ו<Link href={`/practice?type=${weakest[0]}&difficulty=${level}`} className="underline font-semibold text-exam-accent">תרגל אותה ממוקד ברמה {level}</Link>.</li>
              )}
              <li>• תרגל ב<Link href={`/practice?type=sentence_completion&difficulty=${level}`} className="underline font-semibold text-exam-accent">תרגול ממוקד</Link> ברמה {level}{level < 5 ? ` ואז עלה ל-${level + 1}` : ''}.</li>
              <li>• כשאתה מרגיש מוכן — <Link href="/exam" className="underline font-semibold text-exam-accent">סימולציית פרקי הליבה</Link> תיתן אומדן רחב יותר שכולל גם הבנת הנקרא.</li>
              {score < 100 && <li>• חזק את הבסיס עם <Link href="/vocabulary" className="underline font-semibold text-exam-accent">אוצר המילים</Link> — 10 דקות ביום.</li>}
            </ul>
          </div>

          <div className="flex gap-3">
            <Link href="/exam" className="flex-1 py-3 bg-exam-accent hover:opacity-90 text-exam-accent-ink rounded-sm font-bold text-center transition-opacity">לסימולציית הליבה</Link>
            <Link href="/practice" className="flex-1 py-3 bg-exam-surface border border-exam-border text-exam-ink rounded-sm font-semibold text-center transition-colors hover:bg-exam-paper-alt">לתרגול ממוקד</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Answering ── */
  const q = questions[qIdx];
  return (
    <div className="min-h-screen bg-exam-paper" dir="rtl">
      <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-exam-ink" aria-hidden />
              <span className="text-sm font-bold text-exam-ink">אבחון מהיר</span>
              <span className="text-xs text-exam-ink-soft">{STAGES[stageIdx].label}</span>
            </div>
            <span className="text-xs font-mono text-exam-ink-soft">{totalAnswered + 1}/{totalPlanned}</span>
          </div>
          <div className="h-1.5 bg-exam-paper-alt rounded-full overflow-hidden">
            <div className="h-full bg-exam-accent rounded-full transition-all" style={{ width: `${(totalAnswered / totalPlanned) * 100}%` }} />
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
            className="px-8 py-3 bg-exam-accent text-exam-accent-ink rounded-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {totalAnswered + 1 === totalPlanned
              ? <span className="inline-flex items-center gap-1.5">סיים וקבל אבחון <Check className="w-4 h-4" strokeWidth={3} aria-hidden /></span>
              : 'הבא ‹'}
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-exam-ink-soft">
          אין כאן נכון/לא נכון מיידי — ענה לפי תחושת הבטן, בדיוק כמו במבחן.
        </p>
      </main>
    </div>
  );
}
