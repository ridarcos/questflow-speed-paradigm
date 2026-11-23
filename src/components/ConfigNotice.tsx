"use client";

import { missingFirebaseEnvKeys } from "@/lib/firebase";

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
    <div
      role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="font-semibold">Firebase no está configurado</p>
      <p className="mt-1 text-sm">
        Copia <code className="font-mono">.env.example</code> a{" "}
        <code className="font-mono">.env.local</code> (o define las variables en Vercel) y vuelve a
        compilar. Faltan:
      </p>
      <ul className="mt-2 list-inside list-disc break-all font-mono text-xs sm:text-sm">
        {missing.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
    </div>
  );
}
