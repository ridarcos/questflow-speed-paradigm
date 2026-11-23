import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Proyecto ficticio del emulador (coincide con playwright.config.ts y test:e2e). */
export const PROJECT_ID = "demo-questflow";
export const AUTH_EMULATOR = "http://127.0.0.1:9099";
export const FIRESTORE_EMULATOR = "http://127.0.0.1:8080";
export const PASSWORD = "secreto-e2e-123";

let counter = 0;
/** Email único por ejecución para no depender del estado del emulador. */
export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.test`;
}

/** Borra todas las cuentas y documentos del emulador (solo funciona contra emuladores). */
export async function resetEmulators(request: APIRequestContext): Promise<void> {
  const auth = await request.delete(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`);
  expect(auth.ok()).toBeTruthy();
  const db = await request.delete(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
  );
  expect(db.ok()).toBeTruthy();
}

function authForm(page: Page) {
  return page.locator("form").filter({ has: page.getByLabel("Contraseña") });
}

export async function chooseMode(page: Page, mode: "Crear cuenta" | "Iniciar sesión"): Promise<void> {
  await page.getByRole("group", { name: "Modo de acceso" }).getByRole("button", { name: mode }).click();
}

export async function submitCredentials(
  page: Page,
  mode: "Crear cuenta" | "Iniciar sesión",
  email: string,
  password: string,
): Promise<void> {
  await chooseMode(page, mode);
  const form = authForm(page);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Contraseña").fill(password);
  await form.getByRole("button", { name: mode }).click();
}

export async function signUp(page: Page, email: string, password = PASSWORD): Promise<void> {
  await submitCredentials(page, "Crear cuenta", email, password);
  await expectSignedIn(page);
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await submitCredentials(page, "Iniciar sesión", email, password);
  await expectSignedIn(page);
}

export async function expectSignedIn(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tus misiones" })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("heading", { name: /Inicia sesión|Crea tu cuenta/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tus misiones" })).toHaveCount(0);
}

/** Formulario de nueva misión (sección "Nueva misión"). */
export function newQuestForm(page: Page) {
  return page.locator("section[aria-labelledby='new-quest-heading'] form");
}

export async function createQuest(
  page: Page,
  title: string,
  options: { description?: string; difficulty?: "Fácil" | "Media" | "Difícil" } = {},
): Promise<void> {
  const form = newQuestForm(page);
  await form.getByLabel(/Título/).fill(title);
  if (options.description !== undefined) {
    await form.getByLabel(/Descripción/).fill(options.description);
  }
  if (options.difficulty) {
    await form.getByRole("radio", { name: new RegExp(options.difficulty) }).check();
  }
  await form.getByRole("button", { name: "Crear misión" }).click();
  await expect(questCard(page, title)).toBeVisible();
}

/** Tarjeta de una misión por su título exacto. */
export function questCard(page: Page, title: string) {
  return page.locator("[data-quest-id]").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

/** Valor de una estadística del panel (Misiones, Completadas, XP ganada, Progreso). */
export function stat(page: Page, label: string) {
  return page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");
}

export function filterButton(page: Page, name: "Todas" | "Activas" | "Completadas") {
  return page.getByRole("group", { name: "Filtrar misiones" }).getByRole("button", { name: new RegExp(`^${name}`) });
}
