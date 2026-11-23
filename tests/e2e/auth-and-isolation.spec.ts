import { expect, test } from "@playwright/test";
import {
  AUTH_EMULATOR,
  createQuest,
  EXAMPLE_TITLES,
  FIRESTORE_EMULATOR,
  PASSWORD,
  PROJECT_ID,
  questCard,
  resetEmulators,
  signIn,
  signOut,
  signUp,
  submitCredentials,
  uniqueEmail,
} from "./helpers";

test.beforeAll(async ({ request }) => {
  await resetEmulators(request);
});

test.describe("validaciones de acceso", () => {
  test("campos vacíos, email mal formado y contraseña corta se rechazan sin llamar a Firebase", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("form").filter({ has: page.getByLabel("Contraseña") });

    await submitCredentials(page, "Iniciar sesión", "", "");
    await expect(form.getByText("Introduce tu email.")).toBeVisible();
    await expect(form.getByText("Introduce tu contraseña.")).toBeVisible();
    await expect(form.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

    await submitCredentials(page, "Crear cuenta", "no-es-un-email", "123");
    await expect(form.getByText(/formato válido/)).toBeVisible();
    await expect(form.getByText("La contraseña debe tener al menos 6 caracteres.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
  });

  test("credenciales incorrectas y email duplicado muestran errores traducidos", async ({ page }) => {
    const email = uniqueEmail("duplicado");
    await page.goto("/");

    await submitCredentials(page, "Iniciar sesión", email, PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: "Email o contraseña incorrectos." })).toBeVisible();

    await signUp(page, email);
    await signOut(page);

    await submitCredentials(page, "Crear cuenta", email, PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: "Ya existe una cuenta con este email." })).toBeVisible();

    await submitCredentials(page, "Iniciar sesión", email, "otra-clave-mala");
    await expect(page.getByRole("alert").filter({ hasText: "Email o contraseña incorrectos." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
  });
});

test("aislamiento: dos usuarios no ven ni pueden leer las misiones del otro", async ({ page, request }) => {
  const emailA = uniqueEmail("usuario-a");
  const emailB = uniqueEmail("usuario-b");

  await page.goto("/");
  await signUp(page, emailA);
  await createQuest(page, "Secreto de A");
  await signOut(page);

  await signUp(page, emailB);
  // B solo ve sus 4 misiones de ejemplo.
  for (const title of EXAMPLE_TITLES) await expect(questCard(page, title)).toBeVisible();
  await expect(page.locator("[data-quest-id]")).toHaveCount(4);
  await expect(page.getByText("Secreto de A")).toHaveCount(0);
  await createQuest(page, "Misión de B");
  await signOut(page);

  await signIn(page, emailA);
  await expect(questCard(page, "Secreto de A")).toBeVisible();
  await expect(page.getByText("Misión de B")).toHaveCount(0);
  await expect(page.locator("[data-quest-id]")).toHaveCount(5);

  // Comprobación directa contra las reglas: con el token de B, la ruta de A da 403.
  const login = async (email: string) => {
    const res = await request.post(
      `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
      { data: { email, password: PASSWORD, returnSecureToken: true } },
    );
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as { idToken: string; localId: string };
  };
  const a = await login(emailA);
  const b = await login(emailB);
  const questsOf = (uid: string) =>
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/quests`;

  const titlesIn = async (response: { json: () => Promise<unknown> }) =>
    (((await response.json()) as { documents?: { fields: { title: { stringValue: string } } }[] }).documents ?? [])
      .map((d) => d.fields.title.stringValue)
      .sort();

  const own = await request.get(questsOf(b.localId), { headers: { Authorization: `Bearer ${b.idToken}` } });
  expect(own.status()).toBe(200);
  // SEC-10: cada colección contiene solo lo suyo (sus 4 de ejemplo y lo que creó).
  expect(await titlesIn(own)).toEqual([...EXAMPLE_TITLES, "Misión de B"].sort());
  const ownA = await request.get(questsOf(a.localId), { headers: { Authorization: `Bearer ${a.idToken}` } });
  expect(ownA.status()).toBe(200);
  expect(await titlesIn(ownA)).toEqual([...EXAMPLE_TITLES, "Secreto de A"].sort());
  const cross = await request.get(questsOf(a.localId), { headers: { Authorization: `Bearer ${b.idToken}` } });
  expect(cross.status()).toBe(403);
  const anonymous = await request.get(questsOf(a.localId));
  expect(anonymous.status()).toBe(403);
});
