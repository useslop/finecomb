import type { Bill, Context, Datasets, Finding } from '../types.js';
import { CANCEL_KEYWORDS, mkFinding, netCredits } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'CANC-01';

export function evaluate(bill: Bill, _ctx: Context, _data: Datasets): { findings: Finding[] } {
  const findings: Finding[] = [];
  const marked = bill.lines.filter((l) => l.notReceived === true);
  for (const l of marked) {
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: l.id,
        title: 'Marked as not received',
        why: 'You indicated you did not receive this item or service.',
        userText: 'You marked this as not received.',
        verify: 'Ask for the Medication Administration Record or chart note confirming this was given.',
        evidenceLineIds: [l.id],
        confidence: 'medium',
        dollarsAtStake: l.amount,
        citations: cite('S15', 'S16'),
      }),
    );
  }

  const survivors = new Set(netCredits(bill.lines).map((l) => l.id));
  const markedIds = new Set(marked.map((l) => l.id));
  for (const l of bill.lines) {
    if (markedIds.has(l.id) || l.amount <= 0) continue;
    if (!CANCEL_KEYWORDS.test(l.description)) continue;
    if (!survivors.has(l.id)) continue; // already reversed by a credit
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: l.id,
        title: 'Description mentions a cancellation',
        why: `"${l.description}" suggests this may have been canceled, not given, or returned.`,
        userText: 'This line mentions a cancellation. Ask whether it should be removed.',
        verify: 'Ask for the medical record confirming whether this was given.',
        evidenceLineIds: [l.id],
        confidence: 'low',
        dollarsAtStake: l.amount,
        citations: cite('S15', 'S16'),
      }),
    );
  }
  return { findings };
}
