import type { Bill, Context, Datasets, Finding } from '../types.js';
import { lineKey, mkFinding, modsKey, sum } from '../lib/util.js';
import { netted } from '../net.js';

export const id = 'DUP-01';

export function evaluate(bill: Bill, _ctx: Context, _data: Datasets): { findings: Finding[] } {
  const survivors = netted(bill).charges;
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
    // Q1: drugs, IV fluids, supplies and lab draws are routinely repeated the same day as identical lines (repeat
    // doses, serial labs), and statements often drop the 76/91 modifiers, so those are Medium, not High.
    const repeatable = group.some(isRoutinelyRepeated);
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: ids.join(','),
        title: `${group.length} identical charges on ${group[0]!.date ?? 'the same date'}`,
        why: `These ${group.length} lines have the same date, item, quantity and price.`,
        userText: repeatable
          ? `These ${group.length} lines look identical (same date, item, quantity and price). Drugs, supplies and lab tests are often given more than once a day, so ask whether you received this ${group.length} times.`
          : `These ${group.length} lines look identical (same date, item, quantity and price). Ask whether you received this ${group.length} times.`,
        verify: 'Ask for the medical record or claim form (UB-04/CMS-1500) showing each instance was actually provided.',
        evidenceLineIds: ids,
        confidence: repeatable ? 'medium' : 'high',
        dollarsAtStake: sum(group.slice(1).map((l) => l.amount)),
        citations: [],
      }),
    );
  }
  return { findings };
}

/** Items billed per dose or per draw: NDC lines, J-code drugs, pharmacy/IV/supply/lab revenue codes, lab-shaped codes. */
export function isRoutinelyRepeated(l: { ndc?: string; code?: string; revCode?: string }): boolean {
  if (l.ndc) return true;
  const code = (l.code ?? '').trim().toUpperCase();
  if (/^J\d{4}$/.test(code) || /^8\d{4}$/.test(code) || code === '36415') return true;
  const rev = (l.revCode ?? '').trim().padStart(4, '0');
  return /^0(25|26|27|30|31|63)\d$/.test(rev);
}
