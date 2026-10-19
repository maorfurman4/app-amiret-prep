import { describe, expect, it } from 'vitest';
import { DiagnosticRun } from './diagnostic-run';

const a = (n: number) => ({ id: `q${n}`, chosen: n % 4 });

describe('DiagnosticRun', () => {
  it('retries a failed step with the answer that was just given', () => {
    const run = new DiagnosticRun();
    for (let n = 1; n <= 4; n++) run.accept(run.send(a(n)));

    run.send(a(5)); // this request fails
    expect(run.retry()).toEqual([a(1), a(2), a(3), a(4), a(5)]);
    expect(run.answers).toHaveLength(4);
  });

  it('confirms only what the server accepted', () => {
    const run = new DiagnosticRun();
    const first = run.send();
    expect(first).toEqual([]);
    run.accept(first);
    const sent = run.send(a(1));
    run.accept(sent);
    expect(run.answers).toEqual([a(1)]);
    expect(run.retry()).toEqual([a(1)]);
  });
});
