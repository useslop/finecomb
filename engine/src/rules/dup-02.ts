import type { Bill, BillLine, Context, Datasets, Finding } from '../types.js';
import { mkFinding } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'DUP-02';

export function evaluate(bill: Bill, _ctx: Context, _data: Datasets): { findings: Finding[] } {
  const byDateCode = new Map<string, BillLine[]>();
  for (const l of bill.lines) {
    if (!l.code || !l.date) continue;
    const key = `${l.date}|${l.code}`;
    const arr = byDateCode.get(key) ?? [];
    arr.push(l);
    byDateCode.set(key, arr);
  }
  const findings: Finding[] = [];
  for (const group of byDateCode.values()) {
    if (group.length < 2) continue;
    const distinct = new Set(group.map((l) => `${l.amount}|${l.description.trim().toLowerCase()}`));
    if (distinct.size < 2) continue; // identical lines are DUP-01's job
    const ids = group.map((l) => l.id);
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: ids.join(','),
        title: `Same code, different price or description on ${group[0]!.date}`,
        why: 'The same billing code appears twice on the same date with different amounts or descriptions.',
        userText: `The same item appears twice on ${group[0]!.date} with different prices. Ask whether both are correct.`,
        verify: 'Ask the billing office to explain why the same code was billed twice at different amounts.',
        evidenceLineIds: ids,
        confidence: 'medium',
        dollarsAtStake: Math.min(...group.map((l) => l.amount)),
        citations: cite('S19'),
      }),
    );
  }
  return { findings };
}
