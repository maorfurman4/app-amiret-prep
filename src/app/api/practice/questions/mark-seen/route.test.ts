import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerClients: vi.fn(),
  recordSeenQuestions: vi.fn(),
  recordSeenPassage: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));
vi.mock('@/lib/question-history', () => ({
  recordSeenQuestions: mocks.recordSeenQuestions,
  recordSeenPassage: mocks.recordSeenPassage,
}));

import { POST } from './route';

const Q = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';
const post = (body: unknown) => POST(new Request('http://localhost/api/practice/questions/mark-seen', {
  method: 'POST', body: JSON.stringify(body),
}));

describe('POST /api/practice/questions/mark-seen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerClients.mockResolvedValue({ supabase: {}, user: null, guestId: 'g1' });
  });

  it('marks questions only, as before, when no passages are sent', async () => {
    expect((await post({ ids: [Q] })).status).toBe(200);
    expect(mocks.recordSeenQuestions).toHaveBeenCalledWith({}, 'g1', [Q]);
    expect(mocks.recordSeenPassage).not.toHaveBeenCalled();
  });

  it('marks a reading passage seen too (today\'s weak block, QA M-4)', async () => {
    expect((await post({ ids: [Q], passageIds: [P, P] })).status).toBe(200);
    expect(mocks.recordSeenPassage).toHaveBeenCalledTimes(1);
    expect(mocks.recordSeenPassage).toHaveBeenCalledWith({}, 'g1', P);
  });

  it('rejects malformed or too many passage ids without writing', async () => {
    expect((await post({ ids: [Q], passageIds: ['nope'] })).status).toBe(400);
    expect((await post({ ids: [Q], passageIds: Array(6).fill(P) })).status).toBe(400);
    expect(mocks.recordSeenQuestions).not.toHaveBeenCalled();
    expect(mocks.recordSeenPassage).not.toHaveBeenCalled();
  });

  it('needs an identity', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: {}, user: null, guestId: null });
    expect((await post({ ids: [Q] })).status).toBe(401);
  });
});
