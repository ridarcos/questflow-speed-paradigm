import { defineConfig, devices } from "@playwright/test";

/**
 * E2E de QuestFlow contra los emuladores de Firebase (Auth 9099, Firestore 8080).
 *
 * Ejecutar con `npm run test:e2e`: arranca los emuladores con el proyecto
 * demo-questflow y lanza Playwright. El webServer compila y sirve la app en un
 * directorio aparte (.next-e2e) con configuración ficticia, así que nunca usa
 * el proyecto real ni pisa el build normal de `.next`.
 *
 * Si la versión de Playwright no encuentra su Chromium (entornos con navegadores
 * preinstalados), define PW_CHROMIUM_PATH con la ruta del ejecutable.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Valores ficticios y no secretos: el proyecto "demo-*" solo existe en el emulador.
const DEMO_ENV: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-questflow.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-questflow",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-questflow.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  QUESTFLOW_DIST_DIR: ".next-e2e",
};

const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
    locale: "es-ES",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next build && npx next start --hostname 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: false,
    env: DEMO_ENV,
    stdout: "ignore",
    stderr: "pipe",
  },
});
