import { getAdditionalUserInfo, type UserCredential } from "firebase/auth";
import { EXAMPLE_QUESTS, shouldSeedExamples } from "./exampleQuests";
import { getFirebaseAuth } from "./firebase";
import { createQuest, translateFirestoreError } from "./questsRepo";
import { createSeedCoordinator } from "./seedCoordinator";
import { runWrite } from "./writes";

/**
 * Siembra de misiones de ejemplo de la app. Escribe con el mismo
 * `createQuest` que el formulario (ruta construida con el UID de la sesión,
 * mismos 6 campos, mismas reglas) y a través de `runWrite`, como cualquier
 * otra escritura de la interfaz.
 */
export const seeding = createSeedCoordinator({
  sessionUid: () => {
    try {
      return getFirebaseAuth().currentUser?.uid ?? null;
    } catch {
      return null;
    }
  },
  write: (input, onLateError) => runWrite(createQuest(input), onLateError),
  describeError: translateFirestoreError,
  examples: EXAMPLE_QUESTS,
});

/**
 * Tras un acceso correcto (email, popup o redirect): si Firebase dice que la
 * cuenta es nueva, la deja pendiente de sembrar. La siembra arranca cuando el
 * dashboard de esa cuenta está montado, es decir, con la sesión ya propagada.
 */
export function noteSignInResult(credential: UserCredential): void {
  if (shouldSeedExamples(getAdditionalUserInfo(credential))) {
    seeding.markNewAccount(credential.user.uid);
  }
}
