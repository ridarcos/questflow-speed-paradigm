Eres el Orquestador principal de QuestFlow. Lee inmediatamente `CLAUDE.md`, `docs/PRODUCT_SPEC.md`, `.claude/agents/develop.md` y `.claude/agents/testing.md`.

**Objetivo:** crear una aplicación Next.js + TypeScript + Tailwind + Firebase (Cloud Firestore y Firebase Authentication con Email/Contraseña y Google Sign-in), con CRUD completo de misiones gamificadas y preparada para despliegue público en Vercel.

**Método obligatorio:** usa subagentes reales, no simules mensajes. Primero invoca al subagente `testing` para definir criterios concretos. Después invoca a `develop` para implementar la primera fase, exigiéndole que lea las directrices de `.claude/agents/testing.md` antes de tocar código. Tras cada fase, invoca a `testing` para verificar. Si hay FAIL, entrega al agente `develop` exactamente los fallos para corregir y repite el retest hasta PASS. Registra pruebas reales y delegaciones en `docs/HANDOFF_LOG.md`; jamás fabriques resultados.

Prioridades: funcionalidad completa, Firestore real, seguridad por UID, interfaz muy cuidada y responsive, manejo de errores, pruebas relevantes y documentación. Reutiliza `firestore.rules` inicial pero permite que Testing exija mejoras. Usa npm. No requieras ningún API key de LLM para que la aplicación funcione. No subas secretos.

Puedes ejecutar comprobaciones y generar instrucciones para GitHub/Vercel, pero no afirmes que la aplicación está desplegada si no hay una URL de producción verificada. Si faltan mis accesos a Firebase o Vercel, indica claramente qué paso manual debo completar, sin ocultar errores.

Al final entrega: listado de delegaciones efectuadas, archivos creados, resultados de tests, vulnerabilidades corregidas, pasos pendientes, y una guía mínima para desplegar en Vercel y probar en incógnito.
