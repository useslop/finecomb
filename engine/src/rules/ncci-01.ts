import type { Bill, BillLine, Context, Datasets, Finding, Skipped } from '../types.js';
import { hasSeparatingModifier, mkFinding } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'NCCI-01';

export function evaluate(bill: Bill, _ctx: Context, data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (!data.ncciPtp) {
    return { findings: [], skipped: { ruleId: id, needs: ['NCCI procedure-to-procedure edit data'] } };
  }
  const byDate = new Map<string, BillLine[]>();
  for (const l of bill.lines) {
    if (!l.date || !l.code) continue;
    const arr = byDate.get(l.date) ?? [];
    arr.push(l);
    byDate.set(l.date, arr);
  }
  const findings: Finding[] = [];
  for (const [date, group] of byDate) {
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const a = group[i]!;
        const b = group[j]!;
        if (a.provider !== b.provider) continue;
        const edit = data.ncciPtp(a.code!, b.code!, date);
        if (!edit) continue;
        if (edit.modifierIndicator === 9) continue;
        if (edit.modifierIndicator === 1 && hasSeparatingModifier(b.modifiers)) continue;
        findings.push(
          mkFinding({
            ruleId: id,
            discriminator: `${a.id}>${b.id}`,
            title: `${b.code} is normally bundled into ${a.code}`,
            why: `${a.code} and ${b.code} were billed on the same date (${date}) and have an active NCCI edit.`,
            userText: `${b.code} is normally included in ${a.code} when billed on the same day. Ask why it was billed separately.`,
            verify: 'Ask for the claim form (UB-04/CMS-1500) to check which modifiers, if any, were submitted.',
            evidenceLineIds: [a.id, b.id],
            confidence: 'medium',
            dollarsAtStake: b.amount,
            citations: cite('S19'),
          }),
        );
      }
    }
  }
  return { findings };
}
