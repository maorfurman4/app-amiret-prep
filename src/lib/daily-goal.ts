/**
 * The daily goal: how many practice questions a day close the practice ring
 * (user_goals.daily_activity_target; dashboard-summary's rings.effort).
 */
export const MIN_DAILY_TARGET = 5;
export const MAX_DAILY_TARGET = 50;
/** The editors step by this, inside the range above. */
export const DAILY_TARGET_STEP = 5;

/** Set once the goal-met celebration has shown, to today's date. */
export const GOAL_SEEN_KEY = 'amiret_goal_celebration_seen_date';

/**
 * Set once an account has been asked for its goal on this device.
 * shortcut: per device, so a second device asks once more; move it to
 * user_goals if that ever matters.
 */
export const goalPromptKey = (userId: string) => `amiret_goal_prompt_asked:${userId}`;

export function stepTarget(value: number, direction: 1 | -1): number {
  return Math.min(MAX_DAILY_TARGET, Math.max(MIN_DAILY_TARGET, value + direction * DAILY_TARGET_STEP));
}
