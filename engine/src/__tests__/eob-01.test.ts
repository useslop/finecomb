import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/eob-01.js';
import { bill, ctx, line } from './helpers.js';

describe('EOB-01 balance exceeds EOB patient responsibility', () => {
  it('flags when the balance due exceeds patientResponsibility', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 300 });
    const { findings } = evaluate(b, ctx({ eob: { patientResponsibility: 150 } }), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(150);
  });

  it('flags using the summed EOB components when patientResponsibility is absent', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 300 });
    const { findings } = evaluate(b, ctx({ eob: { deductible: 50, copay: 20, coinsurance: 30 } }), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(200);
  });

  it('does not flag when the balance matches patient responsibility', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 150 });
    const { findings } = evaluate(b, ctx({ eob: { patientResponsibility: 150 } }), {});
    expect(findings).toHaveLength(0);
  });

  it('skips without an EOB entered', () => {
    const b = bill([line({ amount: 500 })], { balanceDue: 300 });
    const result = evaluate(b, ctx(), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
