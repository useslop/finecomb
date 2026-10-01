import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2, sum } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'NSA-02';

const ANCILLARY = /emergency medicine|anesthes|patholog|radiolog|neonatolog|assistant surgeon|hospitalist|intensivist|diagnostic (lab|imaging)/i;

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (ctx.facilityInNetwork === undefined || ctx.oonClinicianTypes === undefined) {
    return { findings: [], skipped: { ruleId: id, needs: ['whether the facility was in-network, and any out-of-network clinician types'] } };
  }
  if (ctx.insurance === undefined) {
    return { findings: [], skipped: { ruleId: id, needs: ['your insurance status'] } };
  }
  if (ctx.insurance === 'none' || ctx.facilityInNetwork !== true) return { findings: [] };
  const ancillaryTypes = ctx.oonClinicianTypes.filter((t) => ANCILLARY.test(t));
  if (ancillaryTypes.length === 0) return { findings: [] };

  let diff: number | null = null;
  if (ctx.eob && bill.header.balanceDue != null) {
    const inNetworkShare = ctx.eob.patientResponsibility ?? sum([ctx.eob.deductible, ctx.eob.copay, ctx.eob.coinsurance]);
    diff = round2(bill.header.balanceDue - inNetworkShare);
    if (diff <= 1) return { findings: [] };
  }

  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: 'nsa-ancillary',
        title: 'Out-of-network ancillary clinician at an in-network facility',
        why: `You reported an out-of-network ${ancillaryTypes.join(', ')} at an in-network facility.`,
        userText: "This type of out-of-network clinician at an in-network facility can't balance-bill you, even if you signed a form.",
        verify: 'Call the No Surprises Help Desk at 1-800-985-3059, or appeal to your insurer.',
        evidenceLineIds: [],
        confidence: 'medium',
        dollarsAtStake: diff,
        citations: cite('S7', 'S8'),
      }),
    ],
  };
}
