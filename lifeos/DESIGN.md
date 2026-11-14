# Diseño de LifeOS — "Bitácora del día"

LifeOS es una agenda personal que también lleva dinero, salud y hábitos. Su trabajo principal es que, al abrirla, entiendas **cómo va tu día** de un vistazo y puedas anotar algo en segundos.

La identidad sale de ese objeto: **el día como un reloj**. El elemento distintivo de la app es el reloj del día del Resumen: las 24 horas en círculo, cada tarea con hora como un arco y una manecilla de cempasúchil que marca el ahora. El logo y el icono de la app usan el mismo dibujo.

## Tokens

### Color

Los nombres vienen del entorno del usuario (Ciudad de México): la noche, la jacaranda, el cempasúchil, el nopal y la granada. Están definidos en `src/index.css` sobre los nombres de Tailwind, así que el código sigue usando `slate`, `indigo`, etc.

| Token | Clase de Tailwind | Oscuro | Uso |
|---|---|---|---|
| Noche | `slate-950` / `900` / `800` | `#14121c` / `#1e1b29` / `#2e2a3d` | Fondo, tarjetas y bordes |
| Tinta | `slate-100` | `#edebf4` | Texto principal |
| Jacaranda | `indigo-400` / `600` | `#9886f0` / `#6a53d6` | Acento: navegación, botones, tareas pendientes |
| Cempasúchil | `amber-400` | `#f5a63a` | El "ahora", rachas, meta de sueño, foco del teclado |
| Nopal | `emerald-400` | `#3fc48f` | Ingresos y tareas hechas |
| Granada | `rose-400` | `#f9637b` | Gastos excedidos, atrasos y borrar |
| Agua | `sky-400` | `#4fb3e3` | Hidratación y tareas que se repiten |

En el tema claro la escala Noche se invierte (papel lavanda `#f3f2f8` y tarjetas blancas), y los acentos 300/400 se oscurecen para conservar el contraste.

### Colores de categorías (gráficas)

Es la paleta de referencia de la skill de visualización, **validada con su script** para protanopia, deuteranopia y tritanopia sobre el fondo oscuro (`#1e1b29`) y el claro (`#ffffff`). Pasa todas las pruebas.

`#3987e5` azul · `#d95926` naranja · `#199e70` aqua · `#c98500` amarillo · `#d55181` magenta · `#0ca30c` verde · `#9085e9` violeta · `#e66767` rojo

El **orden** es parte de la validación: colores vecinos siempre se distinguen. Las categorías nuevas toman el siguiente color libre en ese orden. La paleta anterior (emerald/indigo/rose/amber/violet de Tailwind) **fallaba** la prueba de luminosidad.

### Colores de las gráficas de tendencia

Están definidos como variables en `src/index.css` (`--viz-income`, `--viz-expense` y `--heat-0` a `--heat-4`) y cambian solos con el tema.

| Gráfica | Colores | Por qué |
|---|---|---|
| Ingresos y gastos por mes | Azul `#3987e5` y naranja `#d95926` (oscuro) · `#2a78d6` y `#eb6834` (claro) | Verde contra rojo **falló** la prueba de deuteranopia (diferencia 3.7; el mínimo es 8). Azul contra naranja da 26.8 |
| Constancia de hábitos | Escala de un solo tono, jacaranda, del nivel 1 al 4 | Es una magnitud ordenada (ninguno → todos); un solo tono hace que el orden se lea en el color. En oscuro se subió un paso porque el nivel 1 casi desaparecía sobre el fondo |

En el resto de la app, los montos siguen en verde y rojo porque siempre llevan signo **+** o **−**, que sirve de segunda señal.

### Tipografía

| Rol | Fuente | Dónde |
|---|---|---|
| Títulos | Bricolage Grotesque | `h1`–`h3`; la fecha grande del Resumen |
| Texto | Figtree | Todo lo demás |
| Cifras | IBM Plex Mono, números de ancho fijo | Montos, horas y conteos: clase `.num` |

Las fuentes se instalan como paquetes (`@fontsource`) y se incluyen en la compilación, así funcionan sin conexión dentro de la app instalada.

### Reglas

- **Una medida por gráfica.** Sueño (0–10 h) y energía (1–5) son dos gráficas, nunca dos escalas en el mismo eje.
- **Toda gráfica responde al cursor.** El reloj, la dona y las gráficas de 7 días muestran el detalle al señalar. Las áreas que reaccionan son más grandes que la marca.
- **El color nunca va solo.** Las categorías llevan nombre junto al punto de color, y los estados llevan texto ("Atrasada", "Excedido por…").
- **Foco visible** con teclado en todos los controles (contorno cempasúchil).
- **Se respeta "reducir movimiento"** del sistema.
- **El texto dice lo que pasa**: "Descargar respaldo", "Movimientos en Excel". Los estados vacíos invitan a actuar ("Agenda algo con hora para verlo aquí").

## Cómo usar las herramientas de diseño

Estas son las herramientas disponibles en las sesiones de Claude y cómo sirven a LifeOS. Las dos primeras ya se usaron en este rediseño.

| Herramienta | Para qué sirve en LifeOS | Ejemplos de uso |
|---|---|---|
| **Skill frontend-design** | Dirección visual, sistema de tokens y crítica de pantallas | ✅ Usada en esta versión: identidad "Bitácora del día", reloj del día, tipografía. Siguiente: pantalla de bienvenida, estados vacíos y una página de presentación. |
| **Skill dataviz** (con su validador de paletas) | Elegir el tipo de gráfica, validar colores para daltonismo y diseñar tooltips | ✅ Usada: paleta de categorías validada, gráficas de salud separadas, dona con separación y detalle al señalar, tendencia mensual de ingresos y gastos y calendario de constancia de hábitos. Siguiente: barras de presupuesto por categoría a lo largo de los meses. |
| **Capturas con Playwright** (navegador incluido) | Revisar cada pantalla en escritorio, celular, tema claro y oscuro | ✅ Usadas para criticar este rediseño (detectaron la dona que mostraba la categoría equivocada). Siguiente: pruebas de regresión visual en CI que comparen capturas antes y después de cada cambio. |
| **Figma** (conector) | Diseñar y probar pantallas antes de programarlas | Pasar las pantallas actuales a Figma para iterar; crear una biblioteca de componentes con los tokens de este archivo; diagramar en FigJam los flujos (entrada rápida, sincronización). |
| **Canva** (conector) | Material de difusión con la misma identidad | Kit de marca con la paleta y las fuentes; publicaciones para redes; capturas para tiendas de apps; presentación del proyecto. |
| **Higgsfield** (conector) | Imágenes y video generados | Ilustraciones para la pantalla de bienvenida y los estados vacíos; un video corto que muestre el reloj del día en uso. |
| **Artifacts** (páginas compartibles) y **skills artifact-design / artifact-diagramming** | Publicar prototipos y explicaciones visuales | Un prototipo navegable para que otras personas den su opinión; una página con este sistema de diseño; un diagrama de cómo se sincronizan los datos. |
| **Skills pptx / docs** | Documentos | Presentación del proyecto (por ejemplo, para la escuela o un concurso) y un manual de uso. |

### Qué se hizo con código y qué queda para los conectores

La bienvenida, las ilustraciones y el kit de marca se hicieron directamente en el proyecto, sin Figma, Higgsfield ni Canva:

- **Ilustraciones** (`src/components/Illustrations.jsx`): vectoriales y con los colores del sistema. Cambian solas con el tema, pesan casi nada, funcionan sin conexión y no gastan créditos.
- **Kit de marca** (`npm run brand`): se genera desde la app real, así que siempre coincide con lo publicado.

Los conectores siguen siendo útiles para lo que el código no cubre:

- **Figma**: iterar ideas de pantallas nuevas antes de programarlas.
- **Canva**: publicaciones para redes con el kit de `brand/`.
- **Higgsfield**: un video corto del reloj del día en uso, para presentar la app.

## Bienvenida e ilustraciones

- **Bienvenida** (solo la primera vez, o desde Ajustes): tres pasos. El reloj del día se completa en cada paso: primero la manecilla y una tarea, luego más tareas, dinero y agua, y al final un hábito cumplido. El paso 2 usa el intérprete real de la entrada rápida para mostrar qué entendería, sin guardar nada.
- **Estados vacíos**: cada pantalla vacía tiene una ilustración y una acción concreta ("Escribe arriba, por ejemplo…", sugerencias de hábitos de un toque).
- **Estilo de las ilustraciones**: formas redondeadas con una sombra elíptica y un segundo tono como brillo. Volumen suave, solo en ilustraciones; nunca en botones ni tarjetas.
- **Movimiento**: arcos que se dibujan, objetos que aparecen con un pequeño rebote y una flotación lenta, solo en la bienvenida. Con "reducir movimiento" todo aparece directamente en su estado final.

## Kit de marca

`npm run brand` compila la app, la abre con los datos de ejemplo (sábado 14 de noviembre de 2026, 10:30) y genera:

| Archivo | Uso |
|---|---|
| `public/og-image.png` (1200×630) | Vista previa al compartir el enlace. Las etiquetas `og:` de `index.html` usan la dirección pública que define el workflow de GitHub Pages |
| `brand/capturas/1-resumen.png` … `4-salud.png` (1080×1920) | Historias, publicaciones o tiendas de apps |
| `brand/hoja-de-marca.png` | Logo, colores con nombre y uso, y tipografía |

Si la app cambia, se vuelve a correr el comando y el kit queda al día.
