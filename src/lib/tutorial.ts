/**
 * Tutorial de 5 pasos sobre la interfaz real (AC-63 a AC-65). Lógica pura:
 * pasos, navegación y geometría del panel. El componente Tutorial la aplica
 * al DOM.
 */

/** Valor de `data-tour` de cada destino. */
export type TourTarget = "profile" | "new-quest" | "terrain" | "filters" | "quest-card";

export interface TutorialStep {
  target: TourTarget;
  title: string;
  body: string;
  /** Texto cuando el destino no existe o está oculto (sin misiones, formulario plegado...). */
  fallback: string;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = Object.freeze([
  {
    target: "profile",
    title: "Tu ruta",
    body: "Cada misión es un hito, de la más antigua a la más reciente. Al completarla, el hito se rellena, el tramo avanza y su XP se suma a tu total.",
    fallback: "Cada misión es un hito de tu ruta. Al completarla, el hito se rellena y su XP se suma a tu total.",
  },
  {
    target: "new-quest",
    title: "Nueva misión",
    body: "Escribe un título y, si quieres, unas notas. Tus misiones se guardan en tu cuenta y solo tú puedes verlas.",
    fallback: "Desde Nueva misión escribes un título y, si quieres, unas notas. Tus misiones se guardan en tu cuenta y solo tú puedes verlas.",
  },
  {
    target: "terrain",
    title: "Elige el terreno",
    body: "Sendero (10 XP) para tareas de un rato, Ladera (25 XP) para una tarde de esfuerzo y Cumbre (50 XP) para los retos que llevas tiempo aplazando.",
    fallback: "Al desplegar Nueva misión eliges el terreno: Sendero (10 XP) para tareas de un rato, Ladera (25 XP) para una tarde de esfuerzo y Cumbre (50 XP) para los grandes retos.",
  },
  {
    target: "filters",
    title: "Filtra tu lista",
    body: "Cambia entre Todas, Activas y Hechas. El número de cada filtro te dice cuántas misiones tienes en él.",
    fallback: "Con los filtros Todas, Activas y Hechas cambias de vista sin perder ninguna misión.",
  },
  {
    target: "quest-card",
    title: "Completa, edita o elimina",
    body: "Completar suma su XP a tu ruta y Reabrir lo devuelve. Editar cambia el título, las notas o el terreno. Eliminar te pide confirmación antes de borrar.",
    fallback: "Cuando tengas misiones, cada tarjeta tendrá Completar para sumar su XP, Editar para cambiarla y Eliminar, que pide confirmación antes de borrar.",
  },
] satisfies TutorialStep[]);

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

/** Índice válido (0..4); cualquier valor no finito vuelve al primer paso. */
export function clampStep(index: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), TUTORIAL_STEP_COUNT - 1);
}

export function nextStep(index: number): number {
  return clampStep(clampStep(index) + 1);
}

export function previousStep(index: number): number {
  return clampStep(clampStep(index) - 1);
}

export function isFirstStep(index: number): boolean {
  return clampStep(index) === 0;
}

export function isLastStep(index: number): boolean {
  return clampStep(index) === TUTORIAL_STEP_COUNT - 1;
}

/** "Paso N de 5", con N de 1 a 5. */
export function stepLabel(index: number): string {
  return `Paso ${clampStep(index) + 1} de ${TUTORIAL_STEP_COUNT}`;
}

/* ------------------------------------------------------------------ */
/* Geometría                                                          */
/* ------------------------------------------------------------------ */

export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  top: number;
  left: number;
}

export type PanelSide = "below" | "above" | "right" | "left" | "over" | "center";

export interface PanelPlacement {
  top: number;
  left: number;
  side: PanelSide;
}

/** Separación mínima entre el panel y los bordes del viewport. */
export const PANEL_MARGIN = 12;
/** Separación entre el destino resaltado y el panel. */
export const PANEL_GAP = 14;
/** Holgura del anillo alrededor del destino. */
export const RING_OFFSET = 6;

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function intersectsViewport(box: Box, viewport: Size): boolean {
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.left < viewport.width &&
    box.top < viewport.height &&
    box.left + box.width > 0 &&
    box.top + box.height > 0
  );
}

/**
 * Posición del panel junto a su destino: debajo, encima, a la derecha o a la
 * izquierda, en ese orden de preferencia y siempre dentro del viewport. Si no
 * cabe en ningún lado (destino muy alto en móvil), el panel se coloca en la
 * mitad del viewport contraria al destino y lo tapa solo en parte. Sin
 * destino visible, centrado.
 */
export function placePanel(
  viewport: Size,
  panel: Size,
  target: Box | null,
  margin: number = PANEL_MARGIN,
  gap: number = PANEL_GAP,
): PanelPlacement {
  const vw = Math.max(finite(viewport.width), 0);
  const vh = Math.max(finite(viewport.height), 0);
  const pw = Math.max(finite(panel.width), 0);
  const ph = Math.max(finite(panel.height), 0);
  const maxLeft = Math.max(margin, vw - margin - pw);
  const maxTop = Math.max(margin, vh - margin - ph);
  const clampLeft = (x: number) => Math.min(Math.max(finite(x, margin), margin), maxLeft);
  const clampTop = (y: number) => Math.min(Math.max(finite(y, margin), margin), maxTop);

  const box: Box | null = target
    ? { top: finite(target.top), left: finite(target.left), width: finite(target.width), height: finite(target.height) }
    : null;
  if (!box || !intersectsViewport(box, { width: vw, height: vh })) {
    return { top: clampTop((vh - ph) / 2), left: clampLeft((vw - pw) / 2), side: "center" };
  }

  const bottom = box.top + box.height;
  const right = box.left + box.width;
  // Encima o debajo: alineado con el borde izquierdo del destino o, si no cabe, con el derecho.
  const alignedLeft = clampLeft(box.left + pw <= vw - margin ? box.left : right - pw);
  if (vh - margin - (bottom + gap) >= ph) {
    return { top: clampTop(bottom + gap), left: alignedLeft, side: "below" };
  }
  if (box.top - gap - margin >= ph) {
    return { top: clampTop(box.top - gap - ph), left: alignedLeft, side: "above" };
  }
  if (vw - margin - (right + gap) >= pw) {
    return { top: clampTop(box.top), left: clampLeft(right + gap), side: "right" };
  }
  if (box.left - gap - margin >= pw) {
    return { top: clampTop(box.top), left: clampLeft(box.left - gap - pw), side: "left" };
  }
  const visibleCenter = (Math.max(box.top, 0) + Math.min(bottom, vh)) / 2;
  return { top: visibleCenter < vh / 2 ? maxTop : margin, left: alignedLeft, side: "over" };
}

/**
 * Desplazamiento vertical de la ventana para que el destino se vea con
 * holgura y, si es posible, quepa el panel encima o debajo. 0 si ya está bien.
 * Si destino y panel no caben juntos, deja a la vista la parte de arriba del
 * destino.
 */
export function scrollDeltaFor(
  target: { top: number; height: number },
  viewportHeight: number,
  panelHeight: number,
  margin: number = PANEL_MARGIN,
  gap: number = PANEL_GAP,
): number {
  const top = finite(target.top);
  const height = Math.max(finite(target.height), 0);
  const vh = Math.max(finite(viewportHeight), 0);
  const ph = Math.max(finite(panelHeight), 0);
  const pad = margin + RING_OFFSET;
  const bottom = top + height;

  const visible = top >= pad && bottom <= vh - pad;
  const roomBelow = vh - margin - (bottom + gap) >= ph;
  const roomAbove = top - gap - margin >= ph;
  if (visible && (roomBelow || roomAbove)) return 0;

  const fitsWithPanel = pad + height + gap + ph + margin <= vh;
  if (!fitsWithPanel) return Math.round(top - pad);
  // Lo mínimo para que destino y panel quepan: panel debajo (destino arriba) o encima (destino abajo).
  const toBelow = top - pad;
  const toAbove = bottom - (vh - pad);
  return Math.round(Math.abs(toAbove) < Math.abs(toBelow) ? toAbove : toBelow);
}

/** Caja del anillo: el destino con `RING_OFFSET` de holgura por cada lado. */
export function ringBox(target: Box, offset: number = RING_OFFSET): Box {
  return {
    top: finite(target.top) - offset,
    left: finite(target.left) - offset,
    width: Math.max(finite(target.width), 0) + offset * 2,
    height: Math.max(finite(target.height), 0) + offset * 2,
  };
}

const round = (value: number) => Math.round(finite(value) * 100) / 100;

/** Trazado SVG de un rectángulo redondeado (sentido horario), para recortar la niebla. */
export function roundedRectPath(box: Box, radius: number): string {
  const w = Math.max(finite(box.width), 0);
  const h = Math.max(finite(box.height), 0);
  const r = Math.min(Math.max(finite(radius), 0), w / 2, h / 2);
  const x = round(box.left);
  const y = round(box.top);
  return [
    `M${round(x + r)} ${y}`,
    `H${round(x + w - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + w)} ${round(y + r)}`,
    `V${round(y + h - r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + w - r)} ${round(y + h)}`,
    `H${round(x + r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${x} ${round(y + h - r)}`,
    `V${round(y + r)}`,
    `A${round(r)} ${round(r)} 0 0 1 ${round(x + r)} ${y}`,
    "Z",
  ].join(" ");
}
