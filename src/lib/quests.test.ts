import { describe, expect, it } from "vitest";
import { DIFFICULTIES, XP_BY_DIFFICULTY, isDifficulty, xpFor } from "./quests";

describe("xpFor", () => {
  it("asigna 10 / 25 / 50 XP a easy / medium / hard", () => {
    expect(xpFor("easy")).toBe(10);
    expect(xpFor("medium")).toBe(25);
    expect(xpFor("hard")).toBe(50);
  });

  it("XP_BY_DIFFICULTY cubre exactamente las dificultades permitidas", () => {
    expect(Object.keys(XP_BY_DIFFICULTY).sort()).toEqual([...DIFFICULTIES].sort());
  });
});

describe("isDifficulty", () => {
  it("acepta solo valores en minúscula de la lista", () => {
    expect(isDifficulty("easy")).toBe(true);
    expect(isDifficulty("Hard")).toBe(false);
    expect(isDifficulty("extreme")).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
  });
});
