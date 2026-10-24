import { CONTACT_EMAIL } from '@/lib/contact';

/** The support/privacy email as a mailto link. Shared by /privacy and /help. */
export function ContactEmailLink({ className }: { className?: string }) {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={className}>
      <bdi dir="ltr">{CONTACT_EMAIL}</bdi>
    </a>
  );
}
