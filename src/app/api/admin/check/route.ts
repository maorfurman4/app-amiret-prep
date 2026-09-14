import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

/**
 * GET /api/admin/check
 * Used by /admin to decide whether to render the panel at all, instead of
 * showing it to every visitor and only failing on submit. The real
 * enforcement stays server-side on /api/questions/generate — this is a
 * UX gate, not the security boundary.
 */
export async function GET() {
  const { user } = await getServerClients();
  return NextResponse.json({ isAdmin: isAdminEmail(user?.email) });
}
