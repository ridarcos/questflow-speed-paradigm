import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_WRITE_WINDOW_MS, runWrite } from "./writes";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runWrite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve confirmed si el servidor confirma dentro de la ventana", async () => {
    const onLate = vi.fn();
    await expect(runWrite(Promise.resolve("id"), onLate)).resolves.toBe("confirmed");
    expect(onLate).not.toHaveBeenCalled();
  });

  it("propaga el error si el servidor rechaza dentro de la ventana", async () => {
    const onLate = vi.fn();
    const error = { code: "permission-denied" };
    await expect(runWrite(Promise.reject(error), onLate)).rejects.toBe(error);
    expect(onLate).not.toHaveBeenCalled();
  });

  it("devuelve queued si la escritura sigue pendiente (sin conexión) y no se cuelga", async () => {
    const write = deferred();
    const onLate = vi.fn();
    const result = runWrite(write.promise, onLate);
    await vi.advanceTimersByTimeAsync(LOCAL_WRITE_WINDOW_MS);
    await expect(result).resolves.toBe("queued");
    // Confirmación tardía: sin error.
    write.resolve();
    await vi.runAllTimersAsync();
    expect(onLate).not.toHaveBeenCalled();
  });

  it("notifica con onLateError un rechazo que llega después de la ventana", async () => {
    const write = deferred();
    const onLate = vi.fn();
    const result = runWrite(write.promise, onLate, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe("queued");
    const error = { code: "permission-denied" };
    write.reject(error);
    await vi.runAllTimersAsync();
    expect(onLate).toHaveBeenCalledWith(error);
  });

  it("no deja temporizadores colgados tras confirmar", async () => {
    await runWrite(Promise.resolve(), vi.fn());
    expect(vi.getTimerCount()).toBe(0);
  });
});
