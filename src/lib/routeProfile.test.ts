import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "./quests";
import {
  CHECK_MIN_RADIUS,
  CHECK_STROKE,
  checkPath,
  computeRouteProfile,
  DONE_STROKE,
  dotRadius,
  LEVEL_CLEARANCE,
  levelSegments,
  milestoneShape,
  orderForProfile,
  RING_STROKE,
  routeProfileLabel,
  type LevelSegment,
  type ProfileQuest,
} from "./routeProfile";

const at = (ms: number) => ({ toMillis: () => ms });

function quest(id: string, partial: Partial<ProfileQuest> = {}): ProfileQuest {
  return { id, difficulty: "easy", completed: false, createdAt: at(Number(id.replace(/\D/g, "")) || 0), ...partial };
}

/** Todas las cifras de un `d` de SVG. */
function numbersIn(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?|NaN|Infinity/g) ?? []).map(Number);
}

function expectFinite(geometry: ReturnType<typeof computeRouteProfile>) {
  const all = [
    ...numbersIn(geometry.ridge),
    ...numbersIn(geometry.area),
    ...numbersIn(geometry.walked ?? ""),
    ...geometry.levels,
    ...geometry.levelSegments.flatMap((s) => [s.y, s.x1, s.x2]),
    ...geometry.milestones.flatMap((m) => [m.x, m.y, m.r]),
  ];
  expect(all.length).toBeGreaterThan(0);
  for (const value of all) expect(Number.isFinite(value)).toBe(true);
  expect(JSON.stringify(geometry)).not.toMatch(/NaN|Infinity/);
}

function expectInsideViewBox(geometry: ReturnType<typeof computeRouteProfile>) {
  for (const m of geometry.milestones) {
    expect(m.x - m.r).toBeGreaterThanOrEqual(0);
    expect(m.x + m.r).toBeLessThanOrEqual(geometry.width);
    expect(m.y - m.r).toBeGreaterThanOrEqual(0);
    expect(m.y + m.r).toBeLessThanOrEqual(geometry.height);
  }
  // La cresta (puntos y controles de las curvas) tampoco se sale.
  const ridge = numbersIn(geometry.ridge);
  for (let i = 0; i < ridge.length; i += 2) {
    expect(ridge[i]).toBeGreaterThanOrEqual(0);
    expect(ridge[i]).toBeLessThanOrEqual(geometry.width);
    expect(ridge[i + 1]).toBeGreaterThanOrEqual(0);
    expect(ridge[i + 1]).toBeLessThanOrEqual(geometry.height);
  }
}

/** Último punto de un `d` (extremo del tramo). */
function endOf(d: string): { x: number; y: number } {
  const values = numbersIn(d);
  return { x: values[values.length - 2], y: values[values.length - 1] };
}

/** Distancia de un punto al tramo horizontal de una curva de nivel. */
function distanceToSegment(point: { x: number; y: number }, segment: LevelSegment): number {
  const dx = Math.max(segment.x1 - point.x, 0, point.x - segment.x2);
  return Math.hypot(dx, segment.y - point.y);
}

/** QA-015: ningún tramo de curva de nivel pasa a menos de r + LEVEL_CLEARANCE de un hito. */
function expectLevelsClearOfMilestones(geometry: ReturnType<typeof computeRouteProfile>) {
  for (const segment of geometry.levelSegments) {
    expect(geometry.levels).toContain(segment.y);
    expect(segment.x1).toBeGreaterThanOrEqual(0);
    expect(segment.x2).toBeLessThanOrEqual(geometry.width);
    expect(segment.x2).toBeGreaterThan(segment.x1);
    for (const m of geometry.milestones) {
      expect(distanceToSegment(m, segment)).toBeGreaterThanOrEqual(m.r + LEVEL_CLEARANCE - 1e-9);
    }
  }
}

/** Longitud de curva que se ha cortado alrededor de los hitos. */
function cutLength(geometry: ReturnType<typeof computeRouteProfile>): number {
  const drawn = geometry.levelSegments.reduce((sum, s) => sum + (s.x2 - s.x1), 0);
  return geometry.levels.length * geometry.width - drawn;
}

describe("orderForProfile", () => {
  it("ordena por createdAt ascendente y deja las pendientes (null) al final", () => {
    const list = [quest("q3", { createdAt: null }), quest("q30"), quest("q10"), quest("q20")];
    expect(orderForProfile(list).map((q) => q.id)).toEqual(["q10", "q20", "q30", "q3"]);
  });

  it("refleja exactamente la lista (createdAt desc) cuando hay empates", () => {
    const desc = [quest("a", { createdAt: at(5) }), quest("b", { createdAt: at(5) }), quest("c", { createdAt: at(1) })];
    expect(orderForProfile(desc).map((q) => q.id)).toEqual(["c", "b", "a"]);
    const pending = [quest("p1", { createdAt: null }), quest("p2", { createdAt: null })];
    expect(orderForProfile(pending).map((q) => q.id)).toEqual(["p2", "p1"]);
  });

  it("no muta la lista original", () => {
    const list = [quest("q2"), quest("q1")];
    orderForProfile(list);
    expect(list.map((q) => q.id)).toEqual(["q2", "q1"]);
  });
});

describe("computeRouteProfile", () => {
  const size = { width: 300, height: 112 };

  it("con 0 misiones dibuja una cresta sin hitos ni tramo y sin NaN", () => {
    const geometry = computeRouteProfile([], size);
    expect(geometry.milestones).toEqual([]);
    expect(geometry.walked).toBeNull();
    expect(geometry.walkedEnd).toBeNull();
    expect(geometry.levelSegments).toEqual(geometry.levels.map((y) => ({ y, x1: 0, x2: geometry.width })));
    expect(geometry.ridge.startsWith("M0 ")).toBe(true);
    expectFinite(geometry);
    expectInsideViewBox(geometry);
  });

  it("con 1 misión el hito queda centrado y, completada, el tramo acaba en él", () => {
    const active = computeRouteProfile([quest("q1")], size);
    expect(active.milestones).toHaveLength(1);
    expect(active.milestones[0].x).toBe(150);
    expect(active.walked).toBeNull();

    const done = computeRouteProfile([quest("q1", { completed: true })], size);
    expect(done.walkedEnd).toEqual({ x: done.milestones[0].x, y: done.milestones[0].y });
    expect(endOf(done.walked ?? "")).toEqual(done.walkedEnd);
    expectFinite(done);
    expectInsideViewBox(done);
  });

  it("con 2 misiones las ordena de izquierda a derecha por fecha de creación", () => {
    const geometry = computeRouteProfile([quest("q20", { difficulty: "hard" }), quest("q10")], size);
    expect(geometry.milestones.map((m) => m.id)).toEqual(["q10", "q20"]);
    expect(geometry.milestones[0].x).toBeLessThan(geometry.milestones[1].x);
    // Cumbre más alta que Sendero (y menor = más arriba).
    expect(geometry.milestones[1].y).toBeLessThan(geometry.milestones[0].y);
    expectFinite(geometry);
    expectInsideViewBox(geometry);
  });

  it("con 50 misiones no sale del viewBox, ni siquiera a 360 px, y los hitos no se solapan", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      quest(`q${i + 1}`, { difficulty: DIFFICULTIES[i % 3] as Difficulty, completed: i % 4 === 0 }),
    );
    for (const width of [296, 360, 1100]) {
      const geometry = computeRouteProfile(many, { width, height: 112 });
      expect(geometry.milestones).toHaveLength(50);
      expectFinite(geometry);
      expectInsideViewBox(geometry);
      for (let i = 1; i < geometry.milestones.length; i++) {
        const prev = geometry.milestones[i - 1];
        const current = geometry.milestones[i];
        expect(current.x - prev.x).toBeGreaterThanOrEqual(prev.r + current.r - 0.01);
      }
    }
  });

  it("el tramo resaltado termina en la completada más reciente por fecha de creación", () => {
    const list = [
      quest("q4", { difficulty: "hard" }),
      quest("q3", { difficulty: "medium", completed: true }),
      quest("q2", { completed: true }),
      quest("q1"),
    ];
    const geometry = computeRouteProfile(list, size);
    const third = geometry.milestones.find((m) => m.id === "q3");
    expect(geometry.walkedEnd).toEqual({ x: third?.x, y: third?.y });
    expect(endOf(geometry.walked ?? "")).toEqual(geometry.walkedEnd);
    // El tramo es el principio exacto de la cresta (misma geometría).
    expect(geometry.ridge.startsWith(geometry.walked ?? "-")).toBe(true);
  });

  it("si todas están completadas, el tramo llega al último hito", () => {
    const list = [quest("q2", { completed: true }), quest("q1", { completed: true })];
    const geometry = computeRouteProfile(list, size);
    const last = geometry.milestones[geometry.milestones.length - 1];
    expect(geometry.walkedEnd).toEqual({ x: last.x, y: last.y });
  });

  it("una escritura pendiente (createdAt null) no rompe la geometría: va al final", () => {
    const geometry = computeRouteProfile([quest("nuevo", { createdAt: null }), quest("q1")], size);
    expect(geometry.milestones.map((m) => m.id)).toEqual(["q1", "nuevo"]);
    expectFinite(geometry);
  });

  it("tolera tamaños inválidos sin producir NaN", () => {
    const geometry = computeRouteProfile([quest("q1")], { width: Number.NaN, height: Number.POSITIVE_INFINITY });
    expectFinite(geometry);
    expectInsideViewBox(geometry);
  });
});

describe("curvas de nivel cortadas alrededor de los hitos (QA-015)", () => {
  const milestone = { x: 100, y: 40, r: 7 };
  const reach = milestone.r + LEVEL_CLEARANCE;

  it("deja 3 px limpios fuera del contorno más grueso (2 px) y del trazo de la curva (1 px)", () => {
    expect(LEVEL_CLEARANCE - 2 / 2 - 1 / 2).toBeGreaterThanOrEqual(3);
  });

  it("sin hitos cerca, cada curva es un solo tramo de borde a borde", () => {
    expect(levelSegments(40, 300, [])).toEqual([{ y: 40, x1: 0, x2: 300 }]);
    expect(levelSegments(40 + reach, 300, [milestone])).toEqual([{ y: 40 + reach, x1: 0, x2: 300 }]);
  });

  it("una curva que pasa por el centro de un hito se corta a r + LEVEL_CLEARANCE a cada lado", () => {
    expect(levelSegments(40, 300, [milestone])).toEqual([
      { y: 40, x1: 0, x2: 100 - reach },
      { y: 40, x1: 100 + reach, x2: 300 },
    ]);
  });

  it("una curva que solo roza el hito también se corta, sin acercarse por el redondeo", () => {
    for (const dy of [-reach + 0.3, -3, 2.5, reach - 1, reach - 0.01]) {
      const segments = levelSegments(40 + dy, 300, [milestone]);
      expect(segments).toHaveLength(2);
      for (const segment of segments) {
        const distance = distanceToSegment(milestone, segment);
        expect(distance).toBeGreaterThanOrEqual(reach);
        expect(distance).toBeLessThan(reach + 0.05);
      }
    }
  });

  it("une los huecos que se solapan y no deja motas entre hitos muy juntos", () => {
    const close = [milestone, { x: 120, y: 40, r: 7 }];
    expect(levelSegments(40, 300, close)).toEqual([
      { y: 40, x1: 0, x2: 100 - reach },
      { y: 40, x1: 120 + reach, x2: 300 },
    ]);
    // Entre dos huecos queda 1 px: no se dibuja.
    const sliver = [milestone, { x: 100 + 2 * reach + 1, y: 40, r: 7 }];
    expect(levelSegments(40, 300, sliver)).toEqual([
      { y: 40, x1: 0, x2: 100 - reach },
      { y: 40, x1: 100 + 3 * reach + 1, x2: 300 },
    ]);
  });

  it("en el perfil ningún tramo se acerca a un hito: 0 a 50 misiones, de 296 a 1100 px", () => {
    const terrains: Difficulty[] = ["easy", "easy", "medium", "hard"];
    let cut = 0;
    for (const count of [0, 1, 2, 4, 7, 20, 50]) {
      const list = Array.from({ length: count }, (_, i) =>
        quest(`q${i + 1}`, { difficulty: terrains[i % terrains.length], completed: i === 0 }),
      );
      for (const size of [
        { width: 296, height: 112 },
        { width: 360, height: 112 },
        { width: 680, height: 128 },
        { width: 920, height: 160 },
        { width: 1100, height: 160 },
      ]) {
        const geometry = computeRouteProfile(list, size);
        expectFinite(geometry);
        expectLevelsClearOfMilestones(geometry);
        cut += cutLength(geometry);
      }
    }
    // La comprobación no es vacía: en estas rutas hay curvas que cruzaban hitos.
    expect(cut).toBeGreaterThan(0);
  });
});

describe("forma de los hitos: completados distinguibles sin color (AC-70)", () => {
  /** Distancia máxima al centro de los vértices del check, más medio trazo. */
  function checkReach(r: number): number {
    const values = numbersIn(checkPath({ x: 0, y: 0, r }));
    let reach = 0;
    for (let i = 0; i < values.length; i += 2) reach = Math.max(reach, Math.hypot(values[i], values[i + 1]));
    return reach + CHECK_STROKE / 2;
  }
  /** Radio del disco de marker que deja libre el borde contour. */
  const markerDisc = (r: number) => r - DONE_STROKE / 2;

  it("un activo siempre es un anillo; un completado, check si cabe y núcleo si no", () => {
    for (const r of [2.5, 3.3, 3.99, 4, 4.9, 7]) expect(milestoneShape(false, r)).toBe("ring");
    for (const r of [4, 4.44, 4.9, 6.65, 7]) expect(milestoneShape(true, r)).toBe("check");
    for (const r of [2.5, 3, 3.3, 3.53, 3.99]) expect(milestoneShape(true, r)).toBe("dot");
  });

  it("el check cabe dentro del disco de marker desde CHECK_MIN_RADIUS y por debajo ya no", () => {
    for (const r of [CHECK_MIN_RADIUS, 4.44, 5, 6, 7]) expect(checkReach(r)).toBeLessThanOrEqual(markerDisc(r));
    // El umbral no es arbitrario: un poco por debajo, el check tocaría el borde.
    expect(checkReach(3.8)).toBeGreaterThan(markerDisc(3.8));
  });

  it("el trazo del check conserva su forma y posición", () => {
    expect(checkPath({ x: 10, y: 20, r: 5 })).toBe("M7.9 20.1 L9.5 21.7 L12.2 18.5");
  });

  it("el núcleo nunca baja de 0,75 px y deja siempre un anillo de marker visible", () => {
    for (const r of [2.5, 2.8, 3, 3.3, 3.53, 3.99]) {
      const core = dotRadius(r);
      expect(core).toBeGreaterThanOrEqual(0.75);
      expect(markerDisc(r) - core).toBeGreaterThanOrEqual(0.74);
    }
    expect(dotRadius(2.5)).toBe(0.75);
    expect(dotRadius(3.99)).toBe(1.5);
  });

  it("en el círculo central donde el completado tiene núcleo, el activo es hueco (su borde queda a más de 0,5 px)", () => {
    for (const r of [2.5, 3, 3.99]) expect(r - RING_STROKE / 2).toBeGreaterThan(dotRadius(r) + 0.5);
  });

  it("con 4, 17, 40 y 60 misiones a 360, 768 y 1280 px ningún completado queda sin marca de forma", () => {
    // Anchos reales del SVG en esos viewports (medidos con Playwright: 294, 670 y 902–917 px).
    const widths = [
      { width: 294, height: 112 },
      { width: 670, height: 128 },
      { width: 902, height: 160 },
      { width: 917, height: 160 },
    ];
    const seen = new Map<string, string>();
    for (const count of [4, 17, 40, 60]) {
      const list = Array.from({ length: count }, (_, i) =>
        quest(`q${i + 1}`, { difficulty: DIFFICULTIES[i % 3] as Difficulty, completed: i % 4 === 0 }),
      );
      for (const size of widths) {
        const geometry = computeRouteProfile(list, size);
        const completed = geometry.milestones.filter((m) => m.completed);
        expect(completed.length).toBeGreaterThan(0);
        for (const m of geometry.milestones) {
          expect(m.shape).toBe(milestoneShape(m.completed, m.r));
          if (!m.completed) continue;
          expect(m.shape).not.toBe("ring");
          if (m.shape === "check") expect(checkReach(m.r)).toBeLessThanOrEqual(markerDisc(m.r));
          else expect(dotRadius(m.r)).toBeLessThan(markerDisc(m.r));
        }
        seen.set(`${size.width}/${count}`, completed[0].shape);
      }
    }
    // Los dos casos aparecen en la matriz: check a 360 px con 17 y núcleo con 40 y 60.
    expect(seen.get("294/17")).toBe("check");
    expect(seen.get("294/40")).toBe("dot");
    expect(seen.get("294/60")).toBe("dot");
    expect(seen.get("670/40")).toBe("check");
    expect(seen.get("670/60")).toBe("dot");
    expect(seen.get("902/60")).toBe("check");
  });
});

describe("routeProfileLabel", () => {
  it("resume completadas, total y XP con el formato exacto", () => {
    expect(routeProfileLabel(1, 4, 10)).toBe("1 de 4 misiones completadas, 10 XP");
    expect(routeProfileLabel(0, 0, 0)).toBe("0 de 0 misiones completadas, 0 XP");
  });

  it("nunca muestra NaN", () => {
    expect(routeProfileLabel(Number.NaN, 2, Number.NaN)).toBe("0 de 2 misiones completadas, 0 XP");
  });
});
