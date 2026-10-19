/**
 * Whether a failed `.single()` lookup of one row means "there is no such
 * row" (→ 404) rather than "the database couldn't answer" (→ 503). Both
 * used to come back as 404 or as a generic error, so a mistyped or someone
 * else's exam link said "check your connection", and an outage said "not
 * found".
 *  - PGRST116: .single() matched no row (missing, or another owner's).
 *  - 22P02: the id isn't a valid uuid at all.
 */
export function isMissingRow(error: { code?: string } | null | undefined): boolean {
  return error?.code === 'PGRST116' || error?.code === '22P02';
}

/** How a page should explain a failed load of one exam, by response status. */
export type LoadFailure = 'missing' | 'busy' | 'failed';

export function loadFailure(status: number): LoadFailure {
  if (status === 404) return 'missing';
  if (status === 429) return 'busy';
  return 'failed';
}
