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
