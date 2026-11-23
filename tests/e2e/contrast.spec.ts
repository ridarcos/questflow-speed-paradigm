import { expect, test } from "@playwright/test";

/**
 * AC-53: las curvas de nivel decorativas no bajan el contraste de lo que llevan
 * encima (QA-014), en claro y en oscuro.
 *
 * Los colores salen de getComputedStyle y se componen en un canvas, así cuentan
 * las opacidades reales de las utilidades (`stroke-contour/20`) en cada tema,
 * igual que las pinta el navegador.
 */

const SCHEMES = ["light", "dark"] as const;

/**
 * Acceso: cada texto que queda encima del mapa frente al trazo de las curvas
 * compuesto sobre paper (el fondo más contrario que puede tener, porque los
 * anillos no se cruzan). Se ejecuta en el navegador.
 */
function measureAccessMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Sin canvas 2D");
  const over = (color: string, under: string): number[] => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = under;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  };
  const channel = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const map = document.querySelector("[data-contour-map]");
  if (!map) throw new Error("Falta el mapa de curvas del acceso");
  const box = map.getBoundingClientRect();
  const paper = getComputedStyle(document.body).backgroundColor;
  const paperRgb = over(paper, paper);
  const strokes = [...map.querySelectorAll("path")].map((path) => over(getComputedStyle(path).stroke, paper));
  const inkSoft = over(getComputedStyle(document.documentElement).getPropertyValue("--color-ink-soft").trim(), paper);

  const texts: { text: string; ratio: number; threshold: number; muted: boolean }[] = [];
  const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!element || !node.nodeValue?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const overMap = [...range.getClientRects()].some(
      (r) => r.width > 0 && r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top,
    );
    if (!overMap) continue;
    const style = getComputedStyle(element);
    const color = over(style.color, paper);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(style.fontWeight, 10) >= 700);
    texts.push({
      text: node.nodeValue.trim().slice(0, 40),
      ratio: Math.min(...strokes.map((stroke) => ratio(color, stroke))),
      threshold: large ? 3 : 4.5,
      muted: color.join() === inkSoft.join(),
    });
  }
  const strokeVsPaper = strokes.map((stroke) => ratio(stroke, paperRgb));
  return {
    texts: texts.length,
    mutedTexts: texts.filter((t) => t.muted).length,
    below: texts.filter((t) => t.ratio < t.threshold).map((t) => `"${t.text}" ${t.ratio.toFixed(2)}:1`),
    minRatio: Math.min(...texts.map((t) => t.ratio)),
    strokeVsPaperMin: Math.min(...strokeVsPaper),
    strokeVsPaperMax: Math.max(...strokeVsPaper),
  };
}

test("acceso: el texto encima del mapa de curvas conserva 4,5:1 y el mapa sigue tenue (QA-014)", async ({ page }) => {
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Inicia sesión" })).toBeVisible();
      const result = await page.evaluate(measureAccessMap);
      // Desde 1024 px el lema, la descripción y los tres terrenos van encima del mapa.
      expect(result.mutedTexts).toBeGreaterThanOrEqual(7);
      expect(result.below).toEqual([]);
      expect(result.minRatio).toBeGreaterThanOrEqual(4.5);
      // AC-52: el trazo existe y se distingue del papel, pero no pasa de 1,5:1.
      expect(result.strokeVsPaperMin).toBeGreaterThan(1.1);
      expect(result.strokeVsPaperMax).toBeLessThanOrEqual(1.5);
    }
  }
});
