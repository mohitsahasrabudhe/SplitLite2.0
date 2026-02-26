// Shared design tokens for SplitLite 2.0
// Import this in each page: import { BASE_CSS, GROUP_COLORS, initials, groupColor, relativeTime } from "./sharedStyles"

export const GROUP_COLORS = [
  { bg: "#edfaf7", fg: "#2ab99e" },
  { bg: "#fce7f3", fg: "#db2777" },
  { bg: "#ede9fe", fg: "#7c3aed" },
  { bg: "#fef3c7", fg: "#d97706" },
  { bg: "#dbeafe", fg: "#2563eb" },
  { bg: "#fce7f3", fg: "#be185d" },
];

export function groupColor(idx: number) {
  return GROUP_COLORS[idx % GROUP_COLORS.length];
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function relativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}

export const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f7f8fa; --surface: #ffffff; --border: #ebebed;
    --text: #1a1a2e; --muted: #8b8fa8; --accent: #3ecfb2;
    --accent-bg: #edfaf7; --accent-dark: #2ab99e;
    --red: #ff6b6b; --red-bg: #fff0f0;
    --blue: #4a90d9; --blue-bg: #e8f4fd;
    --shadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04);
    --shadow-md: 0 4px 20px rgba(0,0,0,.08);
    --radius: 14px;
  }
  body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }

  /* ── topbar ── */
  .sl-root { min-height: 100vh; background: var(--bg); }
  .sl-topbar {
    position: sticky; top: 0; z-index: 40;
    background: rgba(247,248,250,.92); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 0 20px; height: 56px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .sl-brand { font-size: 1rem; font-weight: 600; letter-spacing: -.3px; white-space: nowrap; flex-shrink: 0; text-decoration: none; color: var(--text); }
  .sl-brand .a { color: var(--accent); }
  .sl-brand .v { color: var(--muted); font-weight: 400; font-size: .85rem; }
  .sl-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

  /* ── buttons ── */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    padding: 8px 14px; border-radius: 10px; border: none;
    font-family: inherit; font-size: .83rem; font-weight: 500;
    cursor: pointer; text-decoration: none; transition: all .15s ease; white-space: nowrap;
  }
  .btn-primary { background: var(--text); color: #fff; }
  .btn-primary:hover { background: #2d2d45; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--surface); color: var(--text); }
  .btn-accent { background: var(--accent); color: #fff; }
  .btn-accent:hover { background: var(--accent-dark); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(62,207,178,.3); }
  .btn-label { display: inline; }
  .btn-icon-only { display: none; }

  /* ── two-panel layout ── */
  .sl-body { display: flex; max-width: 1100px; margin: 0 auto; padding: 20px 16px; gap: 18px; height: calc(100vh - 56px); overflow: hidden; }
  .sl-sidebar {
    width: 220px; flex-shrink: 0;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .sl-sidebar-scroll { flex: 1; overflow-y: auto; padding: 10px 8px; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
  .sl-panel { flex: 1; min-width: 0; overflow-y: auto; }

  /* ── section label ── */
  .sl-section-label {
    font-size: .67rem; font-weight: 600; letter-spacing: .09em;
    text-transform: uppercase; color: var(--muted); padding: 10px 10px 4px;
  }
  .sl-divider { height: 1px; background: var(--border); margin: 4px 8px; }

  /* ── nav items ── */
  .sl-nav-item {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 10px; border-radius: 9px; cursor: pointer;
    transition: all .12s ease; overflow: hidden;
  }
  .sl-nav-item:hover { background: var(--bg); }
  .sl-nav-item.active { background: var(--accent-bg); }
  .sl-nav-text { flex: 1; overflow: hidden; }
  .sl-nav-name { font-size: .85rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl-nav-item.active .sl-nav-name { color: var(--accent); }
  .sl-nav-bal { font-size: .75rem; font-family: 'DM Mono', monospace; font-weight: 500; white-space: nowrap; }
  .sl-nav-bal.pos { color: var(--accent); }
  .sl-nav-bal.neg { color: var(--red); }
  .sl-nav-bal.zero { color: var(--muted); }

  /* ── nav icon ── */
  .sl-nav-icon {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: .78rem; font-weight: 700;
  }
  .sl-nav-icon.person { background: var(--blue-bg); color: var(--blue); font-size: .95rem; }
  .sl-nav-icon.group  { background: var(--accent-bg); color: var(--accent); }

  /* ── panel content ── */
  .sl-panel-inner { padding: 20px; display: flex; flex-direction: column; gap: 18px; }
  .sl-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60%; gap: 12px; color: var(--muted); }
  .sl-empty-state .icon { font-size: 2.5rem; }
  .sl-empty-state p { font-size: .88rem; text-align: center; max-width: 220px; line-height: 1.5; }

  /* ── profile header ── */
  .sl-profile-header { display: flex; align-items: center; gap: 14px; }
  .sl-profile-avatar {
    width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; font-weight: 700;
  }
  .sl-profile-name { font-size: 1.2rem; font-weight: 600; letter-spacing: -.3px; }
  .sl-profile-sub { font-size: .8rem; color: var(--muted); margin-top: 2px; }

  /* ── net balance hero ── */
  .sl-net-hero {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 18px 20px;
    box-shadow: var(--shadow); display: flex; align-items: center; justify-content: space-between;
  }
  .sl-net-label { font-size: .72rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; }
  .sl-net-amount { font-size: 1.8rem; font-weight: 600; font-family: 'DM Mono', monospace; letter-spacing: -.5px; }
  .sl-net-amount.pos { color: var(--accent); }
  .sl-net-amount.neg { color: var(--red); }
  .sl-net-amount.zero { color: var(--muted); }
  .sl-net-who { font-size: .82rem; color: var(--muted); margin-top: 3px; }

  /* ── section card ── */
  .sl-section-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden;
  }
  .sl-section-card-header {
    padding: 14px 16px 10px; display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }
  .sl-section-card-title { font-size: .75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; }
  .sl-section-card-body { padding: 10px 16px 14px; display: flex; flex-direction: column; gap: 6px; }

  /* ── breakdown rows ── */
  .sl-breakdown-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 10px; border-radius: 8px; font-size: .83rem;
  }
  .sl-breakdown-row.owes { background: var(--red-bg); }
  .sl-breakdown-row.owed { background: var(--accent-bg); }
  .sl-breakdown-row.neutral { background: var(--bg); }
  .sl-br-left { display: flex; align-items: center; gap: 8px; }
  .sl-br-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .sl-br-dot.owes { background: var(--red); }
  .sl-br-dot.owed { background: var(--accent); }
  .sl-br-dot.neutral { background: var(--muted); }
  .sl-br-text { color: var(--muted); }
  .sl-br-amount { font-family: 'DM Mono', monospace; font-weight: 500; font-size: .82rem; flex-shrink: 0; }
  .sl-br-amount.owes { color: var(--red); }
  .sl-br-amount.owed { color: var(--accent); }

  /* ── activity rows ── */
  .sl-activity-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 10px; border-radius: 8px; font-size: .83rem; gap: 12px;
  }
  .sl-activity-row:hover { background: var(--bg); }
  .sl-act-title { font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl-act-meta { font-size: .74rem; color: var(--muted); margin-top: 1px; }
  .sl-act-amount { font-family: 'DM Mono', monospace; font-size: .82rem; color: var(--muted); flex-shrink: 0; }

  /* ── settlement rows ── */
  .sl-settlement {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-radius: 8px; margin-bottom: 4px; font-size: .82rem;
  }
  .sl-settlement.owes { background: var(--red-bg); }
  .sl-settlement.owed { background: var(--accent-bg); }
  .sl-s-text { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
  .sl-s-amount { font-family: 'DM Mono', monospace; font-weight: 500; font-size: .84rem; flex-shrink: 0; }
  .sl-settlement.owes .sl-s-amount { color: var(--red); }
  .sl-settlement.owed .sl-s-amount { color: var(--accent); }

  /* ── expense cards ── */
  .sl-exp-list { display: flex; flex-direction: column; gap: 10px; }
  .sl-exp-item {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow);
  }
  .sl-paid-by { font-size: .75rem; color: var(--muted); margin-bottom: 6px; }

  /* ── see details button ── */
  .sl-see-details {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-radius: 10px;
    background: var(--bg); border: 1.5px solid var(--border);
    cursor: pointer; text-decoration: none; transition: all .15s;
    font-size: .88rem; font-weight: 500; color: var(--text);
  }
  .sl-see-details:hover { background: var(--surface); border-color: var(--accent); color: var(--accent); box-shadow: var(--shadow); }
  .sl-see-details-arrow { font-size: 1rem; transition: transform .15s; }
  .sl-see-details:hover .sl-see-details-arrow { transform: translateX(3px); }

  /* ── back button ── */
  .sl-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: .83rem; color: var(--muted); cursor: pointer;
    text-decoration: none; transition: color .12s; background: none; border: none; font-family: inherit;
  }
  .sl-back:hover { color: var(--text); }

  /* ── participant set pills in drill sidebar ── */
  .sl-set-pill {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 10px; border-radius: 9px; cursor: pointer;
    transition: all .12s; overflow: hidden;
  }
  .sl-set-pill:hover { background: var(--bg); }
  .sl-set-pill.active { background: var(--accent-bg); }
  .sl-set-pill-icon {
    width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: .7rem; font-weight: 700; background: var(--bg); color: var(--muted);
  }
  .sl-set-pill.active .sl-set-pill-icon { background: rgba(62,207,178,.15); color: var(--accent); }
  .sl-set-text { flex: 1; overflow: hidden; }
  .sl-set-name { font-size: .82rem; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sl-set-pill.active .sl-set-name { color: var(--accent); }
  .sl-set-count { font-size: .72rem; color: var(--muted); }

  /* ── loading / error ── */
  .sl-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
  .sl-spinner { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .sl-error { background: var(--red-bg); color: var(--red); padding: 12px 16px; border-radius: 10px; font-size: .85rem; margin: 20px; }
  .sl-shimmer { height: 14px; border-radius: 6px; background: linear-gradient(90deg, var(--border) 25%, #f0f0f3 50%, var(--border) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; margin-bottom: 8px; }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* ── mobile ── */
  @media (max-width: 640px) {
    .sl-topbar { padding: 0 12px; height: 52px; }
    .btn-ghost .btn-label { display: none; }
    .btn-ghost .btn-icon-only { display: inline; }
    .btn-ghost { padding: 8px 10px; }
    .sl-body { flex-direction: column; height: auto; overflow: visible; padding: 10px 12px; gap: 10px; }
    .sl-sidebar { width: 100%; height: auto; flex-direction: row; border-radius: 12px; }
    .sl-sidebar-scroll { display: flex; flex-wrap: nowrap; overflow-x: auto; padding: 8px; gap: 6px; scrollbar-width: none; }
    .sl-sidebar-scroll::-webkit-scrollbar { display: none; }
    .sl-section-label { display: none; }
    .sl-divider { display: none; }
    .sl-nav-item { flex: 0 0 auto; border-radius: 20px; border: 1px solid var(--border); padding: 7px 12px; }
    .sl-nav-item.active { border-color: transparent; }
    .sl-nav-icon { width: 20px; height: 20px; border-radius: 5px; font-size: .65rem; }
    .sl-nav-bal { display: none; }
    .sl-panel-inner { padding: 12px; gap: 12px; }
    .sl-net-amount { font-size: 1.4rem; }
  }
`;
