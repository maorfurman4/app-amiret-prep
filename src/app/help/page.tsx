import type { Metadata } from 'next';
import Link from 'next/link';
import { BackNav } from '@/components/BackNav';
import { ContactEmailLink } from '@/components/ContactEmailLink';

export const metadata: Metadata = { title: 'עזרה ותמיכה | 134+' };

const LINK = 'font-bold text-exam-accent underline underline-offset-2';

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'איך קובעים את תאריך המבחן?',
    a: <>בתפריט החשבון (התמונה שלך בפינה) ← הלמידה שלי ← תאריך המבחן, או בכרטיס בדף הבית. החזרות על מה שטעית בו מתוזמנות לפיו.</>,
  },
  {
    q: 'שכחתי את הסיסמה',
    a: <>בעמוד ההתחברות בוחרים <Link href="/auth/login?view=forgot" className={LINK}>שכחת סיסמה?</Link> ומקבלים קישור לאיפוס במייל. מי שנכנס עם Google לא צריך סיסמה.</>,
  },
  {
    q: 'למה אין קול כשאני לוחץ על הרמקול ליד מילה?',
    a: <>ייתכן שהגיית המילים כבויה: תפריט החשבון ← העדפות ← הגיית מילים. ההגייה משתמשת בקול של המכשיר, אז כדאי לבדוק גם שהמכשיר לא על שקט.</>,
  },
  {
    q: 'תרגלתי בלי להתחבר. ההתקדמות תישמר?',
    a: <>כאורח, ההתקדמות נשמרת בדפדפן הזה בלבד. ברגע שמתחברים היא עוברת לחשבון ומשם זמינה בכל מכשיר.</>,
  },
  {
    q: 'הציון באפליקציה זהה לציון באמירנ"ט?',
    a: <>לא. הציון הוא הערכה לפי התשובות שלך כאן. אפשר לדווח את הציון הרשמי ב<Link href="/stats#official-scores" className={LINK}>סטטיסטיקה</Link>, וכך לראות כמה ההערכה קרובה אליו.</>,
  },
  {
    q: 'איך מוחקים את החשבון?',
    a: <>תפריט החשבון ← החשבון ← מחיקת חשבון. המחיקה סופית ומוחקת את כל הנתונים שלך. פרטים ב<Link href="/privacy" className={LINK}>פרטיות ותנאים</Link>.</>,
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-dvh bg-exam-paper flex flex-col" dir="rtl">
      <BackNav title="עזרה ותמיכה" />
      <main id="main" className="flex-1 px-4 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-2xl font-bold text-exam-ink mb-2">עזרה ותמיכה</h1>
          <p className="text-sm text-exam-ink-soft mb-6">תשובות לשאלות שעולות הכי הרבה.</p>
          <div className="space-y-3">
            {QUESTIONS.map(({ q, a }) => (
              <details key={q} className="group rounded-2xl border border-exam-border bg-exam-surface shadow-surface">
                <summary className="cursor-pointer list-none px-5 py-4 font-bold text-exam-ink flex items-center justify-between gap-3">
                  {q}
                  <span className="text-exam-ink-soft transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-exam-ink-soft">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-exam-ink-soft">
            לא מצאת תשובה? כתוב לנו ל<ContactEmailLink className={LINK} />
          </p>
        </div>
      </main>
    </div>
  );
}
