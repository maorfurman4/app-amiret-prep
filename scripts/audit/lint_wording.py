"""Deterministic wording lint over EVERY active stem, option and passage (no LLM).
LanguageTool needs a JDK this machine doesn't have, so this is rules + the
wordfreq vocabulary as a spelling dictionary.

Usage: <venv>/bin/python scripts/audit/lint_wording.py
Writes docs/audit/lint-wording.ndjson (one row per hit).
"""
import collections, json, os, re
from wordfreq import zipf_frequency

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'audit')
items = json.load(open(os.path.join(ROOT, 'data', 'items.json')))
passages = json.load(open(os.path.join(ROOT, 'data', 'passages.json')))
used_pids = {q['passage_id'] for q in items if q['passage_id']}

AN_OK = re.compile(r"^(hour|honest|honou?r|heir|herb\b|[aeiou])", re.I)  # "an" + these is fine
A_BAD_EXCEPT = re.compile(r"^(uni|una|use|usu|uti|ur[aeiou]|eu|one|once|ewe|u\b|u\.)", re.I)  # "a university" etc.
RULES = [
    ('space_before_punct', re.compile(r"\S\s+[,.;:!?](?!\.)")),
    ('double_space', re.compile(r"\S  +\S")),
    ('doubled_word', re.compile(r"\b(?!(?:that|had)\b)(\w+)\s+\1\b", re.I)),
    ('double_punct', re.compile(r"(?<!\.)([,;:!?])\1|,\.|\.,")),
    ('lowercase_i', re.compile(r"(?<![\w'-])i(?![\w'-])")),
]
WORD = re.compile(r"(?<![\w-])([A-Za-z]+)(?![\w-])")


def lint(text):
    hits = []
    for name, rx in RULES:
        for m in rx.finditer(text):
            hits.append((name, m.group(0)))
    for m in re.finditer(r"\b(a|an)\s+([A-Za-z][\w-]*)", text):
        art, nxt = m.group(1).lower(), m.group(2)
        if nxt.isupper() and len(nxt) > 1:
            continue  # acronyms: "an MBA", "a NATO" — sound-based, skip
        if art == 'a' and re.match(r"[aeiou]", nxt, re.I) and not A_BAD_EXCEPT.match(nxt):
            hits.append(('a_an', m.group(0)))
        if art == 'an' and not AN_OK.match(nxt):
            hits.append(('a_an', m.group(0)))
    for m in WORD.finditer(text):
        w = m.group(1)
        if w[0].isupper() or len(w) < 3:
            continue  # proper nouns / sentence starts / short tokens
        if zipf_frequency(w.lower(), 'en') == 0:
            hits.append(('unknown_word', w))
    if text.count('(') != text.count(')'):
        hits.append(('unbalanced_parens', ''))
    if text.count('"') % 2:
        hits.append(('unbalanced_quotes', ''))
    return hits


rows = []
for q in items:
    fields = [('stem', q['text'])] + [(f'option_{i}', o['text']) for i, o in enumerate(q['options'])]
    if q['type'] == 'sentence_completion' and q['text'].count('___') != 1:
        rows.append({'id': q['id'], 'type': q['type'], 'field': 'stem', 'rule': 'blank_count', 'match': str(q['text'].count('___'))})
    for field, text in fields:
        if text != text.strip():
            rows.append({'id': q['id'], 'type': q['type'], 'field': field, 'rule': 'edge_whitespace', 'match': ''})
        for rule, match in lint(text.strip()):
            # "___ ," in SC stems is a blank followed by a stray space — same rule.
            rows.append({'id': q['id'], 'type': q['type'], 'field': field, 'rule': rule, 'match': match})
for pid in sorted(used_pids):
    for rule, match in lint(passages[pid]['text']):
        rows.append({'id': pid, 'type': 'passage', 'field': 'passage', 'rule': rule, 'match': match})

with open(os.path.join(ROOT, 'lint-wording.ndjson'), 'w') as out:
    for r in rows:
        out.write(json.dumps(r, ensure_ascii=False) + '\n')

by_rule = collections.Counter(r['rule'] for r in rows)
print('hits:', len(rows), '| items/passages hit:', len({r['id'] for r in rows}))
for rule, n in by_rule.most_common():
    ex = collections.Counter(r['match'] for r in rows if r['rule'] == rule).most_common(6)
    print(f'  {rule:18} {n:5}  e.g. {ex}')
