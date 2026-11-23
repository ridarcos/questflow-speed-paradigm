import { describe, expect, it } from "vitest";
import { accessMapContours, closedSmoothPath, logoRings, peakRings, seededRandom } from "./contours";

function numbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?|NaN|Infinity/g) ?? []).map(Number);
}

describe("curvas de nivel generadas", () => {
  it("son deterministas: la misma semilla da el mismo dibujo (SSR y cliente coinciden)", () => {
    expect(accessMapContours()).toEqual(accessMapContours());
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("cada anillo es una curva cerrada sin NaN", () => {
    for (const { d } of accessMapContours()) {
      expect(d.startsWith("M")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
      for (const value of numbers(d)) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("los anillos de una cima crecen hacia fuera (no se cruzan)", () => {
    const rings = peakRings({ cx: 100, cy: 100, rings: 5, radius: 10, step: 15, lean: { x: 2, y: -2 }, seed: 3 });
    const extent = (d: string) => {
      const values = numbers(d);
      const xs = values.filter((_, i) => i % 2 === 0);
      return Math.max(...xs) - Math.min(...xs);
    };
    for (let i = 1; i < rings.length; i++) expect(extent(rings[i])).toBeGreaterThan(extent(rings[i - 1]));
  });

  it("el logo cabe en su viewBox de 32 × 32", () => {
    for (const d of logoRings()) {
      for (const value of numbers(d)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(32);
      }
    }
  });

  it("closedSmoothPath necesita al menos tres puntos", () => {
    expect(closedSmoothPath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe("");
  });
});
