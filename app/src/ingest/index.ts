import type { Bill } from '../types/engine';

// STUB — lane B5 owns app/src/ingest/ and will replace this with real PDF text-layer
// extraction (pdf.js) and photo OCR (tesseract.js). This fallback only handles pasted text,
// one line per row: `date<tab-or-comma>description<tab-or-comma>...<tab-or-comma>amount`.
// Keep the interface stable so the rest of the app (Step1AddBill) doesn't need to change.

export interface IngestInput {
  text?: string;
  files?: File[];
}
export interface IngestResult {
  bill: Bill;
  warnings: string[];
}

export async function ingest({ text, files }: IngestInput): Promise<IngestResult> {
  const warnings: string[] = [];

  if (files && files.length > 0) {
    warnings.push(
      `${files.length} file(s) selected, but PDF/photo parsing isn't wired up yet. Paste the bill text instead, or enter lines manually in the next step.`,
    );
  }

  const lines = parseText(text ?? '', warnings);

  return { bill: { header: {}, lines, confirmed: false }, warnings };
}

const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

function parseText(text: string, warnings: string[]): Bill['lines'] {
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const lines: Bill['lines'] = [];

  rows.forEach((row, i) => {
    const cells = row
      .split(/\t|,\s*/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) return;

    const lastCell = cells[cells.length - 1];
    if (lastCell === undefined) return;
    const amount = parseMoney(lastCell);
    if (amount === null) {
      warnings.push(`Line ${i + 1}: couldn't find a dollar amount, skipped. Add it manually in the next step.`);
      return;
    }

    const firstCell = cells[0];
    const looksLikeDate = cells.length > 2 && firstCell !== undefined && DATE_RE.test(firstCell);
    const descCells = looksLikeDate ? cells.slice(1, -1) : cells.slice(0, -1);

    lines.push({
      id: `line-${i + 1}`,
      date: looksLikeDate ? firstCell : undefined,
      description: descCells.join(' ') || `Line ${i + 1}`,
      amount,
    });
  });

  return lines;
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
