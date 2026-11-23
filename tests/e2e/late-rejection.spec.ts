import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createQuest, FIRESTORE_EMULATOR, newQuestForm, PROJECT_ID, questCard, signUp, uniqueEmail } from "./helpers";

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

  await context.setOffline(true);
  const form = newQuestForm(page);

  // Creación sin conexión: se acepta en local y el aviso dice que está sin conexión.
  await form.getByLabel(/Título/).fill("Tardia");
  await form.getByLabel(/Descripción/).fill("Texto que no debe perderse");
  await form.getByRole("radio", { name: /Difícil/ }).check();
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

  // El texto de la creación rechazada se puede recuperar.
  await notices.filter({ hasText: "«Tardia»" }).getByRole("button", { name: "Restaurar en el formulario" }).click();
  await expect(form.getByLabel(/Título/)).toHaveValue("Tardia");
  await expect(form.getByLabel(/Título/)).toBeFocused();
  await expect(form.getByLabel(/Descripción/)).toHaveValue("Texto que no debe perderse");
  await expect(form.getByRole("radio", { name: /Difícil/ })).toBeChecked();
  await expect(notices).toHaveCount(1);

  // Cerrar el aviso restante.
  await notices.getByRole("button", { name: "Cerrar aviso" }).click();
  await expect(notices).toHaveCount(0);
});
