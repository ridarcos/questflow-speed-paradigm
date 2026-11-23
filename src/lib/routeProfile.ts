import type { Difficulty } from "./quests";

/**
 * Geometría pura del perfil de ruta (AC-55). El componente RouteProfile solo
 * dibuja lo que devuelve esta función, así que todo lo que se puede romper
 * (orden, NaN, hitos fuera del viewBox, extremo del tramo recorrido) se prueba
 * aquí sin navegador.
 *
 * Idea: cada misión es un hito sobre una línea de cresta que va de izquierda a
 * derecha por fecha de creación. La altura del hito depende del terreno
 * (Sendero bajo, Ladera media, Cumbre alta) más una subida suave a lo largo de
 * la ruta. Entre dos hitos hay un collado, así que la línea sube y baja como
 * un perfil de montaña real.
 */

export interface ProfileQuest {
  id: string;
  difficulty: Difficulty;
  completed: boolean;
  /** null mientras serverTimestamp() está pendiente: cuenta como la más reciente. */
  createdAt: { toMillis(): number } | null;
}

/**
 * Cómo se dibuja un hito (AC-70). Un completado nunca se distingue de un
 * activo solo por el color, tenga el radio que tenga:
 * - `ring`: activo. Anillo hueco: surface dentro y borde del color de su terreno.
 * - `check`: completado con sitio para el check. Disco de marker, borde contour
 *   y check on-marker (7.91:1 sobre marker).
 * - `dot`: completado donde el check ya no cabe. Disco de marker, borde contour
 *   y un núcleo relleno on-marker, como el check (14.11:1 frente a surface y
 *   7.91:1 sobre marker), porque en claro marker solo da 1.78:1 y el hito
 *   parecería hueco. En oscuro el núcleo se oculta: on-marker apenas da 1.08:1
 *   frente a surface y marker ya da 8.52:1, así que el disco entero se lee relleno.
 */
export type MilestoneShape = "ring" | "check" | "dot";

export interface Milestone {
  id: string;
  x: number;
  y: number;
  r: number;
  completed: boolean;
  difficulty: Difficulty;
  shape: MilestoneShape;
}

export interface RouteProfileGeometry {
  width: number;
  height: number;
  /** Línea de cresta completa (atributo `d`). */
  ridge: string;
  /** Superficie bajo la cresta, cerrada contra el borde inferior. */
  area: string;
  /** Tramo recorrido: desde el inicio hasta el hito completado más reciente por creación. */
  walked: string | null;
  walkedEnd: { x: number; y: number } | null;
  milestones: Milestone[];
  /** Alturas (y) de las curvas de nivel decorativas. */
  levels: number[];
  /** Tramos que se dibujan de esas curvas: cortados alrededor de cada hito (QA-015). */
  levelSegments: LevelSegment[];
}

/** Tramo horizontal de una curva de nivel, de x1 a x2 (x1 < x2). */
export interface LevelSegment {
  y: number;
  x1: number;
  x2: number;
}

export interface ProfileSize {
  width: number;
  height: number;
}

export const DEFAULT_PROFILE_SIZE: Readonly<ProfileSize> = Object.freeze({ width: 640, height: 140 });

/** Altura relativa del hito según el terreno. */
const TERRAIN_HEIGHT: Readonly<Record<Difficulty, number>> = Object.freeze({
  easy: 0.22,
  medium: 0.56,
  hard: 1,
});

const MIN_RADIUS = 2.5;
const MAX_RADIUS = 7;

/** Grosor del borde de un hito activo (anillo de terreno), en px. */
export const RING_STROKE = 1.75;
/** Grosor del borde contour de un hito completado, en px. */
export const DONE_STROKE = 2;
/** Grosor del trazo del check, en px. */
export const CHECK_STROKE = 1.6;

/** Vértices del check en unidades de radio, respecto al centro del hito. */
const CHECK_POINTS: readonly (readonly [number, number])[] = [
  [-0.42, 0.02],
  [-0.1, 0.34],
  [0.44, -0.3],
];

/**
 * Radio desde el que se dibuja el check (AC-70). Con su trazo, el check llega a
 * 0.5325·r + CHECK_STROKE / 2 del centro y tiene que quedar dentro del disco de
 * marker que deja libre el borde (r − DONE_STROKE / 2): eso pide r ≥ 3.85. Por
 * debajo, el completado lleva un núcleo relleno en lugar del check.
 */
export const CHECK_MIN_RADIUS = 4;

export function milestoneShape(completed: boolean, r: number): MilestoneShape {
  if (!completed) return "ring";
  return r >= CHECK_MIN_RADIUS ? "check" : "dot";
}

/** Trazo del check centrado en el hito (atributo `d`). */
export function checkPath({ x, y, r }: Pick<Milestone, "x" | "y" | "r">): string {
  return CHECK_POINTS.map(([dx, dy], i) => `${i === 0 ? "M" : "L"}${round(x + dx * r)} ${round(y + dy * r)}`).join(" ");
}

/**
 * Radio del núcleo de un completado sin check: la mitad del disco de marker que
 * deja libre el borde, y nunca menos de 0,75 px. Así queda un anillo de marker
 * tan ancho como el radio del núcleo (0,75 px con el radio mínimo, 1,5 px justo
 * antes de que quepa el check) y, a 1x, el píxel central sigue por encima de
 * 4:1 frente a surface aunque el núcleo solo lo cubra en parte (4.17:1 medido).
 */
export function dotRadius(r: number): number {
  return round(Math.max(0.75, (r - DONE_STROKE / 2) / 2));
}

/**
 * Holgura de las curvas de nivel alrededor de cada hito, sumada a su radio
 * (QA-015). Cubre medio contorno del hito (hasta 1 px), medio trazo de la
 * curva (0,5 px) y deja 3 px de relieve limpio, también con el antialias. Así
 * el contorno solo linda con el relieve o con surface (en claro, Sendero 3.81:1
 * y 4.20:1) y nunca con una curva de nivel, donde Sendero bajaba a 2.91:1.
 */
export const LEVEL_CLEARANCE = 4.5;

/** Un tramo más corto que esto no se dibuja: sería una mota entre dos hitos. */
const MIN_LEVEL_SEGMENT = 2;

interface Point {
  x: number;
  y: number;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function millis(value: ProfileQuest["createdAt"]): number | null {
  if (!value) return null;
  const ms = value.toMillis();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Orden del perfil: `createdAt` ascendente (la más antigua a la izquierda).
 * Las pendientes (`null`) van al final, como las más recientes. Los empates
 * invierten el orden de entrada, porque la lista llega ordenada al revés
 * (`createdAt desc`) y el perfil es su reflejo exacto.
 */
export function orderForProfile<T extends Pick<ProfileQuest, "createdAt">>(quests: readonly T[]): T[] {
  return quests
    .map((quest, index) => ({ quest, index, time: millis(quest.createdAt) }))
    .sort((a, b) => {
      if (a.time === null || b.time === null) {
        if (a.time === b.time) return b.index - a.index;
        return a.time === null ? 1 : -1;
      }
      return a.time - b.time || b.index - a.index;
    })
    .map((entry) => entry.quest);
}

/**
 * Tangentes de una interpolación cúbica monótona (Fritsch–Butland): la curva
 * nunca se sale del rango vertical de sus puntos, así que no sobrepasa el viewBox.
 */
function monotoneTangents(points: readonly Point[]): number[] {
  const n = points.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    slopes.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }
  const tangents: number[] = new Array(n).fill(0);
  if (n < 2) return tangents;
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const s0 = slopes[i - 1];
    const s1 = slopes[i];
    if (s0 * s1 <= 0) {
      tangents[i] = 0;
      continue;
    }
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    tangents[i] = (3 * (h0 + h1)) / ((2 * h1 + h0) / s0 + (h1 + 2 * h0) / s1);
  }
  return tangents;
}

/** Segmentos cúbicos ("C ...") entre puntos consecutivos. */
function cubicSegments(points: readonly Point[]): string[] {
  const tangents = monotoneTangents(points);
  const segments: string[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const h = (b.x - a.x) / 3;
    segments.push(
      `C${round(a.x + h)} ${round(a.y + tangents[i] * h)} ${round(b.x - h)} ${round(b.y - tangents[i + 1] * h)} ${round(b.x)} ${round(b.y)}`,
    );
  }
  return segments;
}

/**
 * Tramos de la curva de nivel horizontal `y` (de 0 a `width`) que quedan a
 * `r + LEVEL_CLEARANCE` o más del centro de cada hito, como las curvas que un
 * mapa interrumpe alrededor de sus símbolos. Los extremos se redondean hacia
 * dentro del tramo, así que el redondeo nunca acerca la curva a un hito.
 */
export function levelSegments(
  y: number,
  width: number,
  milestones: readonly Pick<Milestone, "x" | "y" | "r">[],
): LevelSegment[] {
  const gaps = milestones
    .flatMap((m) => {
      const reach = m.r + LEVEL_CLEARANCE;
      const dy = Math.abs(y - m.y);
      if (!(dy < reach)) return [];
      const half = Math.sqrt(reach * reach - dy * dy);
      return [{ from: m.x - half, to: m.x + half }];
    })
    .sort((a, b) => a.from - b.from);

  const segments: LevelSegment[] = [];
  const push = (from: number, to: number) => {
    const x1 = Math.ceil(from * 100) / 100;
    const x2 = Math.floor(to * 100) / 100;
    if (x2 - x1 >= MIN_LEVEL_SEGMENT) segments.push({ y, x1, x2 });
  };
  let cursor = 0;
  for (const gap of gaps) {
    if (gap.from > cursor) push(cursor, gap.from);
    cursor = Math.max(cursor, gap.to);
  }
  if (cursor < width) push(cursor, width);
  return segments;
}

export function computeRouteProfile(
  quests: readonly ProfileQuest[],
  size: ProfileSize = DEFAULT_PROFILE_SIZE,
): RouteProfileGeometry {
  const width = Math.max(120, finiteOr(size.width, DEFAULT_PROFILE_SIZE.width));
  const height = Math.max(64, finiteOr(size.height, DEFAULT_PROFILE_SIZE.height));
  const ordered = orderForProfile(quests);
  const count = ordered.length;

  const spacing = width / (count + 1);
  const r = round(clamp(spacing * 0.3, MIN_RADIUS, MAX_RADIUS));
  // Margen para el radio y el trazo del hito: nada sale del viewBox.
  const top = r + 6;
  const bottom = height - 10;
  const span = bottom - top;
  const yAt = (elevation: number) => round(bottom - clamp(elevation, 0, 1) * span);

  const elevations = ordered.map((quest, index) => {
    const climb = count === 1 ? 0.5 : index / (count - 1);
    return 0.1 + 0.6 * TERRAIN_HEIGHT[quest.difficulty] + 0.3 * climb;
  });

  const milestones: Milestone[] = ordered.map((quest, index) => ({
    id: quest.id,
    x: round(spacing * (index + 1)),
    y: yAt(elevations[index]),
    r,
    completed: quest.completed,
    difficulty: quest.difficulty,
    shape: milestoneShape(quest.completed, r),
  }));

  // Puntos de la cresta: inicio, (hito, collado)*, final.
  const points: Point[] = [{ x: 0, y: yAt(0.06) }];
  const milestonePointIndex: number[] = [];
  const dip = clamp(spacing * 0.18, 0, span * 0.22);
  milestones.forEach((milestone, index) => {
    milestonePointIndex.push(points.length);
    points.push({ x: milestone.x, y: milestone.y });
    const next = milestones[index + 1];
    if (next) {
      points.push({
        x: round((milestone.x + next.x) / 2),
        y: round(Math.min(bottom - 2, Math.max(milestone.y, next.y) + dip)),
      });
    }
  });
  if (count === 0) {
    points.push({ x: round(width * 0.55), y: yAt(0.24) });
    points.push({ x: width, y: yAt(0.12) });
  } else {
    points.push({ x: width, y: yAt(Math.max(0.06, elevations[count - 1] - 0.22)) });
  }

  const segments = cubicSegments(points);
  const start = `M${round(points[0].x)} ${round(points[0].y)}`;
  const ridge = `${start} ${segments.join(" ")}`;
  const area = `${ridge} L${width} ${height} L0 ${height} Z`;

  // Tramo recorrido: hasta el completado más reciente por fecha de creación.
  let lastCompleted = -1;
  milestones.forEach((milestone, index) => {
    if (milestone.completed) lastCompleted = index;
  });
  const walkedEnd = lastCompleted >= 0 ? { x: milestones[lastCompleted].x, y: milestones[lastCompleted].y } : null;
  const walked =
    lastCompleted >= 0 ? `${start} ${segments.slice(0, milestonePointIndex[lastCompleted]).join(" ")}` : null;
  const levels = [0.3, 0.55, 0.8].map(yAt);

  return {
    width,
    height,
    ridge,
    area,
    walked,
    walkedEnd,
    milestones,
    levels,
    levelSegments: levels.flatMap((level) => levelSegments(level, width, milestones)),
  };
}

/** Texto accesible del perfil (AC-55): exactamente "N de M misiones completadas, X XP". */
export function routeProfileLabel(completed: number, total: number, xp: number): string {
  const safe = (value: number) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
  return `${safe(completed)} de ${safe(total)} misiones completadas, ${safe(xp)} XP`;
}
