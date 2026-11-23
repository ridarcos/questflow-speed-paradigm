import { expect, test, type Locator, type Page } from "@playwright/test";
import { EXAMPLE_TITLES, expectNoHorizontalOverflow, PASSWORD, questCard, submitCredentials, uniqueEmail } from "./helpers";

/**
 * AC-69 (d): a 360, 768 y 1280 px no hay scroll horizontal con las misiones de
 * ejemplo ni con el tutorial abierto (AC-54). En cada paso el diálogo cabe
 * entero y no tapa del todo su destino (AC-65).
 */

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

const TARGETS = ["profile", "new-quest", "terrain", "filters", "quest-card"];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function contains(outer: Box, inner: Box): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.width >= inner.x + inner.width &&
    outer.y + outer.height >= inner.y + inner.height
  );
}

async function firstVisible(page: Page, selector: string): Promise<Locator | null> {
  const all = page.locator(selector);
  const count = await all.count();
  for (let i = 0; i < count; i += 1) {
    if (await all.nth(i).isVisible()) return all.nth(i);
  }
  return null;
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.width} px: sin scroll horizontal con las misiones de ejemplo y el tutorial abierto`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expectNoHorizontalOverflow(page);

    await submitCredentials(page, "Crear cuenta", uniqueEmail(`ancho-${viewport.width}`), PASSWORD);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (let step = 0; step < TARGETS.length; step += 1) {
      await expect(dialog).toContainText(`Paso ${step + 1} de 5`);
      await expectNoHorizontalOverflow(page);

      // El diálogo cabe entero en el viewport.
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

      // Si el destino se ve, está en el viewport y el diálogo no lo tapa entero.
      const target = await firstVisible(page, `[data-tour="${TARGETS[step]}"]`);
      if (target) {
        await expect(target).toBeInViewport();
        const targetBox = await target.boundingBox();
        expect(targetBox).not.toBeNull();
        if (targetBox) expect(contains(box, targetBox)).toBe(false);
      } else {
        await expect(dialog).toHaveAttribute("data-side", "center");
      }

      if (step < TARGETS.length - 1) await dialog.getByRole("button", { name: "Siguiente" }).click();
    }
    await dialog.getByRole("button", { name: "Terminar" }).click();
    await expect(dialog).toHaveCount(0);

    for (const title of EXAMPLE_TITLES) await expect(questCard(page, title)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
