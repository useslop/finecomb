#!/usr/bin/env node
// Normalizes the CMS fixed-width HCPCS "Contractor Record" file into HCPCS LEVEL II
// ONLY (public domain) codes + short descriptions. The source file is the combined
// HCPCS file and also contains Level I (CPT, AMA-copyrighted, 5 numeric digits) rows,
// which are deliberately dropped here per the brief: "Exclude CPT/Level I."
//
// Field positions are from the CMS-supplied HCPC2026_recordlayout.txt (RIF report,
// "HCPCS Contractor Record - 2026"): code cols 1-5, long description cols 12-91,
// short description cols 92-119, action-effective-date cols 277-284, termination
// date cols 285-292, action code col 293.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = `${__dirname}/../tmp/hcpcs_oct2026/HCPC2026_OCT_ANWEB_09232026.txt`;
const OUT = `${__dirname}/../out/hcpcs2.json`;

const text = readFileSync(RAW, 'latin1');
const lines = text.split(/\r\n|\n/).filter((l) => l.length >= 119);

const isLevelII = (code) => /^[A-Z]/.test(code);

const seen = new Map();
for (const line of lines) {
  const code = line.slice(0, 5).trim();
  if (!isLevelII(code)) continue; // drop CPT/Level I (5 numeric digits)
  const shortDescription = line.slice(91, 119).trim();
  const terminationDate = line.slice(284, 292).trim(); // YYYYMMDD or blank
  const actionCode = line.slice(292, 293).trim();
  // The source has one row per (code, modifier, sequence); keep the first row seen
  // per base code for this compact index (modifiers/pricing detail are out of scope
  // for "codes + short descriptions").
  if (!seen.has(code)) {
    seen.set(code, {
      code,
      shortDescription,
      active: terminationDate === '',
      actionCode,
    });
  }
}

const hcpcs2 = [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(hcpcs2);
writeFileSync(OUT, json);
const sha256 = createHash('sha256').update(json).digest('hex');
console.log(`hcpcs2: ${lines.length} source rows -> ${hcpcs2.length} Level II codes`);
console.log(`Wrote ${OUT} (${json.length} bytes, sha256 ${sha256})`);
