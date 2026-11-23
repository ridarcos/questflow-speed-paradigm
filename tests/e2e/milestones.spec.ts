import { expect, test, type Page } from "@playwright/test";
import { questCard, replaceQuestsByRest, signUp, uidFor, uniqueEmail, type RouteQuest } from "./helpers";

/**
 * AC-70: con cualquier número de misiones, cada hito completado se distingue de
 * uno activo por algo más que el color. Los activos son anillos huecos; los
 * completados llevan el check mientras cabe y, cuando no, un núcleo relleno.
 *
 * Se mide por píxeles sobre una captura real a 1x (el caso con menos píxeles
 * por hito): dentro del hueco central que tendría un anillo de ese radio, un
 * completado tiene algo a 3:1 o más de surface (núcleo, check o, en oscuro, el
 * propio marker) y un activo no tiene nada (está hueco). Sin la marca, en claro
 * un completado solo tendría marker, a 1.78:1 de surface, y el test falla.
 */

const TERRAINS = ["easy", "medium", "hard"] as const;
const XP = { easy: 10, medium: 25, hard: 50 } as const;
const SCHEMES = ["light", "dark"] as const;

/** `count` misiones con el terreno alterno y una de cada cuatro completada (40 → 10). */
function route(count: number): RouteQuest[] {
  return Array.from({ length: count }, (_, i) => ({ difficulty: TERRAINS[i % 3], completed: i % 4 === 0 }));
}

function profileLabel(quests: readonly RouteQuest[]): string {
  const done = quests.filter((quest) => quest.completed);
  const xp = done.reduce((sum, quest) => sum + XP[quest.difficulty], 0);
  return `${done.length} de ${quests.length} misiones completadas, ${xp} XP`;
}

interface MilestoneReport {
  completed: boolean;
  shape: string | null;
  /** Marca visible dentro del hito (`check` o `dot`), o null si no hay o está oculta. */
  mark: string | null;
  r: number;
  /** Contraste máximo frente a surface de los píxeles del hueco central. */
  max: number;
  samples: number;
}

/**
 * Se ejecuta en el navegador con la captura del viewport (PNG en base64): lee
 * los píxeles del centro de cada hito y los compara con surface.
 */
async function readMilestones(b64: string): Promise<{ viewBoxOk: boolean; milestones: MilestoneReport[] }> {
  const image = new Image();
  image.src = `data:image/png;base64,${b64}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Sin canvas 2D");
  ctx.drawImage(image, 0, 0);
  const { data, width } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const scale = canvas.width / window.innerWidth;

  const channel = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const svg = document.querySelector<SVGSVGElement>("svg[role='img']");
  const section = svg?.closest("section");
  if (!svg || !section) throw new Error("Falta el perfil de ruta");
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Sin canvas 2D");
  probe.fillStyle = getComputedStyle(section).backgroundColor;
  probe.fillRect(0, 0, 1, 1);
  const surface = Array.from(probe.getImageData(0, 0, 1, 1).data.slice(0, 3));

  // 1 unidad del viewBox = 1 px: el radio del atributo es el radio en pantalla.
  const box = svg.getBoundingClientRect();
  const viewBox = svg.viewBox.baseVal;
  const viewBoxOk = Math.abs(viewBox.width - box.width) < 1 && Math.abs(viewBox.height - box.height) < 1;

  const milestones = [...svg.querySelectorAll("[data-milestone]")].map((group) => {
    const circles = group.querySelectorAll(":scope > circle");
    const outline = circles[circles.length - 1];
    const rect = outline.getBoundingClientRect();
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    const r = Number(outline.getAttribute("r"));
    // Hueco de un anillo de este radio, con 1 px de margen para el antialias del borde.
    const hollow = Math.max(0.75, r - Number(outline.getAttribute("stroke-width")) / 2 - 1);
    let max = 0;
    let samples = 0;
    for (let py = Math.floor((cy - hollow) * scale); py <= Math.ceil((cy + hollow) * scale); py += 1) {
      for (let px = Math.floor((cx - hollow) * scale); px <= Math.ceil((cx + hollow) * scale); px += 1) {
        if (Math.hypot((px + 0.5) / scale - cx, (py + 0.5) / scale - cy) > hollow) continue;
        const i = (py * width + px) * 4;
        max = Math.max(max, ratio([data[i], data[i + 1], data[i + 2]], surface));
        samples += 1;
      }
    }
    const mark = group.querySelector("[data-milestone-mark]");
    return {
      completed: group.getAttribute("data-completed") === "true",
      shape: group.getAttribute("data-shape"),
      mark: mark && getComputedStyle(mark).display !== "none" ? mark.getAttribute("data-milestone-mark") : null,
      r,
      max,
      samples,
    };
  });
  return { viewBoxOk, milestones };
}

async function measure(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const shot = await page.screenshot();
  return page.evaluate(readMilestones, shot.toString("base64"));
}

/** Hitos que se confunden: un completado con el centro hueco o un activo con el centro relleno. */
function confusable(milestones: readonly MilestoneReport[]): string[] {
  return milestones.flatMap((m, i) => {
    const name = `hito ${i + 1} (${m.completed ? "completado" : "activo"}, ${m.shape}, r=${m.r})`;
    if (m.samples === 0) return [`${name}: sin píxeles en el centro`];
    if (m.completed && m.max < 3) return [`${name}: centro a ${m.max.toFixed(2)}:1 de surface, parece hueco`];
    if (!m.completed && m.max >= 1.5) return [`${name}: centro a ${m.max.toFixed(2)}:1 de surface, no está hueco`];
    return [];
  });
}

test("con 4, 17, 40 y 60 misiones los completados se distinguen por forma, en claro y en oscuro (AC-70)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const email = uniqueEmail("hitos");
  await signUp(page, email);
  const uid = await uidFor(request, email);

  // r = 7, 4.9, 2.5 y 2.5 a 360 px; 3.3 a 768 px y 4.4 a 1280 px con 60.
  const cases = [
    { viewport: { width: 360, height: 740 }, count: 4, shape: "check" },
    { viewport: { width: 360, height: 740 }, count: 17, shape: "check" },
    { viewport: { width: 360, height: 740 }, count: 40, shape: "dot" },
    { viewport: { width: 360, height: 740 }, count: 60, shape: "dot" },
    { viewport: { width: 768, height: 1024 }, count: 60, shape: "dot" },
    { viewport: { width: 1280, height: 800 }, count: 60, shape: "check" },
  ];
  for (const { viewport, count, shape } of cases) {
    await page.setViewportSize(viewport);
    const quests = route(count);
    await replaceQuestsByRest(request, uid, quests);
    const profile = page.getByRole("img", { name: profileLabel(quests), exact: true });
    await expect(profile).toBeVisible();
    await expect(profile.locator("[data-milestone]")).toHaveCount(count);

    for (const colorScheme of SCHEMES) {
      await page.emulateMedia({ colorScheme });
      const { viewBoxOk, milestones } = await measure(page);
      expect(viewBoxOk).toBe(true);
      expect(milestones).toHaveLength(count);
      const done = milestones.filter((m) => m.completed);
      expect(done).toHaveLength(quests.filter((q) => q.completed).length);
      expect(new Set(done.map((m) => m.shape))).toEqual(new Set([shape]));
      expect(new Set(milestones.filter((m) => !m.completed).map((m) => m.shape))).toEqual(new Set(["ring"]));
      // En claro la marca (check o núcleo) se ve en cada completado.
      if (colorScheme === "light") expect(done.map((m) => m.mark)).toEqual(done.map(() => shape));
      expect(confusable(milestones)).toEqual([]);
    }
  }
});

test("al completar y reabrir desde la tarjeta con 40 misiones, el hito pasa de anillo a núcleo y vuelve (AC-70)", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const email = uniqueEmail("hitos-ui");
  await signUp(page, email);
  const quests = route(40);
  await replaceQuestsByRest(request, await uidFor(request, email), quests);
  await expect(page.getByRole("img", { name: profileLabel(quests), exact: true })).toBeVisible();

  // "Misión 2" es Ladera y está activa: segundo hito por fecha de creación.
  const title = "Misión 2";
  await questCard(page, title).getByRole("button", { name: `Completar misión: ${title}` }).click();
  await expect(page.getByRole("img", { name: "11 de 40 misiones completadas, 290 XP", exact: true })).toBeVisible();
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    const { milestones } = await measure(page);
    expect(milestones[1]).toMatchObject({ completed: true, shape: "dot" });
    if (colorScheme === "light") expect(milestones[1].mark).toBe("dot");
    expect(confusable(milestones)).toEqual([]);
  }

  await questCard(page, title).getByRole("button", { name: `Reabrir misión: ${title}` }).click();
  await expect(page.getByRole("img", { name: profileLabel(quests), exact: true })).toBeVisible();
  const { milestones } = await measure(page);
  expect(milestones[1]).toMatchObject({ completed: false, shape: "ring", mark: null });
  expect(confusable(milestones)).toEqual([]);
});
