import { expect, test, type Page } from "@playwright/test";
import {
  createQuest,
  EXAMPLE_TITLES,
  PASSWORD,
  questCard,
  signIn,
  signOut,
  signUp,
  submitCredentials,
  uidFor,
  uniqueEmail,
} from "./helpers";

/**
 * AC-69 (b): tutorial (AC-63 a AC-66). Apertura automática una vez por UID y
 * navegador, diálogo modal accesible, 5 pasos, foco devuelto y almacenamiento
 * que lanza.
 */

const STEPS = [
  { title: "Tu ruta", target: "profile" },
  { title: "Nueva misión", target: "new-quest" },
  { title: "Elige el terreno", target: "terrain" },
  { title: "Filtra tu lista", target: "filters" },
  { title: "Completa, edita o elimina", target: "quest-card" },
];

function tutorial(page: Page) {
  return page.getByRole("dialog");
}

/** El foco está dentro del diálogo (o en <body> al dar la vuelta, como el <dialog> nativo). */
async function focusStaysInDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const active = document.activeElement;
    const dialog = document.querySelector("dialog[open]");
    return Boolean(dialog && (active === document.body || (active && dialog.contains(active))));
  });
}

/** Espera a que el dashboard esté listo y comprueba que el tutorial no se abre solo. */
async function expectNoAutoTutorial(page: Page) {
  await expect(page.getByRole("heading", { name: "Tus misiones" })).toBeVisible();
  await expect(page.locator("[data-quest-id]").first()).toBeVisible();
  await page.waitForTimeout(1_500);
  await expect(tutorial(page)).toHaveCount(0);
}

test("se abre solo la primera vez por UID, es modal y se cierra con Terminar, Esc o Saltar", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const emailA = uniqueEmail("tutorial-a");
  const emailB = uniqueEmail("tutorial-b");

  await page.goto("/");
  // Nunca sobre el acceso.
  await expect(tutorial(page)).toHaveCount(0);
  await submitCredentials(page, "Crear cuenta", emailA, PASSWORD);

  // Apertura automática con la lista ya cargada (las 4 de ejemplo existen).
  const dialog = page.getByRole("dialog", { name: "Tu ruta" });
  await expect(dialog).toBeVisible();
  for (const title of EXAMPLE_TITLES) await expect(questCard(page, title)).toBeAttached();
  await expect(dialog).toContainText("Paso 1 de 5");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Siguiente" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Anterior" })).toHaveAttribute("aria-disabled", "true");

  // Foco atrapado: 20 Tab y 20 Shift+Tab sin salir del diálogo.
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("Tab");
    expect(await focusStaysInDialog(page)).toBe(true);
  }
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("Shift+Tab");
    expect(await focusStaysInDialog(page)).toBe(true);
  }

  // Un clic en el fondo no hace nada.
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();

  // "Anterior" en el paso 1 está deshabilitado (aria-disabled, sigue enfocable) y no retrocede.
  await dialog.getByRole("button", { name: "Anterior" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toContainText("Paso 1 de 5");
  await expect(dialog.getByRole("button", { name: "Anterior" })).toBeFocused();

  // Los 5 pasos en orden, cada uno con su destino real resaltado.
  for (let i = 0; i < STEPS.length; i += 1) {
    const step = page.getByRole("dialog", { name: STEPS[i].title });
    await expect(step).toBeVisible();
    await expect(step).toContainText(`Paso ${i + 1} de 5`);
    await expect(page.locator(`[data-tour="${STEPS[i].target}"]`).first()).toBeInViewport();
    if (i < STEPS.length - 1) await step.getByRole("button", { name: "Siguiente" }).click();
  }
  const last = page.getByRole("dialog", { name: "Completa, edita o elimina" });
  await last.getByRole("button", { name: "Anterior" }).click();
  await expect(page.getByRole("dialog", { name: "Filtra tu lista" })).toContainText("Paso 4 de 5");
  await page.getByRole("dialog").getByRole("button", { name: "Siguiente" }).click();
  await last.getByRole("button", { name: "Terminar" }).click();
  await expect(tutorial(page)).toHaveCount(0);
  // Se abrió solo: el foco vuelve a "Ver tutorial", nunca a <body>.
  await expect(page.getByRole("button", { name: "Ver tutorial" })).toBeFocused();

  // La marca es por UID y no guarda datos personales (SEC-08).
  const uidA = await uidFor(request, emailA);
  const flags = await page.evaluate(() =>
    Object.entries(window.localStorage).filter(([key]) => !key.startsWith("firebase:")),
  );
  expect(flags).toEqual([[`questflow:tutorial:${uidA}`, "done"]]);
  expect(JSON.stringify(flags)).not.toContain(emailA);

  // No vuelve solo al recargar.
  await page.reload();
  await expectNoAutoTutorial(page);

  // "Ver tutorial" lo abre en el paso 1 tantas veces como se quiera: Esc y "Saltar" cierran.
  const open = page.getByRole("button", { name: "Ver tutorial" });
  await open.click();
  await expect(page.getByRole("dialog", { name: "Tu ruta" })).toContainText("Paso 1 de 5");
  await page.getByRole("dialog").getByRole("button", { name: "Siguiente" }).click();
  await page.keyboard.press("Escape");
  await expect(tutorial(page)).toHaveCount(0);
  await expect(open).toBeFocused();
  await open.click();
  await expect(page.getByRole("dialog", { name: "Tu ruta" })).toContainText("Paso 1 de 5");
  await page.getByRole("dialog").getByRole("button", { name: "Saltar" }).click();
  await expect(tutorial(page)).toHaveCount(0);
  await expect(open).toBeFocused();

  // Otra cuenta nueva en el mismo navegador sí lo ve (signUp lo comprueba y lo salta).
  await signOut(page);
  await signUp(page, emailB);
  await signOut(page);

  // A de nuevo: no se abre.
  await signIn(page, emailA);
  await expectNoAutoTutorial(page);
  const keys = await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith("questflow")));
  expect(keys.sort()).toEqual([`questflow:tutorial:${uidA}`, `questflow:tutorial:${await uidFor(request, emailB)}`].sort());

  expect(errors).toEqual([]);
});

const BLOCKED_STORAGE: Record<string, () => void> = {
  "getter de localStorage que lanza SecurityError": () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Almacenamiento bloqueado", "SecurityError");
      },
    });
  },
  "setItem que lanza QuotaExceededError": () => {
    Storage.prototype.setItem = function setItem() {
      throw new DOMException("Sin espacio", "QuotaExceededError");
    };
  },
};

for (const [variant, block] of Object.entries(BLOCKED_STORAGE)) {
  test(`almacenamiento bloqueado (${variant}): la app funciona y el tutorial no vuelve en la sesión`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(block);
    const email = uniqueEmail("sin-almacen");

    await page.goto("/");
    await signUp(page, email);
    await createQuest(page, "Misión sin almacenamiento", { difficulty: "Ladera" });
    await questCard(page, "Misión sin almacenamiento")
      .getByRole("button", { name: "Completar misión: Misión sin almacenamiento" })
      .click();
    await expect(questCard(page, "Misión sin almacenamiento").getByText("Hecha", { exact: true })).toBeVisible();

    // "Ver tutorial" sigue abriendo y cerrando.
    await page.getByRole("button", { name: "Ver tutorial" }).click();
    await expect(page.getByRole("dialog", { name: "Tu ruta" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tutorial(page)).toHaveCount(0);

    // Misma sesión de página: cerrar y abrir sesión no lo vuelve a abrir (respaldo en memoria).
    await signOut(page);
    await signIn(page, email);
    await expectNoAutoTutorial(page);

    expect(errors).toEqual([]);
  });
}

test("a 360 px los pasos sin destino visible usan el texto alternativo y siguen navegando", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await signUp(page, uniqueEmail("tutorial-movil"));

  // Sin misiones en "Hechas" y con el formulario plegado: terreno y tarjeta no tienen destino.
  await page.getByRole("group", { name: "Filtrar misiones" }).getByRole("button", { name: /^Hechas/ }).click();
  await expect(page.getByText("Todavía no has completado ninguna misión")).toBeVisible();
  await page.getByRole("button", { name: "Ver tutorial" }).click();
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 4; i += 1) await dialog.getByRole("button", { name: "Siguiente" }).click();
  await expect(dialog).toContainText("Paso 5 de 5");
  await expect(dialog).toContainText("Cuando tengas misiones, cada tarjeta tendrá Completar");
  await dialog.getByRole("button", { name: "Anterior" }).click();
  await dialog.getByRole("button", { name: "Anterior" }).click();
  await expect(dialog).toContainText("Paso 3 de 5");
  await expect(dialog).toContainText("Al desplegar Nueva misión eliges el terreno");
  await dialog.getByRole("button", { name: "Saltar" }).click();
  await expect(tutorial(page)).toHaveCount(0);
});
