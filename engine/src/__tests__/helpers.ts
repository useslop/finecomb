import type { Bill, BillHeader, BillLine, Context } from '../types.js';

let counter = 0;

export function line(partial: Partial<BillLine> & { amount: number }): BillLine {
  counter++;
  return { id: `L${counter}`, description: 'Item', ...partial };
}

export function bill(lines: BillLine[], header: BillHeader = {}, confirmed = true): Bill {
  return { header, lines, confirmed };
}

export function ctx(partial: Partial<Context> = {}): Context {
  return { today: '2026-10-01', ...partial };
}
