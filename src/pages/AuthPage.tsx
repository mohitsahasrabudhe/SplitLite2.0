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
  | "reset"
  | "resetConfirm";

function friendlyError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("incorrect") || m.includes("not authorized"))
    return "Incorrect email or password.";
  if (m.includes("password"))
    return "Password must be at least 8 characters and include a number or symbol.";
  if (m.includes("exists")) return "An account with this email already exists.";
  if (m.includes("code")) return "Invalid confirmation code.";
  return msg;
}

export default function AuthPage() {
  const {
    user,
    loading,
    refreshProfile,
    signOut,
    completeOnboarding,
  } = useAuth();

  const [step, setStep] = useState<Step>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  /* ============================
     DISPLAY NAME ONBOARDING
     ============================ */

  if (user && !user.displayName) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Choose your display name</h1>
        {error && <div className={styles.error}>{error}</div>}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!displayName.trim()) return;

            setBusy(true);
            setError(null);

            try {
              await client.models.UserProfile.create({
                id: user.userId,
                displayName: displayName.trim(),
                email: user.email,
              });

              completeOnboarding(displayName.trim());
            } catch (err: any) {
              setError(friendlyError(err.message));
            } finally {
              setBusy(false);
            }
          }}
        >
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
     ACCOUNT PAGE
     ============================ */

  if (user && user.displayName) {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Account</h1>

        <p>Signed in as {user.displayName}</p>

        <button className={styles.button} onClick={() => signOut()}>
          Sign out
        </button>

        <hr style={{ margin: "2rem 0" }} />

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
     CONFIRM SIGN UP OTP
     ============================ */

  if (step === "confirm") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Check your email</h1>
        {error && <div className={styles.error}>{error}</div>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);

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
          }}
        >
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
     RESET PASSWORD CONFIRM
     ============================ */

  if (step === "resetConfirm") {
    return (
      <div className={styles.container}>
        <h1 className={styles.heading}>Reset password</h1>
        {error && <div className={styles.error}>{error}</div>}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);

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
          }}
        >
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
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);

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
          }}
        >
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
     SIGN IN
     ============================ */

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>Sign in</h1>
      {error && <div className={styles.error}>{error}</div>}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);

          try {
            await signIn({ username: email, password });
            await refreshProfile();
          } catch (err: any) {
            setError(friendlyError(err.message));
          } finally {
            setBusy(false);
          }
        }}
      >
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
        onClick={async () => {
          if (!email) {
            setError("Enter your email first.");
            return;
          }

          setBusy(true);
          setError(null);

          try {
            await resetPassword({ username: email });
            setStep("resetConfirm");
          } catch (err: any) {
            setError(friendlyError(err.message));
          } finally {
            setBusy(false);
          }
        }}
      >
        Forgot password?
      </button>

      <div className={styles.toggle}>
        New here?{" "}
        <button onClick={() => setStep("signUp")}>Create account</button>
      </div>
    </div>
  );
}