import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listParticipantsForExpense,
  deleteExpense,
  listAllUsers,
} from "../api/expenses";
import type {
  FlatExpense,
  ExpenseParticipantType,
  UserProfileType,
} from "../api/expenses";
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
    if (!expense.id) return;

    let cancelled = false;

    (async () => {
      try {
        const [parts, allUsers] = await Promise.all([
          listParticipantsForExpense(expense.id),
          listAllUsers(),
        ]);

        if (cancelled) return;

        setParticipants(parts.filter((p) => p && p.userId));
        setUsers(allUsers.filter((u) => u && u.id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expense.id]);

  if (loading) {
    return (
      <div className={styles.card}>
        <p>Loading…</p>
      </div>
    );
  }

  const isParticipant = participants.some(
    (p) => p.userId === currentUserId
  );

  const amount = expense.amount ?? 0;

  const userName = (userId: string) =>
    users.find((u) => u.id === userId)?.displayName ?? userId;

  /* =========================
     SPLIT LOGIC (REAL)
     ========================= */

  const totalWeight = participants.reduce(
    (sum, p) => sum + (p.shareCount ?? 1),
    0
  );

  const calculateAmount = (p: ExpenseParticipantType) => {
    if (participants.length === 0) return 0;

    if (expense.splitMethod === "EQUAL") {
      return amount / participants.length;
    }

    if (
      expense.splitMethod === "BY_SHARES" ||
      expense.splitMethod === "BY_PERCENT" ||
      expense.splitMethod === "FULL"
    ) {
      const weight = p.shareCount ?? 0;
      return totalWeight > 0 ? (weight / totalWeight) * amount : 0;
    }

    return 0;
  };

  const splitLabel = (() => {
    switch (expense.splitMethod) {
      case "BY_SHARES":
        return "Split by shares";
      case "BY_PERCENT":
        return "Split by percent";
      case "FULL":
        return "One person owes all";
      default:
        return "Equal split";
    }
  })();

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

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{expense.title}</h2>

      <p className={styles.meta}>
        ${amount.toFixed(2)} · {splitLabel}
      </p>

      <div className={styles.breakdown}>
        <div className={styles.breakdownTitle}>Breakdown</div>

        <ul className={styles.breakdownList}>
          {participants.map((p) => (
            <li key={p.id ?? p.userId}>
              <span>{userName(p.userId)}</span>
              <span>${calculateAmount(p).toFixed(2)}</span>
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