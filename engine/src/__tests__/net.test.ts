import { describe, expect, it } from 'vitest';
import { analyze } from '../analyze.js';
import { netLines } from '../net.js';
import { evaluate as dup01 } from '../rules/dup-01.js';
import { evaluate as math01 } from '../rules/math-01.js';
import { evaluate as canc01 } from '../rules/canc-01.js';
import { evaluate as mue01 } from '../rules/mue-01.js';
import { bill, ctx, line } from './helpers.js';

describe('credit and reversal netting (shared pre-pass)', () => {
  it('pairs a negative-quantity credit with its original and keeps the first copy standing', () => {
    const a = line({ date: '2026-04-01', code: '80053', qty: 1, unitPrice: 75, amount: 75 });
    const b = line({ date: '2026-04-01', code: '80053', qty: 1, unitPrice: 75, amount: 75 });
    const cr = line({ date: '2026-04-01', code: '80053', qty: -1, unitPrice: 75, amount: -75 });
    const net = netLines([a, b, cr]);
    expect(net.charges.map((l) => l.id)).toEqual([a.id]);
    expect(net.pairs).toHaveLength(1);
    expect(net.pairs[0]!.original.id).toBe(b.id);
    expect(net.unmatchedCredits).toHaveLength(0);
  });

  it('pairs a credit posted days later, and matches a "CR"-marked description without a code', () => {
    const a = line({ date: '2026-04-01', description: 'IV START KIT', qty: 1, amount: 60 });
    const cr = line({ date: '2026-04-15', description: 'IV START KIT CR', qty: 1, amount: -60 });
    expect(netLines([a, cr]).charges).toHaveLength(0);
  });

  it('leaves a partial credit unmatched', () => {
    const a = line({ date: '2026-04-01', code: 'J1100', qty: 4, amount: 40 });
    const cr = line({ date: '2026-04-01', code: 'J1100', qty: -1, amount: -10 });
    const net = netLines([a, cr]);
    expect(net.charges).toHaveLength(1);
    expect(net.unmatchedCredits).toHaveLength(1);
  });

  it('hard negative: a duplicate reversed by a negative-quantity credit is not DUP-01', () => {
    const b = bill([
      line({ date: '2026-04-01', code: 'D4', qty: 1, amount: 75 }),
      line({ date: '2026-04-01', code: 'D4', qty: 1, amount: 75 }),
      line({ date: '2026-04-01', code: 'D4', qty: -1, amount: -75 }),
    ]);
    expect(dup01(b, ctx(), {}).findings).toHaveLength(0);
  });

  it('hard negative: MATH-01 accepts qty x price = -total on a credit line, either quantity sign', () => {
    const b = bill([
      line({ date: '2026-04-01', code: 'E5', qty: 1, unitPrice: 45, amount: 45 }),
      line({ date: '2026-04-01', code: 'E5', qty: 1, unitPrice: 45, amount: -45 }),
      line({ date: '2026-04-02', code: 'E6', qty: -2, unitPrice: 10, amount: -20 }),
      line({ date: '2026-04-02', code: 'E7', qty: 2, unitPrice: 10, amount: -20 }),
    ]);
    expect(math01(b, ctx(), {}).findings).toHaveLength(0);
  });

  it('hard negative: a canceled item reversed by a credit is not CANC-01', () => {
    const b = bill([
      line({ date: '2026-04-01', description: 'IV BAG NOT GIVEN', revCode: '0250', qty: 1, amount: 80 }),
      line({ date: '2026-04-01', description: 'IV BAG NOT GIVEN', revCode: '0250', qty: -1, amount: -80 }),
    ]);
    expect(canc01(b, ctx(), {}).findings).toHaveLength(0);
  });

  it('hard negative: reversed units are not an MUE overage', () => {
    const b = bill([
      line({ date: '2026-04-01', code: '80053', revCode: '0301', qty: 1, amount: 90 }),
      line({ date: '2026-04-01', code: '80053', revCode: '0301', qty: 1, amount: 90 }),
      line({ date: '2026-04-01', code: '80053', revCode: '0301', qty: 1, amount: -90 }),
    ]);
    const data = { mue: () => ({ mue: 1, mai: 2 as const }) };
    expect(mue01(b, ctx({ admitted: false }), data).findings).toHaveLength(0);
  });

  it('analyze(): a fully reversed duplicate raises nothing on its lines', () => {
    const b = bill([
      line({ date: '2026-04-01', code: '85025', description: 'CBC', qty: 1, unitPrice: 60.84, amount: 60.84 }),
      line({ date: '2026-04-01', code: '85025', description: 'CBC', qty: 1, unitPrice: 60.84, amount: 60.84 }),
      line({ date: '2026-04-09', code: '85025', description: 'CBC', qty: -1, unitPrice: 60.84, amount: -60.84 }),
    ]);
    const res = analyze(b, ctx(), {});
    expect(res.findings.filter((f) => ['DUP-01', 'DUP-02', 'MATH-01', 'CANC-01'].includes(f.ruleId))).toHaveLength(0);
  });
});
