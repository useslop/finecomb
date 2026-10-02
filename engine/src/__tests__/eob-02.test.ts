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

describe('EOB-02 co-billed and hard negatives (F1)', () => {
  const eob = {
    patientResponsibility: 150,
    adjustments: [
      { group: 'CO' as const, amount: 300, lineId: 'A' },
      { group: 'CO' as const, amount: 120, lineId: 'B' },
      { group: 'PR' as const, amount: 150 },
    ],
  };
  it('flags one line\'s CO amount left in the balance (posted adjustments short by that line)', () => {
    // charges 1000, plan paid 430, CO 420 but only 300 written off: balance 270 = PR 150 + 120 co-billed
    const b = bill([line({ id: 'A', amount: 600 }), line({ id: 'B', amount: 400 })], { totalCharges: 1000, payments: 430, adjustments: 300, balanceDue: 270 });
    const { findings } = evaluate(b, ctx({ eob }), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(120);
  });

  it('does not flag when the posted write-off is short by under $1', () => {
    const b = bill([line({ amount: 1000 })], { totalCharges: 1000, payments: 430, adjustments: 419.4, balanceDue: 150.6 });
    expect(evaluate(b, ctx({ eob }), {}).findings).toHaveLength(0);
  });

  it('does not flag when the balance is only the EOB patient share', () => {
    const b = bill([line({ amount: 1000 })], { totalCharges: 1000, payments: 430, adjustments: 300, balanceDue: 150 });
    expect(evaluate(b, ctx({ eob }), {}).findings).toHaveLength(0);
  });
});
