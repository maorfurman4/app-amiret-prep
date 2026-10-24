import Link from 'next/link';

/**
 * Small-print terms/privacy links, the conventional bottom-of-screen spot.
 * Both open the single /privacy page (it holds the terms too). Pass a palette
 * color via `className` (menu-* in the account menu, exam-* on auth screens).
 */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs ${className}`}>
      <Link href="/privacy" className="hover:underline underline-offset-2">תנאי שימוש</Link>
      {' · '}
      <Link href="/privacy" className="hover:underline underline-offset-2">מדיניות פרטיות</Link>
    </p>
  );
}
