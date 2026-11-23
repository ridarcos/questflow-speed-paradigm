import { describe, expect, it, vi } from "vitest";
import type { QuestInput } from "./quests";
import { createSeedCoordinator, isInitialSeedSettled, type SeedDependencies } from "./seedCoordinator";
import type { WriteOutcome } from "./writes";

const EXAMPLES: QuestInput[] = [
  { title: "Uno", description: "", difficulty: "easy" },
  { title: "Dos", description: "", difficulty: "easy" },
  { title: "Tres", description: "", difficulty: "medium" },
  { title: "Cuatro", description: "", difficulty: "hard" },
];

/** Espera a que se vacíe la cola de microtareas (escrituras falsas encadenadas). */
async function settle() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

interface Harness {
  deps: SeedDependencies;
  written: Array<{ uid: string | null; title: string }>;
  lateErrors: Array<(error: unknown) => void>;
  setSession: (uid: string | null) => void;
}

function harness(write?: (input: QuestInput, index: number) => Promise<WriteOutcome>): Harness {
  let session: string | null = "uid-a";
  const written: Harness["written"] = [];
  const lateErrors: Harness["lateErrors"] = [];
  const deps: SeedDependencies = {
    sessionUid: () => session,
    write: async (input, onLateError) => {
      lateErrors.push(onLateError);
      const index = written.length;
      written.push({ uid: session, title: input.title });
      return write ? write(input, index) : "confirmed";
    },
    describeError: (error) => `fallo: ${String((error as { code?: string }).code ?? error)}`,
    examples: EXAMPLES,
  };
  return { deps, written, lateErrors, setSession: (uid) => (session = uid) };
}

describe("seedCoordinator: cuenta nueva", () => {
  it("una cuenta nueva queda pendiente y se siembra al arrancarla, en orden", async () => {
    const h = harness();
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    expect(seeds.getSnapshot().accounts.get("uid-a")?.phase).toBe("pending");
    expect(h.written).toEqual([]);

    seeds.startPendingSeed("uid-a");
    await settle();
    expect(h.written.map((w) => w.title)).toEqual(["Uno", "Dos", "Tres", "Cuatro"]);
    expect(h.written.every((w) => w.uid === "uid-a")).toBe(true);
    expect(seeds.getSnapshot().accounts.get("uid-a")).toEqual({ phase: "done", source: "signup", error: null });
  });

  it("no duplica: avisos y arranques repetidos (StrictMode, redirect) escriben 4 en total", async () => {
    const h = harness();
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    seeds.markNewAccount("uid-a");
    seeds.startPendingSeed("uid-a");
    seeds.startPendingSeed("uid-a");
    await settle();
    seeds.markNewAccount("uid-a");
    seeds.startPendingSeed("uid-a");
    await settle();
    expect(h.written).toHaveLength(4);
  });

  it("sin aviso de cuenta nueva, arrancar no escribe nada (acceso normal, recarga)", async () => {
    const h = harness();
    const seeds = createSeedCoordinator(h.deps);
    seeds.startPendingSeed("uid-a");
    await settle();
    expect(h.written).toEqual([]);
    expect(seeds.getSnapshot().accounts.has("uid-a")).toBe(false);
  });

  it("escribe de una en una: la siguiente espera a que termine la anterior", async () => {
    const pending: Array<() => void> = [];
    const h = harness(() => new Promise<WriteOutcome>((resolve) => pending.push(() => resolve("confirmed"))));
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    seeds.startPendingSeed("uid-a");
    await settle();
    expect(h.written).toHaveLength(1);
    pending.shift()?.();
    await settle();
    expect(h.written).toHaveLength(2);
  });

  it("una escritura en cola (sin conexión) no detiene la siembra", async () => {
    const h = harness(async () => "queued");
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    seeds.startPendingSeed("uid-a");
    await settle();
    expect(h.written).toHaveLength(4);
    expect(seeds.getSnapshot().accounts.get("uid-a")?.phase).toBe("done");
  });
});

describe("seedCoordinator: sesión (SEC-10)", () => {
  it("no escribe nada si el UID no es el de la sesión actual", async () => {
    const h = harness();
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-ajeno");
    seeds.startPendingSeed("uid-ajeno");
    seeds.seedOnDemand("uid-ajeno");
    await settle();
    expect(h.written).toEqual([]);
  });

  it("se detiene si la sesión cambia a mitad de la siembra", async () => {
    let release!: () => void;
    const h = harness((_input, index) =>
      index === 0 ? new Promise<WriteOutcome>((resolve) => (release = () => resolve("confirmed"))) : Promise.resolve("confirmed"),
    );
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    seeds.startPendingSeed("uid-a");
    await settle();
    h.setSession("uid-b");
    release();
    await settle();
    expect(h.written).toEqual([{ uid: "uid-a", title: "Uno" }]);
    expect(seeds.getSnapshot().accounts.get("uid-a")?.phase).toBe("done");
  });
});

describe("seedCoordinator: fallos", () => {
  it("el primer rechazo detiene la siembra y deja un único error, sin reintentos", async () => {
    vi.useFakeTimers();
    try {
      const h = harness(async () => {
        throw { code: "permission-denied" };
      });
      const seeds = createSeedCoordinator(h.deps);
      seeds.markNewAccount("uid-a");
      seeds.startPendingSeed("uid-a");
      await settle();
      expect(h.written).toHaveLength(1);
      expect(seeds.getSnapshot().accounts.get("uid-a")).toEqual({
        phase: "error",
        source: "signup",
        error: "fallo: permission-denied",
      });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(h.written).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("un rechazo tardío de una escritura en cola se muestra una sola vez", async () => {
    const h = harness(async () => "queued");
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    seeds.startPendingSeed("uid-a");
    await settle();
    const listener = vi.fn();
    seeds.subscribe(listener);
    for (const late of h.lateErrors) late({ code: "permission-denied" });
    expect(seeds.getSnapshot().accounts.get("uid-a")?.phase).toBe("error");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("dismissError cierra el aviso sin volver a escribir", async () => {
    const h = harness(async () => {
      throw { code: "unavailable" };
    });
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    seeds.startPendingSeed("uid-a");
    await settle();
    seeds.dismissError("uid-a");
    await settle();
    expect(seeds.getSnapshot().accounts.get("uid-a")).toEqual({ phase: "done", source: "signup", error: null });
    expect(h.written).toHaveLength(1);
  });

  it("un write que lanza de forma síncrona también se recoge como error", async () => {
    const h = harness();
    const seeds = createSeedCoordinator({
      ...h.deps,
      write: () => {
        throw new Error("sin sesión");
      },
    });
    seeds.seedOnDemand("uid-a");
    await settle();
    expect(seeds.getSnapshot().accounts.get("uid-a")?.phase).toBe("error");
  });
});

describe("seedCoordinator: botón Añadir misiones de ejemplo", () => {
  it("doble clic mientras trabaja: 4 escrituras", async () => {
    const h = harness();
    const seeds = createSeedCoordinator(h.deps);
    seeds.seedOnDemand("uid-a");
    seeds.seedOnDemand("uid-a");
    expect(seeds.getSnapshot().accounts.get("uid-a")).toEqual({ phase: "running", source: "demand", error: null });
    await settle();
    expect(h.written).toHaveLength(4);
  });

  it("se puede volver a usar cuando la anterior terminó (la lista volvió a quedar vacía)", async () => {
    const h = harness();
    const seeds = createSeedCoordinator(h.deps);
    seeds.seedOnDemand("uid-a");
    await settle();
    seeds.seedOnDemand("uid-a");
    await settle();
    expect(h.written).toHaveLength(8);
  });

  it("no actúa mientras la siembra de cuenta nueva está pendiente o en curso", async () => {
    const h = harness();
    const seeds = createSeedCoordinator(h.deps);
    seeds.markNewAccount("uid-a");
    seeds.seedOnDemand("uid-a");
    await settle();
    expect(h.written).toEqual([]);
    seeds.startPendingSeed("uid-a");
    seeds.seedOnDemand("uid-a");
    await settle();
    expect(h.written).toHaveLength(4);
  });
});

describe("seedCoordinator: accesos en curso y estado inicial", () => {
  it("beginSignIn marca un acceso en curso; la función de cierre es idempotente", () => {
    const seeds = createSeedCoordinator(harness().deps);
    const endA = seeds.beginSignIn();
    const endB = seeds.beginSignIn();
    expect(seeds.getSnapshot().signInPending).toBe(true);
    endA();
    endA();
    expect(seeds.getSnapshot().signInPending).toBe(true);
    endB();
    expect(seeds.getSnapshot().signInPending).toBe(false);
  });

  it("isInitialSeedSettled: espera al acceso en curso y a la siembra de cuenta nueva", async () => {
    const seeds = createSeedCoordinator(harness().deps);
    expect(isInitialSeedSettled(seeds.getSnapshot(), "uid-a")).toBe(true);
    const end = seeds.beginSignIn();
    expect(isInitialSeedSettled(seeds.getSnapshot(), "uid-a")).toBe(false);
    seeds.markNewAccount("uid-a");
    end();
    expect(isInitialSeedSettled(seeds.getSnapshot(), "uid-a")).toBe(false);
    seeds.startPendingSeed("uid-a");
    expect(isInitialSeedSettled(seeds.getSnapshot(), "uid-a")).toBe(false);
    await settle();
    expect(isInitialSeedSettled(seeds.getSnapshot(), "uid-a")).toBe(true);
  });

  it("la siembra bajo demanda no retiene el estado vacío ni el tutorial", () => {
    const seeds = createSeedCoordinator(harness().deps);
    seeds.seedOnDemand("uid-a");
    expect(isInitialSeedSettled(seeds.getSnapshot(), "uid-a")).toBe(true);
  });

  it("la instantánea solo cambia de identidad cuando cambia el estado", async () => {
    const seeds = createSeedCoordinator(harness().deps);
    const first = seeds.getSnapshot();
    expect(seeds.getSnapshot()).toBe(first);
    seeds.dismissError("uid-a");
    seeds.startPendingSeed("uid-a");
    expect(seeds.getSnapshot()).toBe(first);
    seeds.markNewAccount("uid-a");
    expect(seeds.getSnapshot()).not.toBe(first);
  });

  it("subscribe avisa de los cambios y se puede cancelar", () => {
    const seeds = createSeedCoordinator(harness().deps);
    const listener = vi.fn();
    const unsubscribe = seeds.subscribe(listener);
    seeds.markNewAccount("uid-a");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    seeds.beginSignIn();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
