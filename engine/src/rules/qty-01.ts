import type { Bill, BillLine, Context, Datasets, Finding } from '../types.js';
import { daysBetween, isRoomLine, lineKey, mkFinding, round2 } from '../lib/util.js';
import { netted } from '../net.js';

export const id = 'QTY-01';

// Counts are per item, never pooled across items: IV hydration hours and observation hours on the same
// date are two clocks, and oxygen and telemetry are two per-day items.
const HOURLY = /\bPER\s+HOUR\b|\bHOURLY\b|\b(ADDL|ADDITIONAL|EA|EACH)\s+(ADDL\s+)?HOUR\b|\bPER\s+HR\b|\/\s*HR\b/i;
// Only an admission kit is one-per-stay; IV start kits, dressing kits and the like are used as needed.
const PER_STAY_KIT = /\b(ADMISSION|ADMIT)\s+(KIT|PACK)\b/i;
const PER_DAY = /\bPER\s+DAY\b|\bDAILY\s+MONITORING\b/i;

function groupBy(lines: BillLine[], key: (l: BillLine) => string): Map<string, BillLine[]> {
  const m = new Map<string, BillLine[]>();
  for (const l of lines) {
    const k = key(l);
    const arr = m.get(k) ?? [];
    arr.push(l);
    m.set(k, arr);
  }
  return m;
}

const units = (ls: BillLine[]) => ls.reduce((a, l) => a + (l.qty ?? 1), 0);

export function evaluate(bill: Bill, ctx: Context, _data: Datasets): { findings: Finding[] } {
  const findings: Finding[] = [];
  const charges = netted(bill).charges;

  const hourly = charges.filter((l) => l.date && HOURLY.test(l.description));
  for (const [key, group] of groupBy(hourly, (l) => `${l.date}|${lineKey(l)}`)) {
    const n = units(group);
    if (n <= 24) continue;
    const date = group[0]!.date!;
    const priced = group.find((l) => l.unitPrice != null);
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: `hourly:${key}`,
        title: 'More than 24 hourly units on one day',
        why: `${n} hourly units of "${group[0]!.description}" were billed on ${date}.`,
        userText: `This is charged ${n} times, but there are only 24 hours in a day.`,
        verify: 'Ask for the time log supporting this many hourly units.',
        evidenceLineIds: group.map((l) => l.id),
        confidence: 'medium',
        dollarsAtStake: priced ? round2((n - 24) * priced.unitPrice!) : null,
        citations: [],
      }),
    );
  }

  const kitLines = charges.filter((l) => PER_STAY_KIT.test(l.description));
  const totalKitQty = units(kitLines);
  if (totalKitQty > 1) {
    findings.push(
      mkFinding({
        ruleId: id,
        discriminator: `kit:${kitLines.map((l) => l.id).join(',')}`,
        title: 'A per-stay kit was billed more than once',
        why: `${totalKitQty} units of an admission kit were billed.`,
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
    const perDay = charges.filter((l) => PER_DAY.test(l.description) && !isRoomLine(l)); // room days are RB-01's
    for (const [key, group] of groupBy(perDay, lineKey)) {
      const n = units(group);
      if (n <= nights) continue;
      const priced = group.find((l) => l.unitPrice != null);
      findings.push(
        mkFinding({
          ruleId: id,
          discriminator: `perday:${key}:${group.map((l) => l.id).join(',')}`,
          title: 'A per-day item is billed more times than your stay lasted',
          why: `${n} units of "${group[0]!.description}" were billed, but your stay was ${nights} day(s).`,
          userText: `This is charged ${n} times, but your stay was ${nights} day(s).`,
          verify: 'Ask for the daily record supporting this quantity.',
          evidenceLineIds: group.map((l) => l.id),
          confidence: 'medium',
          dollarsAtStake: priced ? round2((n - nights) * priced.unitPrice!) : null,
          citations: [],
        }),
      );
    }
  }

  return { findings };
}
