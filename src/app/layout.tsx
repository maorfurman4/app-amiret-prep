import type { Metadata, Viewport } from 'next';
import { Heebo, Lora } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';
import { ActivityGuardProvider } from '@/lib/activity-guard';

// UI font (Hebrew + Latin) — used everywhere via --font-sans in globals.css.
const heebo = Heebo({ subsets: ['hebrew', 'latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-heebo' });
// Exam-content serif — applied ONLY via the `font-serif` utility, scoped to
// the English question/option/passage text inside QuestionCard. Never global.
const lora = Lora({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-lora' });

const SITE_URL = 'https://amiret-prep.vercel.app';
const TITLE = '134+ | הכנה לאמירנ"ט';
const DESCRIPTION = '134+ — פלטפורמת הכנה אדפטיבית למבחן אמירנ"ט, בדרך לפטור';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  appleWebApp: {
    title: '134+',
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: '134+',
    locale: 'he_IL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${lora.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{t=localStorage.getItem('theme')}catch(e){}if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}})()` }} />
      </head>
      <body className="min-h-full flex flex-col bg-exam-paper pb-24 md:pb-0">
        <ActivityGuardProvider>
          {children}
          <BottomNav />
        </ActivityGuardProvider>
      </body>
    </html>
  );
}
