/**
 * Auth context: current Cognito user and their UserProfile displayName.
 * Provides loading and error state for auth and profile fetch.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function fetchDisplayName(userId: string): Promise<string> {
  const { data } = await client.models.UserProfile.list();
  const profiles = data ?? [];
  const profile = profiles.find(
    (p) => (p as { owner?: string }).owner === userId || (p as { owner?: string }).owner?.endsWith(userId)
  );
  return profile?.displayName ?? "Unknown";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const current = await getCurrentUser();
      const userId = current.userId;
      const email = current.signInDetails?.loginId ?? "";
      const displayName = await fetchDisplayName(userId);
      setUser({ userId, email, displayName });
      setError(null);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : "Auth error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await getCurrentUser();
        if (cancelled) return;
        const userId = current.userId;
        const email = current.signInDetails?.loginId ?? "";
        const displayName = await fetchDisplayName(userId);
        if (cancelled) return;
        setUser({ userId, email, displayName });
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setUser(null);
        setError(e instanceof Error ? e.message : "Auth error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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

  const value: AuthContextValue = {
    user,
    loading,
    error,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
