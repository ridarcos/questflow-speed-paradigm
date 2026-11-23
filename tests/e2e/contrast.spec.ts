import { expect, test } from "@playwright/test";
import { EXAMPLE_TITLES, questCard, signUp, uniqueEmail } from "./helpers";

/**
 * AC-53: las curvas de nivel decorativas no bajan el contraste de lo que llevan
 * encima (QA-014) ni del contorno de los hitos (QA-015), en claro y en oscuro.
 *
 * Los colores salen de getComputedStyle y se componen en un canvas, así cuentan
 * las opacidades reales de las utilidades (`stroke-contour/20`, `fill-contour/7`)
 * en cada tema, igual que las pinta el navegador.
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

/** El viewBox del perfil sigue a su tamaño en pantalla: 1 unidad = 1 px. */
function viewBoxMatchesSize(svg: SVGSVGElement) {
  const box = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  return Math.abs(viewBox.width - box.width) < 1 && Math.abs(viewBox.height - box.height) < 1;
}

/**
 * Perfil de ruta: distancia de cada tramo de curva de nivel al contorno de cada
 * hito y contraste del contorno con lo que sí tiene al lado (relieve y surface).
 * Se ejecuta en el navegador sobre el <svg role="img">.
 */
function measureMilestones(svg: SVGSVGElement) {
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
  const num = (element: Element, name: string) => Number(element.getAttribute(name));

  const section = svg.closest("section");
  const area = svg.querySelector("[data-layer='relief'] > path");
  if (!section || !area) throw new Error("Falta el relieve del perfil");
  const surface = getComputedStyle(section).backgroundColor;
  const neighbours: [string, number[]][] = [
    ["surface", over(surface, surface)],
    ["relieve", over(getComputedStyle(area).fill, surface)],
  ];
  const levels = [...svg.querySelectorAll("[data-layer='relief'] line")].map((line) => ({
    y: num(line, "y1"),
    x1: Math.min(num(line, "x1"), num(line, "x2")),
    x2: Math.max(num(line, "x1"), num(line, "x2")),
    half: num(line, "stroke-width") / 2,
  }));

  const touching: string[] = [];
  const below: string[] = [];
  const ratios: number[] = [];
  const milestones = [...svg.querySelectorAll("[data-milestone]")];
  for (const group of milestones) {
    const circles = group.querySelectorAll(":scope > circle");
    const outline = circles[circles.length - 1];
    const [cx, cy, r, width] = ["cx", "cy", "r", "stroke-width"].map((name) => num(outline, name));
    const name = `${group.getAttribute("data-terrain")}${group.getAttribute("data-completed") === "true" ? " completado" : ""}`;
    // Hueco entre el borde exterior del contorno y el borde de cada curva.
    for (const level of levels) {
      const dx = Math.max(level.x1 - cx, 0, cx - level.x2);
      const gap = Math.hypot(dx, level.y - cy) - r - width / 2 - level.half;
      if (gap < 2) touching.push(`${name}: curva y=${level.y} a ${gap.toFixed(2)} px del contorno`);
    }
    const stroke = over(getComputedStyle(outline).stroke, surface);
    for (const [label, color] of neighbours) {
      const value = ratio(stroke, color);
      ratios.push(value);
      if (value < 3) below.push(`${name} frente a ${label}: ${value.toFixed(2)}:1`);
    }
  }
  return { milestones: milestones.length, levels: levels.length, touching, below, minRatio: Math.min(...ratios) };
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

test("perfil de ruta: las curvas de nivel no tocan ningún hito y el contorno conserva 3:1 (QA-015)", async ({ page }) => {
  await page.goto("/");
  await signUp(page, uniqueEmail("contraste"));
  const first = EXAMPLE_TITLES[0];
  await questCard(page, first).getByRole("button", { name: `Completar misión: ${first}` }).click();
  const profile = page.getByRole("img", { name: "1 de 4 misiones completadas, 10 XP", exact: true });
  await expect(profile).toBeVisible();

  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    for (const viewport of [
      { width: 360, height: 740 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => profile.evaluate(viewBoxMatchesSize)).toBe(true);
      const result = await profile.evaluate(measureMilestones);
      expect(result.milestones).toBe(4);
      expect(result.levels).toBeGreaterThanOrEqual(3);
      expect(result.touching).toEqual([]);
      expect(result.below).toEqual([]);
      expect(result.minRatio).toBeGreaterThanOrEqual(3);
    }
  }
});
