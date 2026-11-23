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

type Mode = "signin" | "signup";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

export function AuthScreen({ initialError }: { initialError?: string | null }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();

  function switchMode(next: Mode) {
    setMode(next);
    setFieldErrors({});
    setError(null);
    setInfo(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
      setError(translateAuthError(err));
      setPending(false);
    }
  }

  async function handleGoogle() {
    setError(null);
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
          setError(translateAuthError(redirectErr));
        }
      } else {
        setError(translateAuthError(err));
      }
      setPending(false);
    }
  }

  async function handleReset() {
    setError(null);
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
      setError(translateAuthError(err));
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
      className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 id={`${id}-title`} className="text-xl font-semibold">
        {isSignup ? "Crea tu cuenta" : "Inicia sesión"}
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
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
            className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60 ${
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
          <p id={`${passwordId}-hint`} className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Mínimo {PASSWORD_MIN_LENGTH} caracteres.
          </p>
          {fieldErrors.password && (
            <p id={`${passwordId}-error`} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
        <p aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-400">
          {info}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo-700 px-4 py-2.5 font-semibold text-white hover:bg-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Procesando…" : isSignup ? "Crear cuenta" : "Iniciar sesión"}
        </button>
        {!isSignup && (
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className="text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60 dark:text-indigo-300"
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />o
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={pending}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        Continuar con Google
      </button>
    </section>
  );
}
