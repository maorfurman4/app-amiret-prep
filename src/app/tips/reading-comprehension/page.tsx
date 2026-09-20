'use client';

import Link from 'next/link';
import { BookOpen, X, Compass } from 'lucide-react';
import { BackNav } from '@/components/BackNav';

export default function ReadingComprehensionTipsPage() {
  return (
    <div className="min-h-screen bg-exam-paper flex flex-col" dir="rtl">
      <BackNav backHref="/tips" backLabel="אסטרטגיות" />
      <div className="flex-1 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-8">

          {/* Header */}
          <div className="text-center">
            <BookOpen className="w-9 h-9 mx-auto mb-3 text-exam-ink" strokeWidth={1.5} aria-hidden />
            <h1 className="text-3xl font-bold text-exam-ink mb-2">הבנת הנקרא</h1>
            <p className="text-exam-ink-soft text-sm">Reading Comprehension | קריאה אסטרטגית ויעילה</p>
          </div>

          {/* Reading approach */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-3">סדר הקריאה המומלץ — ולמה דווקא הוא</h2>
            <p className="text-exam-ink-soft text-sm leading-relaxed mb-4">
              שתי גישות קיצוניות נפוצות אצל מכוני הכנה: לקרוא את כל השאלות לפני הקטע (מסוכן — הופך את הקריאה ל&quot;חיפוש&quot; ומפספס
              את הרעיון המרכזי), או לקרוא את הקטע במלואו בלי שום כיוון (מסוכן אחרת — קוראים &quot;בחושך&quot; וחוזרים לטקסט שוב ושוב).
              הגישה שעובדת הכי טוב היא <span className="font-semibold text-exam-ink">משולבת</span>: הצצה קצרה שנותנת כיוון,
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
                <li key={item.n} className="bg-exam-paper-alt border border-exam-border p-4 rounded-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-exam-accent text-exam-accent-ink text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {item.n}
                    </span>
                    <span className="font-bold text-exam-ink text-sm">{item.title}</span>
                  </div>
                  <p className="text-exam-ink-soft text-sm leading-relaxed pr-8">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* 3 question types */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-4">3 סוגי שאלות — ולמה כל אחת דורשת גישה שונה</h2>
            <p className="text-exam-ink-soft text-sm leading-relaxed mb-4">
              לא כל שאלה בפרק נבדקת אותו דבר. זיהוי הסוג לפני שמנסים לענות חוסך זמן — כי הוא קובע איפה בכלל לחפש את התשובה:
              בתוך הטקסט המילולי, בין השורות, או במילה בודדת.
            </p>
            <div className="space-y-4">
              {[
                {
                  type: 'רעיון מרכזי (Main Idea)',
                  color: 'bg-exam-sage-bg border-exam-sage/40',
                  how: 'התשובה הנכונה חייבת להיות רחבה מספיק לכסות את כל הקטע, לא רק פסקה אחת ממנו. תשובה שמדייקת בפרט אחד אבל לא מתארת את הקטע כולו — פסולה, גם אם היא נכונה עובדתית.',
                  signal: 'מילות מפתח בשאלה: "mainly about", "primary purpose", "best title"',
                },
                {
                  type: 'פרט ספציפי (Specific Detail)',
                  color: 'bg-exam-accent/10 border-exam-accent/30',
                  how: 'אל תסתמך על הזיכרון מהקריאה הראשונה — חזור לקטע ואתר את המידע במפורש. כמעט תמיד המידע כתוב מילולית בטקסט, לא דורש הסקה.',
                  signal: 'מילות מפתח: "according to the passage", "the author states", "which of the following"',
                },
                {
                  type: 'מילה בהקשר (Vocabulary in Context)',
                  color: 'bg-exam-alt-bg border-exam-alt/40',
                  how: 'ההגדרה ה"מילונית" שאתה מכיר לא בהכרח נכונה כאן — קרא את המשפט הספציפי ובדוק איזו משמעות מתאימה להקשר הזה. זו שאלת הקשר, לא שאלת תרגום.',
                  signal: 'מילות מפתח: "the word X most likely means", "as used in paragraph Y"',
                },
              ].map((item, i) => (
                <div key={i} className={`border p-4 rounded-sm ${item.color}`}>
                  <div className="font-bold text-exam-ink text-sm mb-2">{item.type}</div>
                  <p className="text-exam-ink-soft text-sm leading-relaxed mb-2">{item.how}</p>
                  <p className="text-exam-ink-soft text-xs italic">{item.signal}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Elimination method */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-4">שיטת האלימינציה</h2>
            <p className="text-exam-ink-soft text-sm leading-relaxed mb-4">
              כשלא בטוחים, פוסלים ולא מנחשים באקראי. ארבעה סוגי תשובות חוזרים כמלכודות — לזהות אותן זה כבר חצי מהעבודה:
            </p>
            <div className="space-y-2">
              {[
                { flag: 'קיצוני מדי', desc: '"always" / "never" / "all" / "completely" — קטעים אקדמיים כמעט אף פעם לא טוענים טענות כה מוחלטות. התשובה הנכונה בדרך כלל מאוזנת ("often", "may", "some").' },
                { flag: 'לא הוזכר', desc: 'נשמעת הגיונית ואפילו נכונה בעולם האמיתי — אבל פשוט לא כתובה בקטע. הידע הכללי שלך לא רלוונטי; רק מה שכתוב.' },
                { flag: 'הפוך', desc: 'ההפך המדויק ממה שהקטע אומר. מלכודת קלאסית לקורא ששרד את הקטע אבל התבלבל בכיוון של משפט ניגוד.' },
                { flag: 'מסיט', desc: 'קשור לנושא, מוזכר בקטע, אבל לא עונה בדיוק על מה שהשאלה שאלה. תמיד לחזור ולבדוק: זו התשובה לשאלה הזו, או לשאלה דומה?' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-exam-paper-alt rounded-sm border border-exam-border">
                  <X className="w-3.5 h-3.5 text-exam-wrong flex-shrink-0 mt-0.5" strokeWidth={3} aria-hidden />
                  <div>
                    <span className="font-semibold text-exam-ink text-sm">{item.flag}: </span>
                    <span className="text-exam-ink-soft text-sm">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time management */}
          <div className="bg-exam-surface rounded-md p-6 border border-exam-border">
            <h2 className="text-lg font-bold text-exam-ink mb-3">ניהול זמן</h2>
            <div className="bg-exam-sage-bg border border-exam-sage/40 p-4 rounded-sm mb-3">
              <p className="font-bold text-exam-ink text-sm mb-1">15 דקות ל-5 שאלות — הפרק הכי גמיש במבחן</p>
              <p className="text-exam-ink-soft text-sm leading-relaxed">
                כ-4-5 דקות לקריאה הראשונית (חד-פעמית, משרתת את כל השאלות יחד), והשאר לענייה — כ-2 דקות לשאלה בממוצע.
                בגלל שהקריאה משותפת לכל 5 השאלות, זה הפרק היחיד שבו כדאי לדחות שאלה תקועה לסוף במקום להיאבק בה מיד.
              </p>
            </div>
            <div className="bg-exam-alt-bg border border-exam-alt/40 p-4 rounded-sm">
              <p className="font-bold text-exam-ink text-sm mb-1">אל תתקע על שאלה קשה בעודך באמצע</p>
              <p className="text-exam-ink-soft text-sm leading-relaxed">
                באמירנ&quot;ט שאלה ריקה ושאלה שגויה שוות בדיוק (אפס נקודות) — אין שום יתרון בהשארת שאלה ריקה. אם שאלה בודדת
                גוזלת יותר מ-3 דקות, סמן ניחוש ועבור לשאלה הבאה; חזור אליה רק אם נשאר זמן אחרי שכל השאר נענו.
              </p>
            </div>
          </div>

          {/* Cross-link to strategies */}
          <Link href="/strategies" className="block bg-exam-sage-bg border border-exam-sage/40 rounded-md p-5 hover:opacity-90 transition-opacity">
            <div className="flex items-center gap-3">
              <Compass className="w-7 h-7 text-exam-sage-strong flex-shrink-0" strokeWidth={1.5} aria-hidden />
              <div className="flex-1">
                <div className="font-bold text-exam-ink text-sm">שיטות הקריאה בשוק — ולמה משולבת עדיפה</div>
                <div className="text-exam-ink-soft text-xs mt-0.5">
                  במדריך האסטרטגיות המלא יש השוואה מפורטת בין שלוש הגישות המקובלות בשוק ההכנה, כולל היתרונות והחסרונות של כל אחת.
                </div>
              </div>
              <span className="text-exam-sage-strong">‹</span>
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
