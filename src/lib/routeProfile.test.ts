import { describe, expect, it } from "vitest";
import { DIFFICULTIES, type Difficulty } from "./quests";
import { computeRouteProfile, orderForProfile, routeProfileLabel, type ProfileQuest } from "./routeProfile";

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

describe("routeProfileLabel", () => {
  it("resume completadas, total y XP con el formato exacto", () => {
    expect(routeProfileLabel(1, 4, 10)).toBe("1 de 4 misiones completadas, 10 XP");
    expect(routeProfileLabel(0, 0, 0)).toBe("0 de 0 misiones completadas, 0 XP");
  });

  it("nunca muestra NaN", () => {
    expect(routeProfileLabel(Number.NaN, 2, Number.NaN)).toBe("0 de 2 misiones completadas, 0 XP");
  });
});
