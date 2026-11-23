import { describe, expect, it } from "vitest";
import { draftHasText, EMPTY_DRAFT, restoreNeedsConfirmation, sameDraft, shouldResetAfterSubmit } from "./formDraft";

const sent = { title: "Correr", description: "5 km", difficulty: "medium" };

describe("draftHasText", () => {
  it("es false con el formulario vacío o solo con espacios", () => {
    expect(draftHasText(EMPTY_DRAFT)).toBe(false);
    expect(draftHasText({ title: "   ", description: "\n " })).toBe(false);
  });

  it("es true si hay título o descripción", () => {
    expect(draftHasText({ title: "a", description: "" })).toBe(true);
    expect(draftHasText({ title: "", description: "nota" })).toBe(true);
  });
});

describe("sameDraft", () => {
  it("compara título, descripción y dificultad", () => {
    expect(sameDraft(sent, { ...sent })).toBe(true);
    expect(sameDraft(sent, { ...sent, difficulty: "hard" })).toBe(false);
  });
});

describe("shouldResetAfterSubmit (QA-009)", () => {
  it("vacía el formulario si no cambió desde el envío", () => {
    expect(shouldResetAfterSubmit(sent, { ...sent })).toBe(true);
  });

  it("conserva lo escrito durante el envío", () => {
    expect(shouldResetAfterSubmit(sent, { ...sent, title: "Correr 10 km" })).toBe(false);
    expect(shouldResetAfterSubmit(sent, { ...sent, description: "5 km y estirar" })).toBe(false);
    expect(shouldResetAfterSubmit(sent, { ...sent, difficulty: "hard" })).toBe(false);
  });

  it("conserva el formulario si el usuario lo vació a mano durante el envío", () => {
    expect(shouldResetAfterSubmit(sent, { ...EMPTY_DRAFT })).toBe(false);
  });
});

describe("restoreNeedsConfirmation (QA-010)", () => {
  const restore = { title: "Rechazada", description: "texto", difficulty: "hard" };

  it("restaura sin preguntar si el formulario está vacío", () => {
    expect(restoreNeedsConfirmation({ ...EMPTY_DRAFT }, restore)).toBe(false);
    expect(restoreNeedsConfirmation({ title: "  ", description: "", difficulty: "hard" }, restore)).toBe(false);
  });

  it("pide confirmación si hay un borrador con texto distinto", () => {
    expect(restoreNeedsConfirmation({ title: "Borrador", description: "", difficulty: "easy" }, restore)).toBe(true);
    expect(restoreNeedsConfirmation({ title: "", description: "nota", difficulty: "easy" }, restore)).toBe(true);
  });

  it("no pregunta si el borrador ya coincide con lo que se restaura", () => {
    expect(restoreNeedsConfirmation({ ...restore }, restore)).toBe(false);
  });
});
