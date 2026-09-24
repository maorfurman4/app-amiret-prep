import { describe, expect, it, vi } from 'vitest';
import { recordClientResponses } from './responses';

const ITEM = '00000000-0000-4000-8000-000000000001';
const REF = '00000000-0000-4000-8000-0000000000aa';

function fakeSupabase(insertResults: { data: unknown; error: unknown }[]) {
  const inserts: unknown[][] = [];
  const insert = vi.fn((rows: unknown[]) => {
    inserts.push(rows);
    return { select: async () => insertResults[inserts.length - 1] };
  });
  const from = vi.fn((table: string) => table === 'questions'
    ? { select: () => ({ in: async () => ({ data: [{ id: ITEM, type: 'restatement', correct_answer: 1, b: 0, c: 0.25, b_calibrated: null }], error: null }) }) }
    : { insert });
  return { supabase: { from } as never, inserts };
}

const owner = { id: 'user-1', type: 'user' as const };
const input = [{ clientRef: REF, itemId: ITEM, context: 'practice' as const, chosenOption: 2 }];

describe('recordClientResponses — client_ref', () => {
  it('stores the client ref on the row', async () => {
    const { supabase, inserts } = fakeSupabase([{ data: [{ id: 7 }], error: null }]);
    const out = await recordClientResponses(supabase, owner, input, 0);
    expect(out.error).toBeNull();
    expect((inserts[0][0] as { client_ref: string }).client_ref).toBe(REF);
  });

  it('retries without client_ref when the column does not exist yet (pre-migration)', async () => {
    const { supabase, inserts } = fakeSupabase([
      { data: null, error: { code: 'PGRST204', message: "Could not find the 'client_ref' column of 'responses' in the schema cache" } },
      { data: [{ id: 8 }], error: null },
    ]);
    const out = await recordClientResponses(supabase, owner, input, 0);
    expect(out).toMatchObject({ recorded: 1, error: null });
    expect(inserts).toHaveLength(2);
    expect(inserts[1][0]).not.toHaveProperty('client_ref');
  });

  it('does not mask unrelated insert errors', async () => {
    const { supabase, inserts } = fakeSupabase([{ data: null, error: { code: '23503', message: 'fk violation' } }]);
    const out = await recordClientResponses(supabase, owner, input, 0);
    expect(out.error).toBe('fk violation');
    expect(inserts).toHaveLength(1);
  });
});
