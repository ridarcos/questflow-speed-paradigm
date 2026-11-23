# QuestFlow — Product Specification (v1)

## Objetivo

Aplicación pública que permite a cualquier visitante organizar misiones personales. La propia app **no** necesita llamar a un LLM; la prueba técnica evalúa los agentes que la desarrollan.

## Usuario principal

Visitante que abre la URL pública en una ventana de incógnito. Se registra o inicia sesión con **email y contraseña** o con **Google** (Firebase Authentication, proyecto `questflow-5446d`), y sus misiones quedan separadas por UID.

> Cambio solicitado por Ricardo el 2026-11-23: sustituye la autenticación anónima de la v1 por Email/Contraseña y Google Sign-in.

## Alcance del MVP

0. Pantalla de acceso: registro e inicio de sesión con email/contraseña y botón "Continuar con Google"; cerrar sesión.
1. Dashboard atractivo con título, contador de misiones, completadas y XP.
2. Formulario de creación de misión: título requerido (1–80 caracteres), descripción opcional (máx. 280), dificultad Easy (10 XP), Medium (25 XP), Hard (50 XP).
3. Listado de misiones con tarjeta, categoría visual/dificultad, XP y estado.
4. Editar título, descripción y dificultad.
5. Completar / reabrir una misión.
6. Eliminar una misión (confirmación clara o acción reversible).
7. Filtros All / Active / Completed.
8. Actualización en vivo y persistencia entre recargas con Firestore.
9. Estados Loading, Empty y Error. Diseño responsive y accesible.
10. Reglas que impiden a otros usuarios leer/escribir misiones ajenas.

## No incluido

- Pagos, IA generativa en runtime, multiusuario colaborativo, storage de imágenes, notificaciones, roles administrativos o backend adicional.
- No utilizar un API key de LLM en el cliente.

## Arquitectura esperada

- Next.js App Router; componentes cliente solo donde sea necesario.
- Firebase JS SDK: `getAuth` + `createUserWithEmailAndPassword` / `signInWithEmailAndPassword` + `GoogleAuthProvider` / `signInWithPopup` + `signOut` + `onAuthStateChanged`; `getFirestore` + `onSnapshot` + `addDoc` + `updateDoc` + `deleteDoc`.
- Ruta Firestore: `/users/{uid}/quests/{questId}`.
- Variables públicas web Firebase en `.env.local` o variables de Vercel (no subir `.env.local`).
- Reglas Firestore versionadas en el repositorio y publicadas en el proyecto Firebase.

## Definition of Done

- Todas las operaciones CRUD funcionan en la URL pública.
- Prueba en incógnito superada y Vercel Authentication no bloquea el dominio de producción.
- Testing devuelve PASS y registra resultados reales en `docs/HANDOFF_LOG.md`.
