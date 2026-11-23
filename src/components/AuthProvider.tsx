"use client";

import {
  getRedirectResult,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translateAuthError } from "@/lib/authErrors";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

export type AuthStatus = "loading" | "signed-out" | "signed-in" | "config-error" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Error de inicialización o de retorno de signInWithRedirect. */
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    isFirebaseConfigured()
      ? { status: "loading", user: null, error: null }
      : { status: "config-error", user: null, error: null },
  );
  const configured = state.status !== "config-error";

  useEffect(() => {
    if (!configured) {
      return;
    }
    let unsubscribe: () => void = () => {};
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          setState((prev) => ({
            status: user ? "signed-in" : "signed-out",
            user,
            // Conserva un error de redirect pendiente mientras no haya sesión.
            error: user ? null : prev.error,
          }));
        },
        (error) => {
          setState({ status: "error", user: null, error: translateAuthError(error) });
        },
      );
      // Si se usó signInWithRedirect, recoge el posible error al volver.
      getRedirectResult(auth).catch((error: unknown) => {
        setState((prev) => ({ ...prev, error: translateAuthError(error) }));
      });
    } catch (error) {
      queueMicrotask(() =>
        setState({ status: "error", user: null, error: translateAuthError(error) }),
      );
    }
    return () => unsubscribe();
  }, [configured]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signOut }),
    [state, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  }
  return ctx;
}
