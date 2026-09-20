'use client';

import Link from 'next/link';
import { RotateCcw, AlertTriangle, Compass } from 'lucide-react';
import { BackNav } from '@/components/BackNav';

export default function RestatementTipsPage() {
  return (
    <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
      <BackNav backHref="/tips" backLabel="אסטרטגיות" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-8">

          {/* Header */}
          <div className="text-center">
            <RotateCcw className="w-9 h-9 mx-auto mb-3 text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-3xl font-bold text-exam-ink mb-2">ניסוח מחדש</h1>
            <p className="text-exam-ink-soft text-sm">Restatement | מציאת משמעות זהה במבנה שונה</p>
          </div>

          {/* What it tests */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-3">מה הסעיף בודק — ולמה זו לא בדיקת אוצר מילים</h2>
            <p className="text-exam-ink-soft text-sm leading-relaxed">
              מוצג לך משפט מקור, ועליך לבחור מבין 4 אפשרויות את זו שמבטאת <span className="font-semibold text-exam-ink">אותה משמעות בדיוק</span> —
              במבנה לשוני שונה לחלוטין. זו בדיוק הסיבה שהתשובה הנכונה כמעט אף פעם לא &quot;נראית&quot; הכי דומה למקור: תשובה שמעתיקה
              80% מהמילים המקוריות היא בדרך כלל מלכודת שמחליפה בשקט פרט קריטי (כיוון, כמות, שלילה). המבחן בודק אם הבנת
              את <span className="font-semibold text-exam-ink">הלוגיקה</span> של המשפט, לא אם זיהית מילים מוכרות בתוכו.
            </p>
          </div>

          {/* Core method */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-4">השיטה הבסיסית</h2>
            <div className="bg-exam-paper-alt border border-exam-border p-4 rounded-sm mb-4">
              <p className="font-bold text-exam-ink text-sm mb-1">מצא את גרעין המשפט: מי עשה מה, למי, ומה הקשר הלוגי</p>
              <p className="text-exam-ink-soft text-sm leading-relaxed">
                פרק את משפט המקור לשלושה רכיבים: <span className="font-semibold">מי</span> (הנושא),{' '}
                <span className="font-semibold">מה קרה</span> (הפעולה והתוצאה), ו-
                <span className="font-semibold">איזה קשר לוגי</span> מחבר ביניהם — ניגוד (although, despite),
                סיבה-תוצאה (because, therefore) או תנאי (if, unless — ראה מדריך מילות הקישור). זה &quot;תעודת הזהות&quot; של המשפט:
                כל תשובה שמשנה אפילו רכיב אחד מהשלושה — משנה משפט לגמרי אחר, גם אם היא נשמעת דומה.
              </p>
            </div>
            <div className="bg-exam-paper-alt border border-exam-border p-4 rounded-sm mb-4">
              <p className="font-bold text-exam-ink text-sm mb-1">התמקד במשמעות — לא במילים</p>
              <p className="text-exam-ink-soft text-sm leading-relaxed">
                נסח לעצמך בעברית מה המשפט אומר, לפני שאתה קורא אפשרות אחת. הסיבה: ברגע שאתה משווה מילה-למילה נגד האנגלית
                המקורית, קל &quot;להיתפס&quot; על תשובה שחולקת אוצר מילים אבל לא לוגיקה. השוואה נגד תרגום עברי משלך מנטרלת את המלכודת
                הזו — כי אתה בודק רעיון מול רעיון, לא מילה מול מילה.
              </p>
            </div>
            <div className="bg-exam-paper-alt border border-exam-border p-4 rounded-sm">
              <p className="font-bold text-exam-ink text-sm mb-1">בדוק: האם כל חלקי המשמעות נשמרו?</p>
              <p className="text-exam-ink-soft text-sm leading-relaxed">
                משפטי מקור מכילים לרוב יותר ממידע אחד (למשל: מי + מתי + למה). תשובה נכונה שומרת על <span className="font-semibold">כולם</span> —
                תשובה שמדייקת בחלק אחד ומחסירה או משנה חלק אחר עדיין נחשבת שגויה. זו הסיבה ש&quot;קרוב&quot; לא מספיק כאן.
              </p>
            </div>
          </div>

          {/* 5 tips */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-4">5 טיפים מרכזיים</h2>
            <div className="space-y-3">
              {[
                {
                  tip: 'התעלם ממבנים ספרותיים — התמקד בתוכן',
                  example:
                    '"It was not until Monday that the results were announced" = "The results were announced on Monday" — מבנה ההדגשה ("It was not until…") רק מוסיף דגש רטורי, לא משנה עובדה. תרגם למבנה פשוט בראש לפני שממשיכים.',
                },
                {
                  tip: 'בדוק כמתים בקפידה: all / some / most / none',
                  example:
                    '"All students passed" ≠ "Most students passed" — שינוי כמת הוא שינוי משמעות מלא, גם אם שאר המשפט זהה. תשובה שמחליפה "all" ב"some" תמיד שגויה, לא משנה כמה שהיא נשמעת דומה.',
                },
                {
                  tip: 'שים לב לשלילות כפולות',
                  example:
                    '"He is not unhappy" = "He is happy" — שתי שלילות (not + un-) מבטלות זו את זו. זו נקודה שקל לפספס במהירות קריאה, ולכן שווה לעצור ולספור שלילות במפורש.',
                },
                {
                  tip: 'פעיל מול סביל — המשמעות לא משתנה',
                  example:
                    '"The manager approved the plan" = "The plan was approved by the manager" — שינוי מבנה תחבירי (active/passive) לא משנה מי עשה מה למי. אל תיפול על תשובה שנפסלת רק כי היא בקול סביל.',
                },
                {
                  tip: 'בדוק כיוון יחסים — סיבה, תוצאה, תנאי',
                  example:
                    '"Unless it rains, the game will be played" = "The game will be played if it does not rain" — unless הוא תנאי שלילי מוסתר (ראה מדריך מילות הקישור). היפוך הכיוון כאן היא בדיוק סוג הטעות שתשובות מסיחות מנצלות.',
                },
              ].map((item, i) => (
                <div key={i} className="bg-exam-paper-alt border border-exam-border p-4 rounded-sm">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-exam-accent text-exam-accent-ink text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="font-bold text-exam-ink text-sm">{item.tip}</span>
                  </div>
                  <p className="text-exam-ink-soft text-xs leading-relaxed pr-7 italic">{item.example}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Common traps */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-4">מלכודות נפוצות — ולמה הן עובדות</h2>
            <div className="space-y-3">
              {[
                {
                  trap: 'אותן מילים — משמעות שונה',
                  detail: 'תשובה מכילה כ-70% מהמילים מהמקור, אבל הופכת את כיוון הסיבה-תוצאה. המבחן עושה זאת בכוונה כדי לבדוק אם אתה בודק לוגיקה או רק "זיהוי מילים מוכרות".',
                },
                {
                  trap: 'משמעות הפוכה (opposite)',
                  detail: 'כמעט תמיד יש אופציה שאומרת את ההפך המדויק מהמקור. אם נפלת עליה, זה סימן ברור שהבנת נכון את הנושא של המשפט אבל טעית בכיוון היחס הלוגי בתוכו — שווה לחזור ולבדוק מילת קישור.',
                },
                {
                  trap: 'משמעות חלקית (partial meaning)',
                  detail: 'התשובה נכונה לגבי חלק מהמשפט, אבל מחסירה מידע חשוב מהחלק השני. תמיד משווים נגד כל שלושת הרכיבים של הגרעין (מי, מה, קשר לוגי) — לא רק נגד הרכיב הראשון שקפץ לעין.',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-exam-alt-bg rounded-sm border border-exam-alt/40">
                  <AlertTriangle className="w-4 h-4 text-exam-alt flex-shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <div className="font-semibold text-exam-ink text-sm mb-1">{item.trap}</div>
                    <div className="text-exam-ink-soft text-xs leading-relaxed">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cross-link to strategies */}
          <Link href="/strategies" className="block bg-exam-accent/10 border border-exam-accent/30 rounded-md p-5 hover:bg-exam-accent/15 transition-colors">
            <div className="flex items-center gap-3">
              <Compass className="w-7 h-7 text-exam-accent flex-shrink-0" strokeWidth={1.5} aria-hidden />
              <div className="flex-1">
                <div className="font-bold text-exam-ink text-sm">מדריך מילות הקישור המלא</div>
                <div className="text-exam-ink-soft text-xs mt-0.5">
                  זיהוי הקשר הלוגי (הרכיב השלישי בגרעין) נשען כולו על מילות קישור. במדריך האסטרטגיות המלא יש הסבר
                  מלא לכל אחת — כולל מלכודות דקדוקיות.
                </div>
              </div>
              <span className="text-exam-accent">‹</span>
            </div>
          </Link>

          {/* Back link */}
          <div className="text-center pb-4">
            <Link href="/tips" className="text-sm text-exam-accent hover:opacity-80 transition-opacity">
              ← חזרה לכל האסטרטגיות
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
