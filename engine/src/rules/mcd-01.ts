import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2 } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'MCD-01';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (ctx.insurance === undefined) {
    return { findings: [], skipped: { ruleId: id, needs: ['your insurance status'] } };
  }
  if (ctx.insurance !== 'medicaid') return { findings: [] };
  if (bill.header.balanceDue == null) {
    return { findings: [], skipped: { ruleId: id, needs: ["the bill's balance due"] } };
  }
  const copay = ctx.eob?.copay ?? 0;
  const diff = round2(bill.header.balanceDue - copay);
  if (diff <= 0.01) return { findings: [] };
  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: 'medicaid-balance',
        title: 'Balance due exceeds what a Medicaid provider can charge you',
        why: `The balance due ($${bill.header.balanceDue.toFixed(2)}) is more than your Medicaid copay ($${copay.toFixed(2)}).`,
        userText: "Medicaid providers must accept Medicaid's payment (plus any required copay) as payment in full.",
        verify: 'Give the provider your Medicaid ID and ask them to rebill and correct your balance.',
        evidenceLineIds: [],
        confidence: 'medium',
        dollarsAtStake: diff,
        citations: cite('S29'),
      }),
    ],
  };
}
