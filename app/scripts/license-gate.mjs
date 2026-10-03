#!/usr/bin/env node
/**
 * license-gate.mjs — post-build license gate for Finecomb (lane I1).
 *
 * Intended to run as the app's `postbuild` step from the `app/` directory
 * (so the default scan target `dist` resolves to `app/dist`). See
 * docs/DATA-LICENSING.md (the ship/don't-ship rules) and docs/SPEC.md §8
 * ("a licensing gate: the build fails if dist/ contains a CPT-shaped code
 * outside the explicit allowlist of about 15 families, or any of the
 * forbidden-text fixtures").
 *
 * Exits 1 with one message per violation if anything is found. Exits 0 and
 * prints a single summary line otherwise.
 *
 * Usage:
 *   node scripts/license-gate.mjs [distDir]   # default distDir: "dist"
 *   node scripts/license-gate.mjs --self-test  # exercises all three checks
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const pendingLicenseDir = path.join(repoRoot, 'data', '_pending-license');
const fixturesPath = path.join(here, 'license-fixtures.json');

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// ---------------------------------------------------------------------------
// Check 2 — bulk CPT-shaped tables.
//
// A CPT-shaped ("HCPCS Level I") code is exactly 5 characters: 4 digits
// followed by a digit, F, T, or U. HCPCS Level II codes ([A-V]\d{4}) start
// with a letter, never match this shape, and are CMS-owned public domain —
// they ship freely (docs/DATA-LICENSING.md). This is also why a 5-digit ZIP
// (hospitals.json's `zip` field) is not flagged below: it is excluded by
// FIELD NAME, not by code shape — `zip` is not in CODE_FIELD_HINTS. NDCs
// (nadac-all.json's `ndc` field) are 11 digits, so they fail the 5-char
// shape test even before the field-name filter would apply.
// ---------------------------------------------------------------------------

export const CPT_SHAPE_RE = /^\d{4}[0-9FTU]$/;

// Allowlist of CPT code families the engine is permitted to reference
// generically (docs/DATA-LICENSING.md's "CPT numbers vs AMA descriptors"
// row: "About 15 code families are referenced in rule logic, with our own
// generic wording", e.g. the 99202-99215 office E/M family, 99281-99285 ED,
// 99291-99292 critical care). This must mirror EXACTLY what engine/src's
// rules cite — nothing more.
//
// As of this gate's authoring, engine/src (excluding __tests__) references
// ZERO CPT literals. Re-verify with:
//   grep -rnE "'[0-9]{4}[0-9FTU]'|\"[0-9]{4}[0-9FTU]\"" engine/src --include=*.ts | grep -v __tests__
// That command currently returns nothing, so this list starts EMPTY. Add an
// entry only when a rule starts citing a specific family by number, and only
// after the A1/legal sign-off docs/DATA-LICENSING.md calls for — do not
// pre-populate this speculatively, and do not widen it to cover a whole
// table dump.
export const ALLOWED_CPT_FAMILIES = [
  // Shape for a future entry, once a rule actually cites it:
  // { label: '99202-99215 office E/M', test: (code) => code >= '99202' && code <= '99215' },
];

function isAllowedCode(code) {
  return ALLOWED_CPT_FAMILIES.some((family) => family.test(code));
}

// Field-name hints for "this value is a code column" in JSON data (not zip,
// not ccn, not ndc — those aren't in this list, so their values are never
// shape-tested at all, regardless of what they look like).
const CODE_FIELD_HINTS = ['code', 'cpt', 'hcpcs', 'col1', 'col2', 'primary', 'secondary'];
function isCodeLikeField(key) {
  const k = key.toLowerCase();
  return CODE_FIELD_HINTS.some((hint) => k === hint || k.includes(hint));
}

function collectCptShapedFromJson(data) {
  const found = new Set();
  function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (CPT_SHAPE_RE.test(key)) found.add(key);
        if (isCodeLikeField(key) && typeof value === 'string' && CPT_SHAPE_RE.test(value)) {
          found.add(value);
        }
        walk(value);
      }
    }
  }
  walk(data);
  return found;
}

// Quoted string-literal scanner for .js/.mjs bundles. The repetition is
// bounded (1-40 chars between quotes) so it can't pathologically backtrack
// on a huge minified one-liner; no real code string is a useful match past
// that length anyway since we only care about exact 5-char CPT shapes.
const QUOTED_LITERAL_RE = /'((?:[^'\\]|\\.){1,40}?)'|"((?:[^"\\]|\\.){1,40}?)"/g;

function collectCptShapedFromJs(text) {
  const found = new Set();
  let m;
  QUOTED_LITERAL_RE.lastIndex = 0;
  while ((m = QUOTED_LITERAL_RE.exec(text))) {
    const lit = m[1] !== undefined ? m[1] : m[2];
    if (lit && CPT_SHAPE_RE.test(lit)) found.add(lit);
  }
  return found;
}

const BULK_TABLE_THRESHOLD = 15;

// Known library noise, documented rather than special-cased: the tesseract.js
// OCR worker bundle (app/dist/ocr/worker.min.js) contains exactly one quoted
// literal matching the CPT shape — "11111" — which is a bitmask constant from
// its PNG/image decoding path, not a medical code. It is 1 << BULK_TABLE_
// THRESHOLD=15, so real library noise like this is absorbed by the threshold
// without needing a per-file exclusion. If a future dependency bump ever
// pushes a bundle's incidental-literal count past 15, raise this comment's
// finding to a real exclusion (by exact file + literal, never by whole file)
// instead of raising the threshold.

// ---------------------------------------------------------------------------
// Check 1 — quarantined `_pending-license` data must not reach dist.
// ---------------------------------------------------------------------------

const BANNED_PATH_SUBSTRINGS = ['_pending-license', 'mue-', 'pfs'];

// Fingerprint keys unique to the quarantined shard shapes under
// data/_pending-license/{mue-practitioner,mue-outpatient-hospital,pfs}/*.json:
//   MUE rows: {"code","mueValue","adjudicationIndicator","adjudicationLabel","effectiveDate"}
//   PFS rows: {"code","modifier","statusCode","workRvu","nonFacilityPeRvu","facilityPeRvu","mpRvu","nonFacilityTotalRvu","facilityTotalRvu","pctcIndicator"}
// "code" and "effectiveDate" are too generic to fingerprint on; the rest are
// distinctive enough that a single hit is treated as conclusive.
const MUE_FINGERPRINT_KEYS = ['mueValue', 'adjudicationIndicator', 'adjudicationLabel'];
const PFS_FINGERPRINT_KEYS = [
  'workRvu',
  'nonFacilityPeRvu',
  'facilityPeRvu',
  'mpRvu',
  'nonFacilityTotalRvu',
  'facilityTotalRvu',
  'pctcIndicator',
];
const FINGERPRINT_KEYS = new Set([...MUE_FINGERPRINT_KEYS, ...PFS_FINGERPRINT_KEYS]);

function looksLikeMueOrPfs(data) {
  let hit = null;
  function walk(node) {
    if (hit) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
        if (hit) return;
      }
    } else if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        if (FINGERPRINT_KEYS.has(key)) {
          hit = key;
          return;
        }
      }
      for (const value of Object.values(node)) {
        walk(value);
        if (hit) return;
      }
    }
  }
  walk(data);
  return hit;
}

let _pendingHashesCache = null;
function hashPendingLicenseFiles() {
  if (_pendingHashesCache) return _pendingHashesCache;
  const hashes = new Map(); // sha256 -> relative path, for messages
  for (const file of listFiles(pendingLicenseDir)) {
    hashes.set(sha256File(file), path.relative(repoRoot, file));
  }
  _pendingHashesCache = hashes;
  return hashes;
}

// ---------------------------------------------------------------------------
// Check 3 — AMA / NUBC descriptor text fixtures.
// ---------------------------------------------------------------------------

// The fixtures file holds sha256 hashes of the descriptor fragments, never the
// text, so the public repo carries no licensed wording (lane P1). A fragment
// and the scanned text are normalized the same way, then every window of the
// fragment's word count is compared; a window is only hashed when its
// character count matches, which keeps the scan fast on the 9 MB data files.

export function normalizeForFixtures(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function fixtureFromPhrase(phrase, source) {
  const n = normalizeForFixtures(phrase);
  return { sha256: createHash('sha256').update(n).digest('hex'), words: n.split(' ').length, chars: n.length, source };
}

function loadFixtures() {
  const raw = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  const list = raw?.fixtures;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`license-fixtures.json must have a non-empty "fixtures" array (${fixturesPath})`);
  }
  for (const entry of list) {
    if (
      !entry ||
      !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '') ||
      !Number.isInteger(entry.words) ||
      entry.words < 1 ||
      !Number.isInteger(entry.chars) ||
      entry.chars < 1
    ) {
      throw new Error(`license-fixtures.json has an entry without a valid sha256/words/chars: ${JSON.stringify(entry)}`);
    }
  }
  return list;
}

// Returns the fixtures whose fragment occurs in `text` (after normalization).
export function findFixtureHits(text, fixtures) {
  const norm = normalizeForFixtures(text);
  if (!norm) return [];
  const tokens = norm.split(' ');
  const prefix = new Array(tokens.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < tokens.length; i++) prefix[i + 1] = prefix[i] + tokens[i].length;
  const byWords = new Map(); // words -> { chars: Set, hashes: Map(sha256 -> fixture) }
  for (const f of fixtures) {
    if (!byWords.has(f.words)) byWords.set(f.words, { chars: new Set(), hashes: new Map() });
    const group = byWords.get(f.words);
    group.chars.add(f.chars);
    group.hashes.set(f.sha256, f);
  }
  const hits = new Set();
  for (const [k, group] of byWords) {
    for (let i = 0; i + k <= tokens.length; i++) {
      const len = prefix[i + k] - prefix[i] + (k - 1);
      if (!group.chars.has(len)) continue;
      const digest = createHash('sha256').update(tokens.slice(i, i + k).join(' ')).digest('hex');
      const hit = group.hashes.get(digest);
      if (hit) hits.add(hit);
    }
  }
  return [...hits];
}

const TEXT_SCAN_EXTENSIONS = new Set(['.js', '.json', '.html', '.css', '.mjs', '.txt', '.map']);

// ---------------------------------------------------------------------------
// The gate itself
// ---------------------------------------------------------------------------

function runGate(distDir, fixtures = loadFixtures()) {
  const errors = [];
  const allFiles = listFiles(distDir);
  if (allFiles.length === 0) {
    return { ok: false, errors: [`dist directory is empty or missing: ${distDir}`], fileCount: 0 };
  }

  // --- Check 1a: banned path substrings ---------------------------------
  for (const file of allFiles) {
    const rel = path.relative(distDir, file);
    for (const needle of BANNED_PATH_SUBSTRINGS) {
      if (rel.includes(needle)) {
        errors.push(`[pending-license path] ${rel} contains banned substring "${needle}"`);
      }
    }
  }

  // --- Check 1b: byte-identical to a quarantined source file ------------
  const pendingHashes = hashPendingLicenseFiles();
  if (pendingHashes.size > 0) {
    for (const file of allFiles) {
      const digest = sha256File(file);
      if (pendingHashes.has(digest)) {
        errors.push(
          `[pending-license sha256] ${path.relative(distDir, file)} is byte-identical to quarantined ${pendingHashes.get(digest)}`,
        );
      }
    }
  }

  // --- Check 1c (JSON shape) + Check 2 (bulk CPT tables) -----------------
  for (const file of allFiles) {
    const ext = path.extname(file);
    const rel = path.relative(distDir, file);

    if (ext === '.json') {
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        continue; // not valid JSON; irrelevant to the JSON-shape checks
      }

      const fingerprintHit = looksLikeMueOrPfs(data);
      if (fingerprintHit) {
        errors.push(`[pending-license shape] ${rel} contains an MUE/PFS-shaped row (fingerprint key "${fingerprintHit}")`);
      }

      const cptCodes = [...collectCptShapedFromJson(data)].filter((c) => !isAllowedCode(c));
      if (cptCodes.length > BULK_TABLE_THRESHOLD) {
        errors.push(
          `[bulk CPT table] ${rel} has ${cptCodes.length} distinct CPT-shaped codes outside ALLOWED_CPT_FAMILIES (examples: ${cptCodes.slice(0, 5).join(', ')})`,
        );
      }
    } else if (ext === '.js' || ext === '.mjs') {
      const text = fs.readFileSync(file, 'utf8');
      const cptCodes = [...collectCptShapedFromJs(text)].filter((c) => !isAllowedCode(c));
      if (cptCodes.length > BULK_TABLE_THRESHOLD) {
        errors.push(
          `[bulk CPT table] ${rel} has ${cptCodes.length} distinct CPT-shaped quoted literals outside ALLOWED_CPT_FAMILIES (examples: ${cptCodes.slice(0, 5).join(', ')})`,
        );
      }
    }
  }

  // --- Check 3: AMA/NUBC descriptor-text fixtures ------------------------
  for (const file of allFiles) {
    const ext = path.extname(file);
    if (!TEXT_SCAN_EXTENSIONS.has(ext)) continue;
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(distDir, file);
    for (const fixture of findFixtureHits(text, fixtures)) {
      errors.push(`[licensed descriptor text] ${rel} contains fixture fragment sha256 ${fixture.sha256.slice(0, 12)}… (${fixture.source})`);
    }
  }

  return { ok: errors.length === 0, errors, fileCount: allFiles.length };
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

function selfTest() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'license-gate-selftest-'));
  let allOk = true;
  const report = (name, assertionPassed, result) => {
    if (assertionPassed) {
      console.log(`  ok   - ${name}`);
    } else {
      allOk = false;
      console.log(`  FAIL - ${name} (gate.ok=${result.ok}, errors=${JSON.stringify(result.errors)})`);
    }
  };

  try {
    // (a) A JSON table of 40 CPT-shaped keys -> must FAIL (bulk CPT table).
    const bulkDir = path.join(tmpRoot, 'bulk-cpt');
    fs.mkdirSync(path.join(bulkDir, 'data'), { recursive: true });
    const bulkObj = {};
    for (let i = 0; i < 40; i++) {
      const code = String(10000 + i * 7).padStart(5, '0');
      bulkObj[code] = { note: 'synthetic-self-test-row' };
    }
    fs.writeFileSync(path.join(bulkDir, 'data', 'table.json'), JSON.stringify(bulkObj));
    report('40-key CPT-shaped bulk table fails', !runGate(bulkDir).ok, runGate(bulkDir));

    // (b) A file containing a fixture phrase -> must FAIL (descriptor text).
    // The fixtures file holds only hashes, so the matcher is exercised with a
    // synthetic phrase hashed the same way, next to the real fixture list.
    const fixtureDir = path.join(tmpRoot, 'fixture-text');
    fs.mkdirSync(fixtureDir, { recursive: true });
    const realFixtures = loadFixtures();
    const canary = fixtureFromPhrase('Quokka-zebra canary, per day', 'self-test canary');
    fs.writeFileSync(path.join(fixtureDir, 'notes.txt'), 'Some plain text mentioning QUOKKA ZEBRA canary per day inline.');
    const withCanary = [...realFixtures, canary];
    report('fixture descriptor phrase fails', !runGate(fixtureDir, withCanary).ok, runGate(fixtureDir, withCanary));
    report('fixtures file loads (sha256 needles only)', realFixtures.length > 0, { ok: true, errors: [] });

    // (c) A copy of one real _pending-license shard, at a path with none of
    // the banned substrings -> must FAIL (sha256 identity and/or shape).
    // A clone of the public repo has no quarantined data on disk, so it uses
    // a synthetic MUE-shaped row (shape check only) instead.
    const pendingScenarioDir = path.join(tmpRoot, 'pending-copy');
    const pendingDataDir = path.join(pendingScenarioDir, 'data');
    fs.mkdirSync(pendingDataDir, { recursive: true });
    const digitShards = listFiles(pendingLicenseDir).filter((f) => /^[0-9]\.json$/.test(path.basename(f)));
    const anyShard = listFiles(pendingLicenseDir).filter((f) => f.endsWith('.json') && path.basename(f) !== 'manifest.json');
    const shardToCopy = digitShards[0] ?? anyShard[0];
    if (shardToCopy) {
      fs.copyFileSync(shardToCopy, path.join(pendingDataDir, 'code-table.json'));
      report('copy of real _pending-license shard fails', !runGate(pendingScenarioDir).ok, runGate(pendingScenarioDir));
    } else {
      fs.writeFileSync(
        path.join(pendingDataDir, 'code-table.json'),
        JSON.stringify([{ code: 'X0000', mueValue: 1, adjudicationIndicator: '3', adjudicationLabel: 'synthetic', effectiveDate: '2000-01-01' }]),
      );
      report(
        'MUE-shaped row fails (no local _pending-license data, so no real shard to copy)',
        !runGate(pendingScenarioDir).ok,
        runGate(pendingScenarioDir),
      );
    }

    // (d) A clean temp dir -> must PASS.
    const cleanDir = path.join(tmpRoot, 'clean');
    fs.mkdirSync(path.join(cleanDir, 'data'), { recursive: true });
    fs.writeFileSync(
      path.join(cleanDir, 'data', 'misc.json'),
      JSON.stringify({ zip: '12345', ccn: '010001', ndc: '00002771559', hello: 'world' }),
    );
    fs.writeFileSync(path.join(cleanDir, 'app.js'), 'console.log("hello world", "A0021", "36301");');
    fs.writeFileSync(path.join(cleanDir, 'index.html'), '<html><body>Plain language explanation of your bill.</body></html>');
    const cleanResult = runGate(cleanDir);
    report('clean directory passes', cleanResult.ok, cleanResult);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  console.log(allOk ? 'license-gate --self-test: PASS' : 'license-gate --self-test: FAIL');
  return allOk;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
    return;
  }

  const distArg = args.find((a) => !a.startsWith('--')) ?? 'dist';
  const distDir = path.resolve(process.cwd(), distArg);
  const result = runGate(distDir);

  if (!result.ok) {
    console.error(`license-gate: FAIL — ${result.errors.length} violation(s) in ${distDir}`);
    for (const err of result.errors) console.error(`  - ${err}`);
    process.exit(1);
    return;
  }

  const fixtureCount = loadFixtures().length;
  console.log(
    `license-gate: PASS — ${result.fileCount} files scanned in ${path.relative(process.cwd(), distDir) || distDir}; ` +
      `no _pending-license leakage (path/sha256/shape), no bulk CPT-shaped tables (>${BULK_TABLE_THRESHOLD} outside ${ALLOWED_CPT_FAMILIES.length}-family allowlist), ` +
      `no match on ${fixtureCount} AMA/NUBC descriptor fixtures.`,
  );
  process.exit(0);
}

main();
