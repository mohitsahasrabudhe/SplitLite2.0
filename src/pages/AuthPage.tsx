/**
 * Auth page: sign in, sign up, and set display name (UserProfile) when missing.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { signIn, signUp, confirmSignUp } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { useAuth } from "../context/AuthContext";
import styles from "./AuthPage.module.css";

const client = generateClient<Schema>();

type Mode = "signIn" | "signUp" | "confirm" | "profile";

export default function AuthPage() {
  const { user, loading, error, refreshProfile, signOut: authSignOut } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setBusy(true);
    try {
      await signIn({ username: email, password });
      await refreshProfile();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setBusy(true);
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setMode("confirm");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setBusy(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      await signIn({ username: email, password });
      setMode("profile");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLocalError(null);
    setBusy(true);
    try {
      await client.models.UserProfile.create({ displayName: displayName.trim() });
      await refreshProfile();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to save display name");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Loading…</p>
      </div>
    );
  }

  if (user && user.displayName !== "Unknown") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Account</h1>
        <p>Signed in as {user.displayName}</p>
        <button type="button" className={styles.button} onClick={() => authSignOut()} style={{ marginTop: "1rem" }}>
          Sign out
        </button>
        <div className={styles.toggle} style={{ marginTop: "1rem" }}>
          <Link to="/">Back to expenses</Link>
        </div>
      </div>
    );
  }

  const err = localError ?? error;

  if (mode === "confirm") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Confirm your email</h1>
        {err && <div className={styles.error}>{err}</div>}
        <form onSubmit={handleConfirm}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Confirmation code</label>
            <input
              className={styles.input}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code from email"
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={busy}>
            Confirm
          </button>
        </form>
      </div>
    );
  }

  if (user && user.displayName === "Unknown") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Set your display name</h1>
        <p>This name will appear on expenses and in participant lists.</p>
        {err && <div className={styles.error}>{err}</div>}
        <form onSubmit={handleCreateProfile} className={styles.profileStep}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Display name</label>
            <input
              className={styles.input}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={busy}>
            Save
          </button>
        </form>
      </div>
    );
  }

  if (mode === "signIn") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Sign in</h1>
        {err && <div className={styles.error}>{err}</div>}
        <form onSubmit={handleSignIn}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={busy}>
            Sign in
          </button>
        </form>
        <div className={styles.toggle}>
          No account?{" "}
          <button type="button" onClick={() => { setMode("signUp"); setLocalError(null); }}>
            Sign up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Sign up</h1>
      {err && <div className={styles.error}>{err}</div>}
      <form onSubmit={handleSignUp}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Email</label>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Password</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button type="submit" className={styles.button} disabled={busy}>
          Sign up
        </button>
      </form>
      <div className={styles.toggle}>
        Already have an account?{" "}
        <button type="button" onClick={() => { setMode("signIn"); setLocalError(null); }}>
          Sign in
        </button>
      </div>
    </div>
  );
}
