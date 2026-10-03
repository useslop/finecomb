import type { Bill, Confidence, Context, Datasets, ISODate } from '@finecomb/engine';

export type Kind = 'inpatient' | 'ed' | 'professional';

/** Ground truth: one expected finding. Empty lineIds = a bill-level finding (matched on rule alone).
 * `optional` (hand-made set only): acceptable but not required, never a miss; with `maxConfidence`, a matching
 * finding above that confidence counts as a false positive. `textIncludes`: the finding's title or text must name it
 * (e.g. the provider a GFE-01 finding is about). */
export interface Label { ruleId: string; lineIds: string[]; optional?: boolean; maxConfidence?: Confidence; textIncludes?: string }

export interface MueEntry { mue: number; mai: 1 | 2 | 3 }

/** The slice of reference data a bill needs, so each corpus file is self-contained. All values are synthetic. */
export interface FixtureData {
  mue: Record<string, { practitioner?: MueEntry; outpatient?: MueEntry }>;
  ncciPtp: { col1: string; col2: string; mi: 0 | 1 | 9; effective: ISODate; deleted?: ISODate }[];
  nadac: Record<string, { unitPrice: number; unit: string; effective: ISODate }>;
  hospital: Record<string, { name: string; state: string; ownership: string; ownershipCategory: 'nonprofit' | 'government' | 'proprietary' | 'other' }>;
}

export interface CorpusItem {
  id: string;
  kind: Kind;
  sub: string;          // bill shape within the kind (stay, ed, obs, sched, office, proc, ancillary, air)
  seed: number;
  clean: boolean;       // no labels at all
  bill: Bill;
  ctx: Context;
  data: FixtureData;
  labels: Label[];
  plants: string[];     // rule IDs the generator planted on purpose
  tags: string[];       // plant variants (`plant:RULE:variant`) and hard negatives (`hn:name`)
}

export function toDatasets(d: FixtureData): Datasets {
  return {
    mue: (code, setting) => d.mue[code]?.[setting],
    ncciPtp: (col1, col2, date) => {
      const e = d.ncciPtp.find((p) => p.col1 === col1 && p.col2 === col2 && p.effective <= date && (!p.deleted || date < p.deleted));
      return e ? { modifierIndicator: e.mi } : undefined;
    },
    nadac: (ndc) => d.nadac[ndc],
    hospital: (ccn) => d.hospital[ccn],
  };
}
