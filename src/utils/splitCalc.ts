/**
 * Pure split calculation utilities for SplitLite.
 * Handles EQUAL and BY_SHARES methods with rounding remainder applied to first participant.
 */

export type SplitMethod = "EQUAL" | "BY_SHARES";

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
