import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getCurrentUser, signOut as amplifySignOut } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  completeOnboarding: (displayName: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      const email = current.signInDetails?.loginId ?? "";

      if (!email) throw new Error("Email missing from Cognito");

      const { data } = await client.models.UserProfile.list({
        filter: { email: { eq: email } },
      });

      const profile = data?.[0];

      if (!profile) {
        setUser({
          userId: current.userId,
          email,
          displayName: "",
        });
      } else {
        setUser({
          userId: current.userId,
          email,
          displayName: profile.displayName,
        });
      }

      setError(null);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : "Auth error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    await loadUser();
  }, [loadUser]);

  // ✅ THIS IS THE KEY FIX — optimistic onboarding completion
  const completeOnboarding = useCallback((displayName: string) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            displayName,
          }
        : prev
    );
  }, []);

  const signOut = useCallback(async () => {
    try {
      await amplifySignOut();
      setUser(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out error");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signOut,
        refreshProfile,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}