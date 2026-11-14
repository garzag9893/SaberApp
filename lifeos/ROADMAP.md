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

## 3. Automatizaciones

### 3.1 Listas (se activan solas al moverlo a su repositorio)

| Automatización | Cuándo corre | Qué evita |
|---|---|---|
| **86 pruebas de lógica** (Vitest) | Cada cambio | Errores en fechas, entrada rápida, finanzas, repetición, sincronización |
| **Contraste de colores** (lee `index.css`) | Cada cambio | Que un cambio de color deje texto ilegible en tema claro u oscuro. Ya encontró 2 problemas reales en el tema claro |
| **13 flujos en el navegador** | Cada cambio | Que se rompa agendar, borrar y deshacer, renombrar categorías, la migración de datos… |
| **Accesibilidad básica** | Cada cambio | Botones o campos sin nombre para lectores de pantalla |
| **21 capturas de regresión visual** (escritorio oscuro y claro, celular) | Cada cambio | Cambios visuales no intencionales. Si falla, el reporte trae imagen esperada, actual y diferencia |
| **Publicación en GitHub Pages** | Cada cambio en `main` | Publicar una versión con pruebas fallando: solo publica si todo pasa |
| **Dependabot** | Semanal | Dependencias desactualizadas; abre un PR que pasa por todas las pruebas |

### 3.2 Propuestas (necesitan tu visto bueno, porque actúan solas fuera de una sesión)

| # | Automatización | Cómo | Valor |
|---|---|---|---|
| 3.2.1 | **Informe semanal de avance** | Tarea programada cada viernes que use tu skill "Informe de trabajo elaborado esta semana" con los cambios de la semana | Reporte sin tener que pedirlo |
| 3.2.2 | **Vigilar PRs** | Claude sigue cada PR: si una prueba falla en CI, revisa el reporte y propone el arreglo | Menos tiempo depurando |
| 3.2.3 | **Revisión de código en cada PR** | La skill `/code-review` comenta los PR antes de aceptarlos | Encuentra errores antes de publicar |
| 3.2.4 | **Presupuesto de rendimiento** | Lighthouse en CI con mínimos de rendimiento y accesibilidad en celular | Que la app siga rápida en celulares de gama baja |

## 4. Funciones pendientes (cuando se necesiten)

- Sincronizar Salud elemento por elemento (hoy gana el bloque completo más reciente).
- Notificaciones push con la app cerrada (requiere un servidor de push).
