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
            <h2 className="text-lg font-bold text-slate-900 mb-3">מה הסעיף בודק — ולמה שתי בדיקות, לא אחת</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              כל שאלה כאן בודקת שתי שכבות בו-זמנית: <span className="font-semibold text-slate-800">משמעות</span> (האם המילה
              מתאימה להקשר הלוגי של המשפט) ו-<span className="font-semibold text-slate-800">דקדוק</span> (האם היא מתאימה
              מבחינת סוג המילה וההטיה). זו הסיבה שאי אפשר לפתור לפי "מה שנשמע נכון" — מילה יכולה להישמע טוב באוזן
              ועדיין להיות שגויה דקדוקית, או להתאים דקדוקית ולסתור את ההיגיון של המשפט. השיטה למטה בנויה כך שהיא בודקת
              את שתי השכבות בנפרד, בכוונה, כדי שאף אחת מהן לא "תתחמק" מבדיקה.
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
                  body: 'קריאה חלקית (רק סביב הפער) היא המקור הכי נפוץ לטעויות — כי היא מפספסת בדיוק את מילת הקישור או הפרט שקובע את הכיוון. תמיד קוראים את המשפט כולו קודם, ורק אז חוזרים לפער.',
                },
                {
                  step: '2',
                  title: 'השלם בראש — לפני שאתה קורא את התשובות',
                  body: 'ברגע שאתה קורא את ארבע האופציות לפני שגיבשת ציפייה משלך, המוח מתחיל "להיצמד" למילה שנשמעת הכי מוכרת — גם אם היא שגויה. ניחוש עצמאי (ולו כללי: "צריך כאן משהו שלילי") הוא חיסון נגד המלכודת הזו, כי הוא נותן לך קנה מידה בלתי-תלוי להשוות אליו כל אופציה.',
                },
                {
                  step: '3',
                  title: 'נחש את סוג המילה',
                  body: 'לפני שקוראים את האופציות, קבע: שם עצם? פועל? תואר? זו לא שאלת אוצר מילים בלבד — התפקיד הדקדוקי של הפער כבר פוסל אוטומטית כל אופציה מהסוג הלא-נכון, לרוב חצי מהרשימה, בלי צורך אפילו לדעת את המשמעות שלהן.',
                },
                {
                  step: '4',
                  title: 'סלק לפי משמעות',
                  body: 'הצב כל אופציה שנשארה בתוך המשפט, לא לבד. מילה יכולה להיות תקינה כשלעצמה ועדיין לא להתאים להקשר הספציפי הזה — הבדיקה תמיד בהקשר המלא, לא במנותק ממנו.',
                },
                {
                  step: '5',
                  title: 'בדוק התאמת טון',
                  body: 'זהו הסינון האחרון והכי אמין כשנשארות שתי אופציות קרובות: המשפט כולו חיובי, שלילי או ניטרלי? מילת הקישור (ראה מדריך מילות הקישור) כבר סימנה לך את הטון הצפוי — אם התשובה סותרת אותו, היא שגויה גם אם היא "נשמעת" סבירה.',
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

          {/* 6 tips with examples */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">6 טיפים עם דוגמאות</h2>
            <div className="space-y-4">
              {[
                {
                  tip: 'חפש מילות מפתח לפני הפער ואחריו',
                  example:
                    '"Despite the heavy rain, the event was a _____ success." — "despite" הוא מילת ניגוד (ראה מדריך מילות הקישור): גשם כבד היה אמור להזיק לאירוע, אז המילה החסרה חייבת לסתור את הציפייה הזו ולהיות חיובית — "resounding" או "remarkable", לא "modest" או "limited".',
                },
                {
                  tip: 'בדוק תאימות דקדוקית, לא רק משמעותית',
                  example:
                    '"She has a _____ understanding of the topic." — "understanding" הוא שם עצם, ולכן הפער דורש תואר שם (adjective) שמתאר אותו: thorough / deep / broad. גרסת הפועל של אותה משפחת מילים ("understand") תיפסל מיד בגלל תפקיד דקדוקי שגוי, גם אם המשמעות קרובה.',
                },
                {
                  tip: 'שים לב למילות חיבור בין-משפטיות',
                  example:
                    '"He was tired; _____, he continued working." — אחרי נקודה-פסיק חסרה מילת קישור בין-משפטית שמסמנת ניגוד: however / nevertheless. שימו לב שהמבנה הדקדוקי כאן (נקודה-פסיק + פסיק) הוא בדיוק מה שהמדריך מסביר לגבי however.',
                },
                {
                  tip: 'אוצר מילים: למד שורשים לטיניים ויווניים',
                  example:
                    'שורש "bene-" = טוב: beneficial, benevolent, benign. ברגע שמזהים שורש משותף, אפשר לנחש משמעות של מילה לא-מוכרת מתוך משפחה מוכרת — זה עובד גם באמצע מבחן, בלי מילון.',
                },
                {
                  tip: 'אם אין לך מושג — בחר לפי יחסי ניגוד במשפט',
                  example:
                    '"The speech was not _____ but rather confusing." — "not X but rather Y" הוא מבנה ניגוד מפורש: X ו-Y חייבים להיות הפכים. אם "confusing" הוא Y, אז X חייב להיות ההפך שלו — "clear" או "coherent".',
                },
                {
                  tip: 'זהה תחיליות וסופיות — גם כשאינך מכיר את המילה',
                  example:
                    'תחיליות: un-/dis-/mis- = שלילה, re- = שוב, over- = יותר מדי. סופיות: ‎-tion/-ness = שם עצם, ‎-ful/-ous/-ive = תואר, ‎-ly = תואר הפועל. מילה זרה לגמרי עדיין "מסגירה" כך את התפקיד הדקדוקי שלה ולעיתים את כיוון המשמעות — מספיק כדי לפסול חלק מהאופציות בלי לדעת את התרגום המדויק.',
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
            <h2 className="text-lg font-bold text-slate-900 mb-4">מלכודות נפוצות — ולמה הן עובדות</h2>
            <div className="space-y-3">
              {[
                {
                  trap: 'מילה שנשמעת נכון אבל לא מתאימה דקדוקית',
                  detail: '"She gave a very _____ of the situation." — "describe" (פועל) נשמעת קרובה למשמעות הרצויה, אבל אחרי "a very" נדרש שם עצם: "description". המלכודת עובדת כי המשמעות מפתה אותך להתעלם מהתפקיד הדקדוקי.',
                },
                {
                  trap: 'מסיחים עם משמעות דומה',
                  detail: 'המבחן כולל בכוונה 2-3 מילים שנראות/נשמעות דומות אך שונות במשמעות: "affect" (פועל, להשפיע) לעומת "effect" (שם עצם, השפעה), "principle" (עיקרון) לעומת "principal" (ראשי/מנהל). ההבדל נקבע לפי תפקיד המילה במשפט, לא לפי הצליל.',
                },
                {
                  trap: 'מילה שמשלימה את הפער אך הופכת את המשמעות',
                  detail: '"The policy was intended to _____ the problem." — גם "create" וגם "solve" מסתדרים דקדוקית (שני פעלים), אבל רק אחד הגיוני מבחינת מטרת "policy". כאן חובה לחזור להקשר הכולל של המשפט, לא רק לתאימות הדקדוקית המקומית.',
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
          <Link href="/strategies" className="block bg-blue-50 border border-blue-200 rounded-2xl p-5 hover:bg-blue-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧭</span>
              <div className="flex-1">
                <div className="font-bold text-blue-900 text-sm">מדריך מילות הקישור המלא</div>
                <div className="text-blue-700 text-xs mt-0.5">
                  הצעד השני בשיטה כאן ("נחש בראש") נשען בעיקר על זיהוי מילת הקישור. במדריך האסטרטגיות המלא יש הסבר
                  מלא לכל מילה — כולל המלכודות הדקדוקיות שלה.
                </div>
              </div>
              <span className="text-blue-400">‹</span>
            </div>
          </Link>

          {/* Connectors pack CTA */}
          <Link href="/vocabulary?pack=connectors" className="block bg-amber-50 border border-amber-200 rounded-2xl p-5 hover:bg-amber-100 transition-colors">
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
