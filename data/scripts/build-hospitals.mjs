#!/usr/bin/env node
// Normalizes the CMS "Hospital General Information" CSV into compact JSON plus a
// small search index. Source CSV must already be downloaded (see SOURCES.md for the
// fetch command); this script only transforms, to keep network fetches auditable
// and separate from parsing.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { csvToObjects } from './lib/csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = `${__dirname}/../tmp/hospitals_raw.csv`;
const OUT = `${__dirname}/../out/hospitals.json`;
const OUT_INDEX = `${__dirname}/../out/hospitals-search-index.json`;

const raw = readFileSync(RAW, 'utf8');
const rows = csvToObjects(raw);

// CMS's raw ownership strings (e.g. "Voluntary non-profit - Private", "Government -
// Hospital District or Authority", "Proprietary") collapsed into the 3 buckets that
// matter for deciding whether IRC §501(r) charity-care obligations apply (non-profit
// only) vs. public hospital charity-care/state law vs. for-profit (no §501(r)).
function ownershipCategory(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('non-profit') || s.includes('nonprofit')) return 'nonprofit';
  if (s.includes('government')) return 'government';
  if (s.includes('proprietary') || s.includes('physician')) return 'proprietary';
  return 'unknown';
}

const hospitals = rows.map((r) => ({
  ccn: r['Facility ID'],
  name: r['Facility Name'],
  address: r['Address'],
  city: r['City/Town'],
  state: r['State'],
  zip: r['ZIP Code'],
  county: r['County/Parish'],
  phone: r['Telephone Number'],
  type: r['Hospital Type'],
  ownership: r['Hospital Ownership'],
  ownershipCategory: ownershipCategory(r['Hospital Ownership']),
  emergencyServices: r['Emergency Services'] === 'Yes',
}));

// Small search index: lowercase name/city/state/zip tokens -> ccn, for client-side
// typeahead without loading the full 1.x MB file.
const index = hospitals.map((h) => ({
  ccn: h.ccn,
  name: h.name,
  city: h.city,
  state: h.state,
  zip: h.zip,
}));

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(hospitals);
const indexJson = JSON.stringify(index);
writeFileSync(OUT, json);
writeFileSync(OUT_INDEX, indexJson);

const sha = (s) => createHash('sha256').update(s).digest('hex');
console.log(`hospitals: ${hospitals.length} rows`);
console.log(`Wrote ${OUT} (${json.length} bytes, sha256 ${sha(json)})`);
console.log(`Wrote ${OUT_INDEX} (${indexJson.length} bytes, sha256 ${sha(indexJson)})`);
