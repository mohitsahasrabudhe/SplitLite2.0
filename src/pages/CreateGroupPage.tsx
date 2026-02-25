import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createGroup,
  listAllUsers,
} from "../api/expenses";
import type { UserProfileType } from "../api/expenses";
import styles from "./AuthPage.module.css";

export default function CreateGroupPage() {
  const { user } = useAuth();
  if (!user) return null;

  const navigate = useNavigate();
  const currentUserId = user.userId;

  const [name, setName] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfileType[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const users = await listAllUsers();
        setAllUsers(users.filter((u) => u && u.id));
      } catch {
        setAllUsers([]);
      }
    })();
  }, []);

  const filteredUsers = allUsers.filter(
    (u) =>
      u.id !== currentUserId &&
      (u as any).email
        ?.toLowerCase()
        .includes(search.toLowerCase())
  );

  function toggleUser(id: string) {
    setSelectedUserIds((prev) =>
      prev.includes(id)
        ? prev.filter((u) => u !== id)
        : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);

      await createGroup({
        name: name.trim(),
        memberUserIds: [currentUserId, ...selectedUserIds],
      });

      navigate("/");
    } catch {
      alert("Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h2>Create Group</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "16px" }}>
          <label>Group Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label>Add Members</label>
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div style={{ marginTop: "8px" }}>
            {filteredUsers.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);

              return (
                <div key={u.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(u.id)}
                    />
                    {u.displayName} — {(u as any).email}
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Group"}
        </button>
      </form>
    </div>
  );
}