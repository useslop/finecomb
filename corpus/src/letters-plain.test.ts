import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyze, renderLetter, LETTER_TITLES, type Bill, type Context, type LetterId } from '@finecomb/engine';
import { toDatasets, type CorpusItem } from './types.js';

// Users copy these letters into email, portals and print. Every letter must be plain text: no
// markdown emphasis, no `[date]` placeholder, and amounts written `$4,600.00`. Only clearly
// labeled fill-ins (`[Provider's billing address]`, `[Date of birth]`, ...) may remain.

const ALL_IDS = Object.keys(LETTER_TITLES) as LetterId[];
const handmadeDir = fileURLToPath(new URL('../data/handmade/', import.meta.url));

// The made-up bill from the launch reel (C1): 5 lines adding to $4,916 against a $5,100 total,
// an EOB that says the patient owes $500, an out-of-network emergency visit.
const DEMO: { id: string; bill: Bill; ctx: Context } = {
  id: 'demo',
  bill: {
    confirmed: true,
    header: {
      patientName: 'Sample Patient',
      providerName: 'Example General Hospital',
      accountNumber: 'SAMPLE-0001',
      admitDate: '2026-09-14',
      dischargeDate: '2026-09-16',
      statementDate: '2026-09-25',
      totalCharges: 5100,
      balanceDue: 5100,
    },
    lines: [
      { id: 'd1', date: '2026-09-14', revCode: '0450', code: '99285', description: 'Emergency department visit', qty: 1, unitPrice: 2150, amount: 2150 },
      { id: 'd2', date: '2026-09-14', revCode: '0300', description: 'Laboratory services', qty: 1, unitPrice: 385, amount: 385 },
      { id: 'd3', date: '2026-09-14', revCode: '0300', description: 'Laboratory services', qty: 1, unitPrice: 385, amount: 385 },
      { id: 'd4', date: '2026-09-15', revCode: '0120', description: 'Room and board semi-private', qty: 1, unitPrice: 1900, amount: 1900 },
      { id: 'd5', date: '2026-09-18', revCode: '0250', description: 'Pharmacy', qty: 1, unitPrice: 96, amount: 96 },
    ],
  },
  ctx: {
    today: '2026-10-02',
    insurance: 'commercial',
    emergency: true,
    facilityInNetwork: false,
    state: 'CA',
    householdSize: 3,
    annualIncome: 48000,
    eob: { billed: 5100, allowed: 2600, planPaid: 2100, deductible: 300, coinsurance: 200, patientResponsibility: 500 },
  },
};

const handmade = readdirSync(handmadeDir)
  .filter((f) => /^hm-.*\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(handmadeDir, f), 'utf8')) as CorpusItem);

const cases = [
  { id: DEMO.id, bill: DEMO.bill, ctx: DEMO.ctx, findings: analyze(DEMO.bill, DEMO.ctx, {}).findings },
  ...handmade.map((item) => ({ id: item.id, bill: item.bill, ctx: item.ctx, findings: analyze(item.bill, item.ctx, toDatasets(item.data)).findings })),
];

const MARKDOWN = [/\*\*/, /__/, /(^|[\s(])\*[^\s*][^*\n]*\*(?=[\s).,;:]|$)/m, /^#{1,6} /m, /`/];

describe('letters are plain text with real dates and amounts', () => {
  it('covers the demo bill and all 15 hand-made bills', () => {
    expect(handmade.length).toBe(15);
    expect(cases[0]!.findings.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    for (const id of ALL_IDS) {
      it(`${c.id} ${id}`, () => {
        const text = renderLetter(id, { bill: c.bill, ctx: c.ctx, findings: c.findings });
        for (const re of MARKDOWN) expect(text, `markdown ${re} in ${c.id} ${id}`).not.toMatch(re);
        expect(text).not.toContain('[date]');
        expect(text).not.toContain('[amount]');
        // Thousands separators everywhere: no `$4600.00`.
        expect(text).not.toMatch(/\$\d{4,}/);
        // Any remaining fill-in is a labeled bracket, never an empty one.
        expect(text).not.toMatch(/\[\s*\]/);
      });
    }
  }

  it('the demo L2 itemizes the EOB finding with a real date and $4,600.00', () => {
    const text = renderLetter('L2', { bill: DEMO.bill, ctx: DEMO.ctx, findings: cases[0]!.findings });
    expect(text).toContain('$4,600.00');
    expect(text).toMatch(/^- September 14, 2026 to September 16, 2026 — .*EOB/m);
    expect(text).toContain('I am asking you to:');
  });
});
