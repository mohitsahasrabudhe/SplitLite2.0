import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listMyExpenses,
  listParticipantsForExpense,
  listAllUsers,
  listMyGroups,
  listGroupMembers,
  currencySymbol,
} from "../api/expenses";
import type { FlatExpense, GroupType } from "../api/expenses";
import ExpenseDetailCard from "../components/ExpenseDetailCard";
import { BASE_CSS, initials, groupColor } from "./sharedStyles";
import { formatExpenseDate } from "../utils/splitCalc";

type RichExpense = FlatExpense & {
  participants: { userId: string; displayName: string; shareCount: number }[];
};

type DrillMode = "friend" | "group";

// ── settlement helpers ────────────────────────────────────────────────────────
type Settlement = {
  debtorId:    string;
  creditorId:  string;
  debtorName:  string;
  creditorName: string;
  amount:      number;
  currency:    string;
};

function computeSettlements(
  exps: RichExpense[],
  nameMap: Map<string, string>
): Settlement[] {
  // Group by currency first
  const byCurrency: Record<string, RichExpense[]> = {};
  for (const exp of exps) {
    const cur = exp.currency || "USD";
    if (!byCurrency[cur]) byCurrency[cur] = [];
    byCurrency[cur].push(exp);
  }

  const results: Settlement[] = [];

  for (const [currency, curExps] of Object.entries(byCurrency)) {
    const net: Record<string, number> = {};
    for (const exp of curExps) {
      if (!exp.paidBy || exp.participants.length === 0) continue;
      net[exp.paidBy] = (net[exp.paidBy] ?? 0) + exp.amount;
      const totalWeight = exp.participants.reduce((s, p) => s + (p.shareCount ?? 1), 0);
      for (const p of exp.participants) {
        const owed = totalWeight > 0 ? ((p.shareCount ?? 1) / totalWeight) * exp.amount : 0;
        net[p.userId] = (net[p.userId] ?? 0) - owed;
      }
    }
    const owed: [string, number][] = [];
    const owes: [string, number][] = [];
    for (const [u, amt] of Object.entries(net)) {
      if (amt > 0.01)  owed.push([u, amt]);
      if (amt < -0.01) owes.push([u, -amt]);
    }
    let i = 0, j = 0;
    while (i < owes.length && j < owed.length) {
      const [dId, debt]   = owes[i];
      const [cId, credit] = owed[j];
      const amt = Math.min(debt, credit);
      results.push({
        debtorId:    dId,
        creditorId:  cId,
        debtorName:  nameMap.get(dId) ?? dId,
        creditorName: nameMap.get(cId) ?? cId,
        amount:      amt,
        currency,
      });
      owes[i][1] -= amt; owed[j][1] -= amt;
      if (owes[i][1] <= 0.01) i++;
      if (owed[j][1] <= 0.01) j++;
    }
  }
  return results;
}

// ── component ─────────────────────────────────────────────────────────────────
export default function RelationshipDrillPage({ mode }: { mode: DrillMode }) {
  const { user } = useAuth();
  if (!user) return null;
  const myId = user.userId;
  const navigate = useNavigate();
  const { userId: friendId, groupId } = useParams<{ userId?: string; groupId?: string }>();

  const [allExpenses, setAllExpenses]       = useState<RichExpense[]>([]);
  const [groups, setGroups]                 = useState<GroupType[]>([]);
  const [userMap, setUserMap]               = useState<Map<string, { displayName: string; email: string }>>(new Map());
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedSetKey, setSelectedSetKey] = useState<string | null>(null);
  const [deletedIds, setDeletedIds]         = useState<Set<string>>(new Set());
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [rawExpenses, users, myGroups] = await Promise.all([
          listMyExpenses(myId),
          listAllUsers(),
          listMyGroups(myId),
        ]);
        const cleanUsers  = users.filter((u: any) => u?.id);
        const cleanGroups = myGroups.filter((g: any) => g?.id);
        setGroups(cleanGroups);

        const uMap = new Map<string, { displayName: string; email: string }>();
        cleanUsers.forEach((u: any) => uMap.set(u.id, { displayName: u.displayName ?? "Unknown", email: u.email ?? "" }));
        setUserMap(uMap);

        const rich: RichExpense[] = await Promise.all(
          rawExpenses.filter((e: any) => e?.id).map(async (exp: any) => {
            const parts = await listParticipantsForExpense(exp.id);
            return {
              ...exp,
              participants: parts.filter((p: any) => p?.userId).map((p: any) => ({
                userId:      p.userId,
                displayName: uMap.get(p.userId)?.displayName ?? "Unknown",
                shareCount:  p.shareCount ?? 1,
              })),
            };
          })
        );
        setAllExpenses(rich);

        if (mode === "group" && groupId) {
          try {
            const gm = await listGroupMembers(groupId);
            setGroupMemberIds(gm.filter((m: any) => m?.userId).map((m: any) => m.userId));
          } catch { /* silent */ }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally { setLoading(false); }
    })();
  }, [myId]);

  const relevantExpenses = useMemo(() => {
    const alive = allExpenses.filter(e => !deletedIds.has(e.id));
    if (mode === "friend" && friendId) {
      return alive.filter(e =>
        !e.groupId &&
        e.participants.some(p => p.userId === myId) &&
        e.participants.some(p => p.userId === friendId)
      );
    }
    if (mode === "group" && groupId) {
      return alive.filter(e => e.groupId === groupId);
    }
    return [];
  }, [allExpenses, mode, friendId, groupId, myId, deletedIds]);

  const participantSets = useMemo(() => {
    const setMap = new Map<string, RichExpense[]>();
    relevantExpenses.forEach(exp => {
      const key = exp.participants.map(p => p.userId).sort().join("|");
      if (!setMap.has(key)) setMap.set(key, []);
      setMap.get(key)!.push(exp);
    });
    return [...setMap.entries()].map(([key, exps]) => {
      const label = exps[0].participants
        .map(p => p.userId === myId ? "You" : (userMap.get(p.userId)?.displayName ?? p.displayName))
        .sort(a => a === "You" ? -1 : 1)
        .join(" + ");
      return { key, label, exps, count: exps.length };
    }).sort((a, b) => b.count - a.count);
  }, [relevantExpenses, myId, userMap]);

  useEffect(() => {
    if (!loading && selectedSetKey === null && participantSets.length > 0) {
      setSelectedSetKey(participantSets[0].key);
    }
  }, [loading, participantSets]);

  const selectedSet = participantSets.find(s => s.key === selectedSetKey) ?? null;

  const friendInfo  = mode === "friend" && friendId ? userMap.get(friendId) : null;
  const groupInfo   = mode === "group"  && groupId  ? groups.find(g => g.id === groupId) : null;
  const groupIdx    = groupInfo ? groups.indexOf(groupInfo) : 0;
  const groupCol    = groupColor(groupIdx);
  const contextName = mode === "friend" ? (friendInfo?.displayName ?? "Friend") : (groupInfo?.name ?? "Group");

  const contextAvatar = mode === "friend"
    ? <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--blue-bg)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".9rem" }}>{initials(contextName)}</div>
    : <div style={{ width: 40, height: 40, borderRadius: 11, background: groupCol.bg, color: groupCol.fg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: ".9rem" }}>{initials(contextName)}</div>;

  const settlements = useMemo(() => {
    if (!selectedSet) return [];
    const nameMap = new Map<string, string>();
    const allIds = new Set<string>();
    selectedSet.exps.forEach(e => e.participants.forEach(p => allIds.add(p.userId)));
    const nameCounts: Record<string, number> = {};
    allIds.forEach(uid => {
      if (uid === myId) return;
      const name = userMap.get(uid)?.displayName ?? "?";
      nameCounts[name] = (nameCounts[name] ?? 0) + 1;
    });
    allIds.forEach(uid => {
      if (uid === myId) { nameMap.set(uid, "You"); return; }
      const info = userMap.get(uid);
      const name = info?.displayName ?? "?";
      if (nameCounts[name] > 1 && info?.email) {
        const emailHint = info.email.split("@")[0].slice(0, 5);
        nameMap.set(uid, `${name} (${emailHint})`);
      } else {
        nameMap.set(uid, name);
      }
    });
    return computeSettlements(selectedSet.exps, nameMap).filter(s => s.amount > 0.01);
  }, [selectedSet, myId, userMap]);

  const payerName = (exp: RichExpense) => {
    if (!exp.paidBy) return "Unknown";
    if (exp.paidBy === myId) return "You";
    return userMap.get(exp.paidBy)?.displayName ?? exp.participants.find(p => p.userId === exp.paidBy)?.displayName ?? "Unknown";
  };

  return (
    <>
      <style>{BASE_CSS}</style>
      <div className="sl-root">
        <header className="sl-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="sl-back" onClick={() => navigate("/")}>← Back</button>
            <div style={{ width: 1, height: 18, background: "var(--border)" }} />
            {contextAvatar}
            <div>
              <div style={{ fontSize: ".95rem", fontWeight: 600 }}>{contextName}</div>
              <div style={{ fontSize: ".73rem", color: "var(--muted)" }}>
                {mode === "friend" ? `Your hangouts with ${contextName}` : `Hangouts in ${contextName}`}
              </div>
            </div>
          </div>
          <div className="sl-actions">
            <Link
              to={mode === "group" ? `/expense/new?groupId=${groupId}` : `/expense/new?friendId=${friendId}`}
              className="btn btn-primary"
            >+ <span className="btn-label">Add expense</span></Link>
          </div>
        </header>

        {loading ? (
          <div className="sl-loading"><div className="sl-spinner" /></div>
        ) : error ? (
          <div className="sl-error">⚠ {error}</div>
        ) : relevantExpenses.length === 0 ? (
          <div className="sl-empty-state" style={{ marginTop: 80 }}>
            <span className="icon">📭</span>
            <p>No expenses found here yet.<br />Add one to get started.</p>
            <Link to={mode === "group" ? `/expense/new?groupId=${groupId}` : `/expense/new?friendId=${friendId}`} className="btn btn-accent" style={{ marginTop: 8 }}>+ Add expense</Link>
          </div>
        ) : (
          <div className="sl-body">
            <nav className="sl-sidebar">
              <div className="sl-sidebar-scroll">
                <div className="sl-section-label">
                  {mode === "friend" ? `Hangouts with ${contextName}` : `Hangouts in ${contextName}`}
                </div>
                {participantSets.map(s => (
                  <div
                    key={s.key}
                    className={`sl-set-pill ${selectedSetKey === s.key ? "active" : ""}`}
                    onClick={() => setSelectedSetKey(s.key)}
                  >
                    <div className="sl-set-pill-icon">{s.exps[0].participants.length}</div>
                    <div className="sl-set-text">
                      <div className="sl-set-name">{s.label}</div>
                      <div className="sl-set-count">{s.count} expense{s.count !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            <div className="sl-panel">
              {selectedSet ? (
                <div className="sl-panel-inner">
                  <div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 600, letterSpacing: "-.3px" }}>{selectedSet.label}</div>
                    <div style={{ fontSize: ".82rem", color: "var(--muted)", marginTop: 3 }}>
                      {selectedSet.count} expense{selectedSet.count !== 1 ? "s" : ""} · {participantSets.length} hangout{participantSets.length !== 1 ? "s" : ""} with {contextName}
                    </div>
                  </div>

                  {/* settlements — now per currency */}
                  <div className="sl-section-card">
                    <div className="sl-section-card-header">
                      <span className="sl-section-card-title">Balances</span>
                    </div>
                    <div className="sl-section-card-body">
                      {settlements.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "8px 0", color: "var(--muted)", fontSize: ".83rem" }}>All settled up ✓</div>
                      ) : (
                        settlements.map((s, i) => {
                          const isMe  = s.debtorId === myId;
                          const cls   = isMe ? "owes" : "owed";
                          const label = isMe ? `You → ${s.creditorName}` : `${s.debtorName} → ${s.creditorId === myId ? "you" : s.creditorName}`;
                          const sym   = currencySymbol(s.currency);
                          return (
                            <div key={i} className={`sl-settlement ${cls}`}>
                              <span className="sl-s-text">{label}</span>
                              <span className="sl-s-amount">
                                {sym}{s.amount.toFixed(2)}
                                {s.currency !== "USD" && <span style={{ fontSize: ".72rem", marginLeft: 3, opacity: .7 }}>{s.currency}</span>}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* expense list */}
                  <div>
                    <div style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>
                      Expenses
                    </div>
                    <div className="sl-exp-list">
                      {selectedSet.exps
                        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
                        .map(expense => (
                          <div key={expense.id} className="sl-exp-item">
                            <div className="sl-paid-by">
                              Paid by {payerName(expense)}
                              {expense.createdAt && (
                                <span style={{ marginLeft: 8 }}>{formatExpenseDate(expense.createdAt)}</span>
                              )}
                            </div>
                            <ExpenseDetailCard
                              expense={expense}
                              currentUserId={myId}
                              onDeleted={() => setDeletedIds(prev => new Set([...prev, expense.id]))}
                              groupMemberIds={mode === "group" ? groupMemberIds : undefined}
                            />
                          </div>
                        ))}
                    </div>

                    <button
                      onClick={() => navigate("/")}
                      style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, background: "none", border: "none", color: "var(--muted)", fontSize: ".82rem", cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}
                    >
                      ← Back to overview
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sl-empty-state">
                  <span className="icon">👈</span>
                  <p>Select a hangout from the left to see expenses</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}