import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/qty-01.js';
import { bill, ctx, line } from './helpers.js';

describe('QTY-01 implausible quantity', () => {
  it('flags more than 24 hourly units on one date', () => {
    const b = bill([line({ date: '2026-01-01', description: 'IV therapy, hourly', qty: 30, unitPrice: 5, amount: 150 })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings.some((f) => f.id.includes('hourly'))).toBe(true);
  });

  it('flags a per-stay kit billed more than once', () => {
    const b = bill([
      line({ description: 'Admission kit', qty: 2, unitPrice: 25, amount: 50 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings.some((f) => f.id.includes('kit'))).toBe(true);
  });

  it('does not flag 24 or fewer hourly units', () => {
    const b = bill([line({ date: '2026-01-02', description: 'Nursing, hourly', qty: 24, amount: 240 })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings.some((f) => f.id.includes('hourly'))).toBe(false);
  });

  it('does not flag a kit billed exactly once', () => {
    const b = bill([line({ description: 'IV start kit', qty: 1, amount: 25 })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings.some((f) => f.id.includes('kit'))).toBe(false);
  });
});

describe('QTY-01 hard negatives (F1)', () => {
  it('does not pool two hourly items on one date (observation hours + IV hydration hours)', () => {
    const b = bill([
      line({ date: '2026-06-01', code: 'G0378', description: 'OBSERVATION PER HOUR', qty: 22, unitPrice: 80, amount: 1760 }),
      line({ date: '2026-06-01', code: '96360', description: 'IV HYDRATION FIRST HOUR', qty: 1, unitPrice: 300, amount: 300 }),
      line({ date: '2026-06-01', code: '96361', description: 'IV HYDRATION ADDL HOUR', qty: 3, unitPrice: 120, amount: 360 }),
    ]);
    expect(evaluate(b, ctx({ observation: true }), {}).findings).toHaveLength(0);
  });

  it('does not treat two IV start kits, or an admission kit plus an IV kit, as a repeated per-stay kit', () => {
    const b = bill([
      line({ date: '2026-06-01', description: 'IV START KIT', qty: 2, unitPrice: 40, amount: 80 }),
      line({ date: '2026-06-01', description: 'ADMISSION KIT', qty: 1, unitPrice: 90, amount: 90 }),
    ]);
    expect(evaluate(b, ctx({ admitted: true }), {}).findings).toHaveLength(0);
  });

  it('does not pool two per-day items that each match the stay (oxygen + telemetry)', () => {
    const b = bill([
      line({ date: '2026-06-01', description: 'OXYGEN PER DAY', qty: 3, unitPrice: 100, amount: 300 }),
      line({ date: '2026-06-01', description: 'TELEMETRY MONITOR PER DAY', qty: 3, unitPrice: 600, amount: 1800 }),
    ], { admitDate: '2026-06-01', dischargeDate: '2026-06-04' });
    expect(evaluate(b, ctx({ admitted: true }), {}).findings).toHaveLength(0);
  });

  it('still flags one per-day item billed beyond the stay', () => {
    const b = bill([
      line({ date: '2026-06-01', description: 'OXYGEN PER DAY', qty: 6, unitPrice: 100, amount: 600 }),
    ], { admitDate: '2026-06-01', dischargeDate: '2026-06-04' });
    expect(evaluate(b, ctx({ admitted: true }), {}).findings).toHaveLength(1);
  });
});
