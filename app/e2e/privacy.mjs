#!/usr/bin/env node
// Privacy proof (docs/SPEC.md §5), repeatable: `npm run test:privacy -w app` (local dist, served
// with vercel.json's headers) or `node e2e/privacy.mjs --url https://finecomb.vercel.app` (live).
//
//  1. A canary bill goes through paste → confirm → context → results → a letter → the screener,
//     recording every request (context-wide, so workers and preloads are included).
//  2. No request has a body; no URL or header carries a canary, a code or an amount from the bill.
//  3. The request list is IDENTICAL for a second, different bill.
//  4. Offline after the first load, analysis still works.
//  5. Every route returns the exact CSP and headers from vercel.json.
//  6. dist/ has no fetch( / sendBeacon / XMLHttpRequest outside the data loader and the OCR/PDF code.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { appDir, launch, runCheck, runLetterAndScreener, serveDist, vercelHeaders } from './harness.mjs';

const ROUTES = ['/', '/check', '/check/results', '/letters', '/help', '/rights', '/accuracy', '/privacy'];

const CANARY_BILL = {
  provider: 'Finecomb Test Hospital',
  patient: 'QUOKKA-ZEBRA-7781',
  account: 'ACCT-CANARY-55',
  admit: '09/10/2026',
  discharge: '09/12/2026',
  statement: '09/20/2026',
  lines: [
    '09/10/2026  0450  99284  ED Visit Level 4  1  1234.57  1234.57',
    '09/10/2026  0450  99284  ED Visit Level 4  1  1234.57  1234.57',
    '09/11/2026  0300  Laboratory Services  1  420.13  420.13',
    '09/11/2026  0636  J1745  Infliximab Injection  2  315.51  631.02',
  ],
  total: '3520.29',
  state: 'CA',
  household: 3,
  income: 41234,
  tokens: ['QUOKKA', 'ZEBRA-7781', 'ACCT-CANARY-55', '1234.57', '1,234.57', '123457', '3520.29', '420.13', '631.02',
    '315.51', '99284', 'J1745', '0450', '0636', '41234'],
};

const OTHER_BILL = {
  provider: 'Other Valley Clinic',
  patient: 'Pat Example',
  account: 'ZX-99001',
  admit: '08/02/2026',
  discharge: '08/03/2026',
  statement: '08/10/2026',
  lines: [
    '08/02/2026  99213  Office Visit  1  175.00  175.00',
    '08/02/2026  90686  Influenza Vaccine  1  28.00  28.00',
    '08/03/2026  0250  Pharmacy  2  45.00  90.00',
  ],
  total: '293.00',
  state: 'NY',
  household: 2,
  income: 60000,
  tokens: ['Pat Example', 'Pat%20Example', 'ZX-99001', '99213', '90686', '175.00', '293.00', '60000'],
};

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

async function recordRun(browser, base, bill, { offline = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const requests = [];
  const pending = [];
  const failed = [];
  const navigations = [];
  context.on('request', (req) => {
    const entry = { method: req.method(), url: req.url(), type: req.resourceType(), body: req.postData(), headers: {} };
    requests.push(entry);
    pending.push(req.allHeaders().then((h) => (entry.headers = h)).catch(() => {}));
  });
  context.on('requestfailed', (req) => failed.push(req.url()));
  const page = await context.newPage();
  page.on('framenavigated', (f) => navigations.push(f.url()));
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await runCheck(page, base, bill, {
    onStep: async (step) => {
      if (offline && step === 'check-1-add-bill') {
        await page.waitForLoadState('networkidle');
        await context.setOffline(true);
      }
    },
  });
  const findings = Number(await page.locator('.summary-stats__value').first().innerText());
  const letterAndScreen = await runLetterAndScreener(page, bill);
  await Promise.all(pending);
  const serviceWorkers = context.serviceWorkers().length;
  await context.close();
  return { requests, failed, navigations, findings, serviceWorkers, consoleErrors, ...letterAndScreen };
}

function leaks(run, tokens) {
  const hits = [];
  for (const r of run.requests) {
    const hay = [r.url, decodeURIComponent(r.url), ...Object.entries(r.headers).flat()].join('\n').toLowerCase();
    for (const t of tokens) if (hay.includes(t.toLowerCase())) hits.push(`${t} in ${r.method} ${r.url}`);
  }
  for (const u of run.navigations) {
    for (const t of tokens) if (decodeURIComponent(u).toLowerCase().includes(t.toLowerCase())) hits.push(`${t} in page URL ${u}`);
  }
  return hits;
}

const signature = (run) => run.requests.map((r) => `${r.method} ${new URL(r.url).pathname}${new URL(r.url).search}`);

async function headerChecks(base) {
  const want = await vercelHeaders();
  for (const route of ROUTES) {
    const res = await fetch(`${base}${route}`, { method: 'HEAD', redirect: 'manual' });
    const bad = Object.entries(want).filter(([k, v]) => res.headers.get(k) !== v).map(([k]) => k);
    check(res.status === 200 && bad.length === 0, `headers exact on ${route} (status ${res.status}${bad.length ? `, wrong: ${bad.join(', ')}` : ''})`);
  }
}

async function distGrep() {
  const dist = path.join(appDir, 'dist');
  const files = [];
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.(m?js|html)$/.test(e.name)) files.push(p);
    }
  };
  await walk(dist);
  // Allowed: the lazy OCR/PDF chunks and their self-hosted workers (they load their own assets).
  const allowed = (rel) => /^(assets\/(pdf|ocr)-[\w-]+\.js|pdf\/|ocr\/)/.test(rel);
  for (const f of files) {
    const rel = path.relative(dist, f);
    if (allowed(rel)) continue;
    const src = await readFile(f, 'utf8');
    const beacons = (src.match(/sendBeacon|XMLHttpRequest|new\s+WebSocket|EventSource\(/g) ?? []).length;
    const fetches = [...src.matchAll(/fetch\(/g)].map((m) => src.slice(m.index, m.index + 60));
    const strayFetches = fetches.filter((s) => !s.includes('/data/'));
    check(beacons === 0 && strayFetches.length === 0,
      `${rel}: ${fetches.length} fetch( (all to /data/: ${strayFetches.length === 0}), ${beacons} beacon/XHR/socket`);
  }
}

async function main() {
  const urlArg = process.argv.indexOf('--url');
  const live = urlArg > -1 ? process.argv[urlArg + 1].replace(/\/$/, '') : null;
  const server = live ? null : await serveDist();
  const base = live ?? server.url;
  console.log(`Privacy e2e against ${base}${live ? ' (live)' : ' (local dist with vercel.json headers)'}`);

  const browser = await launch();
  try {
    const a = await recordRun(browser, base, CANARY_BILL);
    const b = await recordRun(browser, base, OTHER_BILL);

    check(a.findings > 0, `canary bill analysed: ${a.findings} findings shown`);
    check(a.letter.includes('QUOKKA-ZEBRA-7781') && a.letter.includes('ACCT-CANARY-55'), 'letter generated locally with the canary name and account');
    check(a.requests.length > 0, `recorded ${a.requests.length} requests (canary) / ${b.requests.length} (other bill)`);
    const withBody = [...a.requests, ...b.requests].filter((r) => r.body || !['GET', 'HEAD'].includes(r.method));
    check(withBody.length === 0, `no request has a body or a non-GET method${withBody.length ? `: ${withBody.map((r) => r.url).join(', ')}` : ''}`);
    const hitsA = leaks(a, CANARY_BILL.tokens);
    const hitsB = leaks(b, OTHER_BILL.tokens);
    check(hitsA.length === 0 && hitsB.length === 0, `no canary, code or amount in any URL or header${hitsA.length + hitsB.length ? `: ${[...hitsA, ...hitsB].slice(0, 5).join('; ')}` : ''}`);
    const sa = signature(a);
    const sb = signature(b);
    const same = JSON.stringify([...sa].sort()) === JSON.stringify([...sb].sort());
    check(same, `request list identical for two different bills (${sa.length} requests; same order: ${JSON.stringify(sa) === JSON.stringify(sb)})`);
    if (!same) console.log({ canary: sa, other: sb });
    const external = sa.filter((s) => !new URL(a.requests[sa.indexOf(s)].url).href.startsWith(base));
    check(external.length === 0, `every request is same-origin${external.length ? `: ${external.join(', ')}` : ''}`);
    check(a.serviceWorkers === 0, 'no service worker registered');
    const errs = [...a.consoleErrors, ...b.consoleErrors];
    check(errs.length === 0, `no console errors or CSP violations${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
    console.log('Requests (canary run):');
    for (const s of sa) console.log(`   ${s}`);

    const off = await recordRun(browser, base, CANARY_BILL, { offline: true });
    check(off.findings > 0 && off.failed.length === 0 && off.letter.includes('QUOKKA-ZEBRA-7781'),
      `offline after first load: analysis, letter and screener still work (${off.findings} findings, ${off.failed.length} failed requests)`);

    await headerChecks(base);
    if (!live) await distGrep();
  } finally {
    await browser.close();
    await server?.close();
  }
  console.log(failures.length ? `\nPRIVACY E2E FAILED (${failures.length})` : '\nPRIVACY E2E PASSED');
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
