import { describe, expect, it } from "vitest";
import { withoutError, withRedirectError, withUser, type AuthState } from "./authState";

type U = { uid: string };
const signedOut: AuthState<U> = { status: "signed-out", user: null, error: null };

describe("authState", () => {
  it("un error de redirect que llega después de mostrar el acceso queda en el estado", () => {
    const next = withRedirectError(signedOut, "Ventana cerrada");
    expect(next).toEqual({ status: "signed-out", user: null, error: "Ventana cerrada" });
  });

  it("sin sesión se conserva el error; con sesión se limpia", () => {
    const withError = withRedirectError(signedOut, "x");
    expect(withUser(withError, null).error).toBe("x");
    const signedIn = withUser(withError, { uid: "u1" });
    expect(signedIn).toEqual({ status: "signed-in", user: { uid: "u1" }, error: null });
  });

  it("cerrar sesión tras un error no lo arrastra a la pantalla de acceso", () => {
    const signedIn = withUser(withRedirectError(signedOut, "x"), { uid: "u1" });
    const afterSignOut = withUser(withoutError(signedIn), null);
    expect(afterSignOut.error).toBeNull();
    expect(afterSignOut.status).toBe("signed-out");
  });

  it("withoutError limpia el error y conserva el resto", () => {
    const state = withRedirectError(signedOut, "x");
    expect(withoutError(state)).toEqual(signedOut);
    expect(withoutError(signedOut)).toBe(signedOut);
  });
});
