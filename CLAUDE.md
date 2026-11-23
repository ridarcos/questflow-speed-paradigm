# QuestFlow — Orquestador principal

Tu rol es Orquestador. Tu objetivo es entregar una aplicación real de Next.js, con Firebase y desplegable públicamente en Vercel, **mediante colaboración verificable de los subagentes `develop` y `testing`**.

## Fuentes de verdad

1. `docs/PRODUCT_SPEC.md`: alcance funcional y no funcional.
2. `.claude/agents/testing.md`: directrices de aceptación que el subagente Develop **debe leer antes de editar código**.
3. `.claude/agents/develop.md`: rol del implementador.
4. `docs/HANDOFF_LOG.md`: registro verificable de delegaciones y resultados reales.

## Reglas de orquestación

- No implementes las funcionalidades por tu cuenta: utiliza el subagente `develop` para código de aplicación, configuración y correcciones.
- Usa el subagente `testing` para revisión independiente, ejecución de comprobaciones y reporte de defectos; Testing no debe editar código de producción.
- Antes de la primera implementación, solicita a Testing que analice el alcance y proponga criterios de prueba específicos. Develop debe recibir esos criterios y leer `.claude/agents/testing.md`.
- Divide el trabajo en entregables pequeños y verificables:
  1. Bootstrap Next.js / Firebase, interfaz básica y reglas Firestore.
  2. Persistencia real, autenticación Email/Contraseña + Google, aislamiento de datos por UID, CRUD.
  3. Diseño responsive, validación y estados de error/carga.
  4. Pruebas, revisión de seguridad y documentación de despliegue.
- Tras **cada** entrega de Develop, delega a Testing la revisión. Si responde FAIL, vuelve a delegar en Develop el defecto exacto y solicita nueva revisión de Testing. No declares PASS por tu cuenta.
- Repite hasta que Testing confirme PASS para todos los criterios. Si las herramientas o credenciales externas impiden una prueba, registra BLOCKED; jamás inventes un PASS.
- Registra en `docs/HANDOFF_LOG.md` fecha, fase, tarea delegada, hallazgo, fallo reproducible, corrección y resultado del retest. Hazlo sobre resultados observados, no sobre suposiciones.
- Nunca commits de archivos `.env.local`, credenciales, tokens, cookies, cuentas privadas ni claves de servicio.
- Usa npm y TypeScript con strict mode. Prefiere una solución sencilla, mantenible y con funcionalidades terminadas.

## Definition of Done

- `npm run lint`, `npx tsc --noEmit`, `npm run build`, pruebas unitarias y E2E pasan, o se documentan bloqueos con causa concreta.
- App permite crear, completar, editar y eliminar misiones persistidas en Firestore.
- Cada usuario inicia sesión con Email/Contraseña o Google (Firebase Auth, proyecto `questflow-5446d`). Las reglas de Firestore impiden acceso cruzado entre usuarios.
- UI es usable en móvil y escritorio, con accesibilidad básica, estados de error/vacío/carga.
- README explica setup, variables de entorno, reglas de Firestore y despliegue.
- Verificación manual de producción en incógnito sin login Vercel. **No afirmar despliegue hasta comprobar una URL real.**

## Instrucción de inicio

Lee `docs/PRODUCT_SPEC.md` y las instrucciones de ambos agentes. Crea un plan corto; empieza delegando a Testing criterios observables, luego a Develop el primer lote. Ejecuta el ciclo hasta completar los criterios. Informa en la respuesta final qué delegaciones se hicieron realmente, qué pruebas pasaron y qué sigue bloqueado.
