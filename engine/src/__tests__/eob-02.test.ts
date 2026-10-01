import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/eob-02.js';
import { bill, ctx, line } from './helpers.js';

describe('EOB-02 provider-liability amount billed to patient', () => {
  it('flags a CO adjustment still appearing in the balance', () => {
    const l = line({ amount: 200 });
    const b = bill([l], { balanceDue: 200 });
    const { findings } = evaluate(b, ctx({ eob: { adjustments: [{ group: 'CO', amount: 75, lineId: l.id }] } }), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(75);
  });

  it('flags and sums multiple CO adjustments', () => {
    const b = bill([line({ amount: 300 })], { balanceDue: 300 });
    const { findings } = evaluate(
      b,
      ctx({ eob: { adjustments: [{ group: 'CO', amount: 50 }, { group: 'CO', amount: 25 }] } }),
      {},
    );
    expect(findings[0]!.dollarsAtStake).toBe(75);
  });

  it('does not flag when the only adjustment is patient responsibility (PR)', () => {
    const b = bill([line({ amount: 200 })], { balanceDue: 200 });
    const { findings } = evaluate(b, ctx({ eob: { adjustments: [{ group: 'PR', amount: 75 }] } }), {});
    expect(findings).toHaveLength(0);
  });

  it('skips without EOB adjustment codes', () => {
    const b = bill([line({ amount: 200 })], { balanceDue: 200 });
    const result = evaluate(b, ctx(), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
