'use client';

import { useId, useState } from 'react';
import { Award, PartyPopper, Send } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { authFetch } from '@/lib/auth-fetch';
import { addLocalDays, todayLocalStr } from '@/lib/date-local';
import type { TestType } from '@/lib/official-score';

/**
 * Collects the official NITE score once the student's exam date has passed
 * — the data that anchors the app's predictions to reality (every report is
 * stored next to what the app predicted before the test). Designed to cost
 * one number and one tap: test type defaults to AMIRNET, and both "not
 * yet" (snooze a few days) and "prefer not to" (stop asking about this
 * sitting) are first-class, so nobody is nagged into guessing a score.
 */

const SNOOZE_DAYS = 3;
const snoozeKey = (testDate: string) => `amiret_score_prompt_snooze:${testDate}`;

const TEST_TYPES: { value: TestType; label: string }[] = [
  { value: 'amirnet', label: 'אמירנ"ט' },
  { value: 'amiram', label: 'אמיר"ם' },
  { value: 'psychometric', label: 'פסיכומטרי' },
];

const TACTILE = 'transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${dateStr}T00:00:00Z`));
}

function isSnoozed(testDate: string): boolean {
  try {
    const until = localStorage.getItem(snoozeKey(testDate));
    return !!until && until > todayLocalStr();
  } catch {
    return false;
  }
}

type Result = { score: number; prediction: { score: number; pExempt: number | null } | null };

export function OfficialScorePrompt() {
  const { data, patch } = useDashboardSummary();
  const inputId = useId();
  const [testType, setTestType] = useState<TestType>('amirnet');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Set on tapping "not yet"; the stored snooze covers later visits. Read
  // per render (not once at mount) because the summary loads after mount.
  const [hidden, setHidden] = useState(false);

  const prompt = data?.officialScorePrompt;
  if (!result && (!prompt || hidden || isSnoozed(prompt.testDate))) return null;
  const testDate = prompt?.testDate ?? '';

  // Hands the slot back to the exam-date card (which then asks for the next date).
  const close = () => patch({ officialScorePrompt: null });

  const snooze = () => {
    try { localStorage.setItem(snoozeKey(testDate), addLocalDays(todayLocalStr(), SNOOZE_DAYS)); } catch { /* per-device convenience only */ }
    setHidden(true);
  };

  const decline = () => {
    authFetch('/api/official-score/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testDate }),
    }).catch(() => {});
    close();
  };

  const submit = async () => {
    const score = Number(draft);
    if (!Number.isInteger(score) || score < 50 || score > 150) {
      setError('הציון הרשמי הוא מספר שלם בין 50 ל-150');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/official-score', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, testDate, testType }),
      });
      if (!res.ok) { setError('השמירה נכשלה — נסה שוב'); return; }
      const body = await res.json() as Result;
      // The slot stays ours until the student closes the result; only then
      // does the exam-date card come back (asking for the next date).
      setResult({ score: body.score, prediction: body.prediction });
    } catch {
      setError('אין חיבור — נסה שוב');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const exempt = result.score >= 134;
    return (
      <section className="w-full p-5 bg-exam-surface border border-exam-border rounded-2xl shadow-raised animate-fade-up text-center" aria-live="polite">
        {exempt
          ? <PartyPopper className="w-10 h-10 mx-auto mb-2 text-exam-sage-strong animate-check-pop" strokeWidth={1.5} aria-hidden />
          : <Award className="w-10 h-10 mx-auto mb-2 text-exam-accent animate-check-pop" strokeWidth={1.5} aria-hidden />}
        <p className="font-bold text-exam-ink">{exempt ? 'מזל טוב על הפטור!' : 'תודה ששיתפת!'}</p>
        {result.prediction && (
          <p className="mt-2 text-sm text-exam-ink-soft">
            האומדן של האתר לפני המבחן: <span className="font-bold text-exam-ink tabular-nums">{result.prediction.score}</span>
            {' · '}הציון הרשמי שלך: <span className="font-bold text-exam-ink tabular-nums">{result.score}</span>
          </p>
        )}
        <p className="mt-2 text-xs text-exam-ink-soft">
          כל ציון רשמי מכייל את האומדנים של האתר מול המציאות — גם לתלמידים הבאים.
        </p>
        {!exempt && (
          <p className="mt-2 text-xs text-exam-ink-soft">כשתקבע את המועד הבא, נתזמן את החזרות מחדש לקראתו.</p>
        )}
        <button
          type="button"
          onClick={() => { setResult(null); close(); }}
          className={`mt-4 px-5 py-2 rounded-xl border border-exam-border text-sm font-semibold text-exam-ink hover:bg-exam-paper-alt hover:shadow-surface active:scale-[0.97] ${TACTILE}`}
        >
          {exempt ? 'סגור' : 'המשך'}
        </button>
      </section>
    );
  }

  return (
    <div className="relative animate-fade-up">
      <div className="absolute -inset-3 -z-10 rounded-[28px] bg-exam-accent/15 blur-2xl animate-ambient-glow motion-reduce:animate-none" aria-hidden />
      <form
        className="relative w-full p-5 bg-exam-surface border border-exam-border dark:border-white/10 rounded-2xl shadow-raised space-y-4"
        onSubmit={e => { e.preventDefault(); void submit(); }}
      >
        <div className="flex items-start gap-3">
          <Award className="w-6 h-6 text-exam-accent flex-shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
          <div>
            <label htmlFor={inputId} className="block font-bold text-sm text-exam-ink">
              איך הלך המבחן ב-{formatDate(testDate)}?
            </label>
            <p className="text-xs text-exam-ink-soft mt-0.5">
              קיבלת ציון מנית&quot;ה? הציון שלך עוזר לכייל את האומדנים של האתר מול ציונים אמיתיים. הוא נשמר בחשבון שלך בלבד.
            </p>
          </div>
        </div>

        <div role="radiogroup" aria-label="סוג המבחן" className="flex gap-1.5 p-1 rounded-xl bg-exam-paper-alt border border-exam-border">
          {TEST_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={testType === t.value}
              onClick={() => setTestType(t.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${TACTILE} ${
                testType === t.value
                  ? 'bg-exam-surface text-exam-ink shadow-surface'
                  : 'text-exam-ink-soft hover:text-exam-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-stretch gap-2">
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            dir="ltr"
            // Never a plausible score as placeholder: it would read as
            // pre-filled and anchor the very number being collected.
            placeholder="50–150"
            autoComplete="off"
            value={draft}
            onChange={e => { setDraft(e.target.value.replace(/\D/g, '')); setError(null); }}
            aria-describedby={error ? `${inputId}-error` : undefined}
            aria-invalid={!!error}
            className="flex-1 min-w-0 px-4 py-3 text-center text-3xl font-black tabular-nums text-exam-ink placeholder:text-exam-border-strong placeholder:text-lg placeholder:font-semibold bg-exam-paper-alt border border-exam-border rounded-xl shadow-pressed focus:outline-none focus:border-exam-accent focus:ring-2 focus:ring-exam-accent/30 transition-[border-color,box-shadow] duration-300 ease-spring"
          />
          <button
            type="submit"
            disabled={!draft || saving}
            className={`px-5 flex items-center gap-2 bg-exam-accent text-exam-accent-ink font-bold rounded-xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${TACTILE}`}
          >
            <Send className="w-4 h-4 -scale-x-100" aria-hidden />
            {saving ? 'שומר…' : 'שליחה'}
          </button>
        </div>
        {error && <p id={`${inputId}-error`} role="alert" className="text-xs font-semibold text-exam-wrong">{error}</p>}

        <div className="flex items-center justify-between text-xs">
          <button type="button" onClick={snooze} className="text-exam-ink-soft hover:text-exam-ink hover:underline">
            עוד לא קיבלתי ציון
          </button>
          <button type="button" onClick={decline} className="text-exam-ink-soft hover:text-exam-ink hover:underline">
            מעדיף לא לשתף
          </button>
        </div>
      </form>
    </div>
  );
}
