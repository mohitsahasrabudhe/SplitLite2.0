import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createGroup, listAllUsers } from "../api/expenses";
import type { UserProfileType } from "../api/expenses";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f8fa; --surface: #ffffff; --border: #ebebed;
    --text: #1a1a2e; --muted: #8b8fa8; --accent: #3ecfb2;
    --accent-bg: #edfaf7; --red: #ff6b6b; --red-bg: #fff0f0;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --radius: 14px;
  }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }

  .cg-root {
    min-height: 100vh; background: var(--bg);
    display: flex; flex-direction: column; align-items: center;
    padding: 32px 16px;
  }
  .cg-brand {
    font-size: 1.1rem; font-weight: 600; letter-spacing: -.3px;
    margin-bottom: 28px; color: var(--text);
  }
  .cg-brand span { color: var(--accent); }
  .cg-brand .ver { color: var(--muted); font-weight: 400; }

  .cg-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 28px; width: 100%; max-width: 440px;
  }
  .cg-title { font-size: 1.25rem; font-weight: 600; letter-spacing: -.3px; margin-bottom: 4px; }
  .cg-sub { font-size: .85rem; color: var(--muted); margin-bottom: 24px; }

  .cg-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
  .cg-label { font-size: .8rem; font-weight: 500; color: var(--muted); }
  .cg-input {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    border: 1.5px solid var(--border); background: var(--bg);
    font-family: inherit; font-size: .9rem; color: var(--text);
    outline: none; transition: border-color .15s;
  }
  .cg-input:focus { border-color: var(--accent); background: var(--surface); }
  .cg-input::placeholder { color: var(--muted); }

  /* portal dropdown — rendered in body, not here */
  .cg-portal-dropdown {
    position: fixed;
    z-index: 9999;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,.12);
  }
  .cg-result {
    padding: 10px 14px; cursor: pointer; font-size: .87rem;
    transition: background .1s; display: flex; flex-direction: column; gap: 2px;
    font-family: 'DM Sans', sans-serif;
  }
  .cg-result:not(:last-child) { border-bottom: 1px solid var(--border); }
  .cg-result:hover { background: var(--accent-bg); }
  .cg-result-name { font-weight: 500; color: var(--text); }
  .cg-result-email { font-size: .75rem; color: var(--muted); }

  /* selected members */
  .cg-members { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .cg-member {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; border-radius: 10px; background: var(--accent-bg);
    border: 1px solid #c8f0e8;
  }
  .cg-member-info { display: flex; flex-direction: column; gap: 1px; }
  .cg-member-name { font-size: .87rem; font-weight: 500; color: var(--text); }
  .cg-member-email { font-size: .75rem; color: var(--muted); }
  .cg-remove {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 1.1rem; line-height: 1;
    padding: 2px 6px; border-radius: 6px; transition: all .12s;
  }
  .cg-remove:hover { background: var(--red-bg); color: var(--red); }

  .cg-me-badge {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 10px;
    background: var(--bg); border: 1px solid var(--border);
    margin-bottom: 4px;
  }
  .cg-me-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .cg-me-text { font-size: .87rem; color: var(--muted); }
  .cg-me-text strong { color: var(--text); font-weight: 500; }

  .cg-actions { display: flex; gap: 10px; margin-top: 24px; }
  .cg-btn {
    flex: 1; padding: 12px; border-radius: 10px; border: none;
    font-family: inherit; font-size: .9rem; font-weight: 500;
    cursor: pointer; transition: all .15s;
  }
  .cg-btn-primary { background: var(--text); color: #fff; }
  .cg-btn-primary:hover:not(:disabled) { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .cg-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .cg-btn-ghost { background: transparent; color: var(--muted); border: 1.5px solid var(--border); }
  .cg-btn-ghost:hover { background: var(--bg); color: var(--text); }

  .cg-count { font-size: .78rem; color: var(--muted); margin-top: 8px; }

  @media (max-width: 480px) {
    .cg-card { padding: 20px 16px; }
  }
`;

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

  // FIX #5: ref on the search input so the portal can position itself
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

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

  const searchResults = search
    ? allUsers.filter(
        (u) =>
          u.id !== currentUserId &&
          !selectedUserIds.includes(u.id) &&
          (u as any).email?.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  // FIX #5: recalculate rect whenever results appear
  useEffect(() => {
    if (searchResults.length > 0 && searchInputRef.current) {
      setDropdownRect(searchInputRef.current.getBoundingClientRect());
    } else {
      setDropdownRect(null);
    }
  }, [searchResults.length]);

  function addUser(id: string) {
    setSelectedUserIds((prev) => [...prev, id]);
    setSearch("");
  }

  function removeUser(id: string) {
    setSelectedUserIds((prev) => prev.filter((u) => u !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setLoading(true);
      const result = await createGroup({
        name: name.trim(),
        memberUserIds: [currentUserId, ...selectedUserIds],
      });
      // FIX #1: navigate directly to the new group instead of "/"
      const newGroupId = (result as any)?.id ?? (result as any)?.data?.id;
      if (newGroupId) {
        navigate(`/group/${newGroupId}`);
      } else {
        navigate("/");
      }
    } catch {
      alert("Failed to create group");
    } finally {
      setLoading(false);
    }
  }

  const meUser = allUsers.find((u) => u.id === currentUserId);
  const totalMembers = 1 + selectedUserIds.length;

  return (
    <>
      <style>{css}</style>
      <div className="cg-root">
        <div className="cg-brand">Split<span>Lite</span> <span className="ver">2.0</span></div>
        <div className="cg-card">
          <div className="cg-title">Create a group</div>
          <div className="cg-sub">Give your group a name and add members.</div>

          <form onSubmit={handleSubmit}>
            <div className="cg-field">
              <label className="cg-label">Group name</label>
              <input
                className="cg-input"
                type="text"
                placeholder="e.g. Goa Trip, Roommates"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="cg-field">
              <label className="cg-label">Add members</label>

              {/* FIX #5: attach ref to the search input */}
              <input
                ref={searchInputRef}
                className="cg-input"
                type="text"
                placeholder="Search by email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />

              {/* FIX #5: render dropdown via portal so overflow:hidden can't clip it */}
              {searchResults.length > 0 && dropdownRect &&
                createPortal(
                  <div
                    className="cg-portal-dropdown"
                    style={{
                      top: dropdownRect.bottom + 4,
                      left: dropdownRect.left,
                      width: dropdownRect.width,
                    }}
                  >
                    {searchResults.map((u) => (
                      <div
                        key={u.id}
                        className="cg-result"
                        onMouseDown={() => addUser(u.id)} // onMouseDown fires before onBlur
                      >
                        <span className="cg-result-name">{u.displayName}</span>
                        <span className="cg-result-email">{(u as any).email}</span>
                      </div>
                    ))}
                  </div>,
                  document.body
                )
              }

              {/* members list */}
              <div className="cg-members">
                <div className="cg-me-badge">
                  <div className="cg-me-dot" />
                  <span className="cg-me-text">
                    <strong>{meUser?.displayName ?? "You"}</strong> (you, always included)
                  </span>
                </div>

                {selectedUserIds.map((id) => {
                  const u = allUsers.find((user) => user.id === id);
                  return (
                    <div key={id} className="cg-member">
                      <div className="cg-member-info">
                        <span className="cg-member-name">{u?.displayName}</span>
                        <span className="cg-member-email">{(u as any)?.email}</span>
                      </div>
                      <button type="button" className="cg-remove" onClick={() => removeUser(id)}>×</button>
                    </div>
                  );
                })}
              </div>

              {totalMembers > 1 && (
                <div className="cg-count">{totalMembers} member{totalMembers !== 1 ? "s" : ""} total</div>
              )}
            </div>

            <div className="cg-actions">
              <button type="button" className="cg-btn cg-btn-ghost" onClick={() => navigate("/")} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="cg-btn cg-btn-primary" disabled={loading}>
                {loading ? "Creating…" : "Create group"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}