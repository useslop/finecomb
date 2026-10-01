import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/gfe-01.js';
import { bill, ctx, line } from './helpers.js';

describe('GFE-01 billed charges exceed the Good Faith Estimate by $400+', () => {
  it('flags a $500 gap within the 120-day window', () => {
    const b = bill([line({ provider: 'Dr. A', amount: 1500 })]);
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'none', gfe: [{ provider: 'Dr. A', total: 1000 }], firstBillDate: '2026-09-01' }),
      {},
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.dollarsAtStake).toBe(500);
  });

  it('only flags the provider whose gap meets the threshold', () => {
    const b = bill([
      line({ provider: 'Dr. A', amount: 1500 }),
      line({ provider: 'Dr. B', amount: 1050 }),
    ]);
    const { findings } = evaluate(
      b,
      ctx({
        insurance: 'none',
        gfe: [{ provider: 'Dr. A', total: 1000 }, { provider: 'Dr. B', total: 1000 }],
        firstBillDate: '2026-09-01',
      }),
      {},
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.title).toContain('Dr. A');
  });

  it('does not flag a $399 gap (under the $400 threshold)', () => {
    const b = bill([line({ provider: 'Dr. A', amount: 1399 })]);
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'none', gfe: [{ provider: 'Dr. A', total: 1000 }], firstBillDate: '2026-09-01' }),
      {},
    );
    expect(findings).toHaveLength(0);
  });

  it('does not flag once the first bill is 121 days old', () => {
    const b = bill([line({ provider: 'Dr. A', amount: 1500 })]);
    const { findings } = evaluate(
      b,
      ctx({ insurance: 'none', gfe: [{ provider: 'Dr. A', total: 1000 }], firstBillDate: '2026-06-02', today: '2026-10-01' }),
      {},
    );
    expect(findings).toHaveLength(0);
  });
});
