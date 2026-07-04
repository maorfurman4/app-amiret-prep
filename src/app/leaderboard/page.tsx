import { createServerSupabaseClient } from '@/lib/supabase-server';
import { BackNav } from '@/components/BackNav';

interface LeaderboardEntry {
  user_id: string;
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
    .select('*')
    .limit(50);

  const entries = (data ?? []) as LeaderboardEntry[];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
      <BackNav backHref="/" backLabel="דף הבית" />
      <div className="py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-8">🏆 לוח מובילים</h1>

        {entries.length === 0 ? (
          <div className="text-center text-slate-400 py-20">עדיין אין נתונים בלוח</div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
              const name = entry.display_name ?? 'לומד/ת אנונימי/ת';

              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-4 rounded-2xl border ${
                    i === 0 ? 'bg-yellow-50 border-yellow-200' :
                    i === 1 ? 'bg-slate-100 border-slate-300' :
                    i === 2 ? 'bg-orange-50 border-orange-200' :
                    'bg-white border-slate-200'
                  }`}
                >
                  <div className="text-xl w-8 text-center">{medal}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{name}</div>
                    <div className="text-xs text-slate-500">{entry.total_exams} מבחנים | ממוצע {Math.round(entry.avg_score)}</div>
                  </div>
                  <div className="text-2xl font-black text-slate-900">{entry.best_score}</div>
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
