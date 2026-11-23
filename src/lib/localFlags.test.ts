import { describe, expect, it, vi } from "vitest";
import {
  createFlagStore,
  hasSeenTutorial,
  markTutorialSeen,
  TUTORIAL_DONE,
  TUTORIAL_FLAG_PREFIX,
  tutorialFlagKey,
} from "./localFlags";

type FakeStorage = Pick<Storage, "getItem" | "setItem">;

function mapStorage(): FakeStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

function domException(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe("localFlags: marca del tutorial", () => {
  it("clave con prefijo questflow y el UID; valor 'done'", () => {
    expect(tutorialFlagKey("abc123")).toBe("questflow:tutorial:abc123");
    expect(TUTORIAL_FLAG_PREFIX.startsWith("questflow")).toBe(true);
    const storage = mapStorage();
    const store = createFlagStore(() => storage);
    markTutorialSeen("abc123", store);
    expect([...storage.data.entries()]).toEqual([["questflow:tutorial:abc123", TUTORIAL_DONE]]);
    expect(TUTORIAL_DONE).toBe("done");
  });

  it("es por UID: marcar A no afecta a B", () => {
    const store = createFlagStore(() => mapStorage());
    expect(hasSeenTutorial("uid-a", store)).toBe(false);
    markTutorialSeen("uid-a", store);
    expect(hasSeenTutorial("uid-a", store)).toBe(true);
    expect(hasSeenTutorial("uid-b", store)).toBe(false);
  });

  it("persiste entre instancias que comparten el mismo almacenamiento (recarga)", () => {
    const storage = mapStorage();
    markTutorialSeen("uid-a", createFlagStore(() => storage));
    expect(hasSeenTutorial("uid-a", createFlagStore(() => storage))).toBe(true);
  });
});

describe("localFlags: almacenamiento bloqueado (AC-66)", () => {
  it("getter que lanza SecurityError: no rompe y recuerda en memoria", () => {
    const getStorage = vi.fn((): FakeStorage => {
      throw domException("SecurityError");
    });
    const store = createFlagStore(getStorage);
    expect(hasSeenTutorial("uid-a", store)).toBe(false);
    expect(() => markTutorialSeen("uid-a", store)).not.toThrow();
    expect(hasSeenTutorial("uid-a", store)).toBe(true);
    expect(getStorage).toHaveBeenCalled();
  });

  it("setItem con QuotaExceededError: la marca vale en esta sesión", () => {
    const storage: FakeStorage = {
      getItem: () => null,
      setItem: () => {
        throw domException("QuotaExceededError");
      },
    };
    const store = createFlagStore(() => storage);
    expect(() => markTutorialSeen("uid-a", store)).not.toThrow();
    expect(hasSeenTutorial("uid-a", store)).toBe(true);
  });

  it("getItem que lanza: se lee como no visto, sin excepción", () => {
    const storage: FakeStorage = {
      getItem: () => {
        throw domException("SecurityError");
      },
      setItem: () => undefined,
    };
    const store = createFlagStore(() => storage);
    expect(hasSeenTutorial("uid-a", store)).toBe(false);
    markTutorialSeen("uid-a", store);
    expect(hasSeenTutorial("uid-a", store)).toBe(true);
  });

  it("sin almacenamiento (servidor o null): funciona solo en memoria", () => {
    const store = createFlagStore(() => null);
    expect(hasSeenTutorial("uid-a", store)).toBe(false);
    markTutorialSeen("uid-a", store);
    expect(hasSeenTutorial("uid-a", store)).toBe(true);
  });

  it("el almacén por defecto no lanza en Node (sin window)", () => {
    expect(() => hasSeenTutorial("uid-node")).not.toThrow();
    expect(() => markTutorialSeen("uid-node")).not.toThrow();
    expect(hasSeenTutorial("uid-node")).toBe(true);
  });
});
