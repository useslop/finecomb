import { generateHoldout, HOLDOUT_DIR, HOLDOUT_SEED, HOLDOUT_VERSION, writeCorpus } from './generate.js';

const m = writeCorpus(generateHoldout(), HOLDOUT_DIR, { version: HOLDOUT_VERSION, seed: HOLDOUT_SEED });
console.log(JSON.stringify({ bills: m.bills, clean: m.clean, labels: m.labels, labelsByRule: m.labelsByRule, hardNegatives: m.hardNegatives }, null, 1));
