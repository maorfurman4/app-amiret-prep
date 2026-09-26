-- Reverts vocab-archive-replace.sql: un-archives the 32 words and removes the 32 inserted ones.
-- One statement, all or nothing. Deleting an inserted word also deletes any user known/favorite rows on it.
do $$
declare n int;
begin
  update public.vocabulary set is_archived = false
  where word in ('accelerate', 'activate', 'collaborate', 'collaborative', 'collectively', 'efficiently', 'focused', 'historically', 'hostile', 'immune', 'irony', 'representation', 'spontaneous', 'timid', 'verify', 'authentic', 'omit', 'respectively', 'comprehend', 'cynical', 'disciplined', 'elaborate', 'empathetic', 'portray', 'progressively', 'systematically', 'eccentric', 'anarchy', 'abbreviate', 'initialize', 'notably', 'proactive') and is_archived;
  get diagnostics n = row_count;
  if n <> 32 then raise exception 'un-archived % words, expected 32', n; end if;

  delete from public.vocabulary where word in ('benchmark', 'clout', 'conducive', 'trajectory', 'deprivation', 'disdain', 'dispel', 'disseminate', 'superficial', 'embody', 'endemic', 'incremental', 'notorious', 'peripheral', 'plight', 'onus', 'skeptical', 'succinct', 'enervate', 'anathema', 'cacophony', 'capitulate', 'feckless', 'harangue', 'implacable', 'nefarious', 'obstinate', 'paucity', 'placate', 'prosaic', 'quandary', 'vacillate');
  get diagnostics n = row_count;
  if n <> 32 then raise exception 'removed % words, expected 32', n; end if;

  update public.vocabulary set part_of_speech = 'adjective' where word = 'subjectively' and part_of_speech = 'adverb';

  -- Every level must end with exactly 350 active words.
  if (select count(*) from (select difficulty_level from public.vocabulary where not is_archived group by difficulty_level having count(*) = 350) ok) <> 5 then
    raise exception 'level counts are not 350 each: %', (select string_agg(difficulty_level || '=' || c, ' ' order by difficulty_level) from (select difficulty_level, count(*) c from public.vocabulary where not is_archived group by 1) t);
  end if;
end $$;
