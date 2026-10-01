#!/usr/bin/env node
// Copies the public-domain data shards from ../data/out into app/public/data at build time.
// NADAC ships as 500+ per-prefix shards; we concatenate them into one file here so the app
// loads pricing data with a single content-independent request instead of a per-NDC fetch
// (see docs/SPEC.md §5: "Content-independent fetches").
import { mkdir, readdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../../data/out');
const outDir = path.resolve(here, '../public/data');

const FLAT_FILES = ['fpl-2026.json', 'hospitals.json', 'hospitals-search-index.json', 'hcpcs2.json'];

async function main() {
  if (!existsSync(srcDir)) {
    console.warn(`[copy-data] ${srcDir} not found — skipping (data lane hasn't built yet?).`);
    return;
  }
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const file of FLAT_FILES) {
    const from = path.join(srcDir, file);
    if (existsSync(from)) {
      await copyFile(from, path.join(outDir, file));
    } else {
      console.warn(`[copy-data] missing ${file}, skipped.`);
    }
  }

  const nadacDir = path.join(srcDir, 'nadac');
  if (existsSync(nadacDir)) {
    const entries = (await readdir(nadacDir)).filter((f) => f.endsWith('.json') && f !== 'manifest.json').sort();
    const all = [];
    for (const entry of entries) {
      const shard = JSON.parse(await readFile(path.join(nadacDir, entry), 'utf8'));
      all.push(...shard);
    }
    await writeFile(path.join(outDir, 'nadac-all.json'), JSON.stringify(all));
    console.log(`[copy-data] concatenated ${entries.length} NADAC shards -> nadac-all.json (${all.length} NDCs)`);
  } else {
    console.warn('[copy-data] no data/out/nadac directory, skipped.');
  }

  console.log(`[copy-data] data copied to ${path.relative(process.cwd(), outDir)}`);
}

main().catch((err) => {
  console.error('[copy-data] failed:', err);
  process.exit(1);
});
