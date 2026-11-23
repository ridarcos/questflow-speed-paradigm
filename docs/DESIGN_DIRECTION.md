# QuestFlow — Dirección de diseño v2 ("Ruta")

Petición de Ricardo (2026-11-23): rediseño completo de UI/UX que se sienta hecho a mano, no genérico; misiones precreadas para usuarios nuevos y un tutorial de uso dentro de la app.

## Idea central

Una misión personal es un tramo de ruta. QuestFlow se presenta como un **mapa de ruta de montaña**: la dificultad es el terreno, la XP es el desnivel acumulado y completar misiones es ganar altura. El vocabulario sale del senderismo y la orientación, sin disfrazar la app de juego infantil ni de pergamino.

- Dificultad como terreno (los valores en Firestore siguen siendo `easy|medium|hard`):
  - easy → **Sendero** · 10 XP
  - medium → **Ladera** · 25 XP
  - hard → **Cumbre** · 50 XP
- XP como "metros de desnivel" solo en la narrativa visual; las cifras siguen diciendo XP para no confundir.

## Paleta (tokens en `globals.css`, `@theme`)

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `paper` | `#EEF2EC` (blanco salvia frío) | `#0F1C19` (mapa nocturno) | fondo |
| `ink` | `#1B2A26` (tinta abeto) | `#E4EBE5` | texto |
| `contour` | `#2F6F5E` (bosque) | `#7FC4AE` | marca, líneas de contorno, acción principal |
| `marker` | `#F2B134` (amarillo de baliza) | `#F2B134` | XP, completado, foco; nunca como texto sobre `paper` claro |
| `trail` | `#3E7CB1` (lago) | `#8DB9E0` | Sendero |
| `slope` | `#A8641C` (ocre) | `#E0A15A` | Ladera |
| `summit` | `#8E3A52` (brezo) | `#E29AB0` | Cumbre |

Tokens añadidos tras el informe Testing #15 (QA-011 a QA-013), con ratios medidos:

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `surface` | `#F7F9F6` | `#152420` | fondo de tarjetas y paneles |
| `ink-soft` | `#4B5C57` (6.25:1 sobre paper, 6.68:1 sobre surface) | `#A6B5AF` (8.21:1 / 7.55:1) | texto secundario |
| `line` | `#7A8C86` (3.13:1 / 3.35:1) | `#5E716B` (3.37:1 / 3.10:1) | bordes de campos y chips sin seleccionar |
| `danger` | `#A12D2D` (6.33:1 / 6.77:1) | `#F19A8F` (8.13:1 / 7.48:1) | errores |
| `on-marker` | `#1B2A26` | `#1B2A26` | texto sobre `marker` en ambos temas (7.91:1) |

Reglas de contraste (WCAG AA en ambos temas):

- Texto ≥ 4.5:1; elementos no textuales ≥ 3:1.
- Sobre `marker` el texto es siempre `on-marker`, nunca el `ink` del tema oscuro (QA-011).
- El texto de terreno va en `ink`. `trail`, `slope` y `summit` solo colorean iconos, bordes y acentos, donde superan 3:1 (QA-012).
- El foco visible es un contorno de 2 px en `contour` con separación de 2 px. Los hitos completados se rellenan de `marker` con contorno `contour` y una marca de check, para no depender del amarillo sobre `paper` claro (QA-013).
- Un hito completado nunca se distingue de uno activo solo por el color, haya las misiones que haya (AC-70). El activo es un anillo hueco: `surface` dentro y borde del color de su terreno. El completado lleva el check mientras cabe dentro del disco de `marker` (radio ≥ 4 px). Si no cabe (a 360 px, desde 22 misiones), lleva un núcleo relleno: en claro es `on-marker` (14.11:1 frente a `surface`, 7.91:1 sobre `marker`), porque `marker` solo da 1.78:1 y el hito parecería hueco. En oscuro el núcleo se oculta: `on-marker` solo daría 1.08:1 frente a `surface` y parecería un hueco, mientras que `marker` ya da 8.52:1, así que el disco se lee relleno frente al hueco del activo. La función pura es `milestoneShape` (`src/lib/routeProfile.ts`).
- El texto de los botones sobre `contour` es `paper`, nunca blanco.
- `ink` al 10 % solo vale para bordes decorativos de tarjetas.
- El borde del tutorial usa `line` y el de las alertas `danger`.
- Las curvas decorativas (mapa del acceso y relieve del perfil) no pueden bajar de 4.5:1 el texto que pase por encima ni de 3:1 el contorno de los hitos (QA-014 y QA-015).

## Tipografía

- Display: **Bricolage Grotesque** (variable), para el nombre de la app, titulares y cifras grandes. Usar su eje óptico/anchura de forma activa en el titular del perfil de ruta.
- Texto: **Instrument Sans** (variable), para todo lo demás.
- Cargar con paquetes `@fontsource-variable/*` por npm (no depende de red en el build). Sin monoespaciada.
- Escala: 14 / 16 / 20 / 28 / 44 px aprox. Frases en "sentence case"; nada de etiquetas en mayúsculas espaciadas ni flechas "→" en botones.

## Lo memorable (solo uno)

**El perfil de ruta**: un SVG en la cabecera del dashboard que dibuja una línea de cresta con curvas de nivel suaves. Cada misión es un hito sobre la línea, ordenado por fecha de creación; los hitos completados quedan rellenos con `marker` y la línea recorrida se resalta hasta el último completado. A la derecha, el desnivel acumulado (XP ganada) en grande con Bricolage. Accesible: `role="img"` con `aria-label` que resume "N de M misiones completadas, X XP". Una sola animación orquestada: al completar una misión, el hito se rellena y la línea avanza (desactivada con `prefers-reduced-motion`).

Todo lo demás es sobrio: tarjetas planas sin sombras grises, bordes de 1 px en `ink`/10 %, radios distintos según jerarquía (contenedores 20 px, tarjetas 14 px, chips totalmente redondos), un único patrón de curvas de nivel muy tenue en el fondo del acceso.

## Layout

```
Escritorio (≥1024 px)
┌──────────────────────────────────────────────────────────┐
│ QuestFlow (logo de curvas)        Ver tutorial · usuario │
├──────────────────────────────────────────────────────────┤
│  Perfil de ruta (SVG ancho)                    1 240 XP  │
├───────────────────────┬──────────────────────────────────┤
│ Nueva misión (sticky) │ Filtros  Todas · Activas · Hechas│
│  título, notas,       │ ┌ tarjeta ─────────────────────┐ │
│  terreno (3 chips     │ │ ▲ Cumbre · 50 XP   [Completar]│ │
│  ilustrados)          │ └──────────────────────────────┘ │
│  estadísticas breves  │ ...                              │
└───────────────────────┴──────────────────────────────────┘

Móvil (360 px): cabecera compacta → perfil de ruta (altura reducida) →
formulario plegable "Nueva misión" → filtros → lista. Sin scroll horizontal.
```

Alineación a la izquierda en todo el contenido; las cifras a la derecha en el perfil.

Acceso (sin sesión): dos columnas en escritorio. Izquierda, un mapa de curvas de nivel generado en SVG con el lema "Cada misión, un tramo de tu ruta" y tres líneas que explican Sendero / Ladera / Cumbre. Derecha, el formulario. En móvil, el mapa queda como franja superior baja.

## Misiones precreadas

Al crear una cuenta nueva (email o Google, `getAdditionalUserInfo(...).isNewUser`), se escriben 4 misiones en `users/{uid}/quests` con el mismo `createQuest` que usa el formulario (pasan las reglas actuales, sin campos nuevos):

1. Sendero — "Marca esta misión como completada" — "Pulsa Completar y mira cómo avanza tu ruta."
2. Sendero — "Edita esta misión y hazla tuya" — "Cambia el título, las notas o el terreno."
3. Ladera — "Planifica tres objetivos para esta semana" — "Crea una misión por cada uno desde Nueva misión."
4. Cumbre — "Termina ese proyecto que llevas tiempo aplazando" — "Las cumbres valen 50 XP. Elige una de verdad."

No se repiten si el usuario las borra. Además, en el estado vacío de "Todas" se ofrece un botón "Añadir misiones de ejemplo" para cuentas antiguas.

## Tutorial

Recorrido guiado de 5 pasos sobre los elementos reales (perfil de ruta, nueva misión, terreno, filtros, una tarjeta con Completar/Editar/Eliminar). Se abre solo la primera vez por UID (marca en `localStorage`, con try/catch) y se repite con "Ver tutorial" en la cabecera. Es un diálogo accesible: foco atrapado, Esc cierra, "Saltar", "Anterior"/"Siguiente", "Paso N de 5" y foco devuelto al cerrar. Sin dependencias nuevas.

## Voz

Español claro, tuteo, verbos concretos. Botones dicen lo que hacen ("Crear misión", "Guardar cambios", "Eliminar misión"). Los errores explican qué pasó y cómo seguir, sin disculpas.
