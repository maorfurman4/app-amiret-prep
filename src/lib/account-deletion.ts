/** The body a client must send; a bare DELETE (or a cross-site form post) deletes nothing. */
export const DELETE_CONFIRMATION = 'DELETE_MY_ACCOUNT';

/**
 * Every public table holding a row for an account, and the column naming it.
 * Children before parents (responses → exam_sessions, review log → cards).
 * The tables with an auth.users FK would cascade anyway; deleting them here
 * too keeps the list complete in one place.
 */
export const ACCOUNT_TABLES: { table: string; column: string; ownerType?: true }[] = [
  { table: 'responses', column: 'owner_id', ownerType: true },
  { table: 'srs_review_log', column: 'owner_id', ownerType: true },
  { table: 'srs_cards', column: 'owner_id', ownerType: true },
  { table: 'exam_sessions', column: 'user_id' },
  { table: 'review_queue', column: 'user_id' },
  { table: 'activity_log', column: 'user_id' },
  { table: 'user_question_history', column: 'user_key' },
  { table: 'user_passage_history', column: 'user_key' },
  { table: 'user_vocab_known', column: 'user_id' },
  { table: 'user_vocab_favorites', column: 'user_id' },
  { table: 'official_scores', column: 'user_id' },
  { table: 'user_goals', column: 'user_id' },
  { table: 'user_stats', column: 'user_id' },
];
