import { NextRequest, NextResponse } from 'next/server';
import { getServerClients } from '@/lib/supabase-server';

/**
 * GET /api/exam/state?sessionId=xxx
 * Returns current session state for F5-recovery.
 * Enforces server timer: if current_section_expires_at has passed,
 * auto-advances the section (caller should handle this).
 */
export async function GET(req: NextRequest) {
  const { authClient, supabase } = await getServerClients();
  const { data: { user } } = await authClient.auth.getUser();

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const guestId = req.nextUrl.searchParams.get('guestId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const sessionOwner = user?.id ?? guestId;
  const query = supabase.from('exam_sessions').select('*').eq('id', sessionId);
  if (sessionOwner) query.eq('user_id', sessionOwner);
  const { data: session } = await query.single();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Calculate remaining time from server clock
  const now = Date.now();
  let remainingMs: number | null = null;
  let timerExpired = false;

  if (session.current_section_expires_at && !session.is_practice && !session.completed_at) {
    const expiresAt = new Date(session.current_section_expires_at).getTime();
    remainingMs = Math.max(0, expiresAt - now);
    timerExpired = remainingMs === 0;
  }

  // Real exam: strip correct_answer AND explanation (its options_analysis marks
  // the right option) so the client cannot cheat mid-exam.
  // Practice mode NEEDS both — the client colors answers and shows explanations
  // immediately, so stripping them broke practice feedback entirely.
  const safeSession = session.is_practice ? session : {
    ...session,
    questions_by_section: Object.fromEntries(
      Object.entries((session.questions_by_section as Record<string, unknown[]>) ?? {}).map(
        ([k, qs]) => [k, (qs as Record<string, unknown>[]).map(
          ({ correct_answer: _ca, explanation: _ex, ...rest }) => rest
        )]
      )
    ),
  };

  return NextResponse.json({
    session: safeSession,
    remainingMs,
    timerExpired,
    serverNow: now,
  });
}
