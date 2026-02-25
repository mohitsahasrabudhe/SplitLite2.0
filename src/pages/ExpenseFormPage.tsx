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
import styles from "./ExpenseFormPage.module.css";

type SplitMethod = "EQUAL" | "BY_SHARES" | "BY_PERCENT" | "FULL";

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

  /* ========================= INITIAL LOAD ========================= */

  useEffect(() => {
    (async () => {
      try {
        const [allUsers, myGroups] = await Promise.all([
          listAllUsers(),
          listMyGroups(myId),
        ]);

        setUsers(allUsers.filter(u => u?.id));
        setGroups(myGroups.filter(g => g?.id));

        if (!isEdit) {
          setSelectedIds(new Set([myId]));
        }
      } catch {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [myId, isEdit]);

  /* ========================= EDIT MODE LOAD ========================= */

  useEffect(() => {
    if (!isEdit || !id) return;

    (async () => {
      try {
        const participants = await listParticipantsForExpense(id);

        const ids = participants
          .filter(p => p?.userId)
          .map(p => p.userId);

        setSelectedIds(new Set(ids));

        const shareMap: Record<string, number> = {};
        participants.forEach(p => {
          if (p.userId && typeof p.shareCount === "number") {
            shareMap[p.userId] = p.shareCount;
          }
        });

        setShares(shareMap);

        // Infer split type from stored splitMethod
        // (already saved correctly)
        // We assume updateExpense saved correct splitMethod
      } catch {
        setError("Failed to load expense data");
      }
    })();
  }, [isEdit, id]);

  /* ========================= GROUP AUTO ADD ========================= */

  useEffect(() => {
    if (!groupId) return;

    (async () => {
      try {
        const members = await listGroupMembers(groupId);
        setSelectedIds(
          new Set([myId, ...members.map(m => m.userId).filter(Boolean)])
        );
      } catch {
        console.warn("Failed to load group members");
      }
    })();
  }, [groupId, myId]);

  /* ========================= SEARCH ========================= */

  const results = query
    ? users.filter(
        u =>
          resolveEmail(u).includes(query.toLowerCase()) &&
          !selectedIds.has(u.id)
      )
    : [];

  const addUser = (id: string) => {
    setSelectedIds(p => new Set([...p, id]));
    setQuery("");
  };

  const removeUser = (id: string) => {
    if (id === myId) return;
    setSelectedIds(p => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  };

  /* ========================= SUBMIT ========================= */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ids = [...selectedIds];
    const amt = parseFloat(amount);

    if (ids.length < 2) return setError("Select at least two participants");
    if (!title.trim() || isNaN(amt)) return setError("Enter valid amount");

    let counts: number[] = [];

    if (splitMethod === "EQUAL") {
      counts = ids.map(() => 1);
    }

    if (splitMethod === "BY_SHARES") {
      for (const id of ids)
        if (!shares[id]) return setError("Enter all shares");
      counts = ids.map(id => shares[id]);
    }

    if (splitMethod === "BY_PERCENT") {
      const total = ids.reduce((s, id) => s + (percents[id] || 0), 0);
      if (Math.round(total) !== 100)
        return setError("Percent must total 100%");
      counts = ids.map(id => percents[id]);
    }

    if (splitMethod === "FULL") {
      if (!fullOwer) return setError("Select who owes full amount");
      counts = ids.map(id => (id === fullOwer ? 100 : 0));
    }

    setSaving(true);
    setError(null);

    try {
      if (isEdit && id) {
        await updateExpense(id, {
          title: title.trim(),
          amount: amt,
          splitMethod,
          groupId: groupId || null,
        });

        await setExpenseParticipants(id, ids, counts);
      } else {
        await createExpense({
          title: title.trim(),
          amount: amt,
          splitMethod,
          paidBy: myId,
          groupId: groupId || undefined,
          participantUserIds: ids,
          participantShareCounts: counts,
        });
      }

      navigate("/");
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  /* ========================= UI ========================= */

  return (
    <div className={styles.container}>
      <h1>{isEdit ? "Edit expense" : "New expense"}</h1>

      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <input
          className={styles.input}
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        {/* Group dropdown restored */}
        <select
          className={styles.select}
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
        >
          <option value="">No group</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        {/* Participants */}
        <input
          className={styles.input}
          placeholder="Search by email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {results.map(u => (
          <div key={u.id} onClick={() => addUser(u.id)}>
            {u.displayName} — {resolveEmail(u)}
          </div>
        ))}

        {[...selectedIds].map(uid => (
          <div key={uid}>
            {users.find(u => u.id === uid)?.displayName}
            {uid !== myId && (
              <button type="button" onClick={() => removeUser(uid)}>
                ×
              </button>
            )}
          </div>
        ))}

        {/* Amount */}
        <input
          className={styles.input}
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        {/* Split type */}
        <select
          value={splitMethod}
          onChange={e => setSplitMethod(e.target.value as SplitMethod)}
        >
          <option value="EQUAL">Equal</option>
          <option value="BY_SHARES">By shares</option>
          <option value="BY_PERCENT">By percent</option>
          <option value="FULL">One person owes all</option>
        </select>

        {/* Dynamic split inputs */}
        {splitMethod === "BY_SHARES" &&
          [...selectedIds].map(id => (
            <input
              key={id}
              type="number"
              placeholder={`Shares for ${users.find(u => u.id === id)?.displayName}`}
              value={shares[id] || ""}
              onChange={e =>
                setShares({ ...shares, [id]: Number(e.target.value) })
              }
            />
          ))}

        {splitMethod === "BY_PERCENT" &&
          [...selectedIds].map(id => (
            <input
              key={id}
              type="number"
              placeholder={`% for ${users.find(u => u.id === id)?.displayName}`}
              value={percents[id] || ""}
              onChange={e =>
                setPercents({ ...percents, [id]: Number(e.target.value) })
              }
            />
          ))}

        {splitMethod === "FULL" && (
          <select value={fullOwer} onChange={e => setFullOwer(e.target.value)}>
            <option value="">Who owes?</option>
            {[...selectedIds].map(id => (
              <option key={id} value={id}>
                {users.find(u => u.id === id)?.displayName}
              </option>
            ))}
          </select>
        )}

        <button disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>

        <Link to="/">Cancel</Link>
      </form>
    </div>
  );
}