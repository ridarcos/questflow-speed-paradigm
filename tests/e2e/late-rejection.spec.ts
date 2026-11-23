import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  createQuest,
  EXAMPLE_TITLES,
  FIRESTORE_EMULATOR,
  newQuestForm,
  PROJECT_ID,
  questCard,
  signUp,
  uniqueEmail,
} from "./helpers";

/**
 * QA-008: escrituras hechas sin conexión que el servidor rechaza al reconectar.
 * Cambia las reglas del emulador para denegar escrituras y las restaura al final.
 */

const DENY_WRITES_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/quests/{questId} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
  }
}`;

async function loadRules(request: APIRequestContext, content: string) {
  const response = await request.put(`${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}:securityRules`, {
    data: { rules: { files: [{ name: "firestore.rules", content }] } },
  });
  expect(response.ok()).toBeTruthy();
}

const realRules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

test.afterEach(async ({ request }) => {
  await loadRules(request, realRules);
});

test("un rechazo tardío retira el aviso de éxito y nombra cada cambio perdido", async ({ page, context, request }) => {
  await page.goto("/");
  await signUp(page, uniqueEmail("rechazo"));
  await createQuest(page, "SinRed");
  await expect(questCard(page, "SinRed").getByText("Pendiente de sincronizar")).toHaveCount(0);
  // Las 4 misiones de ejemplo ya están en el servidor antes de cambiar las reglas.
  for (const title of EXAMPLE_TITLES) await expect(questCard(page, title)).toBeVisible();
  await expect(page.locator("[data-quest-id]").getByText("Pendiente de sincronizar")).toHaveCount(0);

  await context.setOffline(true);
  const form = newQuestForm(page);

  // Creación sin conexión: se acepta en local y el aviso dice que está sin conexión.
  await form.getByLabel(/Título/).fill("Tardia");
  await form.getByLabel(/Descripción/).fill("Texto que no debe perderse");
  await form.getByRole("radio", { name: /Cumbre/ }).check();
  await form.getByRole("button", { name: "Crear misión" }).click();
  await expect(form.getByText(/Misión creada\..*al recuperar la conexión/)).toBeVisible();
  await expect(questCard(page, "Tardia").getByText("Pendiente de sincronizar")).toBeVisible();

  // Edición sin conexión.
  await questCard(page, "SinRed").getByRole("button", { name: "Editar misión: SinRed" }).click();
  const editor = page.locator("[data-quest-id] form");
  await editor.getByLabel(/Título/).fill("SinRed editada");
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(questCard(page, "SinRed editada")).toBeVisible();

  // El servidor rechazará ambas escrituras al reconectar.
  await loadRules(request, DENY_WRITES_RULES);
  await context.setOffline(false);

  const notices = page.getByRole("list", { name: "Cambios no sincronizados" }).getByRole("alert");
  await expect(notices).toHaveCount(2, { timeout: 30_000 });
  await expect(notices.filter({ hasText: "«Tardia»" })).toHaveCount(1);
  await expect(notices.filter({ hasText: "«SinRed» a «SinRed editada»" })).toHaveCount(1);

  // Estado coherente: sin aviso de éxito, la creación retirada y la edición revertida.
  await expect(form.getByText("Misión creada.")).toHaveCount(0);
  await expect(questCard(page, "Tardia")).toHaveCount(0);
  await expect(questCard(page, "SinRed")).toBeVisible();
  await expect(questCard(page, "SinRed editada")).toHaveCount(0);

  // QA-010: con un borrador en curso, restaurar pide confirmación; cancelar lo conserva.
  await form.getByLabel(/Título/).fill("Borrador en curso");
  const restoreButton = notices.filter({ hasText: "«Tardia»" }).getByRole("button", { name: "Restaurar en el formulario" });
  await restoreButton.click();
  const dialog = page.getByRole("dialog", { name: "¿Sustituir el borrador?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(form.getByLabel(/Título/)).toHaveValue("Borrador en curso");
  await expect(notices).toHaveCount(2);

  // El texto de la creación rechazada se puede recuperar confirmando la sustitución.
  await restoreButton.click();
  await dialog.getByRole("button", { name: "Sustituir borrador" }).click();
  await expect(dialog).toBeHidden();
  await expect(form.getByLabel(/Título/)).toHaveValue("Tardia");
  await expect(form.getByLabel(/Título/)).toBeFocused();
  await expect(form.getByLabel(/Descripción/)).toHaveValue("Texto que no debe perderse");
  await expect(form.getByRole("radio", { name: /Cumbre/ })).toBeChecked();
  await expect(notices).toHaveCount(1);

  // Cerrar el aviso restante.
  await notices.getByRole("button", { name: "Cerrar aviso" }).click();
  await expect(notices).toHaveCount(0);
});

test("QA-009: lo escrito mientras \"Creando…\" no se borra al terminar el envío", async ({ page, context }) => {
  await page.goto("/");
  await signUp(page, uniqueEmail("creando"));
  const form = newQuestForm(page);
  const title = form.getByLabel(/Título/);
  const description = form.getByLabel(/Descripción/);

  // Sin conexión el envío espera hasta 1,5 s, tiempo de sobra para seguir escribiendo.
  await context.setOffline(true);
  await title.fill("Primera");
  await form.getByRole("button", { name: "Crear misión" }).click();
  await expect(form.getByRole("button", { name: "Creando…" })).toBeVisible();
  await title.fill("Segunda escrita durante el envío");
  await description.fill("Nota nueva");
  await expect(form.getByText(/Misión creada\./)).toBeVisible();
  await expect(title).toHaveValue("Segunda escrita durante el envío");
  await expect(description).toHaveValue("Nota nueva");
  await expect(questCard(page, "Primera")).toBeVisible();

  // Sin cambios durante el envío, el formulario sí se vacía.
  await form.getByRole("button", { name: "Crear misión" }).click();
  await expect(form.getByText(/Misión creada\./)).toBeVisible();
  await expect(title).toHaveValue("");
  await expect(description).toHaveValue("");
  await expect(questCard(page, "Segunda escrita durante el envío")).toBeVisible();

  await context.setOffline(false);
  await expect(questCard(page, "Primera").getByText("Pendiente de sincronizar")).toHaveCount(0, { timeout: 30_000 });
});
