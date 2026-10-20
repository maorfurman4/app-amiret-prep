import { describe, expect, it } from 'vitest';
import { greetingFor } from './Greeting';

describe('greetingFor', () => {
  it('greets by time of day', () => {
    expect(greetingFor(5, 'נועה')).toBe('בוקר טוב, נועה');
    expect(greetingFor(11, 'נועה')).toBe('בוקר טוב, נועה');
    expect(greetingFor(12, 'נועה')).toBe('צהריים טובים, נועה');
    expect(greetingFor(17, 'נועה')).toBe('ערב טוב, נועה');
    expect(greetingFor(2, 'נועה')).toBe('ערב טוב, נועה');
  });

  it('welcomes a guest or an account without a name', () => {
    expect(greetingFor(9, null)).toBe('ברוך הבא ל-134+');
  });
});
