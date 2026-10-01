import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/ppdr-01.js';
import { bill, ctx } from './helpers.js';

describe('PPDR-01 collections or late fees during a federal bill dispute', () => {
  it('flags a collections event on/after the PPDR filing date', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({ ppdrFiledDate: '2026-05-01', collections: [{ date: '2026-05-10', kind: 'collections' }] }),
      {},
    );
    expect(findings).toHaveLength(1);
  });

  it('flags a late fee accrued during the dispute', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({ ppdrFiledDate: '2026-05-01', collections: [{ date: '2026-05-02', kind: 'late_fee' }] }),
      {},
    );
    expect(findings).toHaveLength(1);
  });

  it('does not flag an event before the dispute was filed', () => {
    const b = bill([]);
    const { findings } = evaluate(
      b,
      ctx({ ppdrFiledDate: '2026-05-01', collections: [{ date: '2026-04-01', kind: 'collections' }] }),
      {},
    );
    expect(findings).toHaveLength(0);
  });

  it('skips without a recorded PPDR filing date', () => {
    const b = bill([]);
    const result = evaluate(b, ctx({ collections: [{ date: '2026-05-01', kind: 'collections' }] }), {});
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
