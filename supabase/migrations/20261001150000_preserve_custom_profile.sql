-- Completing an exam reverted a user's custom display name and avatar to
-- their Google ones: on conflict, the completion trigger function set
--   display_name = COALESCE(v_name,   user_stats.display_name)
--   avatar_url   = COALESCE(v_avatar, user_stats.avatar_url)
-- with the auth metadata (Google full_name / avatar_url) first, so it
-- overwrote any name set via /api/profile/update-name and any avatar set via
-- /api/profile/upload-avatar.
--
-- The stored value now wins and the Google value is only the default when
-- nothing is stored. A first completion (the INSERT branch) still takes the
-- Google name and avatar.
--
-- The body below is the live function (20261001090000_drop_leaderboard)
-- unchanged except for those two COALESCE argument orders. SECURITY DEFINER,
-- search_path and every stats column are identical.

create or replace function public.update_user_stats_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
DECLARE
  v_name   text;
  v_avatar text;
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
        display_name = COALESCE(user_stats.display_name, v_name),
        avatar_url   = COALESCE(user_stats.avatar_url, v_avatar),
        score_history = user_stats.score_history || jsonb_build_array(
          jsonb_build_object('date', NEW.completed_at, 'score', NEW.score)
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
