/**
 * Lógica pura del borrador del formulario de misiones (AC-28): decide cuándo se
 * puede vaciar o sustituir lo escrito sin perder texto del usuario.
 */

export interface FormDraft {
  title: string;
  description: string;
  difficulty: string;
}

/** Valores del formulario de creación vacío. */
export const EMPTY_DRAFT: Readonly<FormDraft> = Object.freeze({ title: "", description: "", difficulty: "easy" });

/** true si el borrador tiene texto escrito (título o descripción, ignorando espacios). */
export function draftHasText(draft: Pick<FormDraft, "title" | "description">): boolean {
  return draft.title.trim().length > 0 || draft.description.trim().length > 0;
}

/** true si los dos borradores tienen exactamente los mismos valores. */
export function sameDraft(a: FormDraft, b: FormDraft): boolean {
  return a.title === b.title && a.description === b.description && a.difficulty === b.difficulty;
}

/**
 * QA-009: tras crear, solo se vacía el formulario si el usuario no lo ha tocado
 * desde que pulsó "Crear". Si cambió algo mientras se guardaba, se conserva.
 */
export function shouldResetAfterSubmit(submitted: FormDraft, current: FormDraft): boolean {
  return sameDraft(submitted, current);
}

/**
 * QA-010: restaurar una misión rechazada sustituye el borrador. Hace falta
 * confirmación si hay texto escrito que se perdería (y no es ya lo que se restaura).
 */
export function restoreNeedsConfirmation(current: FormDraft, restore: FormDraft): boolean {
  return draftHasText(current) && !sameDraft(current, restore);
}
