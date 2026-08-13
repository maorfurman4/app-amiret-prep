'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps the installed PWA fresh:
 * - polls the service worker for a new version (on load, on focus, every 5 min)
 * - when a new version takes control, shows a reload banner instead of
 *   force-reloading, so an exam in progress is never interrupted
 */
export function PwaUpdater() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let hadController = !!navigator.serviceWorker.controller;

    const checkForUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      } catch { /* offline — ignore */ }
    };

    const onControllerChange = () => {
      // First controller on a fresh install is not an update. Also only
      // ever show the banner once per tab session — deploying multiple
      // times while the user has the app open shouldn't re-notify them
      // each time; sessionStorage survives their own refresh too.
      if (hadController && !sessionStorage.getItem('pwa_update_shown')) {
        setUpdateReady(true);
        sessionStorage.setItem('pwa_update_shown', '1');
      }
      hadController = true;
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(checkForUpdate, 5 * 60 * 1000);
    checkForUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, []);

  if (!updateReady) return null;

  return (
    <div
      className="fixed bottom-24 md:bottom-6 inset-x-0 z-50 flex justify-center px-4 transform-gpu"
      style={{ WebkitTransform: 'translateZ(0)' }}
      dir="rtl"
    >
      <div className="flex items-center gap-3 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl shadow-lg px-4 py-3 max-w-sm w-full">
        <span className="text-xl">✨</span>
        <span className="text-sm flex-1">גרסה חדשה של האתר זמינה</span>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 rounded-lg text-sm font-bold transition-colors"
        >
          רענן
        </button>
      </div>
    </div>
  );
}
