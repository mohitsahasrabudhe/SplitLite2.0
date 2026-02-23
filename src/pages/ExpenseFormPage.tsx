import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createExpense,
  updateExpense,
  setExpenseParticipants,
  listAllUsers,
  listParticipantsForExpense,
} from "../api/expenses";
import type { UserProfileType } from "../api/expenses";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import styles from "./ExpenseFormPage.module.css";

const client = generateClient<Schema>();

export default function ExpenseFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [splitMethod, setSplitMethod] = useState<"EQUAL" | "BY_SHARES">("EQUAL");

  const [users, setUsers] = useState<UserProfileType[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize Amplify user id safely
  const resolveUserId = (u: UserProfileType) =>
    (u as any).owner ?? (u as any).id;

  const resolveName = (u: UserProfileType) =>
    u.displayName ?? resolveUserId(u);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const allUsers = await listAllUsers();
        if (cancelled) return;
        setUsers(allUsers);

        const myId = user.userId;
        setSelectedIds(new Set([myId]));

        if (isEdit && id) {
          const { data: exp } = await client.models.Expense.get({ id },{
            selectionSet: [
              "id",
              "title",
              "amount",
              "splitMethod",
              "totalShares",
              "paidBy",       // ✅ THIS WAS MISSING
              "createdAt",
            ],
          });
          const participants = await listParticipantsForExpense(id);

          if (!cancelled && exp) {
            const d = (exp as any).data ?? exp;
            setTitle(d.title ?? "");
            setAmount(String(d.amount ?? ""));
            setSplitMethod((d.splitMethod ?? "EQUAL") as any);

            const ids = new Set(participants.map((p) => p.userId));
            ids.add(myId);
            setSelectedIds(ids);

            const counts: Record<string, number> = {};
            participants.forEach((p) => (counts[p.userId] = p.shareCount ?? 1));
            setShareCounts(counts);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isEdit, id]);

  if (!user) return null;
  const myId = user.userId;

  const results = query
    ? users.filter((u) => {
        const name = resolveName(u).toLowerCase();
        return (
          name.includes(query.toLowerCase()) &&
          !selectedIds.has(resolveUserId(u))
        );
      })
    : [];

  const addUser = (id: string) => {
    setSelectedIds((prev) => new Set([...prev, id]));
    setQuery("");
  };

  const removeUser = (id: string) => {
    if (id === myId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const setShare = (userId: string, value: number) => {
    setShareCounts((prev) => ({ ...prev, [userId]: Math.max(1, value) }));
  };

  const titleValid = /^[A-Za-z ]+$/.test(title.trim());
  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titleValid) {
      setError("Title must contain letters only");
      return;
    }

    if (!amountValid) {
      setError("Enter a valid amount");
      return;
    }

    if (selectedIds.size < 2) {
      setError("Select at least two participants");
      return;
    }

    if (!selectedIds.has(myId)) {
      setError("You must be included");
      return;
    }

    const participantUserIds = [...selectedIds];
    const amt = parseFloat(amount);

    setSaving(true);
    setError(null);

    try {
      const totalShares =
        splitMethod === "BY_SHARES"
          ? participantUserIds.reduce(
              (s, uid) => s + (shareCounts[uid] ?? 1),
              0
            )
          : undefined;

      if (isEdit && id) {
        await updateExpense(id, {
          title: title.trim(),
          amount: amt,
          splitMethod,
          totalShares,
        });

        await setExpenseParticipants(
          id,
          participantUserIds,
          splitMethod === "BY_SHARES"
            ? participantUserIds.map((uid) => shareCounts[uid] ?? 1)
            : undefined
        );
      } else {
        await createExpense({
          title: title.trim(),
          amount: amt,
          splitMethod,
          totalShares,
          paidBy: myId,
          participantUserIds,
          participantShareCounts:
            splitMethod === "BY_SHARES"
              ? participantUserIds.map((uid) => shareCounts[uid] ?? 1)
              : undefined,
        });
      }

      navigate("/");
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className={styles.loading}>Loading…</p>;

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{isEdit ? "Edit expense" : "New expense"}</h1>
      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label>Title</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Dinner"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Amount</label>
          <input
            className={styles.input}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="25.00"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Split method</label>
          <select
            className={styles.select}
            value={splitMethod}
            onChange={(e) => setSplitMethod(e.target.value as any)}
          >
            <option value="EQUAL">Equal</option>
            <option value="BY_SHARES">By shares</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Participants</label>

          <input
            className={styles.input}
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {results.map((u) => {
            const uid = resolveUserId(u);
            return (
              <div
                key={uid}
                className={styles.searchResult}
                onClick={() => addUser(uid)}
              >
                {resolveName(u)}
              </div>
            );
          })}

          <div className={styles.selectedList}>
            {[...selectedIds].map((uid) => {
              const u = users.find((x) => resolveUserId(x) === uid);
              return (
                <div key={uid} className={styles.chip}>
                  {u ? resolveName(u) : uid}
                  {uid !== myId && (
                    <button type="button" onClick={() => removeUser(uid)}>
                      ×
                    </button>
                  )}

                  {splitMethod === "BY_SHARES" && (
                    <input
                      type="number"
                      min={1}
                      className={styles.shareInput}
                      value={shareCounts[uid] ?? 1}
                      onChange={(e) =>
                        setShare(uid, parseInt(e.target.value, 10) || 1)
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.button} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Create"}
          </button>
          <Link to="/" className={styles.buttonSecondary}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}