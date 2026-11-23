"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useId, useState, type FormEvent } from "react";
import {
  authErrorCode,
  isValidEmail,
  PASSWORD_MIN_LENGTH,
  translateAuthError,
  validateCredentials,
  type CredentialErrors,
} from "@/lib/authErrors";
import { getFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "./AuthProvider";
import { ErrorBox, focusRing, mutedText, primaryButton, secondaryButton, fieldClass } from "./ui";

type Mode = "signin" | "signup";

const inputClass = fieldClass;

/**
 * Pantalla de acceso. El error de signInWithRedirect vive en el contexto de
 * AuthProvider y se lee en cada render (QA-004): si llega después de montar
 * esta pantalla, también se muestra.
 */
export function AuthScreen() {
  const { error: providerError, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();
  const error = localError ?? providerError;

  /** Toda acción nueva empieza sin errores previos (locales o de redirect). */
  function resetErrors() {
    setLocalError(null);
    clearError();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFieldErrors({});
    resetErrors();
    setInfo(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetErrors();
    setInfo(null);
    const errors = validateCredentials(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      return;
    }
    setPending(true);
    try {
      const auth = getFirebaseAuth();
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // onAuthStateChanged se encarga de mostrar el dashboard.
    } catch (err) {
      setLocalError(translateAuthError(err));
      setPending(false);
    }
  }

  async function handleGoogle() {
    resetErrors();
    setInfo(null);
    setPending(true);
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (authErrorCode(err) === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          setLocalError(translateAuthError(redirectErr));
        }
      } else {
        setLocalError(translateAuthError(err));
      }
      setPending(false);
    }
  }

  async function handleReset() {
    resetErrors();
    setInfo(null);
    if (!isValidEmail(email)) {
      setFieldErrors({ email: "Escribe tu email para recibir el enlace de recuperación." });
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setInfo("Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña.");
    } catch (err) {
      setLocalError(translateAuthError(err));
    } finally {
      setPending(false);
    }
  }

  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const isSignup = mode === "signup";

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="mx-auto w-full min-w-0 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 id={`${id}-title`} className="text-xl font-semibold">
        {isSignup ? "Crea tu cuenta" : "Inicia sesión"}
      </h2>
      <p className={`mt-1 text-sm ${mutedText}`}>
        Tus misiones se guardan en tu cuenta y solo tú puedes verlas.
      </p>

      <div role="group" aria-label="Modo de acceso" className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
            disabled={pending}
            className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${focusRing} ${
              mode === value
                ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-950 dark:text-indigo-300"
                : "text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {value === "signin" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor={emailId} className="block text-sm font-medium">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
            className={inputClass}
          />
          {fieldErrors.email && (
            <p id={`${emailId}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
              {fieldErrors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={passwordId} className="block text-sm font-medium">
            Contraseña
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={`${passwordId}-hint${fieldErrors.password ? ` ${passwordId}-error` : ""}`}
            className={inputClass}
          />
          <p id={`${passwordId}-hint`} className={`mt-1 text-xs ${mutedText}`}>
            Mínimo {PASSWORD_MIN_LENGTH} caracteres.
          </p>
          {fieldErrors.password && (
            <p id={`${passwordId}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}
        <p aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-400">
          {info}
        </p>

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={`${primaryButton} w-full py-2.5`}
        >
          {pending ? "Procesando…" : isSignup ? "Crear cuenta" : "Iniciar sesión"}
        </button>
        {!isSignup && (
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className={`rounded text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 disabled:opacity-60 dark:text-indigo-300 ${focusRing}`}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />o
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={pending}
        className={`${secondaryButton} w-full py-2.5 font-semibold`}
      >
        Continuar con Google
      </button>
    </section>
  );
}
