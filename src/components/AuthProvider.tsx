"use client";

import {
  getRedirectResult,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translateAuthError } from "@/lib/authErrors";
import {
  withoutError,
  withRedirectError,
  withUser,
  type AuthState,
  type AuthStatus,
} from "@/lib/authState";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { noteSignInResult, seeding } from "@/lib/seeding";

export type { AuthStatus };

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Error de inicialización o de retorno de signInWithRedirect. */
  error: string | null;
  /** Limpia `error` (p. ej. al iniciar una nueva acción de acceso). */
  clearError: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState<User>>(() =>
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
    let active = true;
    try {
      const auth = getFirebaseAuth();
      unsubscribe = onAuthStateChanged(
        auth,
        (user) => setState((prev) => withUser(prev, user)),
        (error) => {
          setState({ status: "error", user: null, error: translateAuthError(error) });
        },
      );
      // Si se usó signInWithRedirect, recoge el resultado al volver: con una
      // cuenta nueva deja pendientes las misiones de ejemplo (el coordinador
      // ignora el aviso repetido de StrictMode). El posible error puede llegar
      // después de montar AuthScreen: esta la lee del contexto (QA-004).
      const endSignIn = seeding.beginSignIn();
      getRedirectResult(auth)
        .then((credential) => {
          if (credential) noteSignInResult(credential);
        })
        .catch((error: unknown) => {
          if (active) setState((prev) => withRedirectError(prev, translateAuthError(error)));
        })
        .finally(endSignIn);
    } catch (error) {
      queueMicrotask(() =>
        setState({ status: "error", user: null, error: translateAuthError(error) }),
      );
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured]);

  const clearError = useCallback(() => setState(withoutError), []);

  const signOut = useCallback(async () => {
    // QA-004: ningún error anterior sobrevive al cierre de sesión.
    setState(withoutError);
    await firebaseSignOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, clearError, signOut }),
    [state, clearError, signOut],
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
