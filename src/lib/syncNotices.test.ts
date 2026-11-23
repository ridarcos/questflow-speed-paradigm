import { describe, expect, it } from "vitest";
import {
  addNotice,
  describeLostWrite,
  lateErrorNotice,
  MAX_SYNC_NOTICES,
  queuedSuccessMessage,
  removeNotice,
  type SyncNotice,
} from "./syncNotices";

const REASON = "Firestore ha denegado la operación: no tienes permiso o los datos no son válidos.";

describe("describeLostWrite", () => {
  it("nombra la misión creada que se perdió", () => {
    expect(describeLostWrite({ kind: "create", value: { title: "Tardia", description: "", difficulty: "easy" } })).toBe(
      "No se pudo guardar la misión «Tardia» y se ha retirado de la lista.",
    );
  });

  it("nombra el título anterior y el nuevo en una edición con cambio de título", () => {
    expect(describeLostWrite({ kind: "update", title: "SinRed", newTitle: "SinRed editada" })).toBe(
      "No se pudo guardar el cambio de «SinRed» a «SinRed editada»; se ha revertido.",
    );
  });

  it("nombra la misión en una edición sin cambio de título", () => {
    expect(describeLostWrite({ kind: "update", title: "SinRed", newTitle: "SinRed" })).toContain("«SinRed»");
  });

  it("describe completar, reabrir y eliminar", () => {
    expect(describeLostWrite({ kind: "toggle", title: "A", completed: true })).toBe(
      "No se pudo marcar «A» como completada; se ha revertido.",
    );
    expect(describeLostWrite({ kind: "toggle", title: "A", completed: false })).toContain("como activa");
    expect(describeLostWrite({ kind: "delete", title: "A" })).toBe("No se pudo eliminar «A»; se ha restaurado.");
  });
});

describe("lateErrorNotice", () => {
  it("incluye el motivo y, en creaciones, los datos para restaurar", () => {
    const value = { title: "Tardia", description: "texto", difficulty: "hard" as const };
    const notice = lateErrorNotice(1, { kind: "create", value }, REASON);
    expect(notice.message).toBe(`No se pudo guardar la misión «Tardia» y se ha retirado de la lista. ${REASON}`);
    expect(notice.restore).toEqual(value);
  });

  it("no ofrece restaurar en ediciones", () => {
    const notice = lateErrorNotice(2, { kind: "update", title: "A", newTitle: "B" }, REASON);
    expect(notice.restore).toBeUndefined();
  });
});

describe("addNotice / removeNotice", () => {
  const n = (id: number): SyncNotice => ({ id, message: `m${id}` });

  it("acumula varios rechazos sin sobrescribir", () => {
    const list = addNotice(addNotice([], n(1)), n(2));
    expect(list.map((x) => x.id)).toEqual([1, 2]);
  });

  it("conserva solo los más recientes al superar el máximo", () => {
    let list: SyncNotice[] = [];
    for (let i = 1; i <= MAX_SYNC_NOTICES + 2; i++) list = addNotice(list, n(i));
    expect(list).toHaveLength(MAX_SYNC_NOTICES);
    expect(list[0].id).toBe(3);
    expect(list.at(-1)?.id).toBe(MAX_SYNC_NOTICES + 2);
  });

  it("no muta la lista original y elimina por id", () => {
    const original = [n(1), n(2)];
    expect(removeNotice(original, 1)).toEqual([n(2)]);
    expect(original).toHaveLength(2);
  });
});

describe("queuedSuccessMessage", () => {
  it("con conexión no afirma estar sin conexión", () => {
    const text = queuedSuccessMessage("Misión creada.", true);
    expect(text).toBe("Misión creada. Guardada en este dispositivo; pendiente de confirmar por el servidor.");
    expect(text).not.toMatch(/conexión/);
  });

  it("sin conexión indica que se sincronizará al recuperarla", () => {
    expect(queuedSuccessMessage("Misión creada.", false)).toBe(
      "Misión creada. Se guardó en este dispositivo y se sincronizará al recuperar la conexión.",
    );
  });
});
