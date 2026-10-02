import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding } from '../lib/util.js';

export const id = 'INS-01';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (ctx.insurance === undefined) {
    return { findings: [], skipped: { ruleId: id, needs: ['your insurance status'] } };
  }
  if (ctx.insurance === 'none') return { findings: [] };
  const noEobEvidence = !ctx.eob || (ctx.eob.planPaid == null && (ctx.eob.adjustments ?? []).length === 0);
  if (!noEobEvidence) return { findings: [] };
  // Payer activity printed on the bill itself is evidence the claim went out, EOB or not. Medicaid in
  // particular often sends no EOB at all; a posted payment or contractual adjustment settles it.
  const { payments, adjustments } = bill.header;
  if ((payments ?? 0) > 0 || (adjustments ?? 0) > 0) return { findings: [] };
  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: 'not-billed',
        title: 'This may not have been billed to insurance',
        why: 'You have insurance, but there is no insurance payment or adjustment on this bill, and no EOB was entered.',
        userText: `It looks like this bill may not have been sent to your insurance. Ask them to bill ${ctx.insurerName ?? 'your insurer'}.`,
        verify: 'Call the provider and confirm whether and when they submitted the claim.',
        evidenceLineIds: [],
        confidence: 'medium',
        dollarsAtStake: bill.header.balanceDue ?? null,
        citations: [],
      }),
    ],
  };
}
