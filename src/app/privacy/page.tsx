import type { Metadata } from 'next';
import { BackNav } from '@/components/BackNav';
import { ContactEmailLink } from '@/components/ContactEmailLink';

export const metadata: Metadata = { title: 'פרטיות ותנאים | 134+' };

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'מה נשמר',
    items: [
      'פרטי החשבון: כתובת המייל, שם התצוגה ותמונת הפרופיל אם העלית. התמונה נשמרת כקובץ שנגיש לכל מי שיש לו את הכתובת שלו.',
      'נתוני הלמידה: התשובות במבחנים ובתרגולים, הציונים, ציונים רשמיים שדיווחת, רשימות המילים, תאריך המבחן והרצף.',
      'אורח: מזהה אקראי בעוגייה חתומה, כדי שההתקדמות תישמר בלי חשבון.',
      'במכשיר עצמו: העדפות כמו ערכת נושא והגיית מילים, ועותק של רשימות המילים.',
    ],
  },
  {
    title: 'למה',
    items: [
      'כדי להתאים את רמת השאלות, לתזמן חזרות לפני המבחן ולהציג לך את ההתקדמות. הנתונים לא נמכרים ולא משמשים לפרסום.',
      'כתובת ה-IP משמשת להגבלת מספר הבקשות, כהגנה מפני שימוש לרעה.',
    ],
  },
  {
    title: 'מי מעבד את הנתונים',
    items: [
      'Supabase: מסד הנתונים וההתחברות. Vercel: אחסון האתר. Google: רק אם בחרת להתחבר דרכו.',
    ],
  },
  {
    title: 'מחיקה',
    items: [
      'בתפריט החשבון ← מחיקת חשבון. המחיקה מסירה את החשבון, את כל נתוני הלמידה ואת תמונת הפרופיל, ואי אפשר לשחזר אותם.',
      'ביציאה מהחשבון נמחק גם העותק שנשמר במכשיר.',
    ],
  },
  {
    title: 'תנאי שימוש',
    items: [
      '134+ הוא כלי תרגול עצמאי ואינו קשור למרכז הארצי לבחינות ולהערכה. הציונים כאן הם הערכה בלבד ואינם מבטיחים ציון או פטור במבחן האמיתי.',
      'השימוש הוא באחריותך. אנחנו עשויים לשנות את האפליקציה ואת הדף הזה, והגרסה העדכנית תמיד תופיע כאן.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-exam-paper flex flex-col" dir="rtl">
      <BackNav title="פרטיות ותנאים" />
      <main id="main" className="flex-1 px-4 py-8">
        <article className="mx-auto w-full max-w-2xl">
          <h1 className="text-2xl font-bold text-exam-ink mb-2">פרטיות ותנאים</h1>
          <p className="text-sm text-exam-ink-soft mb-6">בקצרה: מה נשמר עליך, למה, ואיך מוחקים.</p>
          <div className="space-y-4">
            {SECTIONS.map(s => (
              <section key={s.title} className="rounded-2xl border border-exam-border bg-exam-surface p-5 shadow-surface">
                <h2 className="font-bold text-exam-ink mb-2">{s.title}</h2>
                <ul className="list-disc ps-5 space-y-1.5 text-sm leading-relaxed text-exam-ink-soft">
                  {s.items.map(item => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ))}
            <section className="rounded-2xl border border-exam-border bg-exam-surface p-5 shadow-surface">
              <h2 className="font-bold text-exam-ink mb-2">יצירת קשר</h2>
              <p className="text-sm leading-relaxed text-exam-ink-soft">
                לשאלות על הפרטיות או בקשת מחיקת נתונים: <ContactEmailLink className="font-bold text-exam-accent underline underline-offset-2" />
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
