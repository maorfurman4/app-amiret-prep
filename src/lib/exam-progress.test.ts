import { describe, expect, it, vi } from 'vitest';
import { ExamProgressSaver, lateNoticeText, saveResultFromStatus, type Answers, type SaveResult } from './exam-progress';

/** A send whose responses the test resolves by hand, in any order. */
function controlledSend() {
  const calls: { answers: Answers; resolve: (r: SaveResult) => void }[] = [];
  const send = vi.fn((answers: Answers) => new Promise<SaveResult>(resolve => { calls.push({ answers, resolve }); }));
  return { send, calls };
}
const tick = () => new Promise(r => setTimeout(r, 0));

describe('ExamProgressSaver', () => {
  it('sends a pick right away', () => {
    const { send } = controlledSend();
    new ExamProgressSaver({ send }).save([1, null, null]);
    expect(send).toHaveBeenCalledWith([1, null, null]);
  });

  it('never has two saves in flight; picks made meanwhile become one save of the newest answers', async () => {
    const { send, calls } = controlledSend();
    const saver = new ExamProgressSaver({ send });
    saver.save([1, null, null]);
    saver.save([1, 2, null]);
    saver.save([1, 2, 3]);
    expect(send).toHaveBeenCalledTimes(1);
    calls[0].resolve('ok');
    await tick();
    expect(send).toHaveBeenCalledTimes(2);
    expect(calls[1].answers).toEqual([1, 2, 3]);
  });

  it('skips a save the server already has', async () => {
    const { send, calls } = controlledSend();
    const saver = new ExamProgressSaver({ send });
    saver.save([0, 1]);
    calls[0].resolve('ok');
    await tick();
    saver.save([0, 1]);
    saver.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(saver.hasUnsaved).toBe(false);
  });

  it('copies the answers, so a later mutation of the caller’s array changes nothing', () => {
    const { send } = controlledSend();
    const answers: Answers = [1, null];
    new ExamProgressSaver({ send }).save(answers);
    answers[1] = 3;
    expect(send.mock.calls[0][0]).toEqual([1, null]);
  });

  it('retries a failed save with backoff', async () => {
    const timers: { fn: () => void; ms: number }[] = [];
    const send = vi.fn<(a: Answers) => Promise<SaveResult>>().mockResolvedValueOnce('failed').mockResolvedValueOnce('failed').mockResolvedValue('ok');
    const saver = new ExamProgressSaver({ send, retryBaseMs: 100, setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {} });
    saver.save([2]);
    await tick();
    expect(timers.map(t => t.ms)).toEqual([100]);
    timers[0].fn();
    await tick();
    expect(timers.map(t => t.ms)).toEqual([100, 200]);
    timers[1].fn();
    await tick();
    expect(send).toHaveBeenCalledTimes(3);
    expect(saver.hasUnsaved).toBe(false);
  });

  it('flush (page hidden) retries at once instead of waiting for the backoff', async () => {
    const cleared: unknown[] = [];
    const send = vi.fn<(a: Answers) => Promise<SaveResult>>().mockResolvedValueOnce('failed').mockResolvedValue('ok');
    const saver = new ExamProgressSaver({ send, setTimer: () => 'retry-handle', clearTimer: h => cleared.push(h) });
    saver.save([0, 3]);
    await tick();
    saver.flush();
    await tick();
    expect(cleared).toContain('retry-handle');
    expect(send).toHaveBeenCalledTimes(2);
    expect(saver.hasUnsaved).toBe(false);
  });

  it('stops for good once the server refuses (deadline passed / section moved on)', async () => {
    const send = vi.fn<(a: Answers) => Promise<SaveResult>>().mockResolvedValue('rejected');
    const saver = new ExamProgressSaver({ send });
    saver.save([1]);
    await tick();
    saver.save([2]);
    saver.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends nothing after stop(), even a pick that was waiting', async () => {
    const { send, calls } = controlledSend();
    const saver = new ExamProgressSaver({ send });
    saver.save([1]);
    saver.save([2]);
    saver.stop();
    calls[0].resolve('ok');
    await tick();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('treats a thrown send as a failure to retry', async () => {
    const timers: number[] = [];
    const send = vi.fn<(a: Answers) => Promise<SaveResult>>().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const saver = new ExamProgressSaver({ send, setTimer: (_fn, ms) => { timers.push(ms); return 1; }, clearTimer: () => {} });
    saver.save([1]);
    await tick();
    expect(timers).toHaveLength(1);
    expect(saver.hasUnsaved).toBe(true);
  });
});

describe('saveResultFromStatus', () => {
  it('maps responses onto ok / retry / give up', () => {
    expect(saveResultFromStatus(200)).toBe('ok');
    expect(saveResultFromStatus(429)).toBe('failed');
    expect(saveResultFromStatus(503)).toBe('failed');
    expect(saveResultFromStatus(409)).toBe('rejected');
    expect(saveResultFromStatus(400)).toBe('rejected');
    expect(saveResultFromStatus(401)).toBe('rejected');
  });
});

describe('lateNoticeText', () => {
  it('no longer claims the real exam discards the section; says in-time answers counted', () => {
    const text = lateNoticeText(0);
    expect(text).not.toContain('כמו במבחן האמיתי');
    expect(text).toContain('התשובות שסימנת לפני שהזמן נגמר נשמרו ונספרו');
  });

  it('says how many answers did not count, in Hebrew number agreement', () => {
    expect(lateNoticeText(1)).toContain('תשובה אחת לא הגיעה אלינו לפני סוף הזמן, ולכן לא נספרה.');
    expect(lateNoticeText(3)).toContain('3 תשובות לא הגיעו אלינו לפני סוף הזמן, ולכן לא נספרו.');
  });
});
