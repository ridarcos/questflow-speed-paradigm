import { expect, test, type Page } from "@playwright/test";
import { createQuest, deleteQuestFromUI, EXAMPLE_TITLES, questCard, signUp, uniqueEmail } from "./helpers";

/**
 * AC-69 (c): perfil de ruta (AC-55, AC-56). aria-label en vivo al completar,
 * reabrir, crear, cambiar terreno y borrar; una sola animación al completar y
 * ninguna con prefers-reduced-motion.
 */

function profile(page: Page, label: string) {
  return page.getByRole("img", { name: label, exact: true });
}

async function toggle(page: Page, title: string, action: "Completar" | "Reabrir") {
  await questCard(page, title).getByRole("button", { name: `${action} misión: ${title}` }).click();
  await expect(questCard(page, title).getByRole("button", { name: `${action === "Completar" ? "Reabrir" : "Completar"} misión: ${title}` })).toBeVisible();
}

/** Animaciones Web Animations del perfil (tramo recorrido e hitos), sin contar spinners. */
function profileAnimations(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && Boolean(target.closest("[data-route], [data-milestone]"));
      }).length,
  );
}

/** Distancia entre el final del tramo recorrido y el centro de un hito. */
function walkedEndDistance(page: Page, milestoneId: string): Promise<number> {
  return page.evaluate((id) => {
    const walked = document.querySelector<SVGPathElement>("[data-route='walked']");
    const circle = document.querySelector(`[data-milestone="${CSS.escape(id)}"] circle`);
    if (!walked || !circle) return Number.POSITIVE_INFINITY;
    const end = walked.getPointAtLength(walked.getTotalLength());
    return Math.hypot(end.x - Number(circle.getAttribute("cx")), end.y - Number(circle.getAttribute("cy")));
  }, milestoneId);
}

test("aria-label del perfil en vivo al completar, reabrir, crear, cambiar terreno y borrar", async ({ page }) => {
  await page.goto("/");
  await signUp(page, uniqueEmail("perfil"));
  const svg = page.locator("svg[role='img']");

  await expect(profile(page, "0 de 4 misiones completadas, 0 XP")).toBeVisible();
  await expect(svg.locator("[data-milestone]")).toHaveCount(4);
  await expect(svg.locator("[data-quest-id]")).toHaveCount(0);
  await expect(svg.locator("[data-route='walked']")).toHaveCount(0);
  await expect(svg.locator("[tabindex], a, button")).toHaveCount(0);

  await toggle(page, EXAMPLE_TITLES[0], "Completar");
  await expect(profile(page, "1 de 4 misiones completadas, 10 XP")).toBeVisible();
  await expect(svg.locator("[data-milestone][data-completed='true']")).toHaveCount(1);
  const firstId = await questCard(page, EXAMPLE_TITLES[0]).getAttribute("data-quest-id");
  expect(await walkedEndDistance(page, firstId ?? "")).toBeLessThanOrEqual(2);

  await toggle(page, EXAMPLE_TITLES[3], "Completar");
  await expect(profile(page, "2 de 4 misiones completadas, 60 XP")).toBeVisible();
  const lastId = await questCard(page, EXAMPLE_TITLES[3]).getAttribute("data-quest-id");
  expect(await walkedEndDistance(page, lastId ?? "")).toBeLessThanOrEqual(2);

  await toggle(page, EXAMPLE_TITLES[0], "Reabrir");
  await expect(profile(page, "1 de 4 misiones completadas, 50 XP")).toBeVisible();

  await createQuest(page, "Subir al Teide", { difficulty: "Ladera" });
  await expect(profile(page, "1 de 5 misiones completadas, 50 XP")).toBeVisible();
  await expect(svg.locator("[data-milestone]")).toHaveCount(5);

  // Cambiar el terreno de una completada cambia la XP ganada.
  await questCard(page, EXAMPLE_TITLES[3]).getByRole("button", { name: `Editar misión: ${EXAMPLE_TITLES[3]}` }).click();
  const editor = page.locator("[data-quest-id] form");
  await editor.getByRole("radio", { name: /Sendero/ }).check();
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(profile(page, "1 de 5 misiones completadas, 10 XP")).toBeVisible();

  await deleteQuestFromUI(page, EXAMPLE_TITLES[3]);
  await expect(profile(page, "0 de 4 misiones completadas, 0 XP")).toBeVisible();
  await expect(svg.locator("[data-milestone]")).toHaveCount(4);
  expect(await svg.evaluate((node) => node.outerHTML)).not.toMatch(/NaN|Infinity/);
});

test("una sola animación al completar y ninguna al cargar, filtrar ni con reduced motion", async ({ page }) => {
  await page.goto("/");
  await signUp(page, uniqueEmail("animacion"));
  await expect(profile(page, "0 de 4 misiones completadas, 0 XP")).toBeVisible();
  expect(await profileAnimations(page)).toBe(0);

  // Con movimiento: al completar se anima el perfil y termina en menos de 1 s.
  await questCard(page, EXAMPLE_TITLES[1]).getByRole("button", { name: `Completar misión: ${EXAMPLE_TITLES[1]}` }).click();
  await expect.poll(() => profileAnimations(page), { timeout: 2_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1_100);
  expect(await profileAnimations(page)).toBe(0);
  await expect(profile(page, "1 de 4 misiones completadas, 10 XP")).toBeVisible();

  // Filtros y recarga: sin animación.
  await page.getByRole("group", { name: "Filtrar misiones" }).getByRole("button", { name: /^Hechas/ }).click();
  expect(await profileAnimations(page)).toBe(0);
  await page.reload();
  await expect(profile(page, "1 de 4 misiones completadas, 10 XP")).toBeVisible();
  expect(await profileAnimations(page)).toBe(0);

  // Reduced motion: nada se mueve y el estado final es inmediato.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("group", { name: "Filtrar misiones" }).getByRole("button", { name: /^Todas/ }).click();
  await questCard(page, EXAMPLE_TITLES[2]).getByRole("button", { name: `Completar misión: ${EXAMPLE_TITLES[2]}` }).click();
  await expect(profile(page, "2 de 4 misiones completadas, 35 XP")).toBeVisible();
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("títulos con HTML se muestran como texto también en el perfil y el tutorial (SEC-09)", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.goto("/");
  await signUp(page, uniqueEmail("xss"));
  const titles = ["<img src=x onerror=alert(1)>", "</svg><script>alert(1)</script>"];
  for (const title of titles) await createQuest(page, title);
  for (const title of titles) await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(profile(page, "0 de 6 misiones completadas, 0 XP")).toBeVisible();
  await expect(page.locator("svg[role='img'] [data-milestone]")).toHaveCount(6);
  await page.getByRole("button", { name: "Ver tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "Tu ruta" })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(dialogs).toEqual([]);
});
