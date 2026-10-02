import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/ins-01.js';
import { bill, ctx, line } from './helpers.js';

describe('INS-01 possibly not billed to insurance', () => {
  it('flags insured with no EOB entered at all', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 500 });
    const { findings } = evaluate(b, ctx({ insurance: 'commercial' }), {});
    expect(findings).toHaveLength(1);
  });

  it('flags insured with an EOB showing no payment or adjustment', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 500 });
    const { findings } = evaluate(b, ctx({ insurance: 'commercial', eob: {} }), {});
    expect(findings).toHaveLength(1);
  });

  it('does not flag an uninsured (self-pay) bill', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 500 });
    const { findings } = evaluate(b, ctx({ insurance: 'none' }), {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag when the EOB shows a plan payment', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 100 });
    const { findings } = evaluate(b, ctx({ insurance: 'commercial', eob: { planPaid: 400 } }), {});
    expect(findings).toHaveLength(0);
  });
});

describe('INS-01 hard negatives (F1)', () => {
  it('does not flag a Medicaid patient with no EOB when the bill shows a payment and adjustment', () => {
    const b = bill([line({ amount: 1000 })], { totalCharges: 1000, payments: 250, adjustments: 750, balanceDue: 0 });
    expect(evaluate(b, ctx({ insurance: 'medicaid' }), {}).findings).toHaveLength(0);
  });

  it('does not flag an insured bill with a posted insurance payment but no EOB entered', () => {
    const b = bill([line({ amount: 1000 })], { totalCharges: 1000, payments: 600, adjustments: 0, balanceDue: 400 });
    expect(evaluate(b, ctx({ insurance: 'commercial' }), {}).findings).toHaveLength(0);
  });
});
