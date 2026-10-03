import { describe, expect, it } from 'vitest';
import { parseBill, parseText } from '../parse';
import type { PositionedItem } from '../types';

// --- Fixture 1: hospital UB-style (inpatient, revenue codes + HCPCS, room days) ---
const HOSPITAL_UB = `
Provider: Springfield General Hospital
Patient: Jane Q Public
Account: 100293847
Admit: 03/10/2026
Discharge: 03/13/2026
Statement Date: 03/20/2026

03/10/2026  0110  Room & Board Semi-Private  3  1200.00  3600.00
03/10/2026  0450  J0696  Emergency Room Visit  1  850.00  850.00
03/11/2026  0300  Laboratory Services  1  420.00  420.00
03/11/2026  0636  J1745  Infliximab Injection  2  315.50  631.00
03/12/2026  0710  Recovery Room  1  500.00  500.00

Total Charges: 6001.00
Payments: 0.00
Adjustments: 0.00
Balance Due: 6001.00
`;

// --- Fixture 2: ED / outpatient (revenue + CPT-shaped codes, a modifier) ---
const ED_OUTPATIENT = `
Provider: Lakeside Emergency Physicians
Patient: Carlos Mendez
Account: ED-55214
Statement Date: 06/02/2026

06/01/2026  0450  99284  ED Visit Level 4  1  1450.00  1450.00
06/01/2026  0730  71046  Chest X-Ray 2 Views  1  310.00  310.00
06/01/2026  99284  25  Separate E/M Service  1  200.00  200.00
06/01/2026  0250  Pharmacy  2  45.00  90.00

Total Charges: 2050.00
Balance Due: 2050.00
`;

// --- Fixture 3: physician / professional office visit (CPT-shaped + modifiers) ---
const PHYSICIAN_OFFICE = `
Provider: Dr. Amara Okafor, Family Medicine
Patient: Linda Chen
Account: FM-88213
Statement Date: 04/15/2026

04/01/2026  99213  Office Visit Established Patient  1  175.00  175.00
04/01/2026  90471  Immunization Administration  1  35.00  35.00
04/01/2026  90686  LT  Influenza Vaccine  1  28.00  28.00
04/08/2026  99214  25  Office Visit Expanded  1  225.00  225.00

Total Charges: 463.00
Balance Due: 463.00
`;

// --- Fixture 4: pharmacy with NDCs in all four SPEC §7 segment formats ---
const PHARMACY_NDC = `
Provider: MedCenter Outpatient Pharmacy
Patient: Omar Haddad
Account: RX-33221
Statement Date: 07/10/2026

07/05/2026  J1745  00069-0101-02  Infliximab 100mg Vial  2  450.00  900.00
07/05/2026  J9035  50242-0079-1   Bevacizumab 100mg  1  980.00  980.00
07/06/2026  J3490  0069-3109-20   Unclassified Drug  1  60.00  60.00
07/06/2026  J0696  12345-678-01   Ceftriaxone Injection  1  18.50  18.50

Total Charges: 1958.50
Balance Due: 1958.50
`;

// --- Fixture 5: credits and negative lines ((parens), leading "-", trailing "CR") ---
const CREDITS_AND_NEGATIVES = `
Patient: Robert Kim
Account: 774411
Statement Date: 08/20/2026

08/01/2026  0250  Pharmacy - Acetaminophen  1  25.00  25.00
08/01/2026  0250  Pharmacy - Acetaminophen  1  25.00  25.00
08/01/2026  0250  Pharmacy - Acetaminophen Credit  1  25.00  (25.00)
08/02/2026  0370  Anesthesia Services  1  980.00  980.00 CR
08/03/2026  0710  Recovery Room Adjustment  1  150.00  -150.00
`;

describe('parseText: hospital UB-style', () => {
  const { bill, warnings } = parseText(HOSPITAL_UB);

  it('extracts header fields', () => {
    expect(bill.header.providerName).toBe('Springfield General Hospital');
    expect(bill.header.patientName).toBe('Jane Q Public');
    expect(bill.header.accountNumber).toBe('100293847');
    expect(bill.header.admitDate).toBe('2026-03-10');
    expect(bill.header.dischargeDate).toBe('2026-03-13');
    expect(bill.header.statementDate).toBe('2026-03-20');
    expect(bill.header.totalCharges).toBe(6001);
    expect(bill.header.balanceDue).toBe(6001);
  });

  it('extracts all 5 lines with rev codes, HCPCS codes, qty and amounts', () => {
    expect(bill.lines).toHaveLength(5);
    expect(bill.lines[0]?.revCode).toBe('0110');
    expect(bill.lines[0]?.qty).toBe(3);
    expect(bill.lines[0]?.amount).toBe(3600);
    expect(bill.lines[1]?.revCode).toBe('0450');
    expect(bill.lines[1]?.code).toBe('J0696');
    expect(bill.lines[3]?.code).toBe('J1745');
    expect(bill.lines[3]?.unitPrice).toBe(315.5);
    expect(bill.lines[3]?.amount).toBe(631);
  });

  it('totals reconcile: no mismatch warning', () => {
    expect(warnings.some((w) => w.includes('add up to'))).toBe(false);
  });
});

describe('parseText: ED / outpatient', () => {
  const { bill } = parseText(ED_OUTPATIENT);

  it('extracts 4 lines', () => {
    expect(bill.lines).toHaveLength(4);
  });

  it('captures CPT-shaped codes, rev codes and a modifier', () => {
    expect(bill.lines[0]?.code).toBe('99284');
    expect(bill.lines[0]?.revCode).toBe('0450');
    expect(bill.lines[1]?.code).toBe('71046');
    expect(bill.lines[2]?.code).toBe('99284');
    expect(bill.lines[2]?.modifiers).toEqual(['25']);
  });

  it('header totals match', () => {
    expect(bill.header.totalCharges).toBe(2050);
  });
});

describe('parseText: physician / professional office', () => {
  const { bill } = parseText(PHYSICIAN_OFFICE);

  it('extracts 4 lines with per-line dates', () => {
    expect(bill.lines).toHaveLength(4);
    expect(bill.lines[0]?.date).toBe('2026-04-01');
    expect(bill.lines[3]?.date).toBe('2026-04-08');
  });

  it('captures anatomical and E/M modifiers', () => {
    expect(bill.lines[2]?.code).toBe('90686');
    expect(bill.lines[2]?.modifiers).toEqual(['LT']);
    expect(bill.lines[3]?.code).toBe('99214');
    expect(bill.lines[3]?.modifiers).toEqual(['25']);
  });
});

describe('parseText: pharmacy with NDCs', () => {
  const { bill } = parseText(PHARMACY_NDC);

  it('extracts 4 lines', () => {
    expect(bill.lines).toHaveLength(4);
  });

  it('normalizes every NDC segment format to 11 digits', () => {
    expect(bill.lines[0]?.ndc).toBe('00069010102'); // 5-4-2 (already normalized)
    expect(bill.lines[1]?.ndc).toBe('50242007901'); // 5-4-1
    expect(bill.lines[2]?.ndc).toBe('00069310920'); // 4-4-2
    expect(bill.lines[3]?.ndc).toBe('12345067801'); // 5-3-2
    for (const l of bill.lines) expect(l.ndc).toHaveLength(11);
  });
});

describe('parseText: credits and negative lines', () => {
  const { bill } = parseText(CREDITS_AND_NEGATIVES);

  it('extracts 5 lines', () => {
    expect(bill.lines).toHaveLength(5);
  });

  it('parses parens, trailing CR and leading "-" as negative amounts', () => {
    expect(bill.lines[0]?.amount).toBe(25);
    expect(bill.lines[1]?.amount).toBe(25);
    expect(bill.lines[2]?.amount).toBe(-25); // (25.00)
    expect(bill.lines[3]?.amount).toBe(-980); // 980.00 CR
    expect(bill.lines[4]?.amount).toBe(-150); // -150.00
  });
});

// --- Fixture 6: messy OCR-like input, built as raw PositionedItem[] with jitter + low confidence ---
function ocrRow(y: number, cells: Array<[string, number?]>, baseX = 0): PositionedItem[] {
  let x = baseX;
  return cells.map(([text, confidence], i) => {
    const width = text.length * 7;
    const item: PositionedItem = { text, x, y: y + (i % 2 === 0 ? 0 : 2), width, height: 14, page: 1, confidence };
    x += width + 40;
    return item;
  });
}

const MESSY_OCR_ITEMS: PositionedItem[] = [
  ...ocrRow(0, [['Patient:'], ['Maria Santos']]),
  ...ocrRow(20, [['Total'], ['Charges:'], ['900.00']]),
  ...ocrRow(50, [
    ['09/14/2026', 91],
    ['0450', 89],
    ['J0696', 93],
    ['ER', 85],
    ['Visit', 88],
    ['1', 90],
    ['500.00', 94],
    ['500.00', 92],
  ]),
  ...ocrRow(80, [
    ['09/14/2026', 58],
    ['99213', 52],
    ['Office', 60],
    ['Visit', 55],
    ['1', 61],
    ['175.00', 57],
    ['175.00', 53],
  ]),
];

describe('parseBill: messy OCR-like input (direct PositionedItem[])', () => {
  const { bill, warnings } = parseBill(MESSY_OCR_ITEMS);

  it('extracts the patient header despite jittered OCR positions', () => {
    expect(bill.header.patientName).toBe('Maria Santos');
  });

  it('extracts both charge lines with codes and amounts', () => {
    expect(bill.lines).toHaveLength(2);
    expect(bill.lines[0]?.code).toBe('J0696');
    expect(bill.lines[0]?.amount).toBe(500);
    expect(bill.lines[1]?.code).toBe('99213');
    expect(bill.lines[1]?.amount).toBe(175);
  });

  it('flags the low-confidence OCR line but not the clean one', () => {
    expect(warnings.some((w) => w.includes('Line 1') && w.includes('low OCR confidence'))).toBe(false);
    expect(warnings.some((w) => w.includes('Line 2') && w.includes('low OCR confidence'))).toBe(true);
  });

  it('flags the totals mismatch (declared 900.00 vs lines summing to 675.00)', () => {
    expect(warnings.some((w) => w.includes('add up to $675.00') && w.includes('900.00'))).toBe(true);
  });
});

// --- A small parse-accuracy number across all 6 fixtures ---
describe('parse accuracy across the synthetic corpus', () => {
  it('reports and asserts a minimum accuracy', () => {
    const expectations: Array<{ name: string; expectedLines: number; result: ReturnType<typeof parseText> }> = [
      { name: 'hospital-ub', expectedLines: 5, result: parseText(HOSPITAL_UB) },
      { name: 'ed-outpatient', expectedLines: 4, result: parseText(ED_OUTPATIENT) },
      { name: 'physician-office', expectedLines: 4, result: parseText(PHYSICIAN_OFFICE) },
      { name: 'pharmacy-ndc', expectedLines: 4, result: parseText(PHARMACY_NDC) },
      { name: 'credits-negatives', expectedLines: 5, result: parseText(CREDITS_AND_NEGATIVES) },
    ];
    const ocrResult = parseBill(MESSY_OCR_ITEMS);
    expectations.push({ name: 'messy-ocr', expectedLines: 2, result: ocrResult });

    let correct = 0;
    let totalAmountDefined = 0;
    let totalLines = 0;
    for (const { expectedLines, result } of expectations) {
      totalLines += result.bill.lines.length;
      for (const l of result.bill.lines) if (Number.isFinite(l.amount)) totalAmountDefined++;
      if (result.bill.lines.length === expectedLines) correct++;
    }
    const lineCountAccuracy = correct / expectations.length;
    const amountFillRate = totalLines > 0 ? totalAmountDefined / totalLines : 0;
    // eslint-disable-next-line no-console
    console.log(
      `[ingest parse accuracy] fixtures with exact expected line count: ${(lineCountAccuracy * 100).toFixed(0)}% (${correct}/${expectations.length}); amount fill rate: ${(amountFillRate * 100).toFixed(0)}% (${totalAmountDefined}/${totalLines})`,
    );
    expect(lineCountAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(amountFillRate).toBe(1);
  });
});

describe('parseText: 2-digit quantity vs numeric modifier (Q1)', () => {
  it('reads 22 and 10 as quantities when quantity x price equals the amount', () => {
    const { bill } = parseText(
      ['09/02/2026   0762   G0378   OBSERVATION PER HR   22   95.00   2090.00', '06/10/2026   0636   J1100   DEXAMETHASONE INJ 1MG   10   3.10   31.00'].join('\n'),
    );
    expect(bill.lines.map((l) => [l.qty, l.modifiers ?? []])).toEqual([[22, []], [10, []]]);
  });

  it('keeps 25 as a modifier when the math does not support a quantity', () => {
    const { bill } = parseText('09/09/2026   99214   25   1   245.00   245.00');
    expect(bill.lines[0]!.modifiers).toEqual(['25']);
    expect(bill.lines[0]!.qty).toBe(1);
  });
});
