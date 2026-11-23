import { describe, expect, it } from "vitest";
import { EXAMPLE_QUESTS, shouldSeedExamples } from "./exampleQuests";
import { DIFFICULTIES, validateQuestInput } from "./quests";

describe("EXAMPLE_QUESTS", () => {
  it("son las 4 misiones de DESIGN_DIRECTION.md, literales y en orden", () => {
    expect(EXAMPLE_QUESTS).toEqual([
      {
        title: "Marca esta misión como completada",
        description: "Pulsa Completar y mira cómo avanza tu ruta.",
        difficulty: "easy",
      },
      {
        title: "Edita esta misión y hazla tuya",
        description: "Cambia el título, las notas o el terreno.",
        difficulty: "easy",
      },
      {
        title: "Planifica tres objetivos para esta semana",
        description: "Crea una misión por cada uno desde Nueva misión.",
        difficulty: "medium",
      },
      {
        title: "Termina ese proyecto que llevas tiempo aplazando",
        description: "Las cumbres valen 50 XP. Elige una de verdad.",
        difficulty: "hard",
      },
    ]);
  });

  it("terrenos Sendero, Sendero, Ladera y Cumbre (easy, easy, medium, hard)", () => {
    expect(EXAMPLE_QUESTS.map((quest) => quest.difficulty)).toEqual(["easy", "easy", "medium", "hard"]);
    for (const quest of EXAMPLE_QUESTS) expect(DIFFICULTIES).toContain(quest.difficulty);
  });

  it("todas pasan validateQuestInput sin cambios (las reglas también las aceptan)", () => {
    for (const quest of EXAMPLE_QUESTS) {
      const result = validateQuestInput(quest);
      expect(result).toEqual({ ok: true, value: quest });
    }
  });

  it("solo llevan título, descripción y terreno (el resto lo pone createQuest)", () => {
    for (const quest of EXAMPLE_QUESTS) {
      expect(Object.keys(quest).sort()).toEqual(["description", "difficulty", "title"]);
    }
  });

  it("títulos distintos y lista inmutable", () => {
    expect(new Set(EXAMPLE_QUESTS.map((quest) => quest.title)).size).toBe(4);
    expect(Object.isFrozen(EXAMPLE_QUESTS)).toBe(true);
    for (const quest of EXAMPLE_QUESTS) expect(Object.isFrozen(quest)).toBe(true);
  });
});

describe("shouldSeedExamples", () => {
  it("siembra solo si isNewUser es exactamente true", () => {
    expect(shouldSeedExamples({ isNewUser: true })).toBe(true);
    expect(shouldSeedExamples({ isNewUser: false })).toBe(false);
    expect(shouldSeedExamples({ isNewUser: undefined })).toBe(false);
    expect(shouldSeedExamples({})).toBe(false);
  });

  it("sin información adicional (null o undefined) no siembra", () => {
    expect(shouldSeedExamples(null)).toBe(false);
    expect(shouldSeedExamples(undefined)).toBe(false);
  });
});
