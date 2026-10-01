import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2, sum } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'NSA-01';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const needs: string[] = [];
  if (ctx.insurance === undefined) needs.push('your insurance status');
  if (ctx.emergency === undefined && ctx.airAmbulance === undefined) needs.push('whether this was emergency or air-ambulance care');
  if (ctx.facilityInNetwork === undefined) needs.push('whether the facility was in-network');
  if (!ctx.eob) needs.push('your EOB numbers');
  if (needs.length > 0) return { findings: [], skipped: { ruleId: id, needs } };

  if (ctx.insurance === 'none') return { findings: [] };
  const qualifies = (ctx.emergency === true || ctx.airAmbulance === true) && ctx.facilityInNetwork === false;
  if (!qualifies) return { findings: [] };

  const eob = ctx.eob!;
  const inNetworkShare = eob.patientResponsibility ?? sum([eob.deductible, eob.copay, eob.coinsurance]);
  if (bill.header.balanceDue == null) return { findings: [] };
  const diff = round2(bill.header.balanceDue - inNetworkShare);
  if (diff <= 1) return { findings: [] };

  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: 'nsa-emergency',
        title: 'Out-of-network emergency bill above in-network cost-sharing',
        why: `Your in-network cost-sharing from the EOB is $${inNetworkShare.toFixed(2)}, but the bill asks for $${bill.header.balanceDue.toFixed(2)}.`,
        userText: "Emergency (or air-ambulance) care from out-of-network providers can't cost more than in-network cost-sharing.",
        verify: 'Call the No Surprises Help Desk at 1-800-985-3059, or appeal to your insurer.',
        evidenceLineIds: [],
        confidence: 'high',
        dollarsAtStake: diff,
        citations: cite('S6', 'S8'),
      }),
    ],
  };
}
