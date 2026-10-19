"""Simulates practice-set building on the real SC pool to find where repeated
answer choices come from (Job 2). Mirrors src/lib/option-overlap.ts and the
two SC paths in src/app/api/practice/questions/route.ts for a fresh user.

Usage: python3 scripts/audit/sim-option-repeats.py <keys.json>
"""
import collections, json, os, random, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'docs', 'audit', 'data')
keys = json.load(open(sys.argv[1]))
sc = [q for q in json.load(open(os.path.join(ROOT, 'items.json'))) if q['type'] == 'sentence_completion']
by_level = collections.defaultdict(list)
for q in sc:
    by_level[q['difficulty_level']].append(q)


def words(q):  # optionWords(): short options, normalised
    out = []
    for o in q['options']:
        t = ' '.join(o['text'].strip().lower().split())
        if t and len(t.split(' ')) <= 3:
            out.append(t)
    return out


def pick_distinct(cands, needed, avoid=()):  # pickDistinctOptions()
    used, chosen, skipped = set(avoid), [], []
    for q in cands:
        if len(chosen) == needed:
            break
        w = words(q)
        if any(x in used for x in w):
            skipped.append(q)
            continue
        chosen.append(q)
        used.update(w)
    while len(chosen) < needed and skipped:
        skipped.sort(key=lambda q: sum(x in used for x in words(q)))
        q = skipped.pop(0)
        chosen.append(q)
        used.update(words(q))
    return chosen


def has_repeat(qs):
    ws = [w for q in qs for w in words(q)]
    return len(ws) != len(set(ws))


def fixed(level, count, factor=6):
    return pick_distinct(random.sample(by_level[level], count * factor), count)


def random_mode(count, factor=6):
    per_level = -(-count * 2 // 5)  # Math.ceil(count*2/5)
    pool = []
    for lv in range(1, 6):
        pool += pick_distinct(random.sample(by_level[lv], per_level * factor), per_level)
    random.shuffle(pool)
    return pick_distinct(pool, count)


def random_mode_fixed(count, factor=20):  # proposed: one wide pool, one distinct pick
    pool = []
    for lv in range(1, 6):
        pool += random.sample(by_level[lv], -(-count // 5) * factor)
    random.shuffle(pool)
    return pick_distinct(pool, count)


if __name__ == '__main__':
    random.seed(7)
    N = 2000
    for name, fn in [
        ('fixed level 3, count 5 (factor 6)', lambda: fixed(3, 5)),
        ('fixed level 3, count 10 (factor 6)', lambda: fixed(3, 10)),
        ('random, count 5  (CURRENT)', lambda: random_mode(5)),
        ('random, count 10 (CURRENT)', lambda: random_mode(10)),
        ('random, count 5  (PROPOSED)', lambda: random_mode_fixed(5)),
        ('random, count 10 (PROPOSED)', lambda: random_mode_fixed(10)),
    ]:
        rep = sum(has_repeat(fn()) for _ in range(N))
        print(f'{name:38} sets with a repeated option word: {rep}/{N} ({100 * rep / N:.1f}%)')

    # Job 2A: how concentrated is the SC option pool?
    total = collections.Counter(w for q in sc for w in set(words(q)))
    as_key = collections.Counter(words(q)[keys[q['id']]] for q in sc if len(words(q)) == 4)
    distinct = len(total)
    slots = sum(len(words(q)) for q in sc)
    print(f'\nSC items={len(sc)} option slots={slots} distinct option words={distinct} '
          f'(avg reuse {slots / distinct:.1f}x)')
    print('words used in >=10 questions:', sum(1 for c in total.values() if c >= 10),
          '| >=20:', sum(1 for c in total.values() if c >= 20))
    print('top 25 (questions containing it / of which it is the KEY):')
    print(', '.join(f'{w} {c}/{as_key[w]}' for w, c in total.most_common(25)))
    never_key = [(w, c) for w, c in total.most_common() if as_key[w] == 0 and c >= 8]
    print(f'\nwords appearing in >=8 questions but NEVER the key: {len(never_key)}')
    print(', '.join(f'{w} {c}' for w, c in never_key[:25]))
