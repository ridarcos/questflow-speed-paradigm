# QuestFlow

QuestFlow es una aplicación web para organizar **misiones personales** y ganar XP al completarlas. Cada visitante entra con email y contraseña o con Google, y ve solo sus propias misiones. Puede crearlas, editarlas, completarlas, reabrirlas, filtrarlas y eliminarlas. Los datos se guardan en Firestore y se actualizan en vivo.

- **Producción:** https://questflow-speed-paradigm-sandy.vercel.app
- **XP por terreno:** Sendero 10, Ladera 25, Cumbre 50. Solo suman las misiones completadas. En Firestore el terreno se sigue guardando como `difficulty` = `easy|medium|hard`.
- **Cuentas nuevas:** empiezan con 4 misiones de ejemplo y un tutorial de 5 pasos (ver [Misiones de ejemplo y tutorial](#misiones-de-ejemplo-y-tutorial)).
- **Validación:** el título debe tener de 1 a 80 caracteres tras `trim`, y la descripción hasta 280. El cliente y `firestore.rules` aplican las mismas reglas.

## Stack

- [Next.js](https://nextjs.org/) (App Router, `src/`) + React + TypeScript en modo `strict`
- Tailwind CSS 4 con los tokens del sistema "Ruta" en `src/app/globals.css` (`@theme`, tema claro y oscuro con `prefers-color-scheme`)
- Fuentes por npm, servidas desde el mismo origen: Bricolage Grotesque (`@fontsource-variable/bricolage-grotesque/standard.css`, ejes opsz, wdth y wght) para titulares y cifras, e Instrument Sans para el resto. Sin Google Fonts
- Firebase JS SDK modular: Authentication (Email/Contraseña y Google) y Cloud Firestore
- Vitest (tests unitarios y de reglas con `@firebase/rules-unit-testing`) y Playwright (E2E)
- Firebase Emulator Suite para tests sin tocar el proyecto real
- npm como gestor de paquetes. Node.js ≥ 24.12 (lo exige firebase 13)

## Arquitectura

No hay backend propio. La página se prerenderiza como estática y todo lo demás ocurre en el navegador.

```
 Navegador (Next.js, componentes cliente)
 ┌──────────────────────────────────────────────┐
 │ AuthProvider ── onAuthStateChanged ──► uid   │
 │ Dashboard ── onSnapshot / addDoc /           │
 │              updateDoc / deleteDoc           │
 └───────────┬───────────────────────┬──────────┘
             │ login / token         │ lecturas y escrituras con el token
             ▼                       ▼
   Firebase Authentication     Cloud Firestore
   (Email/Contraseña, Google)  /users/{uid}/quests/{questId}
                                     ▲
                       firestore.rules: solo request.auth.uid == uid,
                       campos y tipos validados, el resto se deniega
```

- `src/lib/firebase.ts` es el único punto de inicialización. Usa `getApps()` y lee solo `NEXT_PUBLIC_FIREBASE_*`. Si falta alguna variable, la UI muestra un aviso de configuración en lugar de romperse.
- `src/lib/questsRepo.ts` hace el acceso a datos. La ruta se construye siempre con el UID de la sesión actual.
- `src/lib/quests.ts` contiene la lógica pura: XP, validación, filtros, estadísticas y niveles.
- `src/lib/routeProfile.ts` calcula la geometría del perfil de ruta (función pura y testeada) y `src/lib/contours.ts` las curvas de nivel decorativas del acceso.
- `src/lib/exampleQuests.ts`, `src/lib/seedCoordinator.ts` y `src/lib/seeding.ts` crean las misiones de ejemplo; `src/lib/tutorial.ts` define los pasos y la colocación del tutorial, y `src/lib/localFlags.ts` es el único módulo que usa `localStorage`.
- `firestore.rules` es el modelo de seguridad. Más detalles en [docs/SECURITY.md](docs/SECURITY.md).

Documento de cada misión: `title`, `description`, `difficulty` (`easy|medium|hard`), `completed`, `createdAt`, `updatedAt` (los dos últimos con `serverTimestamp()`).

## Diseño

La dirección visual está en [docs/DESIGN_DIRECTION.md](docs/DESIGN_DIRECTION.md): un mapa de montaña en el que cada misión es un tramo de la ruta y la dificultad es el terreno.

- **Tokens:** `paper`, `ink`, `contour`, `marker`, `trail`, `slope`, `summit`, `surface`, `ink-soft`, `line`, `danger` y `on-marker`, con valores para claro y oscuro. Los componentes solo usan utilidades de token (`bg-paper`, `text-ink-soft`, `border-line`...), sin colores por defecto de Tailwind, sin hex en los `.tsx`, sin sombras ni gradientes. El CSS minificado escribe los hex en minúscula.
- **Escala tipográfica:** 14, 16, 20, 28 y 44 px (`text-small`, `text-body`, `text-title`, `text-heading`, `text-display`). Radios: 20 px contenedores, 14 px tarjetas, 10 px controles y chips redondos.
- **Perfil de ruta:** SVG en la cabecera del dashboard, con un hito por misión ordenado por `createdAt`, el tramo recorrido hasta la última completada y la XP ganada a la derecha. Lleva `role="img"` y `aria-label` "N de M misiones completadas, X XP". Bajo la cresta hay un relieve decorativo muy tenue.
- **Curvas de nivel y contraste:** el mapa del acceso usa `contour` al 20 % en claro y al 15 % en oscuro. Desde 1024 px el texto va encima del mapa y conserva 4.78:1 y 6.11:1 sobre una curva (QA-014).
- **Una sola animación:** al completar una misión, el tramo avanza y el hito se rellena (menos de 1 s). Con `prefers-reduced-motion: reduce` no se mueve nada.
- **Disposición:** desde 1024 px, dos columnas con "Nueva misión" fija (`sticky`) a la izquierda. En móvil, perfil → estadísticas → "Nueva misión" plegable → filtros → lista.

## Misiones de ejemplo y tutorial

**Misiones de ejemplo.** Cuando Firebase confirma una cuenta nueva (`getAdditionalUserInfo(cred)?.isNewUser === true`), se escriben 4 misiones en `users/{uid}/quests`. Vale para el registro con email y para el primer acceso con Google, tanto por popup como por redirect (en este caso, con el resultado de `getRedirectResult`). Se escriben con el mismo `createQuest` que el formulario, así que pasan las reglas actuales sin campos nuevos:

1. Sendero: "Marca esta misión como completada"
2. Sendero: "Edita esta misión y hazla tuya"
3. Ladera: "Planifica tres objetivos para esta semana"
4. Cumbre: "Termina ese proyecto que llevas tiempo aplazando"

- **Orden determinista:** se escriben una tras otra en ese orden, y cada una espera a que el servidor confirme la anterior. Así los `createdAt` son distintos y crecientes en todas las cuentas. El perfil de ruta las dibuja de izquierda a derecha (Sendero, Sendero, Ladera, Cumbre). La lista muestra primero las más recientes, así que empieza por la Cumbre.
- **Una sola vez:** no se crean al iniciar sesión, al recargar ni en accesos posteriores con Google. Si se borran, no vuelven. Con StrictMode tampoco se duplican.
- **Mientras se escriben** aparece "Preparando tus misiones de ejemplo…" en lugar del estado vacío. Si fallan (por ejemplo, porque las reglas las rechazan), el dashboard se carga igualmente con un único aviso y no hay reintentos automáticos.
- **Cuentas antiguas:** el estado vacío de "Todas" ofrece el botón "Añadir misiones de ejemplo", que crea las mismas 4.

**Tutorial.** Es un recorrido de 5 pasos sobre la interfaz real: perfil de ruta, "Nueva misión", terreno, filtros y una tarjeta. Cada destino lleva `data-tour`. Se abre solo la primera vez por UID y navegador, con la lista ya cargada, y se repite con "Ver tutorial" en la cabecera. Es un `<dialog>` modal nativo con foco atrapado, Esc, "Saltar", "Anterior", "Siguiente"/"Terminar" y "Paso N de 5". Al cerrarse, el foco vuelve a "Ver tutorial". Si un destino no existe o está oculto (formulario plegado en móvil, sin misiones), el paso se centra y muestra un texto alternativo. La única marca que guarda es `questflow:tutorial:<uid>` = `done` en `localStorage`. Si el navegador bloquea el almacenamiento, la marca se guarda en memoria para esa sesión de la página.

## Equipo de agentes

QuestFlow se desarrolló con Claude Code, con un equipo de tres agentes:

- **Orquestador** ([CLAUDE.md](CLAUDE.md)): divide el trabajo en fases, delega y registra los resultados. No implementa ni declara PASS por su cuenta.
- **Develop** ([.claude/agents/develop.md](.claude/agents/develop.md)): implementa cada fase y corrige los defectos `QA-XXX`.
- **Testing** ([.claude/agents/testing.md](.claude/agents/testing.md)): QA independiente. Define los criterios `AC-*` y `SEC-*`, ejecuta las comprobaciones y devuelve PASS, FAIL o BLOCKED.

El registro de delegaciones, defectos y re-tests está en [docs/HANDOFF_LOG.md](docs/HANDOFF_LOG.md). El alcance funcional está en [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).

## Puesta en marcha local

Requisitos: Node.js ≥ 24.12 y npm. Para los tests con emuladores, además, Java 11+ (lo usa el emulador de Firestore).

```bash
npm ci
cp .env.example .env.local   # rellena los valores de tu app web de Firebase
npm run dev                  # http://localhost:3000
```

Variables de `.env.local`. Salen de Firebase Console > Configuración del proyecto > Tus apps > Web:

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API key web (pública, no es un secreto) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<id>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID del proyecto |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Bucket del proyecto |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID web |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | Opcional. `true` conecta con los emuladores locales (Auth 9099, Firestore 8080). Déjala vacía en producción |

`.env.local` está en `.gitignore`: **no lo subas nunca**. Para desarrollar sin un proyecto real, pon `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` con valores ficticios y un ID de proyecto `demo-questflow`, y arranca `npx firebase emulators:start --only auth,firestore --project demo-questflow`.

## Configurar el proyecto Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) y registra una **app web**. Copia su configuración en `.env.local`.
2. **Authentication > Método de acceso**: activa **Correo electrónico/contraseña** y **Google** (este último pide un email de asistencia).
3. **Authentication > Configuración > Dominios autorizados**: añade el dominio de producción de Vercel (por ejemplo `questflow-speed-paradigm-sandy.vercel.app`). `localhost` ya viene incluido. Sin este paso, Google Sign-in falla con `auth/unauthorized-domain`.
4. **Firestore Database**: crea la base de datos en modo producción.
5. **Publica las reglas** versionadas en `firestore.rules` de una de estas dos formas:
   - Por consola: Firestore > Reglas, pega el contenido de `firestore.rules` y pulsa **Publicar**.
   - Por CLI: `npx firebase login` y después `npx firebase deploy --only firestore:rules --project <id>`.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Tests unitarios con Vitest (XP, validación, filtros, estadísticas, niveles, auth, escrituras, geometría del perfil de ruta, curvas de nivel, misiones de ejemplo, siembra, tutorial y almacenamiento local) |
| `npm run test:rules` | Tests de `firestore.rules` en el emulador de Firestore (`demo-questflow`) |
| `npm run test:e2e` | E2E con Playwright contra los emuladores de Auth y Firestore |
| `npm run build` / `npm start` | Build de producción y servidor |

### E2E (`npm run test:e2e`)

`firebase emulators:exec` arranca los emuladores de Auth y Firestore con el proyecto ficticio `demo-questflow` y lanza `playwright test --trace off`. El `webServer` de `playwright.config.ts` compila y sirve la app en `.next-e2e` (puerto 3100, configurable con `E2E_PORT`). Usa valores de configuración inventados y `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, así que no toca el proyecto real ni el build normal de `.next`.

Cubre lo siguiente:

- Flujo completo: registro, crear, completar, editar, filtros, eliminar con confirmación (y cancelar), recargar comprobando que los datos persisten, y cerrar e iniciar sesión.
- Aislamiento entre dos usuarios, tanto en la UI como contra las reglas: con el token de B, la ruta de A devuelve 403.
- Validaciones de login: campos vacíos, email mal formado, contraseña corta, credenciales incorrectas y email duplicado.
- Validación del formulario de misiones.
- `late-rejection.spec.ts`: escrituras hechas sin conexión que el servidor rechaza al reconectar (aviso por cambio perdido, retirada del aviso de éxito, "Restaurar en el formulario" con confirmación si hay un borrador) y texto escrito mientras "Creando…" que no se pierde al terminar.
- `examples.spec.ts`: las 4 misiones de ejemplo, leídas por REST (literales, 6 campos, orden fijo en tres cuentas). Comprueba que no se repiten al recargar ni al cerrar e iniciar sesión, que no vuelven si se borran, el botón "Añadir misiones de ejemplo" con doble clic y una siembra rechazada por las reglas (un solo aviso, sin reintentos).
- `tutorial.spec.ts`: apertura automática una vez por UID, foco atrapado, Esc, "Saltar", "Terminar", los 5 pasos, foco devuelto, marca por UID con dos cuentas, almacenamiento que lanza y pasos sin destino a 360 px.
- `route-profile.spec.ts`: `aria-label` del perfil al completar, reabrir, crear, cambiar terreno y borrar. También el extremo del tramo recorrido, la animación al completar (y ninguna con reduced motion) y títulos con HTML mostrados como texto.
- `responsive.spec.ts`: a 360, 768 y 1280 px, sin scroll horizontal con las misiones de ejemplo y con el tutorial abierto. En cada paso, el diálogo cabe entero y no tapa del todo su destino.
- `contrast.spec.ts`: en claro y oscuro, a 1024 y 1280 px, cada texto que queda encima del mapa del acceso conserva 4,5:1 frente a las curvas, y el trazo no pasa de 1,5:1 contra `paper`. Los colores los resuelve el navegador.

Antes de la primera ejecución, instala el navegador con `npx playwright install chromium`. Si tu entorno ya trae un Chromium que no coincide con la versión de Playwright, indica su ruta:

```bash
PW_CHROMIUM_PATH=/ruta/a/chrome npm run test:e2e
```

## Despliegue en Vercel

1. Importa el repositorio en [Vercel](https://vercel.com/new). El framework se detecta solo (Next.js).
2. **Settings > Environment Variables**: añade las seis variables `NEXT_PUBLIC_FIREBASE_*` en Production (y en Preview si lo necesitas). **No** definas `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`. Como Next.js las incrusta en el build, cualquier cambio exige volver a desplegar.
3. **Settings > General > Node.js Version**: 24.x. `package.json` ya declara `"engines": { "node": ">=24.12" }`.
4. **Settings > Deployment Protection**: desactiva *Vercel Authentication* para producción, de modo que cualquiera pueda abrir la URL sin iniciar sesión en Vercel.
5. Añade el dominio `*.vercel.app` (y cualquier dominio propio) a los dominios autorizados de Firebase Authentication.
6. Despliega y comprueba el resultado como se indica abajo.

## Prueba en producción (incógnito)

1. Abre la URL de producción en una ventana de incógnito. Debe aparecer la pantalla de acceso de QuestFlow, no un login de Vercel.
2. **Crear cuenta** con un email y una contraseña de 6 caracteres o más. Se abre el tutorial ("Paso 1 de 5") y el dashboard muestra las 4 misiones de ejemplo, con 0 de 4 completadas y 0 %.
3. Crea una misión, complétala (sube la XP y avanza el perfil de ruta), edítala y comprueba los filtros Todas, Activas y Hechas.
4. Recarga la página: la misión sigue ahí.
5. **Cerrar sesión** y vuelve a iniciar sesión con la misma cuenta: la misión sigue ahí.
6. Prueba **Continuar con Google**. Si falla con "dominio no autorizado", revisa el paso 3 de la configuración de Firebase.
7. Con otra cuenta, en otra ventana de incógnito, no deben verse las misiones de la primera.

## Seguridad

Consulta [docs/SECURITY.md](docs/SECURITY.md): modelo de reglas, secretos, ausencia de `dangerouslySetInnerHTML` y de claves de LLM, y justificación del resultado de `npm audit --omit=dev`.
