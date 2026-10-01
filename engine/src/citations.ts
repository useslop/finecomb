// Only the sources our rules actually cite. URLs and fetch dates are copied verbatim from
// docs/RESEARCH.md §S (source register, fetched 2026-10-01). Anything marked UNVERIFIED there
// is excluded from v1 rules entirely (v1 only cites verified sources).
import type { Citation } from './types.js';

export const CITATIONS = {
  S3: {
    id: 'S3',
    title: 'CMS: Dispute a medical bill (patient-provider dispute resolution)',
    url: 'https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/get-help/dispute-bill',
    verified: '2026-10-01',
  },
  S4: {
    id: 'S4',
    title: '45 CFR 149.620 — patient-provider dispute resolution',
    url: 'https://www.ecfr.gov/current/title-45/section-149.620',
    verified: '2026-10-01',
  },
  S5: {
    id: 'S5',
    title: '45 CFR 149.610 — Good Faith Estimate timing',
    url: 'https://www.ecfr.gov/current/title-45/section-149.610',
    verified: '2026-10-01',
  },
  S6: {
    id: 'S6',
    title: '45 CFR 149.410 — No Surprises Act, emergency services',
    url: 'https://www.ecfr.gov/current/title-45/section-149.410',
    verified: '2026-10-01',
  },
  S7: {
    id: 'S7',
    title: '45 CFR 149.420 — No Surprises Act, non-emergency care at in-network facilities',
    url: 'https://www.ecfr.gov/current/title-45/section-149.420',
    verified: '2026-10-01',
  },
  S8: {
    id: 'S8',
    title: 'CMS: Know your rights — insurance (No Surprises Act)',
    url: 'https://www.cms.gov/initiatives/your-patient-rights/medical-bill-rights/know-your-medical-bill-rights/know-your-rights-insurance',
    verified: '2026-10-01',
  },
  S9: {
    id: 'S9',
    title: 'IRS: Requirements for 501(c)(3) hospitals (§501(r))',
    url: 'https://www.irs.gov/charities-non-profits/charitable-organizations/requirements-for-501c3-hospitals-under-the-affordable-care-act-section-501r',
    verified: '2026-10-01',
  },
  S10: {
    id: 'S10',
    title: 'IRS: Financial Assistance Policy and emergency care policy, §501(r)(4)',
    url: 'https://www.irs.gov/charities-non-profits/financial-assistance-policy-and-emergency-medical-care-policy-section-501r4',
    verified: '2026-10-01',
  },
  S11: {
    id: 'S11',
    title: 'IRS: Limitation on charges, §501(r)(5)',
    url: 'https://www.irs.gov/charities-non-profits/limitation-on-charges-section-501r5',
    verified: '2026-10-01',
  },
  S12: {
    id: 'S12',
    title: 'IRS: Billing and collections, §501(r)(6)',
    url: 'https://www.irs.gov/charities-non-profits/billing-and-collections-section-501r6',
    verified: '2026-10-01',
  },
  S13: {
    id: 'S13',
    title: '26 CFR 1.501(r)-1 — definitions, incl. the FAP application period',
    url: 'https://www.ecfr.gov/current/title-26/section-1.501(r)-1',
    verified: '2026-10-01',
  },
  S14: {
    id: 'S14',
    title: '26 CFR 1.501(r)-6 — billing and collections',
    url: 'https://www.ecfr.gov/current/title-26/section-1.501(r)-6',
    verified: '2026-10-01',
  },
  S15: {
    id: 'S15',
    title: '45 CFR 164.501 — HIPAA designated record set',
    url: 'https://www.ecfr.gov/current/title-45/section-164.501',
    verified: '2026-10-01',
  },
  S16: {
    id: 'S16',
    title: '45 CFR 164.524 — HIPAA right of access',
    url: 'https://www.ecfr.gov/current/title-45/section-164.524',
    verified: '2026-10-01',
  },
  S19: {
    id: 'S19',
    title: 'CMS: Medicare NCCI procedure-to-procedure (PTP) edits',
    url: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-procedure-procedure-ptp-edits',
    verified: '2026-10-01',
  },
  S20: {
    id: 'S20',
    title: 'CMS: Medicare NCCI Medically Unlikely Edits (MUEs)',
    url: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-medically-unlikely-edits',
    verified: '2026-10-01',
  },
  S17: {
    id: 'S17',
    title: 'CMS: Hospital Price Transparency',
    url: 'https://www.cms.gov/priorities/key-initiatives/hospital-price-transparency',
    verified: '2026-10-01',
  },
  S18: {
    id: 'S18',
    title: '45 CFR 180.50 — machine-readable file contents',
    url: 'https://www.ecfr.gov/current/title-45/section-180.50',
    verified: '2026-10-01',
  },
  S26: {
    id: 'S26',
    title: 'data.medicaid.gov: NADAC (National Average Drug Acquisition Cost) 2026',
    url: 'https://data.medicaid.gov/dataset/fbb83258-11c7-47f5-8b18-5f8e79f7e704',
    verified: '2026-10-01',
  },
  S27: {
    id: 'S27',
    title: 'data.cms.gov: Hospital General Information (ownership type)',
    url: 'https://data.cms.gov/provider-data/dataset/xubh-q36u',
    verified: '2026-10-01',
  },
  S28: {
    id: 'S28',
    title: 'Noridian (Medicare contractor): Counting Inpatient Days',
    url: 'https://med.noridianmedicare.com/web/jfa/topics/claim-submission/counting-inpatient-days',
    verified: '2026-10-01',
  },
  S29: {
    id: 'S29',
    title: '42 CFR 447.15 — Medicaid payment in full',
    url: 'https://www.ecfr.gov/current/title-42/section-447.15',
    verified: '2026-10-01',
  },
  S30: {
    id: 'S30',
    title: 'CMS: Consumer Assistance Program grants (state CAP map)',
    url: 'https://www.cms.gov/cciio/resources/consumer-assistance-grants',
    verified: '2026-10-01',
  },
  S31: {
    id: 'S31',
    title: 'HealthCare.gov: coverage screener and special enrollment periods',
    url: 'https://www.healthcare.gov/screener/',
    verified: '2026-10-01',
  },
  S32: {
    id: 'S32',
    title: 'Dollar For (free help applying for hospital financial assistance)',
    url: 'https://dollarfor.org',
    verified: '2026-10-01',
  },
  S33: {
    id: 'S33',
    title: 'HealthWell Foundation (insured copay/premium assistance)',
    url: 'https://www.healthwellfoundation.org',
    verified: '2026-10-01',
  },
  S34: {
    id: 'S34',
    title: '211 (local assistance referrals)',
    url: 'https://www.211.org',
    verified: '2026-10-01',
  },
  S35: {
    id: 'S35',
    title: 'CFPB complaint portal (debt collectors, credit reports)',
    url: 'https://www.consumerfinance.gov/complaint/',
    verified: '2026-10-01',
  },
  S36: {
    id: 'S36',
    title: 'Undue Medical Debt (buys and abolishes medical debt; no direct application)',
    url: 'https://unduemedicaldebt.org',
    verified: 'unverified',
  },
  S37: {
    id: 'S37',
    title: 'PAN Foundation (insured copay assistance by disease fund)',
    url: 'https://www.panfoundation.org',
    verified: 'unverified',
  },
  S38: {
    id: 'S38',
    title: 'Patient Advocate Foundation (case management and co-pay relief)',
    url: 'https://www.patientadvocate.org',
    verified: 'unverified',
  },
  S41: {
    id: 'S41',
    title: 'Florida Statutes §395.301 — itemized statement requirements',
    url: 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0300-0399/0395/Sections/0395.301.html',
    verified: '2026-10-01',
  },
  CRB2023: {
    id: 'CRB2023',
    title: 'Equifax, Experian and TransUnion: joint release on medical collections credit reporting',
    url: 'https://investor.equifax.com/news-events/press-releases/detail/1286/equifax-experian-and-transunion-remove-medical-collections',
    verified: '2026-10-01',
  },
  CFPBVACATED2025: {
    id: 'CFPBVACATED2025',
    title: 'CFPB: medical-debt credit-reporting rule (Regulation V) — vacated 2025-07-11',
    url: 'https://www.consumerfinance.gov/rules-policy/final-rules/prohibition-on-creditors-and-consumer-reporting-agencies-concerning-medical-information-regulation-v/',
    verified: '2026-10-01',
  },
  CFPBPREEMPT2025: {
    id: 'CFPBPREEMPT2025',
    title: 'CFPB interpretive rule: FCRA preemption of state credit-reporting laws (90 FR 48710)',
    url: 'https://www.federalregister.gov/documents/2025/10/28/2025-19671/fair-credit-reporting-act-preemption-of-state-laws',
    verified: '2026-10-01',
  },
  NCLCMEDDEBT: {
    id: 'NCLCMEDDEBT',
    title: 'National Consumer Law Center: state medical-debt credit-reporting bans (table of ~16 states + DC)',
    url: 'https://library.nclc.org/article/latest-keeping-medical-debt-out-credit-reports',
    verified: '2026-10-01',
  },
  PL11921: {
    id: 'PL11921',
    title: 'P.L. 119-21 (H.R. 1, 2025) — Medicaid retroactive-coverage and Marketplace changes',
    url: 'https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm',
    verified: '2026-10-01',
  },
  CMSCIB2025: {
    id: 'CMSCIB2025',
    title: 'CMS Informational Bulletin (2025-11-18): Medicaid/CHIP provisions of P.L. 119-21',
    url: 'https://www.medicaid.gov/federal-policy-guidance/downloads/cib11182025.pdf',
    verified: '2026-10-01',
  },
} as const satisfies Record<string, Citation>;

export type CitationKey = keyof typeof CITATIONS;
export function cite(...keys: CitationKey[]): Citation[] {
  return keys.map((k) => CITATIONS[k]);
}
