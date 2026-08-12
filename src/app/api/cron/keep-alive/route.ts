import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

/**
 * Daily ping so Supabase's free-tier project never sits idle for the ~1 week
 * threshold that triggers its auto-pause. A single lightweight read is
 * enough — the point is activity, not the data itself.
 *
 * Vercel calls this automatically per the schedule in vercel.json, with an
 * Authorization: Bearer <CRON_SECRET> header. Requires CRON_SECRET to be set
 * as a Vercel env var (Project Settings → Environment Variables) — without
 * it, this route always returns 401 and the cron effectively no-ops safely.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { supabase } = await getServerClients();
  const { error } = await supabase.from('questions').select('id').limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
}
