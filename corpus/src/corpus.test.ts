import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateCorpus } from './evaluate.js';
import { CORPUS_DIR, generateCorpus } from './generate.js';

const corpus = generateCorpus();

describe('synthetic corpus v1', () => {
  it('is deterministic for the same seed', () => {
    expect(JSON.stringify(generateCorpus())).toBe(JSON.stringify(corpus));
  });

  it('matches the committed data/v1 files', () => {
    for (const item of corpus.slice(0, 300).filter((_, i) => i % 7 === 0)) {
      const onDisk = JSON.parse(readFileSync(join(CORPUS_DIR, `${item.id}.json`), 'utf8'));
      expect(onDisk).toEqual(JSON.parse(JSON.stringify(item)));
    }
  });

  it('has 100 bills per kind and 30% clean bills', () => {
    expect(corpus).toHaveLength(300);
    for (const k of ['inpatient', 'ed', 'professional']) expect(corpus.filter((i) => i.kind === k)).toHaveLength(100);
    expect(corpus.filter((i) => i.clean)).toHaveLength(90);
    for (const i of corpus.filter((x) => !x.clean)) expect(i.plants.length).toBeGreaterThanOrEqual(1);
  });

  it('labels almost every planted error (plants can neutralize each other)', () => {
    const plants = corpus.flatMap((i) => i.plants.map((p) => i.labels.some((l) => l.ruleId === p)));
    expect(plants.filter(Boolean).length / plants.length).toBeGreaterThan(0.97);
  });

  it('includes each SPEC §8 hard negative many times', () => {
    const tags = corpus.flatMap((i) => i.tags);
    for (const h of ['repeat-mod', 'same-day-admit-discharge', 'bilateral', 'credit-reversal', 'ncci-mi1-59', 'gfe-399', 'gfe-121-days']) {
      expect(tags.filter((t) => t === `hn:${h}`).length, h).toBeGreaterThanOrEqual(9);
    }
  });

  it('uses only fake identities', () => {
    for (const i of corpus) {
      expect(i.bill.header.patientName).toMatch(/^Test Patient \d{3}$/);
      expect(i.bill.header.accountNumber).toMatch(/^TEST-\d{7}$/);
      expect(i.bill.header.providerName).toMatch(/^(Example|Sample) /);
    }
  });

  it('evaluates every rule and finds the planted errors', () => {
    const ev = evaluateCorpus(corpus);
    expect(ev.rules).toHaveLength(21);
    expect(ev.overall.recall).toBeGreaterThan(0.9);
  });
});
