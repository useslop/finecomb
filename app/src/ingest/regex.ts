// SPEC.md §7 parser regexes.
export const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/;
export const LEVEL2_CODE_RE = /^[A-V]\d{4}$/; // HCPCS Level II
export const CPT_SHAPED_RE = /^\d{4}[0-9FTU]$/; // 5-char code; shape only, never a descriptor
export const REV_CODE_RE = /^0\d{3}$/; // revenue code, 4 digits as printed
export const NDC_RE = /\b(\d{4,5})-(\d{3,4})-(\d{1,2})\b/;
export const MODIFIER_RE = /^[A-Z0-9]{2}$/;
export const INT_RE = /^\d{1,4}$/;
export const MONEY_RE = /\(?-?\$?[\d,]+\.\d{2}\)?(?:\s?CR)?/i;
export const MONEY_RE_G = /\(?-?\$?[\d,]+\.\d{2}\)?(?:\s?CR)?/gi;

export function normalizeDate(raw: string): string | undefined {
  const m = raw.match(DATE_RE);
  if (!m) return undefined;
  const [, mo, da, yrRaw] = m;
  if (!mo || !da || !yrRaw) return undefined;
  const month = Number(mo);
  const day = Number(da);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const yr = yrRaw.length === 2 ? (Number(yrRaw) <= 69 ? `20${yrRaw}` : `19${yrRaw}`) : yrRaw;
  return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

// 5-4-2, 4-4-2, 5-3-2 or 5-4-1 as printed -> 11 digits (5-4-2), per SPEC §7.
export function normalizeNdc(raw: string): string | undefined {
  const m = raw.match(NDC_RE);
  if (!m) return undefined;
  const [, seg1, seg2, seg3] = m;
  if (!seg1 || !seg2 || !seg3) return undefined;
  return seg1.padStart(5, '0') + seg2.padStart(4, '0') + seg3.padStart(2, '0');
}

// Money including parens, leading "-", and trailing "CR" as credits (negative).
export function parseMoney(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  const paren = s.match(/^\((.+)\)$/);
  if (paren?.[1] !== undefined) {
    negative = true;
    s = paren[1];
  }
  if (/\bCR\b/i.test(s)) {
    negative = true;
    s = s.replace(/\bCR\b/gi, '');
  }
  if (/^\s*-/.test(s)) negative = true;
  const cleaned = s.replace(/[^0-9.]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return negative ? -Math.abs(rounded) : rounded;
}
