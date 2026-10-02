import type { Bill, BillLine, Context, Datasets, Finding, Skipped } from '../types.js';
import { isFacilityBill, mkFinding, round2 } from '../lib/util.js';
import { netUnits } from '../net.js';
import { cite } from '../citations.js';

export const id = 'MUE-01';

export function evaluate(bill: Bill, ctx: Context, data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (!data.mue) {
    return { findings: [], skipped: { ruleId: id, needs: ['Medicare unit-limit (MUE) reference data'] } };
  }
  if (ctx.admitted === true) {
    // Inpatient claims aren't subject to practitioner/outpatient MUEs.
    return { findings: [] };
  }
  // Setting comes from the bill itself: a facility bill (UB-04, revenue codes on its lines) is judged
  // against the outpatient-hospital MUE, a clinician's bill against the practitioner MUE. Observation
  // status says nothing about which of the two bills this is.
  const setting: 'practitioner' | 'outpatient' = isFacilityBill(bill.lines) ? 'outpatient' : 'practitioner';

  const byCodeDate = new Map<string, BillLine[]>();
  for (const l of bill.lines) {
    if (!l.code || !l.date) continue;
    const key = `${l.code}|${l.date}`;
    const arr = byCodeDate.get(key) ?? [];
    arr.push(l);
    byCodeDate.set(key, arr);
  }

  const findings: Finding[] = [];
  for (const [key, group] of byCodeDate) {
    const [code, date] = key.split('|') as [string, string];
    const lookup = data.mue(code, setting);
    if (!lookup) continue;
    const totalUnits = netUnits(group); // reversed units don't count
    if (totalUnits <= lookup.mue) continue;
    // MAI 1 is a per-line edit: separate lines (e.g. with 59/76/91) may each carry up to the MUE.
    if (lookup.mai === 1 && group.every((l) => l.amount <= 0 || (l.qty ?? 1) <= lookup.mue)) continue;
    const confidence = lookup.mai === 2 ? 'high' : 'medium';
    const unitPrice = group.find((l) => l.unitPrice != null)?.unitPrice ?? null;
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: key,
        title: `${code}: more units billed than Medicare's usual daily maximum`,
        why: `${totalUnits} units of ${code} were billed on ${date}; Medicare's Medically Unlikely Edit for this code and setting is ${lookup.mue}.`,
        userText: `${totalUnits} units of ${code} on one day is more than Medicare's usual maximum (${lookup.mue}). Ask for the records supporting this quantity.`,
        verify: 'Ask for the medical record supporting this number of units on this date.',
        evidenceLineIds: group.filter((l) => l.amount > 0).map((l) => l.id),
        confidence,
        dollarsAtStake: unitPrice != null ? round2((totalUnits - lookup.mue) * unitPrice) : null,
        citations: cite('S20'),
      }),
    );
  }
  return { findings };
}
