import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'PPDR-01';

export function evaluate(_bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const needs: string[] = [];
  if (!ctx.ppdrFiledDate) needs.push('the date you filed your federal bill dispute (PPDR)');
  if (!ctx.collections) needs.push('any collections or late-fee dates');
  if (needs.length > 0) return { findings: [], skipped: { ruleId: id, needs } };

  const during = ctx.collections!.filter((ev) => ev.date >= ctx.ppdrFiledDate!);
  if (during.length === 0) return { findings: [] };

  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: during.map((e) => e.date).join(','),
        title: 'Collection or late-fee activity during your federal bill dispute',
        why: `${during.length} event(s) occurred on or after your dispute filing date (${ctx.ppdrFiledDate}).`,
        userText: "During a federal bill dispute, providers can't send the bill to collections and must suspend late fees.",
        verify: 'Contact the provider and cite your PPDR case; escalate to the No Surprises Help Desk if needed.',
        evidenceLineIds: [],
        confidence: 'high',
        dollarsAtStake: null,
        citations: cite('S4', 'S3'),
      }),
    ],
  };
}
