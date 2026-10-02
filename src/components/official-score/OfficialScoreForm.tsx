'use client';

import { useId, useState } from 'react';
import { Award, CalendarDays, PartyPopper, Send } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { addLocalDays, todayLocalStr } from '@/lib/date-local';
import { formatExamDate } from '@/components/home/ExamDateCard';
import type { ScoreSource, TestType } from '@/lib/official-score';

export const TEST_TYPES: { value: TestType; label: string }[] = [
  { value: 'amirnet', label: 'אמירנ"ט' },
  { value: 'amiram', label: 'אמיר"ם' },
  { value: 'psychometric', label: 'פסיכומטרי' },
];

export type SavedScore = { score: number; prediction: { score: number; pExempt: number | null } | null };

const TACTILE = 'transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';

/**
 * One official score: test type, score and test date. Used by the general
 * entry points (results page, stats page). The exam-date prompt on the home
 * page keeps its own compact form, since it already knows the date.
 *
 * `initial` edits an existing sitting: its date is fixed (a sitting is
 * identified by its date; a different date is a different sitting).
 */
export function OfficialScoreForm({
  source, initial, onSaved,
}: {
  source: ScoreSource;
  initial?: { testDate: string; score: number; testType: TestType };
  onSaved: (saved: SavedScore) => void;
}) {
  const scoreId = useId();
  const dateId = useId();
  const today = todayLocalStr();
  const [testType, setTestType] = useState<TestType>(initial?.testType ?? 'amirnet');
  const [draft, setDraft] = useState(initial ? String(initial.score) : '');
  const [testDate, setTestDate] = useState(initial?.testDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const score = Number(draft);
    if (!Number.isInteger(score) || score < 50 || score > 150) { setError('הציון הרשמי הוא מספר שלם בין 50 ל-150'); return; }
    if (!testDate) { setError('בחר את תאריך המבחן'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/official-score', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, testDate, testType, source }),
      });
      if (res.status === 429) { setError('יותר מדי שמירות ברצף. נסה שוב בעוד דקה'); return; }
      if (res.status === 400) { setError('התאריך צריך להיות בשנתיים האחרונות, לא בעתיד'); return; }
      if (!res.ok) { setError('השמירה נכשלה. נסה שוב'); return; }
      const body = await res.json() as SavedScore;
      onSaved({ score: body.score, prediction: body.prediction });
    } catch {
      setError('אין חיבור. נסה שוב');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div role="radiogroup" aria-label="סוג המבחן" className="flex gap-1.5 p-1 rounded-xl bg-exam-paper-alt border border-exam-border">
        {TEST_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={testType === t.value}
            onClick={() => setTestType(t.value)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${TACTILE} ${
              testType === t.value ? 'bg-exam-surface text-exam-ink shadow-surface' : 'text-exam-ink-soft hover:text-exam-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor={scoreId} className="block text-sm font-semibold text-exam-ink mb-1.5">הציון שקיבלת</label>
        <input
          id={scoreId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          dir="ltr"
          // Never a plausible score as placeholder: it would anchor the answer.
          placeholder="50–150"
          autoComplete="off"
          value={draft}
          onChange={e => { setDraft(e.target.value.replace(/\D/g, '')); setError(null); }}
          aria-invalid={!!error}
          className="w-full px-4 py-3 text-center text-3xl font-black tabular-nums text-exam-ink placeholder:text-exam-ink-soft placeholder:text-lg placeholder:font-semibold bg-exam-paper-alt border border-exam-border-input rounded-xl shadow-pressed focus:outline-none focus:border-exam-accent focus:ring-2 focus:ring-exam-accent/30 transition-[border-color,box-shadow] duration-300 ease-spring"
        />
      </div>

      <div>
        <label htmlFor={dateId} className="block text-sm font-semibold text-exam-ink mb-1.5">מתי נבחנת?</label>
        {initial ? (
          <div className="px-4 py-3 rounded-xl bg-exam-paper-alt border border-exam-border text-exam-ink-soft">{formatExamDate(initial.testDate)}</div>
        ) : (
          // The native date field formats by the browser's locale, so it sits
          // invisibly over a Hebrew label and still opens the native picker.
          <div className="relative flex items-center justify-between gap-3 w-full px-4 py-3 bg-exam-paper-alt border border-exam-border-input rounded-xl shadow-pressed has-[:focus-visible]:border-exam-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-exam-accent/30">
            <span className={`font-semibold ${testDate ? 'text-exam-ink' : 'text-exam-ink-soft'}`} aria-hidden>
              {testDate ? formatExamDate(testDate) : 'בחר תאריך'}
            </span>
            <CalendarDays className="w-5 h-5 text-exam-ink-soft flex-shrink-0" aria-hidden />
            <input
              id={dateId}
              type="date"
              required
              min={addLocalDays(today, -730)}
              max={today}
              value={testDate}
              onChange={e => { setTestDate(e.target.value); setError(null); }}
              onClick={e => { try { e.currentTarget.showPicker(); } catch { /* the field itself still works */ } }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}
      </div>

      <p className="text-xs text-exam-ink-soft">
        הציון משמש רק כדי לכייל את האומדנים של האתר מול ציונים אמיתיים. הוא נשמר בחשבון שלך בלבד ולא מוצג לאף אחד.
      </p>
      {error && <p role="alert" className="text-xs font-semibold text-exam-wrong">{error}</p>}

      <button
        type="submit"
        disabled={!draft || !testDate || saving}
        className={`w-full py-3 flex items-center justify-center gap-2 bg-exam-accent text-exam-accent-ink font-bold rounded-xl shadow-raised hover:shadow-overlay active:shadow-pressed active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${TACTILE}`}
      >
        <Send className="w-4 h-4 -scale-x-100" aria-hidden />
        {saving ? 'שומר…' : initial ? 'עדכון הציון' : 'שמירה'}
      </button>
    </form>
  );
}

/** After saving: the app's pre-test estimate next to the real score. */
export function SavedScoreResult({ saved, onClose }: { saved: SavedScore; onClose: () => void }) {
  const exempt = saved.score >= 134;
  return (
    <div className="text-center py-2" aria-live="polite">
      {exempt
        ? <PartyPopper className="w-10 h-10 mx-auto mb-2 text-exam-sage-strong animate-check-pop" strokeWidth={1.5} aria-hidden />
        : <Award className="w-10 h-10 mx-auto mb-2 text-exam-accent animate-check-pop" strokeWidth={1.5} aria-hidden />}
      <p className="font-bold text-exam-ink">{exempt ? 'מזל טוב על הפטור!' : 'תודה ששיתפת!'}</p>
      {saved.prediction ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-exam-paper-alt border border-exam-border p-3">
            <div className="text-xs text-exam-ink-soft">האומדן של האתר לפני המבחן</div>
            <div className="text-2xl font-black text-exam-ink tabular-nums">{saved.prediction.score}</div>
          </div>
          <div className="rounded-xl bg-exam-accent/10 border border-exam-accent/30 p-3">
            <div className="text-xs text-exam-ink-soft">הציון הרשמי שלך</div>
            <div className="text-2xl font-black text-exam-ink tabular-nums">{saved.score}</div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-exam-ink-soft">לא עשית אצלנו מבחן מלא לפני התאריך הזה, אז אין אומדן להשוות אליו. הציון עדיין עוזר לנו.</p>
      )}
      <p className="mt-3 text-xs text-exam-ink-soft">כל ציון רשמי מכייל את האומדנים של האתר מול המציאות, גם בשביל התלמידים הבאים.</p>
      <button
        type="button"
        onClick={onClose}
        className={`mt-4 px-6 py-2 rounded-xl border border-exam-border text-sm font-semibold text-exam-ink hover:bg-exam-paper-alt active:scale-[0.97] ${TACTILE}`}
      >
        סגור
      </button>
    </div>
  );
}
