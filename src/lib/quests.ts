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
  /**
   * Solo cliente (no es un campo de Firestore): true mientras la caché local
   * tiene escrituras de este documento sin confirmar por el servidor.
   */
  pendingSync?: boolean;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/** XP que otorga una misión de la dificultad indicada. */
export function xpFor(difficulty: Difficulty): number {
  return XP_BY_DIFFICULTY[difficulty];
}

/* ------------------------------------------------------------------ */
/* Validación compartida con firestore.rules                           */
/* ------------------------------------------------------------------ */

export interface QuestInput {
  title: string;
  description: string;
  difficulty: Difficulty;
}

export interface QuestDraft {
  title: string;
  description?: string;
  difficulty: string;
}

export type QuestValidationErrors = Partial<Record<keyof QuestInput, string>>;

export type QuestValidationResult =
  | { ok: true; value: QuestInput }
  | { ok: false; errors: QuestValidationErrors };

/**
 * Valida y normaliza un borrador de misión. Es más estricta que las reglas
 * (trim con espacios Unicode y longitud en unidades UTF-16), así que todo lo que
 * acepta también lo aceptan las reglas de Firestore.
 */
export function validateQuestInput(draft: QuestDraft): QuestValidationResult {
  const title = (draft.title ?? "").trim();
  const description = (draft.description ?? "").trim();
  const errors: QuestValidationErrors = {};

  if (title.length === 0) {
    errors.title = "El título es obligatorio.";
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `El título no puede superar ${TITLE_MAX_LENGTH} caracteres.`;
  }
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `La descripción no puede superar ${DESCRIPTION_MAX_LENGTH} caracteres.`;
  }
  if (!isDifficulty(draft.difficulty)) {
    errors.difficulty = "Elige una dificultad válida.";
  }

  if (Object.keys(errors).length > 0 || !isDifficulty(draft.difficulty)) {
    return { ok: false, errors };
  }
  return { ok: true, value: { title, description, difficulty: draft.difficulty } };
}

/* ------------------------------------------------------------------ */
/* Filtros y estadísticas                                              */
/* ------------------------------------------------------------------ */

export const QUEST_FILTERS = ["all", "active", "completed"] as const;
export type QuestFilter = (typeof QUEST_FILTERS)[number];

export function filterQuests<T extends Pick<Quest, "completed">>(
  quests: readonly T[],
  filter: QuestFilter,
): T[] {
  switch (filter) {
    case "active":
      return quests.filter((quest) => !quest.completed);
    case "completed":
      return quests.filter((quest) => quest.completed);
    default:
      return [...quests];
  }
}

export interface QuestStats {
  total: number;
  completed: number;
  active: number;
  /** XP de las misiones completadas. */
  xpEarned: number;
  /** XP de todas las misiones (completadas o no). */
  xpAvailable: number;
  /** Porcentaje entero 0–100; 0 si no hay misiones (nunca NaN). */
  progressPercent: number;
}

export function computeStats(
  quests: readonly Pick<Quest, "completed" | "difficulty">[],
): QuestStats {
  let completed = 0;
  let xpEarned = 0;
  let xpAvailable = 0;
  for (const quest of quests) {
    const xp = isDifficulty(quest.difficulty) ? xpFor(quest.difficulty) : 0;
    xpAvailable += xp;
    if (quest.completed) {
      completed += 1;
      xpEarned += xp;
    }
  }
  const total = quests.length;
  const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, active: total - completed, xpEarned, xpAvailable, progressPercent };
}

/* ------------------------------------------------------------------ */
/* Mapeo null-safe desde Firestore                                     */
/* ------------------------------------------------------------------ */

function asTimestamp(value: unknown): Timestamp | null {
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return value as Timestamp;
  }
  return null;
}

/**
 * Convierte los datos de un documento en Quest sin lanzar nunca: campos ausentes,
 * timestamps pendientes (null) o tipos inesperados reciben valores seguros.
 */
export function toQuest(id: string, data: Record<string, unknown> | undefined): Quest {
  const source = data ?? {};
  return {
    id,
    title: typeof source.title === "string" ? source.title : "",
    description: typeof source.description === "string" ? source.description : "",
    difficulty: isDifficulty(source.difficulty) ? source.difficulty : "easy",
    completed: source.completed === true,
    createdAt: asTimestamp(source.createdAt),
    updatedAt: asTimestamp(source.updatedAt),
  };
}

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = Object.freeze({
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
});

export const FILTER_LABELS: Readonly<Record<QuestFilter, string>> = Object.freeze({
  all: "Todas",
  active: "Activas",
  completed: "Completadas",
});

/* ------------------------------------------------------------------ */
/* Niveles y contadores (presentación)                                 */
/* ------------------------------------------------------------------ */

export const XP_PER_LEVEL = 100;

export interface LevelProgress {
  /** Nivel actual, empieza en 1. */
  level: number;
  /** XP acumulada dentro del nivel actual. */
  xpIntoLevel: number;
  /** XP que faltan para el siguiente nivel. */
  xpToNext: number;
  /** Porcentaje entero 0–99 del nivel actual (nunca NaN). */
  percent: number;
}

/** Nivel según la XP ganada: cada XP_PER_LEVEL XP se sube un nivel. */
export function levelFromXp(xp: number, perLevel: number = XP_PER_LEVEL): LevelProgress {
  const safeXp = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  const step = Number.isFinite(perLevel) && perLevel > 0 ? Math.floor(perLevel) : XP_PER_LEVEL;
  const xpIntoLevel = safeXp % step;
  return {
    level: Math.floor(safeXp / step) + 1,
    xpIntoLevel,
    xpToNext: step - xpIntoLevel,
    percent: Math.floor((xpIntoLevel / step) * 100),
  };
}

export type CharCountTone = "ok" | "near" | "limit";

/** Tono del contador de caracteres: "near" desde el 90 % del máximo, "limit" al alcanzarlo. */
export function charCountTone(length: number, max: number): CharCountTone {
  if (length >= max) return "limit";
  if (length >= Math.ceil(max * 0.9)) return "near";
  return "ok";
}
