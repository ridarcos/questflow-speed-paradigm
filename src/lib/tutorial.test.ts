import { describe, expect, it } from "vitest";
import { seededRandom } from "./contours";
import {
  clampStep,
  isFirstStep,
  isLastStep,
  nextStep,
  PANEL_MARGIN,
  placePanel,
  previousStep,
  ringBox,
  roundedRectPath,
  scrollDeltaFor,
  stepLabel,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STEPS,
  type Box,
} from "./tutorial";

describe("pasos del tutorial", () => {
  it("5 pasos en orden: perfil, nueva misión, terreno, filtros y tarjeta", () => {
    expect(TUTORIAL_STEP_COUNT).toBe(5);
    expect(TUTORIAL_STEPS.map((step) => step.target)).toEqual([
      "profile",
      "new-quest",
      "terrain",
      "filters",
      "quest-card",
    ]);
  });

  it("cada paso tiene título, texto y texto alternativo", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.fallback.length).toBeGreaterThan(0);
    }
  });

  it("el paso de terreno nombra Sendero (10 XP), Ladera (25 XP) y Cumbre (50 XP)", () => {
    const terrain = TUTORIAL_STEPS[2];
    for (const text of [terrain.body, terrain.fallback]) {
      expect(text).toContain("Sendero (10 XP)");
      expect(text).toContain("Ladera (25 XP)");
      expect(text).toContain("Cumbre (50 XP)");
    }
  });

  it("el paso de la tarjeta nombra Completar, Editar y Eliminar", () => {
    const card = TUTORIAL_STEPS[4];
    for (const word of ["Completar", "Editar", "Eliminar"]) expect(card.body).toContain(word);
  });
});

describe("navegación del tutorial (límites 1..5)", () => {
  it("siguiente y anterior no salen de 1..5", () => {
    expect(nextStep(0)).toBe(1);
    expect(nextStep(3)).toBe(4);
    expect(nextStep(4)).toBe(4);
    expect(previousStep(4)).toBe(3);
    expect(previousStep(1)).toBe(0);
    expect(previousStep(0)).toBe(0);
  });

  it("recorre los 5 pasos y vuelve al primero", () => {
    const visited = [0];
    let step = 0;
    for (let i = 0; i < 10; i += 1) {
      step = nextStep(step);
      visited.push(step);
    }
    expect([...new Set(visited)]).toEqual([0, 1, 2, 3, 4]);
    for (let i = 0; i < 10; i += 1) step = previousStep(step);
    expect(step).toBe(0);
  });

  it("clampStep acota índices fuera de rango o no válidos", () => {
    expect(clampStep(-3)).toBe(0);
    expect(clampStep(99)).toBe(4);
    expect(clampStep(2.7)).toBe(2);
    expect(clampStep(Number.NaN)).toBe(0);
    expect(clampStep(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("primer y último paso", () => {
    expect(isFirstStep(0)).toBe(true);
    expect(isFirstStep(1)).toBe(false);
    expect(isLastStep(4)).toBe(true);
    expect(isLastStep(3)).toBe(false);
  });

  it("'Paso N de 5' de 1 a 5", () => {
    expect([0, 1, 2, 3, 4].map(stepLabel)).toEqual([
      "Paso 1 de 5",
      "Paso 2 de 5",
      "Paso 3 de 5",
      "Paso 4 de 5",
      "Paso 5 de 5",
    ]);
    expect(stepLabel(42)).toBe("Paso 5 de 5");
  });
});

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 360, height: 740 };
const PANEL_DESKTOP = { width: 384, height: 250 };
const PANEL_MOBILE = { width: 336, height: 290 };

function within(viewport: { width: number; height: number }, panel: { width: number; height: number }, top: number, left: number) {
  expect(top).toBeGreaterThanOrEqual(PANEL_MARGIN - 0.001);
  expect(left).toBeGreaterThanOrEqual(PANEL_MARGIN - 0.001);
  expect(top + panel.height).toBeLessThanOrEqual(viewport.height - PANEL_MARGIN + 0.001);
  expect(left + panel.width).toBeLessThanOrEqual(viewport.width - PANEL_MARGIN + 0.001);
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

function covers(panel: Box, target: Box): boolean {
  return (
    panel.left <= target.left &&
    panel.top <= target.top &&
    panel.left + panel.width >= target.left + target.width &&
    panel.top + panel.height >= target.top + target.height
  );
}

describe("placePanel", () => {
  it("sin destino: centrado y dentro del viewport", () => {
    const place = placePanel(MOBILE, PANEL_MOBILE, null);
    expect(place.side).toBe("center");
    expect(place.left).toBe(12);
    expect(place.top).toBe(225);
    within(MOBILE, PANEL_MOBILE, place.top, place.left);
  });

  it("destino arriba: panel debajo, alineado a la izquierda del destino", () => {
    const target = { top: 80, left: 88, width: 1104, height: 230 };
    const place = placePanel(DESKTOP, PANEL_DESKTOP, target);
    expect(place).toEqual({ top: 80 + 230 + 14, left: 88, side: "below" });
  });

  it("destino abajo: panel encima", () => {
    const target = { top: 560, left: 520, width: 640, height: 190 };
    const place = placePanel(DESKTOP, PANEL_DESKTOP, target);
    expect(place.side).toBe("above");
    expect(place.top).toBe(560 - 14 - 250);
  });

  it("destino alto en escritorio: panel al lado, sin taparlo", () => {
    const target = { top: 24, left: 88, width: 352, height: 640 };
    const place = placePanel(DESKTOP, PANEL_DESKTOP, target);
    expect(place.side).toBe("right");
    const panelBox = { ...PANEL_DESKTOP, top: place.top, left: place.left };
    expect(overlaps(panelBox, target)).toBe(false);
    within(DESKTOP, PANEL_DESKTOP, place.top, place.left);
  });

  it("destino alto en móvil: el panel lo tapa solo en parte", () => {
    const target = { top: 18, left: 16, width: 328, height: 600 };
    const place = placePanel(MOBILE, PANEL_MOBILE, target);
    expect(place.side).toBe("over");
    const panelBox = { ...PANEL_MOBILE, top: place.top, left: place.left };
    expect(covers(panelBox, target)).toBe(false);
    within(MOBILE, PANEL_MOBILE, place.top, place.left);
  });

  it("destino pegado a la derecha: el panel se alinea con su borde derecho", () => {
    const target = { top: 18, left: 894, width: 298, height: 36 };
    const place = placePanel(DESKTOP, PANEL_DESKTOP, target);
    expect(place).toEqual({ top: 18 + 36 + 14, left: 894 + 298 - 384, side: "below" });
  });

  it("panel más ancho que el destino junto al borde derecho: se ajusta dentro", () => {
    const target = { top: 100, left: 300, width: 40, height: 30 };
    const place = placePanel(MOBILE, PANEL_MOBILE, target);
    expect(place.side).toBe("below");
    within(MOBILE, PANEL_MOBILE, place.top, place.left);
  });

  it("destino fuera del viewport o de tamaño 0: centrado", () => {
    expect(placePanel(DESKTOP, PANEL_DESKTOP, { top: -500, left: 0, width: 300, height: 100 }).side).toBe("center");
    expect(placePanel(DESKTOP, PANEL_DESKTOP, { top: 100, left: 100, width: 0, height: 0 }).side).toBe("center");
  });

  it("valores no finitos no producen NaN", () => {
    const place = placePanel(
      { width: Number.NaN, height: 600 },
      { width: 300, height: Number.POSITIVE_INFINITY },
      { top: Number.NaN, left: 0, width: 10, height: 10 },
    );
    expect(Number.isFinite(place.top)).toBe(true);
    expect(Number.isFinite(place.left)).toBe(true);
  });

  it("propiedad: en 360, 768 y 1280 px el panel cabe entero y nunca tapa del todo al destino", () => {
    const random = seededRandom(2024);
    const viewports = [MOBILE, { width: 768, height: 1024 }, DESKTOP];
    for (const viewport of viewports) {
      const panel = { width: Math.min(384, viewport.width - 24), height: 240 + Math.round(random() * 80) };
      for (let i = 0; i < 300; i += 1) {
        const width = 20 + random() * (viewport.width - 40);
        const height = 20 + random() * (viewport.height * 0.9);
        const target = {
          left: random() * (viewport.width - width),
          top: random() * (viewport.height - height),
          width,
          height,
        };
        const place = placePanel(viewport, panel, target);
        within(viewport, panel, place.top, place.left);
        expect(covers({ ...panel, top: place.top, left: place.left }, target)).toBe(false);
      }
    }
  });
});

describe("scrollDeltaFor", () => {
  it("0 si el destino ya se ve y cabe el panel", () => {
    expect(scrollDeltaFor({ top: 80, height: 230 }, 800, 250)).toBe(0);
    expect(scrollDeltaFor({ top: 500, height: 200 }, 800, 250)).toBe(0);
  });

  it("destino bajo la línea de flotación: lo sube lo justo para que quepa el panel encima", () => {
    const delta = scrollDeltaFor({ top: 900, height: 120 }, 800, 250);
    expect(delta).toBe(900 + 120 - (800 - 18));
    const top = 900 - delta;
    expect(top - 14 - 12).toBeGreaterThanOrEqual(250);
  });

  it("destino por encima del viewport: baja la página hasta verlo", () => {
    const delta = scrollDeltaFor({ top: -300, height: 100 }, 800, 250);
    expect(delta).toBe(-300 - 18);
  });

  it("destino y panel no caben juntos: deja a la vista la parte de arriba del destino", () => {
    expect(scrollDeltaFor({ top: 300, height: 600 }, 740, 290)).toBe(300 - 18);
  });

  it("sin NaN con entradas no finitas", () => {
    expect(Number.isFinite(scrollDeltaFor({ top: Number.NaN, height: 10 }, 800, 250))).toBe(true);
  });
});

describe("anillo y niebla", () => {
  it("ringBox añade la holgura por cada lado", () => {
    expect(ringBox({ top: 100, left: 50, width: 200, height: 40 })).toEqual({ top: 94, left: 44, width: 212, height: 52 });
  });

  it("roundedRectPath: trazado cerrado y sin NaN, radio acotado a la mitad del lado", () => {
    const d = roundedRectPath({ top: 10, left: 20, width: 100, height: 30 }, 40);
    expect(d.startsWith("M35 10")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).not.toMatch(/NaN|Infinity/);
    expect(roundedRectPath({ top: Number.NaN, left: 0, width: 10, height: 10 }, Number.NaN)).not.toMatch(/NaN/);
  });
});
