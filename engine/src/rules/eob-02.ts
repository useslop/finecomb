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
  const balance = bill.header.balanceDue;
  if (balance == null) return { findings: [] };
  const eob = ctx.eob!;
  const patientShare = eob.patientResponsibility
    ?? round2((eob.deductible ?? 0) + (eob.copay ?? 0) + (eob.coinsurance ?? 0) + (eob.nonCovered ?? 0));
  const overShare = round2(balance - patientShare);
  if (overShare <= 1) return { findings: [] }; // the balance is within what the EOB says you owe
  // How much of the CO amount the provider did not write off. When the bill prints its adjustments, that is
  // CO minus the posted adjustments (one line's CO left in the balance counts); otherwise the whole CO
  // amount has to be sitting in the balance.
  const posted = bill.header.adjustments;
  const notWrittenOff = posted != null ? round2(total - posted) : balance >= total - 1 ? total : 0;
  if (notWrittenOff <= 1) return { findings: [] };
  const atStake = round2(Math.min(notWrittenOff, overShare));

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
        why: `Your EOB shows $${total.toFixed(2)} in "CO" (contractual obligation) adjustments, which are the provider's to absorb, not yours; about $${atStake.toFixed(2)} of it still seems to be in your balance.`,
        userText: `Your insurer marked $${atStake.toFixed(2)} as the provider's responsibility, not yours.`,
        verify: 'Ask the provider to remove these amounts from your balance; show them the EOB group code.',
        evidenceLineIds,
        confidence: 'medium',
        dollarsAtStake: atStake,
        citations: [],
      }),
    ],
  };
}
