// Q1 (2026-10-02): loader for the hand-made set in corpus/data/handmade (labels written before the engine ran).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CorpusItem } from './types.js';

export const HANDMADE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'handmade');
export function loadHandmade(): CorpusItem[] {
  const manifest = JSON.parse(readFileSync(join(HANDMADE_DIR, 'manifest.json'), 'utf8')) as { files: string[] };
  return manifest.files.map((f) => JSON.parse(readFileSync(join(HANDMADE_DIR, f), 'utf8')) as CorpusItem);
}

