import type { AnalyzeResult, Bill, Confidence, Context, Datasets, Finding, Skipped } from './types.js';
import * as dup01 from './rules/dup-01.js';
import * as dup02 from './rules/dup-02.js';
import * as math01 from './rules/math-01.js';
import * as math02 from './rules/math-02.js';
import * as mue01 from './rules/mue-01.js';
import * as qty01 from './rules/qty-01.js';
import * as rb01 from './rules/rb-01.js';
import * as date01 from './rules/date-01.js';
import * as ncci01 from './rules/ncci-01.js';
import * as canc01 from './rules/canc-01.js';
import * as rx01 from './rules/rx-01.js';
import * as eob01 from './rules/eob-01.js';
import * as eob02 from './rules/eob-02.js';
import * as ins01 from './rules/ins-01.js';
import * as mcd01 from './rules/mcd-01.js';
import * as nsa01 from './rules/nsa-01.js';
import * as nsa02 from './rules/nsa-02.js';
import * as gfe01 from './rules/gfe-01.js';
import * as eca01 from './rules/eca-01.js';
import * as ppdr01 from './rules/ppdr-01.js';
import * as cr01 from './rules/cr-01.js';
import { fap01, fac01, id01 } from './info-cards.js';

interface RuleModule {
  id: string;
  evaluate: (bill: Bill, ctx: Context, data: Datasets) => { findings: Finding[]; skipped?: Skipped };
}

const RULES: RuleModule[] = [
  dup01, dup02, math01, math02, mue01, qty01, rb01, date01, ncci01, canc01,
  rx01, eob01, eob02, ins01, mcd01, nsa01, nsa02, gfe01, eca01, ppdr01, cr01,
];

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1, info: 0 };

export function analyze(bill: Bill, ctx: Context, data: Datasets): AnalyzeResult {
  if (bill.confirmed === false) {
    return {
      findings: [],
      skipped: [{ ruleId: 'ALL', needs: ['confirm your bill lines'] }],
      infoCards: [],
    };
  }

  const findings: Finding[] = [];
  const skipped: Skipped[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const result = rule.evaluate(bill, ctx, data);
    for (const f of result.findings) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      findings.push(f);
    }
    if (result.skipped) skipped.push(result.skipped);
  }

  findings.sort((a, b) => {
    const rank = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (rank !== 0) return rank;
    return (b.dollarsAtStake ?? -1) - (a.dollarsAtStake ?? -1);
  });

  const infoCards: Finding[] = [];
  const fap = fap01(bill, ctx, data);
  if (fap) infoCards.push(fap);
  infoCards.push(id01());
  const fac = fac01(bill);
  if (fac) infoCards.push(fac);

  return { findings, skipped, infoCards };
}
