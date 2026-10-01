// Ground-truth labeler: an independent reading of SPEC §3 (+ RESEARCH where SPEC is silent).
// It never imports engine code. Where it deliberately differs from a literal reading, the
// difference is one of these "truth semantics" (documented in SUMMARY.md):
//   T1 credits net by |qty| and |amount| (a reversal printed as qty -1 still reverses)
//   T2 lines that differ only by a modifier set (LT/RT, 91, 76, JW, 25…) are not duplicates (DUP-01/DUP-02)
//   T3 MATH-01 compares magnitudes, so a credit printed "1 x 45.00 = (45.00)" is not a math error
//   T4 MUE counts net units; inpatient stays are exempt; a UB-04 facility bill uses the outpatient MUE
//   T5 QTY-01 counts per item: hourly per item per date, per-day per item, and only admission kits are per-stay
//   T6 RB-01 counts room-and-board lines only (revenue 010X-021X), not ER/OR/recovery "room" wording
//   T7 NCCI-associated modifiers include 25, 57, 24, 27 and anatomic modifiers (RESEARCH E12)
//   T8 CANC-01 keywords are SPEC's (CANCEL, D/C, NOT GIVEN, RETURNED); JW drug wastage is billable
//   T9 EOB-02 = the provider did not write off the full CO amount and the balance exceeds the EOB's patient share
//   T10 INS-01 = insured and no payer activity anywhere (no EOB AND no payment/adjustment printed on the bill)
//   T11 an ECA is credit reporting, a lawsuit or a garnishment (RESEARCH line 298); agency referral and late fees are not
//   T12 a "30-day notice" must be dated at least 30 days before the ECA
import type { Bill, BillLine, Context } from '@finecomb/engine';
import type { FixtureData, Label } from './types.js';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ms = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y!, m! - 1, dd!); };
const days = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86_400_000);
const addDays = (d: string, n: number) => new Date(ms(d) + n * 86_400_000).toISOString().slice(0, 10);
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const itemKey = (l: BillLine) => (l.code ? `c:${l.code}` : `d:${norm(l.description)}`);
const mods = (l: BillLine) => (l.modifiers ?? []).map((m) => m.toUpperCase()).sort().join('+');

const NCCI_MODS = new Set(['24', '25', '27', '57', '58', '59', '78', '79', '91', 'XE', 'XS', 'XP', 'XU', 'E1', 'E2', 'E3', 'E4',
  'FA', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'TA', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9',
  'LT', 'RT', 'LC', 'LD', 'LM', 'RC', 'RI']);
const CANCEL = /\bCANCELL?ED\b|\bCANC\b|\bD\/C'?D\b|\bNOT GIVEN\b|\bRETURNED\b/i;
const HOURLY = /\bPER HOUR\b|\bHOURLY\b|\bADDL HOUR\b|\/\s*HR\b/i;
const PER_DAY = /\bPER DAY\b|\bDAILY MONITORING\b/i;
const ADMISSION_KIT = /\bADMISSION KIT\b|\bADMIT KIT\b/i;
const ANCILLARY = /emergency medicine|anesthes|patholog|radiolog|neonatolog|assistant surgeon|hospitalist|intensivist|diagnostic (lab|imaging)/i;
const ECA_KINDS = new Set(['credit_report', 'lawsuit', 'wage_garnishment']);

/** T1: positive lines that survive after credits reverse matching charges. */
export function survivors(lines: BillLine[]): BillLine[] {
  const groups = new Map<string, BillLine[]>();
  for (const l of lines) {
    const k = `${itemKey(l)}|${Math.abs(l.qty ?? 1)}|${Math.abs(l.amount).toFixed(2)}|${mods(l)}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const out: BillLine[] = [];
  for (const g of groups.values()) {
    const pos = g.filter((l) => l.amount > 0);
    const neg = g.filter((l) => l.amount < 0).length;
    out.push(...pos.slice(0, Math.max(0, pos.length - neg)));
  }
  return out;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

export function labelBill(bill: Bill, ctx: Context, data: FixtureData): Label[] {
  const out: Label[] = [];
  const add = (ruleId: string, lineIds: string[] = []) => out.push({ ruleId, lineIds });
  const { header, lines } = bill;
  const surv = survivors(lines);
  const facility = lines.some((l) => l.revCode);

  // DUP-01 (T1, T2)
  for (const g of groupBy(surv, (l) => `${l.date}|${itemKey(l)}|${l.qty ?? 1}|${l.amount}|${mods(l)}`).values()) {
    if (g.length > 1) add('DUP-01', g.map((l) => l.id));
  }
  // DUP-02 (T1, T2)
  for (const g of groupBy(surv.filter((l) => l.code && l.date), (l) => `${l.date}|${l.code}|${mods(l)}`).values()) {
    if (g.length > 1 && new Set(g.map((l) => `${l.amount}|${norm(l.description)}`)).size > 1) add('DUP-02', g.map((l) => l.id));
  }
  // MATH-01 (T3)
  for (const l of lines) {
    if (l.qty == null || l.unitPrice == null) continue;
    const diff = Math.abs(Math.abs(r2(l.qty * l.unitPrice)) - Math.abs(l.amount));
    if (diff > Math.max(0.05, 0.005 * Math.abs(l.amount)) + 1e-9) add('MATH-01', [l.id]);
  }
  // MATH-02
  {
    let bad = false;
    if (header.totalCharges != null && Math.abs(r2(lines.reduce((a, l) => a + l.amount, 0)) - header.totalCharges) > 0.011) bad = true;
    if (header.totalCharges != null && header.payments != null && header.adjustments != null && header.balanceDue != null &&
      Math.abs(r2(header.totalCharges - header.payments - header.adjustments) - header.balanceDue) > 0.011) bad = true;
    if (bad) add('MATH-02');
  }
  // MUE-01 (T4)
  if (ctx.admitted !== true) {
    const setting = facility ? 'outpatient' : 'practitioner';
    for (const g of groupBy(lines.filter((l) => l.code && l.date), (l) => `${l.code}|${l.date}`).values()) {
      const lim = data.mue[g[0]!.code!]?.[setting];
      if (!lim) continue;
      const units = g.reduce((a, l) => a + (l.amount < 0 ? -Math.abs(l.qty ?? 1) : (l.qty ?? 1)), 0);
      if (units > lim.mue) add('MUE-01', g.filter((l) => l.amount > 0).map((l) => l.id));
    }
  }
  // QTY-01 (T5)
  for (const g of groupBy(surv.filter((l) => l.date && HOURLY.test(l.description)), (l) => `${l.date}|${itemKey(l)}`).values()) {
    if (g.reduce((a, l) => a + (l.qty ?? 1), 0) > 24) add('QTY-01', g.map((l) => l.id));
  }
  {
    const kits = surv.filter((l) => ADMISSION_KIT.test(l.description));
    if (kits.reduce((a, l) => a + (l.qty ?? 1), 0) > 1) add('QTY-01', kits.map((l) => l.id));
  }
  if (ctx.admitted === true && header.admitDate && header.dischargeDate) {
    const nights = Math.max(1, days(header.admitDate, header.dischargeDate));
    for (const g of groupBy(surv.filter((l) => PER_DAY.test(l.description)), itemKey).values()) {
      if (g.reduce((a, l) => a + (l.qty ?? 1), 0) > nights) add('QTY-01', g.map((l) => l.id));
    }
  }
  // RB-01 (T6)
  if (header.admitDate && header.dischargeDate) {
    const room = lines.filter((l) => l.revCode && /^\d{4}$/.test(l.revCode) && +l.revCode.slice(0, 3) >= 10 && +l.revCode.slice(0, 3) <= 21);
    const units = room.reduce((a, l) => a + (l.amount < 0 ? -Math.abs(l.qty ?? 1) : (l.qty ?? 1)), 0);
    if (room.length && units > Math.max(1, days(header.admitDate, header.dischargeDate))) add('RB-01', room.map((l) => l.id));
  }
  // DATE-01
  if (ctx.admitted === true && header.dischargeDate) {
    const late = lines.filter((l) => l.revCode && l.date && l.date > header.dischargeDate!);
    if (late.length) add('DATE-01', late.map((l) => l.id));
  }
  // NCCI-01 (T7); PTP edits don't apply to inpatient stays
  if (ctx.admitted !== true) {
    for (const [date, g] of groupBy(surv.filter((l) => l.code && l.date), (l) => l.date!)) {
      for (const a of g) for (const b of g) {
        if (a === b || a.provider !== b.provider) continue;
        const e = data.ncciPtp.find((p) => p.col1 === a.code && p.col2 === b.code && p.effective <= date && (!p.deleted || date < p.deleted));
        if (!e || e.mi === 9) continue;
        if (e.mi === 1 && (b.modifiers ?? []).some((m) => NCCI_MODS.has(m.toUpperCase()))) continue;
        add('NCCI-01', [a.id, b.id]);
      }
    }
  }
  // CANC-01 (T1, T8)
  {
    const survIds = new Set(surv.map((l) => l.id));
    for (const l of lines) {
      if (l.notReceived) add('CANC-01', [l.id]);
      else if (l.amount > 0 && CANCEL.test(l.description) && survIds.has(l.id)) add('CANC-01', [l.id]);
    }
  }
  // RX-01
  for (const l of lines) {
    const n = l.ndc ? data.nadac[l.ndc] : undefined;
    if (!n || l.amount <= 0) continue;
    if ((l.unitPrice ?? l.amount / (l.qty ?? 1)) / n.unitPrice >= 10) add('RX-01', [l.id]);
  }
  // money rules
  const eob = ctx.eob;
  const bal = header.balanceDue;
  const pr = eob ? (eob.patientResponsibility ?? r2((eob.deductible ?? 0) + (eob.copay ?? 0) + (eob.coinsurance ?? 0) + (eob.nonCovered ?? 0))) : undefined;
  const insured = ctx.insurance !== undefined && ctx.insurance !== 'none';
  if (eob && bal != null && bal - pr! > 1) add('EOB-01');
  if (eob && bal != null && header.adjustments != null) {
    const co = r2((eob.adjustments ?? []).filter((a) => a.group === 'CO' && a.amount > 0).reduce((s, a) => s + a.amount, 0));
    if (co > 0 && header.adjustments < co - 1 && bal - pr! > 1) add('EOB-02'); // T9
  }
  if (insured && !eob && !((header.payments ?? 0) > 0) && !((header.adjustments ?? 0) > 0)) add('INS-01'); // T10
  if (ctx.insurance === 'medicaid' && bal != null && bal - (eob?.copay ?? 0) > 0.01) add('MCD-01');
  if (insured && (ctx.emergency || ctx.airAmbulance) && ctx.facilityInNetwork === false && eob && bal != null && bal - pr! > 1) add('NSA-01');
  if (insured && ctx.facilityInNetwork === true && (ctx.oonClinicianTypes ?? []).some((t) => ANCILLARY.test(t)) && eob && bal != null && bal - pr! > 1) add('NSA-02');
  if (ctx.insurance === 'none' && ctx.gfe?.length && ctx.firstBillDate && days(ctx.firstBillDate, ctx.today) <= 120) {
    for (const g of ctx.gfe) {
      const own = lines.filter((l) => l.provider === g.provider);
      const mine = own.length ? own : ctx.gfe.length === 1 ? lines : [];
      if (mine.length && r2(mine.reduce((a, l) => a + l.amount, 0) - g.total) >= 400) add('GFE-01', mine.map((l) => l.id));
    }
  }
  // ECA-01 (T11, T12)
  const hosp = ctx.hospitalCcn ? data.hospital[ctx.hospitalCcn] : undefined;
  const S = ctx.firstPostDischargeStatementDate;
  if (hosp?.ownershipCategory === 'nonprofit' && S && ctx.collections) {
    const bad = ctx.collections.some((ev) => ECA_KINDS.has(ev.kind) && (
      ev.date < addDays(S, 120) ||
      !ev.noticeDate || days(ev.noticeDate, ev.date) < 30 ||
      (ctx.fapApplied === true && !!ctx.fapAppliedDate && ev.date >= ctx.fapAppliedDate)));
    if (bad) add('ECA-01');
  }
  if (ctx.ppdrFiledDate && ctx.collections?.some((ev) => ev.date >= ctx.ppdrFiledDate!)) add('PPDR-01');
  if (ctx.onCreditReport === true && (ctx.paidInFull === true || (ctx.originalBalance != null && ctx.originalBalance < 500) ||
    (S != null && days(S, ctx.today) < 365))) add('CR-01');
  return out;
}
