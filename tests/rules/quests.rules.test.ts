/**
 * Tests de firestore.rules contra el emulador de Firestore.
 * Ejecutar con: npm run test:rules (arranca el emulador con firebase emulators:exec).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-questflow";
const ALICE = "alice";
const BOB = "bob";
const QUEST_ID = "q1";

let env: RulesTestEnvironment;

function validQuest(overrides: Record<string, unknown> = {}) {
  return {
    title: "Leer un libro",
    description: "",
    difficulty: "medium",
    completed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function dbAs(uid: string | null): Firestore {
  const ctx = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext();
  return ctx.firestore() as unknown as Firestore;
}

const questsOf = (db: Firestore, uid: string) => collection(db, "users", uid, "quests");
const questRef = (db: Firestore, uid: string, id = QUEST_ID) => doc(db, "users", uid, "quests", id);

/** Siembra una misión de Alice saltándose las reglas. */
async function seedAliceQuest() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(questRef(db, ALICE), {
      ...validQuest(),
      createdAt: Timestamp.fromMillis(1_700_000_000_000),
      updatedAt: Timestamp.fromMillis(1_700_000_000_000),
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe("propietario", () => {
  it("crea una misión válida con serverTimestamp", async () => {
    await assertSucceeds(addDoc(questsOf(dbAs(ALICE), ALICE), validQuest()));
  });

  it("lee (get) y lista sus misiones", async () => {
    await seedAliceQuest();
    const db = dbAs(ALICE);
    await assertSucceeds(getDoc(questRef(db, ALICE)));
    await assertSucceeds(getDocs(questsOf(db, ALICE)));
  });

  it("edita título/descripción/dificultad actualizando updatedAt", async () => {
    await seedAliceQuest();
    await assertSucceeds(
      updateDoc(questRef(dbAs(ALICE), ALICE), {
        title: "Nuevo",
        description: "desc",
        difficulty: "hard",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("completa y reabre", async () => {
    await seedAliceQuest();
    const ref = questRef(dbAs(ALICE), ALICE);
    await assertSucceeds(updateDoc(ref, { completed: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { completed: false, updatedAt: serverTimestamp() }));
  });

  it("elimina", async () => {
    await seedAliceQuest();
    await assertSucceeds(deleteDoc(questRef(dbAs(ALICE), ALICE)));
  });

  it("acepta título de 80 y descripción de 280 caracteres", async () => {
    await assertSucceeds(
      addDoc(
        questsOf(dbAs(ALICE), ALICE),
        validQuest({ title: "a".repeat(80), description: "d".repeat(280) }),
      ),
    );
  });
});

describe("acceso cruzado (SEC-06) y sin autenticar", () => {
  for (const [who, uid] of [
    ["otro usuario (bob)", BOB],
    ["no autenticado", null],
  ] as const) {
    describe(who, () => {
      it("no puede hacer get", async () => {
        await seedAliceQuest();
        await assertFails(getDoc(questRef(dbAs(uid), ALICE)));
      });
      it("no puede hacer list", async () => {
        await seedAliceQuest();
        await assertFails(getDocs(questsOf(dbAs(uid), ALICE)));
      });
      it("no puede crear", async () => {
        await assertFails(setDoc(questRef(dbAs(uid), ALICE, "intruso"), validQuest()));
      });
      it("no puede actualizar", async () => {
        await seedAliceQuest();
        await assertFails(
          updateDoc(questRef(dbAs(uid), ALICE), { completed: true, updatedAt: serverTimestamp() }),
        );
      });
      it("no puede eliminar", async () => {
        await seedAliceQuest();
        await assertFails(deleteDoc(questRef(dbAs(uid), ALICE)));
      });
    });
  }

  it("deniega por defecto cualquier otra ruta", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE), { name: "x" }));
    await assertFails(setDoc(doc(db, "quests", "x"), validQuest()));
    await assertFails(getDoc(doc(db, "users", ALICE, "other", "x")));
  });
});

describe("validación de datos en create", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["campo extra", { isAdmin: true }],
    ["título en blanco", { title: "   " }],
    ["título vacío", { title: "" }],
    ["título de 81 caracteres", { title: "a".repeat(81) }],
    ["descripción de 281 caracteres", { description: "d".repeat(281) }],
    ["dificultad en mayúscula", { difficulty: "Easy" }],
    ["dificultad desconocida", { difficulty: "legendary" }],
    ["título no string", { title: 123 }],
    ["descripción no string", { description: null }],
    ["completed no bool", { completed: "false" }],
    ["createdAt de cliente", { createdAt: Timestamp.fromMillis(0) }],
    ["updatedAt de cliente", { updatedAt: Timestamp.now() }],
    ["createdAt como string", { createdAt: "2026-01-01" }],
  ];
  for (const [name, overrides] of cases) {
    it(`deniega: ${name}`, async () => {
      await assertFails(addDoc(questsOf(dbAs(ALICE), ALICE), validQuest(overrides)));
    });
  }

  it("deniega si falta un campo obligatorio", async () => {
    const data: Record<string, unknown> = validQuest();
    delete data.description;
    await assertFails(addDoc(questsOf(dbAs(ALICE), ALICE), data));
  });
});

describe("validación de datos en update", () => {
  it("createdAt es inmutable", async () => {
    await seedAliceQuest();
    await assertFails(
      updateDoc(questRef(dbAs(ALICE), ALICE), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("exige updatedAt del servidor", async () => {
    await seedAliceQuest();
    const ref = questRef(dbAs(ALICE), ALICE);
    await assertFails(updateDoc(ref, { completed: true }));
    await assertFails(updateDoc(ref, { completed: true, updatedAt: Timestamp.now() }));
  });

  it("deniega campos extra, título en blanco y dificultad en mayúscula", async () => {
    await seedAliceQuest();
    const ref = questRef(dbAs(ALICE), ALICE);
    await assertFails(updateDoc(ref, { owner: BOB, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { title: " \t ", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { difficulty: "HARD", updatedAt: serverTimestamp() }));
  });
});
