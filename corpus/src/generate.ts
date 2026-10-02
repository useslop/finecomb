// Seeded, deterministic synthetic bill corpus (lane B2). Everything here is fake: patients are
// "Test Patient NNN", providers are "Example …"/"Sample …", accounts are TEST-…, NDCs and CCNs are made up,
// and every description is our own generic wording (no AMA/NUBC descriptor text). MUE/NCCI/NADAC values in
// the fixtures are synthetic stand-ins shaped like the CMS tables, not copies of them.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Bill, BillHeader, BillLine, CollectionEvent, Context, Eob, Insurance } from '@finecomb/engine';
import { labelBill } from './truth.js';
import type { CorpusItem, FixtureData, Kind, MueEntry } from './types.js';

export const CORPUS_VERSION = 'v1';
export const BASE_SEED = 20261001;
// Hold-out (lane F1): same generator and labeler, a different seed, half the size. Never tuned against;
// it is the overfit check reported next to v1.
export const HOLDOUT_VERSION = 'holdout';
export const HOLDOUT_SEED = 20261002;
export const HOLDOUT_PER_KIND = 50;
export const TODAY = '2026-10-01';

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number { // mulberry32
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
  float(a: number, b: number): number { return a + this.next() * (b - a); }
  money(a: number, b: number): number { return r2(this.float(a, b)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.next() * xs.length)]!; }
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; }
    return xs;
  }
}
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ms = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y!, m! - 1, dd!); };
export const addDays = (d: string, n: number) => new Date(ms(d) + n * 86_400_000).toISOString().slice(0, 10);
const minDate = (a: string, b: string) => (a < b ? a : b);

// ---------- synthetic reference tables ----------
const M = (p: number | null, o: number | null, mai: 1 | 2 | 3 = 3) => ({
  ...(p != null ? { practitioner: { mue: p, mai } as MueEntry } : {}),
  ...(o != null ? { outpatient: { mue: o, mai } as MueEntry } : {}),
});
export const MUE_TABLE: FixtureData['mue'] = {
  '99283': M(1, 1, 2), '99284': M(1, 1, 2), '99285': M(1, 1, 2), '99203': M(1, null, 2), '99204': M(1, null, 2),
  '99213': M(1, null, 2), '99214': M(1, null, 2),
  '85025': M(1, 2), '83690': M(1, 2), '36415': M(1, 3), // practitioner and outpatient limits differ on purpose
  '80053': M(1, 1, 2), '80048': M(1, 1, 2), '85027': M(1, 1, 2), '82565': M(2, 2), '84484': M(3, 3), '83735': M(2, 2),
  '85610': M(2, 2), '81003': M(2, 2), '87040': M(4, 4), '83605': M(2, 2), '82962': M(2, 2), '36416': M(2, 2),
  '71046': M(2, 2), '70450': M(2, 2), '74177': M(1, 1, 2), '93005': M(3, 3), '73562': M(2, 2), '20610': M(2, 2, 2),
  '96374': M(1, 1, 2), '96375': M(6, 6), '96360': M(1, 1, 2), '96361': M(8, 8), '96372': M(4, 4), '88305': M(6, 6),
  '87880': M(2, 2), '87804': M(2, 2),
  J2405: M(32, 32), J1885: M(8, 8), J2270: M(4, 4), J1100: M(20, 20), J0696: M(16, 16), J7030: M(5, 5), J7120: M(4, 4),
  J1030: M(4, 4), J3301: M(8, 8), G0378: M(null, 72), A0431: M(1, null, 2), A0436: M(250, null),
};
export const PTP_TABLE: FixtureData['ncciPtp'] = [
  { col1: '80053', col2: '80048', mi: 0 }, { col1: '80053', col2: '82565', mi: 0 }, { col1: '85025', col2: '85027', mi: 0 },
  { col1: '96374', col2: '96360', mi: 1 }, { col1: '20610', col2: '99213', mi: 1 }, { col1: '20610', col2: '99214', mi: 1 },
  { col1: '36415', col2: '36416', mi: 9 },
].map((p) => ({ ...p, mi: p.mi as 0 | 1 | 9, effective: '2020-01-01' }));
const HOSPITALS: (FixtureData['hospital'][string] & { ccn: string })[] = [
  { ccn: '990101', name: 'Example General Hospital', state: 'OH', ownership: 'Voluntary non-profit - Private', ownershipCategory: 'nonprofit' },
  { ccn: '990102', name: 'Example Community Medical Center', state: 'TX', ownership: 'Voluntary non-profit - Church', ownershipCategory: 'nonprofit' },
  { ccn: '990103', name: 'Example Regional Medical Center', state: 'GA', ownership: 'Voluntary non-profit - Other', ownershipCategory: 'nonprofit' },
  { ccn: '990104', name: 'Example County Hospital', state: 'AZ', ownership: 'Government - Hospital District or Authority', ownershipCategory: 'government' },
  { ccn: '990105', name: 'Example Valley Hospital', state: 'TN', ownership: 'Proprietary', ownershipCategory: 'proprietary' },
  { ccn: '990106', name: 'Example Lakeside Hospital', state: 'MO', ownership: 'Proprietary', ownershipCategory: 'proprietary' },
];
const STATES = ['OH', 'TX', 'GA', 'AZ', 'TN', 'MO', 'IN', 'AL', 'OK', 'KS'];

// ---------- line catalog (our own generic wording) ----------
interface Item { code?: string; rev?: string; desc: string; price: [number, number]; qty?: [number, number]; mods?: string[] }
const LABS: Item[] = [
  { code: '85025', rev: '0305', desc: 'BLOOD COUNT COMPLETE W DIFF', price: [45, 180] },
  { code: '80053', rev: '0301', desc: 'METABOLIC PANEL FULL', price: [60, 260] },
  { code: '80048', rev: '0301', desc: 'METABOLIC PANEL BASIC', price: [40, 190] },
  { code: '83735', rev: '0301', desc: 'MAGNESIUM LEVEL', price: [20, 90] },
  { code: '84484', rev: '0301', desc: 'TROPONIN QUANT', price: [60, 240] },
  { code: '85610', rev: '0305', desc: 'PROTIME INR', price: [20, 80] },
  { code: '83690', rev: '0301', desc: 'LIPASE LEVEL', price: [30, 120] },
  { code: '81003', rev: '0300', desc: 'URINALYSIS AUTO', price: [15, 70] },
  { code: '87040', rev: '0306', desc: 'BLOOD CULTURE', price: [60, 220] },
  { code: '83605', rev: '0301', desc: 'LACTIC ACID', price: [30, 120] },
];
const IMAGING: Item[] = [
  { code: '71046', rev: '0324', desc: 'CHEST XRAY 2 VIEWS', price: [180, 650] },
  { code: '70450', rev: '0350', desc: 'CT HEAD NO CONTRAST', price: [900, 3800] },
  { code: '74177', rev: '0352', desc: 'CT ABD PELVIS W CONTRAST', price: [2200, 7200] },
  { code: '93005', rev: '0730', desc: 'EKG TRACING', price: [90, 420] },
];
const INJ: Item[] = [
  { code: 'J2405', rev: '0636', desc: 'ONDANSETRON INJ PER 1MG', price: [6, 40], qty: [4, 8] },
  { code: 'J1885', rev: '0636', desc: 'KETOROLAC INJ PER 15MG', price: [12, 70], qty: [1, 2] },
  { code: 'J2270', rev: '0636', desc: 'MORPHINE INJ UP TO 10MG', price: [15, 90], qty: [1, 2] },
  { code: 'J1100', rev: '0636', desc: 'DEXAMETHASONE INJ PER 1MG', price: [3, 25], qty: [4, 10] },
  { code: 'J0696', rev: '0636', desc: 'CEFTRIAXONE INJ PER 250MG', price: [20, 110], qty: [4, 8] },
  { code: 'J7030', rev: '0258', desc: 'SALINE IV 1000ML', price: [40, 220], qty: [1, 2] },
  { code: 'J7120', rev: '0258', desc: 'LACTATED RINGERS 1000ML', price: [45, 230], qty: [1, 2] },
  { code: 'J1030', rev: '0636', desc: 'METHYLPREDNISOLONE INJ 40MG', price: [20, 110], qty: [1, 2] },
];
const ORAL = [
  { desc: 'ACETAMINOPHEN 325MG TAB', nadac: [0.01, 0.03] }, { desc: 'ATORVASTATIN 40MG TAB', nadac: [0.03, 0.09] },
  { desc: 'METOPROLOL TART 25MG TAB', nadac: [0.02, 0.06] }, { desc: 'PANTOPRAZOLE 40MG TAB', nadac: [0.04, 0.12] },
  { desc: 'OXYCODONE 5MG TAB', nadac: [0.06, 0.2] }, { desc: 'ONDANSETRON 4MG ODT', nadac: [0.08, 0.3] },
  { desc: 'IBUPROFEN 600MG TAB', nadac: [0.03, 0.08] }, { desc: 'CEPHALEXIN 500MG CAP', nadac: [0.06, 0.15] },
] as const;
const ROOMS: Item[] = [
  { rev: '0120', desc: 'SEMI PRIV RM DAILY', price: [2200, 4200] }, { rev: '0110', desc: 'PRIVATE RM DAILY', price: [2600, 5200] },
  { rev: '0200', desc: 'ICU DAILY CHARGE', price: [5200, 9800] }, { rev: '0206', desc: 'STEP DOWN BED DAILY', price: [3600, 6400] },
  { rev: '0121', desc: 'MED SURG BED DAILY', price: [2200, 4200] },
];
const SUPPLIES: Item[] = [
  { rev: '0270', desc: 'FOLEY CATH TRAY', price: [60, 240] }, { rev: '0270', desc: 'PULSE OX SENSOR', price: [25, 120] },
  { rev: '0270', desc: 'SUCTION CANISTER', price: [20, 90] }, { rev: '0272', desc: 'WOUND DRESSING STERILE', price: [30, 160] },
];
const it = (code: string | undefined, rev: string | undefined, desc: string, price: [number, number], qty?: [number, number], mods?: string[]): Item =>
  ({ ...(code ? { code } : {}), ...(rev ? { rev } : {}), desc, price, ...(qty ? { qty } : {}), ...(mods ? { mods } : {}) });
const VENI = it('36415', '0300', 'BLOOD DRAW VENOUS', [15, 60]);
const CAPI = it('36416', '0300', 'CAPILLARY BLOOD DRAW', [8, 30]);
const GLUC = it('82962', '0300', 'GLUCOSE FINGERSTICK', [12, 45], [3, 6]);
const PUSH = it('96374', '0260', 'IV PUSH FIRST DRUG', [180, 650]);
const PUSH2 = it('96375', '0260', 'IV PUSH EACH ADDL DRUG', [90, 300], [1, 2]);
const HYD = it('96360', '0260', 'IV HYDRATION FIRST HOUR', [200, 700]);
const HYD2 = it('96361', '0260', 'IV HYDRATION ADDL HOUR', [80, 260], [1, 2]);
const IVKIT = it(undefined, '0270', 'IV START KIT', [35, 140]);
const ADMKIT = it(undefined, '0270', 'ADMISSION KIT', [45, 220]);
const OXY = it(undefined, '0412', 'OXYGEN PER DAY', [90, 320]);
const TELE = it(undefined, '0731', 'TELEMETRY MONITOR PER DAY', [450, 1400]);
const PT = it(undefined, '0424', 'PHYSICAL THERAPY EVAL', [250, 700]);

// ---------- planning ----------
const FIN = new Set(['INS-01', 'EOB-01', 'EOB-02', 'MCD-01', 'NSA-01', 'NSA-02', 'GFE-01', 'PPDR-01']);
const COLL = new Set(['ECA-01', 'CR-01', 'PPDR-01']);
const PLANT_SUBS: Record<string, string[]> = {
  'DUP-01': ['stay', 'ed', 'obs', 'sched', 'office', 'proc', 'ancillary'], 'DUP-02': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'],
  'MATH-01': ['stay', 'ed', 'obs', 'sched', 'office', 'proc', 'ancillary', 'air'], 'MATH-02': ['stay', 'ed', 'obs', 'sched', 'office', 'proc', 'ancillary', 'air'],
  'MUE-01': ['ed', 'obs', 'office', 'proc', 'air'], 'NCCI-01': ['ed', 'obs', 'office', 'proc'], 'QTY-01': ['stay', 'obs'],
  'RB-01': ['stay'], 'DATE-01': ['stay'], 'CANC-01': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'], 'RX-01': ['stay', 'ed', 'obs'],
  'EOB-01': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'], 'EOB-02': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'],
  'INS-01': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'], 'MCD-01': ['stay', 'ed', 'obs', 'office', 'proc'],
  'NSA-01': ['ed', 'obs', 'ancillary', 'air'], 'NSA-02': ['ancillary'], 'GFE-01': ['sched', 'office', 'proc'],
  'PPDR-01': ['sched', 'office', 'proc'], 'ECA-01': ['stay', 'ed', 'obs'], 'CR-01': ['stay', 'ed', 'obs', 'sched', 'office', 'proc', 'ancillary', 'air'],
};
const HN_SUBS: Record<string, string[]> = {
  'credit-reversal': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'], 'cancel-reversed': ['stay', 'ed', 'obs', 'sched'],
  rounding: ['office', 'proc', 'ed', 'stay'], bilateral: ['office', 'proc'], 'repeat-mod': ['ed', 'obs', 'stay'],
  'jw-waste': ['stay', 'ed', 'obs'], 'same-day-admit-discharge': ['stay'], 'room-word': ['stay'], 'telemetry-monitor': ['stay'],
  'per-day-multi': ['stay'], 'kit-multi': ['stay'], 'hourly-overlap': ['obs'], 'obs-room-hours': ['obs'], 'mue-setting': ['ed'],
  'mue-inpatient': ['stay'], 'ncci-mi1-59': ['ed', 'obs'], 'ncci-mod25': ['proc'], 'ncci-mi9': ['ed', 'obs'], 'rx-below-10': ['stay', 'ed'],
  'eob-under-1': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'], 'eob-prepaid': ['stay', 'ed', 'office', 'proc'],
  'ins-paid-no-eob': ['stay', 'ed', 'obs', 'sched', 'office', 'proc'], 'medicaid-copay': ['stay', 'ed', 'office', 'proc'],
  'nsa-compliant': ['ed', 'air'], 'nsa02-compliant': ['ancillary'], 'gfe-399': ['sched', 'office', 'proc'],
  'gfe-121-days': ['sched', 'office', 'proc'], 'ppdr-before': ['sched', 'office', 'proc'], 'eca-proper': ['stay', 'ed', 'obs'],
  'eca-agency-referral': ['stay', 'ed', 'obs'], 'eca-late-fee': ['stay', 'ed', 'obs'], 'eca-forprofit': ['stay', 'ed'],
  'cr-legit': ['stay', 'ed', 'office', 'proc'], 'cr-not-reported': ['stay', 'ed', 'office', 'proc', 'air'],
};
const SPEC_HN = new Set(['repeat-mod', 'same-day-admit-discharge', 'bilateral', 'credit-reversal', 'ncci-mi1-59', 'gfe-399', 'gfe-121-days']);
const HN_FIN = new Set(['eob-under-1', 'eob-prepaid', 'ins-paid-no-eob', 'medicaid-copay', 'nsa-compliant', 'nsa02-compliant']);
const HN_GFE = new Set(['gfe-399', 'gfe-121-days', 'ppdr-before']);
const HN_COLL = new Set(['eca-proper', 'eca-agency-referral', 'eca-late-fee', 'eca-forprofit', 'cr-legit', 'cr-not-reported', 'ppdr-before']);
const HN_NIGHTS = new Set(['telemetry-monitor', 'per-day-multi']);

interface Plan { i: number; seed: number; kind: Kind; sub: string; clean: boolean; plants: string[]; hns: string[]; insurance: Insurance; version: string }

const SUBS: Record<Kind, [string, number][]> = {
  inpatient: [['stay', 1]],
  ed: [['ed', 0.55], ['obs', 0.2], ['sched', 0.25]],
  professional: [['office', 0.4], ['proc', 0.25], ['ancillary', 0.25], ['air', 0.1]],
};

export function makePlans(seed = BASE_SEED, perKind = 100, version = CORPUS_VERSION): Plan[] {
  const r = new Rng(seed);
  const kinds: Kind[] = ['inpatient', 'ed', 'professional'];
  const cleanIdx = new Set<number>();
  for (let k = 0; k < 3; k++) r.shuffle([...Array(perKind).keys()]).slice(0, Math.round(perKind * 0.3)).forEach((j) => cleanIdx.add(k * perKind + j));
  const plantCount: Record<string, number> = {}; const hnCount: Record<string, number> = {};
  const plans: Plan[] = [];
  for (let i = 0; i < 3 * perKind; i++) {
    const kind = kinds[Math.floor(i / perKind)]!;
    let x = r.next(); let sub = SUBS[kind][0]![0];
    for (const [s, w] of SUBS[kind]) { if (x < w) { sub = s; break; } x -= w; }
    const clean = cleanIdx.has(i);
    const plants: string[] = [];
    if (!clean) {
      const want = r.pick([1, 1, 1, 2, 2, 2, 3, 3]);
      const elig = r.shuffle(Object.keys(PLANT_SUBS).filter((p) => PLANT_SUBS[p]!.includes(sub)))
        .sort((a, b) => (plantCount[a] ?? 0) - (plantCount[b] ?? 0));
      for (const p of elig) {
        if (plants.length >= want) break;
        if (FIN.has(p) && plants.some((q) => FIN.has(q))) continue;
        if (COLL.has(p) && plants.some((q) => COLL.has(q))) continue;
        plants.push(p); plantCount[p] = (plantCount[p] ?? 0) + 1;
      }
    }
    const finPlant = plants.find((p) => FIN.has(p));
    let insurance: Insurance | undefined =
      finPlant === 'GFE-01' || finPlant === 'PPDR-01' ? 'none' : finPlant === 'MCD-01' ? 'medicaid'
        : finPlant === 'NSA-01' || finPlant === 'NSA-02' ? r.pick(['commercial', 'marketplace'] as const)
          : finPlant ? r.pick(['commercial', 'commercial', 'marketplace', 'medicare', 'other'] as const) : undefined;
    const hns: string[] = [];
    const wantHn = clean ? r.int(2, 4) : r.int(1, 2);
    const helig = r.shuffle(Object.keys(HN_SUBS).filter((h) => HN_SUBS[h]!.includes(sub)))
      .sort((a, b) => (hnCount[a] ?? 0) - (SPEC_HN.has(a) ? 6 : 0) - ((hnCount[b] ?? 0) - (SPEC_HN.has(b) ? 6 : 0)));
    for (const h of helig) {
      if (hns.length >= wantHn) break;
      if (HN_FIN.has(h) && (finPlant || hns.some((q) => HN_FIN.has(q) || HN_GFE.has(q)))) continue;
      if (HN_GFE.has(h) && (finPlant || hns.some((q) => HN_GFE.has(q) || HN_FIN.has(q)))) continue;
      if (HN_COLL.has(h) && (plants.some((q) => COLL.has(q)) || hns.some((q) => HN_COLL.has(q)))) continue;
      if (h === 'medicaid-copay' && insurance && insurance !== 'medicaid') continue;
      if ((h === 'nsa-compliant' || h === 'nsa02-compliant') && insurance && insurance !== 'commercial' && insurance !== 'marketplace') continue;
      if (h === 'same-day-admit-discharge' && hns.some((q) => HN_NIGHTS.has(q))) continue;
      if (HN_NIGHTS.has(h) && hns.includes('same-day-admit-discharge')) continue;
      hns.push(h); hnCount[h] = (hnCount[h] ?? 0) + 1;
    }
    if (!insurance) {
      if (hns.some((h) => HN_GFE.has(h))) insurance = 'none';
      else if (hns.includes('medicaid-copay')) insurance = 'medicaid';
      else if (hns.includes('nsa-compliant') || hns.includes('nsa02-compliant')) insurance = r.pick(['commercial', 'marketplace'] as const);
      else if (hns.some((h) => HN_FIN.has(h))) insurance = r.pick(['commercial', 'medicare', 'other', 'marketplace'] as const);
      else if (sub === 'ancillary' || sub === 'air') insurance = r.pick(['commercial', 'commercial', 'marketplace', 'medicare', 'none'] as const);
      else insurance = r.pick(['none', 'none', 'commercial', 'commercial', 'commercial', 'marketplace', 'medicare', 'medicare', 'medicaid', 'other'] as const);
    }
    plans.push({ i, seed: seed + 7919 * (i + 1), kind, sub, clean, plants, hns, insurance, version });
  }
  return plans;
}

// ---------- bill builder ----------
class Draft {
  lines: BillLine[] = [];
  n = 0;
  tags: string[] = [];
  constructor(public r: Rng, public kind: Kind) {}
  id(): string { return `L${String(++this.n).padStart(2, '0')}`; }
  add(date: string, item: Item, o: Partial<BillLine> = {}): BillLine {
    const qty = o.qty ?? (item.qty ? this.r.int(item.qty[0], item.qty[1]) : 1);
    const unitPrice = o.unitPrice ?? this.r.money(item.price[0], item.price[1]);
    const l: BillLine = { id: this.id(), date, description: item.desc, qty, unitPrice, amount: r2(qty * unitPrice) };
    if (item.code) l.code = item.code;
    if (item.rev && this.kind !== 'professional') l.revCode = item.rev;
    if (item.mods) l.modifiers = [...item.mods];
    Object.assign(l, o);
    if (o.amount === undefined) l.amount = r2(l.qty! * l.unitPrice!);
    this.lines.push(l);
    return l;
  }
  copy(of: BillLine, o: Partial<BillLine> = {}): BillLine {
    const l: BillLine = { ...structuredClone(of), id: this.id(), ...o };
    this.lines.splice(this.lines.indexOf(of) + 1, 0, l);
    return l;
  }
  credit(of: BillLine, tag: string): BillLine {
    const neg = this.r.chance(0.5);
    this.tags.push(`${tag}:${neg ? 'negqty' : 'posqty'}`);
    const l: BillLine = { ...structuredClone(of), id: this.id(), qty: neg ? -(of.qty ?? 1) : (of.qty ?? 1), amount: -of.amount };
    delete l.notReceived;
    this.lines.push(l);
    return l;
  }
  coded(date: string, code: string) { return this.lines.some((l) => l.date === date && l.code === code); }
  ptpConflict(date: string, code: string) {
    return PTP_TABLE.some((p) => p.mi !== 9 && ((p.col1 === code && this.coded(date, p.col2)) || (p.col2 === code && this.coded(date, p.col1))));
  }
  labs(date: string, n: number) {
    for (const lab of this.r.shuffle([...LABS])) {
      if (n <= 0) break;
      if (this.coded(date, lab.code!) || this.ptpConflict(date, lab.code!)) continue;
      this.add(date, lab); n--;
    }
  }
}

function edLevel(r: Rng, roomWord: boolean, prof = false): Item {
  const [code, lvl, price] = r.pick([['99283', 3, [700, 1900]], ['99284', 4, [1200, 3200]], ['99285', 5, [1900, 5200]]] as const);
  const desc = prof ? `EMERGENCY PHYSICIAN LEVEL ${lvl}` : roomWord ? `EMERGENCY ROOM LVL ${lvl}` : r.pick([`ER VISIT LEVEL ${lvl}`, `ED VISIT LVL ${lvl}`]);
  return it(code, '0450', desc, prof ? [price[0] * 0.4, price[1] * 0.4] : [price[0], price[1]]);
}

function oral(d: Draft, date: string, ratio: [number, number], data: FixtureData) {
  const o = d.r.pick(ORAL);
  const ndc = `${d.r.int(10000, 99999)}${d.r.int(1000, 9999)}${d.r.int(10, 99)}`;
  const nadac = r2(d.r.float(o.nadac[0], o.nadac[1]) * 10000) / 10000;
  data.nadac[ndc] = { unitPrice: nadac, unit: 'EA', effective: '2026-09-23' };
  const unit = r2(Math.max(0.01, nadac * d.r.float(ratio[0], ratio[1])));
  // guard the rounding at the 10x boundary so the planted side stays on its side
  const unitPrice = ratio[1] < 10 && unit / nadac >= 10 ? r2(Math.floor(nadac * 9.9 * 100) / 100) : ratio[0] >= 10 && unit / nadac < 10 ? r2(Math.ceil(nadac * 10.1 * 100) / 100) : unit;
  return d.add(date, it(undefined, '0250', o.desc, [0, 0], [1, 4]), { unitPrice, ndc });
}

export function buildItem(p: Plan): CorpusItem {
  const r = new Rng(p.seed);
  const d = new Draft(r, p.kind);
  const hn = new Set(p.hns);
  const pl = new Set(p.plants);
  const data: FixtureData = { mue: {}, ncciPtp: [], nadac: {}, hospital: {} };
  const tag = (t: string) => d.tags.push(t);
  p.hns.forEach((h) => tag(`hn:${h}`));

  // dates
  const gfeAge = hn.has('gfe-121-days') ? r.int(121, 150) : r.chance(0.1) ? 120 : r.int(10, 119);
  let start: string;
  if (hn.has('cr-legit')) start = addDays(TODAY, -r.int(430, 800));
  else if (pl.has('ECA-01') || p.hns.some((h) => h.startsWith('eca-'))) start = addDays(TODAY, -r.int(200, 420));
  else if (pl.has('GFE-01') || hn.has('gfe-399') || hn.has('gfe-121-days')) start = addDays(TODAY, -(gfeAge + r.int(7, 20)));
  else if (pl.has('PPDR-01') || hn.has('ppdr-before')) start = addDays(TODAY, -r.int(90, 200));
  else start = addDays(TODAY, -r.int(20, 200));

  // provider
  const hospitalBill = p.kind !== 'professional' && !(p.sub === 'sched' && (pl.has('PPDR-01') || hn.has('ppdr-before')));
  let hosp = HOSPITALS[r.int(0, HOSPITALS.length - 1)]!;
  if (pl.has('ECA-01') || hn.has('eca-proper') || hn.has('eca-agency-referral') || hn.has('eca-late-fee')) hosp = HOSPITALS[r.int(0, 2)]!;
  if (hn.has('eca-forprofit')) hosp = HOSPITALS[r.int(4, 5)]!;
  const ancType = p.sub === 'ancillary'
    ? (pl.has('NSA-01') ? 'emergency medicine' : r.pick(['anesthesia', 'radiology', 'pathology', 'emergency medicine', 'assistant surgeon']))
    : undefined;
  const providerName = hospitalBill ? hosp.name
    : p.sub === 'sched' ? 'Example Outpatient Imaging Center'
      : p.sub === 'air' ? 'Example Air Medical Transport'
        : p.sub === 'ancillary' ? `Sample ${ancType === 'emergency medicine' ? 'Emergency Physicians' : ancType === 'assistant surgeon' ? 'Surgical Associates' : ancType![0]!.toUpperCase() + ancType!.slice(1) + ' Associates'}`
          : r.pick(['Sample Family Clinic', 'Sample Internal Medicine Group', 'Sample Orthopedic Clinic', 'Example Urgent Care']);

  const ctx: Context = { today: TODAY, insurance: p.insurance };
  const header: BillHeader = { patientName: `Test Patient ${String(p.i + 1).padStart(3, '0')}`, providerName, accountNumber: `TEST-${String(100000 + p.i * 37).padStart(7, '0')}` };
  let end = start;
  let nights = 0;

  // ---------- base lines + line-level hard negatives ----------
  if (p.sub === 'stay') {
    nights = hn.has('same-day-admit-discharge') ? 0 : r.pick(HN_NIGHTS.has(p.hns.find((h) => HN_NIGHTS.has(h)) ?? '') ? [1, 2, 3, 4] : [1, 1, 2, 2, 2, 3, 3, 4, 5, 6]);
    end = addDays(start, nights);
    header.admitDate = start; header.dischargeDate = end;
    ctx.admitted = true;
    const roomWord = hn.has('room-word');
    const viaEd = r.chance(0.45) || (roomWord && r.chance(0.5));
    const surgical = r.chance(0.3) || (roomWord && !viaEd);
    ctx.emergency = viaEd;
    if (viaEd) d.add(start, edLevel(r, roomWord && r.chance(0.7)));
    const room = r.pick(ROOMS);
    const rate = r.money(room.price[0], room.price[1]);
    if (nights >= 1 && r.chance(0.5)) for (let k = 0; k < nights; k++) d.add(addDays(start, k), room, { unitPrice: rate, qty: 1 });
    else d.add(start, room, { unitPrice: rate, qty: Math.max(1, nights) });
    if (surgical) {
      const day = nights >= 1 ? addDays(start, r.int(0, 1)) : start;
      const word = roomWord && !viaEd;
      d.add(day, it(undefined, '0360', word ? 'OPERATING ROOM FIRST 30 MIN' : 'OR TIME FIRST 30 MIN', [2400, 6800]));
      d.add(day, it(undefined, '0360', word ? 'OPERATING ROOM EA ADDL 15 MIN' : 'OR TIME EA ADDL 15 MIN', [600, 1500], [2, 8]));
      d.add(day, it(undefined, '0710', word ? 'RECOVERY ROOM FIRST 30 MIN' : 'PACU FIRST 30 MIN', [700, 2200]));
      d.add(day, it(undefined, '0370', 'ANESTHESIA FACILITY FIRST 30 MIN', [900, 2600]));
      d.add(day, it(undefined, '0272', 'SURGICAL SUPPLY PACK', [300, 1800]));
    }
    const lastLabDay = hn.has('discharge-day-line') || r.chance(0.4) ? nights : Math.max(0, nights - 1);
    for (let k = 0; k <= lastLabDay; k++) d.labs(addDays(start, k), r.int(1, 3));
    for (const drug of r.shuffle([...INJ]).slice(0, r.int(2, 4))) {
      for (const k of r.shuffle([...Array(nights + 1).keys()]).slice(0, r.int(1, Math.min(2, nights + 1)))) d.add(addDays(start, k), drug);
    }
    if (r.chance(0.5)) d.add(start, r.pick(IMAGING.slice(0, 2)));
    if (r.chance(0.3)) d.add(start, IMAGING[3]!);
    for (const s of r.shuffle([...SUPPLIES]).slice(0, r.int(1, 2))) d.add(start, s);
    if (hn.has('kit-multi')) {
      if (r.chance(0.5)) { d.add(start, ADMKIT); d.add(start, IVKIT); tag('variant:admission+iv-kit'); }
      else { d.add(start, IVKIT, { qty: 2 }); tag('variant:iv-kit-x2'); }
    } else if (r.chance(0.5)) d.add(start, r.chance(0.6) ? IVKIT : ADMKIT);
    if (nights >= 1) {
      if (hn.has('per-day-multi')) { d.add(start, OXY, { qty: nights }); d.add(start, TELE, { qty: nights }); }
      else if (hn.has('telemetry-monitor')) d.add(start, TELE, { qty: nights });
      else if (r.chance(0.25)) d.add(start, OXY, { qty: nights });
    }
    if (nights >= 1 && r.chance(0.3)) d.add(addDays(start, 1), PT);
    if (hn.has('mue-inpatient')) for (let k = 0; k <= nights; k++) d.add(addDays(start, k), GLUC);
    if (hn.has('discharge-day-line') && nights >= 1) d.add(end, it(undefined, '0250', 'PHARMACY TAKE HOME MEDS', [20, 140]));
  } else if (p.sub === 'ed' || p.sub === 'obs') {
    const obs = p.sub === 'obs';
    if (obs) end = addDays(start, 1);
    ctx.emergency = true; ctx.admitted = false;
    if (obs) ctx.observation = true; else if (r.chance(0.8)) ctx.observation = false;
    if (obs ? (hn.has('obs-room-hours') || r.chance(0.6)) : r.chance(0.3)) { header.admitDate = start; header.dischargeDate = end; }
    d.add(start, edLevel(r, r.chance(0.4)));
    d.labs(start, r.int(1, 4));
    d.add(start, VENI, hn.has('mue-setting') && r.chance(0.5) ? { qty: 2 } : {});
    if (hn.has('mue-setting') && !d.lines.some((l) => l.qty === 2)) {
      const cbc = d.lines.find((l) => l.code === '85025') ?? (d.ptpConflict(start, '85025') ? undefined : d.add(start, LABS[0]!));
      if (cbc) { cbc.qty = 2; cbc.amount = r2(2 * cbc.unitPrice!); } else { const v = d.lines.find((l) => l.code === '36415')!; v.qty = 2; v.amount = r2(2 * v.unitPrice!); }
    }
    if (hn.has('ncci-mi9')) d.add(start, CAPI);
    if (hn.has('repeat-mod')) {
      if (r.chance(0.5)) {
        const t = d.lines.find((l) => l.code === '84484') ?? d.add(start, LABS[4]!);
        d.copy(t, { modifiers: ['91'] }); tag('variant:troponin-91');
      } else { const e = d.add(start, IMAGING[3]!); d.copy(e, { modifiers: ['76'] }); tag('variant:ekg-76'); }
    }
    if (r.chance(0.5)) d.add(start, r.pick(IMAGING));
    if (hn.has('ncci-mi1-59')) { d.add(start, PUSH); d.add(start, HYD, { modifiers: [r.pick(['59', 'XU'])] }); }
    else if (!hn.has('hourly-overlap') && r.chance(0.5)) { d.add(start, PUSH); if (r.chance(0.4)) d.add(start, PUSH2); }
    else if (hn.has('hourly-overlap') || r.chance(0.5)) { d.add(start, HYD); if (r.chance(0.5)) d.add(start, HYD2); }
    if (hn.has('hourly-overlap')) {
      const extra = d.lines.find((l) => l.code === '96361') ?? d.add(start, HYD2);
      extra.qty = r.int(2, 3); extra.amount = r2(extra.qty * extra.unitPrice!);
    }
    for (const drug of r.shuffle([...INJ]).slice(0, r.int(1, 3))) if (!d.coded(start, drug.code!)) d.add(start, drug);
    if (r.chance(0.4)) d.add(start, IVKIT);
    if (obs) {
      const h1 = hn.has('hourly-overlap') ? r.int(21, 23) : r.int(8, 20);
      const h2 = r.int(6, 20);
      const desc = hn.has('obs-room-hours') ? 'OBSERVATION ROOM HOURLY' : 'OBSERVATION PER HOUR';
      d.add(start, it('G0378', '0762', desc, [60, 160]), { qty: h1 });
      d.add(end, it('G0378', '0762', desc, [60, 160]), { qty: h2 });
      d.labs(end, r.int(1, 2));
    }
  } else if (p.sub === 'sched') {
    ctx.emergency = false; ctx.admitted = false; ctx.scheduledAhead = true;
    const fac = hospitalBill ? hosp.name : providerName;
    if (r.chance(0.5)) {
      d.add(start, IMAGING[2]!, { provider: fac }); d.add(start, VENI, { provider: fac }); d.labs(start, 1);
      tag('variant:sched-imaging');
    } else {
      d.add(start, it(undefined, '0360', 'OR TIME FIRST 30 MIN', [2400, 6800]), { provider: fac });
      d.add(start, it(undefined, '0710', 'PACU FIRST 30 MIN', [700, 2200]), { provider: fac });
      d.add(start, it(undefined, '0272', 'SURGICAL SUPPLY PACK', [300, 1800]), { provider: fac });
      d.add(start, INJ[0]!, { provider: fac });
      d.add(start, it('00790', undefined, 'ANESTHESIA SERVICES', [1200, 3200]), { provider: 'Sample Anesthesia Associates', revCode: undefined });
      tag('variant:sched-surgery-2-providers');
    }
    for (const l of d.lines) if (!l.provider) l.provider = fac;
  } else if (p.sub === 'office' || p.sub === 'proc') {
    const em = it(r.pick(['99213', '99214', '99203', '99204']), undefined, '', [140, 420]);
    em.desc = { '99213': 'OFFICE VISIT EST LEVEL 3', '99214': 'OFFICE VISIT EST LEVEL 4', '99203': 'OFFICE VISIT NEW LEVEL 3', '99204': 'OFFICE VISIT NEW LEVEL 4' }[em.code!]!;
    if (p.sub === 'office') {
      d.add(start, em);
      for (const x of r.shuffle([LABS[0]!, LABS[7]!, it('87880', undefined, 'STREP TEST RAPID', [25, 80]), it('87804', undefined, 'FLU TEST RAPID', [30, 90]), VENI]).slice(0, r.int(0, 3))) d.add(start, x);
      if (r.chance(0.35)) { d.add(start, it('96372', undefined, 'INJECTION IM OR SUBQ', [30, 90])); d.add(start, r.pick([INJ[7]!, INJ[1]!, INJ[4]!])); }
    } else {
      const inj = it('20610', undefined, 'JOINT INJECTION MAJOR', [180, 480]);
      if (hn.has('ncci-mod25')) d.add(start, it('99214', undefined, 'OFFICE VISIT EST LEVEL 4', [200, 380]), { modifiers: ['25'] });
      if (hn.has('bilateral')) {
        const rt = d.add(start, inj, { modifiers: ['RT'] });
        const disc = r.chance(0.4);
        d.add(start, inj, { modifiers: ['LT'], unitPrice: disc ? r2(rt.unitPrice! / 2) : rt.unitPrice! });
        tag(`variant:bilateral-${disc ? 'discounted' : 'same-price'}`);
      } else d.add(start, inj);
      d.add(start, it('J3301', undefined, 'TRIAMCINOLONE INJ PER 10MG', [8, 40], [2, 4]));
    }
    if (hn.has('bilateral') && p.sub === 'office') {
      const xr = it('73562', undefined, 'KNEE XRAY 3 VIEWS', [90, 300]);
      const rt = d.add(start, xr, { modifiers: ['RT'] });
      const disc = r.chance(0.4);
      d.add(start, xr, { modifiers: ['LT'], unitPrice: disc ? r2(rt.unitPrice! * 0.5) : rt.unitPrice! });
      tag(`variant:bilateral-${disc ? 'discounted' : 'same-price'}`);
    }
    if (hn.has('rounding')) { d.add(start, it('A6402', undefined, 'STERILE GAUZE PAD', [0, 0]), { qty: 3, unitPrice: 33.33, amount: 100 }); }
    if (pl.has('GFE-01') || hn.has('gfe-399') || hn.has('gfe-121-days') || pl.has('PPDR-01') || hn.has('ppdr-before')) {
      d.add(start, it('74177', undefined, 'CT ABD PELVIS W CONTRAST', [1500, 3200]));
    }
  } else if (p.sub === 'ancillary') {
    ctx.admitted = false;
    if (ancType === 'anesthesia') d.add(start, it('00790', undefined, 'ANESTHESIA SERVICES', [1800, 5200]));
    else if (ancType === 'radiology') { d.add(start, it('70450', undefined, 'CT HEAD PROFESSIONAL READ', [180, 520], undefined, ['26'])); if (r.chance(0.5)) d.add(start, it('71046', undefined, 'CHEST XRAY PROFESSIONAL READ', [40, 120], undefined, ['26'])); }
    else if (ancType === 'pathology') d.add(start, it('88305', undefined, 'TISSUE EXAM SURGICAL', [120, 380], [1, 3]));
    else if (ancType === 'assistant surgeon') d.add(start, it('27447', undefined, 'ASSISTANT AT SURGERY KNEE', [900, 2600], undefined, ['80']));
    else { d.add(start, edLevel(r, false, true)); if (r.chance(0.5)) d.add(start, it('93010', undefined, 'EKG INTERPRETATION', [20, 60])); }
    ctx.emergency = ancType === 'emergency medicine';
  } else if (p.sub === 'air') {
    ctx.airAmbulance = true; ctx.emergency = true;
    d.add(start, it('A0431', undefined, 'ROTOR AIR TRANSPORT BASE', [28000, 62000]));
    d.add(start, it('A0436', undefined, 'ROTOR AIR MILES', [250, 700], [20, 80]));
  }
  if (p.kind !== 'professional' && hn.has('jw-waste')) {
    const drug = d.lines.find((l) => l.code === 'J2405' || l.code === 'J1100' || l.code === 'J0696') ?? d.add(start, INJ[0]!);
    const waste = r.chance(0.6);
    d.add(drug.date!, it(drug.code, drug.revCode, `${drug.description.split(' INJ')[0]} ${waste ? 'WASTAGE' : 'DISCARDED'}`, [0, 0]), { qty: r.int(1, 3), unitPrice: drug.unitPrice!, modifiers: ['JW'] });
    tag(`variant:jw-${waste ? 'wastage' : 'discarded'}`);
  }
  if (hn.has('rounding') && p.kind !== 'professional') d.add(start, it(undefined, '0250', 'PHARMACY MISC', [0, 0]), { qty: 3, unitPrice: 33.33, amount: 100 });
  if (hn.has('rx-below-10')) oral(d, start, [7.5, 9.8], data);
  if (hn.has('credit-reversal')) {
    const cand = d.lines.filter((l) => l.amount > 0 && !l.ndc && !l.modifiers && !/KIT|PER DAY|HOUR|RM DAILY|BED DAILY|ICU DAILY/.test(l.description));
    const t = r.pick(cand);
    d.copy(t);
    const late = r.chance(0.3);
    const c = d.credit(t, 'variant:credit');
    if (late) { c.date = addDays(t.date!, r.int(3, 20)); tag('variant:credit-posted-later'); }
  }
  if (hn.has('cancel-reversed')) {
    const t = d.add(start, it(undefined, '0250', r.pick(['PHARMACY ITEM CANCELLED', 'IV BAG NOT GIVEN', 'MED RETURNED TO PHARMACY']), [20, 180]));
    d.credit(t, 'variant:cancel-credit');
  }

  // ---------- line-level plants ----------
  const plain = () => d.lines.filter((l) => l.amount > 0 && !l.ndc && !l.notReceived && !l.modifiers && !/KIT|PER DAY|HOUR|RM DAILY|BED DAILY|ICU DAILY|CANCEL|NOT GIVEN|RETURNED/.test(l.description) && !(l.revCode && +l.revCode.slice(0, 3) >= 10 && +l.revCode.slice(0, 3) <= 21));
  for (const plant of p.plants) {
    if (plant === 'DUP-01') { const pool = plain(); d.copy(r.pick(pool.length ? pool : d.lines.filter((l) => l.amount > 0))); tag('plant:DUP-01'); }
    else if (plant === 'DUP-02') {
      const coded = plain().filter((l) => l.code);
      const t = coded.length ? r.pick(coded) : d.add(start, LABS[3]!);
      if (r.chance(0.7)) { d.copy(t, { unitPrice: r2(t.unitPrice! * r.float(1.15, 1.6)), amount: 0 }).amount = r2(t.qty! * r2(t.unitPrice! * 1)); tag('plant:DUP-02:price'); }
      else { d.copy(t, { description: `${t.description} ADDL` }); tag('plant:DUP-02:desc'); }
      const c = d.lines[d.lines.indexOf(t) + 1]!;
      c.amount = r2(c.qty! * c.unitPrice!);
    } else if (plant === 'MATH-01') {
      const t = r.pick(d.lines.filter((l) => l.amount > 0 && l.qty && l.unitPrice && !l.ndc));
      if (r.chance(0.5)) { t.amount = r2(((t.qty ?? 1) + 1) * t.unitPrice!); tag('plant:MATH-01:extra-unit'); }
      else { t.amount = r2(t.amount * r.pick([1.1, 1.5, 0.9, 10])); tag('plant:MATH-01:wrong-total'); }
    } else if (plant === 'MUE-01') {
      const setting = p.kind === 'professional' ? 'practitioner' : 'outpatient';
      const cand = d.lines.filter((l) => l.code && l.amount > 0 && MUE_TABLE[l.code]?.[setting] && !l.modifiers && Math.abs(r2(l.qty! * l.unitPrice!) - l.amount) < 0.01);
      const t = r.pick(cand);
      t.qty = MUE_TABLE[t.code!]![setting]!.mue + r.int(1, 3); t.amount = r2(t.qty * t.unitPrice!);
      tag('plant:MUE-01');
    } else if (plant === 'NCCI-01') {
      const pairs = p.kind === 'professional'
        ? (p.sub === 'proc' ? [['20610', '99214'], ['20610', '99213']] : [['85025', '85027']])
        : [['80053', '80048'], ['85025', '85027'], ['80053', '82565'], ['96374', '96360']];
      const [c1, c2] = r.pick(pairs) as [string, string];
      const date = start;
      const map: Record<string, Item> = {
        '85025': LABS[0]!, '85027': it('85027', '0305', 'BLOOD COUNT COMPLETE NO DIFF', [35, 140]), '80053': LABS[1]!, '80048': LABS[2]!,
        '82565': it('82565', '0301', 'CREATININE LEVEL', [20, 90]), '96374': PUSH, '96360': HYD, '20610': it('20610', undefined, 'JOINT INJECTION MAJOR', [180, 480]),
        '99213': it('99213', undefined, 'OFFICE VISIT EST LEVEL 3', [140, 260]), '99214': it('99214', undefined, 'OFFICE VISIT EST LEVEL 4', [200, 380]),
      };
      const fix = (code: string, mustBePlain: boolean) => {
        const ex = d.lines.find((l) => l.date === date && l.code === code);
        if (ex) { if (mustBePlain && ex.modifiers) delete ex.modifiers; return; }
        d.add(date, map[code]!);
      };
      fix(c1, false); fix(c2, true);
      tag(`plant:NCCI-01:${c1 === '96374' || c1 === '20610' ? 'mi1-no-modifier' : 'mi0'}`);
    } else if (plant === 'QTY-01') {
      if (p.sub === 'obs') { const o = d.lines.find((l) => l.code === 'G0378')!; o.qty = r.int(26, 34); o.amount = r2(o.qty * o.unitPrice!); tag('plant:QTY-01:hourly'); }
      else if (r.chance(0.35)) {
        const k = d.lines.find((l) => /ADMISSION KIT/.test(l.description)) ?? d.add(start, ADMKIT);
        k.qty = 2; k.amount = r2(2 * k.unitPrice!); tag('plant:QTY-01:kit');
      } else {
        const item = d.lines.find((l) => /PER DAY/.test(l.description)) ?? d.add(start, r.chance(0.6) ? OXY : TELE, { qty: Math.max(1, nights) });
        item.qty = Math.max(1, nights) + r.int(2, 4); item.amount = r2(item.qty * item.unitPrice!); tag('plant:QTY-01:per-day');
      }
    } else if (plant === 'RB-01') {
      const rooms = d.lines.filter((l) => l.revCode && +l.revCode.slice(0, 3) >= 10 && +l.revCode.slice(0, 3) <= 21);
      if (rooms.length > 1 || r.chance(0.5)) { d.copy(rooms[rooms.length - 1]!, { date: end }); tag('plant:RB-01:discharge-day-line'); }
      else { const l = rooms[0]!; l.qty = (l.qty ?? 1) + 1; l.amount = r2(l.qty * l.unitPrice!); tag('plant:RB-01:extra-unit'); }
    } else if (plant === 'DATE-01') {
      if (r.chance(0.5)) { const t = r.pick(plain().filter((l) => l.code)); t.date = addDays(end, r.int(1, 4)); tag('plant:DATE-01:moved'); }
      else { d.add(addDays(end, r.int(1, 4)), r.pick([LABS[3]!, LABS[5]!, it(undefined, '0250', 'PHARMACY MISC', [15, 90])])); tag('plant:DATE-01:added'); }
    } else if (plant === 'CANC-01') {
      if (r.chance(0.5)) { r.pick(plain()).notReceived = true; tag('plant:CANC-01:user-marked'); }
      else {
        const t = r.pick(plain());
        t.description = `${t.description} ${r.pick(['CANCELLED', 'NOT GIVEN', "D/C'D", 'RETURNED'])}`;
        tag('plant:CANC-01:keyword');
      }
    } else if (plant === 'RX-01') { oral(d, start, [10.5, 80], data); tag('plant:RX-01'); }
  }

  // ---------- money ----------
  const lines = d.lines;
  const total = r2(lines.reduce((a, l) => a + l.amount, 0));
  header.totalCharges = total;
  header.statementDate = minDate(addDays(end, r.int(10, 40)), addDays(TODAY, -2));
  if (p.kind !== 'professional') ctx.firstPostDischargeStatementDate = minDate(addDays(end, r.int(5, 20)), addDays(TODAY, -3));
  ctx.firstBillDate = minDate(addDays(end, r.int(5, 25)), addDays(TODAY, -3));
  ctx.state = hospitalBill ? hosp.state : r.pick(STATES);
  if (hospitalBill) { ctx.hospitalCcn = hosp.ccn; data.hospital[hosp.ccn] = { name: hosp.name, state: hosp.state, ownership: hosp.ownership, ownershipCategory: hosp.ownershipCategory }; }
  const ins = p.insurance;
  const oon = pl.has('NSA-01') || pl.has('NSA-02') || hn.has('nsa-compliant') || hn.has('nsa02-compliant');
  if (ins !== 'none') {
    ctx.insurerName = { commercial: 'Example Health Plan', marketplace: 'Example Marketplace Plan', medicare: 'Medicare', medicaid: 'State Medicaid', other: 'Example Benefit Trust' }[ins];
    if (pl.has('NSA-01') || hn.has('nsa-compliant')) { ctx.facilityInNetwork = false; ctx.oonClinicianTypes = []; }
    else if (pl.has('NSA-02') || hn.has('nsa02-compliant')) { ctx.facilityInNetwork = true; ctx.oonClinicianTypes = [ancType === 'assistant surgeon' || !ancType ? 'anesthesia' : ancType]; }
    else if (r.chance(0.75)) { ctx.facilityInNetwork = true; ctx.oonClinicianTypes = []; }
  }
  if (ins === 'none') {
    const pay = r.chance(0.2) ? r.money(25, Math.max(30, Math.min(300, total * 0.3))) : 0;
    const disc = r.chance(0.45) && !pl.has('GFE-01') ? r2(total * r.float(0.15, 0.45)) : 0;
    header.payments = pay; header.adjustments = disc; header.balanceDue = r2(total - pay - disc);
  } else if (pl.has('INS-01')) {
    header.payments = 0; header.adjustments = 0; header.balanceDue = total;
  } else {
    const ratio = ins === 'medicaid' ? r.float(0.15, 0.35) : r.float(0.3, 0.65);
    const allowed = r2(total * ratio);
    const eobEntered = !hn.has('ins-paid-no-eob') && (ins !== 'medicaid' || hn.has('medicaid-copay') || (pl.has('MCD-01') ? r.chance(0.5) : r.chance(0.5)));
    let ded = 0; let coins = 0; let copay = 0;
    if (ins === 'medicaid') copay = eobEntered ? (hn.has('medicaid-copay') ? r.pick([1, 2, 3, 4]) : r.pick([0, 1, 2, 3])) : 0;
    else {
      ded = r2(Math.min(allowed * r.float(0, pl.has('EOB-01') ? 0.3 : 0.7), r.float(0, 2500)));
      coins = r2((allowed - ded) * (ins === 'medicare' ? 0.2 : r.pick([0.1, 0.2, 0.3])));
      copay = r.chance(0.3) ? Math.min(r.pick([25, 50, 100, 250]), r2(allowed - ded - coins)) : 0;
    }
    const pr = r2(ded + coins + copay);
    const planPaid = r2(allowed - pr);
    const excess = r2(total - allowed);
    const adjustments: NonNullable<Eob['adjustments']> = [];
    let lineCo: { lineId: string; amount: number }[] = [];
    if (oon) adjustments.push({ group: 'OA', reason: '45', amount: excess });
    else if (r.chance(0.5)) {
      const pos = lines.filter((l) => l.amount > 0);
      let left = excess;
      lineCo = pos.map((l, k) => {
        const a = k === pos.length - 1 ? r2(left) : r2(l.amount * (1 - ratio) * (excess / r2(total * (1 - ratio) || 1)));
        left = r2(left - a);
        return { lineId: l.id, amount: a };
      }).filter((x) => x.amount > 0);
      lineCo.forEach((x) => adjustments.push({ group: 'CO', reason: '45', amount: x.amount, lineId: x.lineId }));
      tag('variant:eob-line-level-co');
    } else adjustments.push({ group: 'CO', reason: '45', amount: excess });
    if (ded) adjustments.push({ group: 'PR', reason: '1', amount: ded });
    if (coins) adjustments.push({ group: 'PR', reason: '2', amount: coins });
    if (copay) adjustments.push({ group: 'PR', reason: '3', amount: copay });
    const eob: Eob = { billed: total, allowed, planPaid, deductible: ded, copay, coinsurance: coins, patientResponsibility: pr, adjustments };
    let pay = planPaid; let adj = oon ? 0 : excess;
    if (oon && (hn.has('nsa-compliant') || hn.has('nsa02-compliant'))) adj = excess;
    const coBilled = () => (lineCo.length && r.chance(0.5) ? r.pick(lineCo).amount : excess);
    if (pl.has('EOB-01')) { const y = r2(Math.max(5, Math.min(planPaid * 0.5, r.float(25, 800)))); pay = r2(planPaid - y); tag('plant:EOB-01:unposted-payment'); }
    if (pl.has('EOB-02')) { adj = r2(excess - coBilled()); tag('plant:EOB-02:co-billed'); }
    if (pl.has('MCD-01')) { adj = r2(excess - coBilled()); tag(`plant:MCD-01:${eobEntered ? 'with-eob' : 'no-eob'}`); }
    if (hn.has('eob-under-1')) adj = r2(excess - r.money(0.3, 0.95));
    if (hn.has('eob-prepaid')) pay = r2(planPaid + Math.min(pr, r.money(10, 150)));
    header.payments = pay; header.adjustments = adj; header.balanceDue = r2(total - pay - adj);
    if (eobEntered) ctx.eob = eob;
    else if (ins === 'medicaid') tag('variant:medicaid-no-eob');
  }
  if (pl.has('MATH-02')) {
    if (ins === 'none' && r.chance(0.5)) { header.balanceDue = r2(header.balanceDue! + r.money(25, 400)); tag('plant:MATH-02:balance'); }
    else if (r.chance(0.5) && lines.length > 3 && !p.plants.some((q) => FIN.has(q))) { header.totalCharges = r2(total - r.pick(lines.filter((l) => l.amount > 0)).amount); tag('plant:MATH-02:line-left-out'); }
    else { header.totalCharges = r2(total + r.pick([-1, 1]) * r.money(10, 600)); tag('plant:MATH-02:total-off'); }
    if (!tagged(d, 'plant:MATH-02:balance')) header.balanceDue = r2(header.totalCharges - header.payments! - header.adjustments!);
  }
  // GFE / PPDR (uninsured)
  if (pl.has('GFE-01') || hn.has('gfe-399') || hn.has('gfe-121-days')) {
    ctx.scheduledAhead = true;
    for (const l of lines) if (!l.provider) l.provider = providerName;
    const provs = [...new Set(lines.map((l) => l.provider!))];
    const target = r.pick(provs);
    ctx.gfe = provs.map((pv) => {
      const billed = r2(lines.filter((l) => l.provider === pv).reduce((a, l) => a + l.amount, 0));
      if (pv !== target) return { provider: pv, total: r2(billed + r.money(0, 300)) };
      const gap = hn.has('gfe-399') ? (r.chance(0.3) ? 399.99 : r.money(380, 399.5)) : pl.has('GFE-01') && r.chance(0.15) ? 400 : r.money(400.01, Math.max(450, billed * 0.6));
      return { provider: pv, total: r2(billed - gap) };
    });
    ctx.firstBillDate = addDays(TODAY, -gfeAge);
    if (pl.has('GFE-01')) tag(gfeAge === 120 ? 'plant:GFE-01:day-120' : 'plant:GFE-01');
  }
  if (pl.has('PPDR-01') || hn.has('ppdr-before')) {
    const filed = addDays(TODAY, -r.int(15, 60));
    ctx.firstBillDate = addDays(filed, -r.int(10, 100)) < addDays(end, 5) ? addDays(end, 5) : addDays(filed, -r.int(10, 100));
    ctx.ppdrFiledDate = filed;
    ctx.collections = pl.has('PPDR-01')
      ? [{ date: r.chance(0.15) ? filed : addDays(filed, r.int(1, 14)), kind: r.pick(['collections', 'late_fee', 'credit_report'] as const) }]
      : [{ date: addDays(filed, -r.int(3, 9)), kind: r.pick(['late_fee', 'collections'] as const) }];
    if (pl.has('PPDR-01')) tag('plant:PPDR-01');
  }
  // ECA / CR
  const S = ctx.firstPostDischargeStatementDate;
  const evDate = (lo: number, hi: number) => minDate(addDays(S!, r.int(lo, hi)), addDays(TODAY, -1));
  if (pl.has('ECA-01')) {
    const v = r.pick(['early', 'early', 'no-notice', 'short-notice', 'fap-pending']);
    const kind = r.pick(['credit_report', 'lawsuit', 'wage_garnishment'] as const);
    let ev: CollectionEvent;
    if (v === 'early') ev = { date: addDays(S!, r.int(20, 110)), kind };
    else if (v === 'no-notice') ev = { date: evDate(125, 200), kind };
    else if (v === 'short-notice') { const dt = evDate(130, 200); ev = { date: dt, kind, noticeDate: addDays(dt, -r.int(5, 20)) }; }
    else {
      ctx.fapApplied = true; ctx.fapAppliedDate = addDays(S!, r.int(40, 100));
      const dt = evDate(125, 160); ev = { date: dt, kind, noticeDate: addDays(dt, -r.int(30, 60)) };
    }
    ctx.collections = [ev]; tag(`plant:ECA-01:${v}`);
  }
  if (hn.has('eca-proper')) { const dt = evDate(130, 200); ctx.collections = [{ date: dt, kind: r.pick(['credit_report', 'lawsuit'] as const), noticeDate: addDays(dt, -r.int(30, 60)) }]; }
  if (hn.has('eca-agency-referral')) ctx.collections = [{ date: addDays(S!, r.int(20, 110)), kind: 'collections' }];
  if (hn.has('eca-late-fee')) ctx.collections = [{ date: addDays(S!, r.int(20, 110)), kind: 'late_fee' }];
  if (hn.has('eca-forprofit')) ctx.collections = [{ date: addDays(S!, r.int(20, 110)), kind: 'credit_report' }];
  if (pl.has('CR-01')) {
    ctx.onCreditReport = true;
    const v = p.kind === 'professional' ? r.pick(['paid', 'small']) : r.pick(['paid', 'small', 'recent']);
    ctx.paidInFull = v === 'paid';
    ctx.originalBalance = v === 'small' ? r.money(50, 499.99) : r.money(500, 6000);
    tag(`plant:CR-01:${v}`);
  }
  if (hn.has('cr-legit')) { ctx.onCreditReport = true; ctx.paidInFull = false; ctx.originalBalance = r.chance(0.3) ? 500 : r.money(500.01, 8000); }
  if (hn.has('cr-not-reported')) { ctx.onCreditReport = false; ctx.paidInFull = r.chance(0.5); ctx.originalBalance = r.money(80, 3000); }

  // ---------- fixture slice ----------
  const codes = new Set(lines.map((l) => l.code).filter((c): c is string => !!c));
  for (const c of codes) if (MUE_TABLE[c]) data.mue[c] = MUE_TABLE[c]!;
  data.ncciPtp = PTP_TABLE.filter((e) => codes.has(e.col1) && codes.has(e.col2));

  const bill: Bill = { header, lines, confirmed: true };
  const labels = labelBill(bill, ctx, data);
  return {
    id: `fc-${p.version}-${String(p.i + 1).padStart(3, '0')}`, kind: p.kind, sub: p.sub, seed: p.seed,
    clean: labels.length === 0, bill, ctx, data, labels, plants: p.plants, tags: d.tags,
  };
}
const tagged = (d: Draft, t: string) => d.tags.includes(t);

export function generateCorpus(seed = BASE_SEED, perKind = 100, version = CORPUS_VERSION): CorpusItem[] {
  return makePlans(seed, perKind, version).map(buildItem);
}

export function generateHoldout(): CorpusItem[] {
  return generateCorpus(HOLDOUT_SEED, HOLDOUT_PER_KIND, HOLDOUT_VERSION);
}

export function writeCorpus(items: CorpusItem[], dir: string, meta: { version: string; seed: number } = { version: CORPUS_VERSION, seed: BASE_SEED }) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const item of items) writeFileSync(join(dir, `${item.id}.json`), JSON.stringify(item, null, 1) + '\n');
  const count = (f: (i: CorpusItem) => string[]) => items.flatMap(f).reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});
  const manifest = {
    corpusVersion: meta.version, seed: meta.seed, today: TODAY, bills: items.length,
    byKind: count((i) => [i.kind]), bySub: count((i) => [`${i.kind}/${i.sub}`]),
    clean: items.filter((i) => i.clean).length,
    labels: items.reduce((a, i) => a + i.labels.length, 0),
    labelsByRule: count((i) => i.labels.map((l) => l.ruleId)),
    plantsByRule: count((i) => i.plants),
    hardNegatives: count((i) => i.tags.filter((t) => t.startsWith('hn:'))),
    variants: count((i) => i.tags.filter((t) => !t.startsWith('hn:'))),
    note: 'Synthetic only. Fake patients/providers/accounts/NDCs/CCNs; generic descriptions; MUE/NCCI/NADAC fixture values are synthetic stand-ins, not CMS data.',
    files: items.map((i) => `${i.id}.json`),
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  return manifest;
}

export const CORPUS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', CORPUS_VERSION);
export const HOLDOUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', HOLDOUT_VERSION);
