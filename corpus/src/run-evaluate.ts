import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCorpus, PRECISION_FLOOR } from './evaluate.js';
import { CORPUS_DIR, CORPUS_VERSION, HOLDOUT_DIR, HOLDOUT_VERSION, TODAY } from './generate.js';
import type { CorpusItem } from './types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..');
type Manifest = { files: string[]; seed: number; byKind: Record<string, number> };
const load = (dir: string) => {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;
  return { manifest, items: manifest.files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as CorpusItem) };
};
const { manifest, items } = load(CORPUS_DIR);
const ev = evaluateCorpus(items);
// Hold-out: a different seed of the same generator, never tuned against. The scoreboard stays on v1.
const hold = existsSync(join(HOLDOUT_DIR, 'manifest.json')) ? load(HOLDOUT_DIR) : null;
const hev = hold ? evaluateCorpus(hold.items) : null;
const git = (cmd: string) => { try { return execSync(cmd, { cwd: repo, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };

const scoreboard = {
  schema: 1,
  generated: TODAY,
  commit: git('git rev-parse --short HEAD'),
  engineCommit: git('git log -1 --format=%h -- engine'),
  corpusVersion: CORPUS_VERSION,
  corpus: { bills: ev.bills, clean: ev.clean, byKind: manifest.byKind, labels: ev.rules.reduce((s, r) => s + r.positives, 0), seed: manifest.seed },
  caveat: 'synthetic bills; real-world accuracy may be lower',
  method: 'Each bill is generated with planted errors and look-alike traps, labeled by an independent reading of the rule spec, then checked by the same engine the app runs. A finding counts as correct when it points at the labeled lines. The corpus deliberately over-samples look-alike traps (credits, bilateral lines, modifiers, overlapping hourly items), so precision here is a stress-test number, not a forecast.',
  precisionFloor: PRECISION_FLOOR,
  shipAsKey: { 'as-specified': `precision >= ${PRECISION_FLOOR}`, low: 'precision 0.6-0.9: show as Low confidence', off: 'precision < 0.6: keep off until fixed', untested: 'no positives or findings in the corpus' },
  overall: ev.overall,
  rules: ev.rules.map(({ topFalsePositiveCauses, topMissCauses, ...r }) => ({
    ...r,
    mainFalsePositiveCause: topFalsePositiveCauses[0]?.[0].replace(/^(hn|variant):/, '') ?? null,
    mainMissCause: topMissCauses[0]?.[0].replace(/^plant:[A-Z0-9-]+:?/, '') || (topMissCauses[0] ? 'planted case' : null),
  })),
  holdout: hev && hold ? {
    corpusVersion: HOLDOUT_VERSION, seed: hold.manifest.seed, bills: hev.bills, clean: hev.clean,
    note: 'Same generator and labeler, different seed; never tuned against. Agreement with the spec reading, not real-world accuracy.',
    overall: hev.overall,
    rules: hev.rules.map((r) => ({ ruleId: r.ruleId, positives: r.positives, tp: r.tp, fp: r.fp, fn: r.fn, precision: r.precision, recall: r.recall })),
  } : null,
  parser: null as null,
  parserNote: 'Parser metrics (PDF text vs photo OCR) are not measured yet.',
};
mkdirSync(join(repo, 'app', 'public'), { recursive: true });
writeFileSync(join(repo, 'app', 'public', 'scoreboard.json'), JSON.stringify(scoreboard, null, 1) + '\n');

mkdirSync(join(root, 'reports'), { recursive: true });

const pct = (n: number | null) => (n == null ? '-' : n.toFixed(2));
function render(e: typeof ev, version: string, engineCommit: string, note: string) {
  const rows = e.rules.map((r) => `| ${r.ruleId} | ${r.positives} | ${r.tp} | ${r.fp} | ${r.fn} | ${pct(r.precision)} | ${pct(r.recall)} | ${pct(r.f1)} | ${r.fpPerCleanBill.toFixed(2)} | ${r.shipAs} |`);
  const table = ['| Rule | Labels | TP | FP | FN | Precision | Recall | F1 | FP/clean bill | Ship as |', '|---|---|---|---|---|---|---|---|---|---|', ...rows,
    `| **All** | ${e.overall.tp + e.overall.fn} | ${e.overall.tp} | ${e.overall.fp} | ${e.overall.fn} | ${pct(e.overall.precision)} | ${pct(e.overall.recall)} | ${pct(e.overall.f1)} | ${e.overall.fpPerCleanBill.toFixed(2)} | |`].join('\n');
  const causes = e.rules.filter((r) => r.fp || r.fn).map((r) => {
    const ex = e.confusion[r.ruleId]!;
    const fpEx = ex.falsePositives.slice(0, 2).map((x) => `    - ${x.bill} (${x.kind}) lines ${x.lineIds.join(',') || '-'}: ${x.detail.slice(0, 160)}`).join('\n');
    const fnEx = ex.misses.slice(0, 2).map((x) => `    - ${x.bill} (${x.kind}) lines ${x.lineIds.join(',') || '-'}: ${x.detail}`).join('\n');
    return `### ${r.ruleId}: P ${pct(r.precision)} / R ${pct(r.recall)}\n- FP causes: ${r.topFalsePositiveCauses.map(([c, n]) => `${c} ×${n}`).join(', ') || 'none'}\n${fpEx}\n- Miss causes: ${r.topMissCauses.map(([c, n]) => `${c} ×${n}`).join(', ') || 'none'}\n${fnEx}`;
  }).join('\n\n');
  writeFileSync(join(root, 'reports', `confusion-${version}.json`), JSON.stringify({ engineCommit, rules: e.rules, confusion: e.confusion }, null, 1) + '\n');
  writeFileSync(join(root, 'reports', `scoreboard-${version}.md`), `# Finecomb corpus ${version} scoreboard (engine ${engineCommit}, ${TODAY})\n\n${e.bills} bills, ${e.clean} clean. Synthetic bills; real-world accuracy may be lower.${note}\n\n${table}\n\n## Confusion (worst first)\n\n${causes || 'No false positives or misses.'}\n`);
  return table;
}
const table = render(ev, CORPUS_VERSION, scoreboard.engineCommit, '');
if (hev) {
  render(hev, HOLDOUT_VERSION, scoreboard.engineCommit, ' Hold-out: a different seed of the same generator and labeler, never tuned against; the published scoreboard stays on v1.');
  console.log(`hold-out (${hev.bills} bills): precision ${pct(hev.overall.precision)}, recall ${pct(hev.overall.recall)}, FP/clean bill ${hev.overall.fpPerCleanBill.toFixed(2)}`);
}
console.log(table);
