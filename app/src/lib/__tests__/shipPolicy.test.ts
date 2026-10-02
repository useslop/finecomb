import { describe, expect, it } from 'vitest';
import type { AnalyzeResult, Finding } from '../../types/engine';
import {
  SCOREBOARD,
  applyShipPolicy,
  capConfidence,
  rulesStillTuning,
  shipStatuses,
  type ShipStatus,
} from '../shipPolicy';
import { RULE_TITLES } from '../rulesMeta';

function finding(ruleId: string, confidence: Finding['confidence'], id = `${ruleId}-x`): Finding {
  return {
    id,
    ruleId,
    title: ruleId,
    why: '',
    userText: '',
    verify: '',
    evidenceLineIds: [],
    confidence,
    dollarsAtStake: null,
    citations: [],
  };
}

const statuses = new Map<string, ShipStatus>([
  ['OFF-1', 'off'],
  ['LOW-1', 'low'],
  ['SPEC-1', 'as-specified'],
  ['NEW-1', 'untested'],
]);

function result(findings: Finding[], extra: Partial<AnalyzeResult> = {}): AnalyzeResult {
  return { findings, skipped: [], infoCards: [], ...extra };
}

describe('applyShipPolicy', () => {
  it('never shows a finding from an off rule', () => {
    const r = applyShipPolicy(result([finding('OFF-1', 'high'), finding('SPEC-1', 'high')]), statuses);
    expect(r.findings.map((f) => f.ruleId)).toEqual(['SPEC-1']);
  });

  it('caps a low rule at Low confidence', () => {
    const r = applyShipPolicy(
      result([finding('LOW-1', 'high', 'a'), finding('LOW-1', 'medium', 'b'), finding('LOW-1', 'low', 'c')]),
      statuses,
    );
    expect(r.findings.map((f) => f.confidence)).toEqual(['low', 'low', 'low']);
  });

  it('does not raise an info finding when capping', () => {
    expect(capConfidence('info', 'low')).toBe('info');
    const r = applyShipPolicy(result([finding('LOW-1', 'info')]), statuses);
    expect(r.findings[0]?.confidence).toBe('info');
  });

  it('leaves as-specified, untested and unlisted rules unchanged', () => {
    const input = [finding('SPEC-1', 'high'), finding('NEW-1', 'medium'), finding('FAP-01', 'info')];
    const r = applyShipPolicy(result(input), statuses);
    expect(r.findings).toEqual(input);
  });

  it('applies the same gate to info cards and drops off rules from "couldn\'t run"', () => {
    const r = applyShipPolicy(
      result([], {
        infoCards: [finding('OFF-1', 'info'), finding('ID-01', 'info')],
        skipped: [
          { ruleId: 'OFF-1', needs: ['x'] },
          { ruleId: 'SPEC-1', needs: ['y'] },
        ],
      }),
      statuses,
    );
    expect(r.infoCards.map((f) => f.ruleId)).toEqual(['ID-01']);
    expect(r.skipped.map((s) => s.ruleId)).toEqual(['SPEC-1']);
  });

  it('does not mutate the engine result', () => {
    const input = result([finding('LOW-1', 'high')]);
    applyShipPolicy(input, statuses);
    expect(input.findings[0]?.confidence).toBe('high');
  });

  it('fails safe to off for an unknown status', () => {
    const s = shipStatuses({ rules: [{ ruleId: 'R', positives: 0, findings: 0, precision: null, recall: null, shipAs: 'maybe' }] });
    expect(s.get('R')).toBe('off');
  });

  it('lists each off rule once', () => {
    expect(rulesStillTuning(statuses)).toEqual(['OFF-1']);
  });
});

describe('the shipped scoreboard (public/scoreboard.json)', () => {
  it('uses only known ship statuses', () => {
    for (const r of SCOREBOARD.rules) {
      expect(['as-specified', 'low', 'off', 'untested']).toContain(r.shipAs);
    }
  });

  it('has a plain title in rules-meta for every scored rule', () => {
    for (const r of SCOREBOARD.rules) expect(RULE_TITLES[r.ruleId], r.ruleId).toBeTruthy();
  });

  it('matches what the live policy hides', () => {
    const live = shipStatuses();
    const off = SCOREBOARD.rules.filter((r) => r.shipAs === 'off').map((r) => r.ruleId);
    expect(rulesStillTuning(live)).toEqual(off);
  });
});
