#!/usr/bin/env node
// axe-core over every route and each /check step, on an iPhone-sized viewport (390×844).
// Fails on any serious or critical violation. `npm run test:a11y -w app` (local dist) or
// `node e2e/a11y.mjs --url https://finecomb.vercel.app`. `--shots <dir>` also saves a PNG per screen.
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { launch, runCheck, serveDist } from './harness.mjs';

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

// A demo bill built to show several kinds of finding: a duplicate, a total that doesn't add up,
// a charge after discharge, and an EOB/No Surprises Act gap. No real person or provider.
export const DEMO_BILL = {
  provider: 'Riverbend Medical Center',
  patient: 'Sam Demo',
  account: 'DEMO-1001',
  admit: '09/14/2026',
  discharge: '09/16/2026',
  statement: '09/25/2026',
  lines: [
    '09/14/2026  0450  99285  Emergency department visit  1  2150.00  2150.00',
    '09/14/2026  0300  Laboratory services  1  385.00  385.00',
    '09/14/2026  0300  Laboratory services  1  385.00  385.00',
    '09/15/2026  0120  Room and board semi-private  1  1900.00  1900.00',
    '09/18/2026  0250  Pharmacy  1  96.00  96.00',
  ],
  total: '5100.00',
  state: 'CA',
  household: 3,
  income: 48000,
};

async function demoContext(page) {
  await page.selectOption('#ins', 'commercial');
  await page.check('#admitted');
  await page.check('#emergency');
  await page.selectOption('#in-network', 'false');
  for (const [id, v] of [['#eob-billed', 5100], ['#eob-allowed', 2600], ['#eob-planpaid', 2100], ['#eob-deductible', 300], ['#eob-coinsurance', 200], ['#eob-pr', 500]]) {
    await page.fill(id, String(v));
  }
}

const urlArg = process.argv.indexOf('--url');
const live = urlArg > -1 ? process.argv[urlArg + 1].replace(/\/$/, '') : null;
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > -1 ? path.resolve(process.argv[shotsArg + 1]) : null;
if (shotsDir) await mkdir(shotsDir, { recursive: true });

const server = live ? null : await serveDist();
const base = live ?? server.url;
const browser = await launch();
// bypassCSP only so axe can be injected; the privacy e2e covers the CSP itself.
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, bypassCSP: true });
const page = await context.newPage();

const results = [];
let n = 0;
async function audit(name) {
  await page.evaluate(axeSource);
  const r = await page.evaluate(async () => {
    const out = await window.axe.run(document, { resultTypes: ['violations'] });
    return out.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help, target: v.nodes[0]?.target?.join(' ') }));
  });
  results.push({ name, violations: r });
  const bad = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  console.log(`${bad.length ? 'FAIL' : 'PASS'}  ${name}: ${r.length} violations (${bad.length} serious/critical)${r.length ? ` — ${r.map((v) => `${v.id}[${v.impact}×${v.nodes}]`).join(', ')}` : ''}`);
  for (const v of bad) console.log(`        ${v.id}: ${v.help} @ ${v.target}`);
  if (shotsDir) {
    n += 1;
    await page.screenshot({ path: path.join(shotsDir, `${String(n).padStart(2, '0')}-${name}.png`) });
  }
}

async function nav(label, urlRe) {
  await page.getByRole('navigation').getByRole('link', { name: label }).click();
  await page.waitForURL(urlRe);
}

try {
  await runCheck(page, base, DEMO_BILL, {
    onStep: async (step) => {
      if (step === 'check-3-context') await demoContext(page);
      await audit(step);
    },
  });
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'results-demo-fullpage.png'), fullPage: true });
  const findings = await page.locator('.summary-stats__value').first().innerText();
  console.log(`      demo bill: ${findings} findings`);
  await page.getByRole('button', { name: 'Add to dispute letter' }).first().click();

  await nav('Letters', /\/letters$/);
  await page.selectOption('#letter-template', 'L2');
  await page.getByRole('button', { name: 'Regenerate from current answers' }).click();
  await audit('letters');

  await nav('Charity & assistance', /\/help$/);
  await page.fill('#help-household-size', String(DEMO_BILL.household));
  await page.fill('#help-income', String(DEMO_BILL.income));
  await page.selectOption('#help-state', DEMO_BILL.state);
  await page.getByText('of the 2026 federal poverty guideline').first().waitFor();
  await audit('help');

  await nav('Know your rights', /\/rights$/);
  await audit('rights');
  await nav('Accuracy', /\/accuracy$/);
  await audit('accuracy');
  await nav('Privacy', /\/privacy$/);
  await audit('privacy');
} finally {
  await browser.close();
  await server?.close();
}

const serious = results.flatMap((r) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'));
console.log(serious.length ? `\nA11Y FAILED: ${serious.length} serious/critical across ${results.length} screens` : `\nA11Y PASSED: 0 serious/critical across ${results.length} screens`);
process.exit(serious.length ? 1 : 0);
