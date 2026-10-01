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
  S12: {
    id: 'S12',
    title: 'IRS: Billing and collections, §501(r)(6)',
    url: 'https://www.irs.gov/charities-non-profits/billing-and-collections-section-501r6',
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
  S26: {
    id: 'S26',
    title: 'data.medicaid.gov: NADAC (National Average Drug Acquisition Cost) 2026',
    url: 'https://data.medicaid.gov/dataset/fbb83258-11c7-47f5-8b18-5f8e79f7e704',
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
} as const satisfies Record<string, Citation>;

export type CitationKey = keyof typeof CITATIONS;
export function cite(...keys: CitationKey[]): Citation[] {
  return keys.map((k) => CITATIONS[k]);
}
