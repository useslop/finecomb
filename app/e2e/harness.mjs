// Shared e2e harness: a static server for dist/ that applies vercel.json's rewrites and headers
// (so the production CSP is exercised locally), the cached headless Chromium, and the bill flow.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
export const appDir = path.resolve(here, '..');
const distDir = path.join(appDir, 'dist');

const HEADLESS_SHELL = path.join(
  os.homedir(),
  'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gz': 'application/gzip',
  '.txt': 'text/plain',
};

export async function vercelHeaders() {
  const cfg = JSON.parse(await readFile(path.join(appDir, 'vercel.json'), 'utf8'));
  return Object.fromEntries(cfg.headers[0].headers.map((h) => [h.key, h.value]));
}

/** Serves dist/ like Vercel would (SPA fallback + vercel.json headers). Resolves to its base URL. */
export async function serveDist() {
  if (!existsSync(path.join(distDir, 'index.html'))) throw new Error('dist/ missing: run `npm run build -w app` first');
  const headers = await vercelHeaders();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let file = path.join(distDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(distDir)) file = path.join(distDir, 'index.html');
    try {
      if (!(await stat(file)).isFile()) throw new Error('dir');
    } catch {
      file = path.join(distDir, 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

export async function launch() {
  if (!existsSync(HEADLESS_SHELL)) throw new Error(`headless shell not found at ${HEADLESS_SHELL}`);
  return chromium.launch({ executablePath: HEADLESS_SHELL, headless: true });
}

export function billText(b) {
  return [
    `Provider: ${b.provider}`,
    `Patient: ${b.patient}`,
    `Account: ${b.account}`,
    `Admit: ${b.admit}`,
    `Discharge: ${b.discharge}`,
    `Statement Date: ${b.statement}`,
    '',
    ...b.lines,
    '',
    `Total Charges: ${b.total}`,
    `Balance Due: ${b.total}`,
  ].join('\n');
}

/** Landing → paste → confirm grid → context → results. Leaves the page on /check/results. */
export async function runCheck(page, base, b, { onStep } = {}) {
  await page.goto(`${base}/`);
  await onStep?.('landing');
  await page.getByRole('button', { name: /start/i }).first().click();
  await page.waitForURL(/\/check$/);
  await onStep?.('check-1-add-bill');
  await page.fill('#bill-text', billText(b));
  await page.getByRole('button', { name: 'Use this text' }).click();
  await page.getByRole('button', { name: 'These lines look right' }).waitFor();
  // Make sure the identifying canaries are in the bill state even if the parser missed a label.
  await page.fill('#h-patient', b.patient);
  await page.fill('#h-account', b.account);
  await onStep?.('check-2-confirm');
  await page.getByRole('button', { name: 'These lines look right' }).click();
  await page.getByRole('button', { name: 'See results' }).waitFor();
  await page.selectOption('#state', b.state);
  await page.fill('#household-size', String(b.household));
  await page.fill('#annual-income', String(b.income));
  await onStep?.('check-3-context');
  await page.getByRole('button', { name: 'See results' }).click();
  await page.waitForURL(/\/check\/results$/);
  await page.getByRole('heading', { name: 'Your results' }).waitFor();
  await onStep?.('results');
}

/** Results → mark first finding for dispute → /letters L2 → /help screener. */
export async function runLetterAndScreener(page, b) {
  const add = page.getByRole('button', { name: 'Add to dispute letter' }).first();
  if (await add.count()) await add.click();
  await page.getByRole('navigation').getByRole('link', { name: 'Letters' }).click();
  await page.waitForURL(/\/letters$/);
  await page.selectOption('#letter-template', 'L2');
  await page.getByRole('button', { name: 'Regenerate from current answers' }).click();
  const letter = await page.inputValue('#letter-text');
  await page.getByRole('navigation').getByRole('link', { name: 'Charity & assistance' }).click();
  await page.waitForURL(/\/help$/);
  await page.fill('#help-household-size', String(b.household));
  await page.fill('#help-income', String(b.income));
  await page.selectOption('#help-state', b.state);
  await page.getByText('of the 2026 federal poverty guideline').first().waitFor();
  return { letter };
}
