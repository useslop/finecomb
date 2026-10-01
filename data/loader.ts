// Typed client-side loader for the public data shards under data/out/.
// Fetches a shard once, caches it in memory, and never sends bill content anywhere —
// these are one-way reads of static public-domain reference data.

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

export interface Hospital {
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

export interface NadacRecord {
  ndc: string;
  description: string;
  pricePerUnit: number | null;
  unit: string;
  effectiveDate: string;
  pharmacyTypeIndicator: string;
  otc: boolean;
  classificationForRateSetting: string;
}

export type Fetcher = (url: string) => Promise<unknown>;

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return res.json();
};

/** Loads and caches shards of the public data pipeline. One instance per base URL. */
export class DataLoader {
  #baseUrl: string;
  #fetch: Fetcher;
  #cache = new Map<string, unknown>();
  #inflight = new Map<string, Promise<unknown>>();

  constructor(baseUrl: string, fetcher: Fetcher = defaultFetcher) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
    this.#fetch = fetcher;
  }

  async #load<T>(path: string): Promise<T> {
    if (this.#cache.has(path)) return this.#cache.get(path) as T;
    let pending = this.#inflight.get(path) as Promise<T> | undefined;
    if (!pending) {
      pending = this.#fetch(`${this.#baseUrl}/${path}`) as Promise<T>;
      this.#inflight.set(path, pending);
    }
    const data = await pending;
    this.#cache.set(path, data);
    this.#inflight.delete(path);
    return data;
  }

  loadFpl(): Promise<FplDoc> {
    return this.#load<FplDoc>('fpl-2026.json');
  }

  loadHospitalIndex(): Promise<HospitalIndexEntry[]> {
    return this.#load<HospitalIndexEntry[]>('hospitals-search-index.json');
  }

  loadHospitals(): Promise<Hospital[]> {
    return this.#load<Hospital[]>('hospitals.json');
  }

  /** NDCs shard by their first 5 digits (FDA labeler code); see data/out/nadac/manifest.json. */
  ndcShardPrefix(ndc: string): string {
    return ndc.slice(0, 5);
  }

  async loadNadacForNdc(ndc: string): Promise<NadacRecord | undefined> {
    const prefix = this.ndcShardPrefix(ndc);
    const shard = await this.#load<NadacRecord[]>(`nadac/${prefix}.json`);
    return shard.find((r) => r.ndc === ndc);
  }

  clearCache(): void {
    this.#cache.clear();
  }
}
