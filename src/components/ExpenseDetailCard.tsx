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

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --bg: #f7f8fa;
    --surface: #ffffff;
    --border: #ececf1;
    --text: #1a1a2e;
    --muted: #8b8fa8;
    --accent: #3ecfb2;
    --accent-bg: #edfaf7;
    --red: #ff6b6b;
    --red-bg: #fff0f0;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.05);
    --radius: 16px;
  }

  .edc-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
    box-shadow: var(--shadow);
    font-family: 'DM Sans', sans-serif;
    transition: box-shadow .18s ease, transform .18s ease;
  }

  .edc-card:hover {
    box-shadow: 0 12px 32px rgba(0,0,0,.08);
    transform: translateY(-1px);
  }

  .edc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }

  .edc-title {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -.2px;
  }

  .edc-amount {
    font-family: 'DM Mono', monospace;
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--text);
  }

  .edc-meta {
    font-size: .72rem;
    color: var(--muted);
    margin-bottom: 14px;
    font-weight: 500;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .edc-breakdown-label {
    font-size: .72rem;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: .06em;
    margin-bottom: 8px;
  }

  .edc-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
  }

  .edc-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
  }

  .edc-row-name {
    font-size: .85rem;
    font-weight: 500;
    color: var(--text);
  }

  .edc-row-amt {
    font-family: 'DM Mono', monospace;
    font-size: .82rem;
    color: var(--muted);
  }

  .edc-paid {
    background: var(--accent-bg);
    border-color: rgba(62,207,178,.3);
  }

  .edc-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .edc-btn {
    padding: 7px 14px;
    border-radius: 9px;
    border: 1px solid var(--border);
    font-size: .8rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: all .15s ease;
    display: inline-flex;
    align-items: center;
  }

  .edc-btn-edit {
    background: var(--bg);
    color: var(--text);
  }

  .edc-btn-edit:hover {
    background: var(--surface);
    box-shadow: 0 4px 12px rgba(0,0,0,.08);
  }

  .edc-btn-delete {
    background: transparent;
    color: var(--muted);
  }

  .edc-btn-delete:hover {
    background: var(--red-bg);
    color: var(--red);
    border-color: #ffd0d0;
  }

  .edc-btn-delete:disabled {
    opacity: .4;
    cursor: not-allowed;
  }

  .edc-loading {
    padding: 16px 0;
    font-size: .85rem;
    color: var(--muted);
  }
`;

interface ExpenseDetailCardProps {
  expense: FlatExpense;
  currentUserId: string;
  onDeleted: () => void;
  groupMemberIds?: string[];
}

export default function ExpenseDetailCard({
  expense,
  currentUserId,
  onDeleted,
  groupMemberIds,
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

        setParticipants(parts.filter(p => p?.userId));
        setUsers(allUsers.filter(u => u?.id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [expense.id]);

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <div className="edc-card">
          <div className="edc-loading">Loading expense…</div>
        </div>
      </>
    );
  }

  const isAllowed =
    participants.some(p => p.userId === currentUserId) ||
    (groupMemberIds && groupMemberIds.includes(currentUserId));

  const amount = expense.amount ?? 0;

  const userName = (id: string) =>
    users.find(u => u.id === id)?.displayName ?? id;

  const totalWeight = participants.reduce(
    (sum, p) => sum + (p.shareCount ?? 1),
    0
  );

  const calculateAmount = (p: ExpenseParticipantType) => {
    if (participants.length === 0) return 0;
    if (expense.splitMethod === "EQUAL") {
      return amount / participants.length;
    }
    const weight = p.shareCount ?? 0;
    return totalWeight > 0 ? (weight / totalWeight) * amount : 0;
  };

  const splitLabel =
    expense.splitMethod === "BY_SHARES"
      ? "Split by shares"
      : expense.splitMethod === "BY_PERCENT"
      ? "Split by percent"
      : expense.splitMethod === "FULL"
      ? "One person owes all"
      : "Equal split";

  const handleDelete = async () => {
    if (!expense.id || !isAllowed) return;
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
    <>
      <style>{css}</style>
      <div className="edc-card">
        <div className="edc-header">
          <div className="edc-title">{expense.title}</div>
          <div className="edc-amount">${amount.toFixed(2)}</div>
        </div>

        <div className="edc-meta">{splitLabel}</div>

        <div className="edc-breakdown-label">Breakdown</div>

        <div className="edc-rows">
          {participants.map(p => {
            const paid = expense.paidBy === p.userId;
            return (
              <div
                key={p.id ?? p.userId}
                className={`edc-row ${paid ? "edc-paid" : ""}`}
              >
                <span className="edc-row-name">
                  {userName(p.userId)}
                  {p.userId === currentUserId && " · you"}
                  {paid && " · paid"}
                </span>
                <span className="edc-row-amt">
                  ${calculateAmount(p).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

        {isAllowed && (
          <div className="edc-actions">
            <Link
              to={`/expense/${expense.id}/edit`}
              className="edc-btn edc-btn-edit"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="edc-btn edc-btn-delete"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}