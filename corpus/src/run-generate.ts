import { CORPUS_DIR, generateCorpus, writeCorpus } from './generate.js';

const m = writeCorpus(generateCorpus(), CORPUS_DIR);
console.log(JSON.stringify({ bills: m.bills, clean: m.clean, labels: m.labels, labelsByRule: m.labelsByRule, hardNegatives: m.hardNegatives }, null, 1));
