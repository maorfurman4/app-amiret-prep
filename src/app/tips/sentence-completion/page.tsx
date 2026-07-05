'use client';

import Link from 'next/link';
import { BackNav } from '@/components/BackNav';

export default function SentenceCompletionTipsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      <BackNav backHref="/tips" backLabel="אסטרטגיות" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-8">

          {/* Header */}
          <div className="text-center">
            <div className="text-4xl mb-3">✏️</div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">השלמת משפטים</h1>
            <p className="text-slate-500 text-sm">שאלות ברמה 100–150 | Sentence Completion</p>
          </div>

          {/* What it tests */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-3">מה הסעיף בודק?</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              סעיף זה בודק את יכולתך לבחור מילה שמשלימה משפט באופן תקין — הן מבחינת
              <span className="font-semibold text-slate-800"> אוצר המילים</span> (מה המילה אומרת)
              והן מבחינת <span className="font-semibold text-slate-800">הדקדוק</span> (איך המילה
              משתלבת במבנה המשפט). שתי הדרישות חייבות להתקיים יחד.
            </p>
          </div>

          {/* 5-step method */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">שיטה ב-5 שלבים</h2>
            <ol className="space-y-3">
              {[
                {
                  step: '1',
                  title: 'קרא את המשפט המלא',
                  body: 'לפני שאתה מסתכל על התשובות, קרא את כל המשפט והבן את ה-context. אל תקרא רק את חלק הפער.',
                },
                {
                  step: '2',
                  title: 'השלם בראש — לפני שאתה קורא את התשובות',
                  body: 'נסה לנחש בעצמך איזו מילה (או לפחות איזו משמעות) חסרה, עוד לפני שהצצת באופציות. אם אחת התשובות קרובה לניחוש שלך — היא כנראה הנכונה. כך המסיחים לא "ישתלו" לך רעיון בראש.',
                },
                {
                  step: '3',
                  title: 'נחש את סוג המילה',
                  body: 'האם חסרה שם-עצם? פועל? תואר שם? מילת חיבור? הגדר לעצמך מה אתה מחפש לפני שאתה קורא את האופציות.',
                },
                {
                  step: '4',
                  title: 'סלק לפי משמעות',
                  body: 'קרא כל אופציה בתוך המשפט. סלק מילים שאינן מתאימות מבחינת המשמעות הכוללת.',
                },
                {
                  step: '5',
                  title: 'בדוק התאמת טון',
                  body: 'האם המשפט חיובי, שלילי או נייטרלי? המילה הנכונה חייבת להתאים לטון הכולל — אל תבחר מילה "חיובית" למשפט שלילי.',
                },
              ].map(item => (
                <li key={item.step} className="border-l-4 border-blue-500 bg-blue-50/50 p-4 rounded-r-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {item.step}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{item.title}</span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed pr-8">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* 5 tips with examples */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">6 טיפים עם דוגמאות</h2>
            <div className="space-y-4">
              {[
                {
                  tip: 'חפש מילות מפתח לפני הפער ואחריו',
                  example: '"Despite the heavy rain, the event was a _____ success." → המילה "despite" מרמזת על ניגוד — תחפש משהו חיובי.',
                },
                {
                  tip: 'בדוק תאימות דקדוקית, לא רק משמעותית',
                  example: '"She has a _____ understanding of the topic." → חייבת להיות תואר שם (adjective) כגון: thorough / deep / broad.',
                },
                {
                  tip: 'שים לב למילות חיבור (connector words)',
                  example: '"He was tired; _____, he continued working." → אחרי נקודה-פסיק חסרה מילת מעבר כגון: however / nevertheless.',
                },
                {
                  tip: 'אוצר מילים: למד שורשים לטינים ויווניים',
                  example: 'שורש "bene-" = טוב: beneficial, benevolent, benign. מכיר אחת? תוכל לנחש את כולן.',
                },
                {
                  tip: 'אם אין לך מושג — בחר על פי יחסי ניגוד',
                  example: '"The speech was not _____ but rather confusing." → הפכי של "confusing" יכול להיות: clear / coherent / organized.',
                },
                {
                  tip: 'זהה תחיליות וסופיות — גם כשאינך מכיר את המילה',
                  example: 'תחיליות: un-/dis-/mis- = שלילה, re- = שוב, over- = יותר מדי. סופיות: ‎-tion/-ness = שם עצם, ‎-ful/-ous/-ive = תואר, ‎-ly = תואר הפועל. גם מילה זרה לגמרי מסגירה כך את סוגה ואת כיוונה.',
                },
              ].map((item, i) => (
                <div key={i} className="border-l-4 border-blue-500 bg-blue-50/50 p-4 rounded-r-xl">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
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
                  trap: 'מילה שנשמעת נכון אבל לא מתאימה דקדוקית',
                  detail: 'לדוגמה: "She gave a very _____ of the situation." — "describe" נשמעת נכון אבל "description" היא שם-העצם הנדרש.',
                },
                {
                  trap: 'מסיטים עם משמעות דומה',
                  detail: 'המבחן אוהב לכלול 2-3 מילים שנראות דומות. "affect" לעומת "effect", "principle" לעומת "principal" — הכירו את ההבדלים.',
                },
                {
                  trap: 'מילה שמשלימה את הפער אך הופכת את המשמעות',
                  detail: '"The policy was intended to _____ the problem." — האם "create" או "solve"? הקשר המשפט כולו מכריע.',
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

          {/* Connectors pack CTA */}
          <Link href="/vocabulary" className="block bg-amber-50 border border-amber-200 rounded-2xl p-5 hover:bg-amber-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔗</span>
              <div className="flex-1">
                <div className="font-bold text-amber-900 text-sm">חבילת 200+ מילות קישור</div>
                <div className="text-amber-700 text-xs mt-0.5">
                  מילות הקישור הן המפתח לזיהוי הקשר הלוגי במשפט — ניגוד, סיבה, תוספת. תרגל אותן בכרטיסיות באוצר המילים (קטגוריית &quot;מחברים&quot;).
                </div>
              </div>
              <span className="text-amber-400">‹</span>
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
