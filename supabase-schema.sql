-- ═══════════════════════════════════════════════════════════════
--  AMIRET Prep Platform — Supabase Schema
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Passages (Section 3 — Reading Comprehension) ────────────────
CREATE TABLE passages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  text            text NOT NULL,
  difficulty_level int  NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
  b               float NOT NULL DEFAULT 0.0,  -- IRT difficulty
  created_at      timestamptz DEFAULT now()
);

-- ─── Questions ───────────────────────────────────────────────────
CREATE TABLE questions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            text NOT NULL CHECK (type IN (
                    'sentence_completion',
                    'restatement',
                    'reading_comprehension',
                    'esra'
                  )),
  text            text NOT NULL,
  passage_id      uuid REFERENCES passages(id) ON DELETE SET NULL,
  options         jsonb NOT NULL,          -- [{id, text}]
  correct_answer  int  NOT NULL CHECK (correct_answer BETWEEN 0 AND 3),
  explanation     text,
  -- IRT 3PL parameters
  a               float NOT NULL DEFAULT 1.0,  -- discrimination
  b               float NOT NULL DEFAULT 0.0,  -- difficulty (-3 to 3)
  c               float NOT NULL DEFAULT 0.25, -- guessing
  difficulty_level int  NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
  created_by      text DEFAULT 'ai',            -- 'ai' | 'admin'
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_questions_type_difficulty ON questions(type, difficulty_level);
CREATE INDEX idx_questions_passage ON questions(passage_id) WHERE passage_id IS NOT NULL;

-- ─── Exam Sessions ───────────────────────────────────────────────
CREATE TABLE exam_sessions (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode                        text NOT NULL CHECK (mode IN ('full', 'practice', 'section', 'esra')),
  started_at                  timestamptz NOT NULL DEFAULT now(),
  completed_at                timestamptz,

  -- Server-driven timer state
  current_section_index       int  NOT NULL DEFAULT 1,  -- 1-7 (7 = experimental); 8 = finished
  current_section_expires_at  timestamptz,               -- server clock, prevents F5 cheating

  -- Adaptive state
  theta                       float NOT NULL DEFAULT 0.0,
  theta_history               jsonb NOT NULL DEFAULT '[]',  -- [{after_section, theta}]
  theta_final                 float,
  score                       int CHECK (score BETWEEN 50 AND 150),

  -- Exam content
  questions_by_section        jsonb NOT NULL DEFAULT '{}',  -- {1: [...], 2: [...]}
  section_results             jsonb NOT NULL DEFAULT '[]',  -- SectionResult[]
  answers_by_section          jsonb NOT NULL DEFAULT '{}',  -- {1: [0, null, 2, 1], ...}

  is_practice                 bool NOT NULL DEFAULT false
);

CREATE INDEX idx_sessions_user ON exam_sessions(user_id);
CREATE INDEX idx_sessions_completed ON exam_sessions(user_id, completed_at) WHERE completed_at IS NOT NULL;

-- ─── User Statistics (materialized / updated on session complete) ─
CREATE TABLE user_stats (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_exams     int  NOT NULL DEFAULT 0,
  best_score      int,
  avg_score       float,
  last_exam_at    timestamptz,
  score_history   jsonb NOT NULL DEFAULT '[]',  -- [{date, score}]
  performance_by_type jsonb NOT NULL DEFAULT '{}'
  -- {"sentence_completion": {"correct": 12, "total": 20}, ...}
);

-- ─── Leaderboard view ────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id AS user_id,
  u.email,
  u.raw_user_meta_data->>'full_name' AS full_name,
  u.raw_user_meta_data->>'avatar_url' AS avatar_url,
  s.best_score,
  s.total_exams,
  s.avg_score,
  s.last_exam_at
FROM auth.users u
JOIN user_stats s ON s.user_id = u.id
WHERE s.best_score IS NOT NULL
ORDER BY s.best_score DESC
LIMIT 100;

-- ─── RLS Policies ────────────────────────────────────────────────
ALTER TABLE questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats     ENABLE ROW LEVEL SECURITY;

-- Questions: public read, admin write (service role)
CREATE POLICY "questions_public_read"  ON questions  FOR SELECT USING (true);
CREATE POLICY "passages_public_read"   ON passages   FOR SELECT USING (true);

-- Sessions: users own their sessions
CREATE POLICY "sessions_own"   ON exam_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Stats: users read own, service role updates
CREATE POLICY "stats_own_read" ON user_stats FOR SELECT
  USING (auth.uid() = user_id);

-- ─── Function: update user stats after exam ───────────────────────
CREATE OR REPLACE FUNCTION update_user_stats_on_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL AND NEW.score IS NOT NULL THEN
    INSERT INTO user_stats (user_id, total_exams, best_score, avg_score, last_exam_at, score_history)
    VALUES (
      NEW.user_id, 1, NEW.score, NEW.score, NEW.completed_at,
      jsonb_build_array(jsonb_build_object('date', NEW.completed_at, 'score', NEW.score))
    )
    ON CONFLICT (user_id) DO UPDATE SET
      total_exams  = user_stats.total_exams + 1,
      best_score   = GREATEST(user_stats.best_score, NEW.score),
      avg_score    = (user_stats.avg_score * user_stats.total_exams + NEW.score) / (user_stats.total_exams + 1),
      last_exam_at = NEW.completed_at,
      score_history = user_stats.score_history || jsonb_build_array(
        jsonb_build_object('date', NEW.completed_at, 'score', NEW.score)
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_stats
AFTER UPDATE ON exam_sessions
FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_complete();
