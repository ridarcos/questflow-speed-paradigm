import { describe, expect, it } from "vitest";
import {
  authErrorCode,
  GENERIC_AUTH_ERROR,
  isValidEmail,
  translateAuthError,
  validateCredentials,
} from "./authErrors";

describe("validateCredentials", () => {
  it("acepta email válido y contraseña de 6 caracteres", () => {
    expect(validateCredentials("ana@example.com", "123456")).toEqual({});
  });
  it("exige email", () => {
    expect(validateCredentials("  ", "123456").email).toBeDefined();
  });
  it("rechaza emails con formato inválido", () => {
    for (const email of ["ana", "ana@", "ana@dominio", "a b@c.com", "@c.com"]) {
      expect(isValidEmail(email)).toBe(false);
      expect(validateCredentials(email, "123456").email).toBeDefined();
    }
  });
  it("rechaza contraseñas de menos de 6 caracteres", () => {
    expect(validateCredentials("ana@example.com", "12345").password).toMatch(/6/);
    expect(validateCredentials("ana@example.com", "").password).toBeDefined();
  });
});

describe("translateAuthError", () => {
  const cases: Record<string, RegExp> = {
    "auth/invalid-credential": /incorrectos/,
    "auth/email-already-in-use": /Ya existe una cuenta/,
    "auth/weak-password": /débil/,
    "auth/popup-closed-by-user": /cerrado la ventana/,
    "auth/too-many-requests": /Demasiados intentos/,
    "auth/network-request-failed": /conexión/,
    "auth/popup-blocked": /bloqueó/,
    "auth/unauthorized-domain": /dominio/,
  };
  for (const [code, pattern] of Object.entries(cases)) {
    it(`traduce ${code}`, () => {
      expect(translateAuthError({ code })).toMatch(pattern);
    });
  }
  it("usa un mensaje genérico para códigos desconocidos o errores sin código", () => {
    expect(translateAuthError({ code: "auth/whatever" })).toBe(GENERIC_AUTH_ERROR);
    expect(translateAuthError(new Error("x"))).toBe(GENERIC_AUTH_ERROR);
    expect(translateAuthError(null)).toBe(GENERIC_AUTH_ERROR);
  });
  it("authErrorCode extrae el código", () => {
    expect(authErrorCode({ code: "auth/x" })).toBe("auth/x");
    expect(authErrorCode("auth/x")).toBeNull();
  });
});
