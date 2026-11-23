import type { Timestamp } from "firebase/firestore";

/** Dificultades permitidas (coinciden exactamente con firestore.rules). */
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** XP por dificultad: easy 10, medium 25, hard 50. */
export const XP_BY_DIFFICULTY: Readonly<Record<Difficulty, number>> = Object.freeze({
  easy: 10,
  medium: 25,
  hard: 50,
});

export const TITLE_MAX_LENGTH = 80;
export const DESCRIPTION_MAX_LENGTH = 280;

/** Documento en /users/{uid}/quests/{questId}. */
export interface Quest {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  completed: boolean;
  /** null mientras serverTimestamp() está pendiente de confirmar. */
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/** XP que otorga una misión de la dificultad indicada. */
export function xpFor(difficulty: Difficulty): number {
  return XP_BY_DIFFICULTY[difficulty];
}
