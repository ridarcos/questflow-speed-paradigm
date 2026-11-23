/**
 * Avisos de escrituras rechazadas por el servidor después de liberar la UI
 * (QA-008, AC-26). Lógica pura: el Dashboard guarda una lista de avisos que se
 * acumulan (un rechazo no sobrescribe a otro) y cada aviso nombra la misión y
 * el cambio perdido.
 */

import type { QuestInput } from "./quests";

export type LateWrite =
  | { kind: "create"; value: QuestInput }
  | { kind: "update"; title: string; newTitle: string }
  | { kind: "toggle"; title: string; completed: boolean }
  | { kind: "delete"; title: string };

export interface SyncNotice {
  id: number;
  message: string;
  /** Datos de una creación rechazada que se pueden devolver al formulario. */
  restore?: QuestInput;
}

/** Máximo de avisos visibles; los más antiguos se descartan. */
export const MAX_SYNC_NOTICES = 5;

/** Frase que describe qué cambio se ha perdido, nombrando la misión. */
export function describeLostWrite(write: LateWrite): string {
  switch (write.kind) {
    case "create":
      return `No se pudo guardar la misión «${write.value.title}» y se ha retirado de la lista.`;
    case "update":
      return write.newTitle !== write.title
        ? `No se pudo guardar el cambio de «${write.title}» a «${write.newTitle}»; se ha revertido.`
        : `No se pudieron guardar los cambios en «${write.title}»; se han revertido.`;
    case "toggle":
      return `No se pudo marcar «${write.title}» como ${write.completed ? "completada" : "activa"}; se ha revertido.`;
    case "delete":
      return `No se pudo eliminar «${write.title}»; se ha restaurado.`;
  }
}

/** Crea el aviso de un rechazo tardío. `reason` es el error ya traducido. */
export function lateErrorNotice(id: number, write: LateWrite, reason: string): SyncNotice {
  return {
    id,
    message: `${describeLostWrite(write)} ${reason}`,
    ...(write.kind === "create" ? { restore: write.value } : {}),
  };
}

/** Añade un aviso al final conservando los anteriores (máximo `max`). */
export function addNotice(list: readonly SyncNotice[], notice: SyncNotice, max = MAX_SYNC_NOTICES): SyncNotice[] {
  return [...list, notice].slice(-max);
}

export function removeNotice(list: readonly SyncNotice[], id: number): SyncNotice[] {
  return list.filter((n) => n.id !== id);
}

/**
 * Texto de éxito cuando la escritura sigue pendiente de confirmación. Solo
 * afirma que no hay conexión si el navegador lo indica (`online === false`).
 */
export function queuedSuccessMessage(base: string, online: boolean): string {
  return online
    ? `${base} Guardada en este dispositivo; pendiente de confirmar por el servidor.`
    : `${base} Se guardó en este dispositivo y se sincronizará al recuperar la conexión.`;
}
