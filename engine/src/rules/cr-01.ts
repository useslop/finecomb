import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { daysBetween, mkFinding } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'CR-01';

export function evaluate(_bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  if (ctx.onCreditReport === undefined) {
    return { findings: [], skipped: { ruleId: id, needs: ['whether this debt is on your credit report'] } };
  }
  if (ctx.onCreditReport !== true) return { findings: [] };

  let reason: string | null = null;
  if (ctx.paidInFull === true) {
    reason = 'the three credit bureaus say they do not report medical collections that have been paid in full';
  } else if (ctx.originalBalance != null && ctx.originalBalance < 500) {
    reason = 'the three credit bureaus say they do not report medical collection debt with an initial balance under $500';
  } else if (ctx.firstPostDischargeStatementDate && daysBetween(ctx.firstPostDischargeStatementDate, ctx.today) < 365) {
    reason = 'the three credit bureaus say they wait at least a year before reporting unpaid medical debt';
  }
  if (!reason) return { findings: [] };

  const stateLine = ctx.state
    ? ` Some states also restrict medical-debt reporting or collections; check ${ctx.state}'s rules (federal law may limit how far state bans reach).`
    : '';

  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: 'credit-report',
        title: 'This may not belong on your credit report',
        why: `You said this is on your credit report, and ${reason}.`,
        userText: `The three credit bureaus say they don't report paid medical collections, those under $500, or those under a year old.${stateLine}`,
        verify: "Dispute the tradeline with the credit bureau; file a CFPB complaint if it isn't corrected.",
        evidenceLineIds: [],
        confidence: 'medium',
        dollarsAtStake: null,
        citations: cite('CRB2023'),
      }),
    ],
  };
}
