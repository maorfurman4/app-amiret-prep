-- Practice exams no longer count toward user_stats or the public leaderboard.
--
-- A practice exam shows the answer key while you take it, so its score says
-- nothing about ability; counting it let anyone post a 150 to the
-- leaderboard. The body below is the live function unchanged, except for
-- the practice check. merge-guest already recomputes stats from real exams
-- only, so the two paths now agree. No data changes: as of this migration no
-- practice exam had been counted.

create or replace function public.update_user_stats_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
  v_name   text;
  v_avatar text;
  v_row    public.user_stats%ROWTYPE;
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL AND NEW.score IS NOT NULL
     AND NOT COALESCE(NEW.is_practice, false) THEN
    SELECT NULLIF(u.raw_user_meta_data->>'full_name',''), u.raw_user_meta_data->>'avatar_url'
      INTO v_name, v_avatar
    FROM auth.users u WHERE u.id = NEW.user_id;

    IF FOUND THEN
      INSERT INTO user_stats (user_id, total_exams, best_score, avg_score, last_exam_at, score_history, display_name, avatar_url)
      VALUES (
        NEW.user_id, 1, NEW.score, NEW.score, NEW.completed_at,
        jsonb_build_array(jsonb_build_object('date', NEW.completed_at, 'score', NEW.score)),
        v_name, v_avatar
      )
      ON CONFLICT (user_id) DO UPDATE SET
        total_exams  = user_stats.total_exams + 1,
        best_score   = GREATEST(user_stats.best_score, NEW.score),
        avg_score    = (user_stats.avg_score * user_stats.total_exams + NEW.score) / (user_stats.total_exams + 1),
        last_exam_at = NEW.completed_at,
        display_name = COALESCE(v_name, user_stats.display_name),
        avatar_url   = COALESCE(v_avatar, user_stats.avatar_url),
        score_history = user_stats.score_history || jsonb_build_array(
          jsonb_build_object('date', NEW.completed_at, 'score', NEW.score)
        )
      RETURNING * INTO v_row;

      INSERT INTO public.leaderboard (user_id, display_name, avatar_url, best_score, total_exams, avg_score, last_exam_at)
      VALUES (v_row.user_id, v_row.display_name, v_row.avatar_url, v_row.best_score, v_row.total_exams, v_row.avg_score, v_row.last_exam_at)
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url,
        best_score = EXCLUDED.best_score, total_exams = EXCLUDED.total_exams,
        avg_score = EXCLUDED.avg_score, last_exam_at = EXCLUDED.last_exam_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
