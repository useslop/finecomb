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

describe('DUP-02 hard negatives (F1)', () => {
  it('does not flag a JW drug-waste line (or JZ) next to the administered dose', () => {
    const b = bill([
      line({ date: '2026-02-01', code: 'J2405', qty: 4, unitPrice: 12, amount: 48, description: 'ONDANSETRON INJ PER 1MG' }),
      line({ date: '2026-02-01', code: 'J2405', qty: 2, unitPrice: 12, amount: 24, description: 'ONDANSETRON WASTAGE', modifiers: ['JW'] }),
      line({ date: '2026-02-01', code: 'J1100', qty: 4, unitPrice: 5, amount: 20, description: 'DEXAMETHASONE INJ', modifiers: ['JZ'] }),
      line({ date: '2026-02-01', code: 'J1100', qty: 4, unitPrice: 6, amount: 24, description: 'DEXAMETHASONE INJ' }),
    ]);
    expect(evaluate(b, ctx(), {}).findings).toHaveLength(0);
  });

  it('does not flag bilateral lines with a discounted second side (RT full, LT half)', () => {
    const b = bill([
      line({ date: '2026-02-02', code: '20610', amount: 300, description: 'JOINT INJECTION MAJOR', modifiers: ['RT'] }),
      line({ date: '2026-02-02', code: '20610', amount: 150, description: 'JOINT INJECTION MAJOR', modifiers: ['LT'] }),
    ]);
    expect(evaluate(b, ctx(), {}).findings).toHaveLength(0);
  });
});
