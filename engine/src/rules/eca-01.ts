import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { addDays, mkFinding } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'ECA-01';

export function evaluate(_bill: Bill, ctx: Context, data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const hospital = ctx.hospitalCcn && data.hospital ? data.hospital(ctx.hospitalCcn) : undefined;
  if (!hospital) {
    return { findings: [], skipped: { ruleId: id, needs: ["the hospital's nonprofit status (look it up by name or CCN)"] } };
  }
  if (hospital.ownershipCategory !== 'nonprofit') return { findings: [] };
  const needs: string[] = [];
  if (!ctx.firstPostDischargeStatementDate) needs.push('the date of your first post-discharge statement');
  if (!ctx.collections) needs.push('any collection, credit-reporting or legal action dates');
  if (needs.length > 0) return { findings: [], skipped: { ruleId: id, needs } };

  const cutoff = addDays(ctx.firstPostDischargeStatementDate!, 120);
  const reasons: string[] = [];
  const evidenceDates: string[] = [];
  for (const ev of ctx.collections!) {
    if (ev.date < cutoff) {
      reasons.push(`a ${ev.kind.replace('_', ' ')} action on ${ev.date}, before the 120-day waiting period ended (${cutoff})`);
      evidenceDates.push(ev.date);
    } else if (!ev.noticeDate) {
      reasons.push(`a ${ev.kind.replace('_', ' ')} action on ${ev.date} with no recorded 30-day written notice`);
      evidenceDates.push(ev.date);
    }
    if (ctx.fapApplied === true && ctx.fapAppliedDate && ev.date >= ctx.fapAppliedDate) {
      reasons.push(`a ${ev.kind.replace('_', ' ')} action on ${ev.date} while your financial-assistance application was pending`);
      evidenceDates.push(ev.date);
    }
  }
  if (reasons.length === 0) return { findings: [] };

  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: evidenceDates.join(','),
        title: 'Possible early or improper collection action by a nonprofit hospital',
        why: reasons.join('; '),
        userText: "Nonprofit hospitals must wait at least 120 days and give 30 days' written notice before actions like credit reporting, and must pause them while your assistance application is pending.",
        verify: "Ask the hospital's billing office for your financial-assistance policy and the dates they sent notices.",
        evidenceLineIds: [],
        confidence: 'medium',
        dollarsAtStake: null,
        citations: cite('S12', 'S14'),
      }),
    ],
  };
}
