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
