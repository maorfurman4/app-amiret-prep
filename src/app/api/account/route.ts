import { NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';
import { ACCOUNT_TABLES, DELETE_CONFIRMATION } from '@/lib/account-deletion';

/** Same paths /api/profile/upload-avatar writes. */
const AVATAR_PATHS = (userId: string) => ['jpg', 'png', 'webp', 'gif'].map(ext => `${userId}/avatar.${ext}`);

/**
 * DELETE /api/account  { confirm: 'DELETE_MY_ACCOUNT' }
 * Deletes the caller's own account: every row keyed to them, their avatar
 * files, then the auth user. The id comes only from the verified session,
 * never from the request. Data goes first so a failure part-way leaves a
 * signed-in account that can simply retry; the auth user goes last.
 */
export async function DELETE(req: Request) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== DELETE_CONFIRMATION) {
    return NextResponse.json({ error: 'confirmation required' }, { status: 400 });
  }

  // Deleting the auth user needs the service role. Check it before touching
  // any data, so a misconfigured server never leaves a half-deleted account.
  const { error: adminErr } = await supabase.auth.admin.getUserById(user.id);
  if (adminErr) return NextResponse.json({ error: 'לא ניתן למחוק את החשבון כרגע. נסה שוב מאוחר יותר.' }, { status: 503 });

  for (const { table, column, ownerType } of ACCOUNT_TABLES) {
    let query = supabase.from(table).delete().eq(column, user.id);
    if (ownerType) query = query.eq('owner_type', 'user');
    const { error } = await query;
    if (error) {
      console.error(`[account] delete from ${table} failed:`, error);
      return NextResponse.json({ error: 'המחיקה נכשלה באמצע. נסה שוב.' }, { status: 500 });
    }
  }

  const { error: storageErr } = await supabase.storage.from('avatars').remove(AVATAR_PATHS(user.id));
  if (storageErr) {
    console.error('[account] avatar removal failed:', storageErr);
    return NextResponse.json({ error: 'המחיקה נכשלה באמצע. נסה שוב.' }, { status: 500 });
  }

  const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
  if (authErr) {
    console.error('[account] auth user deletion failed:', authErr);
    return NextResponse.json({ error: 'המחיקה נכשלה באמצע. נסה שוב.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
