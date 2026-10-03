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

  // Q1 fix: a GFE entry is compared only with the lines it belongs to. Before, any GFE whose provider wasn't a
  // line provider fell back to the whole bill, so with two estimates (facility + anesthesia) the smaller one was
  // "exceeded" by the other provider's bill, at High confidence.
  const header = norm(bill.header.providerName);
  const linesFor = (provider: string): BillLine[] => {
    const exact = byProvider.get(provider);
    if (exact) return exact;
    const p = norm(provider);
    for (const [k, ls] of byProvider) if (k !== '(unspecified)' && sameProvider(norm(k), p)) return ls;
    if (byProvider.size !== 1) return [];
    const only = [...byProvider.values()][0]!;
    // One estimate: compare it with the whole bill, as before. Several: only the one the bill's provider names.
    if (ctx.gfe!.length === 1) return only;
    return header && sameProvider(header, p) ? only : [];
  };

  const findings: Finding[] = [];
  const unmatched: string[] = [];
  for (const gfe of ctx.gfe!) {
    const lines = linesFor(gfe.provider);
    if (lines.length === 0) { unmatched.push(gfe.provider); continue; }
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
  if (findings.length === 0 && unmatched.length === ctx.gfe!.length && ctx.gfe!.length > 1) {
    return { findings, skipped: { ruleId: id, needs: ['the provider name on this bill, matching one of your Good Faith Estimates'] } };
  }
  return { findings };
}

const SUFFIX = /\b(llc|pllc|inc|pc|pa|ltd|corp|co|the)\b/g;
function norm(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();
}
function sameProvider(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a)));
}
