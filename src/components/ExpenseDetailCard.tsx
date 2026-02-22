/**
 * Renders one expense with per-participant balance breakdown.
 * Edit/Delete only shown when current user is a participant (participant-only mutate).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listParticipantsForExpense, deleteExpense } from "../api/expenses";
import type { FlatExpense, ExpenseParticipantType } from "../api/expenses";
import { listAllUsers } from "../api/expenses";
import { splitEqual, splitByShares } from "../utils/splitCalc";
import type { UserProfileType } from "../api/expenses";
import styles from "./ExpenseDetailCard.module.css";

interface ExpenseDetailCardProps {
  expense: FlatExpense;
  currentUserId: string;
  onDeleted: () => void;
}

export default function ExpenseDetailCard({
  expense,
  currentUserId,
  onDeleted,
}: ExpenseDetailCardProps) {
  const [participants, setParticipants] = useState<ExpenseParticipantType[]>([]);
  const [users, setUsers] = useState<UserProfileType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [parts, allUsers] = await Promise.all([
          listParticipantsForExpense(expense.id!),
          listAllUsers(),
        ]);
        if (!cancelled) {
          setParticipants(parts);
          setUsers(allUsers);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [expense.id]);

  const isParticipant = participants.some((p) => p.userId === currentUserId);
  const amount = expense.amount ?? 0;
  const splitMethod = expense.splitMethod ?? "EQUAL";

  const amounts =
    splitMethod === "EQUAL"
      ? splitEqual(amount, participants.length)
      : splitByShares(
          amount,
          participants.map((p) => ({ userId: p.userId, shareCount: p.shareCount ?? 1 }))
        );

  // Map participant userId (Cognito sub) to displayName; owner on UserProfile is set by Amplify.
  const userIdToName = (userId: string) => {
    if (userId === currentUserId) return "You";
    const profile = users.find((u) => {
      const owner = (u as UserProfileType & { owner?: string }).owner;
      return owner === userId || owner?.endsWith(userId);
    });
    return profile?.displayName ?? userId;
  };

  const handleDelete = async () => {
    if (!expense.id || !isParticipant) return;
    if (!window.confirm("Delete this expense?")) return;
    setDeleting(true);
    try {
      await deleteExpense(expense.id);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.card}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{expense.title}</h2>
      <p className={styles.meta}>
        ${amount.toFixed(2)} · {splitMethod === "EQUAL" ? "Equal" : "By shares"} split
      </p>
      <div className={styles.breakdown}>
        <div className={styles.breakdownTitle}>Per-person</div>
        <ul className={styles.breakdownList}>
          {participants.map((p, i) => (
            <li key={p.id ?? i}>
              <span>{userIdToName(p.userId)}</span>
              <span>${(amounts[i] ?? 0).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>
      {isParticipant && (
        <div className={styles.actions}>
          <Link
            to={`/expense/${expense.id}/edit`}
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Edit
          </Link>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonDanger}`}
            onClick={handleDelete}
            disabled={deleting}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
