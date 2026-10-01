import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2 } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'RX-01';

export function evaluate(bill: Bill, _ctx: Context, data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const withNdc = bill.lines.filter((l) => l.ndc);
  if (withNdc.length === 0) {
    return { findings: [], skipped: { ruleId: id, needs: ['drug NDC codes on the bill (ask the pharmacy for them)'] } };
  }
  if (!data.nadac) {
    return { findings: [], skipped: { ruleId: id, needs: ['national average drug acquisition cost (NADAC) reference data'] } };
  }
  const findings: Finding[] = [];
  for (const l of withNdc) {
    const nadac = data.nadac(l.ndc!);
    if (!nadac || !nadac.unitPrice) continue;
    const qty = l.qty ?? 1;
    const unitBilled = l.unitPrice ?? l.amount / qty;
    const multiple = unitBilled / nadac.unitPrice;
    if (multiple < 10) continue;
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: l.id,
        title: 'Billed well above the national average pharmacy cost',
        why: `Billed at $${unitBilled.toFixed(2)}/unit vs. a NADAC of $${nadac.unitPrice.toFixed(2)}/unit.`,
        userText: `This drug was billed at ${round2(multiple).toFixed(1)}× the national average pharmacy acquisition cost. That isn't an error by itself, but it's useful when negotiating.`,
        verify: 'Use this when asking for a self-pay discount or negotiating the balance.',
        evidenceLineIds: [l.id],
        confidence: 'info',
        dollarsAtStake: null,
        citations: cite('S26'),
      }),
    );
  }
  return { findings };
}
