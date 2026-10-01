import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/ncci-01.js';
import { bill, ctx, line } from './helpers.js';
import type { Datasets } from '../types.js';

const data: Datasets = {
  ncciPtp: (col1, col2) => {
    if (col1 === 'P1' && col2 === 'P2') return { modifierIndicator: 0 };
    if (col1 === 'Q1' && col2 === 'Q2') return { modifierIndicator: 1 };
    if (col1 === 'R1' && col2 === 'R2') return { modifierIndicator: 9 };
    return undefined;
  },
};

describe('NCCI-01 unbundling', () => {
  it('flags an indicator-0 pair regardless of modifiers', () => {
    const b = bill([
      line({ date: '2026-01-01', code: 'P1', amount: 100 }),
      line({ date: '2026-01-01', code: 'P2', amount: 40 }),
    ]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(40);
  });

  it('flags an indicator-1 pair with no bypass modifier', () => {
    const b = bill([
      line({ date: '2026-01-02', code: 'Q1', amount: 100 }),
      line({ date: '2026-01-02', code: 'Q2', amount: 30 }),
    ]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(1);
  });

  it('does not flag an indicator-1 pair when column 2 carries modifier 59', () => {
    const b = bill([
      line({ date: '2026-01-03', code: 'Q1', amount: 100 }),
      line({ date: '2026-01-03', code: 'Q2', amount: 30, modifiers: ['59'] }),
    ]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(0);
  });

  it('does not flag an indicator-9 pair', () => {
    const b = bill([
      line({ date: '2026-01-04', code: 'R1', amount: 100 }),
      line({ date: '2026-01-04', code: 'R2', amount: 30 }),
    ]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(0);
  });
});
