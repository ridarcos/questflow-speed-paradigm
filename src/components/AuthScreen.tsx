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
import { DIFFICULTIES, DIFFICULTY_LABELS, xpFor, type Difficulty } from "@/lib/quests";
import { useAuth } from "./AuthProvider";
import { ContourMap } from "./ContourMap";
import { buttonClass, containerClass, ErrorBox, fieldClass, labelClass, mutedText, TerrainIcon } from "./ui";

type Mode = "signin" | "signup";

const TERRAIN_HINTS: Readonly<Record<Difficulty, string>> = {
  easy: "Tareas de un rato: una llamada, un recado.",
  medium: "Lo que te pide una tarde de esfuerzo.",
  hard: "Los retos que llevas tiempo aplazando.",
};

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
    <div className="grid w-full min-w-0 gap-5 lg:min-h-[36rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-x-10 lg:gap-y-0">
      {/* Mapa: franja baja arriba en móvil, columna izquierda desde 1024 px. */}
      <div className="relative col-start-1 row-start-1 min-h-28 overflow-hidden rounded-container border border-ink/10 lg:row-end-3">
        <ContourMap className="absolute inset-0 size-full" />
      </div>

      <div className="relative col-start-1 row-start-1 flex min-w-0 flex-col justify-center px-5 py-6 lg:justify-start lg:px-10 lg:pt-14">
        <p className="max-w-[16ch] font-display text-heading font-bold tracking-tight text-balance lg:text-display">
          Cada misión, un tramo de tu ruta
        </p>
        <p className={`mt-4 hidden max-w-sm text-body lg:block ${mutedText}`}>
          Elige el terreno de cada misión, complétala y mira cómo avanza tu perfil de ruta.
        </p>
      </div>

      <section
        aria-labelledby={`${id}-title`}
        className={`${containerClass} row-start-2 min-w-0 p-5 sm:p-7 lg:col-start-2 lg:row-start-1 lg:row-end-3 lg:self-center`}
      >
        <h2 id={`${id}-title`} className="font-display text-heading font-bold tracking-tight">
          {isSignup ? "Crea tu cuenta" : "Inicia sesión"}
        </h2>
        <p className={`mt-1 text-small ${mutedText}`}>Tus misiones se guardan en tu cuenta y solo tú puedes verlas.</p>

        <div
          role="group"
          aria-label="Modo de acceso"
          className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-line p-1"
        >
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => switchMode(value)}
              disabled={pending}
              className={`min-h-10 rounded-full px-3 text-small font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                mode === value ? "bg-ink text-paper" : "text-ink enabled:hover:bg-ink/5"
              }`}
            >
              {value === "signin" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor={emailId} className={labelClass}>
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
              className={fieldClass}
            />
            {fieldErrors.email && (
              <p id={`${emailId}-error`} role="alert" className="mt-1.5 text-small text-danger">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={passwordId} className={labelClass}>
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
              className={fieldClass}
            />
            <p id={`${passwordId}-hint`} className={`mt-1.5 text-small ${mutedText}`}>
              Mínimo {PASSWORD_MIN_LENGTH} caracteres.
            </p>
            {fieldErrors.password && (
              <p id={`${passwordId}-error`} role="alert" className="mt-1 text-small text-danger">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {error && <ErrorBox>{error}</ErrorBox>}
          {info && (
            <p aria-live="polite" className="text-small text-ink">
              {info}
            </p>
          )}

          <button type="submit" disabled={pending} aria-busy={pending || undefined} className={buttonClass("primary", "md", "w-full")}>
            {pending ? "Procesando…" : isSignup ? "Crear cuenta" : "Iniciar sesión"}
          </button>
          {!isSignup && (
            <button type="button" onClick={handleReset} disabled={pending} className={buttonClass("quiet", "sm", "self-start")}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </form>

        <div className={`my-5 flex items-center gap-3 text-small ${mutedText}`}>
          <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />o
          <span className="h-px flex-1 bg-ink/10" aria-hidden="true" />
        </div>

        <button type="button" onClick={handleGoogle} disabled={pending} className={buttonClass("secondary", "md", "w-full")}>
          Continuar con Google
        </button>
      </section>

      <ul
        aria-label="Terrenos y XP"
        className="relative row-start-3 flex min-w-0 flex-col gap-4 px-1 pb-2 lg:col-start-1 lg:row-start-2 lg:px-10 lg:pb-10"
      >
        {DIFFICULTIES.map((difficulty) => (
          <li key={difficulty} className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-surface">
              <TerrainIcon difficulty={difficulty} className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-body font-semibold">
                {DIFFICULTY_LABELS[difficulty]} <span className={`font-normal ${mutedText}`}>· {xpFor(difficulty)} XP</span>
              </p>
              <p className={`text-small ${mutedText}`}>{TERRAIN_HINTS[difficulty]}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
