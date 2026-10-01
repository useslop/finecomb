import type { Bill, Context, Datasets, Finding } from '../types.js';
import { lineKey, mkFinding, modsKey, netCredits, sum } from '../lib/util.js';

export const id = 'DUP-01';

export function evaluate(bill: Bill, _ctx: Context, _data: Datasets): { findings: Finding[] } {
  const survivors = netCredits(bill.lines);
  const groups = new Map<string, typeof survivors>();
  for (const l of survivors) {
    const key = `${l.date ?? ''}|${lineKey(l)}|${l.qty ?? 1}|${l.amount}|${modsKey(l.modifiers)}`;
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }
  const findings: Finding[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ids = group.map((l) => l.id);
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: ids.join(','),
        title: `${group.length} identical charges on ${group[0]!.date ?? 'the same date'}`,
        why: `These ${group.length} lines have the same date, item, quantity and price.`,
        userText: `These ${group.length} lines look identical (same date, item, quantity and price). Ask whether you received this ${group.length} times.`,
        verify: 'Ask for the medical record or claim form (UB-04/CMS-1500) showing each instance was actually provided.',
        evidenceLineIds: ids,
        confidence: 'high',
        dollarsAtStake: sum(group.slice(1).map((l) => l.amount)),
        citations: [],
      }),
    );
  }
  return { findings };
}
