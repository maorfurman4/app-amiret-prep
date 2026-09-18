import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
import { GET } from './route';

const question = { id: 'q', text: 'Question', correct_answer: 2, explanation: 'Secret answer', hint: 'Secret hint' };
function setup(isPractice: boolean, guestId: string | null) {
  const eq = vi.fn().mockReturnThis();
  const single = vi.fn().mockResolvedValue({ data: {
    is_practice: isPractice, questions_by_section: { 1: [question] }, section_results: [{ questions: [question] }],
  } });
  const from = vi.fn().mockReturnValue({ select: () => ({ eq, single }) });
  mocks.getServerClients.mockResolvedValue({ supabase: { from }, user: null, guestId });
  return { eq, from };
}
const request = () => new NextRequest('http://localhost/api/exam/state?sessionId=exam&guestId=someone-else');
describe('exam recovery privacy', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects a supplied ID without proof before querying data', async () => {
    const db = setup(false, null);
    expect((await GET(request())).status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });
  it('uses signed ownership and hides answer keys in every section copy', async () => {
    const db = setup(false, 'verified-guest');
    const response = await GET(request());
    const data = await response.json();
    expect(db.eq).toHaveBeenCalledWith('user_id', 'verified-guest');
    expect(JSON.stringify(data)).not.toContain('Secret answer');
    expect(JSON.stringify(data)).not.toContain('correct_answer');
    expect(JSON.stringify(data)).not.toContain('Secret hint');
    expect(data.session.questions_by_section[1][0].text).toBe('Question');
    expect(data.session.section_results).toEqual([]);
  });
  it('preserves immediate feedback during practice', async () => {
    setup(true, 'verified-guest');
    const data = await (await GET(request())).json();
    expect(data.session.questions_by_section[1][0]).toEqual(question);
  });
});
