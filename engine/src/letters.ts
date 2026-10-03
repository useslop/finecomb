import type { Bill, Context, Finding, Money } from './types.js';
import { addDays, round2, sum } from './lib/util.js';

// Letter templates L1-L7 — LETTERS.md. Pure string rendering: no I/O, no network. Anything the
// letter needs that isn't on Bill/Context (free-text answers, or a value the app already computed
// from the screener, like FPL% or hospital nonprofit status) comes in through `user`.

export type LetterId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';
export type NsaScenario = 'emergency' | 'ancillary_in_network_facility' | 'air_ambulance';
export type L6Issue = 'balance_exceeds_eob' | 'provider_liability_billed' | 'not_processed_in_network' | 'wrong_member_info' | 'other';

export interface LetterUser {
  // Common, not on Bill/Context.
  patientDob?: string;
  patientAddress?: string;
  guarantorName?: string;
  phone?: string;
  email?: string;
  providerBillingAddress?: string;
  memberId?: string;
  groupNumber?: string;
  claimNumber?: string;
  // Pre-computed by the app from screen() — letters.ts takes no Datasets, so these are supplied.
  isNonprofit501r?: boolean;
  fplPercent?: number;
  stateLawSentence?: string;
  // L1
  stateItemizedLawSentence?: string;
  // L2
  recordsRequested?: string;
  // L3
  enclosures?: string;
  // L4
  scenario?: NsaScenario;
  facilityName?: string;
  clinicianType?: string;
  amountOver?: Money;
  // L5
  gfeDate?: string;
  // L6
  eobDate?: string;
  issue?: L6Issue;
  issueDetails?: string;
  requestedAction?: string;
  // L7
  recordsList?: string;
  format?: string;
  deliverTo?: string;
}

export interface RenderLetterArgs {
  bill: Bill;
  ctx: Context;
  findings: Finding[]; // the findings the user selected to dispute (L2's loop)
  user?: LetterUser;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateLong(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return iso;
  const [y, m, d] = parts as [number, number, number];
  const month = MONTHS[m - 1];
  if (!month) return iso;
  return `${month} ${d}, ${y}`;
}

function money(n: Money | null | undefined): string | undefined {
  if (n == null) return undefined;
  const [whole, cents] = Math.abs(n).toFixed(2).split('.') as [string, string];
  return `${n < 0 ? '-' : ''}$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
}

/** Rule text writes amounts as `$4600.00`; letters use `$4,600.00`. */
function withCommas(text: string): string {
  return text.replace(/\$(\d{4,})(\.\d{2})?\b/g, (_m, whole: string, cents?: string) =>
    `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${cents ?? ''}`,
  );
}

/** Missing required fields become `[Label]`, per the brief — never silently blank. */
function req(value: string | undefined | null, label: string): string {
  const v = value?.toString().trim();
  return v ? v : `[${label}]`;
}

function datesOfService(bill: Bill): string | undefined {
  const { admitDate, dischargeDate } = bill.header;
  if (admitDate && dischargeDate && admitDate !== dischargeDate) {
    return `${formatDateLong(admitDate)} to ${formatDateLong(dischargeDate)}`;
  }
  if (admitDate) return formatDateLong(admitDate);
  const dates = bill.lines.map((l) => l.date).filter((d): d is string => Boolean(d)).sort();
  if (dates.length === 0) return undefined;
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  return first === last ? formatDateLong(first) : `${formatDateLong(first)} to ${formatDateLong(last)}`;
}

/** Splits a finding's public-facing text into "what's wrong" and "what I'm asking for", since the
 * engine stores one combined sentence (e.g. "...Ask them to remove the extra day(s) ($200)."). */
function splitIssueRequest(f: Finding): { issuePlain: string; requestPlain: string } {
  const text = f.userText || f.why;
  // [^.]* alone would stop at the first decimal point in a dollar amount (e.g. "$200.00"); allow
  // a period through when it's immediately followed by a digit, so only the true sentence end matches.
  const m = /^(.*?)\s*((?:Ask|Please ask)\b(?:[^.]|\.(?=\d))*\.)\s*$/is.exec(text);
  if (m && m[2]) {
    const issuePlain = m[1]?.trim() || f.why;
    const requestPlain = m[2]
      .replace(/^Ask\s+(?:them\s+to\s+|whether\s+|for\s+|why\s+)?/i, '')
      .replace(/^./, (c) => c.toLowerCase());
    return { issuePlain, requestPlain };
  }
  // f.verify is written to the user ("Ask the hospital..."), not to the provider.
  return { issuePlain: text, requestPlain: 'review this item and correct it, or explain it in writing.' };
}

interface CommonFields {
  today: string;
  patientName: string;
  patientDob: string;
  patientAddress: string;
  guarantorName: string;
  phone: string;
  email: string;
  providerName: string;
  providerBillingAddress: string;
  accountNumber: string;
  statementDate: string;
  datesOfService: string;
  totalBilled: string;
  balanceDue: string;
  insurerName: string;
  memberId: string;
  groupNumber: string;
  claimNumber: string;
}

function buildCommon(bill: Bill, ctx: Context, user: LetterUser): CommonFields {
  return {
    today: formatDateLong(ctx.today) ?? ctx.today,
    patientName: req(bill.header.patientName, 'Patient name'),
    patientDob: req(user.patientDob, 'Date of birth'),
    patientAddress: req(user.patientAddress, 'Your mailing address'),
    guarantorName: user.guarantorName?.trim() || bill.header.patientName?.trim() || '[Guarantor name]',
    phone: req(user.phone, 'Phone number'),
    email: user.email?.trim() ?? '',
    providerName: req(bill.header.providerName, 'Provider name'),
    providerBillingAddress: req(user.providerBillingAddress, "Provider's billing address"),
    accountNumber: req(bill.header.accountNumber, 'Account number'),
    statementDate: req(formatDateLong(bill.header.statementDate), 'Statement date'),
    datesOfService: req(datesOfService(bill), 'Dates of service'),
    totalBilled: money(bill.header.totalCharges) ?? '[Total billed]',
    balanceDue: money(bill.header.balanceDue) ?? '[Balance due]',
    insurerName: req(ctx.insurerName, 'Insurer name'),
    memberId: req(user.memberId, 'Member ID'),
    groupNumber: req(user.groupNumber, 'Group number'),
    claimNumber: req(user.claimNumber, 'Claim number'),
  };
}

const FOOTER = [
  '',
  'This letter was prepared with Finecomb, a free consumer tool. It is not legal advice.',
  'I am keeping a copy of this letter. Please reply in writing.',
].join('\n');

function l1(c: CommonFields, user: LetterUser): string {
  const stateSentence = user.stateItemizedLawSentence?.trim() ?? '';
  return `${c.today}

${c.providerName} — Billing Office
${c.providerBillingAddress}

Re: Itemized bill request — ${c.patientName}, DOB ${c.patientDob}, account ${c.accountNumber}, dates of service ${c.datesOfService}

Hello,

Please send me a complete itemized bill for the account above. For each charge, please list:
- the date of service;
- the billing code (CPT/HCPCS) and any modifiers;
- the revenue code;
- the National Drug Code (NDC) for each drug;
- the quantity or units;
- the unit price and line total;
- the department or provider.

Please also send copies of the claim forms you sent to my insurance (UB-04 and/or CMS-1500), and a record of all payments and adjustments on this account.

I am asking for these as part of my right to access my billing records under HIPAA. A provider's "designated record set" includes billing records (45 CFR 164.501), and you must act on my request within 30 days (45 CFR 164.524).${stateSentence ? ' ' + stateSentence : ''}

While I review the bill, please put this account on hold and do not send it to collections. Please send the records to ${c.patientAddress}${c.email ? ' or ' + c.email : ''}, in electronic form if possible.

Thank you,
${c.patientName} · ${c.phone}${FOOTER}`;
}

function l2(bill: Bill, c: CommonFields, findings: Finding[], user: LetterUser): string {
  const rows = findings.map((f) => {
    const line = bill.lines.find((l) => f.evidenceLineIds.includes(l.id));
    // Bill-level findings (EOB-01, MATH-02, ...) have no single line: use the bill's dates of service.
    const lineDate = formatDateLong(line?.date) ?? (c.datesOfService.startsWith('[') ? c.statementDate : c.datesOfService);
    const lineDescription = line?.description ?? f.title;
    const lineCode = line?.code ? ` (${line.code})` : '';
    const lineAmount = line?.amount != null ? money(line.amount) : f.dollarsAtStake != null ? money(f.dollarsAtStake) : undefined;
    const { issuePlain, requestPlain } = splitIssueRequest(f);
    return `- ${lineDate} — ${lineDescription}${lineCode}${lineAmount ? ` — ${lineAmount}` : ''}. ${withCommas(issuePlain)} I am asking you to: ${withCommas(requestPlain)}`;
  });
  const total = sum(findings.map((f) => f.dollarsAtStake));
  const recordsRequested = req(user.recordsRequested, 'the specific records that would help verify these charges');
  return `${c.today}

${c.providerName} — Billing Office / Patient Financial Services
${c.providerBillingAddress}

Re: Billing questions — ${c.patientName}, account ${c.accountNumber}, dates of service ${c.datesOfService}

Hello,

I reviewed my itemized bill dated ${c.statementDate} and have questions about the charges below. Each one may be an error. Please review them and correct the bill if needed.

${rows.length > 0 ? rows.join('\n') : '- [No findings were selected — add findings from your results page with "Add to dispute letter."]'}

${total > 0 ? `The total in question is ${money(total)}.\n\n` : ''}To help me check these charges, please also send ${recordsRequested}. I am asking for these under my HIPAA right of access (45 CFR 164.524).

Please send me a corrected itemized bill, or a written explanation for each item. Please do not send this account to collections or report it to a credit bureau while these questions are open.

Thank you,
${c.patientName} · ${c.phone}${FOOTER}`;
}

function l3(c: CommonFields, ctx: Context, user: LetterUser): string {
  const householdSize = ctx.householdSize != null ? String(ctx.householdSize) : '[household size]';
  const annualIncome = money(ctx.annualIncome) ?? '[annual income]';
  const fplPercent = user.fplPercent != null ? `${user.fplPercent}%` : '[percent]';
  const enclosures = req(user.enclosures, 'list your application and supporting documents');
  const stateLawSentence = user.stateLawSentence?.trim() ?? '';
  const isNonprofit = user.isNonprofit501r === true;
  const firstStatementDate = req(formatDateLong(ctx.firstPostDischargeStatementDate), 'first post-discharge statement date');

  const nonprofitBlock = isNonprofit
    ? `As a nonprofit hospital, you must accept and process financial assistance applications for at least 240 days after the first post-discharge bill. Mine was dated ${firstStatementDate} (26 CFR 1.501(r)-1). While my application is pending, please suspend all collection actions, including credit reporting, sale of the debt and lawsuits (26 CFR 1.501(r)-6). If I qualify, I understand that I cannot be charged more than the amounts generally billed to insured patients (IRS §501(r)(5)), and that payments above my share will be refunded.\n\n`
    : '';

  return `${c.today}

${c.providerName} — Financial Assistance / Charity Care
${c.providerBillingAddress}

Re: Financial assistance application — ${c.patientName}, account ${c.accountNumber}

Hello,

I am applying for financial assistance for the bill above. My household has ${householdSize} people and an annual income of about ${annualIncome} (about ${fplPercent} of the 2026 federal poverty guideline). My completed application and documents are enclosed: ${enclosures}.

If anything is missing, please tell me in writing what you need.

${nonprofitBlock}${stateLawSentence ? stateLawSentence + '\n\n' : ''}Please also send me your Financial Assistance Policy and its plain-language summary. Please send your decision in writing.

Thank you,
${c.patientName} · ${c.phone}${FOOTER}`;
}

function resolveScenario(ctx: Context, user: LetterUser): NsaScenario | undefined {
  if (user.scenario) return user.scenario;
  if (ctx.emergency) return 'emergency';
  if (ctx.airAmbulance) return 'air_ambulance';
  if (ctx.oonClinicianTypes && ctx.oonClinicianTypes.length > 0) return 'ancillary_in_network_facility';
  return undefined;
}

function l4(bill: Bill, c: CommonFields, ctx: Context, user: LetterUser): string {
  const scenario = resolveScenario(ctx, user);
  const facilityName = req(user.facilityName, 'facility name');
  const clinicianType = req(user.clinicianType ?? ctx.oonClinicianTypes?.[0], 'clinician type');
  const eobPr = money(ctx.eob?.patientResponsibility) ?? '[your in-network cost-sharing amount from the EOB]';
  const amountOver =
    money(user.amountOver) ??
    (ctx.eob?.patientResponsibility != null && bill.header.balanceDue != null
      ? money(round2(bill.header.balanceDue - ctx.eob.patientResponsibility))
      : undefined) ??
    '[amount over your cost-sharing]';

  let scenarioBlock: string;
  if (scenario === 'emergency') {
    scenarioBlock = 'This was emergency care. Under the No Surprises Act, out-of-network providers may not bill me more than my in-network cost-sharing for emergency services (45 CFR 149.410).';
  } else if (scenario === 'ancillary_in_network_facility') {
    scenarioBlock = `I received this care at ${facilityName}, an in-network facility, from a ${clinicianType}. Out-of-network ${clinicianType} services at an in-network facility are protected, and these providers cannot ask patients to waive that protection (45 CFR 149.420).`;
  } else if (scenario === 'air_ambulance') {
    scenarioBlock = 'This was an air ambulance service. The No Surprises Act limits my cost to in-network cost-sharing.';
  } else {
    scenarioBlock = '[Describe why this care is protected by the No Surprises Act: emergency care, an out-of-network ancillary clinician at an in-network facility, or air ambulance.]';
  }

  return `${c.today}

${c.providerName} — Billing Office · cc: ${c.insurerName}, Member Services

Re: Out-of-network bill protected by the No Surprises Act — ${c.patientName}, account ${c.accountNumber}, claim ${c.claimNumber}, date of service ${c.datesOfService}

Hello,

I received a bill for ${c.balanceDue}. My insurer's Explanation of Benefits says my share is ${eobPr}. You are billing me ${amountOver} more than that.

${scenarioBlock}

Please correct my bill to the in-network cost-sharing amount and refund any overpayment. Please do not send this bill to collections while it is resolved.

If this is not corrected, I will file a complaint with the No Surprises Help Desk (1-800-985-3059).

Thank you,
${c.patientName} · ${c.phone}${FOOTER}`;
}

function l5(bill: Bill, c: CommonFields, ctx: Context, user: LetterUser): string {
  const gfeEntry = ctx.gfe?.[0];
  const gfeAmount = money(gfeEntry?.total) ?? '[Good Faith Estimate amount]';
  const gfeDate = req(user.gfeDate, 'date you received the Good Faith Estimate');
  const initialBillDate = req(formatDateLong(ctx.firstBillDate), 'date of your first bill');
  const billedAmount = c.totalBilled;
  const difference =
    gfeEntry?.total != null && bill.header.totalCharges != null
      ? money(round2(bill.header.totalCharges - gfeEntry.total)) ?? '[difference]'
      : '[difference between the bill and the estimate]';
  const ppdrDeadline = ctx.firstBillDate ? formatDateLong(addDays(ctx.firstBillDate, 120)) : '[120 days after your first bill]';
  const ppdrFiledDate = ctx.ppdrFiledDate ? formatDateLong(ctx.ppdrFiledDate) : undefined;

  const disputeSentence = ppdrFiledDate
    ? `I started that dispute on ${ppdrFiledDate}.`
    : `I plan to start that dispute by ${ppdrDeadline} unless we resolve this first.`;

  return `${c.today}

${c.providerName} — Billing Office

Re: Bill is $400 or more above my Good Faith Estimate — ${c.patientName}, account ${c.accountNumber}, date of service ${c.datesOfService}

Hello,

I did not use insurance for this care, and I received your Good Faith Estimate dated ${gfeDate} for ${gfeAmount}. Your bill dated ${initialBillDate} charges ${billedAmount}, which is ${difference} more than the estimate.

Under federal rules, when a provider's bill is at least $400 more than its Good Faith Estimate, an uninsured or self-pay patient can start a patient-provider dispute within 120 days of the first bill (45 CFR 149.620). ${disputeSentence}

While a dispute is pending, you may not send this bill to collections or threaten to, must stop any collection already under way, must suspend late fees, and may not take action against me for disputing (45 CFR 149.620).

I would prefer to settle this directly. Please send a corrected bill that matches the estimate, or an explanation of the extra charges.

Thank you,
${c.patientName} · ${c.phone}${FOOTER}`;
}

const L6_ISSUE_LABEL: Record<L6Issue, string> = {
  balance_exceeds_eob: 'the balance billed exceeds what my EOB says I owe',
  provider_liability_billed: 'an amount marked as the provider\'s responsibility was billed to me instead',
  not_processed_in_network: 'this claim was not processed as in-network when it should have been',
  wrong_member_info: 'my member information was entered incorrectly',
  other: 'other',
};

function l6(c: CommonFields, ctx: Context, user: LetterUser): string {
  const eobDate = req(user.eobDate, 'EOB date');
  const issue = user.issue ?? 'other';
  const issueDetails = user.issueDetails?.trim() || L6_ISSUE_LABEL[issue] || '[explain what you believe is wrong]';
  const requestedAction = req(user.requestedAction, 'what you want the insurer to do (e.g., reprocess as in-network; correct my member information; confirm the provider-responsibility amount isn\'t owed by me; treat this as a formal appeal)');

  return `${c.today}

${c.insurerName} — Appeals / Grievances

Re: Request for review — member ${c.patientName}, ID ${c.memberId}, group ${c.groupNumber}, claim ${c.claimNumber}, provider ${c.providerName}, date of service ${c.datesOfService}

Hello,

I am asking you to review how this claim was processed (Explanation of Benefits dated ${eobDate}). ${issueDetails}

I am asking you to: ${requestedAction}

Please also send me a copy of the claim and the records you used to decide it. Health plans' payment and claims records are part of my designated record set under HIPAA (45 CFR 164.501, 164.524).

Thank you,
${c.patientName} · ${c.phone}${FOOTER}`;
}

const DEFAULT_RECORDS_LIST =
  'the itemized bill with codes, units and NDCs; the claim forms sent to insurers; the payment and adjustment history; ' +
  'the medication administration record; the operative and anesthesia records with start and stop times; the emergency ' +
  'department record; the admission, discharge and transfer times.';

function l7(c: CommonFields, user: LetterUser): string {
  const recordsList = user.recordsList?.trim() || DEFAULT_RECORDS_LIST.replace(/^the /, 'The ');
  const format = req(user.format, 'PDF by secure email / paper copy by mail');
  const deliverTo = req(user.deliverTo, 'where to send it');

  return `${c.today}

${c.providerName} — Health Information Management / Privacy Officer

Re: Request for access to my records — ${c.patientName}, DOB ${c.patientDob}, dates of service ${c.datesOfService}

Hello,

Under the HIPAA right of access (45 CFR 164.524), I request copies of the following records from my designated record set, which includes medical and billing records (45 CFR 164.501):

${recordsList}

Please provide them as ${format}, to ${deliverTo}. You must act on this request within 30 days (45 CFR 164.524). Any fee must be a reasonable, cost-based fee limited to the cost of labor for copying, supplies and postage (45 CFR 164.524(c)(4)). Please tell me in advance if there will be a fee.

Thank you,
${c.patientName} · ${c.phone}${FOOTER}`;
}

export function renderLetter(id: LetterId, args: RenderLetterArgs): string {
  const { bill, ctx, findings } = args;
  const user = args.user ?? {};
  const common = buildCommon(bill, ctx, user);
  switch (id) {
    case 'L1': return l1(common, user);
    case 'L2': return l2(bill, common, findings, user);
    case 'L3': return l3(common, ctx, user);
    case 'L4': return l4(bill, common, ctx, user);
    case 'L5': return l5(bill, common, ctx, user);
    case 'L6': return l6(common, ctx, user);
    case 'L7': return l7(common, user);
  }
}

export const LETTER_TITLES: Record<LetterId, string> = {
  L1: 'Request for an itemized bill and billing records',
  L2: 'Line-item dispute',
  L3: 'Financial assistance (charity care) application + pause collections',
  L4: 'Surprise bill (insured): No Surprises Act dispute',
  L5: 'Uninsured / self-pay: Good Faith Estimate dispute (PPDR)',
  L6: 'Appeal to the insurer: EOB mismatch or wrong denial',
  L7: 'HIPAA right-of-access request for records',
};
