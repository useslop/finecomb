import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/math-01.js';
import { bill, ctx, line } from './helpers.js';

describe('MATH-01 line arithmetic error', () => {
  it('flags qty x price not matching the line amount', () => {
    const b = bill([line({ qty: 3, unitPrice: 10, amount: 40 })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(10);
  });

  it('flags a larger mismatch', () => {
    const b = bill([line({ qty: 5, unitPrice: 20, amount: 200 })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(100);
  });

  it('does not flag a line within rounding tolerance', () => {
    const b = bill([line({ qty: 3, unitPrice: 10.005, amount: 30.02 })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag when qty/unitPrice are absent (and reports a skip)', () => {
    const b = bill([line({ amount: 40 })]);
    const result = evaluate(b, ctx(), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
