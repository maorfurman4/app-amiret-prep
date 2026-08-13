import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/BottomNav';
import { PwaUpdater } from '@/components/PwaUpdater';
import { ActivityGuardProvider } from '@/lib/activity-guard';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

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
    <html lang="he" dir="rtl" className={`${geist.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}})()` }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-900 pb-24 md:pb-0">
        <ActivityGuardProvider>
          {children}
          <BottomNav />
          <PwaUpdater />
        </ActivityGuardProvider>
      </body>
    </html>
  );
}
