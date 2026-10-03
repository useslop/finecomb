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

describe('NCCI-01 hard negatives (F1)', () => {
  const ptp = { ncciPtp: (c1: string, c2: string) => (c1 === '20610' && c2 === '99214' ? { modifierIndicator: 1 as const } : undefined) };
  it('honors modifier 25 on the E/M line as an MI-1 bypass (bilateral procedure lines too)', () => {
    const b = bill([
      line({ date: '2026-03-01', code: '99214', amount: 250, modifiers: ['25'] }),
      line({ date: '2026-03-01', code: '20610', amount: 300, modifiers: ['RT'] }),
      line({ date: '2026-03-01', code: '20610', amount: 300, modifiers: ['LT'] }),
    ]);
    expect(evaluate(b, ctx(), ptp).findings).toHaveLength(0);
  });

  it('honors 57 and an anatomic modifier on the column-2 line', () => {
    for (const mod of ['57', 'LT', 'XU']) {
      const b = bill([
        line({ date: '2026-03-02', code: '20610', amount: 300 }),
        line({ date: '2026-03-02', code: '99214', amount: 250, modifiers: [mod] }),
      ]);
      expect(evaluate(b, ctx(), ptp).findings, mod).toHaveLength(0);
    }
  });

  it('still flags MI 1 when the E/M line has no NCCI modifier', () => {
    const b = bill([
      line({ date: '2026-03-03', code: '20610', amount: 300, modifiers: ['RT'] }),
      line({ date: '2026-03-03', code: '99214', amount: 250 }),
    ]);
    expect(evaluate(b, ctx(), ptp).findings).toHaveLength(1);
  });
});

describe('NCCI-01 confidence (Q1)', () => {
  it('is Low for a modifier-indicator-1 pair with no modifier printed (statements often drop 25/59)', () => {
    const b = bill([line({ date: '2026-09-09', code: '11102', amount: 310 }), line({ date: '2026-09-09', code: '99214', amount: 245 })]);
    const { findings } = evaluate(b, ctx({}), { ncciPtp: (c1, c2) => (c1 === '11102' && c2 === '99214' ? { modifierIndicator: 1 } : undefined) });
    expect(findings[0]!.confidence).toBe('low');
  });
});
