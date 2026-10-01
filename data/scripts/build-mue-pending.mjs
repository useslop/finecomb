#!/usr/bin/env node
// Shapes the CMS NCCI Medically Unlikely Edit (MUE) tables (practitioner + outpatient
// hospital, effective 2026-10-01 / Q4 2026) into the compact, sharded form they would
// ship in. These tables are KEYED BY CPT/HCPCS CODE and the source files open with an
// explicit AMA CPT copyright notice ("CPT codes, descriptions and other data only are
// copyright 2025 American Medical Association. All rights reserved."), so per lane
// rules this output goes to data/_pending-license/, never data/out/, until a human
// (A1) confirms what may ship. Only code + numeric MUE value + adjudication indicator
// are kept; no AMA descriptor text is copied in (the "MUE Rationale" column here is
// CMS's own short policy-category label, e.g. "Date of Service Edit: Policy", not a
// CPT code descriptor, but it's kept out anyway to stay conservative).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseCsv } from './lib/csv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EFFECTIVE_DATE = '2026-10-01'; // Q4 2026, per CMS filename "Eff_10-01-2026"

const SETS = [
  {
    key: 'practitioner',
    raw: `${__dirname}/../tmp/mue_pra/MCR_MUE_PractitionerServices_Eff_10-01-2026.csv`,
    outDir: `${__dirname}/../_pending-license/mue-practitioner`,
  },
  {
    key: 'outpatient-hospital',
    raw: `${__dirname}/../tmp/mue_oph/MCR_MUE_OutpatientHospitalServices_Eff_10-01-2026.csv`,
    outDir: `${__dirname}/../_pending-license/mue-outpatient-hospital`,
  },
];

const sha = (s) => createHash('sha256').update(s).digest('hex');

for (const { key, raw, outDir } of SETS) {
  const text = readFileSync(raw, 'latin1');
  const rows = parseCsv(text);
  // Row 0 is an AMA copyright notice cell, row 1 is the real header, row 2+ is data.
  const dataRows = rows.slice(2).filter((r) => r.length >= 3 && r[0].trim() !== '');

  const records = dataRows.map((r) => {
    const [code, mueValueRaw, adjudicationRaw] = r;
    const m = /^(\d+)\s*(.*)$/s.exec((adjudicationRaw || '').trim());
    return {
      code: code.trim(),
      mueValue: Number(mueValueRaw) || null,
      adjudicationIndicator: m ? m[1] : '',
      adjudicationLabel: m ? m[2].trim() : (adjudicationRaw || '').trim(),
      effectiveDate: EFFECTIVE_DATE,
    };
  });

  // Shard by the code's first character (digits 0-9, letters A-Z), mirroring the
  // prefix-shard scheme used for NADAC/HCPCS.
  const shards = new Map();
  for (const rec of records) {
    const prefix = rec.code[0] || '_';
    if (!shards.has(prefix)) shards.set(prefix, []);
    shards.get(prefix).push(rec);
  }

  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.json')) rmSync(`${outDir}/${f}`);
  }

  const manifest = {
    dataset: `NCCI MUE — ${key}`,
    effectiveDate: EFFECTIVE_DATE,
    status: 'PENDING_LICENSE_REVIEW',
    license:
      'Source file leads with: "Current Procedural Terminology (CPT) codes, descriptions and other data only are copyright 2025 American Medical Association. All rights reserved. ... Applicable FARS/DFARS Restrictions Apply to Government Use." Do not ship without A1/legal sign-off on which fields (if any) are AMA-encumbered vs. CMS public-domain MUE values.',
    recordCount: records.length,
    shardCount: shards.size,
    shards: {},
  };
  let totalBytes = 0;
  for (const [prefix, recs] of shards) {
    const json = JSON.stringify(recs);
    writeFileSync(`${outDir}/${prefix}.json`, json);
    manifest.shards[prefix] = { count: recs.length, bytes: json.length, sha256: sha(json) };
    totalBytes += json.length;
  }
  const manifestJson = JSON.stringify(manifest, null, 2);
  writeFileSync(`${outDir}/manifest.json`, manifestJson);
  console.log(`${key}: ${dataRows.length} rows -> ${records.length} records, ${shards.size} shards, ${totalBytes} bytes (+ manifest ${manifestJson.length} bytes, sha256 ${sha(manifestJson)})`);
}
