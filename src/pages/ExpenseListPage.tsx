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

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f8fa; --surface: #ffffff; --border: #ebebed;
    --text: #1a1a2e; --muted: #8b8fa8; --accent: #3ecfb2;
    --accent-bg: #edfaf7; --red: #ff6b6b; --red-bg: #fff0f0;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --radius: 14px;
  }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }

  /* ── topbar ── */
  .sl-root { min-height: 100vh; background: var(--bg); }
  .sl-topbar {
    position: sticky; top: 0; z-index: 40;
    background: rgba(247,248,250,.92);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 20px; height: 56px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
  }
  .sl-brand { font-size: 1rem; font-weight: 600; letter-spacing: -.3px; white-space: nowrap; flex-shrink: 0; }
  .sl-brand .accent { color: var(--accent); }
  .sl-brand .ver { color: var(--muted); font-weight: 400; font-size: .85rem; }

  /* topbar actions — icon buttons on mobile, text on desktop */
  .sl-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    padding: 8px 14px; border-radius: 10px; border: none;
    font-family: inherit; font-size: .83rem; font-weight: 500;
    cursor: pointer; text-decoration: none; transition: all .15s ease;
    white-space: nowrap;
  }
  .btn-primary { background: var(--text); color: #fff; }
  .btn-primary:hover { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--surface); color: var(--text); }
  /* hide text labels on small screens, show icon only */
  .btn-label { display: inline; }
  .btn-icon-only { display: none; }

  /* ── body ── */
  .sl-body { display: flex; max-width: 1100px; margin: 0 auto; padding: 20px 16px; gap: 18px; }

  /* ── sidebar ── */
  .sl-sidebar {
    width: 210px; flex-shrink: 0;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 10px 8px; height: fit-content;
    position: sticky; top: 72px;
  }
  .sl-section-label {
    font-size: .67rem; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--muted); padding: 8px 10px 3px;
  }
  .sl-nav-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 8px;
    font-size: .84rem; color: var(--text);
    cursor: pointer; transition: all .12s ease;
    overflow: hidden;
  }
  .sl-nav-item:hover { background: var(--bg); }
  .sl-nav-item.active { background: var(--accent-bg); color: var(--accent); font-weight: 500; }
  .sl-nav-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* nav icons */
  .sl-nav-icon {
    width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: .8rem; font-weight: 700;
  }
  .sl-nav-icon.direct { background: #e8f4fd; color: #4a90d9; }
  .sl-nav-icon.group  { background: var(--accent-bg); color: var(--accent); }
  .sl-nav-icon.summary { background: var(--bg); font-size: .9rem; }
  .sl-nav-item.active .sl-nav-icon.direct { background: rgba(74,144,217,.15); }
  .sl-nav-item.active .sl-nav-icon.group  { background: rgba(62,207,178,.2); }

  .sl-divider { height: 1px; background: var(--border); margin: 4px 8px; }

  /* ── content ── */
  .sl-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
  .sl-page-title { font-size: 1.35rem; font-weight: 600; letter-spacing: -.4px; }
  .sl-page-sub { font-size: .84rem; color: var(--muted); margin-top: 2px; }

  /* ── cards ── */
  .sl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .sl-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px 16px 14px;
    box-shadow: var(--shadow); transition: all .15s ease;
    position: relative; overflow: hidden;
  }
  .sl-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,.08); transform: translateY(-1px); }
  .sl-card-clickable { cursor: pointer; }

  /* card type strip on left edge */
  .sl-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  }
  .sl-card.type-direct::before { background: #4a90d9; }
  .sl-card.type-group::before  { background: var(--accent); }

  /* card header */
  .sl-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .sl-card-avatar {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: .85rem; font-weight: 700;
  }
  .sl-card-avatar.direct { background: #e8f4fd; color: #4a90d9; font-size: 1rem; }
  .sl-card-avatar.group  { background: var(--accent-bg); color: var(--accent); }
  .sl-card-meta { min-width: 0; }
  .sl-card-name { font-size: .92rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl-card-type-badge {
    font-size: .65rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    margin-top: 1px;
  }
  .sl-card-type-badge.direct { color: #4a90d9; }
  .sl-card-type-badge.group  { color: var(--accent); }

  /* settlement rows */
  .sl-settlement {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 10px; border-radius: 8px; margin-bottom: 4px; font-size: .82rem;
  }
  .sl-settlement.owes { background: var(--red-bg); }
  .sl-settlement.owed { background: var(--accent-bg); }
  .sl-s-text { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
  .sl-s-amount { font-family: 'DM Mono', monospace; font-weight: 500; font-size: .84rem; flex-shrink: 0; }
  .sl-settlement.owes .sl-s-amount { color: var(--red); }
  .sl-settlement.owed .sl-s-amount { color: var(--accent); }

  /* expense detail section */
  .sl-exp-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 16px;
  }
  .sl-exp-header-left { display: flex; align-items: center; gap: 12px; }
  .sl-exp-avatar {
    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
  }
  .sl-exp-avatar.direct { background: #e8f4fd; }
  .sl-exp-avatar.group  { background: var(--accent-bg); color: var(--accent); font-weight: 700; font-size: .95rem; }
  .sl-exp-list { display: flex; flex-direction: column; gap: 10px; }
  .sl-exp-item {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow);
  }
  .sl-paid-by { font-size: .75rem; color: var(--muted); margin-bottom: 6px; }

  /* empty / loading */
  .sl-empty { text-align: center; padding: 48px 20px; color: var(--muted); font-size: .88rem; }
  .sl-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
  .sl-spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sl-error { background: var(--red-bg); color: var(--red); padding: 12px 16px; border-radius: 10px; font-size: .85rem; }

  /* duplicate name warning */
  .sl-dupe-warning {
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
    padding: 10px 14px; font-size: .8rem; color: #92400e; margin-bottom: 4px;
  }

  /* ── mobile ── */
  @media (max-width: 640px) {
    .sl-topbar { padding: 0 12px; height: 52px; }
    /* on mobile show only icon, hide text for ghost buttons */
    .btn-ghost .btn-label { display: none; }
    .btn-ghost .btn-icon-only { display: inline; }
    .btn-ghost { padding: 8px 10px; }
    .btn-primary { padding: 8px 14px; font-size: .82rem; }

    .sl-body { flex-direction: column; padding: 10px 12px; gap: 10px; }
    .sl-sidebar {
      width: 100%; position: static;
      display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 6px;
      padding: 8px 10px; border-radius: 12px;
      scrollbar-width: none;
    }
    .sl-sidebar::-webkit-scrollbar { display: none; }
    .sl-section-label { display: none; }
    .sl-divider { display: none; }
    .sl-nav-item {
      flex: 0 0 auto; white-space: nowrap;
      padding: 7px 12px; border-radius: 20px; font-size: .8rem;
      border: 1px solid var(--border);
    }
    .sl-nav-item.active { border-color: transparent; }
    .sl-nav-icon { width: 20px; height: 20px; border-radius: 5px; font-size: .65rem; }
    .sl-grid { grid-template-columns: 1fr; }
    .sl-exp-header { flex-direction: column; gap: 10px; align-items: flex-start; }
    .sl-exp-header .btn { align-self: stretch; text-align: center; justify-content: center; }
  }
`;

// ── helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// Palette for group avatar backgrounds (cycles)
const GROUP_COLORS = [
  { bg: "#edfaf7", fg: "#2ab99e" },
  { bg: "#fce7f3", fg: "#db2777" },
  { bg: "#ede9fe", fg: "#7c3aed" },
  { bg: "#fef3c7", fg: "#d97706" },
  { bg: "#dbeafe", fg: "#2563eb" },
];

function groupColor(idx: number) { return GROUP_COLORS[idx % GROUP_COLORS.length]; }

type ExpenseWithPeople = FlatExpense & {
  participants: { userId: string; displayName: string; shareCount: number }[];
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

  // track which userIds have duplicate display names
  const [dupeIds, setDupeIds] = useState<Set<string>>(new Set());
  const [emailMap, setEmailMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [rawExpenses, users, myGroups] = await Promise.all([
          listMyExpenses(currentUser.userId),
          listAllUsers(),
          listMyGroups(currentUser.userId),
        ]);

        const cleanUsers = users.filter((u: any) => u && u.id);
        const cleanGroups = myGroups.filter((g: any) => g && g.id);
        setGroups(cleanGroups);

        // detect duplicate display names
        const nameCount = new Map<string, string[]>();
        cleanUsers.forEach((u: any) => {
          const dn = u.displayName ?? "";
          if (!nameCount.has(dn)) nameCount.set(dn, []);
          nameCount.get(dn)!.push(u.id);
        });
        const dupes = new Set<string>();
        nameCount.forEach((ids) => { if (ids.length > 1) ids.forEach(id => dupes.add(id)); });
        setDupeIds(dupes);

        // build email map for disambiguation
        const em = new Map<string, string>();
        cleanUsers.forEach((u: any) => { if (u.email) em.set(u.id, u.email); });
        setEmailMap(em);

        const userMap = new Map(cleanUsers.map((u: any) => [u.id, u.displayName]));

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

  // ── display name with disambiguation ──────────────────────────────────────
  function displayName(userId: string, name: string) {
    if (!dupeIds.has(userId)) return name;
    const email = emailMap.get(userId) ?? "";
    const short = email.split("@")[0];
    return `${name} (${short})`;
  }

  // ── grouping ──────────────────────────────────────────────────────────────
  const directGroups = useMemo(() => {
    const map = new Map<string, ExpenseWithPeople[]>();
    for (const exp of expenses) {
      if (exp.groupId) continue;
      // use userId-based key to avoid merging same-name different people
      const key = exp.participants
        .map((p) => p.userId)
        .sort()
        .join("|");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exp);
    }
    return map;
  }, [expenses]);

  // build human-readable label for each direct group key
  const directGroupLabels = useMemo(() => {
    const labels = new Map<string, string>();
    directGroups.forEach((exps, key) => {
      if (exps.length === 0) return;
      const label = exps[0].participants
        .map((p) => displayName(p.userId, p.displayName))
        .sort((a, b) => a.localeCompare(b))
        .join(" + ");
      labels.set(key, label);
    });
    return labels;
  }, [directGroups, dupeIds]);

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
    const res: { text: string; debtor: string; amount: number }[] = [];
    let i = 0, j = 0;
    while (i < owes.length && j < owed.length) {
      const [dId, debt] = owes[i];
      const [cId, credit] = owed[j];
      const amt = Math.min(debt, credit);
      res.push({ text: `${nameMap.get(dId)} → ${nameMap.get(cId)}`, debtor: dId, amount: amt });
      owes[i][1] -= amt; owed[j][1] -= amt;
      if (owes[i][1] <= 0.001) i++;
      if (owed[j][1] <= 0.001) j++;
    }
    return res;
  }

  function getSettlements(exps: ExpenseWithPeople[]) {
    if (exps.length === 0) return [];
    const nameMap = new Map<string, string>();
    exps.forEach((e) => e.participants.forEach((p) => nameMap.set(p.userId, displayName(p.userId, p.displayName))));
    return buildSettlements(computeNet(exps), nameMap);
  }

  // ── sub-components ────────────────────────────────────────────────────────
  function SettlementRows({ exps }: { exps: ExpenseWithPeople[] }) {
    const rows = getSettlements(exps);
    if (rows.length === 0) return (
      <div style={{ fontSize: ".78rem", color: "var(--muted)", padding: "6px 0" }}>All settled up ✓</div>
    );
    return (
      <>
        {rows.map((r, i) => (
          <div key={i} className={`sl-settlement ${r.debtor === currentUser.userId ? "owes" : "owed"}`}>
            <span className="sl-s-text">{r.text}</span>
            <span className="sl-s-amount">${r.amount.toFixed(2)}</span>
          </div>
        ))}
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
              <div className="sl-paid-by">Paid by {displayName(expense.paidBy ?? "", payerName)}</div>
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
              <div style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Direct</div>
              <div className="sl-grid">
                {[...directGroups.entries()].map(([key, exps]) => (
                  <div key={key} className="sl-card type-direct sl-card-clickable" onClick={() => setSelected(key)}>
                    <div className="sl-card-header">
                      <div className="sl-card-avatar direct">👥</div>
                      <div className="sl-card-meta">
                        <div className="sl-card-name">{directGroupLabels.get(key) ?? key}</div>
                        <div className="sl-card-type-badge direct">Direct split</div>
                      </div>
                    </div>
                    <SettlementRows exps={exps} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {groups.length > 0 && (
            <div>
              <div style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Groups</div>
              <div className="sl-grid">
                {groups.map((g, idx) => {
                  const col = groupColor(idx);
                  const exps = groupExpenseMap.get(g.id) ?? [];
                  return (
                    <div key={g.id} className="sl-card type-group sl-card-clickable" onClick={() => setSelected(g.id)}>
                      <div className="sl-card-header">
                        <div className="sl-card-avatar group" style={{ background: col.bg, color: col.fg }}>
                          {initials(g.name)}
                        </div>
                        <div className="sl-card-meta">
                          <div className="sl-card-name">{g.name}</div>
                          <div className="sl-card-type-badge group">Group</div>
                        </div>
                      </div>
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

    // direct split detail view
    if (directGroups.has(selected)) {
      const exps = directGroups.get(selected)!;
      const label = directGroupLabels.get(selected) ?? selected;
      return (
        <>
          <div className="sl-exp-header">
            <div className="sl-exp-header-left">
              <div className="sl-exp-avatar direct">👥</div>
              <div>
                <div className="sl-page-title">{label}</div>
                <div className="sl-page-sub">Direct · {exps.length} expense{exps.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <Link to="/expense/new" className="btn btn-primary">+ Add expense</Link>
          </div>
          <div className="sl-card type-direct">
            <div style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Balances</div>
            <SettlementRows exps={exps} />
          </div>
          <ExpenseSection exps={exps} />
        </>
      );
    }

    // named group detail view
    const group = groups.find((g) => g.id === selected);
    if (group) {
      const exps = groupExpenseMap.get(group.id) ?? [];
      const idx = groups.indexOf(group);
      const col = groupColor(idx);
      return (
        <>
          <div className="sl-exp-header">
            <div className="sl-exp-header-left">
              <div className="sl-exp-avatar group" style={{ background: col.bg, color: col.fg, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".95rem" }}>
                {initials(group.name)}
              </div>
              <div>
                <div className="sl-page-title">{group.name}</div>
                <div className="sl-page-sub">Group · {exps.length} expense{exps.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            <Link to="/expense/new" className="btn btn-primary">+ Add expense</Link>
          </div>
          <div className="sl-card type-group">
            <div style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Balances</div>
            <SettlementRows exps={exps} />
          </div>
          <ExpenseSection exps={exps} />
        </>
      );
    }

    return null;
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="sl-root">
        <header className="sl-topbar">
          <div className="sl-brand">
            Split<span className="accent">Lite</span> <span className="ver">2.0</span>
          </div>
          <div className="sl-actions">
            <Link to="/expense/new" className="btn btn-primary">
              + <span className="btn-label">Add expense</span>
            </Link>
            <Link to="/group/new" className="btn btn-ghost">
              <span className="btn-icon-only">👥</span>
              <span className="btn-label">New group</span>
            </Link>
            <Link to="/auth" className="btn btn-ghost">
              <span className="btn-icon-only">👤</span>
              <span className="btn-label">Account</span>
            </Link>
          </div>
        </header>

        <div className="sl-body">
          <nav className="sl-sidebar">
            <div className={`sl-nav-item ${selected === "__summary__" ? "active" : ""}`} onClick={() => setSelected("__summary__")}>
              <div className="sl-nav-icon summary">📊</div>
              <span className="sl-nav-text">Summary</span>
            </div>

            {directGroups.size > 0 && (
              <>
                <div className="sl-divider" />
                <div className="sl-section-label">Direct</div>
                {[...directGroups.keys()].map((key) => (
                  <div key={key} className={`sl-nav-item ${selected === key ? "active" : ""}`} onClick={() => setSelected(key)}>
                    <div className="sl-nav-icon direct">👥</div>
                    <span className="sl-nav-text">{directGroupLabels.get(key) ?? key}</span>
                  </div>
                ))}
              </>
            )}

            {groups.length > 0 && (
              <>
                <div className="sl-divider" />
                <div className="sl-section-label">Groups</div>
                {groups.map((g, idx) => {
                  const col = groupColor(idx);
                  return (
                    <div key={g.id} className={`sl-nav-item ${selected === g.id ? "active" : ""}`} onClick={() => setSelected(g.id)}>
                      <div className="sl-nav-icon group" style={{ background: col.bg, color: col.fg }}>
                        {initials(g.name)}
                      </div>
                      <span className="sl-nav-text">{g.name}</span>
                    </div>
                  );
                })}
              </>
            )}
          </nav>

          <main className="sl-content">
            {loading && <div className="sl-loading"><div className="sl-spinner" /></div>}
            {error && <div className="sl-error">⚠ {error}</div>}
            {!loading && !error && <SelectedView />}
          </main>
        </div>
      </div>
    </>
  );
}
