"use client";

import { useState } from "react";
import { translateAuthError } from "@/lib/authErrors";
import { AuthProvider, useAuth } from "./AuthProvider";
import { AuthScreen } from "./AuthScreen";
import { ConfigNotice } from "./ConfigNotice";
import { Dashboard } from "./Dashboard";
import { ErrorBox, mutedText, secondaryButton, Spinner } from "./ui";

function UserBar() {
  const { status, user } = useAuth();
  if (status !== "signed-in" || !user) return null;
  // key por UID: cada sesión monta una barra nueva, así el estado "Cerrando…" de
  // la sesión anterior no se arrastra al volver a iniciar sesión sin recargar.
  return <SignedInBar key={user.uid} />;
}

function SignedInBar() {
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const name = user.displayName || user.email || "Usuario";

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <p className="min-w-0 max-w-[14rem] truncate text-sm text-slate-700 sm:max-w-xs dark:text-slate-300" title={user.email ?? undefined}>
        <span className="sr-only">Sesión iniciada como </span>
        {name}
      </p>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await signOut();
          } catch (err) {
            setError(`No se pudo cerrar sesión. ${translateAuthError(err)}`);
            setPending(false);
          }
        }}
        className={`${secondaryButton} shrink-0 px-3 py-1.5 text-sm`}
      >
        {pending ? "Cerrando…" : "Cerrar sesión"}
      </button>
      {error && (
        <p role="alert" className="w-full text-right text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function MainContent() {
  const { status, user, error } = useAuth();

  switch (status) {
    case "config-error":
      return <ConfigNotice />;
    case "loading":
      return (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className={`flex items-center justify-center gap-3 py-16 text-sm ${mutedText}`}
        >
          <Spinner className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          Comprobando sesión…
        </div>
      );
    case "error":
      return (
        <ErrorBox
          title="Error de autenticación"
          action={
            <button type="button" onClick={() => window.location.reload()} className={`${secondaryButton} px-3 py-1.5 text-sm`}>
              Reintentar
            </button>
          }
        >
          {error}
        </ErrorBox>
      );
    case "signed-out":
      return <AuthScreen />;
    case "signed-in":
      return user ? <Dashboard key={user.uid} uid={user.uid} /> : null;
  }
}

export function AppShell() {
  return (
    <AuthProvider>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-black text-white shadow-sm"
              >
                Q
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
                  QuestFlow
                </h1>
                <p className={`hidden text-sm sm:block ${mutedText}`}>Misiones personales con XP</p>
              </div>
            </div>
            <UserBar />
          </div>
        </header>
        <main className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          <MainContent />
        </main>
      </div>
    </AuthProvider>
  );
}
