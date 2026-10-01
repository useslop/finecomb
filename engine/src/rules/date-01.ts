import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, sum } from '../lib/util.js';

export const id = 'DATE-01';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (ctx.admitted !== true || !bill.header.dischargeDate) {
    return { findings: [], skipped: { ruleId: id, needs: ['that this was an inpatient stay, and the discharge date'] } };
  }
  const discharge = bill.header.dischargeDate;
  const late = bill.lines.filter((l) => l.date && l.date > discharge);
  if (late.length === 0) return { findings: [] };
  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: late.map((l) => l.id).join(','),
        title: 'Charges dated after you were discharged',
        why: `${late.length} line(s) are dated after the discharge date (${discharge}).`,
        userText: 'This charge is dated after your discharge.',
        verify: 'Ask whether this is a billing-system posting date rather than the actual service date.',
        evidenceLineIds: late.map((l) => l.id),
        confidence: 'medium',
        dollarsAtStake: sum(late.map((l) => l.amount)),
        citations: [],
      }),
    ],
  };
}
