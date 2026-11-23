"use client";

import { useState, type ReactNode } from "react";
import { translateAuthError } from "@/lib/authErrors";
import { AuthProvider, useAuth } from "./AuthProvider";
import { AuthScreen } from "./AuthScreen";
import { ConfigNotice } from "./ConfigNotice";
import { Dashboard } from "./Dashboard";
import { buttonClass, ErrorBox, Logo, mutedText, Spinner } from "./ui";

function SignedInBar() {
  const { user, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const name = user.displayName || user.email || "Tu cuenta";

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <p className={`min-w-0 max-w-[11rem] truncate text-small sm:max-w-xs ${mutedText}`} title={user.email ?? undefined}>
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
        className={buttonClass("secondary", "sm", "shrink-0")}
      >
        {pending ? "Cerrando…" : "Cerrar sesión"}
      </button>
      {error && (
        <p role="alert" className="w-full text-right text-small text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Header({ actions }: { actions?: ReactNode }) {
  return (
    <header className="border-b border-ink/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo className="size-8" />
          <h1 className="font-display text-title font-bold tracking-tight">QuestFlow</h1>
          <p className={`hidden text-small md:block ${mutedText}`}>Misiones personales con XP</p>
        </div>
        {actions}
      </div>
    </header>
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
          className={`flex items-center justify-center gap-3 py-16 text-body ${mutedText}`}
        >
          <Spinner className="size-6 text-contour" />
          Comprobando sesión…
        </div>
      );
    case "error":
      return (
        <ErrorBox
          title="No se pudo comprobar tu sesión"
          action={
            <button type="button" onClick={() => window.location.reload()} className={buttonClass("secondary", "sm")}>
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

function Shell() {
  const { status, user } = useAuth();
  // key por UID: cada sesión monta una barra nueva, así el estado "Cerrando…" de
  // la sesión anterior no se arrastra al volver a iniciar sesión sin recargar.
  const actions = status === "signed-in" && user ? <SignedInBar key={user.uid} /> : undefined;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Header actions={actions} />
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
        <MainContent />
      </main>
    </div>
  );
}

export function AppShell() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
