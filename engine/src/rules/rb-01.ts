import type { Bill, Context, Datasets, Finding, Skipped } from '../types.js';
import { daysBetween, isRoomLine, mkFinding, round2 } from '../lib/util.js';
import { cite } from '../citations.js';

export const id = 'RB-01';

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[]; skipped?: Skipped } {
  const { admitDate, dischargeDate } = bill.header;
  if (!admitDate || !dischargeDate) {
    return { findings: [], skipped: { ruleId: id, needs: ['admission and discharge dates'] } };
  }
  const roomLines = bill.lines.filter(isRoomLine);
  if (roomLines.length === 0) return { findings: [] };

  const nights = Math.max(1, daysBetween(admitDate, dischargeDate));
  const totalUnits = roomLines.reduce((a, l) => a + (l.qty ?? 1), 0);
  if (totalUnits <= nights) return { findings: [] };

  const sorted = [...roomLines].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const last = sorted[sorted.length - 1]!;
  const rate = last.unitPrice ?? (last.qty ? last.amount / last.qty : last.amount);
  const extraDays = totalUnits - nights;
  const extraCost = round2(extraDays * rate);

  return {
    findings: [
      mkFinding({
        ruleId: id,
        discriminator: roomLines.map((l) => l.id).join(','),
        title: 'More room days billed than nights stayed',
        why: `${totalUnits} room-and-board units were billed for a ${nights}-night stay (${admitDate} to ${dischargeDate}).`,
        userText: `You were billed ${totalUnits} room days for ${nights} night(s). Hospitals generally don't count the day you go home. Ask them to remove the extra day(s) ($${extraCost.toFixed(2)}).`,
        verify: 'Ask the hospital to recount room days using the discharge-day exclusion and show you the daily census.',
        evidenceLineIds: roomLines.map((l) => l.id),
        confidence: ctx.insurance === 'medicare' ? 'high' : 'medium',
        dollarsAtStake: extraCost,
        citations: cite('S28'),
      }),
    ],
  };
}
