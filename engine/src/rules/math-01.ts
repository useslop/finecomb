import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2 } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'MATH-01';

export function evaluate(bill: Bill, _ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const applicable = bill.lines.filter((l) => l.qty != null && l.unitPrice != null);
  if (applicable.length === 0) {
    return { findings: [], skipped: { ruleId: id, needs: ['line quantity and unit price for at least one line'] } };
  }
  const findings: Finding[] = [];
  for (const l of applicable) {
    const calc = round2(l.qty! * l.unitPrice!);
    const diff = round2(Math.abs(calc - l.amount));
    const tol = Math.max(0.05, 0.005 * Math.abs(l.amount));
    if (diff <= tol) continue;
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: l.id,
        title: "Quantity × price doesn't match the line total",
        why: `${l.qty} × $${l.unitPrice!.toFixed(2)} = $${calc.toFixed(2)}, but the line charges $${l.amount.toFixed(2)}.`,
        userText: `Quantity × price doesn't equal the line total ($${calc.toFixed(2)} vs $${l.amount.toFixed(2)}).`,
        verify: 'Ask the billing office to recalculate this line.',
        evidenceLineIds: [l.id],
        confidence: 'high',
        dollarsAtStake: diff,
        citations: cite('S41'),
      }),
    );
  }
  return { findings };
}
