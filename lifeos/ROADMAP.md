# Plan de trabajo — LifeOS

Lista ordenada de las actualizaciones pendientes. El orden sigue tres reglas:

1. **Primero lo que desbloquea lo demás**: accesos, repositorios y publicación.
2. **Auditar → proponer → implementar → verificar**: ninguna etapa de implementación empieza sin que la anterior esté aprobada y probada.
3. **Una pantalla a la vez**: cada etapa se valida en escritorio y celular antes de pasar a la siguiente.

Tamaño estimado: **S** = una sesión corta · **M** = una sesión · **L** = varias sesiones.

---

## 0. Requisitos (dependen de ti)

| # | Tarea | Desbloquea | Estado |
|---|---|---|---|
| 0.1 | Crear el repositorio vacío **`lifeos`** en github.com/new | Bloque 1 | ⏳ Pendiente |
| 0.2 | (Opcional) Proyecto de Supabase para la nube de LifeOS | Sincronización real de LifeOS | ⏳ Pendiente |

---

## 1. Cerrar la versión actual (S)

Es corto y deja la app publicada e instalable en el celular.

| # | Tarea | Tamaño |
|---|---|---|
| 1.1 | Mover `lifeos/` a su propio repositorio, con historial | S |
| 1.2 | Activar las pruebas automáticas (CI) y GitHub Pages; verificar que la app publicada se instale en el celular | S |

---

## 2. Mejoras de diseño

Basado en `DESIGN.md`.

| # | Tarea | Herramienta | Tamaño |
|---|---|---|---|
| 2.1 | ✅ Tendencia de ingresos y gastos por mes y calendario de constancia de hábitos | Skill dataviz | M |
| 2.2 | ✅ Bienvenida de tres pasos (nombre, prueba de la entrada rápida, empezar con ejemplo o desde cero) | frontend-design | M |
| 2.3 | ✅ Ilustraciones vectoriales con los colores del sistema para la bienvenida y los estados vacíos | Código (SVG) | S |
| 2.4 | ✅ Kit de marca: imagen para compartir enlaces, capturas en marco de teléfono y hoja de marca (`npm run brand`) | Playwright | S |
| 2.5 | ✅ Pruebas de regresión visual automáticas, flujos completos y contraste de colores | Playwright y Vitest en CI | S |
| 2.6 | ✅ Resumen: crítica (23/40), auditoría (13/20), corrección de los 4 problemas importantes, pulido y navegación inferior en celular | impeccable | M |
| 2.7 | ✅ Segunda crítica del Resumen: **23 → 25/40**. Corregido: lo atrasado en un solo grupo plegado con "Mover todas a hoy" y deshacer; en celular, avisos juntos en una fila que se abre, título antes del reloj y el +1 de agua a la vista | impeccable `critique` | S |
| 2.7.1 | ✅ Dinero que se entienda: "Ocio: te pasaste por $269 · límite $1,500 al mes" (también en Finanzas) y, con el mes en negativo, "Gastaste de más" con la explicación y la categoría que más pesa, o la sugerencia de registrar los ingresos | impeccable `clarify` | S |
| 2.7.2 | ✅ Cada sección abre desde arriba con el foco en el contenido; reloj con una sola parada de Tab, flechas, Enter al botón, Esc, anuncio al seleccionar y botón de 44 px; avisos emergentes que sí se anuncian | impeccable `harden` | S |
| 2.7.3 | Idea aparte: que el reloj muestre gastos y vasos de agua, y probar un reloj de "horas despierto" o que gire con el ahora arriba | impeccable `shape` | M |
| 2.8 | Bienvenida: crítica, auditoría, correcciones y pulido (empezar por quitar los textos pequeños encima de los títulos) | impeccable | M |
| 2.9 | Mismo flujo para Agenda, Finanzas, Salud y Ajustes, una pantalla a la vez | impeccable | L |

## 3. Automatizaciones

### 3.1 Listas (se activan solas al moverlo a su repositorio)

| Automatización | Cuándo corre | Qué evita |
|---|---|---|
| **90 pruebas de lógica** (Vitest) | Cada cambio | Errores en fechas, entrada rápida, finanzas, repetición, sincronización |
| **Contraste de colores** (lee `index.css`) | Cada cambio | Que un cambio de color deje texto ilegible en tema claro u oscuro. Ya encontró 2 problemas reales en el tema claro |
| **23 flujos en el navegador** | Cada cambio | Que se rompa agendar, borrar y deshacer, renombrar categorías, la migración de datos… |
| **Accesibilidad básica** | Cada cambio | Botones o campos sin nombre para lectores de pantalla |
| **27 capturas de regresión visual** (escritorio oscuro y claro, celular) | Cada cambio | Cambios visuales no intencionales. Si falla, el reporte trae imagen esperada, actual y diferencia |
| **Publicación en GitHub Pages** | Cada cambio en `main` | Publicar una versión con pruebas fallando: solo publica si todo pasa |
| **Dependabot** | Semanal | Dependencias desactualizadas; abre un PR que pasa por todas las pruebas |

### 3.2 Propuestas (necesitan tu visto bueno, porque actúan solas fuera de una sesión)

| # | Automatización | Cómo | Valor |
|---|---|---|---|
| 3.2.1 | **Informe semanal de avance** | Tarea programada cada viernes que use tu skill "Informe de trabajo elaborado esta semana" con los cambios de la semana | Reporte sin tener que pedirlo |
| 3.2.2 | **Vigilar PRs** | Claude sigue cada PR: si una prueba falla en CI, revisa el reporte y propone el arreglo | Menos tiempo depurando |
| 3.2.3 | **Revisión de código en cada PR** | La skill `/code-review` comenta los PR antes de aceptarlos | Encuentra errores antes de publicar |
| 3.2.4 | **Presupuesto de rendimiento** | Lighthouse en CI con mínimos de rendimiento y accesibilidad en celular | Que la app siga rápida en celulares de gama baja |

## 4. Ingresos: modelo mixto (después de publicar)

Decidido en `PRODUCT.md`: gratis con anuncios limitados y sin personalizar, más un plan Plus que los quita. Va en este orden porque cada paso desbloquea el siguiente:

| # | Paso | Depende de | Tamaño |
|---|---|---|---|
| 4.1 | Publicar la app (bloque 1) y conseguir los primeros usuarios | Repositorio `lifeos` | S |
| 4.2 | Dominio propio (por ejemplo `lifeos.mx`) apuntando a la app | Tú: comprarlo | S |
| 4.3 | Aviso de privacidad (LFPDPPP) y página de términos, en la app y en el sitio | 4.2 | S |
| 4.4 | Espacio de anuncio en la app: un solo lugar al final del Resumen, se carga después del contenido, desaparece sin conexión, nunca en formularios ni en la bienvenida. Con pruebas de contraste, teclado y velocidad | 4.2 | M |
| 4.5 | Alta en la red de anuncios (por ejemplo AdSense, sin personalizar) y conexión del espacio | 4.3, 4.4 · Tú: crear la cuenta | S |
| 4.6 | Plan Plus: definir precio y funciones, cobro (Mercado Pago o Stripe) y verificación del pago en el servidor | Usuarios reales · Tú: cuenta de cobro | L |
| 4.7 | Medir: ingresos por anuncios frente a Plus, sin rastrear a las personas (conteos agregados) | 4.5, 4.6 | S |

## 5. Funciones pendientes (cuando se necesiten)

- Sincronizar Salud elemento por elemento (hoy gana el bloque completo más reciente).
- Notificaciones push con la app cerrada (requiere un servidor de push).
