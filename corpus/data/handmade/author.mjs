// Hand-made QA set (lane Q1, 2026-10-02). Written by hand from SPEC §3 BEFORE the engine was run on any of
// these bills and without reading the rule code. Labels are what a careful human reviewer expects a correct
// checker to flag. `optional` labels are acceptable but not required (they never count as misses); with
// `maxConfidence`, a finding above that confidence counts as a false positive. All names, accounts and
// providers are fictional. RX-01 uses real NADAC unit prices (week of 2026-09-23); MUE and NCCI values are
// SYNTHETIC test values, not CMS data. Run: node corpus/data/handmade/author.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-10-02';
const emptyData = () => ({ mue: {}, ncciPtp: [], nadac: {}, hospital: {} });
const NADAC = {
  '00378668910': { unitPrice: 0.03577, unit: 'EA', effective: '2026-09-23' }, // pantoprazole 40 mg tab
  '00536132701': { unitPrice: 0.02333, unit: 'EA', effective: '2026-09-23' }, // acetaminophen 325 mg tab
  '00093314701': { unitPrice: 0.12004, unit: 'EA', effective: '2026-09-23' }, // cephalexin 500 mg cap
};
const FAIRHAVEN = { '999001': { name: 'FAIRHAVEN COMMUNITY HOSPITAL', state: 'OH', ownership: 'Voluntary non-profit - Private', ownershipCategory: 'nonprofit' } };
let n = 0;
const L = (date, description, amount, x = {}) => ({ id: `l${++n}`, date, description, amount, ...x });
const sum = (lines) => Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
const bills = [];
function bill(id, format, sub, header, lines, ctx, labels, notes, data = emptyData()) {
  n = 0;
  const ls = lines();
  const total = sum(ls);
  const h = { totalCharges: total, payments: 0, adjustments: 0, ...header };
  if (h.balanceDue === undefined) h.balanceDue = Math.round((h.totalCharges - h.payments - h.adjustments) * 100) / 100;
  bills.push({ id, kind: sub.startsWith('ed') ? 'ed' : sub === 'stay' ? 'inpatient' : 'professional', sub, format, seed: 0,
    clean: labels.filter((l) => !l.optional).length === 0, bill: { header: h, lines: ls, confirmed: true },
    ctx: { today: TODAY, ...ctx }, data, labels, plants: [...new Set(labels.filter((l) => !l.optional).map((l) => l.ruleId))], tags: ['handmade'], notes });
}

// HM01: UB-04-style inpatient statement, commercial, consistent EOB. 3 nights billed as 4 room days; an X-ray
// dated two days after discharge; a pill at ~500x NADAC. Trap: a per-day monitor on 4 calendar days (incl. the
// discharge day) is normal per-day billing, not a quantity error.
bill('hm-01', 'UB-04-style hospital statement (inpatient)', 'stay',
  { patientName: 'Dana Q. Sample', providerName: 'Lakeview Regional Medical Center', accountNumber: 'HM01-4471', admitDate: '2026-08-03', dischargeDate: '2026-08-06', statementDate: '2026-08-20', payments: 3280, adjustments: 4813 },
  () => [
    L('2026-08-03', 'ROOM-BOARD/SEMI', 7400, { revCode: '0120', qty: 4, unitPrice: 1850 }),
    L('2026-08-03', 'ADMISSION KIT', 85, { revCode: '0270', qty: 1, unitPrice: 85 }),
    L('2026-08-03', 'METABOLIC PANEL COMP', 312, { revCode: '0300', code: '80053', qty: 1, unitPrice: 312 }),
    L('2026-08-04', 'CBC W/DIFF', 98, { revCode: '0300', code: '85025', qty: 1, unitPrice: 98 }),
    L('2026-08-04', 'PANTOPRAZOLE 40MG TAB', 18, { revCode: '0250', ndc: '00378668910', qty: 1, unitPrice: 18 }),
    L('2026-08-03', 'PULSE OXIMETRY DAILY', 180, { revCode: '0460', qty: 4, unitPrice: 45 }),
    L('2026-08-05', 'XR CHEST 2 VIEWS', 410, { revCode: '0320', code: '71046', qty: 1, unitPrice: 410 }),
    L('2026-08-08', 'XR CHEST 2 VIEWS', 410, { revCode: '0320', code: '71046', qty: 1, unitPrice: 410 }),
  ],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', admitted: true, facilityInNetwork: true, firstBillDate: '2026-08-20', state: 'OH',
    eob: { billed: 8913, allowed: 4100, planPaid: 3280, deductible: 500, coinsurance: 320, patientResponsibility: 820, adjustments: [{ group: 'CO', reason: '45', amount: 4813 }] } },
  [{ ruleId: 'RB-01', lineIds: ['l1'] }, { ruleId: 'DATE-01', lineIds: ['l8'] }, { ruleId: 'RX-01', lineIds: ['l5'] }],
  'Must NOT flag: QTY-01 on l6 (per-day item on 4 calendar days), DUP-02 on l7/l8 (different dates).',
  { ...emptyData(), nadac: { '00378668910': NADAC['00378668910'] } });

// HM02: ED facility bill, in-network, commercial. Identical CT billed twice; the insurer denied the duplicate
// (CO-18) and wrote off the contractual amount (CO-45), but the hospital billed the patient for everything unpaid.
bill('hm-02', 'ED facility bill', 'ed',
  { patientName: 'Riley M. Sample', providerName: 'St. Brendan Medical Center', accountNumber: 'HM02-0193', statementDate: '2026-08-01', payments: 3150 },
  () => [
    L('2026-07-14', 'ER VISIT LEVEL 4', 2850, { revCode: '0450', code: '99284', qty: 1, unitPrice: 2850 }),
    L('2026-07-14', 'CBC W/DIFF', 96, { revCode: '0300', code: '85025', qty: 1, unitPrice: 96 }),
    L('2026-07-14', 'METABOLIC PANEL COMP', 340, { revCode: '0301', code: '80053', qty: 1, unitPrice: 340 }),
    L('2026-07-14', 'CT ABD/PELVIS W CONTRAST', 4980, { revCode: '0352', code: '74177', qty: 1, unitPrice: 4980 }),
    L('2026-07-14', 'CT ABD/PELVIS W CONTRAST', 4980, { revCode: '0352', code: '74177', qty: 1, unitPrice: 4980 }),
    L('2026-07-14', 'ONDANSETRON INJ 1MG', 75, { revCode: '0636', code: 'J2405', qty: 4, unitPrice: 18.75 }),
    L('2026-07-14', 'IV PUSH SINGLE/INITIAL', 610, { revCode: '0260', code: '96374', qty: 1, unitPrice: 610 }),
    L('2026-07-14', 'CONTRAST MEDIA PER ML', 120, { revCode: '0255', code: 'Q9967', qty: 100, unitPrice: 1.2 }),
  ],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', emergency: true, facilityInNetwork: true, firstBillDate: '2026-08-01', state: 'PA',
    eob: { billed: 14051, allowed: 3900, planPaid: 3150, deductible: 500, coinsurance: 250, patientResponsibility: 750,
      adjustments: [{ group: 'CO', reason: '45', amount: 5171 }, { group: 'CO', reason: '18', amount: 4980, lineId: 'l5' }] } },
  [{ ruleId: 'DUP-01', lineIds: ['l4', 'l5'] }, { ruleId: 'EOB-01', lineIds: [] }, { ruleId: 'EOB-02', lineIds: [] }],
  'Must NOT flag: NSA-01/NSA-02 (facility in network, no out-of-network clinician), INS-01 (insurer paid).');

// HM03: ED physician bill from an out-of-network emergency group at an in-network hospital (same visit as HM02).
bill('hm-03', 'ED physician bill (out-of-network group)', 'ed',
  { patientName: 'Riley M. Sample', providerName: 'Summit Emergency Physicians LLC', accountNumber: 'HM03-77810', statementDate: '2026-08-05', payments: 320 },
  () => [
    L('2026-07-14', 'EMERGENCY DEPT VISIT', 1380, { code: '99284', qty: 1, unitPrice: 1380 }),
    L('2026-07-14', 'ECG INTERPRETATION', 70, { code: '93010', qty: 1, unitPrice: 70 }),
  ],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', emergency: true, facilityInNetwork: true, oonClinicianTypes: ['emergency medicine'], firstBillDate: '2026-08-05', state: 'PA',
    eob: { billed: 1450, allowed: 420, planPaid: 320, copay: 100, patientResponsibility: 100, adjustments: [] } },
  [{ ruleId: 'NSA-01', lineIds: [] }, { ruleId: 'EOB-01', lineIds: [] }, { ruleId: 'NSA-02', lineIds: [], optional: true }],
  'NSA-02 is optional: emergency medicine at an in-network facility is also an ancillary type, so it is true but redundant with NSA-01.');

// HM04: pharmacy-heavy observation stay (outpatient), commercial, consistent EOB. Repeat ondansetron doses billed
// as identical lines (legitimate q8h dosing is common); JW waste line; cephalexin qty x unit != amount; pills at
// hundreds of times NADAC.
bill('hm-04', 'Pharmacy-heavy observation stay (itemized)', 'ed-obs',
  { patientName: 'Morgan T. Sample', providerName: 'Lakeview Regional Medical Center', accountNumber: 'HM04-5520', statementDate: '2026-09-20', payments: 1160, adjustments: 1772 },
  () => [
    L('2026-09-02', 'OBSERVATION PER HR', 2090, { revCode: '0762', code: 'G0378', qty: 22, unitPrice: 95 }),
    L('2026-09-02', 'ONDANSETRON INJ 1MG', 75, { revCode: '0636', code: 'J2405', qty: 4, unitPrice: 18.75 }),
    L('2026-09-02', 'ONDANSETRON INJ 1MG', 75, { revCode: '0636', code: 'J2405', qty: 4, unitPrice: 18.75 }),
    L('2026-09-02', 'KETOROLAC INJ 15MG', 48, { revCode: '0636', code: 'J1885', qty: 2, unitPrice: 24 }),
    L('2026-09-02', 'FENTANYL CITRATE INJ 0.1MG', 31, { revCode: '0636', code: 'J3010', qty: 1, unitPrice: 31 }),
    L('2026-09-02', 'MORPHINE SULFATE INJ 10MG', 28, { revCode: '0636', code: 'J2270', qty: 1, unitPrice: 28 }),
    L('2026-09-02', 'CEFTRIAXONE 250MG', 88, { revCode: '0636', code: 'J0696', qty: 4, unitPrice: 22 }),
    L('2026-09-02', 'CEFTRIAXONE 250MG WASTE', 44, { revCode: '0636', code: 'J0696', modifiers: ['JW'], qty: 2, unitPrice: 22 }),
    L('2026-09-02', 'ACETAMINOPHEN 325MG TAB', 19, { revCode: '0250', ndc: '00536132701', qty: 2, unitPrice: 9.5 }),
    L('2026-09-03', 'CEPHALEXIN 500MG CAP', 500, { revCode: '0250', ndc: '00093314701', qty: 4, unitPrice: 12.5 }),
    L('2026-09-02', 'IV SOLUTION NS 1000ML', 128, { revCode: '0258', code: 'J7030', qty: 2, unitPrice: 64 }),
    L('2026-09-02', 'CBC W/DIFF', 96, { revCode: '0300', code: '85025', qty: 1, unitPrice: 96 }),
  ],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', admitted: false, observation: true, facilityInNetwork: true, firstBillDate: '2026-09-20', state: 'OH',
    eob: { billed: 3222, allowed: 1450, planPaid: 1160, deductible: 200, coinsurance: 90, patientResponsibility: 290, adjustments: [{ group: 'CO', reason: '45', amount: 1772 }] } },
  [{ ruleId: 'MATH-01', lineIds: ['l10'] }, { ruleId: 'RX-01', lineIds: ['l9'] }, { ruleId: 'RX-01', lineIds: ['l10'] },
    { ruleId: 'DUP-01', lineIds: ['l2', 'l3'], optional: true, maxConfidence: 'medium' }],
  'DUP-01 on the repeat ondansetron doses is acceptable to ASK about, but only at Medium or lower (repeat doses are routine). Must NOT flag: DUP-02 on l7/l8 (JW waste), QTY-01 on l1 (22 h).',
  { ...emptyData(), nadac: { '00536132701': NADAC['00536132701'], '00093314701': NADAC['00093314701'] } });

// HM05: credits and reversals (outpatient facility). Charge/reverse/repost, charge/credit/rebill, bilateral X-rays,
// a cancelled drug that was credited, a returned sling that was NOT credited, and a statement balance off by $250.
bill('hm-05', 'Outpatient statement with credits and reversals', 'proc',
  { patientName: 'Jordan P. Sample', providerName: 'Lakeview Regional Medical Center', accountNumber: 'HM05-3308', statementDate: '2026-07-02', payments: 610, adjustments: 340, balanceDue: 552.4 },
  () => [
    L('2026-06-10', 'DEXAMETHASONE INJ 1MG', 31, { revCode: '0636', code: 'J1100', qty: 10, unitPrice: 3.1 }),
    L('2026-06-10', 'DEXAMETHASONE INJ 1MG REV', -31, { revCode: '0636', code: 'J1100', qty: -10, unitPrice: 3.1 }),
    L('2026-06-10', 'DEXAMETHASONE INJ 1MG', 12.4, { revCode: '0636', code: 'J1100', qty: 4, unitPrice: 3.1 }),
    L('2026-06-10', 'XR SHOULDER 2+ VIEWS', 365, { revCode: '0320', code: '73030', modifiers: ['RT'], qty: 1, unitPrice: 365 }),
    L('2026-06-10', 'XR SHOULDER 2+ VIEWS', 365, { revCode: '0320', code: '73030', modifiers: ['LT'], qty: 1, unitPrice: 365 }),
    L('2026-06-10', 'IV START KIT', 42, { revCode: '0270', qty: 1, unitPrice: 42 }),
    L('2026-06-10', 'IV START KIT CR', -42, { revCode: '0270', qty: 1, unitPrice: 42 }),
    L('2026-06-10', 'IV START KIT', 42, { revCode: '0270', qty: 1, unitPrice: 42 }),
    L('2026-06-10', 'SLING SHOULDER - RETURNED', 58, { revCode: '0272', qty: 1, unitPrice: 58 }),
    L('2026-06-10', 'CLINIC VISIT', 410, { revCode: '0510', code: 'G0463', qty: 1, unitPrice: 410 }),
    L('2026-06-10', 'PROMETHAZINE INJ 50MG CANCELLED', 22, { revCode: '0636', code: 'J2550', qty: 1, unitPrice: 22 }),
    L('2026-06-10', 'PROMETHAZINE INJ 50MG CANCELLED', -22, { revCode: '0636', code: 'J2550', qty: -1, unitPrice: 22 }),
  ],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', facilityInNetwork: true, firstBillDate: '2026-07-02', state: 'OH' },
  [{ ruleId: 'CANC-01', lineIds: ['l9'] }, { ruleId: 'MATH-02', lineIds: [] }],
  'Must NOT flag: DUP-01/DUP-02/MATH-01 on any reversal pair (l1-l3, l6-l8, l11-l12), DUP-01 on bilateral l4/l5, CANC-01 on the credited promethazine.');

// HM06: Medicaid patient. Medicaid paid and the hospital posted its adjustment, but a $340 balance is billed to
// the patient (no EOB; Medicaid patients often get none).
bill('hm-06', 'ED facility bill, Medicaid patient', 'ed',
  { patientName: 'Casey L. Sample', providerName: 'Harbor Point Hospital', accountNumber: 'HM06-1180', statementDate: '2026-09-10', payments: 412, adjustments: 1242 },
  () => [
    L('2026-08-22', 'ER VISIT LEVEL 3', 1640, { revCode: '0450', code: '99283', qty: 1, unitPrice: 1640 }),
    L('2026-08-22', 'URINALYSIS AUTO W/SCOPE', 64, { revCode: '0300', code: '81001', qty: 1, unitPrice: 64 }),
    L('2026-08-22', 'XR CHEST 1 VIEW', 290, { revCode: '0320', code: '71045', qty: 1, unitPrice: 290 }),
  ],
  { insurance: 'medicaid', emergency: true, firstBillDate: '2026-09-10', state: 'NY' },
  [{ ruleId: 'MCD-01', lineIds: [] }],
  'Must NOT flag: INS-01 (Medicaid paid), NSA-01/02 (no out-of-network context, no EOB).');

// HM07: uninsured, scheduled knee scope at a surgery center. Bill is $900 over the Good Faith Estimate (>= $400,
// 84 days after the first bill). The patient filed a federal dispute (PPDR) and then got a late fee.
bill('hm-07', 'Uninsured surgery-center bill with a Good Faith Estimate', 'sched',
  { patientName: 'Avery K. Sample', providerName: 'Riverside Surgery Center', accountNumber: 'HM07-2209', statementDate: '2026-07-10' },
  () => [
    L('2026-06-18', 'ARTHROSCOPY KNEE - FACILITY', 3900, { code: '29881', qty: 1, unitPrice: 3900, provider: 'Riverside Surgery Center' }),
    L('2026-06-18', 'ANESTHESIA SUPPLIES', 420, { revCode: '0370', qty: 1, unitPrice: 420, provider: 'Riverside Surgery Center' }),
    L('2026-06-18', 'RECOVERY ROOM', 780, { revCode: '0710', qty: 1, unitPrice: 780, provider: 'Riverside Surgery Center' }),
  ],
  { insurance: 'none', scheduledAhead: true, gfe: [{ provider: 'Riverside Surgery Center', total: 4200 }, { provider: 'Valley Anesthesia Associates', total: 900 }],
    firstBillDate: '2026-07-10', ppdrFiledDate: '2026-09-08', collections: [{ date: '2026-09-25', kind: 'late_fee' }], state: 'FL' },
  [{ ruleId: 'GFE-01', lineIds: [] }, { ruleId: 'PPDR-01', lineIds: [] }],
  'Must NOT flag: INS-01 (uninsured), any EOB rule.');

// HM08: same patient, anesthesia group, $350 over its GFE (under the $400 line). Clean bill (hard negative).
bill('hm-08', 'Uninsured anesthesia bill under the GFE threshold', 'sched',
  { patientName: 'Avery K. Sample', providerName: 'Valley Anesthesia Associates', accountNumber: 'HM08-6610', statementDate: '2026-07-15' },
  () => [L('2026-06-18', 'ANESTHESIA SERVICES - KNEE', 1250, { code: '01400', qty: 1, unitPrice: 1250, provider: 'Valley Anesthesia Associates' })],
  { insurance: 'none', scheduledAhead: true, gfe: [{ provider: 'Riverside Surgery Center', total: 4200 }, { provider: 'Valley Anesthesia Associates', total: 900 }],
    firstBillDate: '2026-07-15', state: 'FL' },
  [],
  'Clean: $350 over the GFE is below the $400 dispute threshold.');

// HM09: out-of-network anesthesiologist at an in-network hospital, scheduled (non-emergency) surgery, commercial.
bill('hm-09', 'OON anesthesiologist at an in-network hospital', 'proc',
  { patientName: 'Quinn R. Sample', providerName: 'Crescent Anesthesia Partners', accountNumber: 'HM09-90412', statementDate: '2026-09-12', payments: 544 },
  () => [L('2026-08-27', 'ANESTHESIA SVCS 132 MIN', 2316, { code: '00790', qty: 1, unitPrice: 2316 })],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', emergency: false, facilityInNetwork: true, oonClinicianTypes: ['anesthesia'], firstBillDate: '2026-09-12', state: 'OH',
    eob: { billed: 2316, allowed: 680, planPaid: 544, coinsurance: 136, patientResponsibility: 136, adjustments: [] } },
  [{ ruleId: 'NSA-02', lineIds: [] }, { ruleId: 'EOB-01', lineIds: [] }],
  'Must NOT flag: NSA-01 (not emergency, not air ambulance).');

// HM10: self-pay physician office bill. ECG global + ECG interpretation on the same day (MI 0, synthetic pair);
// office visit + skin biopsy the same day with NO modifier 25 printed (itemized statements often drop modifiers).
bill('hm-10', 'Physician office bill (self-pay)', 'office',
  { patientName: 'Sky N. Sample', providerName: 'Northgate Family Medicine', accountNumber: 'HM10-3021', statementDate: '2026-09-15' },
  () => [
    L('2026-09-09', 'OFFICE VISIT EST PT', 245, { code: '99214', qty: 1, unitPrice: 245 }),
    L('2026-09-09', 'SKIN BIOPSY', 310, { code: '11102', qty: 1, unitPrice: 310 }),
    L('2026-09-09', 'ECG W/INTERPRETATION', 95, { code: '93000', qty: 1, unitPrice: 95 }),
    L('2026-09-09', 'ECG INTERP ONLY', 40, { code: '93010', qty: 1, unitPrice: 40 }),
    L('2026-09-09', 'VENIPUNCTURE', 25, { code: '36415', qty: 1, unitPrice: 25 }),
    L('2026-09-09', 'PATHOLOGY TISSUE EXAM', 180, { code: '88305', qty: 1, unitPrice: 180 }),
  ],
  { insurance: 'none', scheduledAhead: false, firstBillDate: '2026-09-15', state: 'OH' },
  [{ ruleId: 'NCCI-01', lineIds: ['l4'] }, { ruleId: 'NCCI-01', lineIds: ['l1'], optional: true, maxConfidence: 'low' }],
  'NCCI-01 on the office visit (MI 1 pair, no modifier printed) is acceptable only at Low: the claim likely carried modifier 25 even though the statement omits it (RESEARCH E12).',
  { ...emptyData(), ncciPtp: [{ col1: '93000', col2: '93010', mi: 0, effective: '2026-01-01' }, { col1: '11102', col2: '99214', mi: 1, effective: '2026-01-01' }] });

// HM11: outpatient hospital (facility) bill with revenue codes. Ondansetron 8 units is within the (synthetic)
// outpatient-hospital limit but over the practitioner one; dexamethasone 40 units is over both.
const mue11 = { J2405: { practitioner: { mue: 4, mai: 3 }, outpatient: { mue: 8, mai: 3 } }, J1100: { practitioner: { mue: 20, mai: 3 }, outpatient: { mue: 20, mai: 3 } },
  '85025': { practitioner: { mue: 1, mai: 2 }, outpatient: { mue: 1, mai: 2 } }, '96365': { practitioner: { mue: 1, mai: 2 }, outpatient: { mue: 1, mai: 2 } },
  '96366': { practitioner: { mue: 8, mai: 3 }, outpatient: { mue: 8, mai: 3 } } };
const hm11Lines = (withRev) => () => [
  L('2026-09-15', 'ONDANSETRON INJ 1MG', 150, { ...(withRev && { revCode: '0636' }), code: 'J2405', qty: 8, unitPrice: 18.75 }),
  L('2026-09-15', 'DEXAMETHASONE INJ 1MG', 124, { ...(withRev && { revCode: '0636' }), code: 'J1100', qty: 40, unitPrice: 3.1 }),
  L('2026-09-15', 'CBC W/DIFF', 96, { ...(withRev && { revCode: '0300' }), code: '85025', qty: 1, unitPrice: 96 }),
  L('2026-09-15', 'IV INFUSION INITIAL 1HR', 720, { ...(withRev && { revCode: '0260' }), code: '96365', qty: 1, unitPrice: 720 }),
  L('2026-09-15', 'IV INFUSION ADDL HR', 540, { ...(withRev && { revCode: '0260' }), code: '96366', qty: 3, unitPrice: 180 }),
];
const ctx11 = { insurance: 'commercial', insurerName: 'Bluebird Health Plan', admitted: false, observation: false, facilityInNetwork: true, firstBillDate: '2026-09-25', state: 'OH' };
bill('hm-11', 'Outpatient infusion facility bill (revenue codes printed)', 'proc',
  { patientName: 'Harper J. Sample', providerName: 'Lakeshore Outpatient Pavilion', accountNumber: 'HM11-7781', statementDate: '2026-09-25', payments: 700, adjustments: 600 },
  hm11Lines(true), ctx11,
  [{ ruleId: 'MUE-01', lineIds: ['l2'] }],
  'Must NOT flag: MUE-01 on l1 (8 units is within the outpatient-hospital limit).', { ...emptyData(), mue: mue11 });
bill('hm-11b', 'Same facility bill after a parser dropped the revenue codes', 'proc',
  { patientName: 'Harper J. Sample', providerName: 'Lakeshore Outpatient Pavilion', accountNumber: 'HM11-7781', statementDate: '2026-09-25', payments: 700, adjustments: 600 },
  hm11Lines(false), ctx11,
  [{ ruleId: 'MUE-01', lineIds: ['l2'] }],
  'Truth is unchanged (facility bill); an MUE-01 on l1 here means the setting came from missing revenue codes.', { ...emptyData(), mue: mue11 });

// HM12: nonprofit hospital reported a $380 balance to the credit bureaus 56 days after the first statement.
bill('hm-12', 'Nonprofit hospital ED bill reported to credit early', 'ed',
  { patientName: 'Rowan E. Sample', providerName: 'Fairhaven Community Hospital', accountNumber: 'HM12-5150', statementDate: '2026-04-20', payments: 600 },
  () => [L('2026-04-02', 'ER VISIT LEVEL 2', 980, { revCode: '0450', code: '99282', qty: 1, unitPrice: 980 })],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', emergency: true, facilityInNetwork: true, hospitalCcn: '999001', firstBillDate: '2026-04-20', firstPostDischargeStatementDate: '2026-04-20',
    collections: [{ date: '2026-06-15', kind: 'credit_report' }], onCreditReport: true, paidInFull: false, originalBalance: 380, state: 'OH' },
  [{ ruleId: 'ECA-01', lineIds: [] }, { ruleId: 'CR-01', lineIds: [] }],
  'Must NOT flag: INS-01 (insurer paid).', { ...emptyData(), hospital: FAIRHAVEN });

// HM13: uninsured inpatient at a nonprofit hospital. Agency referral at day 54 (not an ECA by itself), an "other"
// event at day 70 (the patient's note: debt sold), and a lawsuit at day 136 with only 13 days' written notice.
bill('hm-13', 'Nonprofit hospital inpatient bill in collections', 'stay',
  { patientName: 'Emerson B. Sample', providerName: 'Fairhaven Community Hospital', accountNumber: 'HM13-0417', admitDate: '2026-01-10', dischargeDate: '2026-01-12', statementDate: '2026-01-25' },
  () => [
    L('2026-01-10', 'ROOM-BOARD/PVT', 4200, { revCode: '0110', qty: 2, unitPrice: 2100 }),
    L('2026-01-11', 'BASIC METABOLIC PANEL', 180, { revCode: '0300', code: '80048', qty: 1, unitPrice: 180 }),
    L('2026-01-11', 'PHARMACY', 260, { revCode: '0250', qty: 1, unitPrice: 260 }),
  ],
  { insurance: 'none', admitted: true, emergency: true, hospitalCcn: '999001', firstBillDate: '2026-01-25', firstPostDischargeStatementDate: '2026-01-25',
    collections: [{ date: '2026-03-20', kind: 'collections' }, { date: '2026-04-05', kind: 'other' }, { date: '2026-06-10', kind: 'lawsuit', noticeDate: '2026-05-28' }],
    householdSize: 3, annualIncome: 38000, state: 'OH' },
  [{ ruleId: 'ECA-01', lineIds: [] }],
  'ECA-01 is required because of the lawsuit with 13 days notice. Must NOT flag: RB-01 (2 room days, 2 nights).', { ...emptyData(), hospital: FAIRHAVEN });

// HM14: commercially insured patient; the lab bill shows only a prompt-pay discount, no insurance payment.
bill('hm-14', 'Lab bill never sent to insurance (prompt-pay discount only)', 'office',
  { patientName: 'Finley S. Sample', providerName: 'Clearwater Diagnostics Lab', accountNumber: 'HM14-2290', statementDate: '2026-09-12', adjustments: 40.95 },
  () => [
    L('2026-08-30', 'LIPID PANEL', 145, { code: '80061', qty: 1, unitPrice: 145 }),
    L('2026-08-30', 'HEMOGLOBIN A1C', 98, { code: '83036', qty: 1, unitPrice: 98 }),
    L('2026-08-30', 'VENIPUNCTURE', 30, { code: '36415', qty: 1, unitPrice: 30 }),
  ],
  { insurance: 'commercial', insurerName: 'Bluebird Health Plan', firstBillDate: '2026-09-12', state: 'OH' },
  [{ ruleId: 'INS-01', lineIds: [] }],
  'The only adjustment is a self-pay prompt-pay discount; nothing shows the claim reached the insurer.');

for (const b of bills) writeFileSync(join(dir, `${b.id}.json`), JSON.stringify(b, null, 1) + '\n');
const byKind = bills.reduce((m, b) => ({ ...m, [b.kind]: (m[b.kind] ?? 0) + 1 }), {});
writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ seed: 0, files: bills.map((b) => `${b.id}.json`), byKind,
  note: 'Hand-made by lane Q1 on 2026-10-02 from SPEC §3, labels written before the engine ran. Not generated.' }, null, 1) + '\n');
console.log(bills.map((b) => `${b.id} ${b.format}: ${b.labels.map((l) => l.ruleId + (l.optional ? '?' : '')).join(', ') || 'clean'}`).join('\n'));
