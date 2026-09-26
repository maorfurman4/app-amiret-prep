import { describe, expect, it } from 'vitest';
import { routedLevel } from './routed-level';

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
