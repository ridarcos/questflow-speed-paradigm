import { describe, expect, it } from "vitest";
import {
  computeStats,
  DESCRIPTION_MAX_LENGTH,
  filterQuests,
  TITLE_MAX_LENGTH,
  toQuest,
  validateQuestInput,
  type Quest,
} from "./quests";

function quest(partial: Partial<Quest>): Quest {
  return {
    id: partial.id ?? "q",
    title: "t",
    description: "",
    difficulty: "easy",
    completed: false,
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe("validateQuestInput", () => {
  it("normaliza con trim y acepta una misión válida", () => {
    expect(
      validateQuestInput({ title: "  Leer  ", description: "  libro ", difficulty: "hard" }),
    ).toEqual({ ok: true, value: { title: "Leer", description: "libro", difficulty: "hard" } });
  });

  it("usa descripción vacía por defecto", () => {
    const result = validateQuestInput({ title: "A", difficulty: "easy" });
    expect(result).toEqual({ ok: true, value: { title: "A", description: "", difficulty: "easy" } });
  });

  it("rechaza título vacío o solo con espacios (incluidos Unicode)", () => {
    for (const title of ["", "   ", "\t\n", "  "]) {
      const result = validateQuestInput({ title, description: "", difficulty: "easy" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.title).toBeDefined();
    }
  });

  it("acepta 80 caracteres y rechaza 81", () => {
    expect(validateQuestInput({ title: "a".repeat(TITLE_MAX_LENGTH), difficulty: "easy" }).ok).toBe(true);
    const result = validateQuestInput({ title: "a".repeat(TITLE_MAX_LENGTH + 1), difficulty: "easy" });
    expect(result.ok).toBe(false);
  });

  it("acepta descripción de 280 y rechaza 281", () => {
    expect(
      validateQuestInput({ title: "a", description: "d".repeat(DESCRIPTION_MAX_LENGTH), difficulty: "easy" }).ok,
    ).toBe(true);
    const result = validateQuestInput({
      title: "a",
      description: "d".repeat(DESCRIPTION_MAX_LENGTH + 1),
      difficulty: "easy",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.description).toBeDefined();
  });

  it("rechaza dificultades fuera de la lista o en mayúscula", () => {
    for (const difficulty of ["Easy", "HARD", "legendary", ""]) {
      const result = validateQuestInput({ title: "a", difficulty });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.difficulty).toBeDefined();
    }
  });
});

describe("filterQuests", () => {
  const list = [quest({ id: "1", completed: false }), quest({ id: "2", completed: true }), quest({ id: "3" })];

  it("all devuelve todas en el mismo orden", () => {
    expect(filterQuests(list, "all").map((q) => q.id)).toEqual(["1", "2", "3"]);
  });
  it("active devuelve solo las no completadas", () => {
    expect(filterQuests(list, "active").map((q) => q.id)).toEqual(["1", "3"]);
  });
  it("completed devuelve solo las completadas", () => {
    expect(filterQuests(list, "completed").map((q) => q.id)).toEqual(["2"]);
  });
  it("no muta la lista original", () => {
    const copy = [...list];
    filterQuests(list, "all").pop();
    expect(list).toEqual(copy);
  });
});

describe("computeStats", () => {
  it("con 0 misiones devuelve ceros y 0 % (nunca NaN)", () => {
    const stats = computeStats([]);
    expect(stats).toEqual({ total: 0, completed: 0, active: 0, xpEarned: 0, xpAvailable: 0, progressPercent: 0 });
    expect(Number.isNaN(stats.progressPercent)).toBe(false);
  });

  it("solo suma XP de misiones completadas", () => {
    const stats = computeStats([
      quest({ difficulty: "easy", completed: true }),
      quest({ difficulty: "medium", completed: true }),
      quest({ difficulty: "hard", completed: false }),
    ]);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.xpEarned).toBe(35);
    expect(stats.xpAvailable).toBe(85);
    expect(stats.progressPercent).toBe(67);
  });

  it("100 % cuando todas están completadas", () => {
    expect(computeStats([quest({ completed: true, difficulty: "hard" })]).progressPercent).toBe(100);
  });
});

describe("toQuest", () => {
  it("no rompe con timestamps null (escritura pendiente) ni datos ausentes", () => {
    expect(toQuest("x", { title: "A", createdAt: null, updatedAt: null })).toEqual({
      id: "x",
      title: "A",
      description: "",
      difficulty: "easy",
      completed: false,
      createdAt: null,
      updatedAt: null,
    });
    expect(toQuest("y", undefined).title).toBe("");
  });

  it("conserva timestamps válidos y valores correctos", () => {
    const ts = { toMillis: () => 1, seconds: 0, nanoseconds: 0 };
    const q = toQuest("z", {
      title: "T",
      description: "D",
      difficulty: "hard",
      completed: true,
      createdAt: ts,
      updatedAt: ts,
    });
    expect(q.difficulty).toBe("hard");
    expect(q.completed).toBe(true);
    expect(q.createdAt).toBe(ts);
  });

  it("normaliza tipos inesperados", () => {
    const q = toQuest("w", { title: 5, difficulty: "HARD", completed: "yes", createdAt: "ayer" });
    expect(q).toMatchObject({ title: "", difficulty: "easy", completed: false, createdAt: null });
  });
});
