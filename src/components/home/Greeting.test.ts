import { describe, expect, it } from 'vitest';
import { greetingFor, scoreLineRest } from './Greeting';

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

describe('scoreLineRest', () => {
  it('names the gap to 134, the last point, or the exemption', () => {
    expect(`הציון האחרון שלך 128${scoreLineRest(128)}`).toBe('הציון האחרון שלך 128. עוד 6 נקודות לפטור, אתה בדרך.');
    expect(`הציון האחרון שלך 132${scoreLineRest(132)}`).toBe('הציון האחרון שלך 132. עוד שתי נקודות לפטור, אתה בדרך.');
    expect(`הציון האחרון שלך 133${scoreLineRest(133)}`).toBe('הציון האחרון שלך 133, חסרה נקודה אחת לפטור, אתה בדרך.');
    expect(`הציון האחרון שלך 134${scoreLineRest(134)}`).toBe('הציון האחרון שלך 134, מעל רף הפטור. שמור על הקצב.');
    expect(`הציון האחרון שלך 138${scoreLineRest(138)}`).toBe('הציון האחרון שלך 138, מעל רף הפטור. שמור על הקצב.');
  });
});
