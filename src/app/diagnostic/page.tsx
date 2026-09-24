'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Stethoscope, Timer, Gauge, Sparkles, ArrowLeft, BookOpen, Target, type LucideIcon } from 'lucide-react';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { BackNav } from '@/components/BackNav';
import { AuthCTA } from '@/components/AuthCTA';
import { classifyScore, type Question } from '@/types/exam';
import { authFetch } from '@/lib/auth-fetch';
import { DwellTimer, logResponses, responseEntry } from '@/lib/response-log-client';
import { toCanonicalOption } from '@/lib/option-shuffle';
import { ensureGuestIdentity } from '@/lib/guest';
import { DIAGNOSTIC, type DiagnosticState, type DiagnosticType, type StartPlan } from '@/lib/diagnostic-plan';

/**
 * Onboarding diagnostic — a stateless, item-by-item CAT. Every step posts
 * all answers so far to /api/diagnostic/next, which re-scores θ and returns
 * either the next most informative item or the start plan. It ends as soon
 * as θ is known well enough (posterior SD ≤ 0.65; 6–10 items), and the
 * result is one concrete action, not a menu. See src/lib/diagnostic-plan.ts.
 */

type Phase = 'intro' | 'answering' | 'done' | 'error';

type NextResponse =
  | { done: false; state: DiagnosticState; question: Question }
  | { done: true; state: DiagnosticState; plan: StartPlan };

const TYPE_LABEL: Record<DiagnosticType, string> = {
  sentence_completion: 'השלמת משפטים',
  restatement: 'ניסוח מחדש',
};

const TACTILE_PRIMARY = 'bg-exam-accent text-exam-accent-ink rounded-2xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] font-bold transition-[box-shadow,transform,opacity] duration-300 ease-spring will-change-transform';

export default function DiagnosticPage() {
  // Guest identity is a signed, HttpOnly cookie the server issues — this
  // just makes sure it exists before the first request (see src/lib/guest.ts).
  useEffect(() => { ensureGuestIdentity().catch(() => {}); }, []);

  const [phase, setPhase] = useState<Phase>('intro');
  const [pending, setPending] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ id: string; chosen: number }[]>([]);
  const [state, setState] = useState<DiagnosticState | null>(null);
  const [plan, setPlan] = useState<StartPlan | null>(null);

  // No server session to resume from — warn before a refresh loses the run.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (phase === 'answering') {
        e.preventDefault();
        e.returnValue = 'אם תצא עכשיו, האבחון לא יישמר ותצטרך להתחיל מחדש. לצאת בכל זאת?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase]);

  // Per-question time on screen, for the responses log's latency.
  const dwellRef = useRef(new DwellTimer());
  useEffect(() => {
    dwellRef.current.focus(phase === 'answering' ? question?.id ?? null : null);
  }, [phase, question]);

  const step = async (sent: { id: string; chosen: number }[]) => {
    setPending(true);
    try {
      const res = await authFetch('/api/diagnostic/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: sent }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json() as NextResponse;
      setAnswers(sent);
      setState(data.state);
      setSelected(null);
      if (data.done) {
        setPlan(data.plan);
        setPhase('done');
      } else {
        setQuestion(data.question);
        setPhase('answering');
      }
    } catch {
      setPhase('error');
    } finally {
      setPending(false);
    }
  };

  const handleNext = () => {
    if (selected === null || !question || pending) return;
    const chosen = toCanonicalOption(question, selected);
    if (chosen === null) return;
    logResponses([responseEntry(question, selected, 'diagnostic', dwellRef.current.elapsedMs(question.id), {
      thetaBefore: state?.theta ?? 0,
      sectionIndex: answers.length + 1,
    })]);
    step([...answers, { id: question.id, chosen }]);
  };

  /* ── Intro ── */
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
        <BackNav backHref="/" backLabel="דף הבית" />
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg text-center space-y-6 animate-fade-up">
            <Stethoscope className="w-12 h-12 mx-auto text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-3xl font-bold text-exam-ink">מאיפה להתחיל? נגלה ביחד</h1>
            <p className="text-exam-ink-soft leading-relaxed">
              אבחון קצר שמתאים את עצמו אליך אחרי כל תשובה, ונעצר ברגע שיש מספיק ודאות לגבי הרמה שלך.
              בסוף תקבל צעד ראשון אחד וברור — בלי לבחור בעצמך מתוך תפריט.
            </p>
            <div className="bg-exam-surface rounded-2xl shadow-surface border border-exam-border p-4 text-sm text-exam-ink-soft text-right space-y-2">
              <div className="flex items-center gap-2"><Gauge className="w-4 h-4 flex-shrink-0" aria-hidden />{DIAGNOSTIC.minItems}–{DIAGNOSTIC.maxItems} שאלות · בדרך כלל כ-5 דקות</div>
              <div className="flex items-center gap-2"><Target className="w-4 h-4 flex-shrink-0" aria-hidden />השלמת משפטים וניסוח מחדש, לסירוגין</div>
              <div className="flex items-center gap-2"><Timer className="w-4 h-4 flex-shrink-0" aria-hidden />ללא טיימר — ענה בקצב טבעי, ונחש כשאתה לא בטוח</div>
            </div>
            <button
              onClick={() => step([])}
              disabled={pending}
              className={`w-full py-4 text-lg disabled:opacity-60 ${TACTILE_PRIMARY}`}
            >
              {pending ? 'מכין את השאלה הראשונה...' : 'התחל אבחון'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-exam-paper flex items-center justify-center px-4" dir="rtl">
        <div className="text-center space-y-3">
          <div className="text-exam-wrong">שגיאה בטעינת השאלה הבאה</div>
          <button onClick={() => step(answers)} disabled={pending} className="text-exam-accent underline text-sm">
            {pending ? 'מנסה שוב...' : 'נסה שוב'}
          </button>
        </div>
      </div>
    );
  }

  /* ── Results ── */
  if (phase === 'done' && plan) {
    return <PlanScreen plan={plan} answered={answers.length} />;
  }

  /* ── Answering ── */
  const progressPct = Math.round((state?.progress ?? 0) * 100);
  const isLastPossible = answers.length + 1 >= DIAGNOSTIC.maxItems;
  return (
    <div className="min-h-screen bg-exam-paper" dir="rtl">
      <header className="sticky top-0 z-10 bg-exam-surface border-b border-exam-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-exam-ink" aria-hidden />
              <span className="text-sm font-bold text-exam-ink">אבחון חכם</span>
              {question && <span className="text-xs text-exam-ink-soft">{TYPE_LABEL[question.type as DiagnosticType]}</span>}
            </div>
            <span className="text-xs text-exam-ink-soft">
              {progressPct >= 80 ? 'כמעט שם' : 'ודאות האבחון'} · {progressPct}%
            </span>
          </div>
          <div
            className="h-1.5 bg-exam-paper-alt rounded-full overflow-hidden"
            role="progressbar"
            aria-label="ודאות האבחון"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
          >
            <div className="h-full bg-exam-accent rounded-full transition-[width] duration-700 ease-spring-soft" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {question && (
          <QuestionCard
            key={question.id}
            question={question}
            questionNumber={answers.length + 1}
            totalInSection={DIAGNOSTIC.maxItems}
            selectedAnswer={selected}
            onSelect={setSelected}
            hideHeader
          />
        )}
        <div className="mt-8 flex justify-start">
          <button
            onClick={handleNext}
            disabled={selected === null || pending}
            className={`px-8 py-3 disabled:opacity-40 disabled:shadow-none disabled:translate-y-0 ${TACTILE_PRIMARY}`}
          >
            {pending ? 'רגע...' : isLastPossible ? 'סיים וקבל תוכנית' : 'הבא ‹'}
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-exam-ink-soft">
          אין כאן נכון/לא נכון מיידי — ענה לפי תחושת הבטן, בדיוק כמו במבחן. השאלה הבאה נבחרת לפי התשובה הזו.
        </p>
      </main>
    </div>
  );
}

/* ─── Results: one action first, context second ─────────────────────────── */

function PlanScreen({ plan, answered }: { plan: StartPlan; answered: number }) {
  const band = classifyScore(plan.score);
  const [lo, hi] = plan.levelRange;
  const typeLine = plan.byType.map(t => `${TYPE_LABEL[t.type]} ${t.correct}/${t.total}`).join(' · ');

  const next: { icon: LucideIcon; text: string; href: string }[] = [
    {
      icon: Target,
      text: `אחר כך: ${TYPE_LABEL[plan.secondary.type]} ברמה ${plan.secondary.level}`,
      href: plan.secondary.href,
    },
    ...(plan.suggestVocabulary
      ? [{ icon: BookOpen, text: '10 דקות אוצר מילים ביום — הבסיס שמרים את כל השאר', href: '/vocabulary' }]
      : []),
    { icon: Stethoscope, text: 'אחרי כמה ימי תרגול — סימולציית פרקי הליבה', href: '/exam' },
  ];

  return (
    <div className="min-h-screen bg-exam-paper px-4 py-8" dir="rtl">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="text-center animate-fade-up">
          <Sparkles className="w-9 h-9 mx-auto mb-2 text-exam-accent animate-check-pop" strokeWidth={1.5} aria-hidden />
          <h1 className="text-2xl font-bold text-exam-ink">התוכנית שלך מוכנה</h1>
          <p className="text-sm text-exam-ink-soft mt-1">על סמך {answered} שאלות</p>
        </div>

        {/* The one action */}
        <section
          aria-labelledby="start-here"
          className="rounded-2xl border border-exam-accent/40 bg-exam-surface p-5 shadow-raised animate-fade-up"
          style={{ animationDelay: '80ms' }}
        >
          <div className="text-xs font-bold text-exam-accent mb-1">הצעד הראשון שלך</div>
          <h2 id="start-here" className="text-xl font-bold text-exam-ink mb-1">
            {TYPE_LABEL[plan.primary.type]} · רמה {plan.primary.level}
          </h2>
          <p className="text-sm text-exam-ink-soft leading-relaxed mb-4">
            {plan.split
              ? `כאן מצאנו את הפער הכי ברור — ובדיוק כאן תרגול משתלם הכי הרבה.`
              : `5 שאלות בלי טיימר, עם הסבר אחרי כל תשובה. זו רמה שמאתגרת אותך בלי לתסכל.`}
          </p>
          <Link href={plan.primary.href} className={`flex w-full items-center justify-center gap-2 py-3.5 text-base ${TACTILE_PRIMARY}`}>
            התחל כאן
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          </Link>
        </section>

        {/* Where you stand, with honest uncertainty */}
        <section className="rounded-2xl border border-exam-border bg-exam-surface p-5 shadow-surface animate-fade-up" style={{ animationDelay: '160ms' }}>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <div className="text-sm text-exam-ink-soft">הרמה שלך</div>
              <div className="text-3xl font-bold text-exam-ink">רמה {plan.level}/5</div>
            </div>
            <div className="text-left">
              <div className="text-sm text-exam-ink-soft">אומדן פנימי</div>
              <div className={`text-xl font-bold ${band.color}`}>~{plan.score}</div>
            </div>
          </div>
          <div className="flex gap-1.5 mb-2" aria-label={`הטווח הסביר: רמות ${lo} עד ${hi}`}>
            {[1, 2, 3, 4, 5].map(l => (
              <div
                key={l}
                className={`flex-1 h-8 rounded-md flex items-center justify-center text-xs font-bold ${
                  l === plan.level
                    ? 'bg-exam-accent text-exam-accent-ink'
                    : l >= lo && l <= hi
                      ? 'bg-exam-accent/15 text-exam-accent'
                      : 'bg-exam-paper-alt text-exam-ink-soft'
                }`}
              >
                {l}
              </div>
            ))}
          </div>
          <p className="text-xs text-exam-ink-soft leading-relaxed">
            {lo === hi ? `הטווח הסביר: רמה ${lo}.` : `הטווח הסביר: רמות ${lo}–${hi}.`}{' '}
            {plan.split
              ? `מצאנו הבדל מובהק בין סוגי השאלות, ולכן כל סוג מקבל רמה משלו.`
              : `ההבדלים בין סוגי השאלות (${typeLine}) בתוך טווח הרעש של אבחון קצר, ולכן רמה אחת לשניהם.`}{' '}
            המערכת ממשיכה לכייל את הרמה ברקע בכל תרגול. זו הערכה פנימית, לא ציון רשמי.
          </p>
        </section>

        <AuthCTA message="התחבר כדי לשמור את התוכנית ולעקוב אחרי ההתקדמות שלך." />

        {/* Then */}
        <section className="rounded-2xl border border-exam-border bg-exam-surface shadow-surface divide-y divide-exam-border animate-fade-up" style={{ animationDelay: '240ms' }}>
          {next.map(n => (
            <Link key={n.href} href={n.href} className="flex items-center gap-3 p-4 text-sm text-exam-ink hover:bg-exam-paper-alt transition-colors first:rounded-t-2xl last:rounded-b-2xl">
              <n.icon className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
              <span className="flex-1">{n.text}</span>
              <span className="text-exam-ink-soft" aria-hidden>‹</span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
