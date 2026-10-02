import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { addDays, daysBetween, mkFinding } from '../lib/util.js';
import type { CollectionEvent } from '../types.js';
import { cite } from '../citations.js';

export const id = 'ECA-01';

// Extraordinary collection actions under 26 CFR 1.501(r)-6(b) (RESEARCH §ECA): credit reporting and
// actions needing a legal or judicial process (suits, liens, garnishment). Referral to a collection agency
// and late fees are not ECAs on their own, so they are not judged by the 120-day and notice tests.
const ECA_KINDS = new Set<CollectionEvent['kind']>(['credit_report', 'lawsuit', 'wage_garnishment']);
const NOTICE_DAYS = 30;

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
    if (!ECA_KINDS.has(ev.kind)) continue;
    const what = `a ${ev.kind.replace('_', ' ')} action on ${ev.date}`;
    const before = reasons.length;
    if (ev.date < cutoff) {
      reasons.push(`${what}, before the 120-day waiting period ended (${cutoff})`);
    } else if (!ev.noticeDate) {
      reasons.push(`${what} with no recorded 30-day written notice`);
    } else if (daysBetween(ev.noticeDate, ev.date) < NOTICE_DAYS) {
      reasons.push(`${what}, only ${daysBetween(ev.noticeDate, ev.date)} days after the written notice (${ev.noticeDate}); the notice must come at least ${NOTICE_DAYS} days ahead`);
    }
    if (ctx.fapApplied === true && ctx.fapAppliedDate && ev.date >= ctx.fapAppliedDate) {
      reasons.push(`${what} while your financial-assistance application was pending`);
    }
    if (reasons.length > before) evidenceDates.push(ev.date);
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
