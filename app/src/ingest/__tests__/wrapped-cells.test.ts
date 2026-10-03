import { describe, expect, it } from 'vitest';
import { parseBill, parseText } from '../parse';
import type { PositionedItem } from '../types';

// F2 / QA finding 22: Chrome prints an HTML table cell that wraps as 2 visual lines centred on the row, about
// 0.56 line heights above and below the money cells (geometry copied from the hm-01 / hm-04 printed PDFs).
const H = 12;
const it_ = (text: string, x: number, y: number, width = text.length * 6): PositionedItem => ({ text, x, y, width, height: H, page: 1 });

const WRAPPED_TABLE: PositionedItem[] = [
  { text: 'Patient: Morgan T. Sample', x: 7.5, y: 13.5, width: 97, height: 8.2, page: 1 },
  // header row of the table
  it_('Date', 15, 60), it_('Rev', 91.6, 60), it_('NDC / Code', 134.8, 60), it_('Description', 199.2, 60),
  it_('Qty', 337.4, 60), it_('Unit', 460.5, 60), it_('Amount', 507.1, 60),
  // line 1: description wraps; money cells sit on the middle baseline
  it_('09/02/2026', 15, 82.5), it_('0762', 91.6, 82.5), it_('G0378', 134.8, 82.5),
  it_('OBSERVATION PER', 199.2, 75.7), it_('HR', 199.2, 89.2),
  it_('22', 337.4, 82.5), it_('95.00', 460.5, 82.5), it_('2090.00', 507.1, 82.5),
  // line 2: both the NDC ("00536-" / "1327-01") and the description wrap
  it_('09/02/2026', 15, 114), it_('0250', 91.6, 114),
  it_('00536-', 134.8, 107.2), it_('1327-01', 134.8, 120.7),
  it_('ACETAMINOPHEN', 199.2, 107.2), it_('325MG TAB', 199.2, 120.7),
  it_('2', 337.4, 114), it_('9.50', 460.5, 114), it_('19.00', 507.1, 114),
  // line 3: no wrap
  it_('09/02/2026', 15, 138.7), it_('0300', 91.6, 138.7), it_('85025', 134.8, 138.7), it_('CBC W/DIFF', 199.2, 138.7),
  it_('1', 337.4, 138.7), it_('96.00', 460.5, 138.7), it_('96.00', 507.1, 138.7),
  { text: 'Total Charges: 2205.00', x: 7.5, y: 165, width: 85, height: 8.2, page: 1 },
];

describe('parseBill: table cells that wrap onto 2 printed lines (QA 22)', () => {
  const { bill, warnings } = parseBill(WRAPPED_TABLE);

  it('keeps one line per table row with the full description', () => {
    expect(bill.lines.map((l) => l.description)).toEqual(['OBSERVATION PER HR', 'ACETAMINOPHEN 325MG TAB', 'CBC W/DIFF']);
    expect(bill.lines.map((l) => l.amount)).toEqual([2090, 19, 96]);
    expect(warnings).toEqual([]);
  });

  it('rejoins an NDC split across two lines and keeps the other fields', () => {
    const [obs, apap] = bill.lines;
    expect(apap).toMatchObject({ ndc: '00536132701', revCode: '0250', qty: 2, unitPrice: 9.5, date: '2026-09-02' });
    expect(apap!.code).toBeUndefined();
    expect(obs).toMatchObject({ code: 'G0378', revCode: '0762', qty: 22, unitPrice: 95 });
  });

  it('does not glue the table header or the totals row into a line', () => {
    expect(bill.header.patientName).toBe('Morgan T. Sample');
    expect(bill.header.totalCharges).toBe(2205);
    expect(bill.lines.some((l) => /description|total/i.test(l.description))).toBe(false);
  });

  it('leaves a text-only row a full line height away alone (section heading, missing-amount row)', () => {
    const items: PositionedItem[] = [
      it_('PHARMACY', 15, 100),
      it_('09/02/2026', 15, 114), it_('0250', 91.6, 114), it_('SALINE FLUSH', 199.2, 114), it_('4.00', 507.1, 114),
    ];
    const r = parseBill(items);
    expect(r.bill.lines.map((l) => l.description)).toEqual(['SALINE FLUSH']);
    expect(r.warnings.some((w) => w.includes('PHARMACY'))).toBe(true);
  });
});

describe('parseText: pasted continuation lines are unchanged by the wrap merge', () => {
  it('still skips a pasted text-only line instead of merging it', () => {
    const { bill, warnings } = parseText(['03/10/2026  0110  Room & Board Semi-Private  3  1200.00  3600.00', '  continued note'].join('\n'));
    expect(bill.lines.map((l) => l.description)).toEqual(['Room & Board Semi-Private']);
    expect(warnings.some((w) => w.includes('continued note'))).toBe(true);
  });
});
