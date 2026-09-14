/** Simple admin check via an allowlisted email — can be replaced with a roles table. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim());
  return adminEmails.includes(email);
}
