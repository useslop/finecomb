import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/math-02.js';
import { bill, ctx, line } from './helpers.js';

describe('MATH-02 totals reconcile', () => {
  it('flags when lines do not sum to total charges', () => {
    const b = bill([line({ amount: 100 }), line({ amount: 50 })], { totalCharges: 200 });
    const { findings } = evaluate(b, ctx(), {});
    expect(findings.some((f) => f.id.endsWith('lines-vs-total'))).toBe(true);
  });

  it('flags when charges - payments - adjustments != balance due', () => {
    const b = bill([line({ amount: 100 })], { totalCharges: 100, payments: 20, adjustments: 10, balanceDue: 90 });
    const { findings } = evaluate(b, ctx(), {});
    expect(findings.some((f) => f.id.endsWith('balance-equation'))).toBe(true);
  });

  it('does not flag when everything reconciles', () => {
    const b = bill([line({ amount: 60 }), line({ amount: 40 })], {
      totalCharges: 100,
      payments: 20,
      adjustments: 10,
      balanceDue: 70,
    });
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });

  it('skips when no totals are available', () => {
    const b = bill([line({ amount: 60 })]);
    const result = evaluate(b, ctx(), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
