import { parseBill, parseText } from './parse';
import type { IngestInput, IngestResult, PositionedItem } from './types';

export type { IngestInput, IngestResult } from './types';

/**
 * PDF.js and tesseract.js (and its self-hosted worker/core/eng assets) are dynamically
 * imported so they never load until a user actually submits a PDF or photo.
 */
export async function ingest({ text, files }: IngestInput): Promise<IngestResult> {
  const warnings: string[] = [];

  if (files && files.length > 0) {
    const items: PositionedItem[] = [];
    let pageOffset = 0;
    for (const file of files) {
      const kind = detectKind(file);
      if (kind === 'pdf') {
        const { extractPdfItems } = await import('./pdf');
        const { ocrCanvas } = await import('./ocr');
        const pdfItems = await extractPdfItems(file, warnings, ocrCanvas);
        let maxPage = 0;
        for (const it of pdfItems) {
          items.push({ ...it, page: it.page + pageOffset });
          if (it.page > maxPage) maxPage = it.page;
        }
        pageOffset += maxPage;
      } else if (kind === 'image') {
        const { ocrFile } = await import('./ocr');
        const imgItems = await ocrFile(file, warnings);
        for (const it of imgItems) items.push({ ...it, page: it.page + pageOffset });
        pageOffset += 1;
      } else {
        warnings.push(`${file.name}: unsupported file type, skipped. Use a PDF or a photo (JPG/PNG).`);
      }
    }
    const result = parseBill(items);
    return { bill: result.bill, warnings: [...warnings, ...result.warnings] };
  }

  if (text && text.trim().length > 0) {
    const result = parseText(text);
    return { bill: result.bill, warnings: [...warnings, ...result.warnings] };
  }

  return { bill: { header: {}, lines: [], confirmed: false }, warnings };
}

function detectKind(file: File): 'pdf' | 'image' | 'other' {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return 'other';
}
