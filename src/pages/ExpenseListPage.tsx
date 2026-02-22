/**
 * List expenses where the current user is a participant.
 * Links to add new expense and to edit each (for participants).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listMyExpenses } from "../api/expenses";
import type { ExpenseType } from "../api/expenses";
import ExpenseDetailCard from "../components/ExpenseDetailCard";
import styles from "./ExpenseListPage.module.css";

export default function ExpenseListPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await listMyExpenses(user.userId);
        if (!cancelled) setExpenses(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load expenses");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Expenses</h1>
        <div className={styles.actions}>
          <Link to="/expense/new" className={styles.button}>
            Add expense
          </Link>
          <Link to="/auth" className={`${styles.button} ${styles.buttonSecondary}`}>
            Account
          </Link>
        </div>
      </header>
      <p className={styles.userInfo}>Signed in as {user.displayName}</p>
      {loading && <p className={styles.loading}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && !error && expenses.length === 0 && (
        <p className={styles.empty}>No expenses yet. Add one to get started.</p>
      )}
      {!loading && !error && expenses.length > 0 && (
        <ul className={styles.list}>
          {expenses.map((expense) => (
            <li key={expense.id}>
              <ExpenseDetailCard
                expense={expense}
                currentUserId={user.userId}
                onDeleted={() => setExpenses((prev) => prev.filter((e) => e.id !== expense.id))}
                onUpdated={() => {
                  listMyExpenses(user.userId).then(setExpenses);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
