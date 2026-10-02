import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/rb-01.js';
import { bill, ctx, line } from './helpers.js';

describe('RB-01 room-and-board days exceed nights', () => {
  it('flags one extra room day beyond nights stayed (keyword match)', () => {
    const b = bill(
      [line({ date: '2026-01-04', description: 'SEMI-PRIVATE ROOM', qty: 4, unitPrice: 1000, amount: 4000 })],
      { admitDate: '2026-01-01', dischargeDate: '2026-01-04' },
    );
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(1000);
  });

  it('flags using the revenue-code family (010X-021X) instead of keywords', () => {
    const b = bill(
      [line({ date: '2026-02-03', description: 'INPT CHARGE', revCode: '0110', qty: 3, unitPrice: 800, amount: 2400 })],
      { admitDate: '2026-02-01', dischargeDate: '2026-02-02' },
    );
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(1);
  });

  it('does not flag a same-day admit and discharge with one room unit', () => {
    const b = bill(
      [line({ date: '2026-03-01', description: 'ROOM', qty: 1, unitPrice: 1000, amount: 1000 })],
      { admitDate: '2026-03-01', dischargeDate: '2026-03-01' },
    );
    const { findings } = evaluate(b, ctx(), {});
    expect(findings).toHaveLength(0);
  });

  it('skips without admission and discharge dates', () => {
    const b = bill([line({ description: 'ROOM', qty: 5, amount: 5000 })]);
    const result = evaluate(b, ctx(), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});

describe('RB-01 hard negatives (F1)', () => {
  const stay = { admitDate: '2026-05-01', dischargeDate: '2026-05-02' };
  it('does not count observation hours as room days', () => {
    const b = bill([
      line({ date: '2026-05-01', code: 'G0378', revCode: '0762', description: 'OBSERVATION ROOM HOURLY', qty: 18, unitPrice: 90, amount: 1620 }),
      line({ date: '2026-05-02', code: 'G0378', revCode: '0762', description: 'OBSERVATION ROOM HOURLY', qty: 10, unitPrice: 90, amount: 900 }),
    ], stay);
    expect(evaluate(b, ctx({ observation: true }), {}).findings).toHaveLength(0);
  });

  it('does not count ER, OR, recovery-room or telemetry lines (with or without revenue codes)', () => {
    const b = bill([
      line({ date: '2026-05-01', revCode: '0120', description: 'SEMI PRIV RM DAILY', qty: 1, unitPrice: 3000, amount: 3000 }),
      line({ date: '2026-05-01', revCode: '0450', description: 'EMERGENCY ROOM LVL 4', qty: 1, amount: 2000 }),
      line({ date: '2026-05-01', revCode: '0731', description: 'TELEMETRY MONITOR PER DAY', qty: 1, amount: 900 }),
      line({ date: '2026-05-01', description: 'OPERATING ROOM FIRST 30 MIN', qty: 1, amount: 4000 }),
      line({ date: '2026-05-01', description: 'RECOVERY ROOM FIRST 30 MIN', qty: 1, amount: 1200 }),
    ], stay);
    expect(evaluate(b, ctx({ admitted: true }), {}).findings).toHaveLength(0);
  });

  it('does not count a room day that was reversed by a credit', () => {
    const b = bill([
      line({ date: '2026-05-01', revCode: '0120', description: 'SEMI PRIV RM DAILY', qty: 1, unitPrice: 3000, amount: 3000 }),
      line({ date: '2026-05-02', revCode: '0120', description: 'SEMI PRIV RM DAILY', qty: 1, unitPrice: 3000, amount: 3000 }),
      line({ date: '2026-05-02', revCode: '0120', description: 'SEMI PRIV RM DAILY', qty: -1, unitPrice: 3000, amount: -3000 }),
    ], stay);
    expect(evaluate(b, ctx({ admitted: true }), {}).findings).toHaveLength(0);
  });
});
