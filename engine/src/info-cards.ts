import type { Bill, Context, Datasets, Finding } from './types.js';
import { isFacilityFeeLine, mkFinding } from './lib/util.js';
import { cite } from './citations.js';

function estimateFplPercent(ctx: Context): number | null {
  if (!ctx.householdSize || ctx.annualIncome == null) return null;
  const region = ctx.state === 'AK'
    ? { base: 19_950, inc: 7_100 }
    : ctx.state === 'HI'
      ? { base: 18_360, inc: 6_530 }
      : { base: 15_960, inc: 5_680 };
  const guideline = region.base + Math.max(0, ctx.householdSize - 1) * region.inc;
  return Math.round((ctx.annualIncome / guideline) * 1000) / 10;
}

/** Always-on nudge toward the charity-care screener; the full FPL/state logic lives in B4's screener. */
export function fap01(_bill: Bill, ctx: Context, data: Datasets): Finding | null {
  const hospital = ctx.hospitalCcn && data.hospital ? data.hospital(ctx.hospitalCcn) : undefined;
  const fpl = estimateFplPercent(ctx);
  const nonprofit = hospital?.ownershipCategory === 'nonprofit';
  const lowIncome = fpl != null && fpl <= 400;
  const strong = nonprofit || lowIncome;
  const clearlyNot = hospital !== undefined && hospital.ownershipCategory !== 'nonprofit' && fpl != null && fpl > 400;
  if (clearlyNot) return null;
  return mkFinding({
    ruleId: 'FAP-01',
    discriminator: 'fap',
    title: 'Check charity care and financial assistance',
    // Q1: "may qualify" is reserved for verified mandated thresholds (the screener); this card only says "worth asking".
    why: strong
      ? [nonprofit && 'Nonprofit hospitals must have a written financial assistance policy.',
         lowIncome && "Your household income is at or under 400% of the federal poverty guideline, a range many hospitals' assistance policies cover."]
          .filter(Boolean).join(' ')
      : 'Many hospitals offer financial assistance regardless of insurance status; it costs nothing to ask.',
    userText: strong
      ? 'Worth asking: ask this hospital for its financial assistance (charity care) policy, and check the charity-care screener.'
      : 'Less likely to be required, but worth asking: check the charity-care screener.',
    verify: "Open the charity-care screener and, if available, ask the hospital for its Financial Assistance Policy.",
    evidenceLineIds: [],
    confidence: 'info',
    dollarsAtStake: null,
    citations: [],
  });
}

/** Always-on identity checklist; never skipped since it needs no bill-specific input. */
export function id01(): Finding {
  return mkFinding({
    ruleId: 'ID-01',
    discriminator: 'checklist',
    title: 'Double-check your identifying details',
    why: 'Wrong patient or insurance details are a common cause of denials that get shifted to you.',
    userText: 'Compare your name, date of birth, insurance member ID and group number on this bill against your insurance card.',
    verify: 'Request your billing records (HIPAA right of access) if anything looks off.',
    evidenceLineIds: [],
    confidence: 'info',
    dollarsAtStake: null,
    citations: cite('S15', 'S16'),
  });
}

export function fac01(bill: Bill): Finding | null {
  const lines = bill.lines.filter(isFacilityFeeLine);
  if (lines.length === 0) return null;
  return mkFinding({
    ruleId: 'FAC-01',
    discriminator: lines.map((l) => l.id).join(','),
    title: 'Facility fee on this bill',
    why: 'A facility fee can apply even for a routine office or telehealth visit at a hospital-owned clinic.',
    userText: 'This bill includes a facility fee. These are often legitimate, but ask what it covers and whether it applies to your visit type.',
    verify: 'Ask the billing office what the facility fee covers and whether the location is hospital-owned.',
    evidenceLineIds: lines.map((l) => l.id),
    confidence: 'info',
    dollarsAtStake: null,
    citations: cite('S41'),
  });
}
