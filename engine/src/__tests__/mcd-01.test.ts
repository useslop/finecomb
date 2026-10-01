import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/mcd-01.js';
import { bill, ctx, line } from './helpers.js';

describe('MCD-01 Medicaid balance-billing', () => {
  it('flags a balance above zero copay', () => {
    const b = bill([line({ amount: 100 })], { balanceDue: 100 });
    const { findings } = evaluate(b, ctx({ insurance: 'medicaid' }), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(100);
  });

  it('flags a balance above the recorded copay', () => {
    const b = bill([line({ amount: 50 })], { balanceDue: 50 });
    const { findings } = evaluate(b, ctx({ insurance: 'medicaid', eob: { copay: 10 } }), {});
    expect(findings[0]!.dollarsAtStake).toBe(40);
  });

  it('does not flag when the balance equals the copay', () => {
    const b = bill([line({ amount: 10 })], { balanceDue: 10 });
    const { findings } = evaluate(b, ctx({ insurance: 'medicaid', eob: { copay: 10 } }), {});
    expect(findings).toHaveLength(0);
  });

  it('does not apply to non-Medicaid insurance', () => {
    const b = bill([line({ amount: 100 })], { balanceDue: 100 });
    const { findings } = evaluate(b, ctx({ insurance: 'commercial' }), {});
    expect(findings).toHaveLength(0);
  });
});
