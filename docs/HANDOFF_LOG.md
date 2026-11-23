# Agent Handoff Log — evidencia real

Registro mantenido por el Orquestador. Cada fila corresponde a una delegación ejecutada de verdad; los resultados son los que devolvió el subagente y, cuando aplica, los que el Orquestador volvió a comprobar.

**Cómo se invocaron los subagentes.** Las sesiones se ejecutaron en Claude Code en la nube (un contenedor). Los archivos `.claude/agents/*.md` se crearon durante esa misma sesión, así que Claude Code no los registró como tipos de subagente propios: la herramienta Agent respondió `Agent type 'testing' not found`. Por eso cada delegación lanzó un subagente independiente (`general-purpose`) con su propio contexto, y la primera instrucción de cada prompt era leer y cumplir su archivo de rol (`.claude/agents/testing.md` o `.claude/agents/develop.md`), incluidas sus restricciones de herramientas. Si se abre Claude Code desde la raíz del repositorio en una sesión nueva, `develop` y `testing` se cargan como subagentes nativos.

| # | Fecha (UTC) | Fase | Agente | Tarea delegada | Resultado observado | Evidencia | Re-test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-23 | 0 | testing | Revisar criterios y alcance; auditar `firestore.rules` antes de implementar | FAIL: QA-001, QA-002 y QA-003 en las reglas. Propuso AC-NEW-01 a AC-NEW-04 | Informe Testing #1 | Fase 1 (#3) |
| 2 | 2026-11-23 | 1 | develop | Bootstrap Next.js + Tailwind + Firebase, UI básica y corrección de QA-001 a QA-003 | Entregado en el commit `c4062da`. lint, typecheck, test (8/8) y build OK sin `.env.local`. Avisos: npm audit muestra 4 altos (grpc-js transitivo) y firebase 13 pide Node ≥24.12 | Entrega Develop Fase 1 | #3 |
| 3 | 2026-11-23 | 1 | testing | Revisión independiente de la Fase 1 y retest de QA-001 a QA-003 | **PASS** en AC-01 a AC-06, AC-17, SEC-01 y SEC-02. 29 casos de reglas en el emulador de Firestore, 0 fallos. Playwright: 0 errores de consola y sin scroll horizontal a 360 px | Informe Testing #3 (clon limpio en /tmp) | QA-001 a QA-003 cerrados |
| 4 | 2026-11-23 | 2 | develop | Login con Email/Contraseña y Google, CRUD en `users/{uid}/quests`, estadísticas, filtros, emuladores y tests de reglas | Entregado en el commit `292512a`. lint, typecheck, test 39/39, test:rules 34/34 y build OK. La prueba de mutación de las reglas hizo fallar 2 tests, como se esperaba. El smoke con Playwright y emuladores pasó. Google no se probó de verdad | Entrega Develop Fase 2 | Pendiente: #5 |

## Hallazgos y correcciones

| ID | Severidad | Criterio | Hallazgo | Detectado en | Corrección | Re-test |
| --- | --- | --- | --- | --- | --- | --- |
| QA-001 | media | SEC-02 | En `create`, `createdAt` y `updatedAt` aceptan cualquier timestamp; no se exige `request.time` (`firestore.rules` L15, L18) | #1 | `c4062da` | PASS (#3, emulador) |
| QA-002 | media | SEC-02, AC-13, AC-14 | En `update` no se exige `updatedAt == request.time` (L19-20) | #1 | `c4062da` | PASS (#3, emulador) |
| QA-003 | baja | AC-22, SEC-02 | Un título formado solo por espacios pasa las reglas (L11) | #1 | `c4062da` | PASS (#3, emulador) |

## Avisos abiertos

- SEC-05: `npm audit --omit=dev` muestra 4 altos en `@grpc/grpc-js`, que entra por `@firebase/firestore`. Testing comprobó que no está en el bundle de cliente. Hay que justificarlo en la Fase 4.
- AC-36 (antes AC-NEW-05): firebase 13 pide Node ≥24.12, así que hay que declarar `engines` y usar Node 24 en Vercel.

## Cambios en los criterios

- Tras el informe #1, el Orquestador incorporó a `testing.md` los criterios propuestos por Testing: AC-06 (antes AC-NEW-04), AC-18 (AC-NEW-02), AC-27 (AC-NEW-03) y AC-35 (AC-NEW-01). También precisó SEC-02, AC-11 y AC-12.
- 2026-11-23: a petición de Ricardo, la autenticación anónima se sustituye por Email/Contraseña y Google Sign-in en el proyecto `questflow-5446d`. Se reescribió AC-10 y se añadieron AC-10b, AC-10c y SEC-06. También se añadió AC-36 (Node 24).
- Desde la delegación #4, `develop` y `testing` se invocan como tipos de subagente nativos de Claude Code, porque la sesión ya los reconoce.
