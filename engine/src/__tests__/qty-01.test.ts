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
