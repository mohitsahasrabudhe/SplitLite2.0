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

  /* =========================
     Search Results (click to add)
     ========================= */

  const searchResults = search
    ? allUsers.filter(
        (u) =>
          u.id !== currentUserId &&
          !selectedUserIds.includes(u.id) &&
          (u as any).email
            ?.toLowerCase()
            .includes(search.toLowerCase())
      )
    : [];

  function addUser(id: string) {
    setSelectedUserIds((prev) => [...prev, id]);
    setSearch("");
  }

  function removeUser(id: string) {
    setSelectedUserIds((prev) =>
      prev.filter((u) => u !== id)
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
        {/* Group Name */}
        <div style={{ marginBottom: "16px" }}>
          <label>Group Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Search */}
        <div style={{ marginBottom: "16px" }}>
          <label>Add Members</label>

          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  style={{
                    padding: "6px 0",
                    cursor: "pointer",
                  }}
                  onClick={() => addUser(u.id)}
                >
                  {u.displayName} — {(u as any).email}
                </div>
              ))}
            </div>
          )}

          {/* Selected Members */}
          {selectedUserIds.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <strong>Selected:</strong>

              {selectedUserIds.map((id) => {
                const u = allUsers.find(
                  (user) => user.id === id
                );

                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "6px",
                    }}
                  >
                    <span>
                      {u?.displayName} — {(u as any)?.email}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeUser(id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Group"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}