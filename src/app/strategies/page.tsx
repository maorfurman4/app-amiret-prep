import { BackNav } from '@/components/BackNav';

const STRATEGIES = [
  {
    id: 'sentence-completion',
    titleHe: 'השלמת משפטים',
    titleEn: 'Sentence Completion',
    icon: '✏️',
    color: 'blue',
    tips: [
      {
        heading: 'קרא את המשפט המלא קודם',
        body: 'לפני שאתה מסתכל על האפשרויות, קרא את המשפט כולו כדי להבין את ההקשר הכללי.',
      },
      {
        heading: 'זהה מילות קישור',
        body: 'מילות קישור חושפות את הקשר הלוגי:\n• although / but / despite / however / yet → ניגוד\n• also / in addition / furthermore / moreover → תוספת\n• because / therefore / thus / consequently → סיבה ותוצאה\n• similarly / likewise → השוואה',
      },
      {
        heading: 'נחש לפני שתקרא את האפשרויות',
        body: 'נסה לחשוב מה המילה החסרה לפני שאתה קורא את האפשרויות — זה מונע ממך להיות מושפע מתשובות מפתה אך שגויות.',
      },
      {
        heading: 'אלים תשובות שגויות',
        body: 'חפש תשובות שברור שאינן מתאימות: מילה שאינה מוגדרת, שינוי משמעות מהותי, או קשר לוגי הפוך. לעיתים קרובות אפשר לצמצם ל-2 אפשרויות ואז לבחור.',
      },
    ],
  },
  {
    id: 'restatement',
    titleHe: 'ניסוח מחדש',
    titleEn: 'Restatement',
    icon: '🔄',
    color: 'purple',
    tips: [
      {
        heading: 'זהה את הטענה המרכזית',
        body: 'לפני שאתה בוחר תשובה, הגדר לעצמך: מה המשפט המקורי אומר? מי עשה מה? מה הסיבה ומה התוצאה?',
      },
      {
        heading: 'ארבעה דברים שחייבים להישמר',
        body: '1. מי עשה את מה (הנושא והפועל)\n2. כיוון הסיבה-ותוצאה\n3. זמן הפועל (עבר / הווה / עתיד)\n4. שלילה — אם יש "not" במקור, חייב להישאר שלילה',
      },
      {
        heading: 'מלכודות נפוצות',
        body: '• הפוך סיבה ותוצאה — "A גרם ל-B" הפך ל-"B גרם ל-A"\n• מידע שלא קיים במשפט המקורי\n• החלשה או הגברה של הטענה — "יכול להיות" הפך ל-"בהכרח"\n• שינוי הזמן בפועל',
      },
      {
        heading: 'בדוק כל אפשרות מול המקור',
        body: 'קרא את התשובה שבחרת לצד המשפט המקורי ושאל: האם משמעותן זהה לחלוטין? אם יש אפילו הבדל קטן — זו לא התשובה הנכונה.',
      },
    ],
  },
  {
    id: 'reading-comprehension',
    titleHe: 'הבנת הנקרא',
    titleEn: 'Reading Comprehension',
    icon: '📚',
    color: 'green',
    tips: [
      {
        heading: 'קרא את השאלות לפני הקטע',
        body: 'קרא את כל השאלות לפני שאתה קורא את הקטע. כך אתה יודע מה לחפש ומה חשוב במיוחד לשים אליו לב.',
      },
      {
        heading: 'שאלת "הרעיון המרכזי"',
        body: 'התשובה נמצאת בדרך כלל במשפט הראשון או האחרון של הקטע (או הפסקה). אם התשובה לא שם — חפש את המשפט שמסכם את כל הטיעון.',
      },
      {
        heading: 'שאלות עם מספרי שורות',
        body: 'כשהשאלה מציינת שורה ספציפית, קרא גם 2 שורות לפני וגם 2 שורות אחרי. ההקשר חשוב להבנת המשמעות המדויקת.',
      },
      {
        heading: 'שאלות "ניתן להבין / ניתן להסיק"',
        body: 'אלו שאלות הסקה (inference). התשובה לא כתובה ישירות אלא נובעת מהטקסט. חשוב: ההסקה חייבת להתבסס על הקטע בלבד — לא על ידע כללי שלך.',
      },
      {
        heading: 'אלים תשובות עם מילים מוחלטות',
        body: 'היזהר מתשובות המכילות: only / always / never / all / none / must — אלו כמעט תמיד שגויות, אלא אם הטקסט אומר זאת במפורש.',
      },
    ],
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; heading: string }> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    heading: 'text-blue-800 dark:text-blue-300',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800',
    badge: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    heading: 'text-purple-800 dark:text-purple-300',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
    heading: 'text-emerald-800 dark:text-emerald-300',
  },
};

export default function StrategiesPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-5">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          🧠 אסטרטגיות
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          טיפים וטכניקות לכל סוג שאלה באמירנט
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {STRATEGIES.map(section => {
          const colors = COLOR_MAP[section.color];
          return (
            <section key={section.id}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${colors.badge}`}>
                  {section.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {section.titleHe}
                  </h2>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {section.titleEn}
                  </span>
                </div>
              </div>

              {/* Tips */}
              <div className={`rounded-2xl border ${colors.bg} ${colors.border} overflow-hidden`}>
                {section.tips.map((tip, i) => (
                  <div
                    key={i}
                    className={`px-4 py-4 ${i < section.tips.length - 1 ? `border-b ${colors.border}` : ''}`}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className={`mt-0.5 font-bold text-sm min-w-[1.2rem] text-center ${colors.heading}`}>
                        {i + 1}.
                      </span>
                      <h3 className={`font-bold text-sm ${colors.heading}`}>
                        {tip.heading}
                      </h3>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line pr-5">
                      {tip.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* General tip footer */}
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-2xl px-4 py-4">
          <div className="flex items-start gap-2">
            <span className="text-xl mt-0.5">💡</span>
            <div>
              <h3 className="font-bold text-yellow-800 dark:text-yellow-300 text-sm mb-1">
                טיפ כללי לכל השאלות
              </h3>
              <p className="text-yellow-700 dark:text-yellow-400 text-sm leading-relaxed">
                נהל את הזמן שלך: אם שאלה קשה — דלג עליה וחזור בסוף. עדיף לענות על הרבה שאלות קלות מאשר להתקע על אחת קשה.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
