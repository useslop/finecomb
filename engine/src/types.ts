export type Money = number;            // dollars, 2 dp; negative = credit
export type ISODate = string;          // yyyy-mm-dd

export interface LineSource { page?: number; bbox?: [number, number, number, number]; confidence?: number; raw?: string }
export interface BillLine {
  id: string;                          // stable within a bill
  date?: ISODate;
  code?: string;                       // as printed (HCPCS Level II, or a CPT-shaped number); never a descriptor we supply
  modifiers?: string[];
  revCode?: string;                    // 4 digits as printed
  ndc?: string;                        // normalized to 11 digits
  description: string;                 // as printed on the bill
  qty?: number;
  unitPrice?: Money;
  amount: Money;
  provider?: string;                   // for multi-provider bills / per-provider GFE
  notReceived?: boolean;               // user toggle "I didn't get this"
  source?: LineSource;
}
export interface BillHeader {
  patientName?: string; providerName?: string; accountNumber?: string;
  admitDate?: ISODate; dischargeDate?: ISODate; statementDate?: ISODate;
  totalCharges?: Money; payments?: Money; adjustments?: Money; balanceDue?: Money;
}
export interface Bill { header: BillHeader; lines: BillLine[]; confirmed: boolean }  // rules refuse to run when confirmed=false

export type GroupCode = 'CO' | 'PR' | 'OA' | 'PI' | 'CR';
export interface Eob {
  billed?: Money; allowed?: Money; planPaid?: Money; deductible?: Money; copay?: Money; coinsurance?: Money;
  nonCovered?: Money; patientResponsibility?: Money;
  adjustments?: { group: GroupCode; reason?: string; amount: Money; lineId?: string }[];
}
export type Insurance = 'none' | 'commercial' | 'marketplace' | 'medicare' | 'medicaid' | 'other';
export interface CollectionEvent { date: ISODate; kind: 'collections' | 'credit_report' | 'lawsuit' | 'wage_garnishment' | 'late_fee' | 'other'; noticeDate?: ISODate }
export interface Context {
  today: ISODate;                      // injected for deterministic date math
  insurance?: Insurance; insurerName?: string; secondary?: boolean;
  admitted?: boolean; observation?: boolean; emergency?: boolean; airAmbulance?: boolean;
  facilityInNetwork?: boolean; oonClinicianTypes?: string[];
  scheduledAhead?: boolean; gfe?: { provider: string; total: Money }[];
  eob?: Eob;
  firstBillDate?: ISODate; firstPostDischargeStatementDate?: ISODate;
  collections?: CollectionEvent[];
  ppdrFiledDate?: ISODate; fapApplied?: boolean; fapAppliedDate?: ISODate;
  onCreditReport?: boolean; paidInFull?: boolean; originalBalance?: Money;
  state?: string;                      // 2-letter
  stateResident?: boolean;             // the user says they live in `state` (screener residency condition)
  hospitalCcn?: string;
  householdSize?: number; annualIncome?: Money;
}
export interface Citation { id: string; title: string; url: string; verified: ISODate | 'unverified' }
export type Confidence = 'high' | 'medium' | 'low' | 'info';
export interface Finding {
  id: string; ruleId: string; title: string; why: string; userText: string; verify: string;
  evidenceLineIds: string[]; confidence: Confidence; dollarsAtStake: Money | null; citations: Citation[];
}
export interface Skipped { ruleId: string; needs: string[] }
export interface Datasets {               // all synchronous lookups over data loaded up front (privacy: no per-code fetch)
  nadac?: (ndc11: string) => { unitPrice: number; unit: string; effective: ISODate } | undefined;
  mue?: (code: string, setting: 'practitioner' | 'outpatient') => { mue: number; mai: 1 | 2 | 3 } | undefined;
  ncciPtp?: (col1: string, col2: string, date: ISODate) => { modifierIndicator: 0 | 1 | 9 } | undefined;
  hospital?: (ccn: string) => { name: string; state: string; ownership: string; ownershipCategory: 'nonprofit' | 'government' | 'proprietary' | 'other' } | undefined;
}
export interface AnalyzeResult { findings: Finding[]; skipped: Skipped[]; infoCards: Finding[] }
export declare function analyze(bill: Bill, ctx: Context, data: Datasets): AnalyzeResult;
