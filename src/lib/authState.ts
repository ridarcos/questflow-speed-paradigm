/**
 * Transiciones puras del estado de autenticación (QA-004).
 * AuthProvider las usa; se prueban sin Firebase.
 */

export type AuthStatus = "loading" | "signed-out" | "signed-in" | "config-error" | "error";

export interface AuthState<U> {
  status: AuthStatus;
  user: U | null;
  /** Error de inicialización o de retorno de signInWithRedirect. */
  error: string | null;
}

/** onAuthStateChanged: con sesión se limpia el error; sin sesión se conserva (p. ej. de redirect). */
export function withUser<U>(prev: AuthState<U>, user: U | null): AuthState<U> {
  return {
    status: user ? "signed-in" : "signed-out",
    user,
    error: user ? null : prev.error,
  };
}

/**
 * Error de getRedirectResult: puede llegar en cualquier momento, también
 * después de montar la pantalla de acceso, que lo lee del contexto.
 */
export function withRedirectError<U>(prev: AuthState<U>, error: string): AuthState<U> {
  return { ...prev, error };
}

/** Limpia el error (al iniciar una acción nueva o al cerrar sesión). */
export function withoutError<U>(prev: AuthState<U>): AuthState<U> {
  return prev.error === null ? prev : { ...prev, error: null };
}
