#!/usr/bin/env node
// Stages dist/ as a prebuilt static deployment: copies vercel.json (headers + SPA rewrite) into it
// with "no build" overrides, so Vercel serves exactly the tested, license-gated files and never
// receives the source tree or data/_pending-license. Deploy: see the I1 lane's DEPLOY.md.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(appDir, 'vercel.json'), 'utf8'));
const staged = { ...cfg, framework: null, buildCommand: '', installCommand: '', outputDirectory: '.' };
await writeFile(path.join(appDir, 'dist', 'vercel.json'), JSON.stringify(staged, null, 2) + '\n');
console.log('[stage-deploy] dist/vercel.json written (static, no build)');
