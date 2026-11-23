import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Proyecto ficticio del emulador (coincide con playwright.config.ts y test:e2e). */
export const PROJECT_ID = "demo-questflow";
export const AUTH_EMULATOR = "http://127.0.0.1:9099";
export const FIRESTORE_EMULATOR = "http://127.0.0.1:8080";
export const PASSWORD = "secreto-e2e-123";

/** Las 4 misiones de ejemplo de toda cuenta nueva, en orden de creación (docs/DESIGN_DIRECTION.md). */
export const EXAMPLE_TITLES = [
  "Marca esta misión como completada",
  "Edita esta misión y hazla tuya",
  "Planifica tres objetivos para esta semana",
  "Termina ese proyecto que llevas tiempo aplazando",
] as const;

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

/**
 * Registro desde la UI. Una cuenta nueva abre sola el tutorial (con la lista y
 * las misiones de ejemplo ya cargadas): se comprueba y se cierra con "Saltar".
 */
export async function signUp(page: Page, email: string, password = PASSWORD): Promise<void> {
  await submitCredentials(page, "Crear cuenta", email, password);
  await skipTutorial(page);
  await expectSignedIn(page);
}

/** El tutorial está abierto en el paso 1: se cierra con "Saltar". */
export async function skipTutorial(page: Page): Promise<void> {
  const tutorial = page.getByRole("dialog", { name: "Tu ruta" });
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toContainText("Paso 1 de 5");
  await tutorial.getByRole("button", { name: "Saltar" }).click();
  await expect(tutorial).toBeHidden();
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
  options: { description?: string; difficulty?: "Sendero" | "Ladera" | "Cumbre" } = {},
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

/** Elimina una misión desde su tarjeta, confirmando en el diálogo. */
export async function deleteQuestFromUI(page: Page, title: string): Promise<void> {
  await questCard(page, title).getByRole("button", { name: `Eliminar misión: ${title}` }).click();
  const dialog = page.getByRole("dialog", { name: "¿Eliminar misión?" });
  await dialog.getByRole("button", { name: "Eliminar misión" }).click();
  await expect(dialog).toBeHidden();
  await expect(questCard(page, title)).toHaveCount(0);
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

export function filterButton(page: Page, name: "Todas" | "Activas" | "Hechas") {
  return page.getByRole("group", { name: "Filtrar misiones" }).getByRole("button", { name: new RegExp(`^${name}`) });
}

/* ------------------------------------------------------------------ */
/* Lectura directa del emulador (pruebas de la Fase 5)                 */
/* ------------------------------------------------------------------ */

/** UID de una cuenta del emulador (inicia sesión por REST; no toca la UI). */
export async function uidFor(request: APIRequestContext, email: string, password = PASSWORD): Promise<string> {
  const res = await request.post(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    { data: { email, password, returnSecureToken: true } },
  );
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { localId: string }).localId;
}

/** "Cuenta antigua": creada por REST, sin pasar por la UI (no recibe misiones de ejemplo). */
export async function createAccountByRest(request: APIRequestContext, email: string, password = PASSWORD): Promise<string> {
  const res = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    data: { email, password, returnSecureToken: true },
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { localId: string }).localId;
}

export interface StoredQuest {
  id: string;
  fields: Record<string, Record<string, unknown>>;
  createdAt: string;
}

/** Marca de tiempo de Firestore comparable como texto (fracción a 9 cifras). */
function timestampKey(value: string): string {
  const match = /^(.*?)(?:\.(\d+))?Z$/.exec(value);
  return match ? `${match[1]}.${(match[2] ?? "").padEnd(9, "0")}` : value;
}

/** Misiones guardadas de `uid`, leídas por REST como administrador del emulador, por createdAt ascendente. */
export async function storedQuests(request: APIRequestContext, uid: string): Promise<StoredQuest[]> {
  const res = await request.get(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/quests`,
    { headers: { Authorization: "Bearer owner" } },
  );
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { documents?: { name: string; fields: StoredQuest["fields"] }[] };
  return (body.documents ?? [])
    .map((doc) => ({
      id: doc.name.split("/").pop() ?? "",
      fields: doc.fields,
      createdAt: String(doc.fields.createdAt?.timestampValue ?? ""),
    }))
    .sort((a, b) => timestampKey(a.createdAt).localeCompare(timestampKey(b.createdAt)));
}

export interface RouteQuest {
  difficulty: "easy" | "medium" | "hard";
  completed: boolean;
}

/**
 * Deja en `uid` exactamente las misiones `quests`, en ese orden de creación,
 * escribiendo por REST como administrador del emulador (un solo commit). Sirve
 * para preparar rutas largas (40 o 60 hitos) sin pasar 60 veces por el
 * formulario. Los documentos llevan solo los 6 campos de la app (AC-11), así
 * que la app los lee igual que los suyos.
 */
export async function replaceQuestsByRest(
  request: APIRequestContext,
  uid: string,
  quests: readonly RouteQuest[],
): Promise<void> {
  const documents = `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/quests`;
  const ids = quests.map((_, i) => `ruta-${String(i).padStart(3, "0")}`);
  const start = Date.parse("2026-01-01T09:00:00Z");
  const stale = (await storedQuests(request, uid)).filter((quest) => !ids.includes(quest.id));
  const writes = [
    ...stale.map((quest) => ({ delete: `${documents}/${quest.id}` })),
    ...quests.map((quest, i) => {
      const at = new Date(start + i * 60_000).toISOString();
      return {
        update: {
          name: `${documents}/${ids[i]}`,
          fields: {
            title: { stringValue: `Misión ${i + 1}` },
            description: { stringValue: "" },
            difficulty: { stringValue: quest.difficulty },
            completed: { booleanValue: quest.completed },
            createdAt: { timestampValue: at },
            updatedAt: { timestampValue: at },
          },
        },
      };
    }),
  ];
  const res = await request.post(`${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`, {
    headers: { Authorization: "Bearer owner" },
    data: { writes },
  });
  expect(res.ok()).toBeTruthy();
}

/** Reglas que dejan leer al dueño pero deniegan toda escritura. */
export const DENY_WRITES_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/quests/{questId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
  }
}`;

/** Carga unas reglas en el emulador de Firestore. */
export async function loadRules(request: APIRequestContext, content: string): Promise<void> {
  const response = await request.put(`${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}:securityRules`, {
    data: { rules: { files: [{ name: "firestore.rules", content }] } },
  });
  expect(response.ok()).toBeTruthy();
}

/** Sin scroll horizontal y ningún elemento visible sobresale por la derecha. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const width = window.innerWidth;
    const offenders: string[] = [];
    for (const element of document.querySelectorAll<Element>("body *")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (getComputedStyle(element).visibility === "hidden") continue;
      if (rect.right > width + 0.5) {
        offenders.push(`${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""} right=${Math.round(rect.right)}`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, width, offenders: offenders.slice(0, 5) };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.width);
  expect(overflow.offenders).toEqual([]);
}

