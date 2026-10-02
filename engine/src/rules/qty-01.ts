import type { Bill, BillLine, Context, Datasets, Finding } from '../types.js';
import { daysBetween, mkFinding, round2 } from '../lib/util.js';
import { netted } from '../net.js';

export const id = 'QTY-01';

const HOURLY = /\bhour(ly)?\b|\/\s*hr\b/i;
const KIT = /\bkit\b/i;
const PER_DAY = /\b(telemetry|daily monitoring|per day)\b/i;

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[] } {
  const findings: Finding[] = [];
  const charges = netted(bill).charges;

  const byDate = new Map<string, BillLine[]>();
  for (const l of charges) {
    if (!l.date || !HOURLY.test(l.description)) continue;
    const arr = byDate.get(l.date) ?? [];
    arr.push(l);
    byDate.set(l.date, arr);
  }
  for (const [date, group] of byDate) {
    const units = group.reduce((a, l) => a + (l.qty ?? 1), 0);
    if (units <= 24) continue;
    const priced = group.find((l) => l.unitPrice != null);
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: `hourly:${date}`,
        title: 'More than 24 hourly units on one day',
        why: `${units} hourly units were billed on ${date}.`,
        userText: `This is charged ${units} times, but there are only 24 hours in a day.`,
        verify: 'Ask for the time log supporting this many hourly units.',
        evidenceLineIds: group.map((l) => l.id),
        confidence: 'medium',
        dollarsAtStake: priced ? round2((units - 24) * priced.unitPrice!) : null,
        citations: [],
      }),
    );
  }

  const kitLines = charges.filter((l) => KIT.test(l.description));
  const totalKitQty = kitLines.reduce((a, l) => a + (l.qty ?? 1), 0);
  if (kitLines.length > 0 && totalKitQty > 1) {
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: `kit:${kitLines.map((l) => l.id).join(',')}`,
        title: 'A per-stay kit was billed more than once',
        why: `${totalKitQty} units of a per-stay kit item were billed.`,
        userText: `This is charged ${totalKitQty} times, but a kit like this is normally a one-time charge per stay.`,
        verify: 'Ask whether this kit is meant to be billed once per stay.',
        evidenceLineIds: kitLines.map((l) => l.id),
        confidence: 'medium',
        dollarsAtStake: kitLines[0]!.unitPrice != null ? round2((totalKitQty - 1) * kitLines[0]!.unitPrice!) : null,
        citations: [],
      }),
    );
  }

  if (ctx.admitted === true && bill.header.admitDate && bill.header.dischargeDate) {
    const nights = Math.max(1, daysBetween(bill.header.admitDate, bill.header.dischargeDate));
    const perDayLines = charges.filter((l) => PER_DAY.test(l.description));
    const totalPerDayQty = perDayLines.reduce((a, l) => a + (l.qty ?? 1), 0);
    if (perDayLines.length > 0 && totalPerDayQty > nights) {
      findings.push(
        mkFinding({
          ruleId: id,
          discriminator: `perday:${perDayLines.map((l) => l.id).join(',')}`,
          title: 'A per-day item is billed more times than your stay lasted',
          why: `${totalPerDayQty} units were billed, but your stay was ${nights} day(s).`,
          userText: `This is charged ${totalPerDayQty} times, but your stay was ${nights} day(s).`,
          verify: 'Ask for the daily record supporting this quantity.',
          evidenceLineIds: perDayLines.map((l) => l.id),
          confidence: 'medium',
          dollarsAtStake: perDayLines[0]!.unitPrice != null
            ? round2((totalPerDayQty - nights) * perDayLines[0]!.unitPrice!)
            : null,
          citations: [],
        }),
      );
    }
  }

  return { findings };
}
