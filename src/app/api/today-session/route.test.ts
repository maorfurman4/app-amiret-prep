import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { GET } from './route';

describe('GET /api/today-session', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires an identity (auth or guest cookie)', async () => {
    mocks.getServerClients.mockResolvedValue({ supabase: { from: vi.fn() }, user: null, guestId: null });

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
