import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { mkFinding, round2, sum } from '../lib/util.js';

export const id = 'MATH-02';

export function evaluate(bill: Bill, _ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const { header, lines } = bill;
  const findings: Finding[] = [];
  let ranAny = false;

  if (header.totalCharges != null) {
    ranAny = true;
    const total = sum(lines.map((l) => l.amount));
    const diff = round2(Math.abs(total - header.totalCharges));
    if (diff > 0.01) {
      findings.push(
        mkFinding({
          ruleId: id,
          discriminator: 'lines-vs-total',
          title: "Line items don't add up to the printed total",
          why: `The lines sum to $${total.toFixed(2)}, but the bill's total charges are $${header.totalCharges.toFixed(2)}.`,
          userText: `The bill's totals don't add up by $${diff.toFixed(2)}.`,
          verify: 'Ask for a full, itemized statement and re-check every page was included.',
          evidenceLineIds: lines.map((l) => l.id),
          confidence: 'high',
          dollarsAtStake: diff,
          citations: [],
        }),
      );
    }
  }

  if (header.totalCharges != null && header.payments != null && header.adjustments != null && header.balanceDue != null) {
    ranAny = true;
    const expectedBalance = round2(header.totalCharges - header.payments - header.adjustments);
    const diff = round2(Math.abs(expectedBalance - header.balanceDue));
    if (diff > 0.01) {
      findings.push(
        mkFinding({
          ruleId: id,
          discriminator: 'balance-equation',
          title: "Charges minus payments and adjustments don't equal the balance due",
          why: `$${header.totalCharges.toFixed(2)} − $${header.payments.toFixed(2)} − $${header.adjustments.toFixed(2)} = $${expectedBalance.toFixed(2)}, but the balance due is $${header.balanceDue.toFixed(2)}.`,
          userText: `The bill's totals don't add up by $${diff.toFixed(2)}.`,
          verify: 'Ask the billing office to show how the balance due was calculated.',
          evidenceLineIds: [],
          confidence: 'high',
          dollarsAtStake: diff,
          citations: [],
        }),
      );
    }
  }

  if (!ranAny) {
    return {
      findings: [],
      skipped: { ruleId: id, needs: ['the bill totals (total charges, payments, adjustments, balance due)'] },
    };
  }
  return { findings };
}
