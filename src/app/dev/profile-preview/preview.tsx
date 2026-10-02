'use client';

/**
 * Dev-only static preview of Direction B ("profile header + inline account
 * sections") for design review. Nothing here talks to the network: every
 * value is mock data, labelled as such. The real implementation would live
 * in UserMenu, with the numbers from computeStatsMetrics (the /stats pipeline).
 */

import { useId, useState, type ReactNode } from 'react';
import { BarChart3, Award, Camera, PenLine, ImageIcon, Lock, LogOut, ChevronDown, Eye, EyeOff, LogIn, Check } from 'lucide-react';
import { Reveal } from '@/components/strategies/Reveal';
import { ThemeToggle } from '@/components/ThemeToggle';

type Section = 'name' | 'avatar' | 'password' | null;
type Stats = { examCount: number; bestScore: number; lastScore: number };

const ROW = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-menu-ink hover:bg-menu-hover focus-visible:bg-menu-hover focus-visible:outline-none transition-colors';
const ICON = 'w-[18px] h-[18px] flex-shrink-0 text-menu-accent';
const LABEL = 'block text-xs font-semibold text-menu-ink-soft mb-1';
const INPUT = 'w-full px-3 py-2 rounded-lg border border-menu-border bg-menu-surface text-sm text-start text-menu-ink placeholder:text-menu-ink-soft focus:outline-none focus:ring-2 focus:ring-menu-accent/30';
const PRIMARY = 'w-full py-2.5 rounded-xl bg-menu-accent text-menu-accent-ink text-sm font-bold shadow-raised hover:-translate-y-0.5 active:translate-y-0 active:shadow-pressed transition-[transform,box-shadow,opacity] duration-300 ease-spring disabled:opacity-50';

function Panel({ name, email, stats, initialSection = null, emailProvider = true }: {
  name: string; email: string; stats: Stats | null; initialSection?: Section; emailProvider?: boolean;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [showPw, setShowPw] = useState(false);
  const [saved, setSaved] = useState(false);
  const uid = useId();
  const toggle = (s: Exclude<Section, null>) => setSection(cur => (cur === s ? null : s));
  const hasExams = !!stats && stats.examCount > 0;

  const accountRow = (s: Exclude<Section, null>, icon: ReactNode, label: string, value?: string) => (
    <button
      type="button"
      onClick={() => toggle(s)}
      aria-expanded={section === s}
      aria-controls={`${uid}-${s}`}
      className={ROW}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {value && <bdi className="max-w-[40%] truncate text-xs font-medium text-menu-ink-soft">{value}</bdi>}
      <ChevronDown className={`w-4 h-4 text-menu-ink-soft transition-transform duration-300 ${section === s ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  );

  return (
    <div
      role="dialog"
      aria-labelledby={`${uid}-title`}
      dir="rtl"
      className="w-full max-w-[320px] rounded-2xl border border-menu-border bg-menu-surface p-2 text-menu-ink shadow-raised ring-1 ring-black/5"
    >
      {/* Identity header */}
      <div className="rounded-xl bg-menu-hover/60 px-3 pt-3 pb-3 mb-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => toggle('avatar')}
            aria-label="שינוי תמונת פרופיל"
            className="relative flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-menu-accent/50"
          >
            <span className="w-14 h-14 rounded-full bg-menu-accent text-menu-accent-ink text-xl font-bold flex items-center justify-center select-none" aria-hidden>
              {(name || email)[0]?.toUpperCase()}
            </span>
            <span className="absolute -bottom-0.5 -end-0.5 w-6 h-6 rounded-full bg-menu-surface border border-menu-border flex items-center justify-center shadow-surface" aria-hidden>
              <Camera className="w-3.5 h-3.5 text-menu-accent" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h2 id={`${uid}-title`} dir="auto" className="text-base font-bold truncate text-start">{name || 'הוספת שם תצוגה'}</h2>
              <button
                type="button"
                onClick={() => toggle('name')}
                aria-label="עריכת שם תצוגה"
                className="hit-44 w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-menu-ink-soft hover:bg-menu-hover hover:text-menu-ink transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
            <p className="text-xs text-menu-ink-soft truncate text-start"><bdi dir="ltr">{email}</bdi></p>
          </div>
        </div>

        {hasExams ? (
          <dl className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            {[
              { label: 'מבחנים', value: stats!.examCount },
              { label: 'הציון הגבוה', value: stats!.bestScore },
              { label: 'המבחן האחרון', value: stats!.lastScore },
            ].map(f => (
              <div key={f.label} className="rounded-lg bg-menu-surface px-1 py-2 flex flex-col-reverse">
                <dt className="text-[11px] text-menu-ink-soft">{f.label}</dt>
                <dd className="text-base font-bold tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-xs text-menu-ink-soft">
            עוד לא השלמת מבחן מלא. <a href="#" className="font-bold text-menu-accent underline underline-offset-2">למבחן הראשון</a>
          </p>
        )}
      </div>

      <a href="#" className={ROW}><BarChart3 className={ICON} aria-hidden /><span className="flex-1">סטטיסטיקה</span></a>
      <a href="#" className={ROW}><Award className={ICON} aria-hidden /><span className="flex-1">הציון הרשמי שלי</span></a>

      <div className="my-1.5 border-t border-menu-border" />
      <p className="px-3 pt-1 pb-0.5 text-[11px] font-bold text-menu-ink-soft">חשבון</p>

      {accountRow('name', <PenLine className={ICON} aria-hidden />, 'שם תצוגה', name)}
      <Reveal open={section === 'name'} id={`${uid}-name`}>
        <form className="px-3 pb-3 pt-1 space-y-2" onSubmit={e => { e.preventDefault(); setSaved(true); }}>
          <label htmlFor={`${uid}-name-input`} className={LABEL}>השם שיוצג באפליקציה</label>
          <input id={`${uid}-name-input`} dir="auto" defaultValue={name} maxLength={40} className={INPUT} aria-describedby={`${uid}-name-status`} />
          <p id={`${uid}-name-status`} aria-live="polite" className="min-h-4 text-xs font-semibold text-[var(--menu-success)]">
            {saved && <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden />נשמר</span>}
          </p>
          <button className={PRIMARY}>שמירה</button>
        </form>
      </Reveal>

      {accountRow('avatar', <ImageIcon className={ICON} aria-hidden />, 'תמונת פרופיל')}
      <Reveal open={section === 'avatar'} id={`${uid}-avatar`}>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <button type="button" className={PRIMARY}>בחירת תמונה</button>
          <p className="text-[11px] text-menu-ink-soft text-center">
            קובץ <bdi dir="ltr">JPG · PNG · WEBP · GIF</bdi>, עד <bdi dir="ltr">3MB</bdi>
          </p>
        </div>
      </Reveal>

      {emailProvider && (
        <>
          {accountRow('password', <Lock className={ICON} aria-hidden />, 'שינוי סיסמה')}
          <Reveal open={section === 'password'} id={`${uid}-password`}>
            <form className="px-3 pb-3 pt-1 space-y-2" onSubmit={e => e.preventDefault()}>
              <div>
                <label htmlFor={`${uid}-pw`} className={LABEL}>סיסמה חדשה</label>
                <div className="relative">
                  <input id={`${uid}-pw`} type={showPw ? 'text' : 'password'} dir="ltr" autoComplete="new-password" aria-describedby={`${uid}-pw-hint`} className={`${INPUT} ps-10`} />
                  {/* The field is dir=ltr inside an rtl wrapper: the toggle sits at the
                      wrapper's end (left), which is the field's start, hence ps-10. */}
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    aria-label={showPw ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
                    aria-pressed={showPw}
                    className="absolute inset-y-0 end-0 w-10 flex items-center justify-center text-menu-ink-soft hover:text-menu-ink"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                  </button>
                </div>
                <p id={`${uid}-pw-hint`} className="mt-1 text-[11px] text-menu-ink-soft">לפחות <bdi>6</bdi> תווים</p>
              </div>
              <div>
                <label htmlFor={`${uid}-pw2`} className={LABEL}>אימות הסיסמה</label>
                <input id={`${uid}-pw2`} type={showPw ? 'text' : 'password'} dir="ltr" autoComplete="new-password" className={INPUT} />
              </div>
              <p role="alert" className="min-h-4 text-xs font-semibold text-menu-danger">הסיסמאות לא תואמות</p>
              <button className={PRIMARY}>עדכון הסיסמה</button>
            </form>
          </Reveal>
        </>
      )}

      <div className="my-1.5 border-t border-menu-border" />
      <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-bold text-menu-danger hover:bg-menu-danger-bg focus-visible:bg-menu-danger-bg focus-visible:outline-none transition-colors">
        <LogOut className="w-[18px] h-[18px] flex-shrink-0" aria-hidden />
        <span className="flex-1">התנתקות</span>
      </button>
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold text-exam-ink-soft">{children}</p>;
}

export function ProfilePreview() {
  return (
    <div className="min-h-dvh bg-exam-paper px-4 pt-4 pb-24 text-exam-ink" dir="rtl">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center gap-2">
          <div className="me-auto">
            <p className="text-sm font-bold">/dev/profile-preview</p>
            <p className="text-xs text-exam-ink-soft">כיוון B: כותרת זהות + עריכה במקום. נתוני דוגמה בלבד, בלי קריאות רשת.</p>
          </div>
          <a
            href="#"
            className="hit-44 inline-flex items-center gap-1.5 rounded-full border border-exam-border px-3 py-1.5 text-sm font-semibold text-exam-ink hover:bg-exam-paper-alt transition-colors"
          >
            <LogIn className="w-4 h-4 rtl:-scale-x-100" aria-hidden />
            כניסה
          </a>
          <ThemeToggle />
        </div>

        <div className="grid gap-8 md:grid-cols-3 md:items-start">
          <div className="space-y-2">
            <Caption>1 · משתמש עם מבחנים (שם מעורב עברית+English)</Caption>
            <Panel name="נועה Levi 2" email="noa.levi+amirnet@example.com" stats={{ examCount: 7, bestScore: 128, lastScore: 121 }} />
          </div>
          <div className="space-y-2">
            <Caption>2 · עריכת שם פתוחה (לחיצה על העיפרון)</Caption>
            <Panel name="נועה לוי" email="student@example.com" stats={{ examCount: 1, bestScore: 104, lastScore: 104 }} initialSection="name" />
          </div>
          <div className="space-y-2">
            <Caption>3 · משתמש חדש בלי מבחנים, סיסמה פתוחה</Caption>
            <Panel name="" email="new.user@example.com" stats={null} initialSection="password" />
          </div>
        </div>
      </div>
    </div>
  );
}
