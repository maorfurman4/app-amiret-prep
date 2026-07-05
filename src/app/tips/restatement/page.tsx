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
            <h2 className="text-lg font-bold text-slate-900 mb-3">מה הסעיף בודק?</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              בסעיף זה מוצג לך משפט מקור, ואתה נדרש לבחור מבין 4 אפשרויות את המשפט שמבטא
              <span className="font-semibold text-slate-800"> אותה משמעות בדיוק</span> — אך במבנה
              לשוני שונה. הבחינה בודקת הבנה עמוקה של משמעות, לא רק זיהוי מילים זהות.
            </p>
          </div>

          {/* Core method */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">השיטה הבסיסית</h2>
            <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4 rounded-r-xl mb-4">
              <p className="font-bold text-slate-800 text-sm mb-1">מצא את גרעין המשפט: מי עשה מה, למי, ומה הקשר הלוגי</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                פרק את משפט המקור לשלושה רכיבים: <span className="font-semibold">מי</span> (הנושא),{' '}
                <span className="font-semibold">מה קרה</span> (הפעולה והתוצאה), ו
                <span className="font-semibold">איזה קשר לוגי</span> מחבר ביניהם — ניגוד (although, despite),
                סיבה-תוצאה (because, therefore) או תנאי (if, unless). התשובה הנכונה חייבת לשמור על
                שלושת הרכיבים בדיוק, גם אם המילים והסדר שונים לגמרי.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4 rounded-r-xl mb-4">
              <p className="font-bold text-slate-800 text-sm mb-1">התמקד במשמעות — לא במילים</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                קרא את המשפט המקורי ותנסח לעצמך בעברית מה הוא אומר. לאחר מכן בדוק כל אפשרות —
                האם היא אומרת את אותו הדבר בדיוק? תשובה נכונה לא תכיל את אותן המילים, אבל תכיל
                את אותה הלוגיקה.
              </p>
            </div>
            <div className="border-l-4 border-purple-500 bg-purple-50/50 p-4 rounded-r-xl">
              <p className="font-bold text-slate-800 text-sm mb-1">בדוק: האם כל חלקי המשמעות נשמרו?</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                המשפט המקורי לפעמים מכיל מספר מידעים. תשובה נכונה שומרת על
                <span className="font-semibold"> כל</span> הפרטים — לא רק חלקם.
              </p>
            </div>
          </div>

          {/* 5 tips */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">5 טיפים מרכזיים</h2>
            <div className="space-y-3">
              {[
                {
                  tip: 'התעלם ממילי-שירות — התמקד בתוכן',
                  example: '"It was not until Monday that the results were announced" = "The results were announced on Monday" — אל תיבהל מהמבנה המסובך.',
                },
                {
                  tip: 'בדוק כמותיים: all / some / most / none',
                  example: '"All students passed" ≠ "Most students passed". שינוי קוונטיפייר = שינוי משמעות. תשובה עם "some" במקום "all" היא שגויה.',
                },
                {
                  tip: 'בדוק שלילות (negation) בזהירות',
                  example: '"He is not unhappy" = "He is happy". שתי שלילות מבטלות זו את זו — אל תתבלבל!',
                },
                {
                  tip: 'פעיל לעומת סביל (Active vs. Passive) — המשמעות לא משתנה',
                  example: '"The manager approved the plan" = "The plan was approved by the manager". שניהם אומרים אותו דבר בדיוק.',
                },
                {
                  tip: 'בדוק כיוון יחסים (cause/effect, condition)',
                  example: '"Unless it rains, the game will be played" = "The game will be played if it does not rain". ה-unless הוא תנאי שלילי.',
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
            <h2 className="text-lg font-bold text-slate-900 mb-4">מלכודות נפוצות</h2>
            <div className="space-y-3">
              {[
                {
                  trap: 'אותן מילים — משמעות שונה',
                  detail: 'תשובה מכילה 70% מהמילים מהמקור אבל הופכת את ה-cause וה-effect. המבחן עושה זאת בכוונה.',
                },
                {
                  trap: 'משמעות הפוכה (opposite)',
                  detail: 'אחת האפשרויות תמיד אומרת ההפך המדויק. אם נפלת עליה — סימן שהבנת את הכיוון הלא נכון.',
                },
                {
                  trap: 'משמעות חלקית (partial meaning)',
                  detail: 'התשובה נכונה לגבי חלק מהמשפט אבל מחסירה מידע חשוב. תמיד בדוק את כל חלקי המשפט המקורי.',
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
