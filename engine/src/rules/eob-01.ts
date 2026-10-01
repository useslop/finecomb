import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2, sum } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'EOB-01';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (!ctx.eob || bill.header.balanceDue == null) {
    return { findings: [], skipped: { ruleId: id, needs: ["your EOB numbers and the bill's balance due"] } };
  }
  const eob = ctx.eob;
  const pr = eob.patientResponsibility ?? sum([eob.deductible, eob.copay, eob.coinsurance, eob.nonCovered]);
  const diff = round2(bill.header.balanceDue - pr);
  if (diff <= 1) return { findings: [] };
  const nsaRelevant = ctx.emergency === true || ctx.airAmbulance === true;
  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: 'eob-balance',
        title: 'Bill asks for more than your EOB says you owe',
        why: `Your EOB's patient responsibility is $${pr.toFixed(2)}; the bill asks for $${bill.header.balanceDue.toFixed(2)}.`,
        userText: `Your EOB says you owe $${pr.toFixed(2)}; the bill asks for $${bill.header.balanceDue.toFixed(2)}.`,
        verify: "Call the provider and ask them to match the bill to the EOB; call your insurer if they won't.",
        evidenceLineIds: [],
        confidence: 'high',
        dollarsAtStake: diff,
        citations: nsaRelevant ? cite('S8') : [],
      }),
    ],
  };
}
