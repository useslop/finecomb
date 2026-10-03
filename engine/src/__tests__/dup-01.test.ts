import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/dup-01.js';
import { bill, ctx, line } from './helpers.js';

describe('DUP-01 exact duplicate charge', () => {
  it('flags two identical lines', () => {
    const b = bill([
      line({ date: '2026-01-01', code: 'A1', qty: 1, amount: 50 }),
      line({ date: '2026-01-01', code: 'A1', qty: 1, amount: 50 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidence).toBe('high');
    expect(findings[0]!.dollarsAtStake).toBe(50);
  });

  it('flags three identical lines with cumulative dollars at stake', () => {
    const b = bill([
      line({ date: '2026-02-01', code: 'B2', qty: 2, amount: 20 }),
      line({ date: '2026-02-01', code: 'B2', qty: 2, amount: 20 }),
      line({ date: '2026-02-01', code: 'B2', qty: 2, amount: 20 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.evidenceLineIds).toHaveLength(3);
    expect(findings[0]!.dollarsAtStake).toBe(40);
  });

  it('does not flag bilateral lines distinguished by modifier (LT vs RT)', () => {
    const b = bill([
      line({ date: '2026-03-01', code: 'C3', qty: 1, amount: 100, modifiers: ['LT'] }),
      line({ date: '2026-03-01', code: 'C3', qty: 1, amount: 100, modifiers: ['RT'] }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag a duplicate already reversed by a credit', () => {
    const b = bill([
      line({ date: '2026-04-01', code: 'D4', qty: 1, amount: 75 }),
      line({ date: '2026-04-01', code: 'D4', qty: 1, amount: 75 }),
      line({ date: '2026-04-02', code: 'D4', qty: 1, amount: -75 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });
});

describe('DUP-01 repeat doses and serial labs (Q1)', () => {
  it('keeps a true duplicate (identical CT lines) at High', () => {
    const b = bill([line({ date: '2026-07-14', code: '74177', revCode: '0352', amount: 4980, qty: 1 }), line({ date: '2026-07-14', code: '74177', revCode: '0352', amount: 4980, qty: 1 })]);
    expect(evaluate(b, ctx({}), {}).findings[0]!.confidence).toBe('high');
  });

  it('flags identical same-day drug lines at Medium and mentions repeat doses', () => {
    const b = bill([line({ date: '2026-09-02', code: 'J2405', revCode: '0636', amount: 75, qty: 4 }), line({ date: '2026-09-02', code: 'J2405', revCode: '0636', amount: 75, qty: 4 })]);
    const f = evaluate(b, ctx({}), {}).findings[0]!;
    expect(f.confidence).toBe('medium');
    expect(f.userText).toContain('more than once a day');
  });

  it('treats serial labs (lab-shaped code, no modifier 91 printed) as Medium', () => {
    const b = bill([line({ date: '2026-07-14', code: '84484', amount: 120, qty: 1 }), line({ date: '2026-07-14', code: '84484', amount: 120, qty: 1 })]);
    expect(evaluate(b, ctx({}), {}).findings[0]!.confidence).toBe('medium');
  });
});
