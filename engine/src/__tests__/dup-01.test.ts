import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/dup-01.js';
import { bill, ctx, line } from './helpers.js';

describe('DUP-01 exact duplicate charge', () => {
  it('flags two identical lines', () => {
    const b = bill([
      line({ date: '2026-01-01', code: 'A1', qty: 1, amount: 50 }),
      line({ date: '2026-01-01', code: 'A1', qty: 1, amount: 50 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidence).toBe('high');
    expect(findings[0]!.dollarsAtStake).toBe(50);
  });

  it('flags three identical lines with cumulative dollars at stake', () => {
    const b = bill([
      line({ date: '2026-02-01', code: 'B2', qty: 2, amount: 20 }),
      line({ date: '2026-02-01', code: 'B2', qty: 2, amount: 20 }),
      line({ date: '2026-02-01', code: 'B2', qty: 2, amount: 20 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidenceLineIds).toHaveLength(3);
    expect(findings[0]!.dollarsAtStake).toBe(40);
  });

  it('does not flag bilateral lines distinguished by modifier (LT vs RT)', () => {
    const b = bill([
      line({ date: '2026-03-01', code: 'C3', qty: 1, amount: 100, modifiers: ['LT'] }),
      line({ date: '2026-03-01', code: 'C3', qty: 1, amount: 100, modifiers: ['RT'] }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag a duplicate already reversed by a credit', () => {
    const b = bill([
      line({ date: '2026-04-01', code: 'D4', qty: 1, amount: 75 }),
      line({ date: '2026-04-01', code: 'D4', qty: 1, amount: 75 }),
      line({ date: '2026-04-02', code: 'D4', qty: 1, amount: -75 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });
});
