import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  signIn, signUp, confirmSignUp, resetPassword,
  confirmResetPassword, deleteUser,
} from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { useAuth } from "../context/AuthContext";
import {
  listMyExpenses, listMyGroups, listParticipantsForExpense,
} from "../api/expenses";

const client = generateClient<Schema>();
type Step = "signIn" | "signUp" | "confirm" | "reset" | "resetConfirm";

function friendlyError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("incorrect") || m.includes("not authorized")) return "Incorrect email or password.";
  if (m.includes("password")) return "Password doesn't meet the requirements.";
  if (m.includes("exists")) return "An account with this email already exists.";
  if (m.includes("code")) return "Invalid confirmation code.";
  return msg;
}

// ── Password helpers ──────────────────────────────────────────────────────────
type PwReqs = {
  minLength:  boolean;
  hasUpper:   boolean;
  hasLower:   boolean;
  hasNumber:  boolean;
  hasSpecial: boolean;
};

function checkPwReqs(pw: string): PwReqs {
  return {
    minLength:  pw.length >= 8,
    hasUpper:   /[A-Z]/.test(pw),
    hasLower:   /[a-z]/.test(pw),
    hasNumber:  /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
}

function allReqsMet(pw: string) {
  const r = checkPwReqs(pw);
  return r.minLength && r.hasUpper && r.hasLower && r.hasNumber && r.hasSpecial;
}

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  const r = checkPwReqs(pw);
  const score = [r.minLength, r.hasUpper, r.hasLower, r.hasNumber, r.hasSpecial].filter(Boolean).length;
  const levels = [
    { label: "Too weak",  color: "#ff6b6b" },
    { label: "Weak",      color: "#ff9f43" },
    { label: "Fair",      color: "#ffd43b" },
    { label: "Good",      color: "#74c69d" },
    { label: "Strong 💪", color: "#3ecfb2" },
  ];
  return { score, ...levels[score - 1] };
}

function getGreeting(name: string) {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h < 12) return `Good morning, ${first} ☀️`;
  if (h < 17) return `Hey, ${first} 👋`;
  return `Evening, ${first} 🌙`;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f8fa; --surface: #ffffff; --border: #ebebed;
    --text: #1a1a2e; --muted: #8b8fa8; --accent: #3ecfb2;
    --accent-bg: #edfaf7; --accent-dark: #2ab99e;
    --red: #ff6b6b; --red-bg: #fff0f0;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --shadow-lg: 0 8px 32px rgba(0,0,0,.1);
    --radius: 16px;
  }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }

  /* ── shared auth ── */
  .auth-root { min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; }
  .auth-brand { font-size: 1.3rem; font-weight: 600; letter-spacing: -.3px; margin-bottom: 32px; }
  .auth-brand .a { color: var(--accent); }
  .auth-brand .v { color: var(--muted); font-weight: 400; }
  .auth-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 28px; width: 100%; max-width: 380px; }
  .auth-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 6px; letter-spacing: -.3px; }
  .auth-sub { font-size: .85rem; color: var(--muted); margin-bottom: 24px; }
  .auth-error { background: var(--red-bg); color: var(--red); border-radius: 8px; padding: 10px 14px; font-size: .82rem; margin-bottom: 16px; }
  .auth-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
  .auth-label { font-size: .8rem; font-weight: 500; color: var(--muted); }
  .auth-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--bg); font-family: inherit; font-size: .9rem; color: var(--text); outline: none; transition: border-color .15s; }
  .auth-input:focus { border-color: var(--accent); background: var(--surface); }
  .auth-input::placeholder { color: var(--muted); }
  .auth-btn { width: 100%; padding: 12px; border-radius: 10px; border: none; background: var(--text); color: #fff; font-family: inherit; font-size: .9rem; font-weight: 500; cursor: pointer; margin-top: 8px; transition: all .15s; }
  .auth-btn:hover:not(:disabled) { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .auth-btn:disabled { opacity: .5; cursor: not-allowed; }
  .auth-btn-ghost { width: 100%; padding: 11px; border-radius: 10px; border: 1.5px solid var(--border); background: transparent; font-family: inherit; font-size: .9rem; font-weight: 500; color: var(--text); cursor: pointer; margin-top: 8px; transition: all .15s; }
  .auth-btn-ghost:hover { background: var(--bg); }
  .auth-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
  .auth-divider-line { flex: 1; height: 1px; background: var(--border); }
  .auth-divider-text { font-size: .75rem; color: var(--muted); }
  .auth-link-row { text-align: center; margin-top: 16px; font-size: .83rem; color: var(--muted); }
  .auth-link-row button { background: none; border: none; cursor: pointer; color: var(--accent); font-family: inherit; font-size: inherit; font-weight: 500; padding: 0; }
  .auth-text-btn-sm { background: none; border: none; cursor: pointer; color: var(--muted); font-family: inherit; font-size: .8rem; padding: 0; text-decoration: underline; display: block; margin: 12px auto 0; }

  /* ── password strength + checklist ── */
  .pw-wrapper { position: relative; }
  .pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--muted); font-size: .8rem; font-family: inherit; padding: 4px; line-height: 1; transition: color .12s; }
  .pw-toggle:hover { color: var(--text); }
  .pw-strength { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
  .pw-bars { display: flex; gap: 4px; }
  .pw-bar { flex: 1; height: 3px; border-radius: 99px; background: var(--border); transition: background .3s ease; }
  .pw-label { font-size: .74rem; font-weight: 600; display: block; margin-top: 4px; transition: color .25s; }
  .pw-checklist {
    background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
    padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;
  }
  .pw-req { display: flex; align-items: center; gap: 8px; font-size: .78rem; color: var(--muted); transition: color .2s; }
  .pw-req.met { color: var(--text); }
  .pw-req-chip {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    border: 1.5px solid var(--border); background: var(--surface);
    display: flex; align-items: center; justify-content: center;
    font-size: .62rem; font-weight: 800; color: transparent;
    transition: background .2s, border-color .2s, color .15s, transform .2s;
  }
  .pw-req.met .pw-req-chip {
    background: var(--accent); border-color: var(--accent); color: #fff;
    transform: scale(1.1);
  }

  /* ═════════════════════ WELCOME SCREEN ═════════════════════ */
  .wp-root { min-height: 100vh; background: var(--bg); display: flex; flex-direction: column; align-items: center; padding: 0 16px 48px; }
  .wp-hero { width: 100%; max-width: 520px; background: var(--text); border-radius: 0 0 32px 32px; padding: 40px 28px 48px; margin-bottom: -32px; position: relative; overflow: hidden; }
  .wp-hero::before { content: ''; position: absolute; width: 260px; height: 260px; border-radius: 50%; border: 50px solid rgba(62,207,178,.1); top: -80px; right: -80px; pointer-events: none; }
  .wp-hero::after { content: ''; position: absolute; width: 160px; height: 160px; border-radius: 50%; border: 35px solid rgba(62,207,178,.07); bottom: -50px; left: 10px; pointer-events: none; }
  .wp-hero-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
  .wp-brand { font-size: .9rem; font-weight: 600; color: rgba(255,255,255,.4); letter-spacing: .03em; }
  .wp-brand span { color: var(--accent); }
  .wp-avatar { width: 50px; height: 50px; border-radius: 50%; background: var(--accent); color: #1a1a2e; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; box-shadow: 0 0 0 3px rgba(62,207,178,.25); animation: popIn .45s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes popIn { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .wp-greeting { font-size: 1.6rem; font-weight: 600; color: #fff; letter-spacing: -.5px; line-height: 1.2; animation: slideUp .4s .1s ease both; }
  .wp-email { font-size: .8rem; color: rgba(255,255,255,.4); margin-top: 6px; font-family: 'DM Mono', monospace; animation: slideUp .4s .15s ease both; }
  @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .wp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); padding: 28px; width: 100%; max-width: 520px; position: relative; z-index: 1; animation: slideUp .4s .2s ease both; }
  .wp-cta { display: flex; align-items: center; justify-content: space-between; padding: 20px 22px; background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%); border-radius: 14px; text-decoration: none; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(62,207,178,.3); transition: transform .15s, box-shadow .15s; }
  .wp-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(62,207,178,.4); }
  .wp-cta-label { font-size: .72rem; font-weight: 600; color: rgba(255,255,255,.75); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 3px; }
  .wp-cta-text { font-size: 1.05rem; font-weight: 600; color: #fff; }
  .wp-cta-emoji { font-size: 1.6rem; }
  .wp-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
  .wp-stat { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 12px; display: flex; flex-direction: column; gap: 3px; animation: slideUp .4s ease both; }
  .wp-stat:nth-child(1) { animation-delay: .25s; }
  .wp-stat:nth-child(2) { animation-delay: .3s; }
  .wp-stat:nth-child(3) { animation-delay: .35s; }
  .wp-stat-value { font-size: 1.3rem; font-weight: 600; letter-spacing: -.5px; font-family: 'DM Mono', monospace; }
  .wp-stat-value.green { color: var(--accent); }
  .wp-stat-value.red { color: var(--red); }
  .wp-stat-value.neutral { color: var(--text); }
  .wp-stat-label { font-size: .72rem; color: var(--muted); font-weight: 500; }
  .wp-rule { height: 1px; background: var(--border); margin: 4px 0 16px; }
  .wp-secondary { display: flex; flex-direction: column; gap: 8px; }
  .wp-action-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border); cursor: pointer; background: transparent; width: 100%; font-family: inherit; text-decoration: none; transition: background .12s; }
  .wp-action-row:hover { background: var(--bg); }
  .wp-action-left { display: flex; align-items: center; gap: 10px; }
  .wp-action-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: .95rem; }
  .wp-action-icon.gray { background: var(--bg); border: 1px solid var(--border); }
  .wp-action-icon.red { background: var(--red-bg); }
  .wp-action-name { font-size: .88rem; font-weight: 500; color: var(--text); }
  .wp-action-sub { font-size: .74rem; color: var(--muted); }
  .wp-action-chevron { color: var(--muted); font-size: 1rem; }
  .wp-danger-confirm { background: var(--red-bg); border: 1px solid #ffd0d0; border-radius: 12px; padding: 16px; margin-top: 4px; }
  .wp-danger-msg { font-size: .88rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }
  .wp-danger-sub { font-size: .78rem; color: var(--muted); margin-bottom: 14px; line-height: 1.5; }
  .wp-danger-btns { display: flex; gap: 8px; }
  .wp-danger-cancel { flex: 1; padding: 9px; border-radius: 8px; border: 1.5px solid var(--border); background: var(--surface); font-family: inherit; font-size: .83rem; font-weight: 500; cursor: pointer; color: var(--text); }
  .wp-danger-go { flex: 1; padding: 9px; border-radius: 8px; border: none; background: var(--red); color: #fff; font-family: inherit; font-size: .83rem; font-weight: 500; cursor: pointer; }
  .wp-danger-go:disabled { opacity: .6; }
  .wp-stats-loading { display: flex; gap: 10px; margin-bottom: 20px; }
  .wp-shimmer { flex: 1; height: 70px; border-radius: 12px; background: linear-gradient(90deg, var(--border) 25%, #f0f0f3 50%, var(--border) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  @media (max-width: 480px) {
    .wp-hero { padding: 28px 18px 40px; }
    .wp-card { padding: 20px 16px; }
    .wp-greeting { font-size: 1.35rem; }
    .wp-stat-value { font-size: 1.1rem; }
    .wp-cta { padding: 16px 18px; }
    .pw-checklist { grid-template-columns: 1fr; }
  }
`;

// ── Password checklist config ─────────────────────────────────────────────────
const PW_CHECKLIST: { key: keyof PwReqs; label: string }[] = [
  { key: "minLength",  label: "8+ characters"    },
  { key: "hasUpper",   label: "Uppercase (A–Z)"  },
  { key: "hasLower",   label: "Lowercase (a–z)"  },
  { key: "hasNumber",  label: "Number (0–9)"     },
  { key: "hasSpecial", label: "Special (!@#…)"   },
];

// ── PasswordField ─────────────────────────────────────────────────────────────
function PasswordField({
  value, onChange, placeholder = "Password", showStrength = false,
}: { value: string; onChange: (v: string) => void; placeholder?: string; showStrength?: boolean }) {
  const [visible, setVisible] = useState(false);
  const hasInput = value.length > 0;
  const strength = hasInput ? getPasswordStrength(value) : null;
  const reqs     = checkPwReqs(value); // always computed so checklist shows from the start

  return (
    <div>
      <div className="pw-wrapper">
        <input
          className="auth-input"
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ paddingRight: 44 }}
          required
        />
        <button type="button" className="pw-toggle" onClick={() => setVisible(v => !v)}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>

      {showStrength && (
        <div className="pw-strength">
          {/* progress bars + label — appear once user starts typing */}
          {hasInput && strength && (
            <div>
              <div className="pw-bars">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="pw-bar"
                    style={{ background: i < strength.score ? strength.color : undefined }} />
                ))}
              </div>
              <span className="pw-label" style={{ color: strength.color }}>{strength.label}</span>
            </div>
          )}

          {/* requirement checklist — always visible so users know upfront */}
          <div className="pw-checklist">
            {PW_CHECKLIST.map(r => {
              const met = reqs[r.key];
              return (
                <div key={r.key} className={`pw-req ${met ? "met" : ""}`}>
                  <div className="pw-req-chip">{met ? "✓" : ""}</div>
                  {r.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Welcome screen ────────────────────────────────────────────────────────────
function WelcomeScreen({ user, signOut }: { user: any; signOut: () => void }) {
  const [stats, setStats] = useState<{ expenses: number; groups: number; netBalance: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initials = user.displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    (async () => {
      try {
        const [expenses, groups] = await Promise.all([
          listMyExpenses(user.userId),
          listMyGroups(user.userId),
        ]);
        let net = 0;
        for (const exp of expenses.filter((e: any) => e?.id)) {
          const parts = await listParticipantsForExpense(exp.id);
          const totalWeight = parts.reduce((s: number, p: any) => s + (p.shareCount ?? 1), 0);
          if (exp.paidBy === user.userId) net += exp.amount;
          const myPart = parts.find((p: any) => p.userId === user.userId);
          if (myPart) net -= totalWeight > 0 ? ((myPart.shareCount ?? 1) / totalWeight) * exp.amount : 0;
        }
        setStats({ expenses: expenses.length, groups: groups.length, netBalance: net });
      } catch {
        setStats({ expenses: 0, groups: 0, netBalance: 0 });
      }
    })();
  }, [user.userId]);

  const bal = stats?.netBalance ?? 0;

  return (
    <>
      <style>{css}</style>
      <div className="wp-root">
        <div className="wp-hero">
          <div className="wp-hero-top">
            <div className="wp-brand">Split<span>Lite</span> 2.0</div>
            <div className="wp-avatar">{initials}</div>
          </div>
          <div className="wp-greeting">{getGreeting(user.displayName)}</div>
          <div className="wp-email">{user.email}</div>
        </div>

        <div className="wp-card">
          <Link to="/" className="wp-cta">
            <div>
              <div className="wp-cta-label">Ready to split?</div>
              <div className="wp-cta-text">Go to your expenses →</div>
            </div>
            <span className="wp-cta-emoji">💸</span>
          </Link>

          {!stats ? (
            <div className="wp-stats-loading">
              <div className="wp-shimmer" /><div className="wp-shimmer" /><div className="wp-shimmer" />
            </div>
          ) : (
            <div className="wp-stats">
              <div className="wp-stat">
                <div className="wp-stat-value neutral">{stats.expenses}</div>
                <div className="wp-stat-label">Expenses</div>
              </div>
              <div className="wp-stat">
                <div className="wp-stat-value neutral">{stats.groups}</div>
                <div className="wp-stat-label">Groups</div>
              </div>
              <div className="wp-stat">
                <div className={`wp-stat-value ${bal > 0.01 ? "green" : bal < -0.01 ? "red" : "neutral"}`}>
                  {bal >= 0 ? "+" : "-"}${Math.abs(bal).toFixed(0)}
                </div>
                <div className="wp-stat-label">{bal > 0.01 ? "Owed to you" : bal < -0.01 ? "You owe" : "All settled"}</div>
              </div>
            </div>
          )}

          <div className="wp-rule" />

          <div className="wp-secondary">
            <button className="wp-action-row" onClick={async () => {
    await signOut();
    window.history.replaceState({}, "", "/auth");
  }}>
              <div className="wp-action-left">
                <div className="wp-action-icon gray">🚪</div>
                <div>
                  <div className="wp-action-name">Sign out</div>
                  <div className="wp-action-sub">Come back anytime</div>
                </div>
              </div>
              <span className="wp-action-chevron">›</span>
            </button>

            {!showDeleteConfirm ? (
              <button className="wp-action-row" onClick={() => setShowDeleteConfirm(true)}>
                <div className="wp-action-left">
                  <div className="wp-action-icon red">⚠️</div>
                  <div>
                    <div className="wp-action-name" style={{ color: "var(--red)" }}>Delete account</div>
                    <div className="wp-action-sub">Permanently remove all your data</div>
                  </div>
                </div>
                <span className="wp-action-chevron">›</span>
              </button>
            ) : (
              <div className="wp-danger-confirm">
                <div className="wp-danger-msg">Delete your account?</div>
                <div className="wp-danger-sub">This will permanently remove your account and all expense data. There's no going back.</div>
                <div className="wp-danger-btns">
                  <button className="wp-danger-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                  <button className="wp-danger-go" disabled={deleting} onClick={async () => {
                    setDeleting(true);
                    try { await deleteUser(); await signOut(); }
                    catch { setDeleting(false); setShowDeleteConfirm(false); }
                  }}>{deleting ? "Deleting…" : "Yes, delete"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════
//   MAIN EXPORT
// ══════════════════════════════
export default function AuthPage() {
  const { user, loading, refreshProfile, signOut, completeOnboarding } = useAuth();
  const [step, setStep]         = useState<Step>("signIn");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode]         = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  if (loading) return null;

  const Brand    = () => <div className="auth-brand">Split<span className="a">Lite</span> <span className="v">2.0</span></div>;
  const ErrorBox = () => error ? <div className="auth-error">{error}</div> : null;

  // ── authenticated: go to dashboard, unless ?account=1 is set ──
  const showAccount = new URLSearchParams(window.location.search).get("account") === "1";
  if (user && user.displayName && !showAccount) return <Navigate to="/" replace />;
  if (user && user.displayName && showAccount) return <WelcomeScreen user={user} signOut={signOut} />;

  // ── onboarding: set display name ──
  if (user && !user.displayName) return (
    <><style>{css}</style>
    <div className="auth-root"><Brand />
      <div className="auth-card">
        <div className="auth-title">What should we call you?</div>
        <div className="auth-sub">This is how you'll appear to friends.</div>
        <ErrorBox />
        <form onSubmit={async (e) => {
          e.preventDefault(); if (!displayName.trim()) return;
          setBusy(true); setError(null);
          try {
            await client.models.UserProfile.create({ id: user.userId, displayName: displayName.trim(), email: user.email });
            completeOnboarding(displayName.trim());
          } catch (err: any) { setError(friendlyError(err.message)); } finally { setBusy(false); }
        }}>
          <div className="auth-field">
            <label className="auth-label">Display name</label>
            <input className="auth-input" placeholder="e.g. Mohit" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
          </div>
          <button className="auth-btn" disabled={busy}>{busy ? "Saving…" : "Continue →"}</button>
        </form>
      </div>
    </div></>
  );

  // ── confirm sign-up ──
  if (step === "confirm") return (
    <><style>{css}</style>
    <div className="auth-root"><Brand />
      <div className="auth-card">
        <div className="auth-title">Check your email</div>
        <div className="auth-sub">We sent a code to <strong>{email}</strong></div>
        <ErrorBox />
        <form onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { await confirmSignUp({ username: email, confirmationCode: code }); await signIn({ username: email, password }); await refreshProfile(); }
          catch (err: any) { setError(friendlyError(err.message)); } finally { setBusy(false); }
        }}>
          <div className="auth-field">
            <label className="auth-label">Confirmation code</label>
            <input className="auth-input" placeholder="6-digit code" value={code} onChange={e => setCode(e.target.value)} required />
          </div>
          <button className="auth-btn" disabled={busy}>{busy ? "Verifying…" : "Confirm"}</button>
        </form>
        <button className="auth-text-btn-sm" onClick={() => setStep("signIn")}>← Back to sign in</button>
      </div>
    </div></>
  );

  // ── reset password ──
  if (step === "resetConfirm") return (
    <><style>{css}</style>
    <div className="auth-root"><Brand />
      <div className="auth-card">
        <div className="auth-title">Set new password</div>
        <div className="auth-sub">Enter the code sent to <strong>{email}</strong></div>
        <ErrorBox />
        <form onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { await confirmResetPassword({ username: email, confirmationCode: code, newPassword: password }); setStep("signIn"); }
          catch (err: any) { setError(friendlyError(err.message)); } finally { setBusy(false); }
        }}>
          <div className="auth-field"><label className="auth-label">Code</label>
            <input className="auth-input" placeholder="6-digit code" value={code} onChange={e => setCode(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label className="auth-label">New password</label>
            <PasswordField value={password} onChange={setPassword} showStrength />
          </div>
          <button className="auth-btn" disabled={busy || !allReqsMet(password)}>{busy ? "Saving…" : "Save password"}</button>
        </form>
      </div>
    </div></>
  );

  // ── sign up ──
  if (step === "signUp") return (
    <><style>{css}</style>
    <div className="auth-root"><Brand />
      <div className="auth-card">
        <div className="auth-title">Create account</div>
        <div className="auth-sub">Join SplitLite — it's free.</div>
        <ErrorBox />
        <form onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { await signUp({ username: email, password, options: { userAttributes: { email } } }); setStep("confirm"); }
          catch (err: any) { setError(friendlyError(err.message)); } finally { setBusy(false); }
        }}>
          <div className="auth-field"><label className="auth-label">Email</label>
            <input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <PasswordField value={password} onChange={setPassword} showStrength />
          </div>
          <button className="auth-btn" disabled={busy || !allReqsMet(password)}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <div className="auth-link-row">Already have an account? <button onClick={() => setStep("signIn")}>Sign in</button></div>
      </div>
    </div></>
  );

  // ── sign in (default) ──
  return (
    <><style>{css}</style>
    <div className="auth-root"><Brand />
      <div className="auth-card">
        <div className="auth-title">Welcome back</div>
        <div className="auth-sub">Sign in to SplitLite</div>
        <ErrorBox />
        <form onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { await signIn({ username: email, password }); await refreshProfile(); }
          catch (err: any) { setError(friendlyError(err.message)); } finally { setBusy(false); }
        }}>
          <div className="auth-field"><label className="auth-label">Email</label>
            <input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <PasswordField value={password} onChange={setPassword} placeholder="••••••••" />
          </div>
          <button className="auth-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <button className="auth-text-btn-sm" onClick={async () => {
          if (!email) { setError("Enter your email first."); return; }
          setBusy(true); setError(null);
          try { await resetPassword({ username: email }); setStep("resetConfirm"); }
          catch (err: any) { setError(friendlyError(err.message)); } finally { setBusy(false); }
        }}>Forgot password?</button>
        <div className="auth-divider"><div className="auth-divider-line" /><span className="auth-divider-text">or</span><div className="auth-divider-line" /></div>
        <button className="auth-btn-ghost" onClick={() => setStep("signUp")}>Create account</button>
      </div>
    </div></>
  );
}