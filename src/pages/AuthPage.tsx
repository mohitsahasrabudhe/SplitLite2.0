/**
 * Auth page: sign in, sign up, confirm email, reset password, set display name, and account controls.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  signIn,
  signUp,
  confirmSignUp,
  resetPassword,
  confirmResetPassword,
  deleteUser,
} from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { useAuth } from "../context/AuthContext";
import styles from "./AuthPage.module.css";

const client = generateClient<Schema>();

type Step =
  | "signIn"
  | "signUp"
  | "confirm"
  | "profile"
  | "reset"
  | "resetConfirm";

function friendlyError(msg: string) {
  const m = msg.toLowerCase();

  if (m.includes("incorrect") || m.includes("not authorized"))
    return "Incorrect email or password.";

  if (m.includes("password"))
    return "Password must be at least 8 characters and include a number or symbol.";

  if (m.includes("exists"))
    return "An account with this email already exists.";

  if (m.includes("code"))
    return "Invalid confirmation code.";

  return msg;
}

export default function AuthPage() {
  const { user, loading, refreshProfile, signOut } = useAuth();

  const [step, setStep] = useState<Step>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordRules = {
    length: password.length >= 8,
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  /* ============================
     SIGN IN
     ============================ */

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await signIn({ username: email, password });
      await refreshProfile();
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  /* ============================
     SIGN UP
     ============================ */

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setStep("confirm");
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  /* ============================
     CONFIRM EMAIL
     ============================ */

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: code,
      });
      
      await signIn({ username: email, password });
      await refreshProfile();
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  /* ============================
     DISPLAY NAME
     ============================ */

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;

    setError(null);
    setBusy(true);

    try {
      await client.models.UserProfile.create({
        displayName: displayName.trim(),
      });
      await refreshProfile();
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  /* ============================
     RESET PASSWORD
     ============================ */

     async function handleReset() {
      setError(null);
      setBusy(true);
    
      try {
        await resetPassword({ username: email });
      } catch {
        // intentionally ignore errors for privacy UX
      } finally {
        setStep("resetConfirm");
        setBusy(false);
      }
    }

  async function handleResetConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: password,
      });
      setStep("signIn");
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  /* ============================
     LOADING
     ============================ */

  if (loading) return null;

  /* ============================
     ACCOUNT VIEW
     ============================ */

  if (user && user.displayName !== "Unknown") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Account</h1>

        <p>Signed in as {user.displayName}</p>

        <button className={styles.button} onClick={() => signOut()}>
          Sign out
        </button>

        <hr style={{ margin: "2rem 0" }} />

        <p style={{ color: "#b00020", fontWeight: 600 }}>Danger zone</p>

        <button
          className={styles.buttonSecondary}
          onClick={async () => {
            if (!confirm("This will permanently delete your account. Continue?"))
              return;

            await deleteUser();
            await signOut();
          }}
        >
          Delete account permanently
        </button>

        <div className={styles.toggle}>
          <Link to="/">Back to expenses</Link>
        </div>
      </div>
    );
  }

  /* ============================
     PROFILE REQUIRED
     ============================ */

  if (user && user.displayName === "Unknown") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Choose your display name</h1>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleCreateProfile}>
          <input
            className={styles.input}
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <button className={styles.button} disabled={busy}>
            Continue
          </button>
        </form>
      </div>
    );
  }

  /* ============================
     CONFIRM OTP
     ============================ */

  if (step === "confirm") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Check your email</h1>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleConfirm}>
          <input
            className={styles.input}
            placeholder="Confirmation code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button className={styles.button} disabled={busy}>
            Confirm
          </button>
        </form>
      </div>
    );
  }

  /* ============================
     RESET CONFIRM
     ============================ */

  if (step === "resetConfirm") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Reset password</h1>
        {error && <div className={styles.error}>{error}</div>}
        <h1 className={styles.heading}>
  If an account exists, we sent you a code
</h1><form onSubmit={handleResetConfirm}>
          <input
            className={styles.input}
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <input
            className={styles.input}
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className={styles.button}>Save</button>
        </form>
        <button
  className={styles.link}
  type="button"
  onClick={handleReset}
  disabled={busy}
>
  Didn’t get a code? Resend
</button>
      </div>
    );
  }

  /* ============================
     SIGN UP
     ============================ */

  if (step === "signUp") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Create account</h1>
        {error && <div className={styles.error}>{error}</div>}
        <form onSubmit={handleSignUp}>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className={styles.passwordRules}>
            <div className={passwordRules.length ? styles.ok : ""}>
              • 8+ characters
            </div>
            <div className={passwordRules.number ? styles.ok : ""}>
              • Number
            </div>
            <div className={passwordRules.special ? styles.ok : ""}>
              • Special character
            </div>
          </div>

          <button className={styles.button} disabled={busy}>
            Sign up
          </button>
        </form>

        <div className={styles.toggle}>
          Already have an account?{" "}
          <button onClick={() => setStep("signIn")}>Sign in</button>
        </div>
      </div>
    );
  }

  /* ============================
     SIGN IN (DEFAULT)
     ============================ */

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Sign in</h1>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={handleSignIn}>
        <input
          className={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className={styles.button} disabled={busy}>
          Sign in
        </button>
      </form>

      <button
        className={styles.link}
        onClick={() => setStep("reset")}
        disabled={!email}
      >
        Forgot password?
      </button>

      {step === "reset" && (
        <button
          className={styles.buttonSecondary}
          onClick={handleReset}
        >
          Send reset code
        </button>
      )}

      <div className={styles.toggle}>
        New here?{" "}
        <button onClick={() => setStep("signUp")}>Create account</button>
      </div>
    </div>
  );
}