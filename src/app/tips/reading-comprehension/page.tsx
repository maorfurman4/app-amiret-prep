'use client';

import Link from 'next/link';
import { BackNav } from '@/components/BackNav';

export default function ReadingComprehensionTipsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      <BackNav backHref="/tips" backLabel="אסטרטגיות" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-8">

          {/* Header */}
          <div className="text-center">
            <div className="text-4xl mb-3">📖</div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">הבנת הנקרא</h1>
            <p className="text-slate-500 text-sm">Reading Comprehension | קריאה אסטרטגית ויעילה</p>
          </div>

          {/* Reading approach */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-3">סדר הקריאה המומלץ — ולמה דווקא הוא</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              שתי גישות קיצוניות נפוצות אצל מכוני הכנה: לקרוא את כל השאלות לפני הקטע (מסוכן — הופך את הקריאה ל"חיפוש" ומפספס
              את הרעיון המרכזי), או לקרוא את הקטע במלואו בלי שום כיוון (מסוכן אחרת — קוראים "בחושך" וחוזרים לטקסט שוב ושוב).
              הגישה שעובדת הכי טוב היא <span className="font-semibold text-slate-800">משולבת</span>: הצצה קצרה שנותנת כיוון,
              ואז קריאה אחת מלאה שמכסה גם את הפרטים וגם את התמונה השלמה.
            </p>
            <ol className="space-y-3">
              {[
                {
                  n: '1',
                  title: 'הצצה בשאלות — כ-30 שניות, לא יותר',
                  body: 'לא לקרוא לעומק ובטח לא לקרוא את התשובות — רק לזהות מילות מפתח בשאלות עצמן ("לפי הקטע, מדוע…", "the word X most likely means"). זה נותן לך "מפת חיפוש" בראש בלי לפגוע ביכולת לתפוס את הרעיון הכללי בקריאה הבאה.',
                },
                {
                  n: '2',
                  title: 'קרא את הקטע ברצף אחד, מההתחלה עד הסוף',
                  body: 'קריאה מהירה ורצופה, בלי לעצור על מילה לא מוכרת (סמן אותה בראש והמשך). המטרה כאן היא לצאת עם שני דברים: מה הרעיון המרכזי, ומה יש בכל פסקה בקווים כלליים — לא לזכור כל משפט.',
                },
                {
                  n: '3',
                  title: 'ענה קודם על שאלות הפרט',
                  body: 'שאלות "לפי הקטע…" קלות יותר לפתור כי הן מחזירות אותך לפסקה ספציפית לפי מילת מפתח שכבר ראית בשלב 1. הן גם "מכריחות" אותך לחזור לטקסט ולרענן פרטים שיעזרו אחר כך.',
                },
                {
                  n: '4',
                  title: 'שמור את הרעיון המרכזי וההסקה לסוף',
                  body: 'אחרי שענית על שאלות הפרט, אתה כבר מכיר את הקטע לעומק בלי מאמץ נוסף — שאלות הכלל (main idea, הסקה) נהיות משמעותית קלות יותר בשלב הזה מאשר אם היית מנסה לענות עליהן ראשונות.',
                },
              ].map(item => (
                <li key={item.n} className="border-l-4 border-emerald-500 bg-emerald-50/50 p-4 rounded-r-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {item.n}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{item.title}</span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed pr-8">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* 3 question types */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">3 סוגי שאלות — ולמה כל אחת דורשת גישה שונה</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              לא כל שאלה בפרק נבדקת אותו דבר. זיהוי הסוג לפני שמנסים לענות חוסך זמן — כי הוא קובע איפה בכלל לחפש את התשובה:
              בתוך הטקסט המילולי, בין השורות, או במילה בודדת.
            </p>
            <div className="space-y-4">
              {[
                {
                  type: 'רעיון מרכזי (Main Idea)',
                  color: 'border-emerald-500 bg-emerald-50/50',
                  how: 'התשובה הנכונה חייבת להיות רחבה מספיק לכסות את כל הקטע, לא רק פסקה אחת ממנו. תשובה שמדייקת בפרט אחד אבל לא מתארת את הקטע כולו — פסולה, גם אם היא נכונה עובדתית.',
                  signal: 'מילות מפתח בשאלה: "mainly about", "primary purpose", "best title"',
                },
                {
                  type: 'פרט ספציפי (Specific Detail)',
                  color: 'border-blue-500 bg-blue-50/50',
                  how: 'אל תסתמך על הזיכרון מהקריאה הראשונה — חזור לקטע ואתר את המידע במפורש. כמעט תמיד המידע כתוב מילולית בטקסט, לא דורש הסקה.',
                  signal: 'מילות מפתח: "according to the passage", "the author states", "which of the following"',
                },
                {
                  type: 'מילה בהקשר (Vocabulary in Context)',
                  color: 'border-purple-500 bg-purple-50/50',
                  how: 'ההגדרה ה"מילונית" שאתה מכיר לא בהכרח נכונה כאן — קרא את המשפט הספציפי ובדוק איזו משמעות מתאימה להקשר הזה. זו שאלת הקשר, לא שאלת תרגום.',
                  signal: 'מילות מפתח: "the word X most likely means", "as used in paragraph Y"',
                },
              ].map((item, i) => (
                <div key={i} className={`border-l-4 p-4 rounded-r-xl ${item.color}`}>
                  <div className="font-bold text-slate-800 text-sm mb-2">{item.type}</div>
                  <p className="text-slate-600 text-sm leading-relaxed mb-2">{item.how}</p>
                  <p className="text-slate-400 text-xs italic">{item.signal}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Elimination method */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-4">שיטת האלימינציה</h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              כשלא בטוחים, פוסלים ולא מנחשים באקראי. ארבעה סוגי תשובות חוזרים כמלכודות — לזהות אותן זה כבר חצי מהעבודה:
            </p>
            <div className="space-y-2">
              {[
                { flag: 'קיצוני מדי', desc: '"always" / "never" / "all" / "completely" — קטעים אקדמיים כמעט אף פעם לא טוענים טענות כה מוחלטות. התשובה הנכונה בדרך כלל מאוזנת ("often", "may", "some").' },
                { flag: 'לא הוזכר', desc: 'נשמעת הגיונית ואפילו נכונה בעולם האמיתי — אבל פשוט לא כתובה בקטע. הידע הכללי שלך לא רלוונטי; רק מה שכתוב.' },
                { flag: 'הפוך', desc: 'ההפך המדויק ממה שהקטע אומר. מלכודת קלאסית לקורא ששרד את הקטע אבל התבלבל בכיוון של משפט ניגוד.' },
                { flag: 'מסיט', desc: 'קשור לנושא, מוזכר בקטע, אבל לא עונה בדיוק על מה שהשאלה שאלה. תמיד לחזור ולבדוק: זו התשובה לשאלה הזו, או לשאלה דומה?' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-red-400 font-bold text-xs mt-0.5 flex-shrink-0">✕</span>
                  <div>
                    <span className="font-semibold text-slate-700 text-sm">{item.flag}: </span>
                    <span className="text-slate-500 text-sm">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time management */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 mb-3">ניהול זמן</h2>
            <div className="border-l-4 border-emerald-500 bg-emerald-50/50 p-4 rounded-r-xl mb-3">
              <p className="font-bold text-slate-800 text-sm mb-1">15 דקות ל-5 שאלות — הפרק הכי גמיש במבחן</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                כ-4-5 דקות לקריאה הראשונית (חד-פעמית, משרתת את כל השאלות יחד), והשאר לענייה — כ-2 דקות לשאלה בממוצע.
                בגלל שהקריאה משותפת לכל 5 השאלות, זה הפרק היחיד שבו כדאי לדחות שאלה תקועה לסוף במקום להיאבק בה מיד.
              </p>
            </div>
            <div className="border-l-4 border-orange-400 bg-orange-50/50 p-4 rounded-r-xl">
              <p className="font-bold text-slate-800 text-sm mb-1">אל תתקע על שאלה קשה בעודך באמצע</p>
              <p className="text-slate-600 text-sm leading-relaxed">
                באמירנ"ט שאלה ריקה ושאלה שגויה שוות בדיוק (אפס נקודות) — אין שום יתרון בהשארת שאלה ריקה. אם שאלה בודדת
                גוזלת יותר מ-3 דקות, סמן ניחוש ועבור לשאלה הבאה; חזור אליה רק אם נשאר זמן אחרי שכל השאר נענו.
              </p>
            </div>
          </div>

          {/* Cross-link to strategies */}
          <Link href="/strategies" className="block bg-emerald-50 border border-emerald-200 rounded-2xl p-5 hover:bg-emerald-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧭</span>
              <div className="flex-1">
                <div className="font-bold text-emerald-900 text-sm">שיטות הקריאה בשוק — ולמה משולבת עדיפה</div>
                <div className="text-emerald-700 text-xs mt-0.5">
                  במדריך האסטרטגיות המלא יש השוואה מפורטת בין שלוש הגישות המקובלות בשוק ההכנה, כולל היתרונות והחסרונות של כל אחת.
                </div>
              </div>
              <span className="text-emerald-400">‹</span>
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
