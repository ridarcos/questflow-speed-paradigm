import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type CollectionReference,
  type FirestoreError,
} from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./firebase";
import { toQuest, type Quest, type QuestInput } from "./quests";

/**
 * Acceso a datos de misiones. La ruta /users/{uid}/quests se construye SIEMPRE
 * con el UID del usuario con sesión iniciada en Firebase Auth (SEC-03): ninguna
 * función acepta un UID arbitrario para escribir o leer.
 */

export class NotSignedInError extends Error {
  constructor() {
    super("No hay una sesión iniciada.");
    this.name = "NotSignedInError";
  }
}

function sessionUid(): string {
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) {
    throw new NotSignedInError();
  }
  return uid;
}

function questsCollection(): CollectionReference {
  return collection(getDb(), "users", sessionUid(), "quests");
}

function questDoc(questId: string) {
  return doc(getDb(), "users", sessionUid(), "quests", questId);
}

/**
 * Suscripción en vivo a las misiones del usuario actual, más recientes primero.
 * `expectedUid` debe coincidir con la sesión; si no, no se suscribe a nada.
 * Devuelve la función para cancelar la suscripción.
 */
export function subscribeToQuests(
  expectedUid: string,
  onData: (quests: Quest[]) => void,
  onError: (error: FirestoreError | Error) => void,
): () => void {
  let uid: string;
  try {
    uid = sessionUid();
  } catch (error) {
    onError(error as Error);
    return () => {};
  }
  if (uid !== expectedUid) {
    onError(new NotSignedInError());
    return () => {};
  }
  const q = query(collection(getDb(), "users", uid, "quests"), orderBy("createdAt", "desc"));
  // includeMetadataChanges: también avisa cuando el servidor confirma una
  // escritura local, para quitar el indicador "Pendiente de sincronizar".
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      onData(
        snapshot.docs.map((snap) => ({
          ...toQuest(snap.id, snap.data({ serverTimestamps: "estimate" })),
          pendingSync: snap.metadata.hasPendingWrites,
        })),
      );
    },
    onError,
  );
}

/** Crea una misión con exactamente los campos permitidos por las reglas. */
export async function createQuest(input: QuestInput): Promise<string> {
  const ref = await addDoc(questsCollection(), {
    title: input.title,
    description: input.description ?? "",
    difficulty: input.difficulty,
    completed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Edita título, descripción y dificultad. No toca createdAt. */
export async function updateQuest(questId: string, input: QuestInput): Promise<void> {
  await updateDoc(questDoc(questId), {
    title: input.title,
    description: input.description ?? "",
    difficulty: input.difficulty,
    updatedAt: serverTimestamp(),
  });
}

/** Completa o reabre una misión. */
export async function setQuestCompleted(questId: string, completed: boolean): Promise<void> {
  await updateDoc(questDoc(questId), { completed, updatedAt: serverTimestamp() });
}

export async function deleteQuest(questId: string): Promise<void> {
  await deleteDoc(questDoc(questId));
}

/** Mensaje en español para errores de Firestore. */
export function translateFirestoreError(error: unknown): string {
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "permission-denied":
      return "Firestore ha denegado la operación: no tienes permiso o los datos no son válidos.";
    case "unavailable":
      return "No se puede conectar con Firestore. Revisa tu conexión.";
    case "unauthenticated":
      return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
    case "failed-precondition":
      return "Firestore no está listo (¿base de datos creada en el proyecto?).";
    case "not-found":
      return "La misión ya no existe.";
    default:
      if (error instanceof NotSignedInError) {
        return "No hay una sesión iniciada.";
      }
      return "Error de Firestore. Inténtalo de nuevo.";
  }
}
