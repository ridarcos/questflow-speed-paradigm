/**
 * Marcas de interfaz guardadas en el navegador (AC-66, SEC-08).
 *
 * Único módulo de la app que toca localStorage. Todo acceso va dentro de
 * try/catch: si el navegador lo bloquea (getter que lanza SecurityError,
 * setItem con QuotaExceededError, modo privado), la marca se guarda en
 * memoria y vale para el resto de la sesión de la página.
 *
 * Solo se guardan marcas no sensibles: clave con prefijo "questflow" y el UID
 * (nunca email, nombre ni contenido de misiones), valor "done".
 */

type FlagStorage = Pick<Storage, "getItem" | "setItem">;

export interface FlagStore {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
}

/** Crea un almacén de marcas sobre `getStorage` con respaldo en memoria. */
export function createFlagStore(getStorage: () => FlagStorage | null | undefined): FlagStore {
  const memory = new Map<string, string>();
  return {
    read(key) {
      const remembered = memory.get(key);
      if (remembered !== undefined) return remembered;
      try {
        return getStorage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    write(key, value) {
      memory.set(key, value);
      try {
        getStorage()?.setItem(key, value);
      } catch {
        // Sin almacenamiento persistente: queda la copia en memoria.
      }
    },
  };
}

const browserFlags = createFlagStore(() => (typeof window === "undefined" ? null : window.localStorage));

export const TUTORIAL_FLAG_PREFIX = "questflow:tutorial:";
export const TUTORIAL_DONE = "done";

/** Clave de la marca del tutorial: una por UID. */
export function tutorialFlagKey(uid: string): string {
  return `${TUTORIAL_FLAG_PREFIX}${uid}`;
}

export function hasSeenTutorial(uid: string, store: FlagStore = browserFlags): boolean {
  return store.read(tutorialFlagKey(uid)) === TUTORIAL_DONE;
}

export function markTutorialSeen(uid: string, store: FlagStore = browserFlags): void {
  store.write(tutorialFlagKey(uid), TUTORIAL_DONE);
}
