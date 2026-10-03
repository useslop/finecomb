import { describe, expect, it } from 'vitest';
import { screen, LAW_CONDITIONS, type StateCharityDoc } from '../screener.js';
import type { Context, Datasets, Insurance } from '../types.js';
import { ctx } from './helpers.js';

// "You may qualify" only when the user's answers meet every condition the state law covers:
// income under the threshold, insurance status, residency and the hospital (in the state, and
// nonprofit where the law says so). Anything unconfirmed -> "worth asking", naming the condition.
// Runs against the real engine/data/state-charity.json the app ships.

// A variable specifier keeps tsc (rootDir = src, no node types) out of it; vitest loads the JSON.
const TABLE_PATH = '../../data/state-charity.json';
const TABLE = ((await import(/* @vite-ignore */ TABLE_PATH)) as { default: StateCharityDoc }).default;

function data(state: string, ownershipCategory: 'nonprofit' | 'proprietary' = 'nonprofit'): Datasets {
  return {
    hospital: (ccn) =>
      ccn === 'H1' ? { name: `Test ${state} Hospital`, state, ownership: ownershipCategory, ownershipCategory } : undefined,
  };
}

/** Household of 1 at 100% FPL: under every state's threshold. */
function answers(state: string, patch: Partial<Context> = {}): Context {
  return ctx({ today: '2026-10-02', state, householdSize: 1, annualIncome: 15_960, hospitalCcn: 'H1', insurance: 'none', stateResident: true, ...patch });
}

const QUALIFYING = ['WA', 'CA', 'IL', 'MD', 'NJ', 'CO', 'OR', 'NM'];
const UNCONFIRMABLE = ['CT', 'RI', 'ME'];
const UNVERIFIED = ['NY', 'MA'];

describe('screener: every state with conditions', () => {
  it('has a condition spec for every verified, FPL-based mandate in state-charity.json', () => {
    const needed = Object.values(TABLE.states)
      .filter((r) => r.hasMandate && r.verified && r.mandateMaxPct != null)
      .map((r) => r.state);
    for (const s of needed) expect(LAW_CONDITIONS[s], s).toBeDefined();
  });

  for (const state of QUALIFYING) {
    describe(state, () => {
      const spec = LAW_CONDITIONS[state]!;

      it('says "may qualify" when every condition is met, and names them', () => {
        const r = screen(answers(state), data(state), null, TABLE);
        expect(r.wording).toBe('may_qualify');
        expect(r.wordingText).toMatch(/You may qualify/);
        expect(r.wordingText).toMatch(/100% of the federal poverty guideline/);
        expect(r.wordingText).toContain(`Test ${state} Hospital is a`);
        if (spec.insurance === 'uninsured') expect(r.wordingText).toContain('no health insurance');
        if (spec.resident) expect(r.wordingText).toContain(`you live in ${state}`);
        if (spec.hospital === 'nonprofit_in_state') expect(r.wordingText).toContain('nonprofit hospital');
      });

      it('says "worth asking" above the income threshold', () => {
        const r = screen(answers(state, { annualIncome: 15_960 * 7 }), data(state), null, TABLE);
        expect(r.wording).not.toBe('may_qualify');
      });

      it('says "worth asking" with no hospital picked, or a hospital in another state', () => {
        const none = screen(answers(state, { hospitalCcn: undefined }), data(state), null, TABLE);
        expect(none.wording).toBe('worth_asking');
        expect(none.wordingText).toMatch(new RegExp(`hospital in ${state}`));
        const other = screen(answers(state), data(state === 'TX' ? 'OK' : 'TX'), null, TABLE);
        expect(other.wording).toBe('worth_asking');
        expect(other.wordingText).toMatch(/is in (TX|OK)/);
      });

      if (spec.insurance === 'uninsured') {
        it('says "worth asking" for an insured user, or one who did not say', () => {
          for (const insurance of ['commercial', 'medicare', undefined] as (Insurance | undefined)[]) {
            const r = screen(answers(state, { insurance }), data(state), null, TABLE);
            expect(r.wording, String(insurance)).toBe('worth_asking');
            expect(r.wordingText).toContain('no health insurance');
          }
        });
      } else {
        it('still says "may qualify" for an insured user (the law covers insured patients)', () => {
          const r = screen(answers(state, { insurance: 'commercial' }), data(state), null, TABLE);
          expect(r.wording).toBe('may_qualify');
        });
      }

      if (spec.resident) {
        it('says "worth asking" until the user says they live in the state', () => {
          const r = screen(answers(state, { stateResident: undefined }), data(state), null, TABLE);
          expect(r.wording).toBe('worth_asking');
          expect(r.wordingText).toContain(`that you live in ${state}`);
        });
      }

      if (spec.hospital === 'nonprofit_in_state') {
        it('says "worth asking" at a for-profit hospital', () => {
          const r = screen(answers(state), data(state, 'proprietary'), null, TABLE);
          expect(r.wording).toBe('worth_asking');
          expect(r.wordingText).toContain("isn't listed as nonprofit");
        });
      }
    });
  }

  for (const state of UNCONFIRMABLE) {
    it(`${state}: never "may qualify", because the law needs something the screener can't ask; it names it`, () => {
      const r = screen(answers(state), data(state), null, TABLE);
      expect(r.wording).toBe('worth_asking');
      expect(r.wordingText).toContain(LAW_CONDITIONS[state]!.unconfirmable!);
    });
  }

  for (const state of UNVERIFIED) {
    it(`${state}: never "may qualify" while its row is not verified`, () => {
      const r = screen(answers(state), data(state), null, TABLE);
      expect(r.wording).toBe('worth_asking');
    });
  }

  it('NV: never "may qualify" (flat discount at "major hospitals", no FPL threshold)', () => {
    const r = screen(answers('NV'), data('NV'), null, TABLE);
    expect(r.wording).not.toBe('may_qualify');
  });

  it('DE: "worth asking" before 2027-01-01, "may qualify" once in force with every condition met', () => {
    expect(screen(answers('DE'), data('DE'), null, TABLE).wording).toBe('worth_asking');
    const later = screen(answers('DE', { today: '2027-02-01' }), data('DE'), null, TABLE);
    expect(later.wording).toBe('may_qualify');
    expect(later.wordingText).toContain('you live in DE');
    const notResident = screen(answers('DE', { today: '2027-02-01', stateResident: undefined }), data('DE'), null, TABLE);
    expect(notResident.wording).toBe('worth_asking');
  });
});
