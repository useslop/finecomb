// Runs analyze() from @finecomb/engine over the corpus and scores it against the ground-truth labels.
// Matching: a finding matches a label of the same rule when their evidence lines overlap, or when either
// side is bill-level (no line ids). TP = labels found, FN = labels missed, FP = findings that match no label.
import { analyze, type Finding } from '@finecomb/engine';
import type { CorpusItem, Label } from './types.js';
import { toDatasets } from './types.js';

export const RULE_IDS = ['DUP-01', 'DUP-02', 'MATH-01', 'MATH-02', 'MUE-01', 'QTY-01', 'RB-01', 'DATE-01', 'NCCI-01', 'CANC-01',
  'RX-01', 'EOB-01', 'EOB-02', 'INS-01', 'MCD-01', 'NSA-01', 'NSA-02', 'GFE-01', 'ECA-01', 'PPDR-01', 'CR-01'] as const;
export const PRECISION_FLOOR = 0.9;

export type ShipAs = 'as-specified' | 'low' | 'off' | 'untested';
export interface RuleMetrics {
  ruleId: string; positives: number; findings: number; tp: number; fp: number; fn: number;
  precision: number | null; recall: number | null; f1: number | null; fpPerCleanBill: number;
  skippedOnBills: number; shipAs: ShipAs; topFalsePositiveCauses: [string, number][]; topMissCauses: [string, number][];
}
export interface Example { bill: string; kind: string; tags: string[]; detail: string; lineIds: string[] }
export interface Evaluation {
  rules: RuleMetrics[];
  overall: { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number; fpPerCleanBill: number };
  confusion: Record<string, { falsePositives: Example[]; misses: Example[] }>;
  bills: number; clean: number;
}

const matches = (f: Finding, l: Label) =>
  (!l.textIncludes || `${f.title} ${f.userText}`.includes(l.textIncludes)) &&
  (l.lineIds.length === 0 || f.evidenceLineIds.length === 0 || f.evidenceLineIds.some((id) => l.lineIds.includes(id)));
const RANK = { info: 0, low: 1, medium: 2, high: 3 } as const;
/** An optional label absorbs a finding only at or below its maxConfidence (v1/hold-out have no optional labels). */
const absorbs = (f: Finding, l: Label) => matches(f, l) && (!l.maxConfidence || RANK[f.confidence] <= RANK[l.maxConfidence]);
const round = (n: number | null) => (n == null ? null : Math.round(n * 1000) / 1000);
const causeTags = (item: CorpusItem, ruleId: string, miss: boolean) => {
  const t = item.tags.filter((x) => (miss ? x.startsWith(`plant:${ruleId}`) : (x.startsWith('hn:') || x.startsWith('variant:')) && !/eob-line-level-co|variant:sched-/.test(x)));
  return t.length ? t : [miss ? `collateral (label not planted for ${ruleId})` : `(no hard-negative tag; ${item.kind}/${item.sub})`];
};

export function shipAsFor(precision: number | null): ShipAs {
  if (precision == null) return 'untested';
  if (precision >= PRECISION_FLOOR) return 'as-specified';
  return precision >= 0.6 ? 'low' : 'off';
}

export function evaluateCorpus(items: CorpusItem[]): Evaluation {
  const clean = items.filter((i) => i.clean).length;
  const acc = new Map<string, { tp: number; fp: number; fn: number; fpClean: number; positives: number; findings: number; skipped: number; fpCause: Map<string, number>; fnCause: Map<string, number> }>();
  const confusion: Evaluation['confusion'] = {};
  for (const id of RULE_IDS) {
    acc.set(id, { tp: 0, fp: 0, fn: 0, fpClean: 0, positives: 0, findings: 0, skipped: 0, fpCause: new Map(), fnCause: new Map() });
    confusion[id] = { falsePositives: [], misses: [] };
  }
  for (const item of items) {
    const res = analyze(item.bill, item.ctx, toDatasets(item.data));
    for (const id of RULE_IDS) {
      const a = acc.get(id)!;
      const F = res.findings.filter((f) => f.ruleId === id);
      const L = item.labels.filter((l) => l.ruleId === id && !l.optional);
      const O = item.labels.filter((l) => l.ruleId === id && l.optional);
      a.positives += L.length; a.findings += F.length;
      if (res.skipped.some((s) => s.ruleId === id)) a.skipped++;
      for (const l of L) {
        if (F.some((f) => matches(f, l))) { a.tp++; continue; }
        a.fn++;
        for (const c of causeTags(item, id, true)) a.fnCause.set(c, (a.fnCause.get(c) ?? 0) + 1);
        confusion[id]!.misses.push({ bill: item.id, kind: `${item.kind}/${item.sub}`, tags: item.tags, lineIds: l.lineIds,
          detail: res.skipped.find((s) => s.ruleId === id) ? `engine skipped: needs ${res.skipped.find((s) => s.ruleId === id)!.needs.join('; ')}` : 'engine ran, no matching finding' });
      }
      for (const f of F) {
        if (L.some((l) => matches(f, l)) || O.some((l) => absorbs(f, l))) continue;
        a.fp++; if (item.clean) a.fpClean++;
        for (const c of causeTags(item, id, false)) a.fpCause.set(c, (a.fpCause.get(c) ?? 0) + 1);
        confusion[id]!.falsePositives.push({ bill: item.id, kind: `${item.kind}/${item.sub}`, tags: item.tags, lineIds: f.evidenceLineIds, detail: `${f.title} | ${f.why}` });
      }
    }
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  const rules: RuleMetrics[] = RULE_IDS.map((id) => {
    const a = acc.get(id)!;
    const precision = a.tp + a.fp ? a.tp / (a.tp + a.fp) : null;
    const recall = a.tp + a.fn ? a.tp / (a.tp + a.fn) : null;
    const f1 = precision != null && recall != null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : null;
    return {
      ruleId: id, positives: a.positives, findings: a.findings, tp: a.tp, fp: a.fp, fn: a.fn,
      precision: round(precision), recall: round(recall), f1: round(f1), fpPerCleanBill: round(clean ? a.fpClean / clean : 0)!,
      skippedOnBills: a.skipped, shipAs: shipAsFor(precision), topFalsePositiveCauses: top(a.fpCause), topMissCauses: top(a.fnCause),
    };
  });
  const tp = rules.reduce((s, r) => s + r.tp, 0); const fp = rules.reduce((s, r) => s + r.fp, 0); const fn = rules.reduce((s, r) => s + r.fn, 0);
  const P = tp / (tp + fp || 1); const R = tp / (tp + fn || 1);
  const fpClean = [...acc.values()].reduce((s, a) => s + a.fpClean, 0);
  return {
    rules, confusion, bills: items.length, clean,
    overall: { tp, fp, fn, precision: round(P)!, recall: round(R)!, f1: round(P + R ? (2 * P * R) / (P + R) : 0)!, fpPerCleanBill: round(clean ? fpClean / clean : 0)! },
  };
}
