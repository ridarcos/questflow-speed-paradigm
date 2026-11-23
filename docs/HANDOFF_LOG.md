# Agent Handoff Log — evidencia real

Registro mantenido por el Orquestador. Cada fila corresponde a una delegación ejecutada de verdad; los resultados son los que devolvió el subagente y, cuando aplica, los que el Orquestador volvió a comprobar.

**Cómo se invocaron los subagentes.** Las sesiones se ejecutaron en Claude Code en la nube (un contenedor). Los archivos `.claude/agents/*.md` se crearon durante esa misma sesión, así que Claude Code no los registró como tipos de subagente propios: la herramienta Agent respondió `Agent type 'testing' not found`. Por eso cada delegación lanzó un subagente independiente (`general-purpose`) con su propio contexto, y la primera instrucción de cada prompt era leer y cumplir su archivo de rol (`.claude/agents/testing.md` o `.claude/agents/develop.md`), incluidas sus restricciones de herramientas. Si se abre Claude Code desde la raíz del repositorio en una sesión nueva, `develop` y `testing` se cargan como subagentes nativos.

| # | Fecha (UTC) | Fase | Agente | Tarea delegada | Resultado observado | Evidencia | Re-test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-23 | 0 | testing | Revisar criterios y alcance; auditar `firestore.rules` antes de implementar | FAIL: QA-001, QA-002 y QA-003 en las reglas. Propuso AC-NEW-01 a AC-NEW-04 | Informe Testing #1 | Fase 1 (#3) |
| 2 | 2026-11-23 | 1 | develop | Bootstrap Next.js + Tailwind + Firebase, UI básica y corrección de QA-001 a QA-003 | Entregado en el commit `c4062da`. lint, typecheck, test (8/8) y build OK sin `.env.local`. Avisos: npm audit muestra 4 altos (grpc-js transitivo) y firebase 13 pide Node ≥24.12 | Entrega Develop Fase 1 | #3 |
| 3 | 2026-11-23 | 1 | testing | Revisión independiente de la Fase 1 y retest de QA-001 a QA-003 | **PASS** en AC-01 a AC-06, AC-17, SEC-01 y SEC-02. 29 casos de reglas en el emulador de Firestore, 0 fallos. Playwright: 0 errores de consola y sin scroll horizontal a 360 px | Informe Testing #3 (clon limpio en /tmp) | QA-001 a QA-003 cerrados |
| 4 | 2026-11-23 | 2 | develop | Login con Email/Contraseña y Google, CRUD en `users/{uid}/quests`, estadísticas, filtros, emuladores y tests de reglas | Entregado en el commit `292512a`. lint, typecheck, test 39/39, test:rules 34/34 y build OK. La prueba de mutación de las reglas hizo fallar 2 tests, como se esperaba. El smoke con Playwright y emuladores pasó. Google no se probó de verdad | Entrega Develop Fase 2 | #5 |
| 5 | 2026-11-23 | 2 | testing | Revisión independiente de la Fase 2 en un clon limpio, con E2E propio (Playwright + emuladores de Auth y Firestore) y dos usuarios | **BLOCKED, sin FAIL**. Todos los criterios comprobables pasan: E2E 54 de 55 (el restante eran 400 esperados de las pruebas negativas), test:rules 34/34 y aislamiento A/B por REST (403 en la ruta ajena, 200 en la propia). Quedan BLOCKED hasta producción Google real (AC-10), producción (AC-16) y Node 24 en Vercel (AC-36). Defectos nuevos QA-004 y QA-005 | Informe Testing #5 | #7 |
| 6 | 2026-11-23 | 3 | develop | Corregir QA-004 y QA-005; AC-22 a AC-26 (estados, validación, responsive, accesibilidad, escrituras sin conexión) | Entregado en el commit `70af2de`. lint, typecheck, test 56/56, test:rules 34/34 y build OK. Smoke con Playwright y emuladores 39/39, incluidos modo sin conexión, reglas que rechazan escrituras y foco tras borrar | Entrega Develop Fase 3 | #7 |
| 7 | 2026-11-23 | 3 | testing | Revisión independiente de la Fase 3 y retest de QA-004 y QA-005. E2E propio: foco, sin conexión, rechazos por reglas, contraste WCAG medido, 360/1280 px | **FAIL**. QA-004 y QA-005 PASS. AC-22, AC-23, AC-24 y AC-26 PASS. AC-25 FAIL por un contraste de 4.40:1 (QA-007). Además, una incoherencia tras un rechazo tardío (QA-008). Producción BLOCKED: el proxy no la alcanza | Informe Testing #7 | #10 |
| 8 | 2026-11-23 | 4 | develop | E2E versionado con Playwright (AC-31), README (AC-32), auditoría de dependencias (SEC-05 en `docs/SECURITY.md`) y SEC-04 | Entregado en el commit `1c1f831`. lint, typecheck, test 56/56, test:rules 34/34, test:e2e 5/5 y build OK. El E2E destapó QA-006 y quedó corregido en el mismo commit. npm audit sigue con 4 altos, justificados (grpc-js, sin versión que lo corrija) | Entrega Develop Fase 4 | #10 |
| 9 | 2026-11-23 | 3 | develop | Corregir QA-007 (contraste) y QA-008 (rechazo tardío) | Entregado en el commit `29551b7`. Badge con contraste de 6.47:1. Avisos acumulables que nombran la misión, "Restaurar en el formulario" y texto neutro si hay conexión. lint, typecheck, test 67/67, test:rules 34/34, test:e2e 6/6 (nuevo `late-rejection.spec.ts`) y build OK | Entrega Develop QA-007/008 | #10 |
| 10 | 2026-11-23 | 4 | testing | Revisión final de la Fase 4 y retest de QA-006 a QA-008, en un clon limpio | **BLOCKED, sin FAIL** en los criterios vigentes. QA-006, QA-007 (contraste 6.44:1; mínimo global 5.22:1) y QA-008, también con red lenta: PASS. AC-04, AC-30 a AC-33 y SEC-01/04/05: PASS. Regresión: test 67/67, test:rules 34/34, test:e2e 6/6. Propuso AC-NEW-06 con QA-009 y QA-010. Producción (AC-34, Google, AC-36) BLOCKED desde el contenedor | Informe Testing #10 | Pendiente: #12 |
| 11 | 2026-11-23 | 4 | develop | Corregir QA-009 y QA-010 (AC-28), texto de permission-denied y README | Entregado en el commit `8692f34`. test 78/78, test:rules 34/34, test:e2e 7/7 (nuevo test de QA-009), lint, typecheck y build OK | Entrega Develop QA-009/010 | Pendiente: #12 |

## Hallazgos y correcciones

| ID | Severidad | Criterio | Hallazgo | Detectado en | Corrección | Re-test |
| --- | --- | --- | --- | --- | --- | --- |
| QA-001 | media | SEC-02 | En `create`, `createdAt` y `updatedAt` aceptan cualquier timestamp; no se exige `request.time` (`firestore.rules` L15, L18) | #1 | `c4062da` | PASS (#3, emulador) |
| QA-002 | media | SEC-02, AC-13, AC-14 | En `update` no se exige `updatedAt == request.time` (L19-20) | #1 | `c4062da` | PASS (#3, emulador) |
| QA-003 | baja | AC-22, SEC-02 | Un título formado solo por espacios pasa las reglas (L11) | #1 | `c4062da` | PASS (#3, emulador) |
| QA-004 | baja | AC-10c | Un error de `getRedirectResult` que llega después de montar `AuthScreen` no se muestra, porque `initialError` solo se copia a `useState` al montar. Además, `error` sobrevive al cerrar sesión | #5 | `70af2de` | PASS (#7) |
| QA-005 | baja | AC-25 | Tras confirmar un borrado, el foco queda en `<body>` (`Dashboard.tsx`, `confirmDelete`) | #5 | `70af2de` | PASS (#7) |
| QA-006 | media | AC-10b | Al cerrar sesión y volver a entrar sin recargar, el botón "Cerrando…" se quedaba deshabilitado. Lo detectó el E2E de Develop en la Fase 4 | #8 | `1c1f831` (`SignedInBar` con `key=uid`) | PASS (#10) |
| QA-007 | baja | AC-25 | En modo oscuro, el badge "+N XP ganados" tiene un contraste de 4.40:1 (`QuestItem.tsx` L95) | #7 | `29551b7` | PASS (#10) |
| QA-008 | baja | AC-26 | Un rechazo tardío deja visible "Misión creada…" junto a "Error de sincronización". El banner es genérico y no dice qué misión falló, un segundo rechazo sobrescribe al primero y el texto de la creación se pierde. El mensaje "al recuperar la conexión" también sale aunque la conexión solo sea lenta (`Dashboard.tsx` L123-125, `QuestForm.tsx` L104-110) | #7 | `29551b7` | PASS (#10) |
| QA-009 | baja | AC-28 | El texto que se escribe mientras "Creando…" sigue en curso se borra al terminar el envío (`QuestForm.tsx`, `resetOnSuccess`) | #10 | `8692f34` | Pendiente: #12 |
| QA-010 | baja | AC-28 | "Restaurar en el formulario" sustituye sin avisar el borrador que haya en curso (`Dashboard.tsx`, `restoreCreation`) | #10 | `8692f34` | Pendiente: #12 |

## Avisos abiertos

- SEC-05: justificado en `docs/SECURITY.md` y aceptado por Testing en #10. Quedan 4 altos en `@grpc/grpc-js`, que no está en el bundle de cliente y para el que no hay versión de firebase que lo corrija.
- AC-36 (antes AC-NEW-05): firebase 13 pide Node ≥24.12, así que hay que declarar `engines` y usar Node 24 en Vercel.

- AC-26 (observación de #5): resuelto en la Fase 3 con una espera máxima de 1,5 s y el estado "pendiente de sincronizar". Testing lo verificó en #7 y #10.

- Numeración: Testing propuso QA-006 y QA-007 en #7, pero el Orquestador ya había asignado QA-006 al defecto que encontró Develop en #8. Los dos de Testing quedan registrados como QA-007 y QA-008.

## Cambios en los criterios

- Tras el informe #10 se añade AC-28 (antes AC-NEW-06): el formulario nunca descarta sin avisar el texto del usuario.

- Tras el informe #1, el Orquestador incorporó a `testing.md` los criterios propuestos por Testing: AC-06 (antes AC-NEW-04), AC-18 (AC-NEW-02), AC-27 (AC-NEW-03) y AC-35 (AC-NEW-01). También precisó SEC-02, AC-11 y AC-12.
- 2026-11-23: a petición de Ricardo, la autenticación anónima se sustituye por Email/Contraseña y Google Sign-in en el proyecto `questflow-5446d`. Se reescribió AC-10 y se añadieron AC-10b, AC-10c y SEC-06. También se añadió AC-36 (Node 24).
- Desde la delegación #4, `develop` y `testing` se invocan como tipos de subagente nativos de Claude Code, porque la sesión ya los reconoce.
