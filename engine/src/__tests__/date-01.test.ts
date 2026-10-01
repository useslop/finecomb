import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/date-01.js';
import { bill, ctx, line } from './helpers.js';

describe('DATE-01 charges dated after discharge', () => {
  it('flags a line dated after discharge', () => {
    const b = bill([line({ date: '2026-01-05', amount: 100 })], { dischargeDate: '2026-01-04' });
    const { findings } = evaluate(b, ctx({ admitted: true }), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(100);
  });

  it('flags and sums multiple late lines', () => {
    const b = bill(
      [line({ date: '2026-01-05', amount: 100 }), line({ date: '2026-01-06', amount: 50 })],
      { dischargeDate: '2026-01-04' },
    );
    const { findings } = evaluate(b, ctx({ admitted: true }), {});
    expect(findings[0]!.dollarsAtStake).toBe(150);
  });

  it('does not flag when all lines are on or before discharge', () => {
    const b = bill([line({ date: '2026-01-04', amount: 100 })], { dischargeDate: '2026-01-04' });
    const { findings } = evaluate(b, ctx({ admitted: true }), {});
    expect(findings).toHaveLength(0);
  });

  it('skips for non-inpatient bills (not admitted)', () => {
    const b = bill([line({ date: '2026-01-10', amount: 100 })], { dischargeDate: '2026-01-04' });
    const result = evaluate(b, ctx({ admitted: false }), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
