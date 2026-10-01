import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PositionedItem } from './types';

GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';

export type OcrCanvasFn = (canvas: HTMLCanvasElement, page: number) => Promise<PositionedItem[]>;

/** Extract positioned text per page; pages with no text layer are rendered to canvas and OCR'd. */
export async function extractPdfItems(file: File, warnings: string[], ocrCanvas: OcrCanvasFn): Promise<PositionedItem[]> {
  const buf = await file.arrayBuffer();
  const doc = await getDocument({ data: buf }).promise;
  const items: PositionedItem[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageItems: PositionedItem[] = [];

    for (const raw of content.items) {
      if (!('str' in raw) || typeof raw.str !== 'string' || raw.str.trim().length === 0) continue;
      const tx = raw.transform;
      const x = Number(tx[4]) || 0;
      const yTop = viewport.height - (Number(tx[5]) || 0);
      const width = raw.width || raw.str.length * 6;
      const height = raw.height || Math.abs(Number(tx[3])) || 10;
      pageItems.push({ text: raw.str, x, y: yTop, width, height, page: pageNum });
    }

    if (pageItems.length === 0) {
      warnings.push(`Page ${pageNum}: no text layer found, reading it with OCR instead.`);
      const scale = 2;
      const scaledViewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        const ocrItems = await ocrCanvas(canvas, pageNum);
        for (const it of ocrItems) {
          items.push({ ...it, x: it.x / scale, y: it.y / scale, width: it.width / scale, height: it.height / scale });
        }
      } else {
        warnings.push(`Page ${pageNum}: couldn't render for OCR, skipped.`);
      }
    } else {
      items.push(...pageItems);
    }
  }

  return items;
}
