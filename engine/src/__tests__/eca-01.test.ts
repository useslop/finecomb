import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/eca-01.js';
import { bill, ctx } from './helpers.js';
import type { Datasets } from '../types.js';

const nonprofitData: Datasets = {
  hospital: (ccn) => (ccn === 'NP1' ? { name: 'Nonprofit General', state: 'WA', ownership: 'Voluntary non-profit', ownershipCategory: 'nonprofit' } : undefined),
};
const forProfitData: Datasets = {
  hospital: (ccn) => (ccn === 'FP1' ? { name: 'ForProfit General', state: 'WA', ownership: 'Proprietary', ownershipCategory: 'proprietary' } : undefined),
};

describe('ECA-01 early or improper extraordinary collection action', () => {
  it('flags a collection action before the 120-day waiting period ends', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({
        hospitalCcn: 'NP1',
        firstPostDischargeStatementDate: '2026-06-01',
        collections: [{ date: '2026-07-01', kind: 'credit_report', noticeDate: '2026-06-15' }],
      }),
      nonprofitData,
    );
    expect(findings).toHaveLength(1);
  });

  it('flags a collection action with no recorded 30-day notice', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({
        hospitalCcn: 'NP1',
        firstPostDischargeStatementDate: '2026-01-01',
        collections: [{ date: '2026-06-01', kind: 'lawsuit' }],
      }),
      nonprofitData,
    );
    expect(findings).toHaveLength(1);
  });

  it('does not flag a for-profit hospital (501(r) does not apply)', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({
        hospitalCcn: 'FP1',
        firstPostDischargeStatementDate: '2026-01-01',
        collections: [{ date: '2026-01-05', kind: 'credit_report' }],
      }),
      forProfitData,
    );
    expect(findings).toHaveLength(0);
  });

  it('does not flag a properly noticed action after the waiting period', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({
        hospitalCcn: 'NP1',
        firstPostDischargeStatementDate: '2026-01-01',
        collections: [{ date: '2026-06-01', kind: 'credit_report', noticeDate: '2026-04-01' }],
      }),
      nonprofitData,
    );
    expect(findings).toHaveLength(0);
  });
});

describe('ECA-01 hard negatives and short notice (F1)', () => {
  const data = { hospital: () => ({ name: 'Example General Hospital', state: 'OH', ownership: 'Voluntary non-profit - Private', ownershipCategory: 'nonprofit' as const }) };
  const base = { hospitalCcn: '990101', firstPostDischargeStatementDate: '2026-01-01' };

  it('does not treat an early collection-agency referral or a late fee as an ECA', () => {
    const c = ctx({ ...base, collections: [{ date: '2026-02-01', kind: 'collections' }, { date: '2026-02-15', kind: 'late_fee' }] });
    expect(evaluate(bill([]), c, data).findings).toHaveLength(0);
  });

  it('flags credit reporting only 10 days after the written notice (short notice)', () => {
    const c = ctx({ ...base, collections: [{ date: '2026-06-20', kind: 'credit_report', noticeDate: '2026-06-10' }] });
    const { findings } = evaluate(bill([]), c, data);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.why).toMatch(/10 days after the written notice/);
  });

  it('does not flag a notice given exactly 30 days ahead', () => {
    const c = ctx({ ...base, collections: [{ date: '2026-06-30', kind: 'lawsuit', noticeDate: '2026-05-31' }] });
    expect(evaluate(bill([]), c, data).findings).toHaveLength(0);
  });
});
