import type { Bill, BillHeader, BillLine } from '../types/engine';
import {
  DATE_RE,
  LEVEL2_CODE_RE,
  CPT_SHAPED_RE,
  REV_CODE_RE,
  NDC_RE,
  MODIFIER_RE,
  INT_RE,
  MONEY_RE,
  normalizeDate,
  normalizeNdc,
  parseMoney,
} from './regex';
import type { PositionedItem } from './types';

export interface ParseResult {
  bill: Bill;
  warnings: string[];
  stats: { lineCount: number; rowsConsidered: number };
}

const ROW_Y_TOLERANCE = 6;
const CELL_X_GAP = 14;

interface Cell {
  text: string;
  x: number;
  width: number;
  confidence?: number;
}
interface Row {
  page: number;
  y: number;
  cells: Cell[];
}

/** Plain pasted text -> synthetic positions: one row per line, cells split on 2+ spaces or tabs. */
export function textToPositions(text: string): PositionedItem[] {
  const items: PositionedItem[] = [];
  const CHAR_W = 7;
  const COL_GAP = 40; // guarantees cells never re-merge in groupRowIntoCells
  const LINE_H = 14;
  let y = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.trim().length === 0) {
      y += LINE_H;
      continue;
    }
    const cells = line
      .split(/\t| {2,}/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    let x = 0;
    for (const cell of cells) {
      const width = cell.length * CHAR_W;
      items.push({ text: cell, x, y, width, height: LINE_H, page: 1 });
      x += width + COL_GAP;
    }
    y += LINE_H;
  }
  return items;
}

export function parseText(text: string): ParseResult {
  return parseBill(textToPositions(text));
}

export function parseBill(items: PositionedItem[]): ParseResult {
  const warnings: string[] = [];
  const rows = groupRows(items);
  const header: BillHeader = {};
  const tableRows: Row[] = [];
  for (const row of rows) {
    if (tryConsumeHeaderRow(row, header)) continue;
    if (isTableHeaderRow(row)) continue;
    tableRows.push(row);
  }

  const lines: BillLine[] = [];
  tableRows.forEach((row, idx) => {
    const line = buildLine(row, idx, warnings);
    if (line) lines.push(line);
  });

  checkTotals(header, lines, warnings);

  return {
    bill: { header, lines, confirmed: false },
    warnings,
    stats: { lineCount: lines.length, rowsConsidered: tableRows.length },
  };
}

function groupRows(items: PositionedItem[]): Row[] {
  const byPage = new Map<number, PositionedItem[]>();
  for (const it of items) {
    const arr = byPage.get(it.page) ?? [];
    arr.push(it);
    byPage.set(it.page, arr);
  }
  const rows: Row[] = [];
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  for (const page of pages) {
    const pageItems = byPage.get(page) ?? [];
    const sorted = [...pageItems].sort((a, b) => a.y - b.y || a.x - b.x);
    let bucket: PositionedItem[] = [];
    let bucketY: number | null = null;
    const flush = () => {
      if (bucket.length === 0) return;
      const sortedByX = [...bucket].sort((a, b) => a.x - b.x);
      rows.push({ page, y: bucketY ?? 0, cells: groupCells(sortedByX) });
      bucket = [];
    };
    for (const it of sorted) {
      if (bucketY === null || Math.abs(it.y - bucketY) <= ROW_Y_TOLERANCE) {
        bucket.push(it);
        bucketY = bucketY === null ? it.y : bucketY;
      } else {
        flush();
        bucket.push(it);
        bucketY = it.y;
      }
    }
    flush();
  }
  return rows;
}

function groupCells(sortedByX: PositionedItem[]): Cell[] {
  const cells: Cell[] = [];
  let buf: PositionedItem[] = [];
  let prevEnd: number | null = null;
  const flush = () => {
    if (buf.length === 0) return;
    const text = buf
      .map((i) => i.text)
      .join(' ')
      .trim();
    const minX = Math.min(...buf.map((i) => i.x));
    const maxX = Math.max(...buf.map((i) => i.x + i.width));
    const confidences = buf.map((i) => i.confidence).filter((c): c is number => c !== undefined);
    cells.push({
      text,
      x: minX,
      width: maxX - minX,
      confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : undefined,
    });
    buf = [];
  };
  for (const it of sortedByX) {
    if (prevEnd !== null && it.x - prevEnd > CELL_X_GAP) flush();
    buf.push(it);
    prevEnd = it.x + it.width;
  }
  flush();
  return cells;
}

type HeaderKind = 'text' | 'date' | 'money';
const HEADER_FIELDS: { key: keyof BillHeader; re: RegExp; kind: HeaderKind }[] = [
  { key: 'patientName', re: /^patient(?:\s*name)?\s*:\s*(.+)$/i, kind: 'text' },
  { key: 'providerName', re: /^(?:provider|facility|hospital)(?:\s*name)?\s*:\s*(.+)$/i, kind: 'text' },
  { key: 'accountNumber', re: /^(?:account|acct)(?:\s*(?:number|no\.?|#))?\s*:\s*(.+)$/i, kind: 'text' },
  { key: 'admitDate', re: /^admit(?:ted|\s*date)?\s*:\s*(.+)$/i, kind: 'date' },
  { key: 'dischargeDate', re: /^discharge(?:d|\s*date)?\s*:\s*(.+)$/i, kind: 'date' },
  { key: 'statementDate', re: /^statement\s*date\s*:\s*(.+)$/i, kind: 'date' },
  { key: 'totalCharges', re: /^total\s*charges?\s*:\s*(.+)$/i, kind: 'money' },
  { key: 'payments', re: /^payments?\s*:\s*(.+)$/i, kind: 'money' },
  { key: 'adjustments', re: /^adjustments?\s*:\s*(.+)$/i, kind: 'money' },
  { key: 'balanceDue', re: /^(?:balance\s*due|amount\s*due)\s*:\s*(.+)$/i, kind: 'money' },
];

function tryConsumeHeaderRow(row: Row, header: BillHeader): boolean {
  const rowText = row.cells
    .map((c) => c.text)
    .join(' ')
    .trim();
  for (const field of HEADER_FIELDS) {
    const m = rowText.match(field.re);
    const raw = m?.[1]?.trim();
    if (!raw) continue;
    if (field.kind === 'text') {
      header[field.key as 'patientName'] = raw;
    } else if (field.kind === 'date') {
      const d = normalizeDate(raw);
      if (d) header[field.key as 'admitDate'] = d;
    } else {
      const v = parseMoney(raw);
      if (v !== null) header[field.key as 'totalCharges'] = v;
    }
    return true;
  }
  return false;
}

const TABLE_HEADER_WORDS = [
  'date',
  'code',
  'description',
  'desc',
  'qty',
  'quantity',
  'unit',
  'price',
  'amount',
  'charge',
  'rev',
  'revenue',
  'ndc',
  'modifier',
];

function isTableHeaderRow(row: Row): boolean {
  const text = row.cells
    .map((c) => c.text.toLowerCase())
    .join(' ');
  if (MONEY_RE.test(text)) return false; // real column headers carry no dollar amounts
  let hits = 0;
  for (const w of TABLE_HEADER_WORDS) {
    if (new RegExp(`\\b${w}\\b`).test(text)) hits++;
  }
  return hits >= 2;
}

function buildLine(row: Row, idx: number, warnings: string[]): BillLine | null {
  const cells = row.cells;
  let amountIdx = -1;
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (c && MONEY_RE.test(c.text)) {
      amountIdx = i;
      break;
    }
  }
  if (amountIdx === -1) {
    const text = cells
      .map((c) => c.text)
      .join(' ')
      .trim();
    if (text.length > 0) {
      warnings.push(`Row ${idx + 1}: couldn't find a dollar amount ("${text.slice(0, 60)}"), skipped. Add it manually if it's a charge.`);
    }
    return null;
  }
  const amountCell = cells[amountIdx];
  if (!amountCell) return null;
  const amount = parseMoney(amountCell.text);
  if (amount === null) return null;

  let date: string | undefined;
  let code: string | undefined;
  let revCode: string | undefined;
  let ndc: string | undefined;
  let qty: number | undefined;
  let unitPrice: number | undefined;
  const modifiers: string[] = [];
  const descParts: string[] = [];

  cells.forEach((cell, i) => {
    if (i === amountIdx) return;
    const t = cell.text.trim();
    if (!t) return;
    if (!date && DATE_RE.test(t)) {
      date = normalizeDate(t);
      return;
    }
    const upper = t.toUpperCase();
    if (!code && (LEVEL2_CODE_RE.test(upper) || CPT_SHAPED_RE.test(upper))) {
      code = upper;
      return;
    }
    if (!revCode && REV_CODE_RE.test(t)) {
      revCode = t;
      return;
    }
    if (!ndc && NDC_RE.test(t)) {
      const n = normalizeNdc(t);
      if (n) {
        ndc = n;
        return;
      }
    }
    if (code && modifiers.length < 4 && MODIFIER_RE.test(upper) && upper !== code) {
      modifiers.push(upper);
      return;
    }
    if (MONEY_RE.test(t)) {
      if (unitPrice === undefined) {
        const v = parseMoney(t);
        if (v !== null) {
          unitPrice = v;
          return;
        }
      }
    }
    if (qty === undefined && INT_RE.test(t)) {
      qty = Number(t);
      return;
    }
    descParts.push(t);
  });

  const confidences = cells.map((c) => c.confidence).filter((c): c is number => c !== undefined);
  const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : undefined;
  if (avgConfidence !== undefined && avgConfidence < 70) {
    warnings.push(`Line ${idx + 1}: low OCR confidence (${Math.round(avgConfidence)}%) — check this row against the photo.`);
  }

  const xs = cells.map((c) => c.x);
  const xe = cells.map((c) => c.x + c.width);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xe.length ? Math.max(...xe) : 0;

  const line: BillLine = {
    id: `line-${idx + 1}`,
    description: descParts.join(' ').trim() || `Line ${idx + 1}`,
    amount,
  };
  if (date) line.date = date;
  if (code) line.code = code;
  if (modifiers.length) line.modifiers = modifiers;
  if (revCode) line.revCode = revCode;
  if (ndc) line.ndc = ndc;
  if (qty !== undefined) line.qty = qty;
  if (unitPrice !== undefined) line.unitPrice = unitPrice;
  line.source = {
    page: row.page,
    bbox: [minX, row.y, maxX, row.y + 14],
    confidence: avgConfidence,
    raw: cells.map((c) => c.text).join(' '),
  };
  return line;
}

function checkTotals(header: BillHeader, lines: BillLine[], warnings: string[]): void {
  if (header.totalCharges === undefined || lines.length === 0) return;
  const sum = Math.round(lines.reduce((acc, l) => acc + l.amount, 0) * 100) / 100;
  const diff = Math.round(Math.abs(sum - header.totalCharges) * 100) / 100;
  if (diff > 0.01) {
    warnings.push(
      `The ${lines.length} line(s) add up to $${sum.toFixed(2)}, but the statement shows total charges of $${header.totalCharges.toFixed(2)} (difference $${diff.toFixed(2)}). Check for a missing, duplicated or mis-scanned line.`,
    );
  }
}
