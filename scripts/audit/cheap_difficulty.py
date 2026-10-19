"""Programmatic (no-LLM) difficulty signal for ALL active items, checked against
the blind LLM sample in docs/audit/progress.ndjson.

Features (wordfreq Zipf scale: ~7 = "the", ~3 = rare academic, 0 = unknown):
  sc   — key word rarity, mean option rarity
  rst  — stem length, rare-word count, key/stem word overlap (verbatim = easy)
  rc   — key/passage overlap (verbatim copy = easy), distractor absolutes
  all  — key is uniquely longest option (length cue)

too_easy rule: per type, an item is cheap_too_easy when its ease score >= a
threshold tuned on the EVEN-numbered judged batches; agreement is reported on
the ODD-numbered ones (held out).

Usage: <venv>/bin/python scripts/audit/cheap_difficulty.py <keys.json>
Writes docs/audit/cheap-difficulty.ndjson
"""
import json, os, re, statistics, sys
from wordfreq import zipf_frequency

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'audit')
keys = json.load(open(sys.argv[1]))
items = json.load(open(os.path.join(ROOT, 'data', 'items.json')))
passages = json.load(open(os.path.join(ROOT, 'data', 'passages.json')))
judged = {}
for line in open(os.path.join(ROOT, 'progress.ndjson')):
    r = json.loads(line)
    judged[r['id']] = r

WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")
ABSOLUTES = re.compile(r"\b(never|always|whatsoever|completely|entirely|only|no one|nothing|none|all|every|impossible|absolutely)\b", re.I)
STOP = set('the a an of to in and or for on at by with is are was were be been it its this that as from but not no'.split())


def toks(s):
    return [w.lower() for w in WORD.findall(s)]


def zipf(w):
    return zipf_frequency(w, 'en')


def content(ws):
    return [w for w in ws if w not in STOP]


def overlap(a, b):
    a, b = set(content(a)), set(content(b))
    return len(a & b) / max(1, len(a))


def features(q):
    opts = [o['text'] for o in q['options']]
    k = keys[q['id']]
    L = [len(o) for o in opts]
    f = {'longest': int(L[k] == max(L) and L.count(max(L)) == 1)}
    if q['type'] == 'sentence_completion':
        kw = content(toks(opts[k])) or toks(opts[k])
        f['key_zipf'] = min((zipf(w) for w in kw), default=7)
        f['opt_zipf'] = statistics.mean(min((zipf(w) for w in (content(toks(o)) or toks(o))), default=7) for o in opts)
        # Easier = more frequent key word and options.
        f['ease'] = 0.6 * f['key_zipf'] + 0.4 * f['opt_zipf']
    elif q['type'] == 'restatement':
        st = toks(q['text'])
        f['stem_len'] = len(st)
        f['rare'] = sum(1 for w in set(content(st)) if zipf(w) < 3.5)
        f['key_overlap'] = overlap(toks(opts[k]), st)
        f['ease'] = 4 * f['key_overlap'] - 0.12 * f['stem_len'] - 0.5 * f['rare'] + 2 * f['longest']
    else:
        p = toks(passages[q['passage_id']]['text'])
        f['key_overlap'] = overlap(toks(opts[k]), p)
        f['abs_distractors'] = sum(bool(ABSOLUTES.search(o)) for i, o in enumerate(opts) if i != k)
        f['ease'] = 3 * f['key_overlap'] + 0.6 * f['abs_distractors'] + 1.5 * f['longest']
    return f


rows = []
for q in items:
    f = features(q)
    rows.append({'id': q['id'], 'type': q['type'], 'stored_level': q['difficulty_level'], **f})


def held_out(r):
    j = judged.get(r['id'])
    return j and int(j['batch'].split('-')[1]) % 2 == 1


def tune(rs):
    """Threshold maximising Cohen's kappa vs the LLM too_easy label."""
    best = (-1, None)
    for t in sorted({round(r['ease'], 2) for r in rs}):
        k = kappa([(r['ease'] >= t, judged[r['id']]['difficulty'] == 'too_easy') for r in rs])
        best = max(best, (k, t), key=lambda x: x[0])
    return best[1]


def kappa(pairs):
    n = len(pairs)
    if not n:
        return 0
    po = sum(a == b for a, b in pairs) / n
    pa, pb = sum(a for a, _ in pairs) / n, sum(b for _, b in pairs) / n
    pe = pa * pb + (1 - pa) * (1 - pb)
    return (po - pe) / (1 - pe) if pe < 1 else 0


def spearman(x, y):
    def rank(v):
        o = sorted(range(len(v)), key=lambda i: v[i])
        r = [0] * len(v)
        for i, j in enumerate(o):
            r[j] = i
        return r
    rx, ry = rank(x), rank(y)
    mx, my = statistics.mean(rx), statistics.mean(ry)
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    return cov / ((sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry)) ** 0.5)


print(f'{"type":22} {"thr":>6} {"heldout n":>9} {"agree%":>7} {"kappa":>6} {"prec":>5} {"recall":>6} '
      f'{"flagged ALL":>11}  rho(ease,stored_lvl)  rho(ease,llm_est)')
for t in ['reading_comprehension', 'restatement', 'sentence_completion']:
    rs = [r for r in rows if r['type'] == t]
    train = [r for r in rs if r['id'] in judged and not held_out(r)]
    test = [r for r in rs if held_out(r)]
    thr = tune(train)
    for r in rs:
        r['cheap_too_easy'] = r['ease'] >= thr
    pairs = [(r['cheap_too_easy'], judged[r['id']]['difficulty'] == 'too_easy') for r in test]
    tp = sum(a and b for a, b in pairs)
    prec = tp / max(1, sum(a for a, _ in pairs))
    rec = tp / max(1, sum(b for _, b in pairs))
    agree = sum(a == b for a, b in pairs) / len(pairs)
    jr = [r for r in rs if r['id'] in judged and judged[r['id']].get('est_level')]
    print(f'{t:22} {thr:6.2f} {len(test):9} {100 * agree:6.1f}% {kappa(pairs):6.2f} {prec:5.2f} {rec:6.2f} '
          f'{sum(r["cheap_too_easy"] for r in rs):5}/{len(rs):<5}  '
          f'{spearman([r["ease"] for r in rs], [-r["stored_level"] for r in rs]):+.2f}                 '
          f'{spearman([r["ease"] for r in jr], [-judged[r["id"]]["est_level"] for r in jr]):+.2f}')

with open(os.path.join(ROOT, 'cheap-difficulty.ndjson'), 'w') as out:
    for r in rows:
        out.write(json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()}) + '\n')
