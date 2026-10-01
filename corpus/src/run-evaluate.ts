import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCorpus, PRECISION_FLOOR } from './evaluate.js';
import { CORPUS_DIR, CORPUS_VERSION, TODAY } from './generate.js';
import type { CorpusItem } from './types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..');
const manifest = JSON.parse(readFileSync(join(CORPUS_DIR, 'manifest.json'), 'utf8')) as { files: string[]; seed: number; byKind: Record<string, number> };
const items = manifest.files.map((f) => JSON.parse(readFileSync(join(CORPUS_DIR, f), 'utf8')) as CorpusItem);
const ev = evaluateCorpus(items);
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
  parser: null as null,
  parserNote: 'Parser metrics (PDF text vs photo OCR) are not measured yet.',
};
mkdirSync(join(repo, 'app', 'public'), { recursive: true });
writeFileSync(join(repo, 'app', 'public', 'scoreboard.json'), JSON.stringify(scoreboard, null, 1) + '\n');

mkdirSync(join(root, 'reports'), { recursive: true });
writeFileSync(join(root, 'reports', `confusion-${CORPUS_VERSION}.json`), JSON.stringify({ engineCommit: scoreboard.engineCommit, rules: ev.rules, confusion: ev.confusion }, null, 1) + '\n');

const pct = (n: number | null) => (n == null ? '-' : n.toFixed(2));
const rows = ev.rules.map((r) => `| ${r.ruleId} | ${r.positives} | ${r.tp} | ${r.fp} | ${r.fn} | ${pct(r.precision)} | ${pct(r.recall)} | ${pct(r.f1)} | ${r.fpPerCleanBill.toFixed(2)} | ${r.shipAs} |`);
const table = ['| Rule | Labels | TP | FP | FN | Precision | Recall | F1 | FP/clean bill | Ship as |', '|---|---|---|---|---|---|---|---|---|---|', ...rows,
  `| **All** | ${ev.overall.tp + ev.overall.fn} | ${ev.overall.tp} | ${ev.overall.fp} | ${ev.overall.fn} | ${pct(ev.overall.precision)} | ${pct(ev.overall.recall)} | ${pct(ev.overall.f1)} | ${ev.overall.fpPerCleanBill.toFixed(2)} | |`].join('\n');
const causes = ev.rules.filter((r) => r.fp || r.fn).map((r) => {
  const ex = ev.confusion[r.ruleId]!;
  const fpEx = ex.falsePositives.slice(0, 2).map((e) => `    - ${e.bill} (${e.kind}) lines ${e.lineIds.join(',') || '-'}: ${e.detail.slice(0, 160)}`).join('\n');
  const fnEx = ex.misses.slice(0, 2).map((e) => `    - ${e.bill} (${e.kind}) lines ${e.lineIds.join(',') || '-'}: ${e.detail}`).join('\n');
  return `### ${r.ruleId}: P ${pct(r.precision)} / R ${pct(r.recall)}\n- FP causes: ${r.topFalsePositiveCauses.map(([c, n]) => `${c} ×${n}`).join(', ') || 'none'}\n${fpEx}\n- Miss causes: ${r.topMissCauses.map(([c, n]) => `${c} ×${n}`).join(', ') || 'none'}\n${fnEx}`;
}).join('\n\n');
writeFileSync(join(root, 'reports', `scoreboard-${CORPUS_VERSION}.md`), `# Finecomb corpus ${CORPUS_VERSION} scoreboard (engine ${scoreboard.engineCommit}, ${TODAY})\n\n${ev.bills} bills, ${ev.clean} clean. Synthetic bills; real-world accuracy may be lower.\n\n${table}\n\n## Confusion (worst first)\n\n${causes}\n`);
console.log(table);
