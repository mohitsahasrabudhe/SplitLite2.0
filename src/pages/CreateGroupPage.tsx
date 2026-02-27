import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createGroup, listAllUsers } from "../api/expenses";
import type { UserProfileType } from "../api/expenses";

type GroupTypeKey = "PARTNER" | "TRIP" | "HOUSEHOLD" | "GROUP";
type ReminderFreq  = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

const GROUP_TYPES: { key: GroupTypeKey; emoji: string; label: string; desc: string }[] = [
  { key: "PARTNER",   emoji: "👫", label: "Partner",   desc: "Just the two of us"     },
  { key: "TRIP",      emoji: "✈️", label: "Trip",      desc: "We're going somewhere"  },
  { key: "HOUSEHOLD", emoji: "🏠", label: "Household", desc: "We live together"       },
  { key: "GROUP",     emoji: "👥", label: "Group",     desc: "Just a bunch of people" },
];

const TYPE_SETTINGS: Record<GroupTypeKey, { reminder: boolean; balanceAlert: boolean }> = {
  PARTNER:   { reminder: false, balanceAlert: true  },
  TRIP:      { reminder: false, balanceAlert: false },
  HOUSEHOLD: { reminder: true,  balanceAlert: true  },
  GROUP:     { reminder: true,  balanceAlert: false },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f8fa; --surface: #ffffff; --border: #ebebed;
    --text: #1a1a2e; --muted: #8b8fa8; --accent: #3ecfb2;
    --accent-bg: #edfaf7; --accent-dark: #2ab99e;
    --red: #ff6b6b; --red-bg: #fff0f0;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --radius: 14px;
  }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }
  .cg-root { min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; align-items: center; padding: 32px 16px; }
  .cg-brand { font-size: 1.1rem; font-weight: 600; letter-spacing: -.3px; margin-bottom: 20px; color: var(--text); }
  .cg-brand span { color: var(--accent); }
  .cg-brand .ver { color: var(--muted); font-weight: 400; }

  .cg-steps { display: flex; align-items: flex-start; margin-bottom: 24px; width: 100%; max-width: 440px; }
  .cg-step-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .cg-step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .78rem; font-weight: 600; border: 2px solid var(--border); background: var(--surface); color: var(--muted); transition: all .2s; }
  .cg-step-dot.active { border-color: var(--accent); background: var(--accent); color: #fff; }
  .cg-step-dot.done   { border-color: var(--accent); background: var(--accent-bg); color: var(--accent-dark); }
  .cg-step-lbl { font-size: .7rem; color: var(--muted); font-weight: 500; white-space: nowrap; }
  .cg-step-lbl.active { color: var(--accent); }
  .cg-step-line { flex: 1; height: 2px; background: var(--border); margin: 14px 4px 0; transition: background .2s; }
  .cg-step-line.done { background: var(--accent); }

  .cg-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 28px; width: 100%; max-width: 440px; }
  .cg-back { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; color: var(--muted); font-family: inherit; font-size: .82rem; font-weight: 500; padding: 0; margin-bottom: 18px; transition: color .12s; }
  .cg-back:hover { color: var(--text); }
  .cg-title { font-size: 1.2rem; font-weight: 600; letter-spacing: -.3px; margin-bottom: 4px; }
  .cg-sub { font-size: .85rem; color: var(--muted); margin-bottom: 22px; }

  .cg-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
  .cg-label { font-size: .8rem; font-weight: 500; color: var(--muted); }
  .cg-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg); font-family: inherit; font-size: .9rem; color: var(--text); outline: none; transition: border-color .15s; }
  .cg-input:focus { border-color: var(--accent); background: var(--surface); }
  .cg-input::placeholder { color: var(--muted); }

  .cg-portal-dropdown { position: fixed; z-index: 9999; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,.12); }
  .cg-result { padding: 10px 14px; cursor: pointer; font-size: .87rem; transition: background .1s; display: flex; flex-direction: column; gap: 2px; font-family: 'DM Sans', sans-serif; }
  .cg-result:not(:last-child) { border-bottom: 1px solid var(--border); }
  .cg-result:hover { background: var(--accent-bg); }
  .cg-result-name { font-weight: 500; color: var(--text); }
  .cg-result-email { font-size: .75rem; color: var(--muted); }

  .cg-members { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
  .cg-member { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; background: var(--accent-bg); border: 1px solid #c8f0e8; }
  .cg-member-info { display: flex; flex-direction: column; gap: 1px; }
  .cg-member-name { font-size: .87rem; font-weight: 500; color: var(--text); }
  .cg-member-email { font-size: .75rem; color: var(--muted); }
  .cg-remove { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 1.1rem; line-height: 1; padding: 2px 6px; border-radius: 6px; transition: all .12s; }
  .cg-remove:hover { background: var(--red-bg); color: var(--red); }
  .cg-me-badge { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; background: var(--bg); border: 1px solid var(--border); margin-bottom: 4px; }
  .cg-me-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
  .cg-me-text { font-size: .87rem; color: var(--muted); }
  .cg-me-text strong { color: var(--text); font-weight: 500; }
  .cg-count { font-size: .78rem; color: var(--muted); margin-top: 8px; }

  .cg-actions { display: flex; gap: 10px; margin-top: 24px; }
  .cg-btn { flex: 1; padding: 12px; border-radius: 10px; border: none; font-family: inherit; font-size: .9rem; font-weight: 500; cursor: pointer; transition: all .15s; }
  .cg-btn-primary { background: var(--text); color: #fff; }
  .cg-btn-primary:hover:not(:disabled) { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .cg-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  .cg-btn-ghost { background: transparent; color: var(--muted); border: 1.5px solid var(--border); }
  .cg-btn-ghost:hover { background: var(--bg); color: var(--text); }

  .cg-type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cg-type-card { border: 2px solid var(--border); border-radius: 12px; padding: 16px 14px; cursor: pointer; background: var(--bg); transition: border-color .15s, background .15s; display: flex; flex-direction: column; gap: 4px; text-align: left; font-family: inherit; }
  .cg-type-card:hover { border-color: var(--accent); background: var(--accent-bg); }
  .cg-type-card.sel { border-color: var(--accent); background: var(--accent-bg); box-shadow: 0 0 0 3px rgba(62,207,178,.1); }
  .cg-type-emoji { font-size: 1.5rem; margin-bottom: 2px; }
  .cg-type-label { font-size: .9rem; font-weight: 600; color: var(--text); }
  .cg-type-desc  { font-size: .75rem; color: var(--muted); line-height: 1.4; }

  .cg-setting { border: 1.5px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px; transition: border-color .2s; }
  .cg-setting.on { border-color: var(--accent); }
  .cg-setting-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .cg-setting-title { font-size: .9rem; font-weight: 600; color: var(--text); margin-bottom: 3px; }
  .cg-setting-why { font-size: .78rem; color: var(--muted); line-height: 1.45; }
  .cg-toggle { width: 40px; height: 23px; border-radius: 99px; flex-shrink: 0; border: none; cursor: pointer; position: relative; background: var(--border); transition: background .2s; margin-top: 2px; }
  .cg-toggle.on { background: var(--accent); }
  .cg-toggle::after { content: ''; position: absolute; width: 17px; height: 17px; border-radius: 50%; background: #fff; top: 3px; left: 3px; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  .cg-toggle.on::after { transform: translateX(17px); }
  .cg-freq-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
  .cg-freq-pill { padding: 6px 14px; border-radius: 99px; font-size: .8rem; font-weight: 500; border: 1.5px solid var(--border); background: var(--bg); color: var(--muted); cursor: pointer; font-family: inherit; transition: all .15s; }
  .cg-freq-pill.sel { border-color: var(--accent); background: var(--accent-bg); color: var(--accent-dark); }
  .cg-threshold-row { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
  .cg-threshold-lbl { font-size: .82rem; color: var(--muted); white-space: nowrap; }
  .cg-threshold-input { width: 100px; padding: 8px 12px; border-radius: 8px; border: 1.5px solid var(--border); background: var(--bg); font-family: inherit; font-size: .9rem; color: var(--text); outline: none; transition: border-color .15s; }
  .cg-threshold-input:focus { border-color: var(--accent); background: var(--surface); }
  .cg-skip { background: none; border: none; cursor: pointer; color: var(--muted); font-family: inherit; font-size: .8rem; text-decoration: underline; display: block; margin: 14px auto 0; transition: color .12s; }
  .cg-skip:hover { color: var(--text); }

  @media (max-width: 480px) { .cg-card { padding: 20px 16px; } }
`;

function StepBar({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Details", "Type", "Personalize"];
  return (
    <div className="cg-steps">
      {labels.map((lbl, i) => {
        const n = i + 1; const active = n === current; const done = n < current;
        return (
          <div key={lbl} style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
            <div className="cg-step-wrap">
              <div className={`cg-step-dot ${active ? "active" : done ? "done" : ""}`}>{done ? "✓" : n}</div>
              <div className={`cg-step-lbl ${active ? "active" : ""}`}>{lbl}</div>
            </div>
            {i < labels.length - 1 && <div className={`cg-step-line ${done ? "done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button type="button" className={`cg-toggle ${on ? "on" : ""}`} onClick={onToggle} />;
}

export default function CreateGroupPage() {
  const { user } = useAuth();
  if (!user) return null;
  const navigate      = useNavigate();
  const currentUserId = user.userId;

  const [name, setName]                         = useState("");
  const [allUsers, setAllUsers]                 = useState<UserProfileType[]>([]);
  const [selectedUserIds, setSelectedUserIds]   = useState<string[]>([]);
  const [search, setSearch]                     = useState("");
  const searchInputRef                          = useRef<HTMLInputElement>(null);
  const [dropdownRect, setDropdownRect]         = useState<DOMRect | null>(null);
  const [groupType, setGroupType]               = useState<GroupTypeKey | null>(null);
  const [reminderOn, setReminderOn]             = useState(false);
  const [reminderFreq, setReminderFreq]         = useState<ReminderFreq>("MONTHLY");
  const [balanceAlertOn, setBalanceAlertOn]     = useState(false);
  const [balanceThreshold, setBalanceThreshold] = useState("50");
  const [step, setStep]                         = useState<1 | 2 | 3>(1);
  const [loading, setLoading]                   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const users = await listAllUsers();
        setAllUsers(users.filter(u => u && u.id));
      } catch { setAllUsers([]); }
    })();
  }, []);

  const searchResults = search
    ? allUsers.filter(u =>
        u.id !== currentUserId &&
        !selectedUserIds.includes(u.id) &&
        (u as any).email?.toLowerCase().includes(search.toLowerCase()))
    : [];

  useEffect(() => {
    if (searchResults.length > 0 && searchInputRef.current) {
      setDropdownRect(searchInputRef.current.getBoundingClientRect());
    } else { setDropdownRect(null); }
  }, [searchResults.length]);

  const addUser    = (id: string) => { setSelectedUserIds(p => [...p, id]); setSearch(""); };
  const removeUser = (id: string) => setSelectedUserIds(p => p.filter(u => u !== id));

  function pickType(t: GroupTypeKey) {
    setGroupType(t); setReminderOn(false); setBalanceAlertOn(false);
  }

  async function handleCreate(skipPersonalize = false) {
    if (!name.trim() || !groupType) return;
    try {
      setLoading(true);
      const result = await createGroup({
        name: name.trim(),
        memberUserIds: [currentUserId, ...selectedUserIds],
        createdBy: currentUserId,          // ← NEW
        groupType,
        reminderFrequency:     (!skipPersonalize && reminderOn)     ? reminderFreq                      : null,
        balanceAlertThreshold: (!skipPersonalize && balanceAlertOn) ? parseFloat(balanceThreshold) || null : null,
      });
      const newId = (result as any)?.id ?? (result as any)?.data?.id;
      navigate(newId ? `/group/${newId}` : "/");
    } catch { alert("Failed to create group"); }
    finally { setLoading(false); }
  }

  const meUser       = allUsers.find(u => u.id === currentUserId);
  const totalMembers = 1 + selectedUserIds.length;
  const settings     = groupType ? TYPE_SETTINGS[groupType] : null;
  const hasSettings  = !!(settings?.reminder || settings?.balanceAlert);

  // ── Step 1 ───────────────────────────────────────────────────────────
  if (step === 1) return (
    <><style>{css}</style>
    <div className="cg-root">
      <div className="cg-brand">Split<span>Lite</span> <span className="ver">2.0</span></div>
      <StepBar current={1} />
      <div className="cg-card">
        <div className="cg-title">Create a group</div>
        <div className="cg-sub">Give it a name and add who's in it.</div>
        <div className="cg-field">
          <label className="cg-label">Group name</label>
          <input className="cg-input" type="text" placeholder="e.g. Bali Trip, The House" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="cg-field">
          <label className="cg-label">Add members</label>
          <input ref={searchInputRef} className="cg-input" type="text" placeholder="Search by email…" value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" />
          {searchResults.length > 0 && dropdownRect && createPortal(
            <div className="cg-portal-dropdown" style={{ top: dropdownRect.bottom + 4, left: dropdownRect.left, width: dropdownRect.width }}>
              {searchResults.map(u => (
                <div key={u.id} className="cg-result" onMouseDown={() => addUser(u.id)}>
                  <span className="cg-result-name">{u.displayName}</span>
                  <span className="cg-result-email">{(u as any).email}</span>
                </div>
              ))}
            </div>, document.body
          )}
          <div className="cg-members">
            <div className="cg-me-badge">
              <div className="cg-me-dot" />
              <span className="cg-me-text"><strong>{meUser?.displayName ?? "You"}</strong> (you, always included)</span>
            </div>
            {selectedUserIds.map(id => {
              const u = allUsers.find(user => user.id === id);
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
          {totalMembers > 1 && <div className="cg-count">{totalMembers} members total</div>}
        </div>
        <div className="cg-actions">
          <button type="button" className="cg-btn cg-btn-ghost" onClick={() => navigate("/")}>Cancel</button>
          <button type="button" className="cg-btn cg-btn-primary" disabled={!name.trim()} onClick={() => setStep(2)}>Next →</button>
        </div>
      </div>
    </div></>
  );

  // ── Step 2 ───────────────────────────────────────────────────────────
  if (step === 2) return (
    <><style>{css}</style>
    <div className="cg-root">
      <div className="cg-brand">Split<span>Lite</span> <span className="ver">2.0</span></div>
      <StepBar current={2} />
      <div className="cg-card">
        <button className="cg-back" onClick={() => setStep(1)}>← Back</button>
        <div className="cg-title">What's this group for?</div>
        <div className="cg-sub">This helps us show you the right settings.</div>
        <div className="cg-type-grid">
          {GROUP_TYPES.map(t => (
            <button key={t.key} type="button" className={`cg-type-card ${groupType === t.key ? "sel" : ""}`} onClick={() => pickType(t.key)}>
              <div className="cg-type-emoji">{t.emoji}</div>
              <div className="cg-type-label">{t.label}</div>
              <div className="cg-type-desc">{t.desc}</div>
            </button>
          ))}
        </div>
        <div className="cg-actions">
          <button type="button" className="cg-btn cg-btn-ghost" onClick={() => setStep(1)}>← Back</button>
          <button type="button" className="cg-btn cg-btn-primary" disabled={!groupType}
            onClick={() => hasSettings ? setStep(3) : handleCreate(true)}>
            {hasSettings ? "Next →" : "Create group"}
          </button>
        </div>
      </div>
    </div></>
  );

  // ── Step 3 ───────────────────────────────────────────────────────────
  return (
    <><style>{css}</style>
    <div className="cg-root">
      <div className="cg-brand">Split<span>Lite</span> <span className="ver">2.0</span></div>
      <StepBar current={3} />
      <div className="cg-card">
        <button className="cg-back" onClick={() => setStep(2)}>← Back</button>
        <div className="cg-title">Personalize your group</div>
        <div className="cg-sub">All optional — you can change these any time.</div>

        {settings?.reminder && (
          <div className={`cg-setting ${reminderOn ? "on" : ""}`}>
            <div className="cg-setting-top">
              <div>
                <div className="cg-setting-title">🔔 Settle-up reminders</div>
                <div className="cg-setting-why">Life gets busy — a nudge helps everyone stay on the same page.</div>
              </div>
              <Toggle on={reminderOn} onToggle={() => setReminderOn(v => !v)} />
            </div>
            {reminderOn && (
              <div className="cg-freq-row">
                {(["WEEKLY", "BIWEEKLY", "MONTHLY"] as ReminderFreq[]).map(f => (
                  <button key={f} type="button" className={`cg-freq-pill ${reminderFreq === f ? "sel" : ""}`} onClick={() => setReminderFreq(f)}>
                    {f === "WEEKLY" ? "Weekly" : f === "BIWEEKLY" ? "Bi-weekly" : "Monthly"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {settings?.balanceAlert && (
          <div className={`cg-setting ${balanceAlertOn ? "on" : ""}`}>
            <div className="cg-setting-top">
              <div>
                <div className="cg-setting-title">⚖️ Balance alert</div>
                <div className="cg-setting-why">So small debts don't quietly become awkward conversations.</div>
              </div>
              <Toggle on={balanceAlertOn} onToggle={() => setBalanceAlertOn(v => !v)} />
            </div>
            {balanceAlertOn && (
              <div className="cg-threshold-row">
                <span className="cg-threshold-lbl">Alert when balance exceeds</span>
                <input className="cg-threshold-input" type="number" min="1" placeholder="50" value={balanceThreshold} onChange={e => setBalanceThreshold(e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="cg-actions">
          <button type="button" className="cg-btn cg-btn-ghost" onClick={() => setStep(2)}>← Back</button>
          <button type="button" className="cg-btn cg-btn-primary" disabled={loading} onClick={() => handleCreate(false)}>
            {loading ? "Creating…" : "Create group"}
          </button>
        </div>
        <button className="cg-skip" onClick={() => handleCreate(true)}>Skip for now</button>
      </div>
    </div></>
  );
}