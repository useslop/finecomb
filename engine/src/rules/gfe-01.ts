import type { Bill, BillLine, Context, Datasets, Finding, Skipped } from '../types.js';
import { addDays, daysBetween, mkFinding, round2, sum } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'GFE-01';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (ctx.insurance === undefined) {
    return { findings: [], skipped: { ruleId: id, needs: ['your insurance status'] } };
  }
  if (ctx.insurance !== 'none') return { findings: [] };
  const needs: string[] = [];
  if (!ctx.gfe || ctx.gfe.length === 0) needs.push('your Good Faith Estimate totals, per provider');
  if (!ctx.firstBillDate) needs.push('the date of your first bill');
  if (needs.length > 0) return { findings: [], skipped: { ruleId: id, needs } };

  const daysSinceFirstBill = daysBetween(ctx.firstBillDate!, ctx.today);
  if (daysSinceFirstBill > 120) return { findings: [] };

  const byProvider = new Map<string, BillLine[]>();
  for (const l of bill.lines) {
    const key = l.provider ?? '(unspecified)';
    const arr = byProvider.get(key) ?? [];
    arr.push(l);
    byProvider.set(key, arr);
  }

  const findings: Finding[] = [];
  for (const gfe of ctx.gfe!) {
    const lines = byProvider.get(gfe.provider) ?? (byProvider.size === 1 ? [...byProvider.values()][0]! : []);
    if (lines.length === 0) continue;
    const billed = sum(lines.map((l) => l.amount));
    const gap = round2(billed - gfe.total);
    if (gap < 400) continue;
    const deadline = addDays(ctx.firstBillDate!, 120);
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: gfe.provider,
        title: `${gfe.provider} billed well over its Good Faith Estimate`,
        why: `${gfe.provider} estimated $${gfe.total.toFixed(2)} and billed $${billed.toFixed(2)}, a gap of $${gap.toFixed(2)}.`,
        userText: `${gfe.provider} billed $${gap.toFixed(2)} more than its Good Faith Estimate. You may be able to file a federal dispute ($25 fee) by ${deadline}.`,
        verify: 'File a patient-provider dispute at cms.gov before the 120-day deadline.',
        evidenceLineIds: lines.map((l) => l.id),
        confidence: 'high',
        dollarsAtStake: gap,
        citations: cite('S4', 'S3'),
      }),
    );
  }
  return { findings };
}
