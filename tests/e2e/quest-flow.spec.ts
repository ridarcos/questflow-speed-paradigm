import { expect, test } from "@playwright/test";
import {
  createQuest,
  deleteQuestFromUI,
  EXAMPLE_TITLES,
  filterButton,
  questCard,
  resetEmulators,
  signIn,
  signOut,
  signUp,
  stat,
  uniqueEmail,
} from "./helpers";

test.beforeAll(async ({ request }) => {
  await resetEmulators(request);
});

test("flujo completo: registro, CRUD, filtros, persistencia y cierre de sesión", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  const email = uniqueEmail("flujo");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "QuestFlow" })).toBeVisible();

  // Registro: la cuenta nueva trae exactamente las 4 misiones de ejemplo
  await signUp(page, email);
  for (const title of EXAMPLE_TITLES) await expect(questCard(page, title)).toBeVisible();
  await expect(page.locator("[data-quest-id]")).toHaveCount(4);
  await expect(page.getByText("Aún no tienes misiones")).toHaveCount(0);
  await expect(stat(page, "Misiones")).toHaveText("4");
  await expect(stat(page, "Progreso")).toHaveText("0 %");

  // Crear: un sendero y una cumbre
  await createQuest(page, "Leer 20 páginas", { description: "Antes de dormir", difficulty: "Sendero" });
  await expect(page.getByText("Misión creada.")).toBeVisible();
  await createQuest(page, "Correr 5 km", { difficulty: "Cumbre" });
  await expect(stat(page, "Misiones")).toHaveText("6");
  await expect(stat(page, "XP ganada")).toHaveText("0");

  // Completar
  const hard = questCard(page, "Correr 5 km");
  await hard.getByRole("button", { name: "Completar misión: Correr 5 km" }).click();
  await expect(hard.getByText("Hecha", { exact: true })).toBeVisible();
  await expect(stat(page, "Completadas")).toHaveText("1");
  await expect(stat(page, "XP ganada")).toHaveText("50");
  await expect(stat(page, "Progreso")).toHaveText("17 %");

  // Editar: título, descripción y terreno
  await questCard(page, "Leer 20 páginas").getByRole("button", { name: "Editar misión: Leer 20 páginas" }).click();
  const editor = page.locator("[data-quest-id] form");
  await editor.getByLabel(/Título/).fill("Leer 30 páginas");
  await editor.getByLabel(/Descripción/).fill("Novela del club de lectura");
  await editor.getByRole("radio", { name: /Ladera/ }).check();
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  const edited = questCard(page, "Leer 30 páginas");
  await expect(edited).toBeVisible();
  await expect(edited.getByText("Novela del club de lectura")).toBeVisible();
  await expect(edited.getByText("Ladera", { exact: true })).toBeVisible();
  await expect(edited.getByText("25 XP", { exact: true })).toBeVisible();
  await expect(questCard(page, "Leer 20 páginas")).toHaveCount(0);

  // Filtros
  await filterButton(page, "Activas").click();
  await expect(filterButton(page, "Activas")).toHaveAttribute("aria-pressed", "true");
  await expect(filterButton(page, "Todas")).toHaveAttribute("aria-pressed", "false");
  await expect(questCard(page, "Leer 30 páginas")).toBeVisible();
  await expect(questCard(page, "Correr 5 km")).toHaveCount(0);
  await expect(page.locator("[data-quest-id]")).toHaveCount(5);

  await filterButton(page, "Hechas").click();
  await expect(filterButton(page, "Hechas")).toHaveAttribute("aria-pressed", "true");
  await expect(questCard(page, "Correr 5 km")).toBeVisible();
  await expect(questCard(page, "Leer 30 páginas")).toHaveCount(0);
  await expect(page.locator("[data-quest-id]")).toHaveCount(1);

  await filterButton(page, "Todas").click();
  await expect(page.locator("[data-quest-id]")).toHaveCount(6);

  // Eliminar: cancelar no borra; confirmar sí
  await questCard(page, "Correr 5 km").getByRole("button", { name: "Eliminar misión: Correr 5 km" }).click();
  const dialog = page.getByRole("dialog", { name: "¿Eliminar misión?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("«Correr 5 km»");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(questCard(page, "Correr 5 km")).toBeVisible();

  await questCard(page, "Correr 5 km").getByRole("button", { name: "Eliminar misión: Correr 5 km" }).click();
  await dialog.getByRole("button", { name: "Eliminar" }).click();
  await expect(dialog).toBeHidden();
  await expect(questCard(page, "Correr 5 km")).toHaveCount(0);
  await expect(stat(page, "Misiones")).toHaveText("5");
  await expect(stat(page, "XP ganada")).toHaveText("0");

  // Recarga: los datos siguen en Firestore (emulador)
  await page.reload();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  const persisted = questCard(page, "Leer 30 páginas");
  await expect(persisted).toBeVisible();
  await expect(persisted.getByText("Novela del club de lectura")).toBeVisible();
  await expect(questCard(page, "Correr 5 km")).toHaveCount(0);
  await expect(stat(page, "Misiones")).toHaveText("5");

  // Cerrar sesión oculta los datos; al volver a entrar siguen ahí
  await signOut(page);
  await expect(page.getByText("Leer 30 páginas")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
  await signIn(page, email);
  await expect(questCard(page, "Leer 30 páginas")).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("la validación del formulario de misión no envía datos inválidos", async ({ page }) => {
  await page.goto("/");
  await signUp(page, uniqueEmail("validacion"));
  // Se parte de una lista vacía: las 4 misiones de ejemplo se borran desde la UI.
  for (const title of EXAMPLE_TITLES) await deleteQuestFromUI(page, title);
  // AC-27: con 0 misiones, "0" y "0 %", también en el perfil de ruta.
  await expect(stat(page, "Misiones")).toHaveText("0");
  await expect(stat(page, "Progreso")).toHaveText("0 %");
  await expect(page.getByRole("img", { name: "0 de 0 misiones completadas, 0 XP" })).toBeVisible();
  const form = page.locator("section[aria-labelledby='new-quest-heading'] form");

  await form.getByLabel(/Título/).fill("    ");
  await form.getByRole("button", { name: "Crear misión" }).click();
  await expect(form.getByRole("alert")).toHaveText("El título es obligatorio.");
  await expect(form.getByLabel(/Título/)).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("[data-quest-id]")).toHaveCount(0);
  await expect(page.getByText("Aún no tienes misiones")).toBeVisible();

  // El campo limita a 80 caracteres; lo creado nunca supera el máximo
  await form.getByLabel(/Título/).fill("x".repeat(100));
  const value = await form.getByLabel(/Título/).inputValue();
  expect(value.length).toBeLessThanOrEqual(80);
});
