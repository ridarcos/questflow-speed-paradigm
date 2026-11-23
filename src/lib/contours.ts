/**
 * Curvas de nivel generadas (mapa del acceso y logo). Funciones puras y
 * deterministas: la misma semilla produce siempre el mismo dibujo, así que el
 * HTML del servidor y el del cliente coinciden.
 *
 * Cada cima es un conjunto de anillos concéntricos deformados con la misma
 * ondulación angular. Como la deformación es proporcional al radio, un anillo
 * exterior nunca corta a uno interior, igual que en un mapa real.
 */

export interface PeakOptions {
  cx: number;
  cy: number;
  /** Número de anillos. */
  rings: number;
  /** Radio del anillo interior. */
  radius: number;
  /** Separación entre anillos. */
  step: number;
  /** Desplazamiento del centro por anillo (ladera más suave hacia ese lado). */
  lean?: { x: number; y: number };
  seed: number;
  /** Intensidad de la ondulación (0–0.2). */
  wobble?: number;
}

/** Generador pseudoaleatorio pequeño (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fixed(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

/** Curva cerrada suave (Catmull-Rom convertida a Bézier) que pasa por los puntos. */
export function closedSmoothPath(points: readonly { x: number; y: number }[]): string {
  const n = points.length;
  if (n < 3) return "";
  const at = (i: number) => points[(i + n) % n];
  let d = `M${fixed(at(0).x)} ${fixed(at(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${fixed(c1x)} ${fixed(c1y)} ${fixed(c2x)} ${fixed(c2y)} ${fixed(p2.x)} ${fixed(p2.y)}`;
  }
  return `${d}Z`;
}

/** Anillos de una cima, del interior al exterior. */
export function peakRings(options: PeakOptions, samples = 56): string[] {
  const random = seededRandom(options.seed);
  const wobble = options.wobble ?? 0.12;
  // Tres armónicos con fase fija: todos los anillos comparten la forma.
  const harmonics = [2, 3, 5].map((frequency, index) => ({
    frequency,
    amplitude: wobble * (0.55 - index * 0.15) * (0.6 + random() * 0.4),
    phase: random() * Math.PI * 2,
  }));
  const lean = options.lean ?? { x: 0, y: 0 };
  const paths: string[] = [];
  for (let ring = 0; ring < options.rings; ring++) {
    const radius = options.radius + ring * options.step;
    const cx = options.cx + lean.x * ring;
    const cy = options.cy + lean.y * ring;
    const points = Array.from({ length: samples }, (_, k) => {
      const angle = (k / samples) * Math.PI * 2;
      const shape = harmonics.reduce(
        (sum, h) => sum + h.amplitude * Math.sin(h.frequency * angle + h.phase + ring * 0.035),
        0,
      );
      const r = radius * (1 + shape);
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
    paths.push(closedSmoothPath(points));
  }
  return paths;
}

/** Mapa del acceso: tres cimas separadas cuyos anillos no se cruzan (viewBox 600×600). */
export const ACCESS_MAP_PEAKS: readonly PeakOptions[] = Object.freeze([
  { cx: 432, cy: 176, rings: 9, radius: 14, step: 21, lean: { x: -2.2, y: 2.4 }, seed: 11 },
  { cx: 146, cy: 474, rings: 6, radius: 12, step: 22, lean: { x: 2.6, y: -1.6 }, seed: 29 },
  { cx: 520, cy: 534, rings: 4, radius: 10, step: 18, lean: { x: -1.5, y: -1.2 }, seed: 47 },
  { cx: 92, cy: 96, rings: 4, radius: 10, step: 17, lean: { x: 1.4, y: 1.8 }, seed: 83 },
]);

export interface ContourLine {
  d: string;
  /** Curva maestra (cada cuatro anillos), algo más gruesa. */
  index: boolean;
}

export function accessMapContours(): ContourLine[] {
  return ACCESS_MAP_PEAKS.flatMap((peak) =>
    peakRings(peak).map((d, ring) => ({ d, index: ring % 4 === 3 })),
  );
}

/** Logo: tres anillos y la cima (viewBox 32×32). */
export function logoRings(): string[] {
  return peakRings({ cx: 17.5, cy: 14.5, rings: 3, radius: 4.2, step: 4.6, lean: { x: -0.9, y: 0.7 }, seed: 5, wobble: 0.1 }, 36);
}
