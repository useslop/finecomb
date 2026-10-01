import type { Bill } from '../types/engine';

export interface PositionedItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  confidence?: number; // 0-100, OCR words only
}

export interface IngestInput {
  text?: string;
  files?: File[];
}

export interface IngestResult {
  bill: Bill;
  warnings: string[];
}
