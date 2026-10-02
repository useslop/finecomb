import type { BillLine, Citation, Confidence, Finding, Money } from '../types.js';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toUtcMs(d: string): number {
  const parts = d.split('-').map(Number);
  return Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!);
}

/** Whole days between two ISO dates (b - a); negative if b is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

export function addDays(d: string, n: number): string {
  const parts = d.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]! + n));
  return dt.toISOString().slice(0, 10);
}

export function normDesc(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function sum(nums: (number | undefined | null)[]): number {
  return round2(nums.reduce((a: number, n) => a + (n ?? 0), 0));
}

export function lineKey(l: BillLine): string {
  return l.code ? `code:${l.code}` : `desc:${normDesc(l.description)}`;
}

export function modsKey(mods: string[] | undefined): string {
  return (mods ?? []).map((m) => m.toUpperCase()).sort().join('+');
}

export interface MkFindingArgs {
  ruleId: string;
  discriminator: string; // makes the id deterministic and unique within a run
  title: string;
  why: string;
  userText: string;
  verify: string;
  evidenceLineIds: string[];
  confidence: Confidence;
  dollarsAtStake: Money | null;
  citations: Citation[];
}

export function mkFinding(a: MkFindingArgs): Finding {
  return {
    id: `${a.ruleId}:${a.discriminator}`,
    ruleId: a.ruleId,
    title: a.title,
    why: a.why,
    userText: a.userText,
    verify: a.verify,
    evidenceLineIds: a.evidenceLineIds,
    confidence: a.confidence,
    dollarsAtStake: a.dollarsAtStake === null ? null : round2(a.dollarsAtStake),
    citations: a.citations,
  };
}

/** Bypass modifiers that can legitimately separate two otherwise-identical lines (bilateral, repeat, NCCI). */
const SEPARATING_MODIFIERS = new Set([
  '50', '58', '59', '76', '77', '78', '79', '91',
  'XE', 'XS', 'XP', 'XU',
  'LT', 'RT',
  'E1', 'E2', 'E3', 'E4',
  'FA', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9',
  'TA', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9',
]);

export function hasSeparatingModifier(mods: string[] | undefined): boolean {
  return (mods ?? []).some((m) => SEPARATING_MODIFIERS.has(m.toUpperCase()));
}

// Credit/reversal netting lives in ../net.ts (shared pre-pass used by analyze()).

export const ROOM_REV_CODE_MIN = 10; // 010X
export const ROOM_REV_CODE_MAX = 21; // 021X
const ROOM_KEYWORDS = /\b(ROOM|R\s*&\s*B|SEMI[- ]?PRIV|PRIVATE ROOM|MED\s*\/?\s*SURG|TELEMETRY|ICU|CCU|NURSERY)\b/i;

export function isRoomLine(l: BillLine): boolean {
  if (l.revCode && /^\d{4}$/.test(l.revCode)) {
    const fam = Number(l.revCode.slice(0, 3));
    if (fam >= ROOM_REV_CODE_MIN && fam <= ROOM_REV_CODE_MAX) return true;
  }
  return ROOM_KEYWORDS.test(l.description);
}

const FACILITY_FEE_KEYWORDS = /\b(FACILITY FEE|CLINIC FEE)\b/i;
export function isFacilityFeeLine(l: BillLine): boolean {
  if (l.revCode && /^0?51\d$/.test(l.revCode)) return true;
  return FACILITY_FEE_KEYWORDS.test(l.description);
}

export const CANCEL_KEYWORDS = /\bCANCEL\w*|\bCANC\b|D\/?C'?D|\bNOT GIVEN\b|\bRETURNED\b|\bWASTE\w*/i;
