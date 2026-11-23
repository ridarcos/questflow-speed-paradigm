import { describe, expect, it } from "vitest";
import { translateFirestoreError } from "./questsRepo";

describe("translateFirestoreError", () => {
  it("permission-denied no atribuye el fallo a la sesión", () => {
    const message = translateFirestoreError({ code: "permission-denied" });
    expect(message).toMatch(/no tienes permiso o los datos no son válidos/);
    expect(message).not.toMatch(/sesión/i);
  });

  it("unauthenticated sí pide volver a iniciar sesión", () => {
    expect(translateFirestoreError({ code: "unauthenticated" })).toMatch(/Vuelve a iniciar sesión/);
  });
});
