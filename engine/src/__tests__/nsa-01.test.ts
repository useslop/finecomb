import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/nsa-01.js';
import { bill, ctx, line } from './helpers.js';

describe('NSA-01 emergency / air-ambulance balance billing', () => {
  it('flags an out-of-network emergency bill above in-network cost-sharing', () => {
    const b = bill([line({ amount: 1000 })], { balanceDue: 1000 });
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'commercial', emergency: true, facilityInNetwork: false, eob: { patientResponsibility: 200 } }),
      {},
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(800);
  });

  it('flags an out-of-network air-ambulance bill the same way', () => {
    const b = bill([line({ amount: 5000 })], { balanceDue: 5000 });
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'commercial', airAmbulance: true, facilityInNetwork: false, eob: { patientResponsibility: 500 } }),
      {},
    );
    expect(findings).toHaveLength(1);
  });

  it('does not flag an in-network emergency facility', () => {
    const b = bill([line({ amount: 1000 })], { balanceDue: 1000 });
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'commercial', emergency: true, facilityInNetwork: true, eob: { patientResponsibility: 200 } }),
      {},
    );
    expect(findings).toHaveLength(0);
  });

  it('skips without an EOB entered', () => {
    const b = bill([line({ amount: 1000 })], { balanceDue: 1000 });
    const result = evaluate(b, ctx({ insurance: 'commercial', emergency: true, facilityInNetwork: false }), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
