# Seguridad de QuestFlow

Revisión de la Fase 4 (2026-11-23). Cubre SEC-01 a SEC-06 de `.claude/agents/testing.md`.

## Modelo de seguridad

- La app es un cliente estático. No tiene backend propio, API routes ni Server Actions. Toda la lectura y escritura va del navegador a Firebase Auth y Firestore.
- Las variables `NEXT_PUBLIC_FIREBASE_*` son públicas por diseño: identifican la app web, pero no dan acceso. La protección real son las reglas de Firestore.
- `firestore.rules` deniega todo por defecto. Solo existe la ruta `/users/{uid}/quests/{questId}`, y solo para `request.auth.uid == uid`. También valida campos (`hasOnly`), tipos y longitudes, que `difficulty` sea `easy|medium|hard`, que los timestamps valgan `request.time` y que `createdAt` no cambie. Lo cubren 34 tests de reglas (`npm run test:rules`) y el E2E de aislamiento (`tests/e2e/auth-and-isolation.spec.ts`). Ese E2E comprueba que el token de B recibe 403 en la ruta de A.
- El cliente construye la ruta siempre con el UID de la sesión actual (`src/lib/questsRepo.ts`).

## SEC-01: secretos

- `.gitignore` excluye `.env` y `.env*`, salvo `.env.example`, que solo tiene claves vacías. También excluye las claves de cuentas de servicio y `.vercel`.
- Los E2E y los tests de reglas usan el proyecto ficticio `demo-questflow` contra los emuladores, con valores de configuración inventados (`playwright.config.ts`). Nunca usan el proyecto real.

## SEC-04: contenido de usuario y LLM

- No se usa `dangerouslySetInnerHTML` ni `innerHTML`. React escapa títulos y descripciones al renderizarlos.
- No hay claves de LLM ni llamadas a APIs de IA. Comprobación: `grep -rn "dangerouslySetInnerHTML\|innerHTML\|openai\|anthropic\|gemini" src tests` no devuelve nada.

## SEC-05: `npm audit --omit=dev`

Resultado actual: **4 vulnerabilidades altas**, todas en la misma cadena:

```
@grpc/grpc-js <=1.13.5  (instalada 1.9.16)
  GHSA-m9gg-hp2v-232j  getAuthContext puede dar por autorizados certificados no autorizados
  GHSA-f596-whhp-79r4  el servidor envía al cliente mensajes de error de los handlers
└─ @firebase/firestore 4.20.0  (declara "@grpc/grpc-js": "~1.9.0")
   └─ @firebase/firestore-compat
      └─ firebase 13.4.0
```

**¿Hay una versión de firebase que lo resuelva?** No. `firebase@13.4.0` es la última publicada (`npm view firebase version`) y sigue fijando `@grpc/grpc-js ~1.9.0`. La única "solución" que propone `npm audit fix --force` es bajar a `firebase@9.14.0`, un cambio de major hacia atrás que está prohibido y que rompería la app (AC-36 y la API modular actual).

**Por qué se acepta el riesgo:**

1. **No llega al navegador.** Firestore usa en el navegador su build `browser` (WebChannel/fetch), no gRPC. Tras `npm run build`, `grep -rlE "grpc-js|@grpc" .next/static` devuelve 0 archivos.
2. **En el servidor nunca se ejecuta.** `@grpc/grpc-js` aparece en el chunk SSR de `.next/server` porque Next empaqueta el módulo Node de Firestore al prerenderizar los componentes cliente. Pero la página `/` es estática (`○ Static`), y `getDb()` y las llamadas a Firestore solo se hacen dentro de efectos y manejadores de eventos, que no corren en SSR. No hay rutas de servidor que hablen con Firestore.
3. **Las dos advertencias afectan a servidores gRPC.** `getAuthContext` (validación de certificados cliente) y la exposición de mensajes de error en las respuestas son comportamientos del lado servidor. QuestFlow no levanta ningún servidor gRPC. Como mucho, Firestore usaría grpc-js como cliente.

**Alternativa descartada:** un `overrides` de npm que fuerce `@grpc/grpc-js >=1.13.6` dejaría el audit en verde. Pero sale del rango que Firebase declara y prueba (`~1.9.0`), y a cambio no reduce ningún riesgo real, por los puntos 1 a 3.

**Cuándo revisarlo:** cuando una versión de `firebase` o `@firebase/firestore` suba la dependencia de grpc-js, o si se añade código de servidor que use Firestore (Route Handlers, Server Actions o el SDK en Node). En ese caso hay que actualizar y volver a lanzar `npm audit --omit=dev`.

Las vulnerabilidades de devDependencies (firebase-tools, Playwright, etc.) no llegan a producción. Por eso no se incluyen en SEC-05.

## Fase 5 (rediseño v2): SEC-07 a SEC-10

- **SEC-07, sin terceros nuevos.** Las dos fuentes vienen de npm (`@fontsource-variable/*`) y se sirven desde el mismo origen (`.next/static/media/*.woff2`). No hay `next/font/google`, Google Fonts, `preconnect` ni `preload` a otros dominios. Iconos, logo, mapa de curvas y perfil de ruta son SVG en línea. Con email y emuladores, ninguna petición sale de `127.0.0.1`. El acceso con Google carga `https://apis.google.com/js/api.js` porque lo pide el propio SDK de Firebase Auth para el popup y el redirect.
- **SEC-08, almacenamiento local mínimo.** Solo `src/lib/localFlags.ts` usa `localStorage`, siempre dentro de try/catch y con respaldo en memoria. La única clave es `questflow:tutorial:<uid>`, con el valor `done`. Nunca guarda email, nombre, títulos, descripciones ni tokens. Las claves `firebase:*` del SDK quedan fuera.
- **SEC-09, contenido del usuario como texto.** React escapa títulos y descripciones también en las tarjetas y los diálogos. El SVG del perfil solo lleva IDs (`data-milestone`) y cifras, el `aria-label` del perfil se construye con números y los textos del tutorial son constantes. `tests/e2e/route-profile.spec.ts` crea misiones con títulos `<img src=x onerror=alert(1)>` y `</svg><script>alert(1)</script>`, y comprueba que se muestran literalmente, sin diálogos de `alert`.
- **SEC-10, siembra limitada a la sesión.** `seedCoordinator` usa el UID solo como clave y para comprobar, antes de cada escritura, que la sesión sigue siendo la de ese UID. Si la sesión cambia, se detiene. La ruta la construye `createQuest` con el UID de la sesión (SEC-03). Las reglas no cambian. El E2E de aislamiento comprueba por REST que cada colección solo contiene lo suyo y que con el token de B la ruta de A da 403.
