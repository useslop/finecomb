import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateCorpus, PRECISION_FLOOR } from './evaluate.js';
import { CORPUS_DIR, CORPUS_VERSION, HOLDOUT_DIR, HOLDOUT_VERSION, TODAY } from './generate.js';
import type { CorpusItem } from './types.js';
import { loadHandmade } from './handmade.js';

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
// Hand-made set (Q1): real-world formats, labels written before the engine ran. `blind` is the engine before the
// fixes that set prompted (committed report); `current` is this engine.
const handmadeItems = existsSync(join(root, 'data', 'handmade', 'manifest.json')) ? loadHandmade() : [];
const hmev = handmadeItems.length ? evaluateCorpus(handmadeItems) : null;
const blindPath = join(root, 'reports', 'scoreboard-handmade-blind.json');
const hmBlind = existsSync(blindPath) ? JSON.parse(readFileSync(blindPath, 'utf8')) : null;
// Rules that misfired on the blind hand-made run ship capped at Low until a NEW hand-made set, written by someone
// other than whoever fixed them, passes. The fixes are in; one person's 15 bills are not enough to trust them.
const OVERRIDES: Record<string, { shipAs: 'low' | 'off'; reason: string }> = {
  'DUP-01': { shipAs: 'low', reason: 'Hand-made bills: flagged two routine repeat doses as identical at High. Fixed (repeat doses are Medium); capped at Low until re-tested.' },
  'GFE-01': { shipAs: 'low', reason: "Hand-made bills: compared one provider's Good Faith Estimate with another provider's bill. Fixed; capped at Low until re-tested." },
  'NCCI-01': { shipAs: 'low', reason: 'Hand-made bills: flagged an office visit whose modifier the statement left off. Now Low for that case; not run here anyway.' },
  'MUE-01': { shipAs: 'low', reason: 'Hand-made bills: judged a facility bill by the doctor-office limit when revenue codes were missing. Not run here anyway.' },
};
const RANK_SHIP = { 'as-specified': 0, untested: 0, low: 1, off: 2 } as const;
const scoredOn = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const git = (cmd: string) => { try { return execSync(cmd, { cwd: repo, encoding: 'utf8' }).trim(); } catch { return 'unknown'; } };

const scoreboard = {
  schema: 1,
  generated: scoredOn,
  corpusDate: TODAY,
  commit: git('git rev-parse --short HEAD'),
  engineCommit: git('git log -1 --format=%h -- engine'),
  corpusVersion: CORPUS_VERSION,
  corpus: { bills: ev.bills, clean: ev.clean, byKind: manifest.byKind, labels: ev.rules.reduce((s, r) => s + r.positives, 0), seed: manifest.seed },
  caveat: 'synthetic bills; real-world accuracy may be lower',
  method: 'Each synthetic bill is generated with planted errors and look-alike traps, labeled from the rule spec by a separate labeler, then checked by the same engine the app runs. A finding counts as correct when it points at the labeled lines. The engine has since been tuned to the same reading of the spec, so 100% here means the checks match their spec on synthetic bills, not that they are right on real bills. The hand-made bills below are the more honest test.',
  precisionFloor: PRECISION_FLOOR,
  shipAsKey: { 'as-specified': `precision >= ${PRECISION_FLOOR}`, low: 'precision 0.6-0.9: show as Low confidence', off: 'precision < 0.6: keep off until fixed', untested: 'no positives or findings in the corpus' },
  overall: ev.overall,
  rules: ev.rules.map(({ topFalsePositiveCauses, topMissCauses, ...r }) => ({
    ...r,
    ...(OVERRIDES[r.ruleId] && RANK_SHIP[OVERRIDES[r.ruleId]!.shipAs] > RANK_SHIP[r.shipAs]
      ? { shipAs: OVERRIDES[r.ruleId]!.shipAs, corpusShipAs: r.shipAs, shipAsReason: OVERRIDES[r.ruleId]!.reason } : {}),
    mainFalsePositiveCause: topFalsePositiveCauses[0]?.[0].replace(/^(hn|variant):/, '') ?? null,
    mainMissCause: topMissCauses[0]?.[0].replace(/^plant:[A-Z0-9-]+:?/, '') || (topMissCauses[0] ? 'planted case' : null),
  })),
  holdout: hev && hold ? {
    corpusVersion: HOLDOUT_VERSION, seed: hold.manifest.seed, bills: hev.bills, clean: hev.clean,
    note: 'Same generator and labeler, different seed; never tuned against. Agreement with the spec reading, not real-world accuracy.',
    overall: hev.overall,
    rules: hev.rules.map((r) => ({ ruleId: r.ruleId, positives: r.positives, tp: r.tp, fp: r.fp, fn: r.fn, precision: r.precision, recall: r.recall })),
  } : null,
  handmade: hmev ? {
    bills: hmev.bills, clean: hmev.clean, labels: hmev.rules.reduce((s, r) => s + r.positives, 0),
    note: '15 bills written by hand by the QA lane in real-world formats (UB-04-style hospital statement, ED facility and physician bills, a pharmacy-heavy stay, credits and reversals, Medicaid, uninsured with a Good Faith Estimate, an out-of-network anesthesiologist, collections). Expected findings were written and committed before the engine ran on them. Still synthetic: no real patient bills.',
    blind: hmBlind ? { engineCommit: hmBlind.engineCommit, overall: hmBlind.overall, rules: hmBlind.rules, falsePositives: hmBlind.falsePositives, misses: hmBlind.misses } : null,
    current: { overall: hmev.overall, rules: hmev.rules.filter((r) => r.positives || r.findings).map((r) => ({ ruleId: r.ruleId, positives: r.positives, tp: r.tp, fp: r.fp, fn: r.fn, precision: r.precision, recall: r.recall })) },
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
