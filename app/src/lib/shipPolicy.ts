// Ship-policy gate (docs/SPEC.md §8): the app obeys the corpus scoreboard. The JSON is imported at
// build time, so when the engine lane re-scores, the next build ships the new policy with no app
// edit. Every finding the user sees passes through applyShipPolicy() in AppState.runAnalysis().
//
//   off          → never shown as a finding; listed once under "Checks we're still tuning"
//   low          → shown, confidence capped at Low
//   as-specified → unchanged
//   untested     → unchanged (also the default for rules the scoreboard doesn't list, e.g. info cards)
import scoreboardJson from '../../public/scoreboard.json';
import type { AnalyzeResult, Confidence } from '../types/engine';

export type ShipStatus = 'as-specified' | 'low' | 'off' | 'untested';

export interface ScoreboardRule {
  ruleId: string;
  positives: number;
  findings: number;
  precision: number | null;
  recall: number | null;
  shipAs: string;
}

export interface Scoreboard {
  generated: string;
  commit: string;
  corpusVersion: string;
  corpus: { bills: number; clean: number; labels: number };
  caveat: string;
  method: string;
  rules: ScoreboardRule[];
}

export const SCOREBOARD = scoreboardJson as unknown as Scoreboard;

const KNOWN: ReadonlySet<string> = new Set<ShipStatus>(['as-specified', 'low', 'off', 'untested']);

/** ruleId → status. An unrecognised status fails safe to `off` (a unit test pins the live file). */
export function shipStatuses(sb: Pick<Scoreboard, 'rules'> = SCOREBOARD): Map<string, ShipStatus> {
  const out = new Map<string, ShipStatus>();
  for (const r of sb.rules ?? []) out.set(r.ruleId, KNOWN.has(r.shipAs) ? (r.shipAs as ShipStatus) : 'off');
  return out;
}

const RANK: Record<Confidence, number> = { info: 0, low: 1, medium: 2, high: 3 };

export function capConfidence(c: Confidence, cap: Confidence): Confidence {
  return RANK[c] > RANK[cap] ? cap : c;
}

export function applyShipPolicy(
  result: AnalyzeResult,
  statuses: Map<string, ShipStatus> = shipStatuses(),
): AnalyzeResult {
  const status = (ruleId: string): ShipStatus => statuses.get(ruleId) ?? 'untested';
  const gate = (list: AnalyzeResult['findings']) =>
    list
      .filter((f) => status(f.ruleId) !== 'off')
      .map((f) => (status(f.ruleId) === 'low' ? { ...f, confidence: capConfidence(f.confidence, 'low') } : f));
  return {
    findings: gate(result.findings),
    infoCards: gate(result.infoCards),
    // An off rule is listed once, in the "still tuning" note, not again under "couldn't run".
    skipped: result.skipped.filter((s) => status(s.ruleId) !== 'off'),
  };
}

/** Rule IDs held back by the policy, in scoreboard order. Independent of the bill. */
export function rulesStillTuning(statuses: Map<string, ShipStatus> = shipStatuses()): string[] {
  return [...statuses].filter(([, s]) => s === 'off').map(([id]) => id);
}
