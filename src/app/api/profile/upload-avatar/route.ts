import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Every path an avatar can live at — one per allowed format. */
function avatarPaths(userId: string): string[] {
  return Object.values(ALLOWED_TYPES).map(ext => `${userId}/avatar.${ext}`);
}

/**
 * POST /api/profile/upload-avatar  (multipart/form-data, field "file")
 * Uploads to the public "avatars" bucket at {user.id}/avatar.{ext} (upsert),
 * then syncs the resulting URL onto auth user_metadata and user_stats.
 * user_stats is the copy the UI reads: a Google sign-in resets user_metadata.
 */
export async function POST(req: NextRequest) {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 3MB)' }, { status: 400 });
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'סוג הקובץ לא נתמך. אפשר להעלות JPG, PNG, WEBP או GIF' }, { status: 400 });
  }

  const path = `${user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  const avatarUrl = `${pub.publicUrl}?t=${Date.now()}`;

  const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar_url: avatarUrl },
  });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  await supabase.from('user_stats').upsert({ user_id: user.id, avatar_url: avatarUrl }, { onConflict: 'user_id' });

  // A photo in another format (a .png replaced by a .jpg) would otherwise
  // stay in the public bucket. Best-effort: the new photo is already live.
  await supabase.storage.from('avatars').remove(avatarPaths(user.id).filter(p => p !== path)).catch(() => {});

  return NextResponse.json({ ok: true, avatarUrl });
}

/**
 * DELETE /api/profile/upload-avatar
 * Clears the custom avatar. The menu then shows the provider photo if there
 * is one (a Google sign-in puts it back in user_metadata anyway), else initials.
 * The file itself is deleted too: the bucket is public, so a nulled URL alone
 * left the photo reachable at its old address.
 */
export async function DELETE() {
  const { supabase, user } = await getServerClients();
  if (!user) return NextResponse.json({ error: 'auth required' }, { status: 401 });

  const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar_url: null },
  });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  await supabase.from('user_stats').update({ avatar_url: null }).eq('user_id', user.id);

  const { error: removeErr } = await supabase.storage.from('avatars').remove(avatarPaths(user.id));
  // Retrying is safe: the URL is already cleared and removing is idempotent.
  if (removeErr) return NextResponse.json({ error: 'לא הצלחנו למחוק את התמונה. נסה שוב.' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
