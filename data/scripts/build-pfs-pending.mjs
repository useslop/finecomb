#!/usr/bin/env node
// Shapes the CMS CY2026 Physician Fee Schedule Relative Value file (October release,
// RVU26D) into code + RVU components, CODE NUMBERS AND AMOUNTS ONLY — the source
// "DESCRIPTION" column (AMA CPT short descriptors) is dropped entirely, never copied.
//
// IMPORTANT: this is RVUs, not yet dollarized "national payment amounts." Medicare's
// national payment = (work RVU * work GPCI + PE RVU * PE GPCI + MP RVU * MP GPCI) *
// conversion factor; this script does not apply a conversion factor because a
// primary-sourced CY2026 conversion factor was not confirmed within this lane's time
// budget (see data/_pending-license/pfs/manifest.json "openIssue"). A1/next lane
// should source the CY2026 CF from the CY 2026 PFS final rule (90 FR, Nov 5, 2025,
// and its March 12, 2026 correction, document 2026-04797) before computing dollar
// amounts. Goes to _pending-license/ regardless: these are CPT-code-keyed records and
// the source file opens with an AMA CPT copyright notice.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseCsv } from './lib/csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = `${__dirname}/../tmp/pfs_rvu26d/PPRRVU2026_Oct_QPP.csv`;
const OUT_DIR = `${__dirname}/../_pending-license/pfs`;

const text = readFileSync(RAW, 'latin1');
const rows = parseCsv(text);
// Header is row index 9 (0-based) per inspection; data starts row 10. Columns:
// HCPCS, MOD, DESCRIPTION(drop), STATUS CODE, [unused], WORK RVU, NONFAC PE RVU,
// NONFAC NA IND, FACILITY PE RVU, FACILITY NA IND, MP RVU, NONFAC TOTAL, FAC TOTAL, PCTC IND
const dataRows = rows.slice(10).filter((r) => r.length >= 13 && r[0].trim() !== '');

const num = (s) => (s === '' || s === undefined ? null : Number(s));

const records = dataRows.map((r) => ({
  code: r[0].trim(),
  modifier: r[1].trim() || null,
  statusCode: r[3].trim(),
  workRvu: num(r[5]),
  nonFacilityPeRvu: num(r[6]),
  facilityPeRvu: num(r[8]),
  mpRvu: num(r[10]),
  nonFacilityTotalRvu: num(r[11]),
  facilityTotalRvu: num(r[12]),
  pctcIndicator: r[13]?.trim() || null,
}));

const shards = new Map();
for (const rec of records) {
  const prefix = rec.code[0] || '_';
  if (!shards.has(prefix)) shards.set(prefix, []);
  shards.get(prefix).push(rec);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith('.json')) rmSync(`${OUT_DIR}/${f}`);
}

const sha = (s) => createHash('sha256').update(s).digest('hex');
const manifest = {
  dataset: 'CMS PFS Relative Value File, CY2026 October release (RVU26D)',
  sourceReleaseDate: '2026-08-26',
  effectiveDate: '2026-10-01',
  status: 'PENDING_LICENSE_REVIEW',
  license:
    'Source file header: "CPT codes and descriptions only are copyright 2026 American Medical Association. All Rights Reserved. Applicable FARS/DFARS Apply." Code numbers + RVUs retained; AMA descriptor text ("DESCRIPTION" column) was dropped entirely during normalization, never written to disk.',
  openIssue:
    'Values here are RVUs, not dollar amounts. National payment = RVUs * CY2026 conversion factor (not yet sourced from a primary document within this lane\'s time budget). See CY 2026 PFS final rule (90 FR, 2025-11-05) and its correction (document 2026-04797, 2026-03-12, https://www.federalregister.gov/documents/2026/03/12/2026-04797/).',
  recordCount: records.length,
  shardCount: shards.size,
  shards: {},
};
let totalBytes = 0;
for (const [prefix, recs] of shards) {
  const json = JSON.stringify(recs);
  writeFileSync(`${OUT_DIR}/${prefix}.json`, json);
  manifest.shards[prefix] = { count: recs.length, bytes: json.length, sha256: sha(json) };
  totalBytes += json.length;
}
const manifestJson = JSON.stringify(manifest, null, 2);
writeFileSync(`${OUT_DIR}/manifest.json`, manifestJson);
console.log(`pfs: ${dataRows.length} rows -> ${records.length} records, ${shards.size} shards, ${totalBytes} bytes (+ manifest, sha256 ${sha(manifestJson)})`);
