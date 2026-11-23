import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  createAccountByRest,
  deleteQuestFromUI,
  DENY_WRITES_RULES,
  EXAMPLE_TITLES,
  filterButton,
  loadRules,
  questCard,
  signIn,
  signOut,
  signUp,
  skipTutorial,
  stat,
  storedQuests,
  submitCredentials,
  uidFor,
  uniqueEmail,
} from "./helpers";

/**
 * AC-69 (a): misiones de ejemplo (AC-59 a AC-62). Recuentos por REST contra el
 * emulador con `Authorization: Bearer owner`.
 */

const EXPECTED = [
  { title: EXAMPLE_TITLES[0], description: "Pulsa Completar y mira cómo avanza tu ruta.", difficulty: "easy" },
  { title: EXAMPLE_TITLES[1], description: "Cambia el título, las notas o el terreno.", difficulty: "easy" },
  { title: EXAMPLE_TITLES[2], description: "Crea una misión por cada uno desde Nueva misión.", difficulty: "medium" },
  { title: EXAMPLE_TITLES[3], description: "Las cumbres valen 50 XP. Elige una de verdad.", difficulty: "hard" },
];

const realRules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

/** Registra pageerror, unhandledrejection y errores de consola desde el principio. */
async function watchErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && /permission|denied|FirebaseError/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  await page.addInitScript(() => {
    window.addEventListener("unhandledrejection", (event) => {
      console.error(`FirebaseError unhandledrejection: ${String(event.reason)}`);
    });
  });
  return errors;
}

/** Sondea el DOM cada 50 ms: ¿llegó a verse el estado vacío con "Añadir misiones de ejemplo"? */
async function startEmptyStateProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __sawEmptyState: boolean; __probe: number };
    w.__sawEmptyState = false;
    w.__probe = window.setInterval(() => {
      if (document.body.innerText.includes("Añadir misiones de ejemplo")) w.__sawEmptyState = true;
    }, 50);
  });
}

async function stopEmptyStateProbe(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const w = window as unknown as { __sawEmptyState: boolean; __probe: number };
    window.clearInterval(w.__probe);
    return w.__sawEmptyState;
  });
}

test.afterEach(async ({ request }) => {
  await loadRules(request, realRules);
});

test("registro: 4 misiones de ejemplo literales, una sola vez, y no vuelven si se borran", async ({ page, request }) => {
  const errors = await watchErrors(page);
  const email = uniqueEmail("ejemplos");
  await page.goto("/");

  // Durante la siembra inicial nunca aparece el estado vacío con el botón.
  await startEmptyStateProbe(page);
  await submitCredentials(page, "Crear cuenta", email, "secreto-e2e-123");
  await skipTutorial(page);
  for (const title of EXAMPLE_TITLES) await expect(questCard(page, title)).toBeVisible();
  expect(await stopEmptyStateProbe(page)).toBe(false);

  // Por REST: exactamente 4 documentos literales, con los 6 campos y en orden fijo.
  const uid = await uidFor(request, email);
  const stored = await storedQuests(request, uid);
  expect(stored).toHaveLength(4);
  expect(
    stored.map((quest) => ({
      title: quest.fields.title.stringValue,
      description: quest.fields.description.stringValue,
      difficulty: quest.fields.difficulty.stringValue,
    })),
  ).toEqual(EXPECTED);
  for (const quest of stored) {
    expect(Object.keys(quest.fields).sort()).toEqual(["completed", "createdAt", "description", "difficulty", "title", "updatedAt"]);
    expect(quest.fields.completed.booleanValue).toBe(false);
  }
  expect(new Set(stored.map((quest) => quest.createdAt)).size).toBe(4);

  // El perfil de ruta dibuja un hito por misión, de la más antigua a la más reciente.
  const milestoneOrder = await page.locator("svg[role='img'] [data-milestone]").evaluateAll((nodes) =>
    nodes
      .map((node) => ({ id: node.getAttribute("data-milestone"), x: Number(node.querySelector("circle")?.getAttribute("cx")) }))
      .sort((a, b) => a.x - b.x)
      .map((milestone) => milestone.id),
  );
  expect(milestoneOrder).toEqual(stored.map((quest) => quest.id));

  // Recargar y cerrar/abrir sesión no las repite.
  await page.reload();
  await expect(questCard(page, EXAMPLE_TITLES[0])).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(await storedQuests(request, uid)).toHaveLength(4);
  await signOut(page);
  await signIn(page, email);
  await expect(page.locator("[data-quest-id]")).toHaveCount(4);
  await page.waitForTimeout(2_000);
  expect(await storedQuests(request, uid)).toHaveLength(4);

  // Si se borran, no vuelven: 0 misiones, "0" y "0 %", también en el perfil.
  for (const title of EXAMPLE_TITLES) await deleteQuestFromUI(page, title);
  await expect(stat(page, "Misiones")).toHaveText("0");
  await expect(stat(page, "Progreso")).toHaveText("0 %");
  await expect(page.getByRole("img", { name: "0 de 0 misiones completadas, 0 XP" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Añadir misiones de ejemplo" })).toBeVisible();
  expect(await storedQuests(request, uid)).toHaveLength(0);

  await page.reload();
  await expect(page.getByText("Aún no tienes misiones")).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(await storedQuests(request, uid)).toHaveLength(0);
  await signOut(page);
  await signIn(page, email);
  await expect(page.getByText("Aún no tienes misiones")).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(await storedQuests(request, uid)).toHaveLength(0);
  await expect(page.locator("[data-quest-id]")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("tres cuentas nuevas reciben las misiones de ejemplo en el mismo orden", async ({ page, request }) => {
  await page.goto("/");
  for (let i = 0; i < 3; i += 1) {
    const email = uniqueEmail(`orden-${i}`);
    await signUp(page, email);
    const stored = await storedQuests(request, await uidFor(request, email));
    expect(stored.map((quest) => quest.fields.title.stringValue)).toEqual([...EXAMPLE_TITLES]);
    await signOut(page);
  }
});

test("cuenta antigua: el botón aparece solo en el vacío de Todas y un doble clic crea 4", async ({ page, request }) => {
  const errors = await watchErrors(page);
  const email = uniqueEmail("antigua");
  const uid = await createAccountByRest(request, email);

  await page.goto("/");
  await submitCredentials(page, "Iniciar sesión", email, "secreto-e2e-123");
  // Primera vez de esta cuenta en este navegador: tutorial (sin destino de tarjeta).
  await skipTutorial(page);
  await expect(page.getByText("Aún no tienes misiones")).toBeVisible();
  expect(await storedQuests(request, uid)).toHaveLength(0);

  const addExamples = page.getByRole("button", { name: "Añadir misiones de ejemplo" });
  await expect(addExamples).toBeVisible();
  await addExamples.dblclick();

  for (const title of EXAMPLE_TITLES) await expect(questCard(page, title)).toBeVisible();
  await expect(page.locator("[data-quest-id]")).toHaveCount(4);
  await page.waitForTimeout(2_000);
  const stored = await storedQuests(request, uid);
  expect(stored.map((quest) => quest.fields.title.stringValue)).toEqual([...EXAMPLE_TITLES]);

  // Al terminar, el foco está en el encabezado de la lista (nunca en <body>).
  await expect(page.getByRole("heading", { name: "Tus misiones" })).toBeFocused();

  // Con misiones, los vacíos de "Activas" y "Hechas" no ofrecen el botón.
  await filterButton(page, "Hechas").click();
  await expect(page.getByText("Todavía no has completado ninguna misión")).toBeVisible();
  await expect(addExamples).toHaveCount(0);
  for (const title of EXAMPLE_TITLES) {
    await filterButton(page, "Todas").click();
    await questCard(page, title).getByRole("button", { name: `Completar misión: ${title}` }).click();
    await expect(questCard(page, title).getByText("Hecha", { exact: true })).toBeVisible();
  }
  await filterButton(page, "Activas").click();
  await expect(page.getByText("No tienes misiones activas")).toBeVisible();
  await expect(addExamples).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("siembra rechazada: el registro llega al dashboard con un único aviso y sin reintentos", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener("unhandledrejection", (event) => {
      (window as unknown as { __rejections?: string[] }).__rejections ??= [];
      (window as unknown as { __rejections: string[] }).__rejections.push(String(event.reason));
    });
  });
  await loadRules(request, DENY_WRITES_RULES);

  await page.goto("/");
  await signUp(page, uniqueEmail("denegada"));
  const notice = page.getByRole("alert").filter({ hasText: "No se pudieron crear las misiones de ejemplo" });
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText("Firestore ha denegado la operación");
  await expect(page.getByText("Aún no tienes misiones")).toBeVisible();

  // Sin bucles: el número de avisos no crece.
  await page.waitForTimeout(2_000);
  const alertsAt2s = await page.getByRole("alert").count();
  await page.waitForTimeout(10_000);
  expect(await page.getByRole("alert").count()).toBe(alertsAt2s);
  await expect(notice).toHaveCount(1);

  // El botón vuelve a fallar con el mismo único aviso.
  await page.getByRole("button", { name: "Añadir misiones de ejemplo" }).click();
  await expect(page.getByRole("button", { name: "Añadir misiones de ejemplo" })).toBeVisible();
  await expect(notice).toHaveCount(1);
  await notice.getByRole("button", { name: "Cerrar aviso" }).click();
  await expect(notice).toHaveCount(0);

  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { __rejections?: string[] }).__rejections ?? [])).toEqual([]);
});
