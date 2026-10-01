import type { Datasets, ISODate, StateCharityDoc } from '../types/engine';

// Loads every reference dataset the app needs, up front, in one fixed Promise.all() call —
// never a per-code or per-NDC fetch — so network traffic is identical regardless of bill
// content (docs/SPEC.md §5). Files are copied into public/data/ by scripts/copy-data.mjs.

export interface FplRegion {
  label: string;
  base: number;
  increment: number;
  note: string;
  bySize: Record<string, number>;
}
export interface FplDoc {
  year: number;
  source: Record<string, unknown>;
  guidelines: Record<'48states_dc' | 'alaska' | 'hawaii', FplRegion>;
}
export interface HospitalRecord {
  ccn: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  phone: string;
  type: string;
  ownership: string;
  ownershipCategory: 'nonprofit' | 'government' | 'proprietary' | 'unknown';
  emergencyServices: boolean;
}
export interface HospitalIndexEntry {
  ccn: string;
  name: string;
  city: string;
  state: string;
  zip: string;
}
export interface Hcpcs2Entry {
  code: string;
  shortDescription: string;
  active: boolean;
  actionCode: string;
}
interface NadacShardRecord {
  ndc: string;
  description: string;
  pricePerUnit: number | null;
  unit: string;
  effectiveDate: string; // MM/DD/YYYY
  pharmacyTypeIndicator: string;
  otc: boolean;
  classificationForRateSetting: string;
}

export interface AppData {
  fpl: FplDoc | null;
  hospitals: HospitalRecord[];
  hospitalIndex: HospitalIndexEntry[];
  hcpcs2: Hcpcs2Entry[];
  stateCharity: StateCharityDoc | null;
  datasets: Datasets;
}

const DATA_FILES = [
  'fpl-2026.json',
  'hospitals.json',
  'hospitals-search-index.json',
  'hcpcs2.json',
  'nadac-all.json',
  'state-charity.json',
] as const;

async function fetchJson<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(`/data/${file}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function toIsoDate(mdY: string): ISODate {
  const [m, d, y] = mdY.split('/');
  if (!m || !d || !y) return mdY;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export async function loadAppData(): Promise<AppData> {
  // Fixed order, all requested in the same tick — see module doc comment above.
  const [fpl, hospitals, hospitalIndex, hcpcs2, nadac, stateCharity] = await Promise.all([
    fetchJson<FplDoc>(DATA_FILES[0]),
    fetchJson<HospitalRecord[]>(DATA_FILES[1]),
    fetchJson<HospitalIndexEntry[]>(DATA_FILES[2]),
    fetchJson<Hcpcs2Entry[]>(DATA_FILES[3]),
    fetchJson<NadacShardRecord[]>(DATA_FILES[4]),
    fetchJson<StateCharityDoc>(DATA_FILES[5]),
  ]);

  const hospitalsByCcn = new Map<string, HospitalRecord>();
  for (const h of hospitals ?? []) hospitalsByCcn.set(h.ccn, h);

  const nadacByNdc = new Map<string, NadacShardRecord>();
  for (const r of nadac ?? []) nadacByNdc.set(r.ndc, r);

  const datasets: Datasets = {
    nadac: (ndc11) => {
      const r = nadacByNdc.get(ndc11);
      if (!r || r.pricePerUnit === null) return undefined;
      return { unitPrice: r.pricePerUnit, unit: r.unit, effective: toIsoDate(r.effectiveDate) };
    },
    hospital: (ccn) => {
      const h = hospitalsByCcn.get(ccn);
      if (!h) return undefined;
      return {
        name: h.name,
        state: h.state,
        ownership: h.ownership,
        ownershipCategory: h.ownershipCategory === 'unknown' ? 'other' : h.ownershipCategory,
      };
    },
    // mue / ncciPtp: not shipped yet — that data is quarantined in data/_pending-license
    // (unclear licensing). Rules that need them report "skipped" honestly.
  };

  return {
    fpl,
    hospitals: hospitals ?? [],
    hospitalIndex: hospitalIndex ?? [],
    hcpcs2: hcpcs2 ?? [],
    stateCharity,
    datasets,
  };
}
