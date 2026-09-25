'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CalendarCheck, CalendarDays, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useDashboardSummary } from '@/lib/dashboard-context';
import { authFetch } from '@/lib/auth-fetch';
import { addLocalDays, localDaysBetween, todayLocalStr } from '@/lib/date-local';
import { heCount } from '@/lib/hebrew-count';

/** Same window PUT /api/goals enforces. */
const MAX_DAYS_AHEAD = 730;

const TACTILE = 'transition-[background-color,border-color,box-shadow,transform] duration-300 ease-spring will-change-transform';
const BANNER_CLASSES = `w-full flex items-center gap-3 p-4 bg-exam-surface border border-exam-border hover:bg-exam-paper-alt hover:border-exam-border-strong rounded-2xl shadow-surface hover:shadow-raised active:shadow-pressed hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] text-right ${TACTILE}`;

/** "24 בנובמבר 2026". */
export function formatExamDate(dateStr: string): string {
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${dateStr}T00:00:00Z`));
}

function countdownCopy(daysLeft: number): string {
  if (daysLeft === 0) return 'המבחן היום. בהצלחה!';
  if (daysLeft === 1) return 'המבחן מחר';
  return `עוד ${heCount(daysLeft, 'day')} למבחן`;
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
        setError(res.status === 400 ? 'בחר תאריך מהיום ועד שנתיים קדימה' : 'השמירה נכשלה. נסה שוב');
        return;
      }
      setSavedDate(value);
      setEditing(false);
    } catch {
      setError('אין חיבור. נסה שוב');
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
        {/* The native date field formats by the browser's locale ("24 Nov 2026"),
            so it sits invisibly over a Hebrew label and still opens the native
            picker on tap. */}
        <div className="relative flex items-center justify-between gap-3 w-full px-4 py-3 bg-exam-paper-alt border border-exam-border rounded-xl shadow-pressed has-[:focus-visible]:border-exam-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-exam-accent/30 transition-[border-color,box-shadow] duration-300 ease-spring">
          <span className={`text-lg font-semibold ${draft ? 'text-exam-ink' : 'text-exam-ink-soft'}`} aria-hidden>
            {draft ? formatExamDate(draft) : 'בחר תאריך'}
          </span>
          <CalendarDays className="w-5 h-5 text-exam-ink-soft flex-shrink-0" aria-hidden />
          <input
            id={inputId}
            type="date"
            required
            autoFocus
            min={today}
            max={addLocalDays(today, MAX_DAYS_AHEAD)}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onClick={e => { try { e.currentTarget.showPicker(); } catch { /* the field itself still works */ } }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
        </div>
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
      </form>
    );
  }

  if (isUpcoming && examDate) {
    return (
      <div className="w-full flex items-center gap-3 px-4 py-3 bg-exam-surface border border-exam-border rounded-2xl shadow-surface">
        <CalendarCheck className="w-5 h-5 text-exam-sage-strong flex-shrink-0" strokeWidth={1.75} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">
            {countdownCopy(daysLeft!)}
          </div>
          <div className="text-exam-ink-soft text-xs">
            {formatExamDate(examDate)}
            {daysLeft! <= 14 && daysLeft! > 0 && ' · המרווחים בין החזרות מתקצרים לקראת המבחן'}
          </div>
          {error && <div role="alert" className="text-xs font-semibold text-exam-wrong mt-0.5">{error}</div>}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={openEditor}
            aria-label="שינוי תאריך המבחן"
            className={`hit-44 p-2 rounded-xl text-exam-ink-soft hover:text-exam-ink hover:bg-exam-paper-alt hover:shadow-surface active:scale-[0.92] ${TACTILE}`}
          >
            <Pencil className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void save(null)}
            disabled={saving}
            aria-label="הסרת תאריך המבחן"
            className={`hit-44 p-2 rounded-xl text-exam-ink-soft hover:text-exam-wrong hover:bg-exam-wrong-bg active:scale-[0.92] disabled:opacity-50 ${TACTILE}`}
          >
            <Trash2 className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" onClick={openEditor} className={BANNER_CLASSES}>
      <CalendarClock className="w-6 h-6 text-exam-accent flex-shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="flex-1">
        <div className="font-semibold text-sm">{hadPastDate ? 'תאריך המבחן עבר. מתי המבחן הבא?' : 'מתי המבחן שלך?'}</div>
        <div className="text-exam-ink-soft text-xs">קבע תאריך, ונתזמן את החזרות כך שהזיכרון שלך יהיה בשיא ביום המבחן</div>
      </div>
      <ChevronLeft className="w-4 h-4 text-exam-ink-soft flex-shrink-0" aria-hidden />
    </button>
  );
}
