import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listMyExpenses,
  listParticipantsForExpense,
  listAllUsers,
  listMyGroups,
} from "../api/expenses";
import type { FlatExpense, GroupType } from "../api/expenses";
import ExpenseDetailCard from "../components/ExpenseDetailCard";

// ── inline design tokens ───────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #f7f8fa;
    --surface:   #ffffff;
    --border:    #ebebed;
    --text:      #1a1a2e;
    --muted:     #8b8fa8;
    --accent:    #3ecfb2;
    --accent-bg: #edfaf7;
    --red:       #ff6b6b;
    --red-bg:    #fff0f0;
    --shadow:    0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --radius:    14px;
    --sidebar-w: 220px;
  }

  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }

  /* ── layout ── */
  .sl-root       { min-height: 100vh; background: var(--bg); }
  .sl-topbar     {
    position: sticky; top: 0; z-index: 40;
    background: rgba(247,248,250,.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    height: 60px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .sl-brand      { font-size: 1.05rem; font-weight: 600; letter-spacing: -.3px; }
  .sl-brand span { color: var(--accent); }
  .sl-user       { font-size: .8rem; color: var(--muted); font-weight: 400; }

  .sl-actions    { display: flex; gap: 8px; align-items: center; }

  /* ── buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 10px; border: none;
    font-family: inherit; font-size: .85rem; font-weight: 500;
    cursor: pointer; text-decoration: none; transition: all .15s ease;
    white-space: nowrap;
  }
  .btn-primary   { background: var(--text); color: #fff; }
  .btn-primary:hover { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .btn-ghost     { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--surface); color: var(--text); }

  /* ── body layout ── */
  .sl-body       { display: flex; max-width: 1100px; margin: 0 auto; padding: 24px 16px; gap: 20px; }

  /* ── sidebar ── */
  .sl-sidebar    {
    width: var(--sidebar-w); flex-shrink: 0;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 12px 8px; height: fit-content;
    position: sticky; top: 80px;
  }
  .sl-section-label {
    font-size: .68rem; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--muted);
    padding: 10px 10px 4px;
  }
  .sl-nav-item   {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 10px; border-radius: 8px;
    font-size: .85rem; font-weight: 400; color: var(--text);
    cursor: pointer; transition: all .12s ease;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sl-nav-item:hover   { background: var(--bg); }
  .sl-nav-item.active  { background: var(--accent-bg); color: var(--accent); font-weight: 500; }
  .sl-nav-dot    { width: 7px; height: 7px; border-radius: 50%; background: var(--border); flex-shrink: 0; }
  .sl-nav-item.active .sl-nav-dot { background: var(--accent); }

  /* ── content ── */
  .sl-content    { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }

  /* ── page title ── */
  .sl-page-title { font-size: 1.4rem; font-weight: 600; letter-spacing: -.4px; }
  .sl-page-sub   { font-size: .85rem; color: var(--muted); margin-top: 2px; }

  /* ── summary cards ── */
  .sl-grid       { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
  .sl-card       {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 18px;
    box-shadow: var(--shadow); transition: box-shadow .15s ease;
  }
  .sl-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.08); }
  .sl-card-label { font-size: .78rem; font-weight: 600; color: var(--muted); letter-spacing: .03em; margin-bottom: 10px; }
  .sl-card-name  { font-size: .95rem; font-weight: 600; margin-bottom: 8px; }

  /* ── settlement rows ── */
  .sl-settlement {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-radius: 8px; margin-bottom: 4px;
    font-size: .82rem;
  }
  .sl-settlement.owes { background: var(--red-bg); }
  .sl-settlement.owed { background: var(--accent-bg); }
  .sl-s-text     { color: var(--muted); }
  .sl-s-amount   { font-family: 'DM Mono', monospace; font-weight: 500; font-size: .85rem; }
  .sl-settlement.owes .sl-s-amount { color: var(--red); }
  .sl-settlement.owed .sl-s-amount { color: var(--accent); }

  /* ── expense section ── */
  .sl-exp-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 12px; border-bottom: 1px solid var(--border); margin-bottom: 16px;
  }
  .sl-exp-list   { display: flex; flex-direction: column; gap: 10px; }
  .sl-exp-item   {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px;
    box-shadow: var(--shadow);
  }
  .sl-paid-by    { font-size: .75rem; color: var(--muted); margin-bottom: 6px; }

  /* ── empty / loading ── */
  .sl-empty      { text-align: center; padding: 60px 20px; color: var(--muted); font-size: .9rem; }
  .sl-loading    { display: flex; align-items: center; justify-content: center; padding: 80px; }
  .sl-spinner    {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid var(--border); border-top-color: var(--accent);
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sl-error      { background: var(--red-bg); color: var(--red); padding: 12px 16px; border-radius: 10px; font-size: .85rem; }

  /* ── divider ── */
  .sl-divider    { height: 1px; background: var(--border); margin: 4px 8px; }

  /* ── mobile ── */
  @media (max-width: 680px) {
    .sl-topbar    { padding: 0 16px; }
    .sl-body      { flex-direction: column; padding: 12px; gap: 12px; }
    .sl-sidebar   { width: 100%; position: static; display: flex; flex-wrap: wrap; gap: 4px; padding: 10px; }
    .sl-section-label { width: 100%; padding: 4px 6px 2px; }
    .sl-nav-item  { flex: 0 0 auto; font-size: .8rem; padding: 7px 10px; }
    .sl-grid      { grid-template-columns: 1fr; }
    .btn          { padding: 7px 12px; font-size: .8rem; }
    .sl-brand     { font-size: .95rem; }
  }
`;

// ── types ──────────────────────────────────────────────────────────────────────
type ExpenseWithPeople = FlatExpense & {
  participants: { userId: string; displayName: string; shareCount: number }[];
};

// ── component ─────────────────────────────────────────────────────────────────
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

        const userMap = new Map(cleanUsers.map((u) => [u.id, u.displayName]));

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
                    displayName: userMap.get(p.userId) ?? "Unknown",
                    shareCount: p.shareCount ?? 1,
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
  }, [currentUser.userId]);

  // ── grouping helpers ──────────────────────────────────────────────────────
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

  // ── settlement engine ─────────────────────────────────────────────────────
  function computeNet(exps: ExpenseWithPeople[]) {
    const net: Record<string, number> = {};
    for (const exp of exps) {
      if (!exp.paidBy || exp.participants.length === 0) continue;
      net[exp.paidBy] = (net[exp.paidBy] ?? 0) + exp.amount;
      const totalWeight = exp.participants.reduce((s, p) => s + (p.shareCount ?? 1), 0);
      for (const p of exp.participants) {
        const owed = totalWeight > 0 ? ((p.shareCount ?? 1) / totalWeight) * exp.amount : 0;
        net[p.userId] = (net[p.userId] ?? 0) - owed;
      }
    }
    return net;
  }

  function buildSettlements(net: Record<string, number>, nameMap: Map<string, string>) {
    const owed: [string, number][] = [];
    const owes: [string, number][] = [];
    for (const [u, amt] of Object.entries(net)) {
      if (amt > 0.001) owed.push([u, amt]);
      if (amt < -0.001) owes.push([u, -amt]);
    }
    const res: { text: string; debtor: string; creditor: string; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < owes.length && j < owed.length) {
      const [dId, debt] = owes[i];
      const [cId, credit] = owed[j];
      const amt = Math.min(debt, credit);
      res.push({ text: `${nameMap.get(dId)} → ${nameMap.get(cId)}`, debtor: dId, creditor: cId, amount: amt });
      owes[i][1] -= amt;
      owed[j][1] -= amt;
      if (owes[i][1] <= 0.001) i++;
      if (owed[j][1] <= 0.001) j++;
    }
    return res;
  }

  function getSettlements(exps: ExpenseWithPeople[]) {
    if (exps.length === 0) return [];
    const nameMap = new Map<string, string>();
    exps.forEach((e) => e.participants.forEach((p) => nameMap.set(p.userId, p.displayName)));
    return buildSettlements(computeNet(exps), nameMap);
  }

  // ── render helpers ────────────────────────────────────────────────────────
  function SettlementRows({ exps }: { exps: ExpenseWithPeople[] }) {
    const rows = getSettlements(exps);
    if (rows.length === 0) return <div className="sl-empty" style={{ padding: "16px", fontSize: ".8rem" }}>All settled up ✓</div>;
    return (
      <>
        {rows.map((r, i) => {
          const isMe = r.debtor === currentUser.userId;
          return (
            <div key={i} className={`sl-settlement ${isMe ? "owes" : "owed"}`}>
              <span className="sl-s-text">{r.text}</span>
              <span className="sl-s-amount">${r.amount.toFixed(2)}</span>
            </div>
          );
        })}
      </>
    );
  }

  function ExpenseSection({ exps }: { exps: ExpenseWithPeople[] }) {
    if (exps.length === 0) return <div className="sl-empty">No expenses yet.</div>;
    return (
      <div className="sl-exp-list">
        {exps.map((expense) => {
          const payerName = expense.participants.find((p) => p.userId === expense.paidBy)?.displayName ?? "Unknown";
          return (
            <div key={expense.id} className="sl-exp-item">
              <div className="sl-paid-by">Paid by {payerName}</div>
              <ExpenseDetailCard
                expense={expense}
                currentUserId={currentUser.userId}
                onDeleted={() => setExpenses((prev) => prev.filter((e) => e.id !== expense.id))}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // ── selected view ─────────────────────────────────────────────────────────
  function SelectedView() {
    if (selected === "__summary__") {
      return (
        <>
          <div>
            <div className="sl-page-title">Summary</div>
            <div className="sl-page-sub">Your balances at a glance</div>
          </div>

          {directGroups.size > 0 && (
            <div>
              <div className="sl-card-label" style={{ marginBottom: 10 }}>Direct</div>
              <div className="sl-grid">
                {[...directGroups.entries()].map(([key, exps]) => (
                  <div key={key} className="sl-card" onClick={() => setSelected(key)} style={{ cursor: "pointer" }}>
                    <div className="sl-card-name">{key}</div>
                    <SettlementRows exps={exps} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {groups.length > 0 && (
            <div>
              <div className="sl-card-label" style={{ marginBottom: 10 }}>Groups</div>
              <div className="sl-grid">
                {groups.map((g) => {
                  const exps = groupExpenseMap.get(g.id) ?? [];
                  return (
                    <div key={g.id} className="sl-card" onClick={() => setSelected(g.id)} style={{ cursor: "pointer" }}>
                      <div className="sl-card-name">{g.name}</div>
                      <SettlementRows exps={exps} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      );
    }

    // direct group view
    if (directGroups.has(selected)) {
      const exps = directGroups.get(selected)!;
      return (
        <>
          <div className="sl-exp-header">
            <div>
              <div className="sl-page-title">{selected}</div>
              <div className="sl-page-sub">{exps.length} expense{exps.length !== 1 ? "s" : ""}</div>
            </div>
            <Link to="/expense/new" className="btn btn-primary">+ Add expense</Link>
          </div>
          <div className="sl-card">
            <div className="sl-card-label">Balances</div>
            <SettlementRows exps={exps} />
          </div>
          <ExpenseSection exps={exps} />
        </>
      );
    }

    // named group view
    const group = groups.find((g) => g.id === selected);
    if (group) {
      const exps = groupExpenseMap.get(group.id) ?? [];
      return (
        <>
          <div className="sl-exp-header">
            <div>
              <div className="sl-page-title">{group.name}</div>
              <div className="sl-page-sub">{exps.length} expense{exps.length !== 1 ? "s" : ""}</div>
            </div>
            <Link to="/expense/new" className="btn btn-primary">+ Add expense</Link>
          </div>
          <div className="sl-card">
            <div className="sl-card-label">Balances</div>
            <SettlementRows exps={exps} />
          </div>
          <ExpenseSection exps={exps} />
        </>
      );
    }

    return null;
  }

  // ── main render ───────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="sl-root">
        {/* top bar */}
        <header className="sl-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="sl-brand">Split<span>Lite</span> <span style={{ color: "#8b8fa8", fontWeight: 400 }}>2.0</span></div>
            <div className="sl-user">· {currentUser.displayName}</div>
          </div>
          <div className="sl-actions">
            <Link to="/expense/new" className="btn btn-primary">+ Add expense</Link>
            <Link to="/group/new" className="btn btn-ghost">New group</Link>
            <Link to="/auth" className="btn btn-ghost">Account</Link>
          </div>
        </header>

        {/* body */}
        <div className="sl-body">
          {/* sidebar */}
          <nav className="sl-sidebar">
            <div
              className={`sl-nav-item ${selected === "__summary__" ? "active" : ""}`}
              onClick={() => setSelected("__summary__")}
            >
              <div className="sl-nav-dot" />
              Summary
            </div>

            {directGroups.size > 0 && (
              <>
                <div className="sl-divider" />
                <div className="sl-section-label">Direct</div>
                {[...directGroups.keys()].map((key) => (
                  <div
                    key={key}
                    className={`sl-nav-item ${selected === key ? "active" : ""}`}
                    onClick={() => setSelected(key)}
                  >
                    <div className="sl-nav-dot" />
                    {key}
                  </div>
                ))}
              </>
            )}

            {groups.length > 0 && (
              <>
                <div className="sl-divider" />
                <div className="sl-section-label">Groups</div>
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className={`sl-nav-item ${selected === g.id ? "active" : ""}`}
                    onClick={() => setSelected(g.id)}
                  >
                    <div className="sl-nav-dot" />
                    {g.name}
                  </div>
                ))}
              </>
            )}
          </nav>

          {/* main content */}
          <main className="sl-content">
            {loading && (
              <div className="sl-loading">
                <div className="sl-spinner" />
              </div>
            )}
            {error && <div className="sl-error">⚠ {error}</div>}
            {!loading && !error && <SelectedView />}
          </main>
        </div>
      </div>
    </>
  );
}
