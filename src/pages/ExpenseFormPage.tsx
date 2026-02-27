import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createExpense,
  updateExpense,
  setExpenseParticipants,
  listAllUsers,
  listParticipantsForExpense,
  listMyGroups,
  listGroupMembers,
} from "../api/expenses";
import type { UserProfileType, GroupType } from "../api/expenses";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
const client = generateClient<Schema>();

type SplitMethod = "EQUAL" | "BY_SHARES" | "BY_PERCENT" | "FULL" | "BY_EXACT";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f8fa; --surface: #fff; --border: #ebebed;
    --text: #1a1a2e; --muted: #8b8fa8; --accent: #3ecfb2;
    --accent-bg: #edfaf7; --red: #ff6b6b; --red-bg: #fff0f0;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --radius: 14px;
  }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }
  .ef-root { min-height: 100vh; background: var(--bg); }
  .ef-topbar {
    position: sticky; top: 0; z-index: 40;
    background: rgba(247,248,250,.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 20px; height: 56px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ef-brand { font-size: 1rem; font-weight: 600; text-decoration: none; color: var(--text); }
  .ef-brand .a { color: var(--accent); }
  .ef-back { display: inline-flex; align-items: center; gap: 6px; font-size: .83rem; color: var(--muted); cursor: pointer; text-decoration: none; background: none; border: none; font-family: inherit; padding: 0; }
  .ef-back:hover { color: var(--text); }
  .ef-body { max-width: 560px; margin: 0 auto; padding: 28px 16px 60px; display: flex; flex-direction: column; gap: 14px; }
  .ef-heading { font-size: 1.35rem; font-weight: 600; letter-spacing: -.4px; }
  .ef-subheading { font-size: .83rem; color: var(--muted); margin-top: 3px; }
  .ef-prefill-badge { display: inline-flex; align-items: center; gap: 8px; padding: 9px 13px; border-radius: 10px; background: var(--accent-bg); border: 1px solid rgba(62,207,178,.25); font-size: .82rem; color: var(--accent); font-weight: 500; }
  .ef-prefill-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
  .ef-error { background: var(--red-bg); color: var(--red); padding: 10px 14px; border-radius: 10px; font-size: .82rem; }

  /* Cards */
  .ef-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
  .ef-card-header { padding: 13px 16px 0; font-size: .7rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
  .ef-card-body { padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 10px; }

  /* Inputs */
  .ef-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg); font-family: inherit; font-size: .9rem; color: var(--text); outline: none; transition: border-color .15s; }
  .ef-input:focus { border-color: var(--accent); background: var(--surface); }
  .ef-input::placeholder { color: var(--muted); }
  .ef-amount-wrap { display: flex; align-items: center; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg); overflow: hidden; transition: border-color .15s; }
  .ef-amount-wrap:focus-within { border-color: var(--accent); background: var(--surface); }
  .ef-amount-sym { padding: 11px 8px 11px 14px; font-size: .9rem; color: var(--muted); }
  .ef-amount-input { flex: 1; padding: 11px 14px 11px 2px; border: none; background: transparent; font-family: 'DM Mono', monospace; font-size: .95rem; color: var(--text); outline: none; }
  .ef-amount-input::placeholder { color: var(--muted); font-family: 'DM Sans', sans-serif; }
  .ef-select { width: 100%; padding: 11px 36px 11px 14px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg); font-family: inherit; font-size: .88rem; color: var(--text); outline: none; appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b8fa8' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; }
  .ef-select:focus { border-color: var(--accent); }
  .ef-select:disabled { opacity: .6; cursor: not-allowed; }
  .ef-hint { font-size: .74rem; color: var(--muted); line-height: 1.5; }

  /* Search dropdown — matches CreateGroupPage exactly (cg-dropdown / cg-result style) */
  .ef-dropdown {
    margin-top: 6px; border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; background: var(--surface);
    box-shadow: var(--shadow);
  }
  .ef-result {
    padding: 10px 14px; cursor: pointer; font-size: .87rem;
    transition: background .1s; display: flex; flex-direction: column; gap: 2px;
  }
  .ef-result:not(:last-child) { border-bottom: 1px solid var(--border); }
  .ef-result:hover { background: var(--accent-bg); }
  .ef-result-name { font-weight: 500; }
  .ef-result-email { font-size: .75rem; color: var(--muted); }

  /* Chips */
  .ef-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .ef-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 20px; background: var(--bg); border: 1px solid var(--border); font-size: .81rem; font-weight: 500; }
  .ef-chip.me { background: var(--accent-bg); border-color: rgba(62,207,178,.3); color: var(--accent); }
  .ef-chip-x { width: 15px; height: 15px; border-radius: 50%; background: var(--border); border: none; cursor: pointer; font-size: .68rem; color: var(--muted); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .1s; }
  .ef-chip-x:hover { background: var(--red-bg); color: var(--red); }

  /* Who paid pills */
  .ef-paidby-list { display: flex; flex-wrap: wrap; gap: 8px; }
  .ef-paidby-pill { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 20px; border: 1.5px solid var(--border); background: var(--bg); font-family: inherit; font-size: .84rem; font-weight: 500; color: var(--muted); cursor: pointer; transition: all .15s; }
  .ef-paidby-pill:hover { border-color: var(--accent); color: var(--text); }
  .ef-paidby-pill.selected { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 600; }
  .ef-paidby-av { width: 22px; height: 22px; border-radius: 6px; background: rgba(62,207,178,.2); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: .62rem; font-weight: 700; flex-shrink: 0; }

  /* Split tabs */
  .ef-tabs { display: flex; background: var(--bg); border-radius: 9px; padding: 3px; gap: 2px; flex-wrap: wrap; }
  .ef-tab { flex: 1; padding: 8px 4px; border-radius: 7px; border: none; font-family: inherit; font-size: .78rem; font-weight: 500; color: var(--muted); cursor: pointer; background: transparent; transition: all .15s; text-align: center; min-width: 56px; }
  .ef-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.08); font-weight: 600; }

  /* Split rows */
  .ef-split-row { display: flex; align-items: center; gap: 10px; }
  .ef-split-name { font-size: .84rem; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ef-split-num { width: 100px; padding: 8px 10px; border-radius: 8px; border: 1.5px solid var(--border); background: var(--bg); font-family: 'DM Mono', monospace; font-size: .84rem; color: var(--text); outline: none; text-align: right; transition: border-color .15s; }
  .ef-split-num:focus { border-color: var(--accent); }
  .ef-split-sym { font-size: .84rem; color: var(--muted); flex-shrink: 0; }

  /* One-pays radio */
  .ef-radio-list { display: flex; flex-direction: column; gap: 7px; }
  .ef-radio-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; border: 1.5px solid var(--border); cursor: pointer; font-size: .87rem; transition: all .12s; }
  .ef-radio-item.checked { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); font-weight: 500; }
  .ef-radio-item input { accent-color: var(--accent); }

  /* Exact $ progress bar */
  .ef-exact-bar { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-radius: 9px; font-size: .82rem; font-weight: 600; margin-top: 2px; }
  .ef-exact-bar.ok    { background: var(--accent-bg); color: var(--accent); border: 1px solid rgba(62,207,178,.25); }
  .ef-exact-bar.over  { background: var(--red-bg); color: var(--red); border: 1px solid rgba(255,107,107,.2); }
  .ef-exact-bar.under { background: var(--bg); color: var(--muted); border: 1px solid var(--border); }
  .ef-exact-mono { font-family: 'DM Mono', monospace; font-size: .8rem; }

  /* Submit */
  .ef-submit { width: 100%; padding: 14px; border-radius: 12px; border: none; background: var(--text); color: #fff; font-family: inherit; font-size: .95rem; font-weight: 600; cursor: pointer; transition: all .15s; margin-top: 4px; }
  .ef-submit:hover:not(:disabled) { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,.15); }
  .ef-submit:disabled { opacity: .5; cursor: not-allowed; }

  /* Loading */
  .ef-loading { display: flex; align-items: center; justify-content: center; height: 100vh; }
  .ef-spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

function ini(name: string) {
  return (name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function ExpenseFormPage() {
  const { user } = useAuth();
  if (!user) return null;
  const myId = user.userId;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const prefillFriendId = searchParams.get("friendId");
  const prefillGroupId  = searchParams.get("groupId");

  // form state
  const [title, setTitle]       = useState("");
  const [amount, setAmount]     = useState("");
  const [groupId, setGroupId]   = useState<string>(prefillGroupId ?? "");
  const [groups, setGroups]     = useState<GroupType[]>([]);
  const [splitMethod, setSplit] = useState<SplitMethod>("EQUAL");
  const [shares, setShares]     = useState<Record<string, number>>({});
  const [percents, setPercents] = useState<Record<string, number>>({});
  const [exacts, setExacts]     = useState<Record<string, number>>({});
  const [fullOwer, setFullOwer] = useState("");
  const [paidBy, setPaidBy]     = useState<string>(myId);

  // users / search
  const [users, setUsers]   = useState<UserProfileType[]>([]);
  const [query, setQuery]   = useState("");
  const [selectedIds, setSel] = useState<Set<string>>(new Set([myId]));

  // ui state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Portal ref for dropdown (needed because card has overflow control)
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchRect, setSearchRect] = useState<DOMRect | null>(null);

  const emailOf = (u: any): string => (u.email ?? "").toLowerCase();
  const uName   = (uid: string) => users.find(u => u.id === uid)?.displayName ?? uid;

  // ── 1. Load users + groups + pre-fill participants ─────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [allUsers, myGroups] = await Promise.all([listAllUsers(), listMyGroups(myId)]);
        setUsers(allUsers.filter((u: any) => u?.id));
        setGroups(myGroups.filter((g: any) => g?.id));
        if (!isEdit) {
          const ids = new Set<string>([myId]);
          if (prefillFriendId) ids.add(prefillFriendId);
          if (prefillGroupId) {
            try {
              const ms = await listGroupMembers(prefillGroupId);
              ms.forEach((m: any) => { if (m?.userId) ids.add(m.userId); });
            } catch { /* silent */ }
          }
          setSel(ids);
        }
      } catch { setError("Failed to load data."); }
      finally { setLoading(false); }
    })();
  }, [myId, isEdit, prefillFriendId, prefillGroupId]);

  // ── 2. Edit mode: fetch expense fields + participants ─────────────────
  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      try {
        // Fetch the expense record itself so we can pre-fill every field
        const { data: exp } = await client.models.Expense.get({ id });
        if (exp) {
          setTitle(exp.title ?? "");
          setAmount(exp.amount != null ? String(exp.amount) : "");
          const sm = (exp.splitMethod ?? "EQUAL") as SplitMethod;
          setSplit(sm);
          if (exp.paidBy)  setPaidBy(exp.paidBy);
          if (exp.groupId) setGroupId(exp.groupId);
        }

        // Fetch participants + share counts
        const parts = await listParticipantsForExpense(id);
        const ids = parts.filter((p: any) => p?.userId).map((p: any) => p.userId as string);
        setSel(new Set(ids));

        const shareMap: Record<string, number> = {};
        parts.forEach((p: any) => {
          if (p.userId && typeof p.shareCount === "number") shareMap[p.userId] = p.shareCount;
        });

        // Populate the correct split-mode state
        const method = (exp?.splitMethod ?? "EQUAL") as SplitMethod;
        if (method === "BY_SHARES")  setShares(shareMap);
        if (method === "BY_PERCENT") setPercents(shareMap);
        if (method === "BY_EXACT")   {
          // shareCount was stored as cents (×100), convert back to dollars
          setExacts(Object.fromEntries(Object.entries(shareMap).map(([k, v]) => [k, v / 100])));
        }
        if (method === "FULL") {
          const ower = parts.find((p: any) => p.shareCount === 100);
          if (ower?.userId) setFullOwer(ower.userId);
        }
      } catch { setError("Failed to load expense data."); }
    })();
  }, [isEdit, id]);

  // ── 3. Group change → auto-add members ──────────────────────────────
  useEffect(() => {
    if (!groupId || prefillGroupId || isEdit) return;
    (async () => {
      try {
        const ms = await listGroupMembers(groupId);
        setSel(new Set([myId, ...ms.map((m: any) => m.userId).filter(Boolean)]));
      } catch { /* silent */ }
    })();
  }, [groupId]);

  // ── 4. If paidBy was removed from participants, reset ──────────────
  useEffect(() => {
    if (!selectedIds.has(paidBy)) setPaidBy(myId);
  }, [selectedIds]);

  // Search results (exclude already-selected)
  const results = query
    ? users.filter(u => emailOf(u).includes(query.toLowerCase()) && !selectedIds.has(u.id)).slice(0, 8)
    : [];

  const addUser    = (uid: string) => { setSel(p => new Set([...p, uid])); setQuery(""); setSearchRect(null); };
  const removeUser = (uid: string) => { if (uid === myId) return; setSel(p => { const n = new Set(p); n.delete(uid); return n; }); };

  // Derived totals
  const amt        = parseFloat(amount) || 0;
  const exactTotal = Object.values(exacts).reduce((s, v) => s + v, 0);
  const exactRem   = amt - exactTotal;
  const exactOk    = Math.abs(exactRem) < 0.01;
  const pctTotal   = [...selectedIds].reduce((s, i) => s + (percents[i] || 0), 0);

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = [...selectedIds];
    const parsedAmt = parseFloat(amount);
    if (ids.length < 2)                                         return setError("Add at least one other participant.");
    if (!title.trim() || isNaN(parsedAmt) || parsedAmt <= 0)    return setError("Enter a valid title and amount.");
    if (!paidBy || !selectedIds.has(paidBy))                    return setError("Select who paid.");

    let counts: number[] = [];
    if (splitMethod === "EQUAL")      counts = ids.map(() => 1);
    if (splitMethod === "BY_SHARES")  {
      if (ids.some(i => !shares[i]))  return setError("Enter shares for everyone.");
      counts = ids.map(i => shares[i]);
    }
    if (splitMethod === "BY_PERCENT") {
      if (Math.round(pctTotal) !== 100) return setError("Percentages must add up to 100%.");
      counts = ids.map(i => percents[i] || 0);
    }
    if (splitMethod === "BY_EXACT") {
      if (!exactOk) return setError(`$${Math.abs(exactRem).toFixed(2)} ${exactRem > 0 ? "still unallocated" : "over-allocated"}.`);
      // Store as integer cents to avoid float precision issues
      counts = ids.map(i => Math.round((exacts[i] || 0) * 100));
    }
    if (splitMethod === "FULL") {
      if (!fullOwer) return setError("Select who owes the full amount.");
      counts = ids.map(i => i === fullOwer ? 100 : 0);
    }

    setSaving(true); setError(null);
    try {
      if (isEdit && id) {
        await updateExpense(id, { title: title.trim(), amount: parsedAmt, splitMethod, groupId: groupId || null });
        await setExpenseParticipants(id, ids, counts);
      } else {
        await createExpense({
          title: title.trim(), amount: parsedAmt, splitMethod, paidBy,
          groupId: groupId || undefined,
          participantUserIds: ids, participantShareCounts: counts,
        });
      }
      navigate("/");
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  };

  const prefillLabel = prefillFriendId
    ? `Pre-filled with ${users.find(u => u.id === prefillFriendId)?.displayName ?? "friend"}`
    : prefillGroupId
      ? `Pre-filled for ${groups.find(g => g.id === prefillGroupId)?.name ?? "group"} — all members added`
      : null;

  if (loading) return (
    <><style>{css}</style>
    <div className="ef-root"><div className="ef-loading"><div className="ef-spinner" /></div></div></>
  );

  // Shares preview (show dollar amounts per person when shares entered)
  const shareDollarPreview = () => {
    const total = [...selectedIds].reduce((s, i) => s + (shares[i] || 0), 0);
    if (total <= 0 || amt <= 0) return null;
    return [...selectedIds].map(uid => ({
      uid,
      name: uid === myId ? "You" : uName(uid),
      dollar: (shares[uid] || 0) / total * amt,
    }));
  };

  return (
    <>
      <style>{css}</style>
      <div className="ef-root">
        <header className="ef-topbar">
          <Link to="/" className="ef-brand">Split<span className="a">Lite</span></Link>
          <button className="ef-back" onClick={() => navigate(-1)}>← Cancel</button>
        </header>

        <div className="ef-body">
          <div>
            <div className="ef-heading">{isEdit ? "Edit expense" : "New expense"}</div>
            <div className="ef-subheading">{isEdit ? "Update the details below" : "Fill in the details to split"}</div>
          </div>

          {prefillLabel && !isEdit && (
            <div className="ef-prefill-badge"><div className="ef-prefill-dot" />{prefillLabel}</div>
          )}
          {error && <div className="ef-error">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* ── Title ── */}
            <div className="ef-card">
              <div className="ef-card-header">Expense title</div>
              <div className="ef-card-body">
                <input className="ef-input" placeholder="e.g. Dinner, Grab ride, Hotel…" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
            </div>

            {/* ── Amount ── */}
            <div className="ef-card">
              <div className="ef-card-header">Amount</div>
              <div className="ef-card-body">
                <div className="ef-amount-wrap">
                  <span className="ef-amount-sym">$</span>
                  <input className="ef-amount-input" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
              </div>
            </div>

            {/* ── Group ── */}
            <div className="ef-card">
              <div className="ef-card-header">Group (optional)</div>
              <div className="ef-card-body">
                <select className="ef-select" value={groupId} onChange={e => setGroupId(e.target.value)} disabled={!!prefillGroupId && !isEdit}>
                  <option value="">No group — direct expense</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {!!prefillGroupId && !isEdit && <div className="ef-hint">Group pre-set — all members added below</div>}
              </div>
            </div>

            {/* ── Participants ── */}
            <div className="ef-card">
              <div className="ef-card-header">Participants ({selectedIds.size})</div>
              <div className="ef-card-body">
                <div className="ef-chips">
                  {[...selectedIds].map(uid => (
                    <div key={uid} className={`ef-chip ${uid === myId ? "me" : ""}`}>
                      {uid === myId ? "You" : uName(uid)}
                      {uid !== myId && (
                        <button type="button" className="ef-chip-x" onClick={() => removeUser(uid)}>×</button>
                      )}
                    </div>
                  ))}
                </div>

                {/*
                  Search dropdown — using a portal so it's never clipped by the card,
                  but styled to exactly match CreateGroupPage's cg-dropdown / cg-result.
                */}
                <div>
                  <input
                    ref={searchRef}
                    className="ef-input"
                    placeholder="Search by email to add…"
                    value={query}
                    autoComplete="off"
                    onChange={e => {
                      setQuery(e.target.value);
                      if (searchRef.current) setSearchRect(searchRef.current.getBoundingClientRect());
                    }}
                    onFocus={() => {
                      if (searchRef.current) setSearchRect(searchRef.current.getBoundingClientRect());
                    }}
                    onBlur={() => setTimeout(() => setSearchRect(null), 160)}
                  />

                  {results.length > 0 && searchRect && createPortal(
                    <div style={{
                      position: "fixed",
                      top: searchRect.bottom + 4,
                      left: searchRect.left,
                      width: searchRect.width,
                      zIndex: 9999,
                      // ↓ EXACTLY matching .cg-dropdown
                      border: "1px solid #ebebed",
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)",
                      fontFamily: "'DM Sans', sans-serif",
                    }}>
                      {results.map((u, i) => (
                        <div
                          key={u.id}
                          onMouseDown={() => addUser(u.id)}
                          style={{
                            // ↓ EXACTLY matching .cg-result
                            padding: "10px 14px",
                            cursor: "pointer",
                            fontSize: ".87rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            borderBottom: i < results.length - 1 ? "1px solid #ebebed" : "none",
                            background: "transparent",
                            transition: "background .1s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#edfaf7")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <span style={{ fontWeight: 500, color: "#1a1a2e" }}>{u.displayName}</span>
                          <span style={{ fontSize: ".75rem", color: "#8b8fa8" }}>{emailOf(u)}</span>
                        </div>
                      ))}
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </div>

            {/* ── Who paid ── */}
            <div className="ef-card">
              <div className="ef-card-header">Who paid?</div>
              <div className="ef-card-body">
                <div className="ef-paidby-list">
                  {[...selectedIds].map(uid => (
                    <button
                      key={uid}
                      type="button"
                      className={`ef-paidby-pill ${paidBy === uid ? "selected" : ""}`}
                      onClick={() => setPaidBy(uid)}
                    >
                      <div className="ef-paidby-av">{ini(uid === myId ? (user.displayName ?? "Me") : uName(uid))}</div>
                      {uid === myId ? "You" : uName(uid)}
                      {paidBy === uid && " ✓"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── How to split ── */}
            <div className="ef-card">
              <div className="ef-card-header">How to split</div>
              <div className="ef-card-body">
                <div className="ef-tabs">
                  {(["EQUAL","BY_SHARES","BY_PERCENT","BY_EXACT","FULL"] as SplitMethod[]).map(m => (
                    <button key={m} type="button" className={`ef-tab ${splitMethod === m ? "active" : ""}`} onClick={() => setSplit(m)}>
                      {m === "EQUAL" ? "Equal" : m === "BY_SHARES" ? "Shares" : m === "BY_PERCENT" ? "%" : m === "BY_EXACT" ? "Exact $" : "One pays"}
                    </button>
                  ))}
                </div>

                {/* Equal */}
                {splitMethod === "EQUAL" && (
                  <div className="ef-hint">
                    Each person pays ${amt > 0 ? (amt / (selectedIds.size || 1)).toFixed(2) : "0.00"} equally
                  </div>
                )}

                {/* By shares */}
                {splitMethod === "BY_SHARES" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...selectedIds].map(uid => (
                      <div key={uid} className="ef-split-row">
                        <span className="ef-split-name">{uid === myId ? "You" : uName(uid)}</span>
                        <input type="number" min="0" className="ef-split-num" placeholder="shares"
                          value={shares[uid] || ""}
                          onChange={e => setShares({ ...shares, [uid]: Number(e.target.value) })}
                        />
                      </div>
                    ))}
                    {shareDollarPreview() && (
                      <div className="ef-hint">
                        {shareDollarPreview()!.map(({ uid, name, dollar }) => (
                          <span key={uid} style={{ marginRight: 10 }}>{name}: ${dollar.toFixed(2)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* By percent */}
                {splitMethod === "BY_PERCENT" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...selectedIds].map(uid => (
                      <div key={uid} className="ef-split-row">
                        <span className="ef-split-name">{uid === myId ? "You" : uName(uid)}</span>
                        <input type="number" min="0" max="100" className="ef-split-num" placeholder="%"
                          value={percents[uid] || ""}
                          onChange={e => setPercents({ ...percents, [uid]: Number(e.target.value) })}
                        />
                        <span className="ef-split-sym">%</span>
                      </div>
                    ))}
                    <div className="ef-hint" style={{ color: pctTotal === 100 ? "var(--accent)" : "var(--muted)" }}>
                      Total: {pctTotal}%{pctTotal === 100 ? " ✓" : ` — ${100 - pctTotal}% remaining`}
                    </div>
                  </div>
                )}

                {/* Exact $ — new feature */}
                {splitMethod === "BY_EXACT" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...selectedIds].map(uid => (
                      <div key={uid} className="ef-split-row">
                        <span className="ef-split-name">{uid === myId ? "You" : uName(uid)}</span>
                        <span className="ef-split-sym">$</span>
                        <input type="number" min="0" step="0.01" className="ef-split-num" placeholder="0.00"
                          value={exacts[uid] ?? ""}
                          onChange={e => setExacts({ ...exacts, [uid]: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    ))}
                    <div className={`ef-exact-bar ${exactOk ? "ok" : exactRem > 0 ? "under" : "over"}`}>
                      <span>
                        {exactOk
                          ? "✓ Perfectly split"
                          : exactRem > 0
                            ? `$${exactRem.toFixed(2)} still to assign`
                            : `$${Math.abs(exactRem).toFixed(2)} over-allocated`}
                      </span>
                      <span className="ef-exact-mono">${exactTotal.toFixed(2)} / ${amt.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* One pays (full) */}
                {splitMethod === "FULL" && (
                  <div className="ef-radio-list">
                    {[...selectedIds].map(uid => (
                      <label key={uid} className={`ef-radio-item ${fullOwer === uid ? "checked" : ""}`}>
                        <input type="radio" name="fullOwer" value={uid} checked={fullOwer === uid} onChange={() => setFullOwer(uid)} />
                        {uid === myId ? "You owe the full amount" : `${uName(uid)} owes the full amount`}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button type="submit" className="ef-submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}