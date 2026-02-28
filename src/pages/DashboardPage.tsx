import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listMyExpenses, listParticipantsForExpense, listAllUsers,
  listMyGroups, listGroupMembers, addGroupMember, removeGroupMember,
  createExpense, deleteGroup, currencySymbol, formatAmount,
} from "../api/expenses";
import type { FlatExpense, GroupType } from "../api/expenses";
import { BASE_CSS, initials, groupColor, relativeTime } from "./sharedStyles";

// ── types ─────────────────────────────────────────────────────────────────────
type RichExpense = FlatExpense & {
  participants: { userId: string; displayName: string; email: string; shareCount: number }[];
};

// Per-currency balance map: { "USD": 12.50, "EUR": -5.00 }
type CurrencyMap = Record<string, number>;

type FriendSummary = {
  userId:         string;
  displayName:    string;
  email:          string;
  netByCurrency:  CurrencyMap;   // positive = they owe me, negative = I owe them
  recentExpenses: RichExpense[];
};

type Settlement = {
  debtorId:    string;
  creditorId:  string;
  debtorName:  string;
  creditorName: string;
  amount:      number;
  currency:    string;
};

type GroupSummary = {
  group:          GroupType;
  settlements:    Settlement[];
  totalExpenses:  number;
  memberCount:    number;
  recentExpenses: RichExpense[];
  myPaidByCurrency: CurrencyMap;
  myOwedByCurrency: CurrencyMap;
};

// ── helpers ───────────────────────────────────────────────────────────────────
function addToMap(map: CurrencyMap, currency: string, amount: number): CurrencyMap {
  return { ...map, [currency]: (map[currency] ?? 0) + amount };
}

function calcShare(exp: RichExpense, userId: string): number {
  const p = exp.participants.find(x => x.userId === userId);
  if (!p) return 0;
  const totalWeight = exp.participants.reduce((s, x) => s + (x.shareCount ?? 1), 0);
  if (exp.splitMethod === "EQUAL") return exp.amount / exp.participants.length;
  return totalWeight > 0 ? ((p.shareCount ?? 1) / totalWeight) * exp.amount : 0;
}

// Net between two people, grouped by currency
function netBetweenByCurrency(exps: RichExpense[], myId: string, friendId: string): CurrencyMap {
  const map: CurrencyMap = {};
  for (const exp of exps) {
    const iAmIn    = exp.participants.some(p => p.userId === myId);
    const friendIn = exp.participants.some(p => p.userId === friendId);
    if (!iAmIn || !friendIn) continue;
    const cur         = exp.currency || "USD";
    const myShare     = calcShare(exp, myId);
    const friendShare = calcShare(exp, friendId);
    if (exp.paidBy === myId) {
      map[cur] = (map[cur] ?? 0) + friendShare;
    } else if (exp.paidBy === friendId) {
      map[cur] = (map[cur] ?? 0) - myShare;
    }
  }
  // Remove near-zero entries
  return Object.fromEntries(Object.entries(map).filter(([, v]) => Math.abs(v) > 0.001));
}

// Compute settlements per currency
function computeSettlements(exps: RichExpense[], nameMap: Map<string, string>): Settlement[] {
  // Group expenses by currency
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

// ── extra CSS ─────────────────────────────────────────────────────────────────
const EXTRA_CSS = `
  /* sidebar nav overrides */
  .sl-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px; border-radius: 11px; cursor: pointer;
    transition: background .12s; margin-bottom: 2px;
  }
  .sl-nav-item:hover { background: var(--bg); }
  .sl-nav-item.active { background: var(--border); }

  .sl-nav-icon.person {
    width: 36px; height: 36px; border-radius: 50%;
    background: #e8f0fe; color: #4a7af5;
    display: flex; align-items: center; justify-content: center;
    font-size: .72rem; font-weight: 700; flex-shrink: 0;
  }
  .sl-nav-icon.group {
    width: 36px; height: 36px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: .72rem; font-weight: 700; flex-shrink: 0;
  }

  .sl-nav-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .sl-nav-name { font-size: .84rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl-nav-sub  { font-size: .72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl-nav-sub.pos   { color: var(--accent); font-weight: 600; }
  .sl-nav-sub.neg   { color: var(--red);    font-weight: 600; }
  .sl-nav-sub.muted { color: var(--muted); }
  .sl-nav-bal { display: none; }

  .sl-section-label {
    font-size: .68rem; font-weight: 700; letter-spacing: .09em;
    text-transform: uppercase; color: var(--muted);
    padding: 4px 10px 6px; margin-top: 4px;
  }

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

  .sl-settled-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 11px; background: var(--accent-bg); border: 1px solid rgba(62,207,178,.25); font-size: .85rem; color: var(--accent); font-weight: 500; animation: fadeIn .3s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

  .sl-member-list { display: flex; flex-direction: column; gap: 6px; }
  .sl-member-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; border-radius: 9px; background: var(--bg); }
  .sl-member-info { display: flex; align-items: center; gap: 9px; }
  .sl-member-av { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: .72rem; font-weight: 700; flex-shrink: 0; }
  .sl-member-name { font-size: .85rem; font-weight: 500; }
  .sl-member-sub { font-size: .73rem; color: var(--muted); }
  .sl-member-remove { background: none; border: none; cursor: pointer; color: var(--muted); font-size: .8rem; padding: 4px 6px; border-radius: 6px; transition: all .12s; }
  .sl-member-remove:hover { background: var(--red-bg); color: var(--red); }
  .sl-add-result { padding: 9px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background .1s; font-size: .84rem; }
  .sl-add-result:hover { background: var(--bg); }

  /* currency balance list */
  .sl-curr-balances { display: flex; flex-direction: column; gap: 6px; }
  .sl-curr-balance-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; background: var(--bg); border: 1px solid var(--border); }
  .sl-curr-balance-row.pos { background: var(--accent-bg); border-color: rgba(62,207,178,.2); }
  .sl-curr-balance-row.neg { background: var(--red-bg); border-color: rgba(255,107,107,.15); }
  .sl-curr-label { font-size: .84rem; font-weight: 500; }
  .sl-curr-amount { font-family: 'DM Mono', monospace; font-size: .88rem; font-weight: 600; }
  .sl-curr-amount.pos { color: var(--accent); }
  .sl-curr-amount.neg { color: var(--red); }
  .sl-curr-settle-btn { padding: 5px 12px; border-radius: 7px; border: 1.5px solid var(--accent); background: transparent; color: var(--accent); font-family: inherit; font-size: .77rem; font-weight: 600; cursor: pointer; transition: all .12s; white-space: nowrap; }
  .sl-curr-settle-btn:hover { background: var(--accent); color: #fff; }

  /* settle modal */
  .sl-modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.35); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn .15s ease; }
  .sl-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; width: 100%; max-width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,.2); animation: slideUp .2s ease; }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .sl-modal-title { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
  .sl-modal-sub { font-size: .82rem; color: var(--muted); margin-bottom: 18px; }
  .sl-modal-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
  .sl-modal-option { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; border-radius: 11px; border: 1.5px solid var(--border); background: var(--bg); cursor: pointer; transition: all .15s; font-size: .87rem; font-weight: 500; }
  .sl-modal-option:hover { border-color: var(--accent); background: var(--accent-bg); }
  .sl-modal-option.selected { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); }
  .sl-modal-option-label { display: flex; flex-direction: column; gap: 2px; }
  .sl-modal-option-desc { font-size: .73rem; color: var(--muted); font-weight: 400; }
  .sl-modal-option.selected .sl-modal-option-desc { color: var(--accent-dark); }
  .sl-partial-wrap { display: flex; align-items: center; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg); overflow: hidden; transition: border-color .15s; }
  .sl-partial-wrap:focus-within { border-color: var(--accent); background: var(--surface); }
  .sl-partial-sym { padding: 10px 8px 10px 13px; font-size: .9rem; color: var(--muted); font-family: 'DM Mono', monospace; }
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
  const [groups, setGroups]           = useState<GroupType[]>([]);
  const [userMap, setUserMap]         = useState<Map<string, { displayName: string; email: string }>>(new Map());
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [selected, setSelected]       = useState<Selected>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [rawExpenses, users, myGroups] = await Promise.all([
          listMyExpenses(myId), listAllUsers(), listMyGroups(myId),
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
                email:       uMap.get(p.userId)?.email ?? "",
                shareCount:  p.shareCount ?? 1,
              })),
            };
          })
        );
        setAllExpenses(rich);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally { setLoading(false); }
    })();
  }, [myId]);

  const directExpenses = useMemo(() => allExpenses.filter(e => !e.groupId), [allExpenses]);
  const groupExpenses  = useMemo(() => allExpenses.filter(e => !!e.groupId), [allExpenses]);

  const friends = useMemo((): FriendSummary[] => {
    const friendIds = new Set<string>();
    directExpenses.forEach(exp => exp.participants.forEach(p => { if (p.userId !== myId) friendIds.add(p.userId); }));

    return [...friendIds].map(friendId => {
      const info         = userMap.get(friendId) ?? { displayName: "Unknown", email: "" };
      const relevantExps = directExpenses.filter(exp =>
        exp.participants.some(p => p.userId === myId) &&
        exp.participants.some(p => p.userId === friendId)
      );
      const netByCurrency = netBetweenByCurrency(relevantExps, myId, friendId);
      const recent = [...relevantExps]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 3);
      return { userId: friendId, displayName: info.displayName, email: info.email, netByCurrency, recentExpenses: recent };
    }).sort((a, b) => {
      // Sort by total absolute debt across currencies
      const aTotal = Object.values(a.netByCurrency).reduce((s, v) => s + Math.abs(v), 0);
      const bTotal = Object.values(b.netByCurrency).reduce((s, v) => s + Math.abs(v), 0);
      return bTotal - aTotal;
    });
  }, [directExpenses, myId, userMap]);

  const groupSummaries = useMemo((): GroupSummary[] => {
    return groups.map(g => {
      const exps = groupExpenses.filter(e => e.groupId === g.id);
      const nameMap = new Map<string, string>();
      // First pass: collect all display names to detect duplicates
      const allParticipantIds = new Set<string>();
      exps.forEach(e => e.participants.forEach(p => allParticipantIds.add(p.userId)));
      const nameCounts: Record<string, number> = {};
      allParticipantIds.forEach(uid => {
        if (uid === myId) return;
        const name = userMap.get(uid)?.displayName ?? "?";
        nameCounts[name] = (nameCounts[name] ?? 0) + 1;
      });
      // Second pass: build nameMap, adding email hint for duplicate names
      allParticipantIds.forEach(uid => {
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
      const settlements = computeSettlements(exps, nameMap).filter(s => s.amount > 0.01);
      const memberIds   = new Set<string>();
      exps.forEach(e => e.participants.forEach(p => memberIds.add(p.userId)));

      let myPaidByCurrency: CurrencyMap = {};
      let myOwedByCurrency: CurrencyMap = {};
      exps.forEach(exp => {
        const cur = exp.currency || "USD";
        if (exp.paidBy === myId) myPaidByCurrency = addToMap(myPaidByCurrency, cur, exp.amount);
        const myShare = calcShare(exp, myId);
        if (myShare > 0) myOwedByCurrency = addToMap(myOwedByCurrency, cur, myShare);
      });

      const recent = [...exps]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 3);

      return { group: g, settlements, totalExpenses: exps.length, memberCount: memberIds.size, recentExpenses: recent, myPaidByCurrency, myOwedByCurrency };
    });
  }, [groups, groupExpenses, myId, userMap]);

  const selectedFriend = selected?.type === "friend" ? friends.find(f => f.userId === selected.userId) ?? null : null;
  const selectedGroup  = selected?.type === "group"  ? groupSummaries.find(gs => gs.group.id === selected.groupId) ?? null : null;

  useEffect(() => {
    if (!loading && selected === null) {
      if (friends.length > 0)            setSelected({ type: "friend", userId: friends[0].userId });
      else if (groupSummaries.length > 0) setSelected({ type: "group",  groupId: groupSummaries[0].group.id });
    }
  }, [loading, friends, groupSummaries]);

  // ── Settle modal (shared by FriendPanel) ─────────────────────────────────
  type SettleModalProps = {
    friendName:  string;
    friendId:    string;
    currency:    string;
    netAmount:   number;    // positive = they owe me, negative = I owe them
    onClose:     () => void;
    onSettled:   () => void;
  };

  function SettleModal({ friendName, friendId, currency, netAmount, onClose, onSettled }: SettleModalProps) {
    const [mode, setMode]         = useState<"full" | "partial">("full");
    const [partialAmt, setPartial] = useState("");
    const [settling, setSettling] = useState(false);
    const [modalErr, setErr]      = useState<string | null>(null);
    const fullAmt = Math.abs(netAmount);
    const sym     = currencySymbol(currency);

    async function handleSettle() {
      setErr(null);
      const amt = mode === "full" ? fullAmt : parseFloat(partialAmt);
      if (mode === "partial") {
        if (isNaN(amt) || amt <= 0)          return setErr("Enter a valid amount.");
        if (amt > fullAmt + 0.01)            return setErr(`Can't settle more than ${sym}${fullAmt.toFixed(2)}.`);
      }
      setSettling(true);
      try {
        const debtorId   = netAmount > 0 ? friendId : myId;
        const creditorId = netAmount > 0 ? myId     : friendId;
        await createExpense({
          title: mode === "partial"
            ? `Partial settlement: ${friendName} (${formatAmount(amt, currency)})`
            : `Settlement: ${friendName}`,
          amount: amt,
          currency,
          splitMethod: "BY_SHARES",
          paidBy: debtorId,
          participantUserIds: [debtorId, creditorId],
          participantShareCounts: [0, 100],
        });
        onSettled();
      } catch { setErr("Failed to save. Please try again."); }
      finally { setSettling(false); }
    }

    return (
      <div className="sl-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="sl-modal">
          <div className="sl-modal-title">Settle up with {friendName}</div>
          <div className="sl-modal-sub">
            {netAmount > 0 ? `${friendName} owes you` : `You owe ${friendName}`} {sym}{fullAmt.toFixed(2)} {currency}
          </div>
          <div className="sl-modal-options">
            <div className={`sl-modal-option ${mode === "full" ? "selected" : ""}`} onClick={() => setMode("full")}>
              <div className="sl-modal-option-label">
                <span>Settle everything</span>
                <span className="sl-modal-option-desc">Mark the full {sym}{fullAmt.toFixed(2)} as paid</span>
              </div>
              {mode === "full" && <span>✓</span>}
            </div>
            <div className={`sl-modal-option ${mode === "partial" ? "selected" : ""}`} onClick={() => setMode("partial")}>
              <div className="sl-modal-option-label">
                <span>Partial payment</span>
                <span className="sl-modal-option-desc">Enter a custom amount below</span>
              </div>
              {mode === "partial" && <span>✓</span>}
            </div>
          </div>
          {mode === "partial" && (
            <div className="sl-partial-wrap" style={{ marginBottom: 14 }}>
              <span className="sl-partial-sym">{sym}</span>
              <input className="sl-partial-input" type="number" step="0.01" min="0.01" max={fullAmt}
                placeholder={`max ${sym}${fullAmt.toFixed(2)}`} value={partialAmt} autoFocus
                onChange={e => { setPartial(e.target.value); setErr(null); }} />
            </div>
          )}
          {modalErr && (
            <div style={{ fontSize: ".8rem", color: "var(--red)", background: "var(--red-bg)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
              {modalErr}
            </div>
          )}
          <div className="sl-modal-actions">
            <button className="sl-modal-btn sl-modal-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="sl-modal-btn sl-modal-btn-primary" onClick={handleSettle} disabled={settling}>
              {settling ? "Saving…" : mode === "full" ? `Settle ${sym}${fullAmt.toFixed(2)}` : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── FriendPanel ────────────────────────────────────────────────────────────
  function FriendPanel({ f }: { f: FriendSummary }) {
    const [settled, setSettled]   = useState(false);
    const [settleModal, setModal] = useState<{ currency: string; netAmount: number } | null>(null);
    const ini = initials(f.displayName);
    const currencies = Object.keys(f.netByCurrency);
    const hasBalance = currencies.some(c => Math.abs(f.netByCurrency[c]) > 0.01);

    return (
      <>
        {settleModal && (
          <SettleModal
            friendName={f.displayName} friendId={f.userId}
            currency={settleModal.currency} netAmount={settleModal.netAmount}
            onClose={() => setModal(null)}
            onSettled={() => { setModal(null); setSettled(true); setTimeout(() => window.location.reload(), 1200); }}
          />
        )}

        <div className="sl-profile-header">
          <div className="sl-profile-avatar" style={{ background: "var(--blue-bg)", color: "var(--blue)" }}>{ini}</div>
          <div>
            <div className="sl-profile-name">{f.displayName}</div>
            {f.email && <div className="sl-profile-sub">{f.email}</div>}
          </div>
        </div>

        <div className="sl-action-row">
          <Link to={`/expense/new?friendId=${f.userId}`} className="sl-action-btn accent">+ Add expense</Link>
        </div>

        {settled && <div className="sl-settled-banner">✅ Settled! Refreshing…</div>}

        {/* Per-currency balance rows */}
        {currencies.length > 0 ? (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">Balances</span>
            </div>
            <div className="sl-section-card-body">
              <div className="sl-curr-balances">
                {currencies.map(cur => {
                  const net    = f.netByCurrency[cur];
                  const sym    = currencySymbol(cur);
                  const cls    = net > 0 ? "pos" : "neg";
                  const label  = net > 0
                    ? `${f.displayName} owes you`
                    : `You owe ${f.displayName}`;
                  return (
                    <div key={cur} className={`sl-curr-balance-row ${cls}`}>
                      <div>
                        <div className="sl-curr-label">{label}</div>
                        <div style={{ fontSize: ".72rem", color: "var(--muted)", marginTop: 1 }}>{cur}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className={`sl-curr-amount ${cls}`}>
                          {net > 0 ? "+" : "-"}{sym}{Math.abs(net).toFixed(2)}
                        </span>
                        {!settled && (
                          <button className="sl-curr-settle-btn" onClick={() => setModal({ currency: cur, netAmount: net })}>
                            Settle →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {!hasBalance && (
                <div style={{ textAlign: "center", padding: "8px 0", color: "var(--muted)", fontSize: ".85rem" }}>All settled up ✓</div>
              )}
            </div>
          </div>
        ) : (
          <div className="sl-net-hero">
            <div>
              <div className="sl-net-amount zero">$0.00</div>
              <div className="sl-net-who">All settled up</div>
            </div>
            <div style={{ fontSize: "2rem" }}>✅</div>
          </div>
        )}

        {f.recentExpenses.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header">
              <span className="sl-section-card-title">Recent activity</span>
            </div>
            <div className="sl-section-card-body" style={{ gap: 2 }}>
              {f.recentExpenses.map(exp => (
                <div key={exp.id} className="sl-activity-row">
                  <div style={{ overflow: "hidden" }}>
                    <div className="sl-act-title">{exp.title}</div>
                    <div className="sl-act-meta">{relativeTime(exp.createdAt)}</div>
                  </div>
                  <span className="sl-act-amount">{formatAmount(exp.amount, exp.currency || "USD")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to={`/friend/${f.userId}`} className="sl-see-details">
          <span>Manage expenses with {f.displayName}</span>
          <span className="sl-see-details-arrow">→</span>
        </Link>
      </>
    );
  }

  // ── GroupPanel ─────────────────────────────────────────────────────────────
  function GroupPanel({ gs }: { gs: GroupSummary }) {
    const { group, settlements, totalExpenses, memberCount, recentExpenses, myPaidByCurrency, myOwedByCurrency } = gs;
    const idx       = groups.indexOf(group);
    const col       = groupColor(idx);
    const ini       = initials(group.name);
    const isCreator = (group as any).createdBy === myId;

    const [showMembers, setShowMembers]             = useState(false);
    const [memberList, setMemberList]               = useState<{ userId: string; displayName: string; email: string }[]>([]);
    const [membersLoaded, setMembersLoaded]         = useState(false);
    const [memberSearch, setMemberSearch]           = useState("");
    const [addingId, setAddingId]                   = useState<string | null>(null);
    const [removingId, setRemovingId]               = useState<string | null>(null);
    const memberSearchRef                           = useRef<HTMLInputElement>(null);
    const [searchRect, setSearchRect]               = useState<DOMRect | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [confirmName, setConfirmName]             = useState("");
    const [deleteError, setDeleteError]             = useState<string | null>(null);
    const [deleting, setDeleting]                   = useState(false);
    const [groupSettled, setGroupSettled]           = useState(false);
    const [groupSettleModal, setGroupSettleModal]   = useState<{ debtorId: string; creditorId: string; debtorName: string; creditorName: string; currency: string; amount: number } | null>(null);
    const nameMatches = confirmName.trim() === group.name.trim();

    async function handleDeleteGroup() {
      if (!nameMatches) return;
      setDeleting(true); setDeleteError(null);
      try { await deleteGroup(group.id); window.location.reload(); }
      catch { setDeleteError("Failed to delete group. Please try again."); setDeleting(false); }
    }

    async function loadMembers() {
      if (membersLoaded) return;
      try {
        const raw = await listGroupMembers(group.id);
        setMemberList(raw.filter((m: any) => m?.userId).map((m: any) => ({
          userId:      m.userId,
          displayName: userMap.get(m.userId)?.displayName ?? "Unknown",
          email:       userMap.get(m.userId)?.email ?? "",
        })));
        setMembersLoaded(true);
      } catch { }
    }

    function toggleMembers() { const next = !showMembers; setShowMembers(next); if (next) loadMembers(); }

    async function handleAdd(userId: string) {
      setAddingId(userId);
      try {
        await addGroupMember(group.id, userId);
        setMemberList(prev => [...prev, { userId, displayName: userMap.get(userId)?.displayName ?? "Unknown", email: userMap.get(userId)?.email ?? "" }]);
        setMemberSearch(""); setSearchRect(null);
      } catch { } finally { setAddingId(null); }
    }

    async function handleRemove(userId: string) {
      if (userId === myId) return;
      setRemovingId(userId);
      try {
        const raw    = await listGroupMembers(group.id);
        const target = raw.find((m: any) => m.userId === userId);
        if (target?.id) { await removeGroupMember(target.id); setMemberList(prev => prev.filter(m => m.userId !== userId)); }
      } catch { } finally { setRemovingId(null); }
    }

    const memberIds = new Set(memberList.map(m => m.userId));
    const addCandidates = memberSearch
      ? [...userMap.entries()].filter(([uid, info]) => !memberIds.has(uid) && (
          info.email.toLowerCase().includes(memberSearch.toLowerCase()) ||
          info.displayName.toLowerCase().includes(memberSearch.toLowerCase())
        )).slice(0, 5)
      : [];

    // Net per currency for group
    const netByCurrency: CurrencyMap = {};
    for (const cur of new Set([...Object.keys(myPaidByCurrency), ...Object.keys(myOwedByCurrency)])) {
      const net = (myPaidByCurrency[cur] ?? 0) - (myOwedByCurrency[cur] ?? 0);
      if (Math.abs(net) > 0.001) netByCurrency[cur] = net;
    }

    return (
      <>
        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="sl-modal-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowDeleteConfirm(false); setConfirmName(""); setDeleteError(null); } }}>
            <div className="sl-modal">
              <div className="sl-modal-title">Delete "{group.name}"?</div>
              <div className="sl-modal-sub">Permanently deletes the group, all its expenses, and all balance history. No undo.</div>
              <div style={{ fontSize: ".78rem", color: "var(--muted)", marginBottom: 6 }}>
                Type the group name to confirm: <strong style={{ color: "var(--text)", fontFamily: "'DM Mono', monospace" }}>{group.name}</strong>
              </div>
              <input
                style={{ width: "100%", padding: "10px 13px", borderRadius: 9, border: "1.5px solid #ffd0d0", background: "var(--red-bg)", fontFamily: "inherit", fontSize: ".88rem", color: "var(--text)", outline: "none", marginBottom: 12 }}
                placeholder={group.name} value={confirmName}
                onChange={e => { setConfirmName(e.target.value); setDeleteError(null); }}
              />
              {deleteError && <div style={{ fontSize: ".8rem", color: "var(--red)", background: "var(--red-bg)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>{deleteError}</div>}
              <div className="sl-modal-actions">
                <button className="sl-modal-btn sl-modal-btn-ghost" onClick={() => { setShowDeleteConfirm(false); setConfirmName(""); setDeleteError(null); }}>Cancel</button>
                <button className="sl-modal-btn" disabled={!nameMatches || deleting} onClick={handleDeleteGroup}
                  style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: nameMatches ? "var(--red)" : "var(--border)", color: nameMatches ? "#fff" : "var(--muted)", fontFamily: "inherit", fontSize: ".88rem", fontWeight: 600, cursor: nameMatches ? "pointer" : "not-allowed" }}>
                  {deleting ? "Deleting…" : "Delete group"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="sl-profile-header">
          <div className="sl-profile-avatar" style={{ background: col.bg, color: col.fg }}>{ini}</div>
          <div>
            <div className="sl-profile-name">{group.name}</div>
            <div className="sl-profile-sub">{memberCount} member{memberCount !== 1 ? "s" : ""} · {totalExpenses} expense{totalExpenses !== 1 ? "s" : ""}</div>
          </div>
        </div>

        <div className="sl-action-row">
          <Link to={`/expense/new?groupId=${group.id}`} className="sl-action-btn accent">+ Add expense</Link>
          <button className="sl-action-btn" onClick={toggleMembers}>{showMembers ? "Hide members" : "👥 Manage members"}</button>
          {isCreator && (
            <button className="sl-action-btn danger" onClick={() => { setShowDeleteConfirm(true); setConfirmName(""); }}>🗑 Delete group</button>
          )}
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
                          <div className="sl-member-av" style={{ background: mCol.bg, color: mCol.fg }}>{initials(m.displayName)}</div>
                          <div>
                            <div className="sl-member-name">{isMe ? `${m.displayName} (you)` : m.displayName}</div>
                            {m.email && <div className="sl-member-sub">{m.email}</div>}
                          </div>
                        </div>
                        {!isMe && (
                          <button className="sl-member-remove" onClick={() => handleRemove(m.userId)} disabled={removingId === m.userId} title="Remove from group">
                            {removingId === m.userId ? "…" : "✕"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: 8, position: "relative" }}>
                <input ref={memberSearchRef}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--bg)", fontFamily: "inherit", fontSize: ".84rem", color: "var(--text)", outline: "none" }}
                  placeholder="Search by name or email to add…"
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); if (memberSearchRef.current) setSearchRect(memberSearchRef.current.getBoundingClientRect()); }}
                  onFocus={() => { if (!membersLoaded) loadMembers(); if (memberSearchRef.current) setSearchRect(memberSearchRef.current.getBoundingClientRect()); }}
                  onBlur={() => setTimeout(() => setSearchRect(null), 150)}
                />
                {addCandidates.length > 0 && searchRect && createPortal(
                  <div style={{ position: "fixed", top: searchRect.bottom + 4, left: searchRect.left, width: searchRect.width, zIndex: 9999, background: "var(--surface, #fff)", border: "1px solid var(--border, #ebebed)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", fontFamily: "inherit" }}>
                    {addCandidates.map(([uid, info]) => (
                      <div key={uid} className="sl-add-result" onMouseDown={() => !addingId && handleAdd(uid)}>
                        <div style={{ background: "var(--accent-bg,#edfaf7)", color: "var(--accent,#3ecfb2)", width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".68rem", fontWeight: 700, flexShrink: 0 }}>
                          {initials(info.displayName)}
                        </div>
                        <div>
                          <div style={{ fontSize: ".84rem", fontWeight: 500 }}>{info.displayName}</div>
                          <div style={{ fontSize: ".72rem", color: "var(--muted,#8b8fa8)" }}>{info.email}</div>
                        </div>
                        {addingId === uid && <span style={{ marginLeft: "auto", fontSize: ".75rem", color: "var(--muted)" }}>Adding…</span>}
                      </div>
                    ))}
                  </div>, document.body
                )}
              </div>
            </div>
          </div>
        )}

        {/* Per-currency net balance */}
        <div className="sl-section-card">
          <div className="sl-section-card-header"><span className="sl-section-card-title">Your balance</span></div>
          <div className="sl-section-card-body">
            {Object.keys(netByCurrency).length === 0 ? (
              <div style={{ textAlign: "center", padding: "8px 0", color: "var(--muted)", fontSize: ".85rem" }}>You're settled up ✓</div>
            ) : (
              <div className="sl-curr-balances">
                {Object.entries(netByCurrency).map(([cur, net]) => {
                  const sym = currencySymbol(cur);
                  const cls = net > 0 ? "pos" : "neg";
                  return (
                    <div key={cur} className={`sl-curr-balance-row ${cls}`}>
                      <div>
                        <div className="sl-curr-label">{net > 0 ? "You're owed" : "You owe"}</div>
                        <div style={{ fontSize: ".72rem", color: "var(--muted)", marginTop: 1 }}>{cur}</div>
                      </div>
                      <span className={`sl-curr-amount ${cls}`}>{net > 0 ? "+" : "-"}{sym}{Math.abs(net).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Who owes what — per currency */}
        {groupSettleModal && (() => {
          const s = groupSettleModal;
          const iOwe = s.debtorId === myId;
          // netAmount: positive = they owe me (creditorId===myId), negative = I owe them
          const netAmount = iOwe ? -s.amount : s.amount;
          const friendId  = iOwe ? s.creditorId : s.debtorId;
          const friendName = iOwe ? s.creditorName : s.debtorName;
          return (
            <SettleModal
              friendName={friendName} friendId={friendId}
              currency={s.currency} netAmount={netAmount}
              onClose={() => setGroupSettleModal(null)}
              onSettled={() => { setGroupSettleModal(null); setGroupSettled(true); setTimeout(() => window.location.reload(), 1200); }}
            />
          );
        })()}
        {groupSettled && <div className="sl-settled-banner">✅ Settled! Refreshing…</div>}
        {settlements.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header"><span className="sl-section-card-title">Who owes what</span></div>
            <div className="sl-section-card-body">
              {settlements.map((s, i) => {
                const isMe     = s.debtorId === myId;
                const involves = s.debtorId === myId || s.creditorId === myId;
                const label    = isMe ? `You → ${s.creditorName}` : `${s.debtorName} → ${s.creditorId === myId ? "you" : s.creditorName}`;
                const sym      = currencySymbol(s.currency);
                return (
                  <div key={i} className={`sl-breakdown-row ${isMe ? "owes" : "owed"}`} style={{ alignItems: "center" }}>
                    <div className="sl-br-left">
                      <div className={`sl-br-dot ${isMe ? "owes" : "owed"}`} />
                      <span className="sl-br-text">{label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`sl-br-amount ${isMe ? "owes" : "owed"}`} style={{ fontFamily: "'DM Mono', monospace" }}>
                        {isMe ? "-" : "+"}{sym}{s.amount.toFixed(2)} <span style={{ fontSize: ".7rem", color: "var(--muted)", fontFamily: "inherit" }}>{s.currency}</span>
                      </span>
                      {involves && !groupSettled && (
                        <button className="sl-curr-settle-btn" onClick={() => setGroupSettleModal(s)}>
                          Settle →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Your stats */}
        <div className="sl-section-card">
          <div className="sl-section-card-header"><span className="sl-section-card-title">Your stats</span></div>
          <div className="sl-section-card-body">
            {Object.keys(myPaidByCurrency).length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: ".84rem" }}>No expenses yet</div>
            ) : (
              Object.keys({ ...myPaidByCurrency, ...myOwedByCurrency }).map(cur => {
                const sym  = currencySymbol(cur);
                const paid = myPaidByCurrency[cur] ?? 0;
                const owed = myOwedByCurrency[cur] ?? 0;
                return (
                  <div key={cur}>
                    {Object.keys({ ...myPaidByCurrency, ...myOwedByCurrency }).length > 1 && (
                      <div style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{cur}</div>
                    )}
                    <div className="sl-breakdown-row neutral">
                      <div className="sl-br-left"><div className="sl-br-dot neutral" /><span className="sl-br-text">You've paid</span></div>
                      <span className="sl-br-amount" style={{ color: "var(--text)" }}>{sym}{paid.toFixed(2)}</span>
                    </div>
                    <div className="sl-breakdown-row neutral">
                      <div className="sl-br-left"><div className="sl-br-dot neutral" /><span className="sl-br-text">Your share</span></div>
                      <span className="sl-br-amount" style={{ color: "var(--text)" }}>{sym}{owed.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {recentExpenses.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header"><span className="sl-section-card-title">Recent activity</span></div>
            <div className="sl-section-card-body" style={{ gap: 2 }}>
              {recentExpenses.map(exp => (
                <div key={exp.id} className="sl-activity-row">
                  <div style={{ overflow: "hidden" }}>
                    <div className="sl-act-title">{exp.title}</div>
                    <div className="sl-act-meta">{relativeTime(exp.createdAt)}</div>
                  </div>
                  <span className="sl-act-amount">{formatAmount(exp.amount, exp.currency || "USD")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link to={`/group/${group.id}`} className="sl-see-details">
          <span>Manage group expenses in {group.name}</span>
          <span className="sl-see-details-arrow">→</span>
        </Link>
      </>
    );
  }

  // ── MePanel ────────────────────────────────────────────────────────────────
  function MePanel() {
    // Flatten all currencies across friends + groups
    const allNetByCur: CurrencyMap = {};
    friends.forEach(f => {
      Object.entries(f.netByCurrency).forEach(([cur, amt]) => {
        allNetByCur[cur] = (allNetByCur[cur] ?? 0) + amt;
      });
    });
    groupSummaries.forEach(gs => {
      Object.keys({ ...gs.myPaidByCurrency, ...gs.myOwedByCurrency }).forEach(cur => {
        const net = (gs.myPaidByCurrency[cur] ?? 0) - (gs.myOwedByCurrency[cur] ?? 0);
        allNetByCur[cur] = (allNetByCur[cur] ?? 0) + net;
      });
    });
    const currencyKeys = Object.keys(allNetByCur).filter(c => Math.abs(allNetByCur[c]) > 0.01);

    return (
      <>
        <div className="sl-profile-header">
          <div className="sl-profile-avatar" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>
            {initials(user!.displayName)}
          </div>
          <div>
            <div className="sl-profile-name">{user!.displayName}</div>
            <div className="sl-profile-sub">Your overall picture</div>
          </div>
        </div>

        {currencyKeys.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header"><span className="sl-section-card-title">Overall balance</span></div>
            <div className="sl-section-card-body">
              <div className="sl-curr-balances">
                {currencyKeys.map(cur => {
                  const net = allNetByCur[cur];
                  const sym = currencySymbol(cur);
                  const cls = net > 0 ? "pos" : "neg";
                  return (
                    <div key={cur} className={`sl-curr-balance-row ${cls}`}>
                      <div>
                        <div className="sl-curr-label">{net > 0 ? "You're owed" : "You owe"}</div>
                        <div style={{ fontSize: ".72rem", color: "var(--muted)", marginTop: 1 }}>{cur}</div>
                      </div>
                      <span className={`sl-curr-amount ${cls}`}>{net > 0 ? "+" : "-"}{sym}{Math.abs(net).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {currencyKeys.length === 0 && (
          <div className="sl-net-hero">
            <div>
              <div className="sl-net-amount zero">All clear</div>
              <div className="sl-net-who">All settled up across everything 🎉</div>
            </div>
            <div style={{ fontSize: "2rem" }}>✅</div>
          </div>
        )}

        {friends.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header"><span className="sl-section-card-title">Friends</span></div>
            <div className="sl-section-card-body">
              {friends.map(f => {
                const currencies = Object.keys(f.netByCurrency);
                const hasAny = currencies.some(c => Math.abs(f.netByCurrency[c]) > 0.01);
                return (
                  <div key={f.userId} className="sl-breakdown-row neutral" style={{ cursor: "pointer", flexDirection: "column", alignItems: "flex-start", gap: 4 }}
                    onClick={() => setSelected({ type: "friend", userId: f.userId })}>
                    <div className="sl-br-left">
                      <div className="sl-br-dot neutral" />
                      <span className="sl-br-text" style={{ fontWeight: 500 }}>{f.displayName}</span>
                    </div>
                    {hasAny ? (
                      <div style={{ paddingLeft: 18, display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
                        {currencies.map(cur => {
                          const net = f.netByCurrency[cur];
                          const sym = currencySymbol(cur);
                          const cls = net > 0 ? "owed" : "owes";
                          return (
                            <span key={cur} className={`sl-br-amount ${cls}`} style={{ fontSize: ".78rem" }}>
                              {net > 0 ? "+" : "-"}{sym}{Math.abs(net).toFixed(2)} {cur}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ paddingLeft: 18, fontSize: ".78rem", color: "var(--muted)" }}>settled</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {groupSummaries.length > 0 && (
          <div className="sl-section-card">
            <div className="sl-section-card-header"><span className="sl-section-card-title">Groups</span></div>
            <div className="sl-section-card-body">
              {groupSummaries.map(gs => {
                const netByCur: CurrencyMap = {};
                for (const cur of new Set([...Object.keys(gs.myPaidByCurrency), ...Object.keys(gs.myOwedByCurrency)])) {
                  const net = (gs.myPaidByCurrency[cur] ?? 0) - (gs.myOwedByCurrency[cur] ?? 0);
                  if (Math.abs(net) > 0.001) netByCur[cur] = net;
                }
                const currKeys = Object.keys(netByCur);
                return (
                  <div key={gs.group.id} className="sl-breakdown-row neutral" style={{ cursor: "pointer", flexDirection: "column", alignItems: "flex-start", gap: 4 }}
                    onClick={() => setSelected({ type: "group", groupId: gs.group.id })}>
                    <div className="sl-br-left">
                      <div className="sl-br-dot neutral" />
                      <span className="sl-br-text" style={{ fontWeight: 500 }}>{gs.group.name}</span>
                    </div>
                    {currKeys.length > 0 ? (
                      <div style={{ paddingLeft: 18, display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
                        {currKeys.map(cur => {
                          const net = netByCur[cur];
                          const sym = currencySymbol(cur);
                          const cls = net > 0 ? "owed" : "owes";
                          return (
                            <span key={cur} className={`sl-br-amount ${cls}`} style={{ fontSize: ".78rem" }}>
                              {net > 0 ? "+" : "-"}{sym}{Math.abs(net).toFixed(2)} {cur}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ paddingLeft: 18, fontSize: ".78rem", color: "var(--muted)" }}>settled</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  }

  // ── main render ────────────────────────────────────────────────────────────
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
            <Link to="/auth?account=1" className="btn btn-ghost">
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

                {(friends.length > 0 || groupSummaries.length > 0) && (() => {
                  const allNetByCur: CurrencyMap = {};
                  friends.forEach(f => Object.entries(f.netByCurrency).forEach(([c, v]) => { allNetByCur[c] = (allNetByCur[c] ?? 0) + v; }));
                  groupSummaries.forEach(gs => {
                    for (const cur of new Set([...Object.keys(gs.myPaidByCurrency), ...Object.keys(gs.myOwedByCurrency)])) {
                      const net = (gs.myPaidByCurrency[cur] ?? 0) - (gs.myOwedByCurrency[cur] ?? 0);
                      allNetByCur[cur] = (allNetByCur[cur] ?? 0) + net;
                    }
                  });
                  const positives = Object.entries(allNetByCur).filter(([, v]) => v > 0.01);
                  const negatives = Object.entries(allNetByCur).filter(([, v]) => v < -0.01);
                  const isPos = positives.length > 0 && negatives.length === 0;
                  const isNeg = negatives.length > 0 && positives.length === 0;
                  const isMix = positives.length > 0 && negatives.length > 0;

                  return (
                    <div onClick={() => setSelected({ type: "me" })} style={{
                      margin: "0 0 12px 0", padding: "14px 16px", borderRadius: 12,
                      background: selected?.type === "me" ? "var(--border)" : (isPos ? "var(--accent-bg)" : isNeg ? "var(--red-bg)" : "var(--bg)"),
                      border: `1px solid ${isPos ? "rgba(62,207,178,.25)" : isNeg ? "rgba(255,107,107,.2)" : "var(--border)"}`,
                      cursor: "pointer", transition: "background .15s",
                    }}>
                      <div style={{ fontSize: ".7rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                        {user.displayName}
                      </div>
                      {Object.entries(allNetByCur).filter(([, v]) => Math.abs(v) > 0.01).map(([cur, net]) => (
                        <div key={cur} style={{ fontSize: "1.1rem", fontWeight: 700, color: net > 0 ? "var(--accent)" : "var(--red)", fontFamily: "'DM Mono', monospace" }}>
                          {net > 0 ? "+" : "-"}{currencySymbol(cur)}{Math.abs(net).toFixed(0)} <span style={{ fontSize: ".72rem", color: "var(--muted)", fontFamily: "inherit" }}>{cur}</span>
                        </div>
                      ))}
                      {!isPos && !isNeg && !isMix && (
                        <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--muted)" }}>All settled up</div>
                      )}
                    </div>
                  );
                })()}

                {friends.length > 0 && (
                  <>
                    <div className="sl-section-label">Friends</div>
                    {friends.map(f => {
                      const isSel = selected?.type === "friend" && selected.userId === f.userId;
                      const currencies = Object.keys(f.netByCurrency);
                      const firstCur = currencies[0];
                      const firstNet = firstCur ? f.netByCurrency[firstCur] : 0;
                      const subCls = firstNet > 0.01 ? "pos" : firstNet < -0.01 ? "neg" : "muted";
                      const subText = firstCur && Math.abs(firstNet) > 0.01
                        ? `${firstNet > 0 ? "+" : "-"}${currencySymbol(firstCur)}${Math.abs(firstNet).toFixed(2)}${currencies.length > 1 ? ` +${currencies.length - 1} more` : ""}`
                        : "settled up";
                      return (
                        <div key={f.userId} className={`sl-nav-item ${isSel ? "active" : ""}`} onClick={() => setSelected({ type: "friend", userId: f.userId })}>
                          <div className="sl-nav-icon person">{initials(f.displayName)}</div>
                          <div className="sl-nav-text">
                            <div className="sl-nav-name">{f.displayName}</div>
                            <div className={`sl-nav-sub ${subCls}`}>{subText}</div>
                          </div>
                        </div>
                      );
                    })}

                  </>
                )}

                {groups.length > 0 && (
                  <>
                    <div className="sl-section-label">Groups</div>
                    {groupSummaries.map((gs, idx) => {
                      const col   = groupColor(idx);
                      const isSel = selected?.type === "group" && selected.groupId === gs.group.id;
                      const netByCur: CurrencyMap = {};
                      for (const cur of new Set([...Object.keys(gs.myPaidByCurrency), ...Object.keys(gs.myOwedByCurrency)])) {
                        const net = (gs.myPaidByCurrency[cur] ?? 0) - (gs.myOwedByCurrency[cur] ?? 0);
                        if (Math.abs(net) > 0.001) netByCur[cur] = net;
                      }
                      const firstCur = Object.keys(netByCur)[0];
                      const firstNet = firstCur ? netByCur[firstCur] : 0;
                      const subCls = firstNet > 0.01 ? "pos" : firstNet < -0.01 ? "neg" : "muted";
                      const subText = firstCur && Math.abs(firstNet) > 0.01
                        ? `${firstNet > 0 ? "+" : "-"}${currencySymbol(firstCur)}${Math.abs(firstNet).toFixed(2)} · ${gs.memberCount} members`
                        : `${gs.memberCount} members · settled`;
                      return (
                        <div key={gs.group.id} className={`sl-nav-item ${isSel ? "active" : ""}`} onClick={() => setSelected({ type: "group", groupId: gs.group.id })}>
                          <div className="sl-nav-icon group" style={{ background: col.bg, color: col.fg }}>{initials(gs.group.name)}</div>
                          <div className="sl-nav-text">
                            <div className="sl-nav-name">{gs.group.name}</div>
                            <div className={`sl-nav-sub ${subCls}`}>{subText}</div>
                          </div>
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
              {selected?.type === "me" && <div className="sl-panel-inner"><MePanel /></div>}
              {selectedFriend && <div className="sl-panel-inner"><FriendPanel f={selectedFriend} /></div>}
              {selectedGroup  && <div className="sl-panel-inner"><GroupPanel gs={selectedGroup} /></div>}
              {!selectedFriend && !selectedGroup && friends.length === 0 && groups.length === 0 && (
                <div className="sl-panel-inner" style={{ alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
                  <div style={{ maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: "3rem" }}>💸</div>
                    <div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: 6 }}>Welcome to SplitLite!</div>
                      <div style={{ fontSize: ".88rem", color: "var(--muted)", lineHeight: 1.6 }}>Add an expense with a friend and they'll appear in your sidebar automatically.</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                      <Link to="/expense/new" className="btn btn-primary">+ Add your first expense</Link>
                      <Link to="/group/new" className="btn btn-ghost">Create a group</Link>
                    </div>
                    <div style={{ marginTop: 8, padding: "14px 18px", background: "var(--accent-bg)", borderRadius: 12, fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.6, textAlign: "left" }}>
                      <strong style={{ color: "var(--accent)", display: "block", marginBottom: 4 }}>How it works</strong>
                      Add an expense → pick who split it → SplitLite tracks who owes who automatically.
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