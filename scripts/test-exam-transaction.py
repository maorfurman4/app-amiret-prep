"""Exercise the real exam RPC on disposable local PostgreSQL, never Supabase.

Run: python3 scripts/test-exam-transaction.py
Requires Docker Desktop. Uses an isolated container without published ports,
credentials, production content, or mounted database volumes.
The schema below is a minimal contract fixture, not a production schema dump.
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
NAME = "amiret-rpc-test-" + uuid.uuid4().hex[:10]
OWNER = "00000000-0000-4000-8000-000000000001"
SESSION = "00000000-0000-4000-8000-000000000002"
QUESTION = "00000000-0000-4000-8000-000000000003"
MISSING = "00000000-0000-4000-8000-000000000004"


def docker(*args, **kwargs):
    return subprocess.run(["docker", *args], text=True, capture_output=True,
                          timeout=kwargs.pop("timeout", 60), **kwargs)


def sql(statement, ok=True):
    result = docker("exec", "-i", NAME, "psql", "-U", "postgres", "-d", "postgres",
                    "-XAt", "-v", "ON_ERROR_STOP=1", input=statement)
    if ok and result.returncode:
        raise RuntimeError(result.stderr)
    return result


def commit(index, question=QUESTION):
    update = json.dumps({"theta": 0.2, "theta_history": [],
                         "current_section_index": index + 1,
                         "answers_by_section": {}, "section_results": []})
    return f"""SELECT public.commit_exam_section(
      '{SESSION}', '{OWNER}', {index}, '{update}'::jsonb,
      '{{}}'::uuid[], ARRAY['{question}']::uuid[], false, null,
      DATE '2026-09-18', 'exam', ARRAY['{question}']::uuid[], 'guest');"""


SCHEMA = """
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE questions(id uuid PRIMARY KEY);
CREATE TABLE passages(id uuid PRIMARY KEY);
CREATE TABLE exam_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, current_section_index int NOT NULL,
 theta float8, theta_history jsonb, answers_by_section jsonb, section_results jsonb,
 completed_at timestamptz, theta_final float8, score int,
 current_section_expires_at timestamptz, used_question_ids uuid[],
 used_passage_ids uuid[], questions_by_section jsonb
);
CREATE TABLE user_question_history (
 user_key text, question_id uuid REFERENCES questions(id), PRIMARY KEY(user_key,question_id)
);
CREATE TABLE user_passage_history (
 user_key text, passage_id uuid REFERENCES passages(id), PRIMARY KEY(user_key,passage_id)
);
CREATE TABLE activity_log (
 user_id text, activity_date date, source text, PRIMARY KEY(user_id,activity_date)
);
CREATE TABLE review_queue (
 user_id uuid, guest_id text, question_id uuid REFERENCES questions(id),
 times_wrong int, next_review_at timestamptz, last_reviewed_at timestamptz,
 interval_days int, UNIQUE(guest_id,question_id)
);
"""


def main():
    if docker("info", "--format", "{{.ServerVersion}}", timeout=10).returncode:
        raise SystemExit("Docker is not running; no database was modified.")
    started = False
    try:
        result = docker("run", "--detach", "--rm", "--name", NAME,
                        "--network", "none", "--tmpfs", "/var/lib/postgresql/data",
                        "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17.6", timeout=300)
        if result.returncode:
            raise RuntimeError(result.stderr)
        started = True
        for _ in range(30):
            if docker("exec", NAME, "pg_isready", "-U", "postgres").returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError("Local PostgreSQL did not become ready")
        sql(SCHEMA)
        sql((ROOT / "supabase/migrations/20260916124500_atomic_exam_section_transition.sql").read_text())
        sql(f"INSERT INTO questions VALUES ('{QUESTION}'); INSERT INTO exam_sessions(id,user_id,current_section_index) VALUES ('{SESSION}','{OWNER}',1);")

        # Fail AFTER updating the session; PostgreSQL must undo every side effect.
        failed = sql(commit(1, MISSING), ok=False)
        assert failed.returncode != 0 and "foreign key" in failed.stderr
        assert sql("SELECT current_section_index FROM exam_sessions;").stdout.strip() == "1"
        for table in ("user_question_history", "activity_log", "review_queue"):
            assert sql(f"SELECT count(*) FROM {table};").stdout.strip() == "0"
        print("PASS: failing side effect rolls back session and all writes")

        # Hold a competing row lock so both real connections wait before racing.
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            lock = pool.submit(sql, "BEGIN; SELECT id FROM exam_sessions FOR UPDATE; SELECT pg_sleep(2); COMMIT;")
            time.sleep(0.3)
            a = pool.submit(sql, commit(1))
            b = pool.submit(sql, commit(1))
            results = sorted([a.result().stdout.strip(), b.result().stdout.strip()])
            lock.result()
        assert results == ["f", "t"], results
        assert sql("SELECT times_wrong FROM review_queue;").stdout.strip() == "1"
        assert sql("SELECT current_section_index FROM exam_sessions;").stdout.strip() == "2"
        print("PASS: concurrent submissions commit exactly once")

        assert sql(commit(2).replace(OWNER, MISSING)).stdout.strip() == "f"
        assert sql("SELECT current_section_index FROM exam_sessions;").stdout.strip() == "2"
        print("PASS: wrong owner cannot advance the session")

        for index in range(2, 8):
            assert sql(commit(index)).stdout.strip() == "t"
        sql("UPDATE exam_sessions SET completed_at=now();")
        assert sql(commit(8)).stdout.strip() == "f"
        assert sql("SELECT count(*) FROM activity_log;").stdout.strip() == "1"
        print("PASS: successive transitions, activity deduplication, completed-session guard")

        signature = "public.commit_exam_section(uuid,text,integer,jsonb,uuid[],uuid[],boolean,uuid,date,text,uuid[],text)"
        for role, expected in (("anon", "f"), ("authenticated", "f"), ("service_role", "t")):
            assert sql(f"SELECT has_function_privilege('{role}','{signature}','EXECUTE');").stdout.strip() == expected
        print("PASS: RPC execution is restricted to service_role")
        print("Local RPC checks complete; full browser/API and production-schema parity remain separate checks.")
    finally:
        if started:
            cleanup = docker("stop", NAME)
            if cleanup.returncode:
                raise RuntimeError(f"Could not stop disposable container {NAME}: {cleanup.stderr}")


if __name__ == "__main__":
    main()
