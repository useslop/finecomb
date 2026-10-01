import { createWorker, type Worker } from 'tesseract.js';
import type { PositionedItem } from './types';

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/tesseract-core-simd-lstm.wasm.js',
      langPath: '/ocr',
      gzip: true,
    });
  }
  return workerPromise;
}

/** Grayscale -> cheap deskew -> adaptive threshold. Mutates and returns the same canvas. */
export function preprocess(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  let working = canvas;
  const angle = estimateSkewAngle(ctx, canvas.width, canvas.height);
  if (Math.abs(angle) >= 1) {
    working = rotateCanvas(canvas, angle);
  }

  const wctx = working.getContext('2d');
  if (!wctx) return working;
  const { width, height } = working;
  const imgData = wctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = 0.299 * (d[o] ?? 0) + 0.587 * (d[o + 1] ?? 0) + 0.114 * (d[o + 2] ?? 0);
  }

  const win = 15;
  const half = Math.floor(win / 2);
  const integral = buildIntegral(gray, width, height);
  const out = wctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const y0 = Math.max(0, y - half);
      const y1 = Math.min(height - 1, y + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const mean = sumRegion(integral, width, x0, y0, x1, y1) / area;
      const idx = y * width + x;
      const v = (gray[idx] ?? 0) < mean - 7 ? 0 : 255;
      const o = idx * 4;
      out.data[o] = v;
      out.data[o + 1] = v;
      out.data[o + 2] = v;
      out.data[o + 3] = 255;
    }
  }
  wctx.putImageData(out, 0, 0);
  return working;
}

function estimateSkewAngle(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const sample = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float64Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = 0.299 * (sample[o] ?? 0) + 0.587 * (sample[o + 1] ?? 0) + 0.114 * (sample[o + 2] ?? 0);
  }
  const step = width > 1200 ? 4 : 2;
  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let angleDeg = -5; angleDeg <= 5; angleDeg += 1) {
    const rad = (angleDeg * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const rowSums = new Float64Array(Math.ceil(height / step));
    let r = 0;
    for (let y = 0; y < height; y += step, r++) {
      let sum = 0;
      for (let x = 0; x < width; x += step) {
        const sx = Math.round(x * cos - y * sin);
        const sy = Math.round(x * sin + y * cos);
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) sum += gray[sy * width + sx] ?? 0;
      }
      rowSums[r] = sum;
    }
    const mean = rowSums.reduce((a, b) => a + b, 0) / rowSums.length;
    const variance = rowSums.reduce((a, b) => a + (b - mean) ** 2, 0) / rowSums.length;
    if (variance > bestScore) {
      bestScore = variance;
      bestAngle = angleDeg;
    }
  }
  return bestAngle;
}

function rotateCanvas(canvas: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const rad = (-angleDeg * Math.PI) / 180;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

function buildIntegral(gray: Uint8ClampedArray, width: number, height: number): Float64Array {
  const w = width + 1;
  const integral = new Float64Array(w * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x] ?? 0;
      integral[(y + 1) * w + (x + 1)] = (integral[y * w + (x + 1)] ?? 0) + rowSum;
    }
  }
  return integral;
}

function sumRegion(integral: Float64Array, width: number, x0: number, y0: number, x1: number, y1: number): number {
  const w = width + 1;
  const a = integral[y0 * w + x0] ?? 0;
  const b = integral[y0 * w + (x1 + 1)] ?? 0;
  const c = integral[(y1 + 1) * w + x0] ?? 0;
  const e = integral[(y1 + 1) * w + (x1 + 1)] ?? 0;
  return e - b - c + a;
}

export async function ocrCanvas(canvas: HTMLCanvasElement, page: number): Promise<PositionedItem[]> {
  const prepped = preprocess(canvas);
  const worker = await getWorker();
  const { data } = await worker.recognize(prepped);
  const words = data.words ?? [];
  return words
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({
      text: w.text,
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
      page,
      confidence: w.confidence,
    }));
}

export async function ocrFile(file: File, warnings: string[]): Promise<PositionedItem[]> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    warnings.push(`${file.name}: couldn't read this image.`);
    return [];
  }
  ctx.drawImage(bitmap, 0, 0);
  return ocrCanvas(canvas, 1);
}
