import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/canc-01.js';
import { bill, ctx, line } from './helpers.js';

describe('CANC-01 canceled, not received, or phantom service', () => {
  it('flags a line marked not received', () => {
    const b = bill([line({ amount: 80, notReceived: true })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidence).toBe('medium');
  });

  it('flags a cancellation keyword in the description', () => {
    const b = bill([line({ amount: 60, description: 'Procedure CANCELED' })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidence).toBe('low');
  });

  it('does not flag a cancellation keyword already reversed by a credit', () => {
    const b = bill([
      line({ amount: 60, description: 'Procedure CANCELED', qty: 1 }),
      line({ amount: -60, description: 'Procedure CANCELED', qty: 1 }),
    ]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });

  it('does not flag an ordinary line', () => {
    const b = bill([line({ amount: 60, description: 'Basic metabolic panel' })]);
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });
});

describe('CANC-01 hard negatives (F1)', () => {
  it('does not treat drug wastage or a cancellation fee as a canceled item', () => {
    const b = bill([
      line({ date: '2026-02-01', code: 'J2405', amount: 24, description: 'ONDANSETRON WASTE', modifiers: ['JW'] }),
      line({ date: '2026-02-01', amount: 40, description: 'LATE CANCELLATION FEE' }),
    ]);
    expect(evaluate(b, ctx(), {}).findings).toHaveLength(0);
  });
});
