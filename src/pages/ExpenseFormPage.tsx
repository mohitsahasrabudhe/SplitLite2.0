import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

type SplitMethod = "EQUAL" | "BY_SHARES" | "BY_PERCENT" | "FULL";

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

  .ef-root {
    min-height: 100vh; background: var(--bg);
    display: flex; flex-direction: column; align-items: center; padding: 32px 16px;
  }
  .ef-brand { font-size: 1.1rem; font-weight: 600; letter-spacing: -.3px; margin-bottom: 28px; }
  .ef-brand span { color: var(--accent); }
  .ef-brand .ver { color: var(--muted); font-weight: 400; }

  .ef-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 28px; width: 100%; max-width: 480px;
  }
  .ef-title { font-size: 1.25rem; font-weight: 600; letter-spacing: -.3px; margin-bottom: 4px; }
  .ef-sub { font-size: .85rem; color: var(--muted); margin-bottom: 24px; }

  .ef-error {
    background: var(--red-bg); color: var(--red);
    border-radius: 8px; padding: 10px 14px; font-size: .82rem; margin-bottom: 16px;
  }

  .ef-section { margin-bottom: 22px; }
  .ef-label { font-size: .8rem; font-weight: 500; color: var(--muted); margin-bottom: 6px; display: block; }
  .ef-input, .ef-select {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    border: 1.5px solid var(--border); background: var(--bg);
    font-family: inherit; font-size: .9rem; color: var(--text);
    outline: none; transition: border-color .15s; appearance: none;
  }
  .ef-input:focus, .ef-select:focus { border-color: var(--accent); background: var(--surface); }
  .ef-input::placeholder { color: var(--muted); }

  /* amount row */
  .ef-amount-row { position: relative; }
  .ef-amount-prefix {
    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    color: var(--muted); font-size: .95rem; font-family: 'DM Mono', monospace;
    pointer-events: none;
  }
  .ef-amount-input {
    padding-left: 28px !important;
    font-family: 'DM Mono', monospace; font-size: 1rem;
  }

  /* search dropdown */
  .ef-dropdown {
    margin-top: 6px; border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden; background: var(--surface); box-shadow: var(--shadow);
  }
  .ef-result {
    padding: 10px 14px; cursor: pointer; font-size: .87rem;
    display: flex; flex-direction: column; gap: 2px; transition: background .1s;
  }
  .ef-result:not(:last-child) { border-bottom: 1px solid var(--border); }
  .ef-result:hover { background: var(--accent-bg); }
  .ef-result-name { font-weight: 500; }
  .ef-result-email { font-size: .75rem; color: var(--muted); }

  /* participants */
  .ef-participants { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .ef-participant {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 12px; border-radius: 9px;
    background: var(--accent-bg); border: 1px solid #c8f0e8;
  }
  .ef-participant.me { background: var(--bg); border-color: var(--border); }
  .ef-p-name { font-size: .87rem; font-weight: 500; }
  .ef-p-you { font-size: .75rem; color: var(--muted); margin-left: 4px; }
  .ef-remove {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 1.1rem; padding: 2px 6px;
    border-radius: 6px; transition: all .12s;
  }
  .ef-remove:hover { background: var(--red-bg); color: var(--red); }

  /* split tabs */
  .ef-tabs { display: flex; background: var(--bg); border-radius: 10px; padding: 3px; gap: 2px; }
  .ef-tab {
    flex: 1; padding: 8px 6px; border-radius: 8px; border: none;
    font-family: inherit; font-size: .78rem; font-weight: 500;
    cursor: pointer; color: var(--muted); background: transparent; transition: all .15s;
    text-align: center;
  }
  .ef-tab.active { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.08); }

  /* shares/percent inputs */
  .ef-split-inputs { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .ef-split-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-radius: 9px; background: var(--bg); border: 1px solid var(--border);
  }
  .ef-split-name { font-size: .85rem; font-weight: 500; }
  .ef-split-input {
    width: 80px; padding: 6px 10px; border-radius: 7px;
    border: 1.5px solid var(--border); background: var(--surface);
    font-family: 'DM Mono', monospace; font-size: .85rem; text-align: right;
    outline: none; transition: border-color .15s;
  }
  .ef-split-input:focus { border-color: var(--accent); }
  .ef-split-suffix { font-size: .78rem; color: var(--muted); margin-left: 4px; }

  /* actions */
  .ef-actions { display: flex; gap: 10px; margin-top: 24px; }
  .ef-btn {
    flex: 1; padding: 12px; border-radius: 10px; border: none;
    font-family: inherit; font-size: .9rem; font-weight: 500;
    cursor: pointer; transition: all .15s; text-align: center; text-decoration: none;
    display: flex; align-items: center; justify-content: center;
  }
  .ef-btn-primary { background: var(--text); color: #fff; }
  .ef-btn-primary:hover:not(:disabled) { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .ef-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .ef-btn-ghost { background: transparent; color: var(--muted); border: 1.5px solid var(--border); }
  .ef-btn-ghost:hover { background: var(--bg); color: var(--text); }

  .ef-loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .ef-spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid var(--border); border-top-color: var(--accent);
    animation: spin .7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 480px) {
    .ef-card { padding: 20px 16px; }
    .ef-tab { font-size: .72rem; padding: 7px 4px; }
  }
`;

export default function ExpenseFormPage() {
  const { user } = useAuth();
  if (!user) return null;

  const myId = user.userId;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [groupId, setGroupId] = useState<string | "">("");
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("EQUAL");
  const [shares, setShares] = useState<Record<string, number>>({});
  const [percents, setPercents] = useState<Record<string, number>>({});
  const [fullOwer, setFullOwer] = useState("");
  const [users, setUsers] = useState<UserProfileType[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveEmail = (u: any) => (u.email ?? "").toLowerCase();

  useEffect(() => {
    (async () => {
      try {
        const [allUsers, myGroups] = await Promise.all([listAllUsers(), listMyGroups(myId)]);
        setUsers(allUsers.filter(u => u?.id));
        setGroups(myGroups.filter(g => g?.id));
        if (!isEdit) setSelectedIds(new Set([myId]));
      } catch { setError("Failed to load data"); }
      finally { setLoading(false); }
    })();
  }, [myId, isEdit]);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      try {
        const participants = await listParticipantsForExpense(id);
        const ids = participants.filter(p => p?.userId).map(p => p.userId);
        setSelectedIds(new Set(ids));
        const shareMap: Record<string, number> = {};
        participants.forEach(p => { if (p.userId && typeof p.shareCount === "number") shareMap[p.userId] = p.shareCount; });
        setShares(shareMap);
      } catch { setError("Failed to load expense data"); }
    })();
  }, [isEdit, id]);

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      try {
        const members = await listGroupMembers(groupId);
        setSelectedIds(new Set([myId, ...members.map(m => m.userId).filter(Boolean)]));
      } catch { console.warn("Failed to load group members"); }
    })();
  }, [groupId, myId]);

  const results = query
    ? users.filter(u => resolveEmail(u).includes(query.toLowerCase()) && !selectedIds.has(u.id))
    : [];

  const addUser = (uid: string) => { setSelectedIds(p => new Set([...p, uid])); setQuery(""); };
  const removeUser = (uid: string) => {
    if (uid === myId) return;
    setSelectedIds(p => { const n = new Set(p); n.delete(uid); return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = [...selectedIds];
    const amt = parseFloat(amount);
    if (ids.length < 2) return setError("Select at least two participants");
    if (!title.trim() || isNaN(amt)) return setError("Enter a valid amount");

    let counts: number[] = [];
    if (splitMethod === "EQUAL") counts = ids.map(() => 1);
    if (splitMethod === "BY_SHARES") {
      for (const uid of ids) if (!shares[uid]) return setError("Enter all shares");
      counts = ids.map(uid => shares[uid]);
    }
    if (splitMethod === "BY_PERCENT") {
      const total = ids.reduce((s, uid) => s + (percents[uid] || 0), 0);
      if (Math.round(total) !== 100) return setError("Percentages must total 100%");
      counts = ids.map(uid => percents[uid]);
    }
    if (splitMethod === "FULL") {
      if (!fullOwer) return setError("Select who owes the full amount");
      counts = ids.map(uid => (uid === fullOwer ? 100 : 0));
    }

    setSaving(true); setError(null);
    try {
      if (isEdit && id) {
        await updateExpense(id, { title: title.trim(), amount: amt, splitMethod, groupId: groupId || null });
        await setExpenseParticipants(id, ids, counts);
      } else {
        await createExpense({
          title: title.trim(), amount: amt, splitMethod, paidBy: myId,
          groupId: groupId || undefined, participantUserIds: ids, participantShareCounts: counts,
        });
      }
      navigate("/");
    } catch { setError("Save failed — please try again"); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <><style>{css}</style><div className="ef-loading"><div className="ef-spinner" /></div></>
  );

  const selectedArr = [...selectedIds];

  return (
    <>
      <style>{css}</style>
      <div className="ef-root">
        <div className="ef-brand">Split<span>Lite</span> <span className="ver">2.0</span></div>
        <div className="ef-card">
          <div className="ef-title">{isEdit ? "Edit expense" : "New expense"}</div>
          <div className="ef-sub">{isEdit ? "Update the details below." : "Add a new shared expense."}</div>

          {error && <div className="ef-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div className="ef-section">
              <label className="ef-label">What was it for?</label>
              <input className="ef-input" placeholder="e.g. Dinner, Uber, Groceries"
                value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            {/* Amount */}
            <div className="ef-section">
              <label className="ef-label">Amount</label>
              <div className="ef-amount-row">
                <span className="ef-amount-prefix">$</span>
                <input className="ef-input ef-amount-input" placeholder="0.00" type="number"
                  step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            </div>

            {/* Group */}
            {groups.length > 0 && (
              <div className="ef-section">
                <label className="ef-label">Group (optional)</label>
                <select className="ef-select" value={groupId} onChange={e => setGroupId(e.target.value)}>
                  <option value="">No group — direct split</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {/* Participants */}
            <div className="ef-section">
              <label className="ef-label">Who's splitting?</label>
              <input className="ef-input" placeholder="Search by email to add someone…"
                value={query} onChange={e => setQuery(e.target.value)} />

              {results.length > 0 && (
                <div className="ef-dropdown">
                  {results.map(u => (
                    <div key={u.id} className="ef-result" onClick={() => addUser(u.id)}>
                      <span className="ef-result-name">{u.displayName}</span>
                      <span className="ef-result-email">{resolveEmail(u)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="ef-participants">
                {selectedArr.map(uid => {
                  const u = users.find(u => u.id === uid);
                  const isMe = uid === myId;
                  return (
                    <div key={uid} className={`ef-participant${isMe ? " me" : ""}`}>
                      <div>
                        <span className="ef-p-name">{u?.displayName ?? uid}</span>
                        {isMe && <span className="ef-p-you">· you</span>}
                      </div>
                      {!isMe && (
                        <button type="button" className="ef-remove" onClick={() => removeUser(uid)}>×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Split method */}
            <div className="ef-section">
              <label className="ef-label">How to split?</label>
              <div className="ef-tabs">
                {(["EQUAL", "BY_SHARES", "BY_PERCENT", "FULL"] as SplitMethod[]).map(m => (
                  <button key={m} type="button"
                    className={`ef-tab${splitMethod === m ? " active" : ""}`}
                    onClick={() => setSplitMethod(m)}>
                    {m === "EQUAL" ? "Equal" : m === "BY_SHARES" ? "Shares" : m === "BY_PERCENT" ? "%" : "One"}
                  </button>
                ))}
              </div>

              {splitMethod === "BY_SHARES" && (
                <div className="ef-split-inputs">
                  {selectedArr.map(uid => (
                    <div key={uid} className="ef-split-row">
                      <span className="ef-split-name">{users.find(u => u.id === uid)?.displayName}</span>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <input type="number" className="ef-split-input" placeholder="0"
                          value={shares[uid] || ""} onChange={e => setShares({ ...shares, [uid]: Number(e.target.value) })} />
                        <span className="ef-split-suffix">shares</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {splitMethod === "BY_PERCENT" && (
                <div className="ef-split-inputs">
                  {selectedArr.map(uid => (
                    <div key={uid} className="ef-split-row">
                      <span className="ef-split-name">{users.find(u => u.id === uid)?.displayName}</span>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <input type="number" className="ef-split-input" placeholder="0"
                          value={percents[uid] || ""} onChange={e => setPercents({ ...percents, [uid]: Number(e.target.value) })} />
                        <span className="ef-split-suffix">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {splitMethod === "FULL" && (
                <div style={{ marginTop: 10 }}>
                  <select className="ef-select" value={fullOwer} onChange={e => setFullOwer(e.target.value)}>
                    <option value="">Who owes the full amount?</option>
                    {selectedArr.map(uid => (
                      <option key={uid} value={uid}>{users.find(u => u.id === uid)?.displayName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="ef-actions">
              <Link to="/" className="ef-btn ef-btn-ghost">Cancel</Link>
              <button type="submit" className="ef-btn ef-btn-primary" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
