'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CalendarCheck, ChevronLeft, Pencil } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { authFetch } from '@/lib/auth-fetch';
import { addLocalDays, localDaysBetween, todayLocalStr } from '@/lib/date-local';

/** Same window PUT /api/goals enforces. */
const MAX_DAYS_AHEAD = 730;

const TACTILE = 'transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';
const BANNER_CLASSES = `w-full flex items-center gap-3 p-4 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] text-right ${TACTILE}`;

function formatExamDate(dateStr: string): string {
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${dateStr}T00:00:00Z`));
}

function countdownCopy(daysLeft: number): string {
  if (daysLeft === 0) return 'המבחן היום — בהצלחה!';
  if (daysLeft === 1) return 'המבחן מחר';
  return `עוד ${daysLeft} ימים למבחן`;
}

/**
 * The exam date is what lets the spaced-repetition scheduler time every
 * review so memory peaks on test day (src/lib/fsrs.ts capDueToExam) — so a
 * missing date is surfaced right under the hero, and a set one stays one
 * tap from editing as a quiet countdown.
 *
 *   guest          → sign-in prompt (dates live on the account)
 *   no/past date   → prominent prompt that opens the inline editor
 *   upcoming date  → compact countdown pill with an edit button
 *
 * Follows the dashboard's no-data contract: renders nothing until the
 * summary has loaded.
 */
export function ExamDateCard() {
  const { data } = useDashboardSummary();
  const inputId = useId();
  // null = "not overridden yet": show what the server sent.
  const [savedDate, setSavedDate] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;
  // The official-score prompt takes this slot while it's pending.
  if (data.officialScorePrompt) return null;

  const today = todayLocalStr();
  const examDate = savedDate !== undefined ? savedDate : data.examDate;
  const daysLeft = examDate ? localDaysBetween(today, examDate) : null;
  const isUpcoming = daysLeft !== null && daysLeft >= 0;
  const hadPastDate = daysLeft !== null && daysLeft < 0;

  if (!data.canSetExamDate) {
    return (
      <Link href="/auth/login?next=/" className={BANNER_CLASSES}>
        <CalendarClock className="w-6 h-6 text-exam-accent flex-shrink-0" strokeWidth={1.75} aria-hidden />
        <div className="flex-1">
          <div className="font-semibold text-sm">מתי המבחן שלך?</div>
          <div className="text-exam-ink-soft text-xs">התחבר כדי לקבוע תאריך, ונתזמן את החזרות כך שהזיכרון שלך יהיה בשיא ביום המבחן</div>
        </div>
        <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
      </Link>
    );
  }

  const openEditor = () => {
    setDraft(isUpcoming && examDate ? examDate : '');
    setError(null);
    setEditing(true);
  };

  const save = async (value: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examDate: value }),
      });
      if (!res.ok) {
        setError(res.status === 400 ? 'בחר תאריך מהיום ועד שנתיים קדימה' : 'השמירה נכשלה — נסה שוב');
        return;
      }
      setSavedDate(value);
      setEditing(false);
    } catch {
      setError('אין חיבור — נסה שוב');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        className="w-full p-4 bg-exam-surface border border-exam-border rounded-2xl shadow-raised space-y-3 animate-fade-up"
        onSubmit={e => { e.preventDefault(); if (draft) void save(draft); }}
      >
        <label htmlFor={inputId} className="flex items-center gap-2 font-semibold text-sm">
          <CalendarClock className="w-5 h-5 text-exam-accent" strokeWidth={1.75} aria-hidden />
          מתי המבחן שלך?
        </label>
        <input
          id={inputId}
          type="date"
          dir="ltr"
          required
          autoFocus
          min={today}
          max={addLocalDays(today, MAX_DAYS_AHEAD)}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          className="w-full px-4 py-3 text-lg font-semibold text-exam-ink bg-exam-paper-alt border border-exam-border rounded-xl shadow-pressed focus:outline-none focus:border-exam-accent focus:ring-2 focus:ring-exam-accent/30 transition-[border-color,box-shadow] duration-300 ease-spring"
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <p className="text-xs text-exam-ink-soft">
          נתזמן את החזרות כך שהחזרה האחרונה על כל נושא תהיה 1–3 ימים לפני המבחן, והמרווחים יתקצרו ככל שהוא מתקרב.
        </p>
        {error && <p id={`${inputId}-error`} role="alert" className="text-xs font-semibold text-exam-wrong">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!draft || saving}
            className={`flex-1 py-2.5 bg-exam-accent text-exam-accent-ink font-bold rounded-xl shadow-raised hover:shadow-overlay active:shadow-pressed hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${TACTILE}`}
          >
            {saving ? 'שומר…' : 'שמור תאריך'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className={`px-4 py-2.5 rounded-xl border border-exam-border text-exam-ink-soft hover:bg-exam-paper-alt active:scale-[0.97] ${TACTILE}`}
          >
            ביטול
          </button>
        </div>
        {isUpcoming && (
          <button
            type="button"
            onClick={() => void save(null)}
            disabled={saving}
            className="text-xs text-exam-wrong hover:underline"
          >
            הסר את תאריך המבחן
          </button>
        )}
      </form>
    );
  }

  if (isUpcoming && examDate) {
    return (
      <div className="w-full flex items-center gap-3 px-4 py-3 bg-exam-surface border border-exam-border rounded-2xl shadow-surface">
        <CalendarCheck className="w-5 h-5 text-exam-sage-strong flex-shrink-0" strokeWidth={1.75} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">
            {daysLeft! > 1 ? <>עוד <span className="tabular-nums">{daysLeft}</span> ימים למבחן</> : countdownCopy(daysLeft!)}
          </div>
          <div className="text-exam-ink-soft text-xs">
            {formatExamDate(examDate)}
            {daysLeft! <= 14 && daysLeft! > 0 && ' · המרווחים בין החזרות מתקצרים לקראת המבחן'}
          </div>
        </div>
        <button
          type="button"
          onClick={openEditor}
          aria-label="שינוי תאריך המבחן"
          className={`p-2 rounded-xl text-exam-ink-soft hover:text-exam-ink hover:bg-exam-paper-alt hover:shadow-surface active:scale-[0.92] ${TACTILE}`}
        >
          <Pencil className="w-4 h-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={openEditor} className={BANNER_CLASSES}>
      <CalendarClock className="w-6 h-6 text-exam-accent flex-shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="flex-1">
        <div className="font-semibold text-sm">{hadPastDate ? 'תאריך המבחן עבר — מתי המבחן הבא?' : 'מתי המבחן שלך?'}</div>
        <div className="text-exam-ink-soft text-xs">קבע תאריך, ונתזמן את החזרות כך שהזיכרון שלך יהיה בשיא ביום המבחן</div>
      </div>
      <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
    </button>
  );
}
