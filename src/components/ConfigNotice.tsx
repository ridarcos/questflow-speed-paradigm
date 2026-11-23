"use client";

import { missingFirebaseEnvKeys } from "@/lib/firebase";
import { mutedText } from "./ui";

/**
 * Aviso de configuración: si faltan variables NEXT_PUBLIC_FIREBASE_*, lo muestra
 * con role="alert" en lugar de dejar que la app falle.
 */
export function ConfigNotice() {
  const missing = missingFirebaseEnvKeys();

  if (missing.length === 0) {
    return null;
  }

  return (
    <div role="alert" className="mx-auto w-full max-w-xl rounded-container border border-danger bg-surface p-6">
      <h2 className="font-display text-title font-bold tracking-tight">Firebase no está configurado</h2>
      <p className={`mt-2 text-body ${mutedText}`}>
        Copia <code className="font-semibold text-ink">.env.example</code> a{" "}
        <code className="font-semibold text-ink">.env.local</code> (o define las variables en Vercel) y vuelve a
        compilar. Faltan estas variables:
      </p>
      <ul className="mt-4 flex flex-col gap-1.5 text-small">
        {missing.map((key) => (
          <li key={key} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />
            <code className="min-w-0 font-semibold text-ink wrap-anywhere">{key}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
