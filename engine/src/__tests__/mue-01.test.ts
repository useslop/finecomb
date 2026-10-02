import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/mue-01.js';
import { bill, ctx, line } from './helpers.js';
import type { Datasets } from '../types.js';

const data: Datasets = {
  mue: (code) => (code === 'X1' ? { mue: 2, mai: 2 } : code === 'X2' ? { mue: 1, mai: 3 } : undefined),
};

describe('MUE-01 units above the Medically Unlikely Edit', () => {
  it('flags units over the MAI-2 limit at high confidence', () => {
    const b = bill([
      line({ code: 'X1', date: '2026-01-01', qty: 4, unitPrice: 10, amount: 40 }),
    ]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidence).toBe('high');
    expect(findings[0]!.dollarsAtStake).toBe(20);
  });

  it('flags units over an MAI-3 limit at medium confidence', () => {
    const b = bill([line({ code: 'X2', date: '2026-01-02', qty: 3, unitPrice: 5, amount: 15 })]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidence).toBe('medium');
  });

  it('does not flag units at or under the MUE', () => {
    const b = bill([line({ code: 'X1', date: '2026-01-03', qty: 2, unitPrice: 10, amount: 20 })]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(0);
  });

  it('does not apply to inpatient (admitted) claims', () => {
    const b = bill([line({ code: 'X1', date: '2026-01-04', qty: 9, unitPrice: 10, amount: 90 })]);
    const { findings } = evaluate(b, ctx({ admitted: true }), data);
    expect(findings).toHaveLength(0);
  });
});

describe('MUE-01 setting inference and hard negatives (F1)', () => {
  // practitioner limit 1, outpatient-hospital limit 2, like CBC in the corpus
  const split: Datasets = { mue: (code, setting) => (code === '85025' ? { mue: setting === 'outpatient' ? 2 : 1, mai: 3 } : undefined) };

  it('judges an ED facility bill (revenue codes) against the outpatient limit, observation or not', () => {
    const b = bill([line({ code: '85025', revCode: '0305', date: '2026-03-21', qty: 2, unitPrice: 50, amount: 100 })]);
    expect(evaluate(b, ctx({ emergency: true, observation: false }), split).findings).toHaveLength(0);
    expect(evaluate(b, ctx({ emergency: true }), split).findings).toHaveLength(0);
  });

  it('judges a clinician bill (no revenue codes) against the practitioner limit even during observation', () => {
    const b = bill([line({ code: '85025', date: '2026-03-21', qty: 2, unitPrice: 50, amount: 100 })]);
    expect(evaluate(b, ctx({ observation: true }), split).findings).toHaveLength(1);
  });

  it('applies an MAI-1 limit per line, not per day', () => {
    const perLine: Datasets = { mue: () => ({ mue: 1, mai: 1 }) };
    const b = bill([
      line({ code: '71046', date: '2026-03-22', qty: 1, unitPrice: 200, amount: 200 }),
      line({ code: '71046', date: '2026-03-22', qty: 1, unitPrice: 200, amount: 200, modifiers: ['76'] }),
    ]);
    expect(evaluate(b, ctx(), perLine).findings).toHaveLength(0);
  });
});
