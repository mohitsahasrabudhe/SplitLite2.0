import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listMyExpenses,
  listParticipantsForExpense,
  listAllUsers,
} from "../api/expenses";
import type { FlatExpense, UserProfileType } from "../api/expenses";
import ExpenseDetailCard from "../components/ExpenseDetailCard";
import styles from "./ExpenseListPage.module.css";

type ExpenseWithPeople = FlatExpense & {
  participants: { userId: string; displayName: string }[];
  paidBy?: string;
};

type ExpenseGroup = {
  key: string;
  expenses: ExpenseWithPeople[];
};

const resolveUserId = (u: UserProfileType) =>
  (u as any).owner ?? (u as any).id;

function groupByParticipants(expenses: ExpenseWithPeople[]): ExpenseGroup[] {
  const map = new Map<string, ExpenseWithPeople[]>();

  for (const exp of expenses) {
    const names = exp.participants
      .map((p) => p.displayName)
      .sort((a, b) => a.localeCompare(b));

    const key = names.join(" + ");

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(exp);
  }

  return Array.from(map.entries()).map(([key, expenses]) => ({
    key,
    expenses: expenses.sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    ),
  }));
}

/* ========================= */
/* Net balance helpers      */
/* ========================= */

function computeNet(group: ExpenseGroup) {
  const net: Record<string, number> = {};

  for (const exp of group.expenses) {
    if (!exp.paidBy) continue;

    net[exp.paidBy] = (net[exp.paidBy] ?? 0) + exp.amount;

    const perPerson = exp.amount / exp.participants.length;

    for (const p of exp.participants) {
      net[p.userId] = (net[p.userId] ?? 0) - perPerson;
    }
  }

  return net;
}

function buildSettlements(
  net: Record<string, number>,
  group: ExpenseGroup
) {
  const nameMap = new Map<string, string>();

  for (const exp of group.expenses) {
    for (const p of exp.participants) {
      nameMap.set(p.userId, p.displayName);
    }
  }

  const owed: [string, number][] = [];
  const owes: [string, number][] = [];

  for (const [user, amt] of Object.entries(net)) {
    if (amt > 0.001) owed.push([user, amt]);
    if (amt < -0.001) owes.push([user, -amt]);
  }

  const results: string[] = [];

  let i = 0;
  let j = 0;

  while (i < owes.length && j < owed.length) {
    const [debtorId, debt] = owes[i];
    const [creditorId, credit] = owed[j];

    const amount = Math.min(debt, credit);

    results.push(
      `${nameMap.get(debtorId)} owes ${nameMap.get(
        creditorId
      )} $${amount.toFixed(2)}`
    );

    owes[i][1] -= amount;
    owed[j][1] -= amount;

    if (owes[i][1] <= 0.001) i++;
    if (owed[j][1] <= 0.001) j++;
  }

  return results;
}

export default function ExpenseListPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseWithPeople[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedView, setSelectedView] = useState("__summary__");

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        setLoading(true);

        const [rawExpenses, users] = await Promise.all([
          listMyExpenses(user.userId),
          listAllUsers(),
        ]);

        const userMap = new Map(
          users.map((u) => [resolveUserId(u), u.displayName])
        );

        const withParticipants: ExpenseWithPeople[] = await Promise.all(
          rawExpenses.map(async (exp: any) => {
            console.log("RAW EXPENSE FROM AMPLIFY:", exp);
            const parts = await listParticipantsForExpense(exp.id);

            return {
              ...exp,
 paidBy: exp.paidBy, // 👈 important
  participants: parts.map((p) => ({
    userId: p.userId,
    displayName: userMap.get(p.userId) ?? p.userId,
              })),
            };
          })
        );

        setExpenses(withParticipants);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load expenses");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const grouped = useMemo(
    () => groupByParticipants(expenses),
    [expenses]
  );

  if (!user) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Expenses</h1>
        <div className={styles.actions}>
          <Link to="/expense/new" className={styles.button}>
            Add expense
          </Link>
          <Link
            to="/auth"
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Account
          </Link>
        </div>
      </header>

      <p className={styles.userInfo}>Signed in as {user.displayName}</p>

      {loading && <p>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <div className={styles.layout}>
          <div className={styles.sidebar}>
            <div
              className={`${styles.sidebarItem} ${
                selectedView === "__summary__"
                  ? styles.sidebarItemActive
                  : ""
              }`}
              onClick={() => setSelectedView("__summary__")}
            >
              Summary
            </div>

            {grouped.map((group) => (
              <div
                key={group.key}
                className={`${styles.sidebarItem} ${
                  selectedView === group.key
                    ? styles.sidebarItemActive
                    : ""
                }`}
                onClick={() => setSelectedView(group.key)}
              >
                {group.key}
              </div>
            ))}
          </div>

          <div className={styles.content}>
            {selectedView === "__summary__" ? (
              <div>
                <h3>Summary</h3>

                {grouped.map((group) => {
                  const settlements = buildSettlements(
                    computeNet(group),
                    group
                  );

                  return (
                    <div key={group.key} style={{ marginBottom: "1rem" }}>
                      <strong>{group.key}</strong>
                      {settlements.length === 0 ? (
                        <div>All settled up 🎉</div>
                      ) : (
                        settlements.map((s, i) => (
                          <div key={i}>{s}</div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              grouped
                .filter((g) => g.key === selectedView)
                .map((group) => (
                  <div key={group.key} className={styles.group}>
                    <h3 className={styles.groupTitle}>{group.key}</h3>

                    {buildSettlements(
                      computeNet(group),
                      group
                    ).map((s, i) => (
                      <div key={i}>{s}</div>
                    ))}

                    <ul className={styles.list}>
                      {group.expenses.map((expense) => {
                        const payerName = expense.participants.find(
                          p => p.userId === expense.paidBy
                        )?.displayName;

                        return (
                          <li key={expense.id}>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                marginBottom: "4px",
                                color: "#666",
                              }}
                            >
                              Paid by: {payerName ?? "Unknown"}
                            </div>

                            <ExpenseDetailCard
                              expense={expense}
                              currentUserId={user.userId}
                              onDeleted={() =>
                                setExpenses((prev) =>
                                  prev.filter(
                                    (e) => e.id !== expense.id
                                  )
                                )
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}