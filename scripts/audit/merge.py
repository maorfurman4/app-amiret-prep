"""Merge blind judgments with the answer keys -> docs/audit/progress.ndjson + summary.

Usage: python3 scripts/audit/merge.py <keys.json>
(keys live outside the repo so judges can't see them.)
"""
import collections, glob, json, os, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'audit')
keys = json.load(open(sys.argv[1]))
items = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'data', 'items.json')))}

rows, bad_lines = [], 0
for f in sorted(glob.glob(os.path.join(ROOT, 'judgments', '*.ndjson'))):
    batch = os.path.basename(f)[:-7]
    for line in open(f):
        if not line.strip():
            continue
        try:
            j = json.loads(line)
        except json.JSONDecodeError:
            bad_lines += 1
            continue
        q = items.get(j.get('id'))
        if not q:
            bad_lines += 1
            continue
        key = keys[q['id']]
        flags = list(j.get('flags') or [])
        if j.get('your_answer') != key:
            flags.insert(0, 'key_mismatch')
        sev = 'high' if {'key_mismatch', 'no_correct'} & set(flags) else \
              'medium' if {'ambiguous', 'distractor_correct', 'unsupported', 'wording'} & set(flags) else \
              'low' if flags else 'none'
        rows.append({
            'id': q['id'], 'type': q['type'], 'batch': batch,
            'your_answer': j.get('your_answer'), 'stored_key': key, 'confidence': j.get('confidence'),
            'flags': flags, 'verdict': 'flagged' if flags else 'pass', 'severity': sev,
            'difficulty': j.get('difficulty', 'ok'), 'est_level': j.get('est_level'),
            'stored_level': q['difficulty_level'], 'exam_eligible': q['exam_eligible'],
            'stem_generic': bool(j.get('stem_generic')), 'reason': j.get('reason', ''),
        })

seen = {r['id'] for r in rows}
for f in sorted(glob.glob(os.path.join(ROOT, 'judgments', '*.ndjson'))):
    b = json.load(open(os.path.join(ROOT, 'batches', os.path.basename(f)[:-7] + '.json')))
    ids = [i['id'] for i in b['items']] if 'items' in b else [i['id'] for g in b['passages'] for i in g['items']]
    if missing := [i for i in ids if i not in seen]:
        print(f'INCOMPLETE {os.path.basename(f)}: {len(missing)} missing')

# last judgment wins if a batch was re-run
rows = list({r['id']: r for r in rows}.values())
with open(os.path.join(ROOT, 'progress.ndjson'), 'w') as out:
    for r in rows:
        out.write(json.dumps(r, ensure_ascii=False) + '\n')

n = len(rows)
print(f'coverage {n} / {len(items)}  (unparseable lines: {bad_lines})')
for t in ['reading_comprehension', 'restatement', 'sentence_completion', None]:
    rs = [r for r in rows if t is None or r['type'] == t]
    if not rs:
        continue
    fl = collections.Counter(f for r in rs for f in r['flags'])
    corr = sum(1 for r in rs if r['severity'] in ('high', 'medium'))
    dif = collections.Counter(r['difficulty'] for r in rs)
    print(f"{t or 'ALL':22} n={len(rs):5}  correctness-candidates={corr} ({100*corr/len(rs):.1f}%)  "
          f"flags={dict(fl)}  difficulty={dict(dif)}  generic_stems={sum(r['stem_generic'] for r in rs)}")
lv = collections.Counter((r['stored_level'], r['est_level']) for r in rows)
print('stored_level -> est_level:', {s: {e: lv[(s, e)] for e in range(1, 6) if lv[(s, e)]} for s in range(1, 6)})
