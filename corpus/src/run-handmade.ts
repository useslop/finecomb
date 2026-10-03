// Q1 (2026-10-02): scores the hand-made set (corpus/data/handmade) and prints every finding per bill, so a human
// can judge each one (correct / overclaimed / missing). `npm run evaluate:handmade -w corpus`
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze } from '@finecomb/engine';
import { evaluateCorpus } from './evaluate.js';
import type { CorpusItem } from './types.js';
import { HANDMADE_DIR, loadHandmade } from './handmade.js';
import { toDatasets } from './types.js';

const items = loadHandmade();
for (const item of items) {
  const r = analyze(item.bill, item.ctx, toDatasets(item.data));
  console.log(`\n${item.id} (${(item as CorpusItem & { format?: string }).format}) labels: ${item.labels.map((l) => `${l.ruleId}${l.optional ? '?' : ''}[${l.lineIds.join(',')}]`).join(' ') || 'clean'}`);
  for (const f of r.findings) console.log(`  F ${f.ruleId} ${f.confidence} $${f.dollarsAtStake ?? '-'} [${f.evidenceLineIds.join(',')}] ${f.userText.slice(0, 150)}`);
  for (const c of r.infoCards) console.log(`  I ${c.ruleId} ${c.userText.slice(0, 120)}`);
  console.log(`  skipped: ${r.skipped.map((s) => s.ruleId).join(', ')}`);
}
const ev = evaluateCorpus(items);
console.log(`\nOVERALL tp ${ev.overall.tp} fp ${ev.overall.fp} fn ${ev.overall.fn} precision ${ev.overall.precision} recall ${ev.overall.recall}`);
for (const r of ev.rules) if (r.positives || r.findings) console.log(`${r.ruleId}: labels ${r.positives} findings ${r.findings} tp ${r.tp} fp ${r.fp} fn ${r.fn} P ${r.precision} R ${r.recall}`);
for (const [id, c] of Object.entries(ev.confusion)) {
  for (const x of c.falsePositives) console.log(`FP ${id} ${x.bill} [${x.lineIds}] ${x.detail.slice(0, 140)}`);
  for (const x of c.misses) console.log(`FN ${id} ${x.bill} [${x.lineIds}] ${x.detail}`);
}


// Saved for the scoreboard: `-- --blind` records the engine as it was before any fix this set prompted.
const blind = process.argv.includes('--blind');
const engineCommit = (() => { try { return execSync('git log -1 --format=%h -- ../engine', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
const dirty = (() => { try { return execSync('git status --porcelain -- ../engine', { encoding: 'utf8' }).trim() !== ''; } catch { return false; } })();
mkdirSync(join(HANDMADE_DIR, '..', '..', 'reports'), { recursive: true });
writeFileSync(join(HANDMADE_DIR, '..', '..', 'reports', `scoreboard-handmade${blind ? '-blind' : ''}.json`), JSON.stringify({
  engineCommit: dirty ? `${engineCommit}+uncommitted` : engineCommit, bills: ev.bills, clean: ev.clean, overall: ev.overall,
  rules: ev.rules.filter((r) => r.positives || r.findings).map((r) => ({ ruleId: r.ruleId, positives: r.positives, tp: r.tp, fp: r.fp, fn: r.fn, precision: r.precision, recall: r.recall })),
  falsePositives: Object.entries(ev.confusion).flatMap(([id, c]) => c.falsePositives.map((x) => ({ ruleId: id, bill: x.bill, detail: x.detail.slice(0, 200) }))),
  misses: Object.entries(ev.confusion).flatMap(([id, c]) => c.misses.map((x) => ({ ruleId: id, bill: x.bill, detail: x.detail }))),
}, null, 1) + '\n');
