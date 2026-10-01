import { describe, expect, it } from 'vitest';
import { evaluate } from '../rules/rx-01.js';
import { bill, ctx, line } from './helpers.js';
import type { Datasets } from '../types.js';

const data: Datasets = {
  nadac: (ndc) => (ndc === '00000000001' ? { unitPrice: 1, unit: 'EA', effective: '2026-09-01' } : undefined),
};

describe('RX-01 pharmacy markup vs NADAC', () => {
  it('flags a line billed at 10x NADAC or more', () => {
    const b = bill([line({ ndc: '00000000001', qty: 1, unitPrice: 10, amount: 10 })]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidence).toBe('info');
    expect(findings[0]!.dollarsAtStake).toBeNull();
  });

  it('flags an even larger multiple', () => {
    const b = bill([line({ ndc: '00000000001', qty: 1, unitPrice: 50, amount: 50 })]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(1);
  });

  it('does not flag a line billed under 10x NADAC', () => {
    const b = bill([line({ ndc: '00000000001', qty: 1, unitPrice: 5, amount: 5 })]);
    const { findings } = evaluate(b, ctx(), data);
    expect(findings).toHaveLength(0);
  });

  it('skips when no line has an NDC', () => {
    const b = bill([line({ amount: 10 })]);
    const result = evaluate(b, ctx(), data);
    expect(result.findings).toHaveLength(0);
    expect(result.skipped?.needs).toBeDefined();
  });
});
