import { describe, expect, it } from 'vitest';
import { screen, fplPercent, type FplDoc, type StateCharityDoc } from '../screener.js';
import { ctx } from './helpers.js';

const FPL: FplDoc = {
  year: 2026,
  guidelines: {
    '48states_dc': { base: 15_960, increment: 5_680 },
    alaska: { base: 19_950, increment: 7_100 },
    hawaii: { base: 18_360, increment: 6_530 },
  },
};

const STATE_CHARITY: StateCharityDoc = {
  asOf: '2026-10-01',
  source: 'test fixture',
  states: {
    WA: {
      state: 'WA',
      hasMandate: true,
      verified: true,
      mechanism: 'discount',
      mandateMaxPct: 400,
      summary: 'Tier A (large systems): free <=300% FPL, discounts to 400%. Tier B (other hospitals): free <=200% FPL, discounts to 300%.',
      who: 'All patients and guarantors.',
      hospitalsCovered: 'All WA hospitals.',
      citation: 'RCW 70.170.060(5)',
      sourceUrl: 'https://app.leg.wa.gov/RCW/default.aspx?cite=70.170.060',
      caveats: ['Ask which tier your hospital is in: Tier A reaches 400% FPL; Tier B only reaches 300% FPL.'],
    },
    DE: {
      state: 'DE',
      hasMandate: true,
      verified: true,
      mechanism: 'discount',
      mandateMaxPct: 400,
      effectiveDate: '2027-01-01',
      summary: 'Not yet in effect.',
      who: 'DE residents.',
      hospitalsCovered: 'DE hospitals.',
      citation: '16 Del. C. §9961',
      sourceUrl: 'https://delcode.delaware.gov',
      caveats: [],
    },
    MN: {
      state: 'MN',
      hasMandate: false,
      verified: true,
      mechanism: 'discount',
      mandateMaxPct: null,
      summary: 'No FPL mandate.',
      who: 'n/a',
      hospitalsCovered: 'n/a',
      citation: 'Minn. Stat. §144.587',
      sourceUrl: 'https://www.revisor.mn.gov/statutes/cite/144.587',
      caveats: [],
    },
  },
};

const HOSPITAL_DATA = {
  hospital: (ccn: string) => {
    if (ccn === 'NONPROFIT1')
      return { name: 'Test Nonprofit', state: 'WA', ownership: 'Voluntary non-profit - Private', ownershipCategory: 'nonprofit' as const };
    if (ccn === 'FORPROFIT1')
      return { name: 'Test For-Profit', state: 'TX', ownership: 'Proprietary', ownershipCategory: 'proprietary' as const };
    return undefined;
  },
};

describe('fplPercent', () => {
  it('computes the 48-states-and-DC region (default)', () => {
    expect(fplPercent(ctx({ householdSize: 1, annualIncome: 15_960 }), FPL)).toBe(100);
    expect(fplPercent(ctx({ householdSize: 1, annualIncome: 23_940 }), FPL)).toBe(150);
    expect(fplPercent(ctx({ householdSize: 4, annualIncome: 33_000 }), FPL)).toBe(100);
  });

  it('computes the Alaska region', () => {
    expect(fplPercent(ctx({ state: 'AK', householdSize: 1, annualIncome: 19_950 }), FPL)).toBe(100);
    expect(fplPercent(ctx({ state: 'AK', householdSize: 1, annualIncome: 39_900 }), FPL)).toBe(200);
  });

  it('computes the Hawaii region', () => {
    expect(fplPercent(ctx({ state: 'HI', householdSize: 1, annualIncome: 18_360 }), FPL)).toBe(100);
    expect(fplPercent(ctx({ state: 'HI', householdSize: 2, annualIncome: 24_890 }), FPL)).toBe(100);
  });

  it('returns null without household size or income', () => {
    expect(fplPercent(ctx({ householdSize: 2 }), FPL)).toBeNull();
    expect(fplPercent(ctx({ annualIncome: 10_000 }), FPL)).toBeNull();
  });

  it('falls back to the literal 2026 guideline constants when no FPL doc is supplied', () => {
    expect(fplPercent(ctx({ householdSize: 1, annualIncome: 15_960 }), null)).toBe(100);
  });
});

describe('screen() — state tiers (WA has two tiers)', () => {
  it('surfaces the WA Tier A/B distinction in caveats rather than guessing the hospital tier', () => {
    const result = screen(ctx({ state: 'WA', householdSize: 1, annualIncome: 55_860 /* 350% FPL */ }), {}, FPL, STATE_CHARITY);
    expect(result.fplPercent).toBe(350);
    expect(result.stateScreen?.found).toBe(true);
    expect(result.stateScreen?.caveats.join(' ')).toMatch(/Tier A/);
    expect(result.stateScreen?.caveats.join(' ')).toMatch(/Tier B/);
    // 350% is within WA's overall mandated range (up to 400% at Tier A hospitals), but no hospital
    // was picked, so the law's hospital condition is unconfirmed -> worth asking, naming it.
    expect(result.wording).toBe('worth_asking');
    expect(result.wordingText).toMatch(/a hospital in WA/);
    // With a WA hospital picked, every condition is met -> may_qualify, hedged and specific.
    const withHospital = screen(
      ctx({ state: 'WA', householdSize: 1, annualIncome: 55_860, hospitalCcn: 'NONPROFIT1' }),
      HOSPITAL_DATA, FPL, STATE_CHARITY,
    );
    expect(withHospital.wording).toBe('may_qualify');
    expect(withHospital.wordingText).not.toMatch(/you qualify/i); // never the bare, unhedged phrase
    expect(withHospital.wordingText).toMatch(/you may qualify/i);
    expect(withHospital.wordingText).toMatch(/350% of the federal poverty guideline/);
    expect(withHospital.wordingText).toMatch(/Test Nonprofit is a hospital in WA/);
  });

  it('does not claim "may qualify" once income is above every WA tier', () => {
    const result = screen(ctx({ state: 'WA', householdSize: 1, annualIncome: 200_000 }), {}, FPL, STATE_CHARITY);
    expect(result.wording).not.toBe('may_qualify');
  });

  it('treats a not-yet-effective state law (DE, starts 2027-01-01) as not currently mandating anything', () => {
    const result = screen(ctx({ state: 'DE', today: '2026-10-01', householdSize: 1, annualIncome: 16_000 }), {}, FPL, STATE_CHARITY);
    expect(result.wording).not.toBe('may_qualify');
    expect(result.stateScreen?.notYetEffective).toBe('2027-01-01');
    expect(result.stateScreen?.message).toMatch(/isn't in effect/i);
  });

  it('reports a state with no mandate honestly (MN)', () => {
    const result = screen(ctx({ state: 'MN', householdSize: 1, annualIncome: 10_000 }), {}, FPL, STATE_CHARITY);
    expect(result.stateScreen?.found).toBe(true);
    expect(result.wording).toBe('worth_asking'); // low income still clears the <=400% "worth asking" floor
  });

  it('is honest about an unresearched state', () => {
    const result = screen(ctx({ state: 'ZZ', householdSize: 1, annualIncome: 10_000 }), {}, FPL, STATE_CHARITY);
    expect(result.stateScreen?.found).toBe(false);
    expect(result.stateScreen?.message).toMatch(/haven't researched/i);
  });
});

describe('screen() — hospital ownership message', () => {
  it('flags a nonprofit hospital with 501(r) applicability', () => {
    const result = screen(ctx({ hospitalCcn: 'NONPROFIT1' }), HOSPITAL_DATA, FPL, STATE_CHARITY);
    expect(result.hospital?.ownershipCategory).toBe('nonprofit');
    expect(result.hospital?.message).toMatch(/501\(r\)/);
    expect(result.wording).toBe('worth_asking');
  });

  it('flags a for-profit hospital as 501(r)-inapplicable', () => {
    const result = screen(ctx({ hospitalCcn: 'FORPROFIT1' }), HOSPITAL_DATA, FPL, STATE_CHARITY);
    expect(result.hospital?.ownershipCategory).toBe('proprietary');
    expect(result.hospital?.message).toMatch(/don't apply/);
  });
});

describe('screen() — 501(r) timing boundaries (240 days)', () => {
  it('is within the mandatory-acceptance window at exactly 240 days', () => {
    const result = screen(
      ctx({ firstPostDischargeStatementDate: '2026-02-01', today: '2026-09-29' /* exactly 240 days later */ }),
      {},
      FPL,
      STATE_CHARITY,
    );
    expect(result.timing501r.deadline).toBe('2026-09-29');
    expect(result.timing501r.message).toMatch(/must accept and process/);
  });

  it('flips to the late-application message at 241 days', () => {
    const result = screen(
      ctx({ firstPostDischargeStatementDate: '2026-02-01', today: '2026-09-30' /* 241 days later */ }),
      {},
      FPL,
      STATE_CHARITY,
    );
    expect(result.timing501r.message).toMatch(/may still choose to accept a late application/);
  });

  it('asks for the statement date when missing', () => {
    const result = screen(ctx({}), {}, FPL, STATE_CHARITY);
    expect(result.timing501r.deadline).toBeNull();
  });
});

describe('screen() — deadline tracker (120-day PPDR, 120/240-day FAP)', () => {
  it('computes the 120-day PPDR deadline from the first bill date', () => {
    const result = screen(ctx({ firstBillDate: '2026-01-01' }), {}, FPL, STATE_CHARITY);
    const ppdr = result.deadlines.find((d) => d.id === 'ppdr-120');
    expect(ppdr?.date).toBe('2026-05-01'); // 2026 is not a leap year; Jan 1 + 120 days
  });

  it('computes the 120-day ECA floor and 240-day FAP ceiling from the first post-discharge statement', () => {
    const result = screen(ctx({ firstPostDischargeStatementDate: '2026-01-01' }), {}, FPL, STATE_CHARITY);
    const eca = result.deadlines.find((d) => d.id === 'eca-120');
    const fap = result.deadlines.find((d) => d.id === 'fap-240');
    expect(eca?.date).toBe('2026-05-01');
    expect(fap?.date).toBe('2026-08-29');
  });

  it('omits deadlines that have no supporting date', () => {
    const result = screen(ctx({}), {}, FPL, STATE_CHARITY);
    expect(result.deadlines).toHaveLength(0);
  });
});

describe('screen() — Medicaid and Marketplace info', () => {
  it('always includes the Medicaid retroactive-coverage note with its 2027 caveat', () => {
    const result = screen(ctx({}), {}, FPL, STATE_CHARITY);
    expect(result.medicaid.message).toMatch(/2027-01-01/);
    expect(result.medicaid.citations.length).toBeGreaterThan(0);
  });

  it('always includes the Marketplace SEP note', () => {
    const result = screen(ctx({}), {}, FPL, STATE_CHARITY);
    expect(result.marketplace.message).toMatch(/special enrollment/i);
  });

  it('always returns the assistance-program list', () => {
    const result = screen(ctx({}), {}, FPL, STATE_CHARITY);
    expect(result.programs.length).toBeGreaterThan(0);
    expect(result.programs.every((p) => p.citations.length > 0)).toBe(true);
  });
});
