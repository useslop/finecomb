import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/dup-02.js';
import { bill, ctx, line } from './helpers.js';

describe('DUP-02 near-duplicate charge', () => {
  it('flags same code/date with different amounts', () => {
    const b = bill([
      line({ date: '2026-01-01', code: 'A1', amount: 50, description: 'Panel' }),
      line({ date: '2026-01-01', code: 'A1', amount: 65, description: 'Panel' }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(50);
  });

  it('flags same code/date/amount with a different description', () => {
    const b = bill([
      line({ date: '2026-01-02', code: 'B2', amount: 30, description: 'Lab draw' }),
      line({ date: '2026-01-02', code: 'B2', amount: 30, description: 'Blood panel' }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
  });

  it('does not flag truly identical lines (that is DUP-01)', () => {
    const b = bill([
      line({ date: '2026-01-03', code: 'C3', amount: 40, description: 'Same' }),
      line({ date: '2026-01-03', code: 'C3', amount: 40, description: 'Same' }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag the same code on different dates', () => {
    const b = bill([
      line({ date: '2026-01-04', code: 'D4', amount: 40, description: 'X-ray view 1' }),
      line({ date: '2026-01-05', code: 'D4', amount: 55, description: 'X-ray view 2' }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });
});
