import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2 } from '../lib/util.js';

export const id = 'EOB-02';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const adjustments = ctx.eob?.adjustments;
  if (!adjustments || adjustments.length === 0) {
    return { findings: [], skipped: { ruleId: id, needs: ['the group/reason codes from your EOB'] } };
  }
  const coAdjustments = adjustments.filter((a) => a.group === 'CO' && a.amount > 0);
  if (coAdjustments.length === 0) return { findings: [] };
  const total = round2(coAdjustments.reduce((a, c) => a + c.amount, 0));
  if (bill.header.balanceDue == null || bill.header.balanceDue < total - 1) return { findings: [] };

  const evidenceLineIds = coAdjustments
    .map((a) => a.lineId)
    .filter((lid): lid is string => Boolean(lid))
    .filter((lid) => bill.lines.some((l) => l.id === lid));

  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: 'co-adjustments',
        title: "Your insurer marked some charges as the provider's responsibility",
        why: `Your EOB shows $${total.toFixed(2)} in "CO" (contractual obligation) adjustments, which are the provider's to absorb, not yours.`,
        userText: `Your insurer marked $${total.toFixed(2)} as the provider's responsibility, not yours.`,
        verify: 'Ask the provider to remove these amounts from your balance; show them the EOB group code.',
        evidenceLineIds,
        confidence: 'medium',
        dollarsAtStake: total,
        citations: [],
      }),
    ],
  };
}
