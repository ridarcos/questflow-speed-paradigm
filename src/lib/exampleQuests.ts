import type { QuestInput } from "./quests";

/**
 * Misiones de ejemplo de una cuenta nueva (docs/DESIGN_DIRECTION.md).
 *
 * Orden determinista: se escriben una tras otra en este orden, cada una
 * después de que el servidor confirme la anterior, así que la primera es la
 * más antigua (`createdAt` menor). El perfil de ruta las dibuja de izquierda a
 * derecha (Sendero, Sendero, Ladera, Cumbre) y la lista, que muestra primero
 * las más recientes, empieza por la Cumbre.
 */
export const EXAMPLE_QUESTS: readonly QuestInput[] = Object.freeze([
  Object.freeze({
    title: "Marca esta misión como completada",
    description: "Pulsa Completar y mira cómo avanza tu ruta.",
    difficulty: "easy",
  }),
  Object.freeze({
    title: "Edita esta misión y hazla tuya",
    description: "Cambia el título, las notas o el terreno.",
    difficulty: "easy",
  }),
  Object.freeze({
    title: "Planifica tres objetivos para esta semana",
    description: "Crea una misión por cada uno desde Nueva misión.",
    difficulty: "medium",
  }),
  Object.freeze({
    title: "Termina ese proyecto que llevas tiempo aplazando",
    description: "Las cumbres valen 50 XP. Elige una de verdad.",
    difficulty: "hard",
  }),
] satisfies QuestInput[]);

/**
 * Decide si hay que sembrar las misiones de ejemplo tras un acceso. Solo
 * cuando Firebase confirma que la cuenta se acaba de crear
 * (`getAdditionalUserInfo(cred)?.isNewUser === true`).
 */
export function shouldSeedExamples(info: { isNewUser?: boolean | null } | null | undefined): boolean {
  return info?.isNewUser === true;
}
