import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

/**
 * Único punto de inicialización de Firebase en QuestFlow.
 *
 * Solo se leen variables públicas NEXT_PUBLIC_FIREBASE_*. Se referencian de forma
 * literal (process.env.NEXT_PUBLIC_...) para que Next.js las inyecte en el bundle
 * del cliente durante el build. No hay valores reales embebidos en el código.
 */

export const FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export type FirebaseEnvKey = (typeof FIREBASE_ENV_KEYS)[number];
export type FirebaseEnv = Partial<Record<FirebaseEnvKey, string | undefined>>;

/** Lee las variables públicas de Firebase (referencias literales para el inlining de Next). */
export function readFirebaseEnv(): FirebaseEnv {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/** Devuelve las claves ausentes o vacías (función pura). */
export function missingFirebaseEnvKeys(env: FirebaseEnv = readFirebaseEnv()): FirebaseEnvKey[] {
  return FIREBASE_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== "string" || value.trim() === "";
  });
}

/** true solo si todas las variables NEXT_PUBLIC_FIREBASE_* tienen valor (función pura). */
export function isFirebaseConfigured(env: FirebaseEnv = readFirebaseEnv()): boolean {
  return missingFirebaseEnvKeys(env).length === 0;
}

export class FirebaseConfigError extends Error {
  readonly missingKeys: FirebaseEnvKey[];

  constructor(missingKeys: FirebaseEnvKey[]) {
    super(`Faltan variables de entorno de Firebase: ${missingKeys.join(", ")}`);
    this.name = "FirebaseConfigError";
    this.missingKeys = missingKeys;
  }
}

/**
 * Getters perezosos: no se ejecuta nada al importar el módulo, así que el
 * prerender y `npm run build` funcionan sin .env.local. Llamar solo desde
 * componentes cliente (efectos o manejadores de eventos).
 */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  const env = readFirebaseEnv();
  const missing = missingFirebaseEnvKeys(env);
  if (missing.length > 0) {
    throw new FirebaseConfigError(missing);
  }
  return initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

/** Hosts fijos de los emuladores locales (coinciden con firebase.json). */
export const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
export const FIRESTORE_EMULATOR_HOST = "127.0.0.1";
export const FIRESTORE_EMULATOR_PORT = 8080;

/** true solo si NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" (función pura). */
export function shouldUseEmulators(
  value: string | undefined = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
): boolean {
  return value === "true";
}

// Registro de instancias ya conectadas al emulador. Vive en globalThis para que
// el HMR de desarrollo no intente conectar dos veces la misma instancia.
type EmulatorRegistry = { auth: WeakSet<Auth>; db: WeakSet<Firestore> };
const REGISTRY_KEY = Symbol.for("questflow.firebaseEmulators");
function emulatorRegistry(): EmulatorRegistry {
  const store = globalThis as unknown as Record<symbol, EmulatorRegistry | undefined>;
  store[REGISTRY_KEY] ??= { auth: new WeakSet(), db: new WeakSet() };
  return store[REGISTRY_KEY];
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  if (shouldUseEmulators()) {
    const registry = emulatorRegistry();
    if (!registry.auth.has(auth)) {
      connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
      registry.auth.add(auth);
    }
  }
  return auth;
}

export function getDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  if (shouldUseEmulators()) {
    const registry = emulatorRegistry();
    if (!registry.db.has(db)) {
      connectFirestoreEmulator(db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
      registry.db.add(db);
    }
  }
  return db;
}
