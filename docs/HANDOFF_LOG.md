# Agent Handoff Log — evidencia real

Registro mantenido por el Orquestador. Cada fila corresponde a una delegación ejecutada de verdad; los resultados son los que devolvió el subagente y, cuando aplica, los que el Orquestador volvió a comprobar.

**Cómo se invocaron los subagentes.** Las sesiones se ejecutaron en Claude Code en la nube (un contenedor). Los archivos `.claude/agents/*.md` se crearon durante esa misma sesión, así que Claude Code no los registró como tipos de subagente propios: la herramienta Agent respondió `Agent type 'testing' not found`. Por eso cada delegación lanzó un subagente independiente (`general-purpose`) con su propio contexto, y la primera instrucción de cada prompt era leer y cumplir su archivo de rol (`.claude/agents/testing.md` o `.claude/agents/develop.md`), incluidas sus restricciones de herramientas. Si se abre Claude Code desde la raíz del repositorio en una sesión nueva, `develop` y `testing` se cargan como subagentes nativos.

| # | Fecha (UTC) | Fase | Agente | Tarea delegada | Resultado observado | Evidencia | Re-test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-23 | 0 | testing | Revisar criterios y alcance; auditar `firestore.rules` antes de implementar | FAIL: QA-001, QA-002 y QA-003 en las reglas. Propuso AC-NEW-01 a AC-NEW-04 | Informe Testing #1 | Pendiente: Fase 1 |

## Hallazgos y correcciones

| ID | Severidad | Criterio | Hallazgo | Detectado en | Corrección | Re-test |
| --- | --- | --- | --- | --- | --- | --- |
| QA-001 | media | SEC-02 | En `create`, `createdAt` y `updatedAt` aceptan cualquier timestamp; no se exige `request.time` (`firestore.rules` L15, L18) | #1 | Pendiente | — |
| QA-002 | media | SEC-02, AC-13, AC-14 | En `update` no se exige `updatedAt == request.time` (L19-20) | #1 | Pendiente | — |
| QA-003 | baja | AC-22, SEC-02 | Un título formado solo por espacios pasa las reglas (L11) | #1 | Pendiente | — |

## Cambios en los criterios

- Tras el informe #1, el Orquestador incorporó a `testing.md` los criterios propuestos por Testing: AC-06 (antes AC-NEW-04), AC-18 (AC-NEW-02), AC-27 (AC-NEW-03) y AC-35 (AC-NEW-01). También precisó SEC-02, AC-11 y AC-12.
