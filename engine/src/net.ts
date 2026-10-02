import type { Bill, BillLine } from './types.js';
import { modsKey, normDesc } from './lib/util.js';

// Credit and reversal netting: the shared pre-pass every line rule judges against.
// A credit is any line with a negative amount, whatever the sign of its quantity ("1 x 45.00 = (45.00)"
// and "-1 x 45.00 = (45.00)" are both reversals). Each credit is paired with one original charge for the
// same item (code, else description without "CR"/"REV"/"CANCEL"-style markers), the same modifiers, the
// same |quantity| and the same |amount|; a same-date original wins, else the nearest earlier one (credits
// often post days later). A charge that is fully reversed is not a duplicate, a math error, a canceled
// item still billed or an MUE overage.

export interface NetPair { credit: BillLine; original: BillLine }
export interface NetResult {
  /** Positive charges still standing after reversals (bill order). */
  charges: BillLine[];
  /** Each credit and the original charge it reverses. */
  pairs: NetPair[];
  /** Credits that matched no original (partial or unexplained credits). */
  unmatchedCredits: BillLine[];
  /** Ids of every line consumed by a pair, credit and original alike. */
  reversedIds: Set<string>;
}

const CREDIT_MARKERS = /\b(cr|credit|rev|reversal|reversed|reverse|cancel|canceled|cancelled|void|voided|adj|adjustment)\b/g;

export const isCredit = (l: BillLine): boolean => l.amount < 0;

const cents = (n: number) => Math.round(Math.abs(n) * 100);
const descKey = (l: BillLine) => normDesc(l.description).replace(CREDIT_MARKERS, ' ').replace(/\s+/g, ' ').trim();

function sameItem(a: BillLine, b: BillLine): boolean {
  if (a.code && b.code) return a.code.trim().toUpperCase() === b.code.trim().toUpperCase();
  if (a.ndc && b.ndc) return a.ndc === b.ndc;
  return descKey(a) === descKey(b);
}

function reverses(credit: BillLine, original: BillLine): boolean {
  return sameItem(credit, original)
    && modsKey(credit.modifiers) === modsKey(original.modifiers)
    && Math.abs(credit.qty ?? 1) === Math.abs(original.qty ?? 1)
    && cents(credit.amount) === cents(original.amount);
}

export function netLines(lines: BillLine[]): NetResult {
  const used = new Set<BillLine>();
  const pairs: NetPair[] = [];
  const unmatchedCredits: BillLine[] = [];
  for (const credit of lines) {
    if (!isCredit(credit)) continue;
    const cands = lines.filter((o) => o.amount > 0 && !used.has(o) && reverses(credit, o));
    // Prefer the same date, then the latest original dated on or before the credit, then anything left.
    // Within a tier the last-listed original goes first, so the first-listed copy of a charge stands.
    const sameDate = cands.filter((o) => credit.date && o.date === credit.date);
    const earlier = cands.filter((o) => credit.date && o.date && o.date <= credit.date)
      .sort((x, y) => (x.date! < y.date! ? -1 : x.date! > y.date! ? 1 : 0));
    const original = sameDate.at(-1) ?? earlier.at(-1) ?? cands.at(-1);
    if (!original) { unmatchedCredits.push(credit); continue; }
    used.add(original);
    pairs.push({ credit, original });
  }
  const reversedIds = new Set<string>();
  for (const p of pairs) { reversedIds.add(p.credit.id); reversedIds.add(p.original.id); }
  return { charges: lines.filter((l) => l.amount > 0 && !used.has(l)), pairs, unmatchedCredits, reversedIds };
}

// analyze() runs the pre-pass once per bill; a rule called on its own (tests, tools) nets on demand.
let active: { lines: BillLine[]; result: NetResult } | null = null;

export function netted(bill: Bill): NetResult {
  return active && active.lines === bill.lines ? active.result : netLines(bill.lines);
}

export function withNetting<T>(bill: Bill, fn: () => T): T {
  const prev = active;
  active = { lines: bill.lines, result: netLines(bill.lines) };
  try { return fn(); } finally { active = prev; }
}

/** Units of a group after reversals: credits subtract their |quantity|. */
export function netUnits(lines: BillLine[]): number {
  return lines.reduce((a, l) => a + (isCredit(l) ? -Math.abs(l.qty ?? 1) : (l.qty ?? 1)), 0);
}
