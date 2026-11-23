"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { AuthScreen } from "./AuthScreen";
import { ConfigNotice } from "./ConfigNotice";
import { Dashboard } from "./Dashboard";

function UserBar() {
  const { status, user, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  if (status !== "signed-in" || !user) return null;
  const name = user.displayName || user.email || "Usuario";

  return (
    <div className="flex min-w-0 items-center gap-3">
      <p className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-300" title={user.email ?? undefined}>
        <span className="sr-only">Sesión iniciada como </span>
        {name}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await signOut();
          } finally {
            setPending(false);
          }
        }}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        Cerrar sesión
      </button>
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
        <p role="status" className="py-12 text-center text-sm text-slate-600 dark:text-slate-400">
          Comprobando sesión…
        </p>
      );
    case "error":
      return (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Error de autenticación: {error}
        </p>
      );
    case "signed-out":
      return <AuthScreen initialError={error} />;
    case "signed-in":
      return user ? <Dashboard key={user.uid} uid={user.uid} /> : null;
  }
}

export function AppShell() {
  return (
    <AuthProvider>
      <div className="flex flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
                QuestFlow
              </h1>
              <p className="hidden text-sm text-slate-600 sm:block dark:text-slate-400">
                Misiones personales con XP
              </p>
            </div>
            <UserBar />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          <MainContent />
        </main>
      </div>
    </AuthProvider>
  );
}
