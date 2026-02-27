/**
 * Pure split calculation utilities for SplitLite.
 * Handles EQUAL and BY_SHARES methods with rounding remainder applied to first participant.
 */

export type SplitMethod =
  | "EQUAL"
  | "BY_SHARES"
  | "BY_PERCENT"
  | "FULL"
  | "BY_EXACT"; 

export interface ParticipantShare {
  userId: string;
  shareCount: number;
}

/**
 * Compute per-participant amounts for EQUAL split.
 * Remainder from rounding is assigned to the first participant so total exactly matches amount.
 */
export function splitEqual(amount: number, participantCount: number): number[] {
  if (participantCount <= 0) return [];
  const base = amount / participantCount;
  const baseRounded = Math.round(base * 100) / 100;
  const amounts = Array(participantCount).fill(baseRounded);
  const sum = amounts.reduce((s, a) => s + a, 0);
  const remainder = Math.round((amount - sum) * 100) / 100;
  if (remainder !== 0 && amounts.length > 0) {
    amounts[0] = Math.round((amounts[0] + remainder) * 100) / 100;
  }
  return amounts;
}

/**
 * Compute per-participant amounts for BY_SHARES split.
 * Each portion = (shareCount / totalShares) * amount.
 * Rounding remainder is applied to the first participant so total exactly matches amount.
 */
export function splitByShares(
  amount: number,
  participants: ParticipantShare[]
): number[] {
  if (participants.length === 0) return [];
  const totalShares = participants.reduce((t, p) => t + p.shareCount, 0);
  if (totalShares <= 0) return participants.map(() => 0);
  const amounts = participants.map(
    (p) => Math.round((amount * (p.shareCount / totalShares)) * 100) / 100
  );
  const sum = amounts.reduce((s, a) => s + a, 0);
  const remainder = Math.round((amount - sum) * 100) / 100;
  if (remainder !== 0 && amounts.length > 0) {
    amounts[0] = Math.round((amounts[0] + remainder) * 100) / 100;
  }
  return amounts;
}

/**
 * Compute per-participant amounts for BY_EXACT split.
 * shareCount is stored in cents.
 */
export function splitByExact(
  participants: ParticipantShare[]
): number[] {
  if (participants.length === 0) return [];

  return participants.map(
    (p) => Math.round((p.shareCount / 100) * 100) / 100
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX #3: Smart date formatter
// Replaces the old relativeTime() from sharedStyles with a richer format
// that shows time of day, not just "Today" or "2 days ago".
//
// Usage:  import { formatExpenseDate } from '../utils/splitCalc';
//         <span>{formatExpenseDate(expense.createdAt)}</span>
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an ISO timestamp into a human-readable relative date with time.
 *
 * Examples:
 *   Same day   → "Today, 8:44 AM"
 *   Yesterday  → "Yesterday, 7:20 PM"
 *   This week  → "Tuesday, 3:05 PM"
 *   Older      → "Feb 18"    (no time — old enough that precision matters less)
 */
export function formatExpenseDate(isoString: string): string {
  if (!isoString) return "";

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();

  // Calendar-day difference (ignore time of day)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000
  );

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString([], { weekday: "long" });
    return `${dayName}, ${timeStr}`;
  }

  // Older than a week — just show the date
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}