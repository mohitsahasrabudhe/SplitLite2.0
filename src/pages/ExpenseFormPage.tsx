/**
 * Create or edit an expense. Title auto-fills from participant display names; user can override.
 * Split methods: Equal and By Shares (with per-participant share count).
 */
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
import type { ExpenseType, UserProfileType } from "../api/expenses";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<UserProfileType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load users for participant picker; when editing, load expense and participants
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const allUsers = await listAllUsers();
        if (cancelled) return;
        setUsers(allUsers);
        if (isEdit && id) {
          const exp = await client.models.Expense.get({ id });
          const participants = await listParticipantsForExpense(id);
          if (cancelled) return;
          if (exp) {
            setTitle(exp.title ?? "");
            setAmount(String(exp.amount ?? ""));
            setSplitMethod((exp.splitMethod as "EQUAL" | "BY_SHARES") ?? "EQUAL");
            const ids = new Set(participants.map((p) => p.userId));
            setSelectedIds(ids);
            const counts: Record<string, number> = {};
            participants.forEach((p) => {
              counts[p.userId] = p.shareCount ?? 1;
            });
            setShareCounts(counts);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, isEdit, id]);

  // Auto-populate title from selected participants' display names (comma-separated); user can override. Skip in edit so loaded title is preserved.
  useEffect(() => {
    if (isEdit || users.length === 0) return;
    const names = [...selectedIds].map((uid) => {
      if (uid === user?.userId) return "You";
      const p = users.find((u) => {
        const o = (u as UserProfileType & { owner?: string }).owner;
        return o === uid || o?.endsWith(uid);
      });
      return p?.displayName ?? uid;
    });
    setTitle(names.join(", "));
  }, [selectedIds, users, user?.userId]);

  const toggleParticipant = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const setShare = (userId: string, value: number) => {
    setShareCounts((prev) => ({ ...prev, [userId]: Math.max(1, value) }));
  };

  const getDisplayName = (profile: UserProfileType & { owner?: string }) => {
    if (profile.owner === user?.userId || profile.owner?.endsWith(user?.userId ?? "")) return "You";
    return profile.displayName ?? profile.owner ?? "?";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    const participantUserIds = [...selectedIds];
    if (participantUserIds.length === 0) {
      setError("Select at least one participant");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEdit && id) {
        const totalShares =
          splitMethod === "BY_SHARES"
            ? participantUserIds.reduce((s, uid) => s + (shareCounts[uid] ?? 1), 0)
            : undefined;
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
        navigate("/");
      } else {
        const totalShares =
          splitMethod === "BY_SHARES"
            ? participantUserIds.reduce((s, uid) => s + (shareCounts[uid] ?? 1), 0)
            : undefined;
        const shareCountsArr =
          splitMethod === "BY_SHARES"
            ? participantUserIds.map((uid) => shareCounts[uid] ?? 1)
            : undefined;
        await createExpense({
          title: title.trim(),
          amount: amt,
          splitMethod,
          totalShares,
          participantUserIds,
          participantShareCounts: shareCountsArr,
        });
        navigate("/");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{isEdit ? "Edit expense" : "New expense"}</h1>
      {error && <p className={styles.error}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Title</label>
          <input
            className={styles.input}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dinner, Alex, Sam"
            required
          />
          <small>Auto-filled from participants; you can change it.</small>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Amount</label>
          <input
            className={styles.input}
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Split method</label>
          <select
            className={styles.select}
            value={splitMethod}
            onChange={(e) => setSplitMethod(e.target.value as "EQUAL" | "BY_SHARES")}
          >
            <option value="EQUAL">Equal</option>
            <option value="BY_SHARES">By shares</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <span className={styles.label}>Participants</span>
          <div className={styles.participants}>
            {users.map((profile) => {
              const profileWithOwner = profile as UserProfileType & { owner?: string };
              const uid = profileWithOwner.owner ?? (profile as { id: string }).id;
              const name = getDisplayName(profileWithOwner);
              return (
                <div key={uid} className={styles.participantRow}>
                  <label>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.has(uid)}
                      onChange={() => toggleParticipant(uid)}
                    />
                    {name}
                  </label>
                  {splitMethod === "BY_SHARES" && selectedIds.has(uid) && (
                    <input
                      type="number"
                      min={1}
                      className={styles.shareInput}
                      value={shareCounts[uid] ?? 1}
                      onChange={(e) => setShare(uid, parseInt(e.target.value, 10) || 1)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.button} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update" : "Create"}
          </button>
          <Link to="/" className={`${styles.button} ${styles.buttonSecondary}`}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
