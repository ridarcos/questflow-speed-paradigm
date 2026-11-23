# Speed Paradigm: kit de coordinación de QuestFlow

Este paquete **NO es todavía una app desarrollada**: aporta los tres roles, criterios verificables, reglas Firebase y el prompt para que Claude Code construya el proyecto usando delegación real.

## 1. Crear la app Next.js en tu equipo

```powershell
npx create-next-app@latest questflow --typescript --tailwind --eslint --app --src-dir --use-npm
cd questflow
npm install firebase
```

Extrae los archivos de este kit dentro de la carpeta `questflow/` (sin borrar los archivos creados por Next.js). Sustituye el `.gitignore` existente por la versión combinada y conserva cualquier exclusión propia del proyecto. Revisa que `CLAUDE.md`, `.claude/agents/develop.md` y `.claude/agents/testing.md` estén en las rutas indicadas.

## 2. Conectar Firebase

- Crear proyecto en Firebase Console con plan Spark.
- Usar el proyecto existente `questflow-5446d`. Activar Authentication > Sign-in method > Email/Password y Google.
- Crear Cloud Firestore en modo producción.
- Registrar una aplicación Web y copiar la configuración a `.env.local` usando las claves de `.env.example`.
- Publicar las reglas `firestore.rules` desde Firebase Console o con `firebase deploy --only firestore:rules --project TU_PROJECT_ID` (necesita `firebase-tools` e inicio de sesión).
- Añadir dominios autorizados de Firebase Auth cuando sea necesario, incluido el dominio de Vercel.
- Las variables de configuración web `NEXT_PUBLIC_FIREBASE_*` son públicas por definición. No subir contraseñas, tokens ni credenciales de cuentas de servicio.

## 3. Ejecutar agentes reales

Abre Claude Code **desde la raíz del proyecto** y pega íntegro el contenido de `PROMPT_FOR_CLAUDE_CODE.md`.

```powershell
claude
```

El orquestador debe delegar en `testing` y `develop` y conservar un registro de resultados reales. Si no ves delegaciones efectivas, pide que muestre cómo invocó a cada agente. El archivo de agentes no demuestra por sí solo la ejecución.

## 4. QA antes de publicar

```powershell
npm run lint
npx tsc --noEmit
npm run build
# según los scripts añadidos por Develop:
npm run test
npx playwright test
```

Las pruebas E2E deben configurarse para el entorno correcto; no marques PASS sin ejecutarlas.

## 5. GitHub + producción Vercel

- Subir repositorio sin `.env.local`, verificando `git status`.
- Importar repositorio a Vercel Hobby, configurar variables `NEXT_PUBLIC_FIREBASE_*` para Production y desplegar la rama principal.
- Configurar Vercel **Settings > Deployment Protection** para que el dominio de producción sea público. Si el alcance es All Deployments, se bloqueará el dominio; elegir None o configuración que no proteja el dominio de producción.
- Abrir el dominio de producción en incógnito, sin Vercel login. Crear una misión y recargar para comprobar Firestore.
- Entregar URL pública de producción, URL del repo, credenciales de una cuenta de prueba si el evaluador las necesita (también puede registrarse o usar Google), y las cuatro respuestas del formulario real.

## Importante

No se han ejecutado aún los agentes, ni se ha construido, testeado o publicado la app. No uses este kit como evidencia de pruebas superadas. No compartas el enlace personal/token de entrega en GitHub, capturas o documentos públicos.
