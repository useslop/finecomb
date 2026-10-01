import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/cr-01.js';
import { bill, ctx } from './helpers.js';

describe('CR-01 medical debt on credit report against bureau policy', () => {
  it('flags a paid-in-full debt on the credit report', () => {
    const b = bill([]);
    const { findings } = evaluate(b, ctx({ onCreditReport: true, paidInFull: true }), {});
    expect(findings).toHaveLength(1);
  });

  it('flags a debt under $500', () => {
    const b = bill([]);
    const { findings } = evaluate(b, ctx({ onCreditReport: true, originalBalance: 300 }), {});
    expect(findings).toHaveLength(1);
  });

  it('does not flag when it is not on the credit report', () => {
    const b = bill([]);
    const { findings } = evaluate(b, ctx({ onCreditReport: false }), {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag an old, unpaid, larger balance that matches none of the bureau exceptions', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({ onCreditReport: true, originalBalance: 2000, paidInFull: false, firstPostDischargeStatementDate: '2023-01-01', today: '2026-10-01' }),
      {},
    );
    expect(findings).toHaveLength(0);
  });
});
