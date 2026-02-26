import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  listParticipantsForExpense,
  deleteExpense,
  listAllUsers,
} from "../api/expenses";
import type { FlatExpense, ExpenseParticipantType, UserProfileType } from "../api/expenses";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  :root {
    --bg: #f7f8fa; --surface: #ffffff; --border: #ebebed;
    --text: #1a1a2e; --muted: #8b8fa8; --accent: #3ecfb2;
    --accent-bg: #edfaf7; --red: #ff6b6b; --red-bg: #fff0f0;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --radius: 14px;
  }

  .edc-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 18px; box-shadow: var(--shadow);
    font-family: 'DM Sans', sans-serif;
  }
  .edc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
  .edc-title { font-size: 1rem; font-weight: 600; color: var(--text); letter-spacing: -.2px; }
  .edc-amount {
    font-family: 'DM Mono', monospace; font-size: 1rem; font-weight: 500;
    color: var(--text); white-space: nowrap;
  }
  .edc-badge {
    display: inline-block; background: var(--bg); color: var(--muted);
    font-size: .7rem; font-weight: 500; padding: 3px 9px; border-radius: 20px;
    border: 1px solid var(--border); margin-bottom: 14px; letter-spacing: .02em;
  }

  /* breakdown */
  .edc-breakdown { margin-bottom: 14px; }
  .edc-breakdown-label {
    font-size: .72rem; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px;
  }
  .edc-rows { display: flex; flex-direction: column; gap: 5px; }
  .edc-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 10px; border-radius: 8px; background: var(--bg);
    border: 1px solid var(--border);
  }
  .edc-row-name { font-size: .85rem; font-weight: 500; color: var(--text); }
  .edc-row-amt {
    font-family: 'DM Mono', monospace; font-size: .83rem;
    font-weight: 500; color: var(--muted);
  }

  /* loading shimmer */
  .edc-loading { padding: 12px 0; }
  .edc-shimmer {
    height: 14px; border-radius: 6px; background: linear-gradient(90deg, var(--border) 25%, #f0f0f3 50%, var(--border) 75%);
    background-size: 200% 100%; animation: shimmer 1.2s infinite;
    margin-bottom: 8px;
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* actions */
  .edc-actions { display: flex; gap: 8px; margin-top: 2px; }
  .edc-btn {
    padding: 7px 14px; border-radius: 8px; border: none;
    font-family: 'DM Sans', sans-serif; font-size: .8rem; font-weight: 500;
    cursor: pointer; text-decoration: none; transition: all .14s ease;
    display: inline-flex; align-items: center;
  }
  .edc-btn-edit {
    background: var(--bg); color: var(--text); border: 1px solid var(--border);
  }
  .edc-btn-edit:hover { background: var(--surface); box-shadow: 0 2px 8px rgba(0,0,0,.07); }
  .edc-btn-delete {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
  }
  .edc-btn-delete:hover { background: var(--red-bg); color: var(--red); border-color: #ffd0d0; }
  .edc-btn-delete:disabled { opacity: .4; cursor: not-allowed; }
`;

interface ExpenseDetailCardProps {
  expense: FlatExpense;
  currentUserId: string;
  onDeleted: () => void;
}

export default function ExpenseDetailCard({ expense, currentUserId, onDeleted }: ExpenseDetailCardProps) {
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
    return () => { cancelled = true; };
  }, [expense.id]);

  const isParticipant = participants.some((p) => p.userId === currentUserId);
  const amount = expense.amount ?? 0;
  const userName = (userId: string) => users.find((u) => u.id === userId)?.displayName ?? userId;

  const totalWeight = participants.reduce((sum, p) => sum + (p.shareCount ?? 1), 0);
  const calculateAmount = (p: ExpenseParticipantType) => {
    if (participants.length === 0) return 0;
    if (expense.splitMethod === "EQUAL") return amount / participants.length;
    if (["BY_SHARES", "BY_PERCENT", "FULL"].includes(expense.splitMethod ?? "")) {
      const weight = p.shareCount ?? 0;
      return totalWeight > 0 ? (weight / totalWeight) * amount : 0;
    }
    return 0;
  };

  const splitLabel = (() => {
    switch (expense.splitMethod) {
      case "BY_SHARES": return "Split by shares";
      case "BY_PERCENT": return "Split by percent";
      case "FULL": return "One person owes all";
      default: return "Equal split";
    }
  })();

  const handleDelete = async () => {
    if (!expense.id || !isParticipant) return;
    if (!window.confirm("Delete this expense?")) return;
    setDeleting(true);
    try { await deleteExpense(expense.id); onDeleted(); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <style>{css}</style>
      <div className="edc-card">
        {loading ? (
          <div className="edc-loading">
            <div className="edc-shimmer" style={{ width: "60%" }} />
            <div className="edc-shimmer" style={{ width: "40%" }} />
            <div className="edc-shimmer" style={{ width: "80%" }} />
          </div>
        ) : (
          <>
            <div className="edc-header">
              <div className="edc-title">{expense.title}</div>
              <div className="edc-amount">${amount.toFixed(2)}</div>
            </div>

            <div className="edc-badge">{splitLabel}</div>

            <div className="edc-breakdown">
              <div className="edc-breakdown-label">Breakdown</div>
              <div className="edc-rows">
                {participants.map((p) => (
                  <div key={p.id ?? p.userId} className="edc-row">
                    <span className="edc-row-name">
                      {userName(p.userId)}
                      {p.userId === currentUserId && (
                        <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: ".75rem", marginLeft: 4 }}>· you</span>
                      )}
                    </span>
                    <span className="edc-row-amt">${calculateAmount(p).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {isParticipant && (
              <div className="edc-actions">
                <Link to={`/expense/${expense.id}/edit`} className="edc-btn edc-btn-edit">Edit</Link>
                <button type="button" className="edc-btn edc-btn-delete"
                  onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
