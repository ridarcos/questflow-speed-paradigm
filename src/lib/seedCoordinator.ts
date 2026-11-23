import type { QuestInput } from "./quests";
import type { WriteOutcome } from "./writes";

/**
 * Coordinador de la siembra de misiones de ejemplo (AC-59 a AC-62, SEC-10).
 *
 * Lógica pura con dependencias inyectadas (src/lib/seeding.ts crea la
 * instancia de la app con Firebase). Garantías:
 *
 * - Una cuenta nueva se siembra una sola vez por carga de página, aunque el
 *   aviso de "cuenta nueva" llegue dos veces (StrictMode, getRedirectResult
 *   repetido) o el dashboard se monte varias veces.
 * - Las escrituras son secuenciales y en el orden de `examples`, así que los
 *   `createdAt` son distintos y el orden es el mismo en todas las cuentas.
 * - Nunca escribe para otra cuenta: el UID solo sirve de clave y de
 *   comprobación. Antes de cada escritura se exige que la sesión siga siendo
 *   la de ese UID (si cambia, se detiene) y la ruta la construye `write` con
 *   el UID de la sesión.
 * - Sin reintentos automáticos: el primer fallo detiene la siembra y deja un
 *   único error visible por ejecución.
 */

export type SeedSource = "signup" | "demand";

/**
 * - `pending`: cuenta nueva detectada; espera a que su dashboard la arranque.
 * - `running`: escribiendo.
 * - `done`: terminada (o detenida porque cambió la sesión).
 * - `error`: falló; `error` lleva el mensaje para el usuario.
 */
export type SeedPhase = "pending" | "running" | "done" | "error";

export interface SeedState {
  readonly phase: SeedPhase;
  readonly source: SeedSource;
  readonly error: string | null;
}

export interface SeedSnapshot {
  /** Hay un acceso en curso cuyo resultado (¿cuenta nueva?) aún no se conoce. */
  readonly signInPending: boolean;
  readonly accounts: ReadonlyMap<string, SeedState>;
}

export interface SeedDependencies {
  /** UID con sesión iniciada en este momento, o null. */
  sessionUid: () => string | null;
  /**
   * Crea una misión en la cuenta de la sesión actual. Resuelve cuando el
   * servidor la confirma o queda en cola sin conexión; lanza si se rechaza a
   * tiempo. `onLateError` recibe un rechazo posterior de una escritura en cola.
   */
  write: (input: QuestInput, onLateError: (error: unknown) => void) => Promise<WriteOutcome>;
  /** Mensaje para el usuario a partir del error de la escritura. */
  describeError: (error: unknown) => string;
  examples: readonly QuestInput[];
}

export interface SeedCoordinator {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => SeedSnapshot;
  /** Marca el inicio de un acceso. Devuelve la función que lo da por terminado (idempotente). */
  beginSignIn: () => () => void;
  /** Firebase confirmó una cuenta nueva: queda pendiente de sembrar (una sola vez por UID). */
  markNewAccount: (uid: string) => void;
  /** El dashboard de `uid` está listo: arranca la siembra pendiente, si la hay. */
  startPendingSeed: (uid: string) => void;
  /** Botón "Añadir misiones de ejemplo". Ignorado mientras otra siembra de `uid` trabaja. */
  seedOnDemand: (uid: string) => void;
  /** Cierra el aviso de error de `uid`. */
  dismissError: (uid: string) => void;
}

export function isSeedBusy(state: SeedState | undefined): boolean {
  return state?.phase === "pending" || state?.phase === "running";
}

/**
 * true cuando ya no puede llegar una siembra inicial para `uid`. Hasta
 * entonces el dashboard no muestra el estado vacío (con "Añadir misiones de
 * ejemplo") ni abre el tutorial: la siembra puede estar a punto de escribir.
 */
export function isInitialSeedSettled(snapshot: SeedSnapshot, uid: string): boolean {
  const state = snapshot.accounts.get(uid);
  return !(snapshot.signInPending || (state?.source === "signup" && isSeedBusy(state)));
}

export function createSeedCoordinator(deps: SeedDependencies): SeedCoordinator {
  const accounts = new Map<string, SeedState>();
  const markedNew = new Set<string>();
  const openSignIns = new Set<number>();
  const listeners = new Set<() => void>();
  let signInCounter = 0;
  let snapshot: SeedSnapshot = { signInPending: false, accounts: new Map() };

  function emit() {
    snapshot = { signInPending: openSignIns.size > 0, accounts: new Map(accounts) };
    for (const listener of [...listeners]) listener();
  }

  function setState(uid: string, state: SeedState) {
    accounts.set(uid, state);
    emit();
  }

  async function run(uid: string, source: SeedSource): Promise<void> {
    let failed = false;
    const fail = (error: unknown) => {
      if (failed) return;
      failed = true;
      setState(uid, { phase: "error", source, error: deps.describeError(error) });
    };
    setState(uid, { phase: "running", source, error: null });
    try {
      for (const input of deps.examples) {
        if (failed) return;
        if (deps.sessionUid() !== uid) break;
        await deps.write(input, fail);
      }
    } catch (error) {
      fail(error);
      return;
    }
    if (!failed) setState(uid, { phase: "done", source, error: null });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    beginSignIn() {
      signInCounter += 1;
      const id = signInCounter;
      openSignIns.add(id);
      emit();
      return () => {
        if (openSignIns.delete(id)) emit();
      };
    },
    markNewAccount(uid) {
      if (markedNew.has(uid) || accounts.has(uid)) return;
      markedNew.add(uid);
      setState(uid, { phase: "pending", source: "signup", error: null });
    },
    startPendingSeed(uid) {
      if (accounts.get(uid)?.phase !== "pending") return;
      void run(uid, "signup");
    },
    seedOnDemand(uid) {
      if (isSeedBusy(accounts.get(uid))) return;
      void run(uid, "demand");
    },
    dismissError(uid) {
      const state = accounts.get(uid);
      if (state?.phase !== "error") return;
      setState(uid, { ...state, phase: "done", error: null });
    },
  };
}
