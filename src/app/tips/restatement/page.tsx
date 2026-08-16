'use client';

import Link from 'next/link';
import { BackNav } from '@/components/BackNav';

export default function RestatementTipsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      <BackNav backHref="/tips" backLabel="אסטרטגיות" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-8">

          {/* Header */}
          <div className="text-center">
            <div className="text-4xl mb-3">🔁</div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">ניסוח מחדש</h1>
            <p className="text-slate-500 text-sm">Restatement | מציאת משמעות זהה במבנה שונה</p>
          </div>

          {/* What it tests */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-3">מה הסעיף בודק — ולמה זו לא בדיקת אוצר מילים</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              מוצג לך משפט מקור, ועליך לבחור מבין 4 אפשרויות את זו שמבטאת <span className="font-semibold text-slate-800">אותה משמעות בדיוק</span> —
              במבנה לשוני שונה לחלוטין. זו בדיוק הסיבה שהתשובה הנכונה כמעט אף פעם לא "נראית" הכי דומה למקור: תשובה שמעתיקה
              80% מהמילים המקוריות היא בדרך כלל מלכודת שמחליפה בשקט פרט קריטי (כיוון, כמות, שלילה). המבחן בודק אם הבנת
              את <span className="font-semibold text-slate-800">הלוגיקה</span> של המשפט, לא אם זיהית מילים מוכרות בתוכו.
            </p>
          </div>

          {/* Core method */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">השיטה הבסיסית</h2>
            <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4 rounded-r-xl mb-4">
              <p className="font-bold text-slate-800 text-sm mb-1">מצא את גרעין המשפט: מי עשה מה, למי, ומה הקשר הלוגי</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                פרק את משפט המקור לשלושה רכיבים: <span className="font-semibold">מי</span> (הנושא),{' '}
                <span className="font-semibold">מה קרה</span> (הפעולה והתוצאה), ו-
                <span className="font-semibold">איזה קשר לוגי</span> מחבר ביניהם — ניגוד (although, despite),
                סיבה-תוצאה (because, therefore) או תנאי (if, unless — ראה מדריך מילות הקישור). זה "תעודת הזהות" של המשפט:
                כל תשובה שמשנה אפילו רכיב אחד מהשלושה — משנה משפט לגמרי אחר, גם אם היא נשמעת דומה.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4 rounded-r-xl mb-4">
              <p className="font-bold text-slate-800 text-sm mb-1">התמקד במשמעות — לא במילים</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                נסח לעצמך בעברית מה המשפט אומר, לפני שאתה קורא אפשרות אחת. הסיבה: ברגע שאתה משווה מילה-למילה נגד האנגלית
                המקורית, קל "להיתפס" על תשובה שחולקת אוצר מילים אבל לא לוגיקה. השוואה נגד תרגום עברי משלך מנטרלת את המלכודת
                הזו — כי אתה בודק רעיון מול רעיון, לא מילה מול מילה.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4 rounded-r-xl">
              <p className="font-bold text-slate-800 text-sm mb-1">בדוק: האם כל חלקי המשמעות נשמרו?</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                משפטי מקור מכילים לרוב יותר ממידע אחד (למשל: מי + מתי + למה). תשובה נכונה שומרת על <span className="font-semibold">כולם</span> —
                תשובה שמדייקת בחלק אחד ומחסירה או משנה חלק אחר עדיין נחשבת שגויה. זו הסיבה ש"קרוב" לא מספיק כאן.
              </p>
            </div>
          </div>

          {/* 5 tips */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">5 טיפים מרכזיים</h2>
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
                <div key={i} className="border-l-4 border-purple-500 bg-purple-50/50 p-4 rounded-r-xl">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{item.tip}</span>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed pr-7 italic">{item.example}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Common traps */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">מלכודות נפוצות — ולמה הן עובדות</h2>
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
                <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                  <span className="text-red-400 text-lg flex-shrink-0">⚠️</span>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm mb-1">{item.trap}</div>
                    <div className="text-slate-500 text-xs leading-relaxed">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cross-link to strategies */}
          <Link href="/strategies" className="block bg-purple-50 border border-purple-200 rounded-2xl p-5 hover:bg-purple-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧭</span>
              <div className="flex-1">
                <div className="font-bold text-purple-900 text-sm">מדריך מילות הקישור המלא</div>
                <div className="text-purple-700 text-xs mt-0.5">
                  זיהוי הקשר הלוגי (הרכיב השלישי בגרעין) נשען כולו על מילות קישור. במדריך האסטרטגיות המלא יש הסבר
                  מלא לכל אחת — כולל מלכודות דקדוקיות.
                </div>
              </div>
              <span className="text-purple-400">‹</span>
            </div>
          </Link>

          {/* Back link */}
          <div className="text-center pb-4">
            <Link href="/tips" className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
              ← חזרה לכל האסטרטגיות
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
