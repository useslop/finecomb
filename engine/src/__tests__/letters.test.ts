import { describe, expect, it } from 'vitest';
import { renderLetter, LETTER_TITLES, type LetterId } from '../letters.js';
import { bill, ctx, line } from './helpers.js';
import type { Finding } from '../types.js';

const ALL_IDS: LetterId[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

function finding(partial: Partial<Finding> & { id: string }): Finding {
  return {
    ruleId: 'TEST',
    title: 'Test finding',
    why: 'why',
    userText: 'why. Ask them to fix it.',
    verify: 'verify text',
    evidenceLineIds: [],
    confidence: 'medium',
    dollarsAtStake: null,
    citations: [],
    ...partial,
  };
}

describe('renderLetter — all 7 templates render with a fully-populated bill/ctx/user', () => {
  const b = bill(
    [line({ id: 'L1', date: '2026-06-02', code: '99214', description: 'Office visit', amount: 250 })],
    {
      patientName: 'Jamie Rivera',
      providerName: 'Riverside Clinic',
      accountNumber: 'ACCT-1',
      statementDate: '2026-06-10',
      totalCharges: 250,
      balanceDue: 250,
    },
  );
  const c = ctx({
    insurerName: 'Acme Health Plan',
    firstPostDischargeStatementDate: '2026-06-10',
    firstBillDate: '2026-06-10',
    householdSize: 2,
    annualIncome: 30_000,
    gfe: [{ provider: 'Riverside Clinic', total: 200 }],
    eob: { patientResponsibility: 50 },
    oonClinicianTypes: ['Anesthesia'],
  });
  const user = {
    patientDob: '1990-01-01',
    patientAddress: '123 Main St',
    phone: '555-1212',
    email: 'jamie@example.com',
    providerBillingAddress: '1 Hospital Way',
    memberId: 'M123',
    groupNumber: 'G1',
    claimNumber: 'C1',
    isNonprofit501r: true,
    fplPercent: 120,
    stateLawSentence: 'Washington law also applies.',
    facilityName: 'Riverside Hospital',
    clinicianType: 'Anesthesia',
    eobDate: '2026-06-15',
    issue: 'balance_exceeds_eob' as const,
    issueDetails: 'The balance is higher than my EOB.',
    requestedAction: 'Reprocess this claim.',
  };

  for (const id of ALL_IDS) {
    it(`${id} (${LETTER_TITLES[id]}) renders non-empty text with the footer`, () => {
      const text = renderLetter(id, { bill: b, ctx: c, findings: [finding({ id: 'f1', dollarsAtStake: 50, evidenceLineIds: ['L1'] })], user });
      expect(text.length).toBeGreaterThan(50);
      expect(text).toMatch(/Finecomb, a free consumer tool/);
      expect(text).toMatch(/Jamie Rivera/);
      expect(text).not.toMatch(/\[Patient name\]/);
    });
  }
});

describe('renderLetter — missing fields become [brackets], never silently blank', () => {
  const b = bill([], {});
  const c = ctx({});

  it('L1 brackets patient name, DOB, account number and dates of service', () => {
    const text = renderLetter('L1', { bill: b, ctx: c, findings: [] });
    expect(text).toMatch(/\[Patient name\]/);
    expect(text).toMatch(/\[Date of birth\]/);
    expect(text).toMatch(/\[Account number\]/);
    expect(text).toMatch(/\[Dates of service\]/);
  });

  it('L1 omits the optional state-itemized-law sentence cleanly when absent', () => {
    const text = renderLetter('L1', { bill: b, ctx: c, findings: [] });
    expect(text).not.toMatch(/\[state_itemized_law_sentence\]/);
    expect(text).toMatch(/45 CFR 164\.524\)\.\s*\n/); // sentence ends cleanly, nothing appended
  });

  it('L7 falls back to the default records list when none is supplied', () => {
    const text = renderLetter('L7', { bill: b, ctx: c, findings: [] });
    expect(text).toMatch(/medication administration record/);
  });

  it('L3 does not claim nonprofit 501(r) protection unless the app says so', () => {
    const text = renderLetter('L3', { bill: b, ctx: c, findings: [] });
    expect(text).not.toMatch(/501\(r\)/);
  });
});

describe('renderLetter L2 — findings loop', () => {
  it('renders one dispute row per selected finding with evidence, issue and request text', () => {
    const b = bill([line({ id: 'rb1', date: '2026-06-05', description: 'Room and board', amount: 200 })], {
      patientName: 'Jamie Rivera',
      statementDate: '2026-06-10',
    });
    const f = finding({
      id: 'RB-01:rb1',
      ruleId: 'RB-01',
      title: 'More room days billed than nights stayed',
      why: '4 units billed for a 3-night stay.',
      userText: "You were billed 4 room days for 3 night(s). Hospitals generally don't count the day you go home. Ask them to remove the extra day(s) ($200.00).",
      verify: 'Ask the hospital to recount room days using the discharge-day exclusion.',
      evidenceLineIds: ['rb1'],
      dollarsAtStake: 200,
    });
    const text = renderLetter('L2', { bill: b, ctx: ctx({}), findings: [f] });
    expect(text).toMatch(/Room and board/);
    expect(text).toMatch(/\$200\.00/);
    expect(text).toMatch(/remove the extra day/i);
    expect(text).not.toMatch(/^Ask them to/m); // the request clause should be reworded, not left as a raw "Ask..." sentence
  });

  it('shows a placeholder when no findings were selected', () => {
    const text = renderLetter('L2', { bill: bill([], {}), ctx: ctx({}), findings: [] });
    expect(text).toMatch(/No findings were selected/);
  });
});

describe('renderLetter L4 — No Surprises Act scenario selection', () => {
  const b = bill([], { balanceDue: 500 });

  it('auto-derives the emergency scenario from context', () => {
    const text = renderLetter('L4', { bill: b, ctx: ctx({ emergency: true, eob: { patientResponsibility: 100 } }), findings: [] });
    expect(text).toMatch(/This was emergency care/);
  });

  it('auto-derives the ancillary-clinician scenario from context', () => {
    const text = renderLetter('L4', {
      bill: b,
      ctx: ctx({ oonClinicianTypes: ['Radiology'], eob: { patientResponsibility: 100 } }),
      findings: [],
    });
    expect(text).toMatch(/Radiology services at an in-network facility are protected/);
  });

  it('leaves an honest placeholder when no scenario can be determined', () => {
    const text = renderLetter('L4', { bill: b, ctx: ctx({}), findings: [] });
    expect(text).toMatch(/\[Describe why this care is protected/);
  });

  it('computes amount_over from the balance and EOB patient-responsibility when not overridden', () => {
    const text = renderLetter('L4', { bill: b, ctx: ctx({ emergency: true, eob: { patientResponsibility: 100 } }), findings: [] });
    expect(text).toMatch(/\$400\.00 more than that/);
  });
});

describe('renderLetter L5 — PPDR filed vs. not-yet-filed branch', () => {
  const b = bill([], { totalCharges: 900 });

  it('shows the "I plan to start" branch with a computed 120-day deadline when not yet filed', () => {
    const text = renderLetter('L5', {
      bill: b,
      ctx: ctx({ firstBillDate: '2026-01-01', gfe: [{ provider: 'X', total: 400 }] }),
      findings: [],
    });
    expect(text).toMatch(/I plan to start that dispute by May 1, 2026/);
  });

  it('shows the "I started that dispute" branch once a PPDR filing date is recorded', () => {
    const text = renderLetter('L5', {
      bill: b,
      ctx: ctx({ firstBillDate: '2026-01-01', ppdrFiledDate: '2026-03-01', gfe: [{ provider: 'X', total: 400 }] }),
      findings: [],
    });
    expect(text).toMatch(/I started that dispute on March 1, 2026/);
  });
});
