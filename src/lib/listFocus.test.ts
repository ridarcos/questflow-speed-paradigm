import { describe, expect, it } from "vitest";
import { focusTargetAfterRemoval } from "./listFocus";

describe("focusTargetAfterRemoval", () => {
  it("elige la siguiente misión", () => {
    expect(focusTargetAfterRemoval(["a", "b", "c"], "a")).toBe("b");
    expect(focusTargetAfterRemoval(["a", "b", "c"], "b")).toBe("c");
  });

  it("elige la anterior si se borró la última", () => {
    expect(focusTargetAfterRemoval(["a", "b", "c"], "c")).toBe("b");
  });

  it("devuelve null si la lista queda vacía", () => {
    expect(focusTargetAfterRemoval(["a"], "a")).toBeNull();
    expect(focusTargetAfterRemoval([], "a")).toBeNull();
  });

  it("si el id no está en la lista, elige la primera", () => {
    expect(focusTargetAfterRemoval(["a", "b"], "z")).toBe("a");
  });
});
