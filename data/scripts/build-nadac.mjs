#!/usr/bin/env node
// Normalizes the NADAC (National Average Drug Acquisition Cost) CSV into per-NDC
// latest-price records, sharded by the first 5 digits of the NDC (the labeler code)
// so the browser only loads the shard(s) covering the NDCs on a given bill.
//
// The source download is the live "NADAC (National Average Drug Acquisition Cost)
// 2026" file from data.medicaid.gov, which carries the full year-to-date weekly
// history (one row per NDC per price change, ~1.1M rows for 2026 so far). A medical
// bill only needs the CURRENT price per NDC, so this script keeps only the row with
// the latest Effective Date for each NDC ("latest weekly file" per the brief).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { csvToObjects } from './lib/csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = `${__dirname}/../tmp/nadac_raw.csv`;
const OUT_DIR = `${__dirname}/../out/nadac`;

const raw = readFileSync(RAW, 'utf8');
const rows = csvToObjects(raw);

function parseDate(s) {
  // MM/DD/YYYY -> comparable number
  const [m, d, y] = s.split('/').map(Number);
  if (!m || !d || !y) return 0;
  return y * 10000 + m * 100 + d;
}

// Keep only the latest Effective Date per NDC.
const latest = new Map();
for (const r of rows) {
  const ndc = r['NDC'];
  if (!ndc) continue;
  const eff = parseDate(r['Effective Date']);
  const prev = latest.get(ndc);
  if (!prev || eff > prev._eff) {
    latest.set(ndc, {
      ndc,
      description: r['NDC Description'],
      pricePerUnit: Number(r['NADAC Per Unit']) || null,
      unit: r['Pricing Unit'],
      effectiveDate: r['Effective Date'],
      pharmacyTypeIndicator: r['Pharmacy Type Indicator'],
      otc: r['OTC'] === 'Y',
      classificationForRateSetting: r['Classification for Rate Setting'],
      _eff: eff,
    });
  }
}

// Shard by first 5 digits of NDC (FDA labeler code).
const shards = new Map();
for (const rec of latest.values()) {
  delete rec._eff;
  const prefix = rec.ndc.slice(0, 5);
  if (!shards.has(prefix)) shards.set(prefix, []);
  shards.get(prefix).push(rec);
}

mkdirSync(OUT_DIR, { recursive: true });
// Clear any stale shards from a prior run before writing the new set.
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith('.json')) rmSync(`${OUT_DIR}/${f}`);
}

const sha = (s) => createHash('sha256').update(s).digest('hex');
const manifest = { prefixLength: 5, shardCount: shards.size, ndcCount: latest.size, shards: {} };
let totalBytes = 0;
for (const [prefix, recs] of shards) {
  const json = JSON.stringify(recs);
  writeFileSync(`${OUT_DIR}/${prefix}.json`, json);
  manifest.shards[prefix] = { count: recs.length, bytes: json.length, sha256: sha(json) };
  totalBytes += json.length;
}
const manifestJson = JSON.stringify(manifest, null, 2);
writeFileSync(`${OUT_DIR}/manifest.json`, manifestJson);

console.log(`nadac: ${rows.length} source rows -> ${latest.size} unique NDCs -> ${shards.size} shards`);
console.log(`Wrote ${OUT_DIR}/*.json (${totalBytes} bytes total) + manifest.json (${manifestJson.length} bytes, sha256 ${sha(manifestJson)})`);
