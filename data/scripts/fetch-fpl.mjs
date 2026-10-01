#!/usr/bin/env node
// Fetches/encodes the 2026 HHS Poverty Guidelines (48 states + DC, Alaska, Hawaii).
// Source: Federal Register notice "Annual Update of the HHS Poverty Guidelines",
// 91 FR 1797, published 2026-01-15, document number 2026-00755.
// https://www.federalregister.gov/documents/2026/01/15/2026-00755/annual-update-of-the-hhs-poverty-guidelines
// Verified against https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines (fetched 2026-10-01).
//
// The Federal Register notice is the primary legal source (poverty guidelines are
// issued via Federal Register notice under 42 U.S.C. 9902(2)); ASPE republishes the
// same figures. There is no bulk CSV/JSON from HHS, so the guideline tables below are
// transcribed directly from the notice text and re-derived programmatically (base +
// per-person increment) rather than hand-typed per family size, to avoid transcription
// errors beyond the primary-source base/increment pair.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dirname}/../out/fpl-2026.json`;

const SOURCE = {
  url: 'https://www.federalregister.gov/documents/2026/01/15/2026-00755/annual-update-of-the-hhs-poverty-guidelines',
  pdfUrl: 'https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf',
  citation: '91 FR 1797',
  documentNumber: '2026-00755',
  publicationDate: '2026-01-15',
  effectiveDate: '2026-01-13',
  fetchedDate: '2026-10-01',
  license: 'U.S. Government work, public domain (17 U.S.C. 105).',
};

// [base for 1 person, increment per additional person] as published.
const REGIONS = {
  '48states_dc': { label: '48 Contiguous States and the District of Columbia', base: 15960, increment: 5680 },
  alaska: { label: 'Alaska', base: 19950, increment: 7100 },
  hawaii: { label: 'Hawaii', base: 18360, increment: 6530 },
};

function buildTable(base, increment) {
  // Published explicitly for household sizes 1-8; sizes above 8 use the increment rule.
  const sizes = {};
  for (let n = 1; n <= 8; n++) {
    sizes[n] = base + (n - 1) * increment;
  }
  return sizes;
}

const guidelines = {};
for (const [key, { label, base, increment }] of Object.entries(REGIONS)) {
  guidelines[key] = {
    label,
    base,
    increment,
    note: 'For households above 8 persons, add `increment` for each additional person.',
    bySize: buildTable(base, increment),
  };
}

// Spot-check against the four published figures beyond size 1 that appeared in the
// notice text, to catch an arithmetic mistake in the generator above.
const checks = [
  ['48states_dc', 4, 33000],
  ['48states_dc', 8, 55720],
  ['alaska', 8, 69650],
  ['hawaii', 8, 64070],
];
for (const [region, size, expected] of checks) {
  const got = guidelines[region].bySize[size];
  if (got !== expected) {
    throw new Error(`FPL check failed: ${region} size ${size} = ${got}, expected ${expected}`);
  }
}

const doc = {
  year: 2026,
  source: SOURCE,
  guidelines,
};

mkdirSync(dirname(OUT), { recursive: true });
const json = JSON.stringify(doc, null, 2);
writeFileSync(OUT, json);
const sha256 = createHash('sha256').update(json).digest('hex');
console.log(`Wrote ${OUT} (${json.length} bytes, sha256 ${sha256})`);
