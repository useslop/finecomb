import type { Citation, Context, Datasets, ISODate, Money } from './types.js';
import { addDays, daysBetween } from './lib/util.js';
import { cite } from './citations.js';

// Charity-care and assistance screener — SPEC.md §4. Pure function: every input (context,
// datasets, the FPL guideline doc, the state-charity table) is passed in; no fetches here.
// The app loads engine/data/state-charity.json and data/out/fpl-2026.json and passes them through.

export interface FplRegion {
  base: number;
  increment: number;
  bySize?: Record<string, number>;
}
export interface FplDoc {
  year: number;
  guidelines: {
    '48states_dc': FplRegion;
    alaska: FplRegion;
    hawaii: FplRegion;
  };
}

/** How a state's mandate actually works — matters for honest wording. */
export type StateMechanism = 'discount' | 'cost_cap' | 'collection_bar' | 'flat_discount';

export interface StateCharityRow {
  state: string;
  hasMandate: boolean;
  verified: boolean;
  mechanism: StateMechanism;
  mandateMaxPct: number | null; // highest FPL% at which *some* mandated tier applies anywhere in the law; null if not FPL-based
  summary: string;
  who: string;
  hospitalsCovered: string;
  citation: string;
  sourceUrl: string;
  caveats: string[];
  effectiveDate?: ISODate; // set when the law is not yet in force
}
export interface StateCharityDoc {
  asOf: ISODate;
  source: string;
  states: Record<string, StateCharityRow>;
}
/** Back-compat alias: CONTRACT.md names the 4th `screen()` arg `stateCharity`. */
export type StateCharityTable = StateCharityDoc;

export type ScreenerWording = 'may_qualify' | 'worth_asking' | 'less_likely';

export interface HospitalScreen {
  name?: string;
  ownership?: string;
  ownershipCategory: 'nonprofit' | 'government' | 'proprietary' | 'other' | 'unknown';
  message: string;
  citations: Citation[];
}
export interface StateScreen {
  state: string;
  found: boolean;
  verified: boolean;
  message: string;
  summary: string;
  caveats: string[];
  citation: string;
  sourceUrl: string;
  notYetEffective?: ISODate;
}
export interface TimingScreen {
  message: string;
  deadline: ISODate | null;
  citations: Citation[];
}
export interface ScreenerProgram {
  id: string;
  title: string;
  detail: string;
  link?: string;
  citations: Citation[];
}
export interface ScreenerDeadline {
  id: string;
  label: string;
  date: ISODate;
  note: string;
}
export interface ScreenResult {
  fplPercent: number | null;
  wording: ScreenerWording;
  wordingText: string;
  wordingCitations: Citation[];
  hospital: HospitalScreen | null;
  stateScreen: StateScreen | null;
  timing501r: TimingScreen;
  medicaid: { message: string; citations: Citation[] };
  marketplace: { message: string; citations: Citation[] };
  programs: ScreenerProgram[];
  deadlines: ScreenerDeadline[];
}

// 2026 HHS poverty guideline fallback (SPEC §4), used only if no `fpl` doc is supplied.
const FALLBACK_FPL: Record<'48states_dc' | 'alaska' | 'hawaii', FplRegion> = {
  '48states_dc': { base: 15_960, increment: 5_680 },
  alaska: { base: 19_950, increment: 7_100 },
  hawaii: { base: 18_360, increment: 6_530 },
};

function regionFor(state: string | undefined): 'alaska' | 'hawaii' | '48states_dc' {
  if (state === 'AK') return 'alaska';
  if (state === 'HI') return 'hawaii';
  return '48states_dc';
}

function guidelineAmount(fpl: FplDoc | null, state: string | undefined, size: number): number {
  const key = regionFor(state);
  const region = fpl?.guidelines?.[key] ?? FALLBACK_FPL[key];
  const exact = region.bySize?.[String(size)];
  if (exact != null) return exact;
  return region.base + Math.max(0, size - 1) * region.increment;
}

/** FPL % = annual household income ÷ guideline(n, region) × 100, rounded to 0.1%. */
export function fplPercent(ctx: Context, fpl: FplDoc | null): number | null {
  if (!ctx.householdSize || ctx.householdSize < 1 || ctx.annualIncome == null) return null;
  const guideline = guidelineAmount(fpl, ctx.state, ctx.householdSize);
  if (guideline <= 0) return null;
  return Math.round((ctx.annualIncome / guideline) * 1000) / 10;
}

function hospitalScreen(data: Datasets, ctx: Context): HospitalScreen | null {
  const hospital = ctx.hospitalCcn && data.hospital ? data.hospital(ctx.hospitalCcn) : undefined;
  if (!hospital) return null;
  const raw = hospital.ownership;
  if (hospital.ownershipCategory === 'nonprofit') {
    return {
      name: hospital.name,
      ownership: raw,
      ownershipCategory: 'nonprofit',
      message: `Likely a 501(c)(3) hospital (${raw}): federal 501(r) rules on financial assistance and billing apply. Confirm with the IRS Tax Exempt Organization Search.`,
      citations: cite('S9', 'S10'),
    };
  }
  if (hospital.ownershipCategory === 'government') {
    return {
      name: hospital.name,
      ownership: raw,
      ownershipCategory: 'government',
      message: `Public hospital (${raw}). Federal 501(r) rules apply only if it also has 501(c)(3) status. Most public hospitals still have an assistance policy, and your state's charity-care law may apply.`,
      citations: cite('S9'),
    };
  }
  if (hospital.ownershipCategory === 'proprietary') {
    if (/physician/i.test(raw)) {
      return {
        name: hospital.name,
        ownership: raw,
        ownershipCategory: 'proprietary',
        message: `Physician-owned, for-profit hospital (${raw}). Federal 501(r) rules don't apply; your state's law may, and it still costs nothing to ask about a self-pay or hardship discount.`,
        citations: [],
      };
    }
    return {
      name: hospital.name,
      ownership: raw,
      ownershipCategory: 'proprietary',
      message: `For-profit hospital (${raw}). Federal 501(r) rules don't apply; your state's charity-care law may still apply.`,
      citations: [],
    };
  }
  if (/tribal/i.test(raw)) {
    return {
      name: hospital.name,
      ownership: raw,
      ownershipCategory: 'other',
      message: `Tribal hospital (${raw}). 501(r) generally doesn't apply; ask about Indian Health Service or tribal assistance programs instead.`,
      citations: [],
    };
  }
  if (/veterans|defense/i.test(raw)) {
    return {
      name: hospital.name,
      ownership: raw,
      ownershipCategory: 'other',
      message: `Federal military/VA hospital (${raw}). 501(r) and state charity-care law generally don't apply; ask about VA or military financial-hardship programs instead.`,
      citations: [],
    };
  }
  return {
    name: hospital.name,
    ownership: raw,
    ownershipCategory: 'other',
    message: `Ownership type: ${raw}. Check this hospital's billing statements or website for a financial assistance policy.`,
    citations: [],
  };
}

function stateScreen(ctx: Context, stateCharity: StateCharityDoc | null): StateScreen | null {
  if (!ctx.state) return null;
  const row = stateCharity?.states?.[ctx.state];
  if (!row) {
    return {
      state: ctx.state,
      found: false,
      verified: false,
      message: `We haven't researched ${ctx.state}'s charity-care law yet. Ask the hospital for its Financial Assistance Policy — most hospitals (especially nonprofits) have one regardless of state law.`,
      summary: '',
      caveats: [],
      citation: '',
      sourceUrl: '',
    };
  }
  let message: string;
  if (row.effectiveDate && row.effectiveDate > ctx.today) {
    message = `${row.state}'s law isn't in effect yet (starts ${row.effectiveDate}), but it's worth asking the hospital what it already offers.`;
  } else if (!row.hasMandate) {
    message = `${row.state} has no confirmed FPL-based mandate. ${row.summary}`;
  } else if (row.mechanism === 'collection_bar') {
    message = `${row.state} law blocks collection actions rather than mandating a discount. ${row.summary}`;
  } else {
    message = row.summary;
  }
  return {
    state: row.state,
    found: true,
    verified: row.verified,
    message,
    summary: row.summary,
    caveats: row.caveats,
    citation: row.citation,
    sourceUrl: row.sourceUrl,
    notYetEffective: row.effectiveDate && row.effectiveDate > ctx.today ? row.effectiveDate : undefined,
  };
}

/** 501(r) application-period timing (26 CFR 1.501(r)-1(b)(3)): the 240-day post-discharge-statement window. */
function timing501r(ctx: Context, hospital: HospitalScreen | null): TimingScreen {
  if (!ctx.firstPostDischargeStatementDate) {
    return {
      message: 'Add the date of your first post-discharge billing statement to see your financial-assistance application deadline.',
      deadline: null,
      citations: cite('S13'),
    };
  }
  const deadline = addDays(ctx.firstPostDischargeStatementDate, 240);
  const elapsed = daysBetween(ctx.firstPostDischargeStatementDate, ctx.today);
  const nonprofit = hospital?.ownershipCategory === 'nonprofit';
  if (elapsed <= 240) {
    return {
      message: `${nonprofit ? 'This nonprofit hospital' : 'If this is a nonprofit hospital, it'} must accept and process a financial-assistance application now — you're within the 240-day window that ends ${deadline}.`,
      deadline,
      citations: cite('S12', 'S13', 'S14'),
    };
  }
  return {
    message: `The standard 240-day window (which ended ${deadline}) has passed, but hospitals may still choose to accept a late application — it costs nothing to ask.`,
    deadline,
    citations: cite('S13'),
  };
}

function medicaidMessage(ctx: Context): { message: string; citations: Citation[] } {
  const before2027 = ctx.today < '2027-01-01';
  return {
    message:
      "If you're uninsured, apply for Medicaid now — it can cover care from before you applied. " +
      (before2027
        ? 'Today, that retroactive window can reach back up to 3 months before your application month. '
        : '') +
      'For applications filed on or after 2027-01-01, the window shrinks to 1 calendar month before for expansion adults, or 2 months before for everyone else — so applying before 2027 may preserve more retroactive coverage.',
    citations: cite('PL11921', 'CMSCIB2025'),
  };
}

function marketplaceMessage(): { message: string; citations: Citation[] } {
  return {
    message:
      'If you have a qualifying life event (e.g., losing other coverage, marriage, a new dependent), you can enroll in an ACA Marketplace plan through a special enrollment period outside open enrollment. ' +
      "Note: starting with plan year 2026, enrolling through the income-based special enrollment period (based on expected low income alone, with no other qualifying event) no longer qualifies you for premium tax credits.",
    citations: cite('S31', 'PL11921'),
  };
}

const PROGRAMS: ScreenerProgram[] = [
  {
    id: 'dollar-for',
    title: 'Dollar For',
    detail: 'Free, donor-funded help applying for hospital financial assistance (charity care).',
    link: 'https://dollarfor.org',
    citations: cite('S32'),
  },
  {
    id: 'healthwell',
    title: 'HealthWell Foundation',
    detail: 'For insured patients with a covered disease (income limits vary by fund): help with copays, premiums, deductibles and other out-of-pocket costs. Some disease funds close when exhausted.',
    link: 'https://www.healthwellfoundation.org',
    citations: cite('S33'),
  },
  {
    id: 'pan-foundation',
    title: 'PAN Foundation',
    detail: 'Copay and out-of-pocket help for insured patients with specific diseases; funds open and close.',
    link: 'https://www.panfoundation.org',
    citations: cite('S37'),
  },
  {
    id: 'paf',
    title: 'Patient Advocate Foundation',
    detail: 'Free case management plus co-pay relief and financial-aid funds for chronic or serious illness.',
    link: 'https://www.patientadvocate.org',
    citations: cite('S38'),
  },
  {
    id: 'undue-medical-debt',
    title: 'Undue Medical Debt',
    detail: 'Buys medical debt in bulk and abolishes it. You generally can\'t apply directly — relief arrives by letter if your debt is bought.',
    link: 'https://unduemedicaldebt.org',
    citations: cite('S36'),
  },
  {
    id: 'state-cap',
    title: 'Your state Consumer Assistance Program',
    detail: 'For insured people with plan problems: appeals, complaints and enrollment help, funded by CMS.',
    link: 'https://www.cms.gov/cciio/resources/consumer-assistance-grants',
    citations: cite('S30'),
  },
  {
    id: '211',
    title: '211',
    detail: 'Local help with utilities, food and health programs — call 2-1-1 or search online.',
    link: 'https://www.211.org',
    citations: cite('S34'),
  },
];

function deadlines(ctx: Context): ScreenerDeadline[] {
  const out: ScreenerDeadline[] = [];
  if (ctx.firstBillDate) {
    out.push({
      id: 'ppdr-120',
      label: 'Federal bill dispute (PPDR) — file within 120 days of your first bill',
      date: addDays(ctx.firstBillDate, 120),
      note: 'Only applies if you\'re uninsured/self-pay and your bill is $400+ over your Good Faith Estimate.',
    });
  }
  if (ctx.firstPostDischargeStatementDate) {
    out.push({
      id: 'fap-240',
      label: "Nonprofit hospital's financial-assistance application window",
      date: addDays(ctx.firstPostDischargeStatementDate, 240),
      note: 'The hospital must accept and process applications filed by this date; it may still accept later ones.',
    });
    out.push({
      id: 'eca-120',
      label: 'Earliest a nonprofit hospital may start collection actions (ECAs)',
      date: addDays(ctx.firstPostDischargeStatementDate, 120),
      note: 'No ECA is allowed before this date, and the hospital must also give 30 days\' written notice first.',
    });
  }
  return out;
}

/** Who each verified state law covers beyond income, read from its `who` and `hospitalsCovered`
 * text in state-charity.json. "May qualify" needs every condition confirmed by the user's answers;
 * a state missing here never gets "may qualify". `unconfirmable` = a condition the screener doesn't
 * ask about (so the result stays "worth asking" and names it). */
interface LawConditionSpec {
  insurance: 'any' | 'uninsured';
  resident: boolean;
  hospital: 'in_state' | 'nonprofit_in_state';
  unconfirmable?: string;
}
export const LAW_CONDITIONS: Record<string, LawConditionSpec> = {
  WA: { insurance: 'any', resident: false, hospital: 'in_state' },
  // Insured patients count only with "high medical costs" (over 10% of family income), which the screener doesn't ask.
  CA: { insurance: 'uninsured', resident: false, hospital: 'in_state' },
  NY: { insurance: 'uninsured', resident: false, hospital: 'in_state' },
  IL: { insurance: 'uninsured', resident: true, hospital: 'in_state' },
  MD: { insurance: 'any', resident: false, hospital: 'in_state' },
  // The 115% cap: any uninsured NJ resident under 500% FPL.
  NJ: { insurance: 'uninsured', resident: true, hospital: 'in_state' },
  CO: { insurance: 'any', resident: true, hospital: 'in_state' },
  // The discount tiers bind nonprofit hospitals only.
  OR: { insurance: 'any', resident: false, hospital: 'nonprofit_in_state' },
  CT: { insurance: 'uninsured', resident: false, hospital: 'in_state', unconfirmable: 'that you applied for Medicaid and were denied' },
  MA: { insurance: 'any', resident: true, hospital: 'in_state' },
  RI: { insurance: 'uninsured', resident: true, hospital: 'in_state', unconfirmable: "that you aren't eligible for state, federal or employer coverage" },
  ME: { insurance: 'uninsured', resident: true, hospital: 'in_state', unconfirmable: "that you aren't eligible for public coverage" },
  NM: { insurance: 'any', resident: false, hospital: 'in_state' },
  DE: { insurance: 'any', resident: true, hospital: 'in_state' },
};

function lawConditions(row: StateCharityRow, ctx: Context, data: Datasets, pct: number): { met: string[]; unmet: string[] } {
  const met = [`household income about ${pct}% of the federal poverty guideline (the law reaches ${row.mandateMaxPct}%)`];
  const unmet: string[] = [];
  const spec = LAW_CONDITIONS[row.state];
  if (!spec) return { met, unmet: [`the conditions in ${row.citation}, which this screener doesn't check yet`] };

  if (spec.insurance === 'uninsured') {
    if (ctx.insurance === 'none') met.push('no health insurance');
    else unmet.push(ctx.insurance ? 'no health insurance (you said you have coverage)' : 'no health insurance (you haven\'t said)');
  }
  if (spec.resident) {
    if (ctx.stateResident === true) met.push(`you live in ${row.state}`);
    else unmet.push(`that you live in ${row.state}`);
  }
  const h = ctx.hospitalCcn && data.hospital ? data.hospital(ctx.hospitalCcn) : undefined;
  const nonprofit = spec.hospital === 'nonprofit_in_state';
  const hospitalLabel = `${nonprofit ? 'a nonprofit hospital' : 'a hospital'} in ${row.state}`;
  if (!h) unmet.push(`${hospitalLabel} (pick your hospital above)`);
  else if (h.state !== row.state) unmet.push(`${hospitalLabel} (${h.name} is in ${h.state})`);
  else if (nonprofit && h.ownershipCategory !== 'nonprofit') unmet.push(`${hospitalLabel} (${h.name} isn't listed as nonprofit)`);
  else met.push(`${h.name} is ${hospitalLabel}`);
  if (spec.unconfirmable) unmet.push(spec.unconfirmable);
  return { met, unmet };
}

export function screen(
  ctx: Context,
  data: Datasets,
  fpl: FplDoc | null,
  stateCharity: StateCharityDoc | null,
): ScreenResult {
  const pct = fplPercent(ctx, fpl);
  const hospital = hospitalScreen(data, ctx);
  const state = stateScreen(ctx, stateCharity);
  const stateRow = ctx.state ? stateCharity?.states?.[ctx.state] : undefined;

  const stateMandateApplies = (() => {
    if (!stateRow || pct == null) return false;
    if (stateRow.hasMandate !== true || stateRow.mandateMaxPct == null) return false;
    if (stateRow.effectiveDate && stateRow.effectiveDate > ctx.today) return false;
    return pct <= stateRow.mandateMaxPct;
  })();
  const conditions = stateMandateApplies && stateRow!.verified ? lawConditions(stateRow!, ctx, data, pct!) : null;

  let wording: ScreenerWording;
  let wordingText: string;
  let wordingCitations: Citation[] = [];

  if (conditions && conditions.unmet.length === 0) {
    wording = 'may_qualify';
    wordingText = `You may qualify for ${stateRow!.mechanism === 'collection_bar' ? 'protection from collection actions' : 'free or discounted care'} under ${stateRow!.state}'s law (${stateRow!.citation}). Your answers meet each condition it sets: ${conditions.met.join('; ')}. The hospital makes the decision, so apply in writing.`;
    wordingCitations = [];
  } else if (conditions) {
    wording = 'worth_asking';
    wordingText = `Worth asking: your income is under ${stateRow!.state}'s threshold (${stateRow!.citation}), but the law also requires ${conditions.unmet.join('; ')}, and your answers don't confirm ${conditions.unmet.length === 1 ? 'it' : 'all of them'}.${conditions.met.length > 1 ? ` Met: ${conditions.met.join('; ')}.` : ''}`;
  } else if (
    hospital?.ownershipCategory === 'nonprofit' ||
    (pct != null && pct <= 400) ||
    stateMandateApplies
  ) {
    wording = 'worth_asking';
    wordingText = "Worth asking: nonprofit hospitals must offer financial assistance, and/or your income may fall under a state or hospital assistance threshold.";
  } else {
    wording = 'less_likely';
    wordingText = "Less likely to be mandated based on what you've told us, but it costs nothing to ask — many hospitals offer help regardless of these thresholds.";
  }

  return {
    fplPercent: pct,
    wording,
    wordingText,
    wordingCitations,
    hospital,
    stateScreen: state,
    timing501r: timing501r(ctx, hospital),
    medicaid: medicaidMessage(ctx),
    marketplace: marketplaceMessage(),
    programs: PROGRAMS,
    deadlines: deadlines(ctx),
  };
}
