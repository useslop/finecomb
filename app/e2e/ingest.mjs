#!/usr/bin/env node
// PDF and photo ingest under the production CSP: `npm run test:ingest -w app` (local dist) or
// `node e2e/ingest.mjs --url https://finecomb.vercel.app`. A synthetic PDF (one text run per cell)
// and a synthetic phone "photo" (text drawn on a canvas) go through step 1; each must reach the
// step 2 grid with its lines, with no console/CSP errors and only same-origin, body-less GETs.
import { launch, serveDist } from './harness.mjs';

const PATIENT = 'QUOKKA-ZEBRA-7781';
const HEADER = [`Provider: Riverbend Medical Center`, `Patient: ${PATIENT}`, 'Account: ACCT-CANARY-55', 'Statement Date: 09/25/2026'];
const ROWS = [
  ['09/14/2026', '0450', '99285', 'Emergency department visit', '1', '2150.00', '2150.00'],
  ['09/14/2026', '0300', 'Laboratory services', '1', '385.00', '385.00'],
  ['09/15/2026', '0120', 'Room and board', '1', '1900.00', '1900.00'],
  ['09/15/2026', '0250', 'Pharmacy', '2', '617.29', '1234.58'],
];
const FOOTER = ['Total Charges: 5669.58', 'Balance Due: 5669.58'];

function pdfString(s) {
  return `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/** A minimal one-page PDF; every cell is its own text run, like real statement PDFs. */
function makePdf() {
  const ops = [];
  let y = 760;
  for (const line of HEADER) ops.push(`BT /F1 10 Tf 40 ${(y -= 16)} Td ${pdfString(line)} Tj ET`);
  y -= 16;
  for (const row of ROWS) {
    y -= 16;
    let x = 40;
    for (const cell of row) {
      ops.push(`BT /F1 9 Tf ${x} ${y} Td ${pdfString(cell)} Tj ET`);
      x += Math.max(50, cell.length * 5.2 + 18);
    }
  }
  y -= 16;
  for (const line of FOOTER) ops.push(`BT /F1 10 Tf 40 ${(y -= 16)} Td ${pdfString(line)} Tj ET`);
  const content = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

async function runIngest(browser, base, kind) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const requests = [];
  const errors = [];
  context.on('request', (r) => requests.push({ method: r.method(), url: r.url(), body: r.postData() }));
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/check`);
  await page.waitForLoadState('networkidle');

  let file;
  if (kind === 'pdf') {
    file = { name: 'bill.pdf', mimeType: 'application/pdf', buffer: makePdf() };
  } else {
    // Draw the bill as a tilted, slightly noisy "photo" on a canvas inside the page itself.
    const dataUrl = await page.evaluate(
      ({ header, rows, footer }) => {
        const lines = [...header, '', ...rows.map((r) => r.join('   ')), '', ...footer];
        const c = document.createElement('canvas');
        c.width = 1700;
        c.height = 80 + lines.length * 48;
        const g = c.getContext('2d');
        g.fillStyle = '#f4f1ea';
        g.fillRect(0, 0, c.width, c.height);
        g.translate(20, 10);
        g.rotate((1.5 * Math.PI) / 180);
        g.fillStyle = '#111';
        g.font = '30px Arial, Helvetica, sans-serif';
        lines.forEach((l, i) => g.fillText(l, 30, 60 + i * 48));
        return c.toDataURL('image/png');
      },
      { header: HEADER, rows: ROWS, footer: FOOTER },
    );
    file = { name: 'bill-photo.png', mimeType: 'image/png', buffer: Buffer.from(dataUrl.split(',')[1], 'base64') };
  }

  const t0 = Date.now();
  await page.setInputFiles('#bill-files', file);
  await page.getByRole('button', { name: 'These lines look right' }).waitFor({ timeout: 180_000 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const amounts = await page.$$eval('.grid-table tbody input', (els) => els.map((e) => e.value));
  const found = ROWS.filter((r) => amounts.includes(r[r.length - 1]) || amounts.includes(String(Number(r[r.length - 1])))).length;
  const patient = await page.inputValue('#h-patient');
  await context.close();
  return { requests, errors, secs, found, patient };
}

const urlArg = process.argv.indexOf('--url');
const live = urlArg > -1 ? process.argv[urlArg + 1].replace(/\/$/, '') : null;
const server = live ? null : await serveDist();
const base = live ?? server.url;
console.log(`Ingest e2e against ${base}`);
const browser = await launch();
try {
  for (const kind of ['pdf', 'photo']) {
    const r = await runIngest(browser, base, kind);
    check(r.found >= (kind === 'pdf' ? ROWS.length : ROWS.length - 1),
      `${kind}: reached the grid in ${r.secs}s with ${r.found}/${ROWS.length} line amounts recognised (patient field: "${r.patient}")`);
    check(r.errors.length === 0, `${kind}: no console errors or CSP violations${r.errors.length ? `: ${r.errors.slice(0, 2).join(' | ')}` : ''}`);
    // blob: URLs of this origin are in-memory object URLs (the decoded image), not network requests.
    const local = (u) => u.startsWith(`blob:${base}/`) || u.startsWith('data:');
    const bad = r.requests.filter((q) => (!q.url.startsWith(base) && !local(q.url)) || q.body || q.method !== 'GET');
    const net = r.requests.filter((q) => !local(q.url)).length;
    check(bad.length === 0, `${kind}: ${net} network requests, all same-origin GETs without a body${bad.length ? `: ${bad.map((q) => q.url).join(', ')}` : ''}`);
    const leaked = r.requests.filter((q) => /QUOKKA|CANARY|1234\.58|617\.29/i.test(decodeURIComponent(q.url)));
    check(leaked.length === 0, `${kind}: no bill content in any URL`);
    console.log(`      ${kind} assets: ${[...new Set(r.requests.map((q) => new URL(q.url).pathname).filter((p) => /pdf|ocr/.test(p)))].join(', ')}`);
  }
} finally {
  await browser.close();
  await server?.close();
}
console.log(failures.length ? `\nINGEST E2E FAILED (${failures.length})` : '\nINGEST E2E PASSED');
process.exit(failures.length ? 1 : 0);
