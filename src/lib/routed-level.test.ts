import { describe, expect, it } from 'vitest';
import { routedLevel, sectionLevelTag } from './routed-level';

// The θ trail of the exam that scored 58 (sections 3 and 4 showed "level 2"
// from their first question, while the algorithm aimed them at level 3).
const history = [
  { after_section: 1, theta: 0.28, target_theta: 0.109 },
  { after_section: 2, theta: -0.22, target_theta: -0.193 },
  { after_section: 3, theta: -0.54, target_theta: -0.435 },
  { after_section: 4, theta: -0.84, target_theta: -0.691 },
  { after_section: 5, theta: -1.48, target_theta: -1.163 },
  { after_section: 6, theta: -2.09, target_theta: -1.536 },
  { after_section: 7, theta: -2.09 },
];

describe('routedLevel', () => {
  it('gives the level each section was aimed at', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(s => routedLevel(s, history))).toEqual([3, 3, 3, 3, 2, 2, 1]);
  });

  it('returns null for exams from before targets were stored', () => {
    const old = [{ after_section: 1, theta: 0.2 }, { after_section: 2, theta: 0.4 }];
    expect(routedLevel(1, old)).toBeNull();
    expect(routedLevel(3, old)).toBeNull();
    expect(routedLevel(2, null)).toBeNull();
  });

  it('returns null when the previous section has no target', () => {
    expect(routedLevel(9, history)).toBeNull();
  });
});

describe('sectionLevelTag', () => {
  // A ~112-level student (the audit's θ ≈ +0.5 case): sections 5–6 were aimed
  // at the 134 cut (θ 1.7 → "level 5"), but the items served were level 4.
  const nearCut = [
    { after_section: 1, theta: 0.6, target_theta: 0.55, target_reason: 'ability' },
    { after_section: 2, theta: 0.7, target_theta: 0.62, target_reason: 'ability' },
    { after_section: 3, theta: 0.8, target_theta: 0.71, target_reason: 'ability' },
    { after_section: 4, theta: 0.9, target_theta: 1.7, target_reason: 'cut_score' },
    { after_section: 5, theta: 0.9, target_theta: 1.7, target_reason: 'cut_score' },
    { after_section: 6, theta: 0.9, target_theta: 0.85, target_reason: 'ability' },
  ];
  const lv = (...ls: number[]) => ls.map(difficulty_level => ({ difficulty_level }));

  it('shows the served level, marked, when a section was aimed at the cut', () => {
    expect(routedLevel(5, nearCut)).toBe(5); // what the old tag said
    expect(sectionLevelTag(5, nearCut, lv(4, 4, 4))).toEqual({ level: 4, cutTargeted: true });
    expect(sectionLevelTag(6, nearCut, lv(4, 4, 5, 4))).toEqual({ level: 4, cutTargeted: true });
  });

  it('keeps the routed level for ability-targeted sections', () => {
    expect(sectionLevelTag(1, nearCut, lv(2, 2, 2, 2))).toEqual({ level: 3, cutTargeted: false });
    expect(sectionLevelTag(4, nearCut, lv(3, 3, 3))).toEqual({ level: 4, cutTargeted: false });
    expect(sectionLevelTag(7, nearCut, lv(4, 4, 4, 4))).toEqual({ level: 4, cutTargeted: false });
  });

  it('falls back to the first question\'s label for exams without targets', () => {
    const old = [{ after_section: 1, theta: 0.2 }];
    expect(sectionLevelTag(2, old, lv(2, 3))).toEqual({ level: 2, cutTargeted: false });
    expect(sectionLevelTag(2, old, [])).toBeNull();
  });

  it('still marks a cut-targeted section whose questions carry no level labels', () => {
    expect(sectionLevelTag(5, nearCut, [{}])).toEqual({ level: 5, cutTargeted: true });
  });
});
