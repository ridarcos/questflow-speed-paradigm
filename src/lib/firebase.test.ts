import { describe, expect, it } from "vitest";
import {
  FIREBASE_ENV_KEYS,
  isFirebaseConfigured,
  missingFirebaseEnvKeys,
  type FirebaseEnv,
} from "./firebase";

const fullEnv: FirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
};

describe("missingFirebaseEnvKeys", () => {
  it("devuelve todas las claves cuando el entorno está vacío", () => {
    expect(missingFirebaseEnvKeys({})).toEqual([...FIREBASE_ENV_KEYS]);
  });

  it("no devuelve nada cuando todas las claves tienen valor", () => {
    expect(missingFirebaseEnvKeys(fullEnv)).toEqual([]);
  });

  it("trata cadenas vacías o en blanco como ausentes", () => {
    const env: FirebaseEnv = {
      ...fullEnv,
      NEXT_PUBLIC_FIREBASE_API_KEY: "",
      NEXT_PUBLIC_FIREBASE_APP_ID: "   ",
    };
    expect(missingFirebaseEnvKeys(env)).toEqual([
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ]);
  });
});

describe("isFirebaseConfigured", () => {
  it("es false si falta alguna clave", () => {
    const env: FirebaseEnv = { ...fullEnv, NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined };
    expect(isFirebaseConfigured(env)).toBe(false);
  });

  it("es true con todas las claves", () => {
    expect(isFirebaseConfigured(fullEnv)).toBe(true);
  });
});
