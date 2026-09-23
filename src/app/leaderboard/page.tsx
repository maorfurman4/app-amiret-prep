import { Trophy } from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { BackNav } from '@/components/BackNav';

interface LeaderboardEntry {
  display_name: string | null;
  avatar_url: string | null;
  best_score: number;
  total_exams: number;
  avg_score: number;
}

export default async function LeaderboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('leaderboard')
    // Never select user_id here: the table is publicly readable and an auth
    // user id is an identifier other endpoints key ownership on.
    .select('display_name, avatar_url, best_score, total_exams, avg_score')
    .order('best_score', { ascending: false })
    .limit(50);

  const entries = (data ?? []) as LeaderboardEntry[];

  return (
    <div className="min-h-screen bg-exam-paper" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />
      <div className="py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-exam-ink mb-8 flex items-center gap-2">
          <Trophy className="w-6 h-6" aria-hidden />
          לוח מובילים
        </h1>

        {entries.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-9 h-9 mx-auto mb-3 text-exam-ink-soft" strokeWidth={1.5} aria-hidden />
            <div className="text-exam-ink-soft">עדיין אין נתונים בלוח</div>
            <div className="text-exam-ink-soft text-sm mt-1">סיימו מבחן ראשון כדי להופיע כאן</div>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => {
              const name = entry.display_name ?? 'לומד/ת אנונימי/ת';
              const top3 = i < 3;

              return (
                <div
                  key={`${entry.display_name ?? 'anon'}-${i}`}
                  className={`flex items-center gap-4 p-4 rounded-md border ${
                    top3 ? 'bg-exam-alt-bg border-exam-alt/40' : 'bg-exam-surface border-exam-border'
                  }`}
                >
                  <div className={`w-8 h-8 flex-shrink-0 rounded-sm flex items-center justify-center text-sm font-bold ${
                    top3 ? 'bg-exam-alt text-on-amber' : 'bg-exam-paper-alt text-exam-ink-soft'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-exam-ink">{name}</div>
                    <div className="text-xs text-exam-ink-soft">{entry.total_exams} מבחנים | ממוצע {Math.round(entry.avg_score)}</div>
                  </div>
                  <div className="text-2xl font-bold text-exam-ink">{entry.best_score}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
