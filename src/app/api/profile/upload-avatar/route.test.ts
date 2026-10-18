import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getServerClients: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ getServerClients: mocks.getServerClients }));

import { DELETE, POST } from './route';

const ALL = ['u1/avatar.jpg', 'u1/avatar.png', 'u1/avatar.webp', 'u1/avatar.gif'];

function clients(removeError: unknown = null) {
  const remove = vi.fn().mockResolvedValue({ data: [], error: removeError });
  const bucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/avatars/${path}` } }),
    remove,
  };
  const table = { upsert: vi.fn().mockResolvedValue({ error: null }), update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
  const supabase = {
    storage: { from: () => bucket },
    auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ error: null }) } },
    from: () => table,
  };
  mocks.getServerClients.mockResolvedValue({ supabase, user: { id: 'u1', user_metadata: {} }, guestId: null });
  return { remove };
}

describe('DELETE /api/profile/upload-avatar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the file from the public bucket, not just the URL', async () => {
    const { remove } = clients();
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(ALL);
  });

  it('reports a failed delete so the student can retry', async () => {
    clients({ message: 'storage down' });
    expect((await DELETE()).status).toBe(500);
  });
});

describe('POST /api/profile/upload-avatar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes the photo left in another format', async () => {
    const { remove } = clients();
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'me.jpg', { type: 'image/jpeg' }));
    const req = new Request('http://localhost/api/profile/upload-avatar', { method: 'POST', body: form });

    const res = await POST(req as unknown as NextRequest);

    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(ALL.filter(p => p !== 'u1/avatar.jpg'));
  });
});
