/**
 * Escrituras en Firestore sin bloquear la interfaz (AC-26).
 *
 * Firestore aplica cada escritura en la caché local al instante (latency
 * compensation) y la promesa de addDoc/updateDoc/deleteDoc solo se resuelve
 * cuando el servidor la confirma. Sin conexión esa promesa puede quedar
 * pendiente indefinidamente, así que la interfaz espera como máximo
 * `windowMs`:
 *
 * - Si el servidor responde antes: "confirmed", o lanza el error (que la UI
 *   muestra junto al control que lo originó).
 * - Si no: "queued". La escritura ya está aplicada en local y se sincronizará
 *   al recuperar la conexión; si el servidor la rechaza más tarde, se llama a
 *   `onLateError` para que la UI lo muestre igualmente.
 */

export const LOCAL_WRITE_WINDOW_MS = 1500;

export type WriteOutcome = "confirmed" | "queued";

const PENDING = Symbol("pending");

export async function runWrite(
  write: Promise<unknown>,
  onLateError: (error: unknown) => void,
  windowMs: number = LOCAL_WRITE_WINDOW_MS,
): Promise<WriteOutcome> {
  const tracked = write.then(() => "confirmed" as const);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof PENDING>((resolve) => {
    timer = setTimeout(() => resolve(PENDING), windowMs);
  });
  try {
    const result = await Promise.race([tracked, timeout]);
    if (result === PENDING) {
      tracked.catch(onLateError);
      return "queued";
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}
