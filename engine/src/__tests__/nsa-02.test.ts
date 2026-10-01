import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/nsa-02.js';
import { bill, ctx, line } from './helpers.js';

describe('NSA-02 ancillary out-of-network clinician at an in-network facility', () => {
  it('flags an ancillary OON clinician type even without an EOB', () => {
    const b = bill([line({ amount: 400 })]);
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'commercial', facilityInNetwork: true, oonClinicianTypes: ['Anesthesiology'] }),
      {},
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBeNull();
  });

  it('flags and computes dollars at stake when an EOB is present', () => {
    const b = bill([line({ amount: 400 })], { balanceDue: 400 });
    const { findings } = evaluate(
      b,
      ctx({
        insurance: 'commercial',
        facilityInNetwork: true,
        oonClinicianTypes: ['Radiology'],
        eob: { patientResponsibility: 50 },
      }),
      {},
    );
    expect(findings[0]!.dollarsAtStake).toBe(350);
  });

  it('does not flag a non-ancillary out-of-network clinician type', () => {
    const b = bill([line({ amount: 400 })]);
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'commercial', facilityInNetwork: true, oonClinicianTypes: ['Cardiology'] }),
      {},
    );
    expect(findings).toHaveLength(0);
  });

  it('does not flag when the facility itself is out-of-network', () => {
    const b = bill([line({ amount: 400 })]);
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'commercial', facilityInNetwork: false, oonClinicianTypes: ['Anesthesiology'] }),
      {},
    );
    expect(findings).toHaveLength(0);
  });
});
