import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listMyExpenses,
  listParticipantsForExpense,
  listAllUsers,
  listMyGroups,
  listGroupMembers,
  addGroupMember,
  removeGroupMember,
  createExpense,
} from "../api/expenses";
import type { FlatExpense, GroupType } from "../api/expenses";
import {
  BASE_CSS, initials, groupColor, relativeTime,
} from "./sharedStyles";

// ── types ─────────────────────────────────────────────────────────────────────
type RichExpense = FlatExpense & {
  participants: { userId: string; displayName: string; email: string; shareCount: number }[];
};

type FriendSummary = {
  userId: string;
  displayName: string;
  email: string;
  netOwed: number; // positive = they owe me, negative = I owe them
  recentExpenses: RichExpense[];
  setBreakdown: { label: string; key: string; netOwed: number }[];
};

type GroupSummary = {
  group: GroupType;
  settlements: { debtorId: string; creditorId: string; debtorName: string; creditorName: string; amount: number }[];
  totalExpenses: number;
  memberCount: number;
  recentExpenses: RichExpense[];
  myPaid: number;
  myOwed: number;
};

// ── helpers ───────────────────────────────────────────────────────────────────
function calcShare(exp: RichExpense, userId: string): number {
  const p = exp.participants.find((x) => x.userId === userId);
  if (!p) return 0;
  const totalWeight = exp.participants.reduce((s, x) => s + (x.shareCount ?? 1), 0);
  if (exp.splitMethod === "EQUAL") return exp.amount / exp.participants.length;
  return totalWeight > 0 ? ((p.shareCount ?? 1) / totalWeight) * exp.amount : 0;
}

function netBetween(exps: RichExpense[], myId: string, friendId: string): number {
  let net = 0;
  for (const exp of exps) {
    const iAmIn = exp.participants.some((p) => p.userId === myId);
    const friendIn = exp.participants.some((p) => p.userId === friendId);
    if (!iAmIn || !friendIn) continue;
    const myShare = calcShare(exp, myId);
    const friendShare = calcShare(exp, friendId);
    if (exp.paidBy === myId) {
      net += friendShare;
    } else if (exp.paidBy === friendId) {
      net -= myShare;
    }
  }
  return net;
}

function computeSettlements(
  exps: RichExpense[],
  nameMap: Map<string, string>
): { debtorId: string; creditorId: string; debtorName: string; creditorName: string; amount: number }[] {
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
  const owed: [string, number][] = [];
  const owes: [string, number][] = [];
  for (const [u, amt] of Object.entries(net)) {
    if (amt > 0.01) owed.push([u, amt]);
    if (amt < -0.01) owes.push([u, -amt]);
  }
  const res: { debtorId: string; creditorId: string; debtorName: string; creditorName: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < owes.length && j < owed.length) {
    const [dId, debt] = owes[i];
    const [cId, credit] = owed[j];
    const amt = Math.min(debt, credit);
    res.push({ debtorId: dId, creditorId: cId, debtorName: nameMap.get(dId) ?? dId, creditorName: nameMap.get(cId) ?? cId, amount: amt });
    owes[i][1] -= amt; owed[j][1] -= amt;
    if (owes[i][1] <= 0.01) i++;
    if (owed[j][1] <= 0.01) j++;
  }
  return res;
}

// ── component ─────────────────────────────────────────────────────────────────
const EXTRA_CSS = `
  .sl-action-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .sl-action-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 14px; border-radius: 10px; border: 1.5px solid var(--border);
    font-family: inherit; font-size: .82rem; font-weight: 500;
    cursor: pointer; background: var(--surface); color: var(--text);
    text-decoration: none; transition: all .15s; white-space: nowrap;
  }
  .sl-action-btn:hover { background: var(--bg); border-color: var(--text); }
  .sl-action-btn.accent { background: var(--accent); border-color: var(--accent); color: #fff; }
  .sl-action-btn.accent:hover { background: var(--accent-dark); border-color: var(--accent-dark); }
  .sl-action-btn.danger { color: var(--red); border-color: #ffd0d0; }
  .sl-action-btn.danger:hover { background: var(--red-bg); }
  .sl-action-btn:disabled { opacity: .5; cursor: not-allowed; }

  .sl-settled-banner {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; border-radius: 11px;
    background: var(--accent-bg); border: 1px solid rgba(62,207,178,.25);
    font-size: .85rem; color: var(--accent); font-weight: 500;
    animation: fadeIn .3s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

  .sl-member-list { display: flex; flex-direction: column; gap: 6px; }
  .sl-member-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 12px; border-radius: 9px; background: var(--bg);
  }
  .sl-member-info { display: flex; align-items: center; gap: 9px; }
  .sl-member-av { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .sl-member-name { font-size: .85rem; font-weight: 500; }
  .sl-member-sub { font-size: .73rem; color: var(--muted); }
  .sl-member-remove { background: none; border: none; cursor: pointer; color: var(--muted); font-size: .8rem; padding: 4px 6px; border-radius: 6px; transition: all .12s; }
  .sl-member-remove:hover { background: var(--red-bg); color: var(--red); }
  .sl-add-result { padding: 9px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background .1s; font-size: .84rem; }
  .sl-add-result:hover { background: var(--bg); }

  /* Partial settle modal */
  .sl-modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.35); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 16px;
    animation: fadeIn .15s ease;
  }
  .sl-modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 24px; width: 100%; max-width: 360px;
    box-shadow: 0 20px 60px rgba(0,0,0,.2);
    animation: slideUp .2s ease;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .sl-modal-title { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
  .sl-modal-sub { font-size: .82rem; color: var(--muted); margin-bottom: 18px; }
  .sl-modal-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
  .sl-modal-option {
    display: flex; align-items: center; justify-content: space-between;
    padding: 11px 14px; border-radius: 11px;
    border: 1.5px solid var(--border); background: var(--bg);
    cursor: pointer; transition: all .15s; font-size: .87rem; font-weight: 500;
  }
  .sl-modal-option:hover { border-color: var(--accent); background: var(--accent-bg); }
  .sl-modal-option.selected { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); }
  .sl-modal-option-label { display: flex; flex-direction: column; gap: 2px; }
  .sl-modal-option-desc { font-size: .73rem; color: var(--muted); font-weight: 400; }
  .sl-modal-option.selected .sl-modal-option-desc { color: var(--accent-dark); }
  .sl-partial-wrap { display: flex; align-items: center; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg); overflow: hidden; transition: border-color .15s; }
  .sl-partial-wrap:focus-within { border-color: var(--accent); background: var(--surface); }
  .sl-partial-sym { padding: 10px 8px 10px 13px; font-size: .9rem; color: var(--muted); }
  .sl-partial-input { flex: 1; padding: 10px 13px 10px 2px; border: none; background: transparent; font-family: 'DM Mono', monospace; font-size: .92rem; color: var(--text); outline: none; }
  .sl-modal-actions { display: flex; gap: 8px; }
  .sl-modal-btn { flex: 1; padding: 11px; border-radius: 10px; border: none; font-family: inherit; font-size: .88rem; font-weight: 600; cursor: pointer; transition: all .15s; }
  .sl-modal-btn-primary { background: var(--text); color: #fff; }
  .sl-modal-btn-primary:hover:not(:disabled) { background: #2d2d45; }
  .sl-modal-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .sl-modal-btn-ghost { background: transparent; color: var(--muted); border: 1.5px solid var(--border); }
  .sl-modal-btn-ghost:hover { background: var(--bg); color: var(--text); }
`;

type Selected = { type: "friend"; userId: string } | { type: "group"; groupId: string } | { type: "me" } | null;

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  const myId = user.userId;

  const [allExpenses, setAllExpenses] = useState<RichExpense[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [userMap, setUserMap] = useState<Map<string, { displayName: string; email: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [rawExpenses, users, myGroups] = await Promise.all([
          listMyExpenses(myId),
          listAllUsers(),
          listMyGroups(myId),
        ]);

        const cleanUsers = users.filter((u: any) => u?.id);
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
                userId: p.userId,
                displayName: uMap.get(p.userId)?.displayName ?? "Unknown",
                email: uMap.get(p.userId)?.email ?? "",
                shareCount: p.shareCount ?? 1,
              })),
            };
          })
        );
        setAllExpenses(rich);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [myId]);

  const directExpenses = useMemo(() => allExpenses.filter((e) => !e.groupId), [allExpenses]);
  const groupExpenses = useMemo(() => allExpenses.filter((e) => !!e.groupId), [allExpenses]);

  const friends = useMemo((): FriendSummary[] => {
    const friendIds = new Set<string>();
    directExpenses.forEach((exp) => {
      exp.participants.forEach((p) => { if (p.userId !== myId) friendIds.add(p.userId); });
    });

    return [...friendIds].map((friendId) => {
      const info = userMap.get(friendId) ?? { displayName: "Unknown", email: "" };
      const relevantExps = directExpenses.filter((exp) =>
        exp.participants.some((p) => p.userId === myId) &&
        exp.participants.some((p) => p.userId === friendId)
      );
      const netOwed = netBetween(relevantExps, myId, friendId);

      const setMap = new Map<string, RichExpense[]>();
      relevantExps.forEach((exp) => {
        const key = exp.participants.map((p) => p.userId).sort().join("|");
        if (!setMap.has(key)) setMap.set(key, []);
        setMap.get(key)!.push(exp);
      });

      const setBreakdown = [...setMap.entries()].map(([key, exps]) => {
        const label = exps[0].participants
          .map((p) => p.userId === myId ? "You" : (userMap.get(p.userId)?.displayName ?? "?"))
          .sort((a) => a === "You" ? -1 : 1)
          .join(" + ");
        return { label, key, netOwed: netBetween(exps, myId, friendId) };
      }).filter((s) => Math.abs(s.netOwed) > 0.01);

      const recent = [...relevantExps].sort((a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      ).slice(0, 3);

      return { userId: friendId, displayName: info.displayName, email: info.email, netOwed, recentExpenses: recent, setBreakdown };
    }).sort((a, b) => Math.abs(b.netOwed) - Math.abs(a.netOwed));
  }, [directExpenses, myId, userMap]);

  const groupSummaries = useMemo((): GroupSummary[] => {
    return groups.map((g) => {
      const exps = groupExpenses.filter((e) => e.groupId === g.id);
      const nameMap = new Map<string, string>();
      exps.forEach((e) => e.participants.forEach((p) => nameMap.set(p.userId, p.userId === myId ? "You" : (userMap.get(p.userId)?.displayName ?? "?"))));

      const settlements = computeSettlements(exps, nameMap).filter((s) => s.amount > 0.01);
      const memberIds = new Set<string>();
      exps.forEach((e) => e.participants.forEach((p) => memberIds.add(p.userId)));

      let myPaid = 0, myOwed = 0;
      exps.forEach((exp) => {
        if (exp.paidBy === myId) myPaid += exp.amount;
        myOwed += calcShare(exp, myId);
      });

      const recent = [...exps].sort((a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      ).slice(0, 3);

      return { group: g, settlements, totalExpenses: exps.length, memberCount: memberIds.size, recentExpenses: recent, myPaid, myOwed };
    });
  }, [groups, groupExpenses, myId, userMap]);

  const selectedFriend = selected?.type === "friend" ? friends.find((f) => f.userId === selected.userId) ?? null : null;
  const selectedGroup = selected?.type === "group" ? groupSummaries.find((gs) => gs.group.id === selected.groupId) ?? null : null;

  useEffect(() => {
    if (!loading && selected === null) {
      if (friends.length > 0) setSelected({ type: "friend", userId: friends[0].userId });
      else if (groupSummaries.length > 0) setSelected({ type: "group", groupId: groupSummaries[0].group.id });
    }
  }, [loading, friends, groupSummaries]);

  function BalanceRow({ amount, label }: { amount: number; label: string }) {
    const cls = amount > 0.01 ? "owed" : amount < -0.01 ? "owes" : "neutral";
    const sign = amount > 0.01 ? "+" : "";
    return (
      <div className={`sl-breakdown-row ${cls}`}>
        <div className="sl-br-left">
          <div className={`sl-br-dot ${cls}`} />
          <span className="sl-br-text">{label}</span>
        </div>
        <span className={`sl-br-amount ${cls}`}>{sign}${Math.abs(amount).toFixed(2)}</span>
      </div>
    );
  }

  function FriendPanel({ f }: { f: FriendSummary }) {
    const [settled, setSettled]       = useState(false);
    const [showModal, setShowModal]   = useState(false);
    const [settleMode, setSettleMode] = useState<"full" | "partial">("full");
    const [partialAmt, setPartialAmt] = useState("");
    const [settling, setSettling]     = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    const netCls = f.netOwed > 0.01 ? "pos" : f.netOwed < -0.01 ? "neg" : "zero";
    const netLabel = f.netOwed > 0.01 ? `${f.displayName} owes you` : f.netOwed < -0.01 ? `You owe ${f.displayName}` : "All settled up";
    const ini = initials(f.displayName);
    const hasBalance = Math.abs(f.netOwed) > 0.01;
    const fullAmt = Math.abs(f.netOwed);

    async function handleSettle() {
      setModalError(null);
      const amtToSettle = settleMode === "full" ? fullAmt : parseFloat(partialAmt);
      if (settleMode === "partial") {
        if (isNaN(amtToSettle) || amtToSettle <= 0) return setModalError("Enter a valid amount.");
        if (amtToSettle > fullAmt + 0.01) return setModalError(`Can't settle more than $${fullAmt.toFixed(2)}.`);
      }
      setSettling(true);
      try {
        const debtorId   = f.netOwed > 0 ? f.userId : myId;
        const creditorId = f.netOwed > 0 ? myId : f.userId;
        // Settlement math:
        // netBetween: if paidBy===friendId → net -= myShare
        // paidBy=debtor, creditor gets shareCount=100, debtor gets 0
        // → creditor's myShare = full amount → net -= settledAmt ✓
        await createExpense({
          title: settleMode === "partial"
            ? `Partial settlement: ${f.displayName} ($${amtToSettle.toFixed(2)})`
            : `Settlement: ${f.displayName}`,
          amount: amtToSettle,
          splitMethod: "BY_SHARES",
          paidBy: debtorId,
          participantUserIds: [debtorId, creditorId],
          participantShareCounts: [0, 100],
        });
        setShowModal(false);
        setSettled(true);
        setTimeout(() => window.location.reload(), 1200);
      } catch { setModalError("Failed to save. Please try again."); }
      finally { setSettling(false); }
    }

    return (
      <>
        {/* Partial settle modal */}
        {showModal && (
          <div className="sl-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
            <div className="sl-modal">
              <div className="sl-modal-title">Settle up with {f.displayName}</div>
              <div className="sl-modal-sub">
                {f.netOwed > 0 ? `${f.displayName} owes you` : `You owe ${f.displayName}`} ${fullAmt.toFixed(2)} total
              </div>
              <div className="sl-modal-options">
                <div
                  className={`sl-modal-option ${settleMode === "full" ? "selected" : ""}`}
                  onClick={() => setSettleMode("full")}
                >
                  <div className="sl-modal-option-label">
                    <span>Settle everything</span>
                    <span className="sl-modal-option-desc">Mark the full ${fullAmt.toFixed(2)} as paid</span>
                  </div>
                  {settleMode === "full" && <span>✓</span>}
                </div>
                <div
                  className={`sl-modal-option ${settleMode === "partial" ? "selected" : ""}`}
                  onClick={() => setSettleMode("partial")}
                >
                  <div className="sl-modal-option-label">
                    <span>Partial payment</span>
                    <span className="sl-modal-option-desc">Enter a custom amount below</span>
                  </div>
                  {settleMode === "partial" && <span>✓</span>}
                </div>
              </div>
              {settleMode === "partial" && (
                <div className="sl-partial-wrap" style={{ marginBottom: 14 }}>
                  <span className="sl-partial-sym">$</span>
                  <input
                    className="sl-partial-input"
                    type="number" step="0.01" min="0.01" max={fullAmt}
                    placeholder={`max $${fullAmt.toFixed(2)}`}
                    value={partialAmt}
                    autoFocus
                    onChange={e => { setPartialAmt(e.target.value); setModalError(null); }}
                  />
                </div>
              )}
              {modalError && (
                <div style={{ fontSize: ".8rem", color: "var(--red)", background: "var(--red-bg)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
                  {modalError}
                </div>
              )}
              <div className="sl-modal-actions">
                <button className="sl-modal-btn sl-modal-btn-ghost" onClick={() => { setShowModal(false); setModalError(null); }}>Cancel</button>
                <button className="sl-modal-btn sl-modal-btn-primary" onClick={handleSettle} disabled={settling}>
                  {settling ? "Saving…" : settleMode === "full" ? `Settle $${fullAmt.toFixed(2)}` : "Confirm payment"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="sl-profile-header">
          <div className="sl-profile-avatar" style={{ background: "var(--blue-bg)", color: "var(--blue)" }}>{ini}</div>
          <div>
            <div className="sl-profile-name">{f.displayName}</div>
            {f.email && <div className="sl-profile-sub">{f.email}</div>}
          </div>
        </div>

        <div className="sl-action-row">
          <Link to={`/expense/new?friendId=${f.userId}`} className="sl-action-btn accent">
            + Add expense
          </Link>
          {hasBalance && !settled && (
            <button className="sl-action-btn" onClick={() => { setSettleMode("full"); setPartialAmt(""); setModalError(null); setShowModal(true); }}>
              💸 Settle up
            </button>
          )}
        </div>

        {settled && (
          <div className="sl-settled-banner">✅ Settled! Refreshing…</div>
        )}

        <div className="sl-net-hero">
          <div>
            <div className="sl-net-label">Net balance</div>
            <div className={`sl-net-amount ${netCls}`}>${Math.abs(f.netOwed).toFixed(2)}</div>
            <div className="sl-net-who">{netLabel}</div>
          </div>
          <div style={{ fontSize: "2rem" }}>{f.netOwed > 0.01 ? "💸" : f.netOwed < -0.01 ? "🤝" : "✅"}</div>
        </div>

        {f.setBreakdown.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">How it breaks down</span>
            </div>
            <div className="sl-section-card-body">
              {f.setBreakdown.map((s, i) => <BalanceRow key={i} amount={s.netOwed} label={s.label} />)}
            </div>
          </div>
        )}

        {f.recentExpenses.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">Recent activity</span>
            </div>
            <div className="sl-section-card-body" style={{ gap: 2 }}>
              {f.recentExpenses.map((exp) => (
                <div key={exp.id} className="sl-activity-row">
                  <div style={{ overflow: "hidden" }}>
                    <div className="sl-act-title">{exp.title}</div>
                    <div className="sl-act-meta">{relativeTime(exp.createdAt)}</div>
                  </div>
                  <span className="sl-act-amount">${exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to={`/friend/${f.userId}`} className="sl-see-details">
          <span>See all hangouts with {f.displayName}</span>
          <span className="sl-see-details-arrow">→</span>
        </Link>
      </>
    );
  }

  function GroupPanel({ gs }: { gs: GroupSummary }) {
    const { group, settlements, totalExpenses, memberCount, recentExpenses, myPaid, myOwed } = gs;
    const idx = groups.indexOf(group);
    const col = groupColor(idx);
    const ini = initials(group.name);
    const myNet = myPaid - myOwed;
    const myNetCls = myNet > 0.01 ? "pos" : myNet < -0.01 ? "neg" : "zero";

    const [showMembers, setShowMembers] = useState(false);
    const [memberList, setMemberList] = useState<{ userId: string; displayName: string; email: string }[]>([]);
    const [membersLoaded, setMembersLoaded] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");
    const [addingId, setAddingId] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);

    // FIX: portal refs for the search dropdown
    const memberSearchRef = useRef<HTMLInputElement>(null);
    const [searchRect, setSearchRect] = useState<DOMRect | null>(null);

    async function loadMembers() {
      if (membersLoaded) return;
      try {
        const raw = await listGroupMembers(group.id);
        setMemberList(raw.filter((m: any) => m?.userId).map((m: any) => ({
          userId: m.userId,
          displayName: userMap.get(m.userId)?.displayName ?? "Unknown",
          email: userMap.get(m.userId)?.email ?? "",
        })));
        setMembersLoaded(true);
      } catch { /* silent */ }
    }

    function toggleMembers() {
      const next = !showMembers;
      setShowMembers(next);
      if (next) loadMembers();
    }

    async function handleAdd(userId: string) {
      setAddingId(userId);
      try {
        await addGroupMember(group.id, userId);
        setMemberList(prev => [...prev, {
          userId,
          displayName: userMap.get(userId)?.displayName ?? "Unknown",
          email: userMap.get(userId)?.email ?? "",
        }]);
        setMemberSearch("");
        setSearchRect(null);
      } catch { /* silent */ }
      finally { setAddingId(null); }
    }

    async function handleRemove(userId: string) {
      if (userId === myId) return;
      setRemovingId(userId);
      try {
        const raw = await listGroupMembers(group.id);
        const target = raw.find((m: any) => m.userId === userId);
        if (target?.id) {
          await removeGroupMember(target.id);
          setMemberList(prev => prev.filter(m => m.userId !== userId));
        }
      } catch { /* silent */ }
      finally { setRemovingId(null); }
    }

    const memberIds = new Set(memberList.map(m => m.userId));
    const addCandidates = memberSearch
      ? [...userMap.entries()]
          .filter(([uid, info]) => !memberIds.has(uid) && (
            info.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
            info.displayName.toLowerCase().includes(memberSearch.toLowerCase())
          ))
          .slice(0, 5)
      : [];

    return (
      <>
        <div className="sl-profile-header">
          <div className="sl-profile-avatar" style={{ background: col.bg, color: col.fg }}>{ini}</div>
          <div>
            <div className="sl-profile-name">{group.name}</div>
            <div className="sl-profile-sub">{memberCount} member{memberCount !== 1 ? "s" : ""} · {totalExpenses} expense{totalExpenses !== 1 ? "s" : ""}</div>
          </div>
        </div>

        <div className="sl-action-row">
          <Link to={`/expense/new?groupId=${group.id}`} className="sl-action-btn accent">
            + Add expense
          </Link>
          <button className="sl-action-btn" onClick={toggleMembers}>
            {showMembers ? "Hide members" : "👥 Manage members"}
          </button>
        </div>

        {showMembers && (
          <div className="sl-section-card">
            <div className="sl-section-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="sl-section-card-title">Members</span>
              <span style={{ fontSize: ".72rem", color: "var(--muted)" }}>{memberList.length} total</span>
            </div>
            <div className="sl-section-card-body">
              {!membersLoaded ? (
                <div style={{ textAlign: "center", padding: "12px 0", color: "var(--muted)", fontSize: ".82rem" }}>Loading…</div>
              ) : (
                <div className="sl-member-list">
                  {memberList.map(m => {
                    const mCol = groupColor([...memberIds].indexOf(m.userId));
                    const isMe = m.userId === myId;
                    return (
                      <div key={m.userId} className="sl-member-row">
                        <div className="sl-member-info">
                          <div className="sl-member-av" style={{ background: mCol.bg, color: mCol.fg }}>
                            {initials(m.displayName)}
                          </div>
                          <div>
                            <div className="sl-member-name">{isMe ? `${m.displayName} (you)` : m.displayName}</div>
                            {m.email && <div className="sl-member-sub">{m.email}</div>}
                          </div>
                        </div>
                        {!isMe && (
                          <button
                            className="sl-member-remove"
                            onClick={() => handleRemove(m.userId)}
                            disabled={removingId === m.userId}
                            title="Remove from group"
                          >
                            {removingId === m.userId ? "…" : "✕"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* FIX: portal-based search dropdown so it's never clipped */}
              <div style={{ marginTop: 8, position: "relative" }}>
                <input
                  ref={memberSearchRef}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 9,
                    border: "1.5px solid var(--border)", background: "var(--bg)",
                    fontFamily: "inherit", fontSize: ".84rem", color: "var(--text)",
                    outline: "none",
                  }}
                  placeholder="Search by name or email to add…"
                  value={memberSearch}
                  onChange={e => {
                    setMemberSearch(e.target.value);
                    if (memberSearchRef.current)
                      setSearchRect(memberSearchRef.current.getBoundingClientRect());
                  }}
                  onFocus={() => {
                    if (!membersLoaded) loadMembers();
                    if (memberSearchRef.current)
                      setSearchRect(memberSearchRef.current.getBoundingClientRect());
                  }}
                  onBlur={() => {
                    // small delay so onMouseDown on a result fires first
                    setTimeout(() => setSearchRect(null), 150);
                  }}
                />

                {addCandidates.length > 0 && searchRect && createPortal(
                  <div style={{
                    position: "fixed",
                    top: searchRect.bottom + 4,
                    left: searchRect.left,
                    width: searchRect.width,
                    zIndex: 9999,
                    background: "var(--surface, #fff)",
                    border: "1px solid var(--border, #ebebed)",
                    borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                    overflow: "hidden",
                    fontFamily: "inherit",
                  }}>
                    {addCandidates.map(([uid, info]) => (
                      <div
                        key={uid}
                        className="sl-add-result"
                        onMouseDown={() => !addingId && handleAdd(uid)}
                      >
                        <div style={{
                          background: "var(--accent-bg, #edfaf7)",
                          color: "var(--accent, #3ecfb2)",
                          width: 28, height: 28, borderRadius: 7,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: ".68rem", fontWeight: 700, flexShrink: 0,
                        }}>
                          {initials(info.displayName)}
                        </div>
                        <div>
                          <div style={{ fontSize: ".84rem", fontWeight: 500 }}>{info.displayName}</div>
                          <div style={{ fontSize: ".72rem", color: "var(--muted, #8b8fa8)" }}>{info.email}</div>
                        </div>
                        {addingId === uid && (
                          <span style={{ marginLeft: "auto", fontSize: ".75rem", color: "var(--muted, #8b8fa8)" }}>Adding…</span>
                        )}
                      </div>
                    ))}
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>
        )}

        <div className="sl-net-hero">
          <div>
            <div className="sl-net-label">Your balance</div>
            <div className={`sl-net-amount ${myNetCls}`}>{myNet >= 0 ? "+" : ""}${Math.abs(myNet).toFixed(2)}</div>
            <div className="sl-net-who">
              {myNet > 0.01 ? "You're owed overall" : myNet < -0.01 ? "You owe overall" : "You're settled up"}
            </div>
          </div>
          <div style={{ fontSize: "2rem" }}>{myNet > 0.01 ? "💸" : myNet < -0.01 ? "🤝" : "✅"}</div>
        </div>

        {settlements.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">Who owes what</span>
            </div>
            <div className="sl-section-card-body">
              {settlements.map((s, i) => {
                const isMe = s.debtorId === myId;
                const label = isMe ? `You → ${s.creditorName}` : `${s.debtorName} → ${s.creditorId === myId ? "you" : s.creditorName}`;
                return <BalanceRow key={i} amount={isMe ? -s.amount : s.amount} label={label} />;
              })}
            </div>
          </div>
        )}

        {settlements.length === 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-body">
              <div style={{ textAlign: "center", padding: "12px 0", color: "var(--muted)", fontSize: ".85rem" }}>All settled up in this group ✓</div>
            </div>
          </div>
        )}

        <div className="sl-section-card">
          <div className="sl-section-card-header">
            <span className="sl-section-card-title">Your stats</span>
          </div>
          <div className="sl-section-card-body">
            <div className="sl-breakdown-row neutral">
              <div className="sl-br-left"><div className="sl-br-dot neutral" /><span className="sl-br-text">You've paid</span></div>
              <span className="sl-br-amount" style={{ color: "var(--text)" }}>${myPaid.toFixed(2)}</span>
            </div>
            <div className="sl-breakdown-row neutral">
              <div className="sl-br-left"><div className="sl-br-dot neutral" /><span className="sl-br-text">Your share</span></div>
              <span className="sl-br-amount" style={{ color: "var(--text)" }}>${myOwed.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {recentExpenses.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">Recent activity</span>
            </div>
            <div className="sl-section-card-body" style={{ gap: 2 }}>
              {recentExpenses.map((exp) => (
                <div key={exp.id} className="sl-activity-row">
                  <div style={{ overflow: "hidden" }}>
                    <div className="sl-act-title">{exp.title}</div>
                    <div className="sl-act-meta">{relativeTime(exp.createdAt)}</div>
                  </div>
                  <span className="sl-act-amount">${exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to={`/group/${group.id}`} className="sl-see-details">
          <span>See all hangouts in {group.name}</span>
          <span className="sl-see-details-arrow">→</span>
        </Link>
      </>
    );
  }

  function MePanel() {
    const friendsNet = friends.reduce((s, f) => s + f.netOwed, 0);
    const groupsNet = groupSummaries.reduce((s, gs) => s + (gs.myPaid - gs.myOwed), 0);
    const overallNet = friendsNet + groupsNet;
    const isPos = overallNet > 0.01;
    const isNeg = overallNet < -0.01;

    return (
      <>
        {/* header */}
        <div className="sl-profile-header">
          <div className="sl-profile-avatar" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
            {initials(user!.displayName)}
          </div>
          <div>
            <div className="sl-profile-name">{user!.displayName}</div>
            <div className="sl-profile-sub">Your overall picture</div>
          </div>
        </div>

        {/* big net number */}
        <div className="sl-net-hero">
          <div>
            <div className="sl-net-label">Overall balance</div>
            <div className={`sl-net-amount ${isPos ? "pos" : isNeg ? "neg" : "zero"}`}>
              {isPos ? "+" : ""}{overallNet < 0 ? "-" : ""}${Math.abs(overallNet).toFixed(2)}
            </div>
            <div className="sl-net-who">
              {isPos ? "overall you're owed" : isNeg ? "overall you owe" : "all settled up 🎉"}
            </div>
          </div>
          <div style={{ fontSize: "2rem" }}>{isPos ? "💸" : isNeg ? "🤝" : "✅"}</div>
        </div>

        {/* per-friend breakdown */}
        {friends.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">Friends</span>
              <span style={{ fontSize: ".72rem", color: "var(--muted)" }}>
                {friendsNet > 0.01 ? `+$${friendsNet.toFixed(2)} owed to you` : friendsNet < -0.01 ? `-$${Math.abs(friendsNet).toFixed(2)} you owe` : "settled"}
              </span>
            </div>
            <div className="sl-section-card-body">
              {friends.map(f => {
                const cls = f.netOwed > 0.01 ? "owed" : f.netOwed < -0.01 ? "owes" : "neutral";
                const sign = f.netOwed > 0.01 ? "+" : "";
                return (
                  <div
                    key={f.userId}
                    className={`sl-breakdown-row ${cls}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected({ type: "friend", userId: f.userId })}
                  >
                    <div className="sl-br-left">
                      <div className={`sl-br-dot ${cls}`} />
                      <span className="sl-br-text">{f.displayName}</span>
                    </div>
                    <span className={`sl-br-amount ${cls}`}>
                      {Math.abs(f.netOwed) > 0.01 ? `${sign}$${Math.abs(f.netOwed).toFixed(2)}` : "settled"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* per-group breakdown */}
        {groupSummaries.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">Groups</span>
              <span style={{ fontSize: ".72rem", color: "var(--muted)" }}>
                {groupsNet > 0.01 ? `+$${groupsNet.toFixed(2)} owed to you` : groupsNet < -0.01 ? `-$${Math.abs(groupsNet).toFixed(2)} you owe` : "settled"}
              </span>
            </div>
            <div className="sl-section-card-body">
              {groupSummaries.map(gs => {
                const net = gs.myPaid - gs.myOwed;
                const cls = net > 0.01 ? "owed" : net < -0.01 ? "owes" : "neutral";
                const sign = net > 0.01 ? "+" : "";
                return (
                  <div
                    key={gs.group.id}
                    className={`sl-breakdown-row ${cls}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected({ type: "group", groupId: gs.group.id })}
                  >
                    <div className="sl-br-left">
                      <div className={`sl-br-dot ${cls}`} />
                      <span className="sl-br-text">{gs.group.name}</span>
                    </div>
                    <span className={`sl-br-amount ${cls}`}>
                      {Math.abs(net) > 0.01 ? `${sign}$${Math.abs(net).toFixed(2)}` : "settled"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  // ── main render ───────────────────────────────────────────────────────────
  return (
    <>
      <style>{BASE_CSS}{EXTRA_CSS}</style>
      <div className="sl-root">
        <header className="sl-topbar">
          <Link to="/" className="sl-brand">Split<span className="a">Lite</span> <span className="v">2.0</span></Link>
          <div className="sl-actions">
            <Link to="/expense/new" className="btn btn-primary">+ <span className="btn-label">Add expense</span></Link>
            <Link to="/group/new" className="btn btn-ghost">
              <span className="btn-icon-only">👥</span><span className="btn-label">New group</span>
            </Link>
            <Link to="/auth?account=1 " className="btn btn-ghost">
              <span className="btn-icon-only">👤</span><span className="btn-label">Account</span>
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="sl-loading"><div className="sl-spinner" /></div>
        ) : error ? (
          <div className="sl-error">⚠ {error}</div>
        ) : (
          <div className="sl-body">
            <nav className="sl-sidebar">
              <div className="sl-sidebar-scroll">

                {/* ── ME overview ── */}
                {(friends.length > 0 || groupSummaries.length > 0) && (() => {
                  const friendsNet = friends.reduce((s, f) => s + f.netOwed, 0);
                  const groupsNet = groupSummaries.reduce((s, gs) => s + (gs.myPaid - gs.myOwed), 0);
                  const overallNet = friendsNet + groupsNet;
                  const isPos = overallNet > 0.01;
                  const isNeg = overallNet < -0.01;
                  return (
                    <div
                      onClick={() => setSelected({ type: "me" })}
                      style={{
                        margin: "0 0 12px 0",
                        padding: "14px 16px",
                        borderRadius: 12,
                        background: selected?.type === "me" ? (isPos ? "#c8f0e8" : isNeg ? "#ffd0d0" : "var(--border)") : (isPos ? "var(--accent-bg)" : isNeg ? "var(--red-bg)" : "var(--bg)"),
                        border: `1px solid ${isPos ? "rgba(62,207,178,.25)" : isNeg ? "rgba(255,107,107,.2)" : "var(--border)"}`,
                        cursor: "pointer",
                        transition: "background .15s",
                      }}
                    >
                      <div style={{ fontSize: ".7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                        {user.displayName}
                      </div>
                      <div style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        letterSpacing: "-.02em",
                        color: isPos ? "var(--accent)" : isNeg ? "var(--red)" : "var(--muted)",
                      }}>
                        {isPos ? "+" : ""}{overallNet < 0 ? "-" : ""}${Math.abs(overallNet).toFixed(2)}
                      </div>
                      <div style={{ fontSize: ".75rem", color: "var(--muted)", marginTop: 3 }}>
                        {isPos ? "overall you're owed" : isNeg ? "overall you owe" : "all settled up"}
                      </div>
                    </div>
                  );
                })()}

                {friends.length > 0 && (
                  <>
                    <div className="sl-section-label">Friends</div>
                    {friends.map((f) => {
                      const isSel = selected?.type === "friend" && selected.userId === f.userId;
                      const balCls = f.netOwed > 0.01 ? "pos" : f.netOwed < -0.01 ? "neg" : "zero";
                      const balSign = f.netOwed > 0.01 ? "+" : "";
                      return (
                        <div key={f.userId} className={`sl-nav-item ${isSel ? "active" : ""}`} onClick={() => setSelected({ type: "friend", userId: f.userId })}>
                          <div className="sl-nav-icon person">{initials(f.displayName)}</div>
                          <div className="sl-nav-text">
                            <div className="sl-nav-name">{f.displayName}</div>
                          </div>
                          {Math.abs(f.netOwed) > 0.01 && (
                            <span className={`sl-nav-bal ${balCls}`}>{balSign}${Math.abs(f.netOwed).toFixed(0)}</span>
                          )}
                        </div>
                      );
                    })}
                    {groups.length > 0 && <div className="sl-divider" style={{ margin: "8px 0" }} />}
                  </>
                )}

                {groups.length > 0 && (
                  <>
                    <div className="sl-section-label">Groups</div>
                    {groupSummaries.map((gs, idx) => {
                      const col = groupColor(idx);
                      const isSel = selected?.type === "group" && selected.groupId === gs.group.id;
                      const myNet = gs.myPaid - gs.myOwed;
                      const balCls = myNet > 0.01 ? "pos" : myNet < -0.01 ? "neg" : "zero";
                      return (
                        <div key={gs.group.id} className={`sl-nav-item ${isSel ? "active" : ""}`} onClick={() => setSelected({ type: "group", groupId: gs.group.id })}>
                          <div className="sl-nav-icon group" style={{ background: col.bg, color: col.fg }}>{initials(gs.group.name)}</div>
                          <div className="sl-nav-text">
                            <div className="sl-nav-name">{gs.group.name}</div>
                          </div>
                          {Math.abs(myNet) > 0.01 && (
                            <span className={`sl-nav-bal ${balCls}`}>{myNet > 0 ? "+" : ""}${Math.abs(myNet).toFixed(0)}</span>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {friends.length === 0 && groups.length === 0 && (
                  <div style={{ padding: "16px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: "1.4rem" }}>👋</div>
                    <div style={{ fontSize: ".78rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
                      Add your first expense and friends will appear here automatically.
                    </div>
                    <Link to="/expense/new" style={{ marginTop: 4, fontSize: ".78rem", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                      + Add expense →
                    </Link>
                  </div>
                )}
              </div>
            </nav>

            <div className="sl-panel">
              {selected?.type === "me" && (
                <div className="sl-panel-inner"><MePanel /></div>
              )}
              {selectedFriend && (
                <div className="sl-panel-inner"><FriendPanel f={selectedFriend} /></div>
              )}
              {selectedGroup && (
                <div className="sl-panel-inner"><GroupPanel gs={selectedGroup} /></div>
              )}
              {!selectedFriend && !selectedGroup && friends.length === 0 && groups.length === 0 && (
                <div className="sl-panel-inner" style={{ alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
                  <div style={{ maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: "3rem" }}>💸</div>
                    <div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 6 }}>Welcome to SplitLite!</div>
                      <div style={{ fontSize: ".88rem", color: "var(--muted)", lineHeight: 1.6 }}>
                        Add an expense with a friend and they'll appear in your sidebar automatically. No need to add friends manually.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                      <Link to="/expense/new" className="btn btn-primary">+ Add your first expense</Link>
                      <Link to="/group/new" className="btn btn-ghost">Create a group</Link>
                    </div>
                    <div style={{ marginTop: 8, padding: "14px 18px", background: "var(--accent-bg)", borderRadius: 12, fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.6, textAlign: "left" }}>
                      <strong style={{ color: "var(--accent)", display: "block", marginBottom: 4 }}>How it works</strong>
                      Add an expense → pick who split it → SplitLite tracks who owes who automatically. Friends appear in the sidebar once you share an expense with them.
                    </div>
                  </div>
                </div>
              )}
              {!selectedFriend && !selectedGroup && selected?.type !== "me" && (friends.length > 0 || groups.length > 0) && (
                <div className="sl-empty-state">
                  <span className="icon">👈</span>
                  <p>Select a friend or group from the sidebar to see your balance</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}