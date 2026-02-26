import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listMyExpenses,
  listParticipantsForExpense,
  listAllUsers,
  listMyGroups,
} from "../api/expenses";
import type {
  FlatExpense,
  GroupType,
} from "../api/expenses";
import ExpenseDetailCard from "../components/ExpenseDetailCard";
import styles from "./ExpenseListPage.module.css";

type ExpenseWithPeople = FlatExpense & {
  participants: {
    userId: string;
    displayName: string;
    shareCount: number;
  }[];
};

export default function ExpenseListPage() {
  const { user } = useAuth();
  if (!user) return null;

  const currentUser = user;

  const [expenses, setExpenses] = useState<ExpenseWithPeople[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("__summary__");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [rawExpenses, users, myGroups] = await Promise.all([
          listMyExpenses(currentUser.userId),
          listAllUsers(),
          listMyGroups(currentUser.userId),
        ]);

        const cleanUsers = users.filter((u) => u && u.id);
        const cleanGroups = myGroups.filter((g) => g && g.id);

        setGroups(cleanGroups);

        const userMap = new Map(
          cleanUsers.map((u) => [u.id, u.displayName])
        );

        const withParticipants: ExpenseWithPeople[] = await Promise.all(
          rawExpenses
            .filter((e: any) => e && e.id)
            .map(async (exp: any) => {
              const parts = await listParticipantsForExpense(exp.id);

              return {
                ...exp,
                participants: parts
                  .filter((p: any) => p && p.userId)
                  .map((p: any) => ({
                    userId: p.userId,
                    displayName:
                      userMap.get(p.userId) ?? "Unknown",
                    shareCount: p.shareCount ?? 1,
                  })),
              };
            })
        );

        setExpenses(withParticipants);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load expenses"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser.userId]);

  /* =========================
     Grouping helpers
     ========================= */

  const directGroups = useMemo(() => {
    const map = new Map<string, ExpenseWithPeople[]>();

    for (const exp of expenses) {
      if (exp.groupId) continue;

      const key = exp.participants
        .map((p) => p.displayName)
        .sort((a, b) => a.localeCompare(b))
        .join(" + ");

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exp);
    }

    return map;
  }, [expenses]);

  const groupExpenseMap = useMemo(() => {
    const map = new Map<string, ExpenseWithPeople[]>();

    for (const exp of expenses) {
      if (!exp.groupId) continue;
      if (!map.has(exp.groupId)) map.set(exp.groupId, []);
      map.get(exp.groupId)!.push(exp);
    }

    return map;
  }, [expenses]);

  /* =========================
     Correct settlement engine
     ========================= */

  function computeNet(exps: ExpenseWithPeople[]) {
    const net: Record<string, number> = {};

    for (const exp of exps) {
      if (!exp.paidBy || exp.participants.length === 0)
        continue;

      net[exp.paidBy] =
        (net[exp.paidBy] ?? 0) + exp.amount;

      const totalWeight = exp.participants.reduce(
        (s, p) => s + (p.shareCount ?? 1),
        0
      );

      for (const p of exp.participants) {
        const weight = p.shareCount ?? 1;

        const owed =
          totalWeight > 0
            ? (weight / totalWeight) * exp.amount
            : 0;

        net[p.userId] =
          (net[p.userId] ?? 0) - owed;
      }
    }

    return net;
  }

  function buildSettlements(
    net: Record<string, number>,
    nameMap: Map<string, string>
  ) {
    const owed: [string, number][] = [];
    const owes: [string, number][] = [];

    for (const [u, amt] of Object.entries(net)) {
      if (amt > 0.001) owed.push([u, amt]);
      if (amt < -0.001) owes.push([u, -amt]);
    }

    const res: string[] = [];
    let i = 0;
    let j = 0;

    while (i < owes.length && j < owed.length) {
      const [dId, debt] = owes[i];
      const [cId, credit] = owed[j];

      const amt = Math.min(debt, credit);

      res.push(
        `${nameMap.get(dId)} owes ${nameMap.get(
          cId
        )} $${amt.toFixed(2)}`
      );

      owes[i][1] -= amt;
      owed[j][1] -= amt;

      if (owes[i][1] <= 0.001) i++;
      if (owed[j][1] <= 0.001) j++;
    }

    return res;
  }

  function renderSettlementsOnly(exps: ExpenseWithPeople[]) {
    if (exps.length === 0) return null;

    const nameMap = new Map<string, string>();
    exps.forEach((e) =>
      e.participants.forEach((p) =>
        nameMap.set(p.userId, p.displayName)
      )
    );

    return buildSettlements(
      computeNet(exps),
      nameMap
    ).map((s, i) => <div key={i}>{s}</div>);
  }

  function renderExpenseSection(exps: ExpenseWithPeople[]) {
    if (exps.length === 0) return <p>No expenses yet.</p>;

    return (
      <ul className={styles.list}>
        {exps.map((expense) => {
          const payerName =
            expense.participants.find(
              (p) => p.userId === expense.paidBy
            )?.displayName ?? "Unknown";

          return (
            <li key={expense.id}>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                Paid by: {payerName}
              </div>

              <ExpenseDetailCard
                expense={expense}
                currentUserId={currentUser.userId}
                onDeleted={() =>
                  setExpenses((prev) =>
                    prev.filter((e) => e.id !== expense.id)
                  )
                }
              />
            </li>
          );
        })}
      </ul>
    );
  }

  /* =========================
     Render
     ========================= */

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Expenses</h1>

        <div className={styles.actions}>
          <Link to="/expense/new" className={styles.button}>
            Add expense
          </Link>
          <Link
            to="/group/new"
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Create group
          </Link>
          <Link
            to="/auth"
            className={`${styles.button} ${styles.buttonSecondary}`}
          >
            Account
          </Link>
        </div>
      </header>

      <p className={styles.userInfo}>
        Signed in as {currentUser.displayName}
      </p>

      {loading && <p>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <div className={styles.layout}>
          <div className={styles.sidebar}>
            <div
              className={`${styles.sidebarItem} ${
                selected === "__summary__"
                  ? styles.sidebarItemActive
                  : ""
              }`}
              onClick={() => setSelected("__summary__")}
            >
              Summary
            </div>

            <div className={styles.sidebarSection}>Direct</div>

            {[...directGroups.keys()].map((key) => (
              <div
                key={key}
                className={`${styles.sidebarItem} ${
                  selected === key
                    ? styles.sidebarItemActive
                    : ""
                }`}
                onClick={() => setSelected(key)}
              >
                {key}
              </div>
            ))}

            <div className={styles.sidebarSection}>Groups</div>

            {groups.map((g) => (
              <div
                key={g.id}
                className={`${styles.sidebarItem} ${
                  selected === g.id
                    ? styles.sidebarItemActive
                    : ""
                }`}
                onClick={() => setSelected(g.id)}
              >
                {g.name}
              </div>
            ))}
          </div>

          <div className={styles.content}>
            {selected === "__summary__" && (
              <>
                <h3>Summary</h3>

                <h4>Direct</h4>
                {[...directGroups.entries()].map(
                  ([key, exps]) => (
                    <div key={key}>
                      <strong>{key}</strong>
                      {renderSettlementsOnly(exps)}
                    </div>
                  )
                )}

                <h4>Groups</h4>
                {groups.map((g) => {
                  const exps =
                    groupExpenseMap.get(g.id) ?? [];
                  if (exps.length === 0) return null;

                  return (
                    <div key={g.id}>
                      <strong>{g.name}</strong>
                      {renderSettlementsOnly(exps)}
                    </div>
                  );
                })}
              </>
            )}

            {[...directGroups.entries()].map(
              ([key, exps]) =>
                selected === key ? (
                  <div key={key}>
                    <h3>{key}</h3>
                    {renderSettlementsOnly(exps)}
                    {renderExpenseSection(exps)}
                  </div>
                ) : null
            )}

            {groups.map((g) =>
              selected === g.id ? (
                <div key={g.id}>
                  <h3>{g.name}</h3>
                  {renderSettlementsOnly(
                    groupExpenseMap.get(g.id) ?? []
                  )}
                  {renderExpenseSection(
                    groupExpenseMap.get(g.id) ?? []
                  )}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}