# Plan de trabajo

Lista ordenada de las actualizaciones pendientes. El orden sigue tres reglas:

1. **Primero lo que desbloquea lo demás**: accesos, repositorios y publicación.
2. **Auditar → proponer → implementar → verificar**: ninguna etapa de implementación empieza sin que la anterior esté aprobada y probada.
3. **Una pantalla a la vez**: cada etapa se valida en escritorio y celular antes de pasar a la siguiente.

Tamaño estimado: **S** = una sesión corta · **M** = una sesión · **L** = varias sesiones.

---

## 0. Requisitos (dependen de ti)

| # | Tarea | Desbloquea | Estado |
|---|---|---|---|
| 0.1 | Dar acceso al **repositorio del Portal Dental**: decirme su nombre (`usuario/repositorio`) y, si es privado, instalar la app de Claude en él desde github.com/apps/claude | Todo el bloque 2 | ⏳ Pendiente |
| 0.2 | Crear el repositorio vacío **`lifeos`** en github.com/new | Bloque 1 | ⏳ Pendiente |
| 0.3 | Datos de la clínica para la página pública: nombre, logo, colores actuales, servicios, equipo, horarios, dirección, fotos y testimonios reales | Etapa 2.5 | ⏳ Pendiente |
| 0.4 | (Opcional) Proyecto de Supabase para la nube de LifeOS | Sincronización real de LifeOS | ⏳ Pendiente |

---

## 1. LifeOS — cerrar la versión actual (S)

Es corto y deja la app usable en el celular antes de empezar el proyecto grande.

| # | Tarea | Tamaño |
|---|---|---|
| 1.1 | Mover `lifeos/` a su propio repositorio, con historial | S |
| 1.2 | Activar las pruebas automáticas (CI) y GitHub Pages; verificar que la app publicada se instale en el celular | S |

---

## 2. Portal Dental — evolución visual (L)

Objetivo: llevar el portal a nivel de software SaaS profesional **sin reconstruirlo**. No se cambia el framework, la base de datos, la autenticación, los permisos ni las reglas de negocio. **La estética nunca reemplaza una validación del servidor**, y no se simulan guardados ni confirmaciones.

### Puntos de aprobación

Hay tres momentos en que el trabajo se detiene hasta tu visto bueno:

- **A — después de la auditoría (2.1):** confirmas el diagnóstico.
- **B — después de la propuesta (2.2):** apruebas la dirección visual y la lista de archivos que se van a modificar.
- **C — después de cada pantalla (2.5 a 2.10):** revisas capturas de escritorio y celular antes de seguir.

### Etapas

| # | Etapa | Fases del brief | Entregable | Tamaño |
|---|---|---|---|---|
| 2.1 | **Auditoría** (sin modificar archivos) | 1 | Diagnóstico: estructura, framework y dependencias, rutas, componentes, autenticación y permisos, paneles por rol, base de datos y relaciones, flujo de citas, disponibilidad, pagos, servicios y pacientes, estilos actuales, conflictos, duplicados y problemas de rendimiento | M |
| | ⛔ **Punto A** | | | |
| 2.2 | **Propuesta visual** | 2, 3 | Tokens propuestos, mapa de dónde va cada estilo (ver tabla abajo), capturas de prueba de 2–3 pantallas clave y **lista de archivos que se modificarán** | M |
| | ⛔ **Punto B** | | | |
| 2.3 | **Design System** | 2 | Variables centralizadas: colores de la clínica, estados (éxito, advertencia, error, información), estados de cita (pendiente, confirmada, completada, cancelada, no asistió), tipografía, espaciado, radios, sombras, niveles de elevación y vidrio con alternativa sin `backdrop-filter` | M |
| 2.4 | **Componentes globales y movimiento** | 4, 6 | Button, IconButton, GlassCard, StatCard, Modal, Drawer, Dropdown, Tooltip, Toast, Badge, Calendar, DatePicker, SearchBar, Input, Select, Tabs, Sidebar, Navbar, EmptyState, LoadingState y ConfirmationDialog, con estados normal, hover, focus, active, disabled, loading y error. Transiciones y microinteracciones, respetando "reducir movimiento" | L |
| 2.5 | **Página principal** | 3.4, 5.1 | Página pública premium: encabezado, servicios, equipo, beneficios, horarios, ubicación, galería, testimonios reales, preguntas frecuentes, botón de reservar y pie de página | M |
| | ⛔ **Punto C** | | | |
| 2.6 | **Reservar cita** | 5.2 | Flujo servicio → profesional → calendario → horario → datos → confirmación, **con la misma disponibilidad real que recepción** | M |
| | ⛔ **Punto C** | | | |
| 2.7 | **Mi cita (paciente)** | 5.3 | Próxima cita, estado, historial, instrucciones y las acciones permitidas (cancelar o reprogramar) | S–M |
| | ⛔ **Punto C** | | | |
| 2.8 | **Recepción** | 5.4 | Agenda del día con estados visibles al instante, búsqueda de pacientes, registro rápido y detalle en panel lateral | M |
| | ⛔ **Punto C** | | | |
| 2.9 | **Panel del dentista** | 5.5 | Agenda personal, próximos pacientes y solo el historial clínico autorizado. **Revisión de permisos obligatoria** | M |
| | ⛔ **Punto C** | | | |
| 2.10 | **Administración** | 5.6 | Indicadores, servicios, profesionales, horarios, usuarios y permisos, reportes y configuración | M |
| | ⛔ **Punto C** | | | |
| 2.11 | **Responsive** | 7 | Navegación y calendarios propios para celular y tableta (no solo versiones reducidas), con botones táctiles de al menos 44 px | M |
| 2.12 | **Pruebas finales** | 8, 9 | Contraste, teclado, lector de pantalla, rendimiento en celular, navegadores, y regresión de citas, pagos, permisos y datos | M |

**Después de cada etapa se verifica:** que no haya errores, la navegación, los formularios, los permisos por rol, que las citas sigan funcionando, escritorio y celular, y que no haya regresiones.

### Dónde va cada lenguaje visual

Cada estilo tiene un solo trabajo. Nunca se mezclan todos en la misma pantalla.

| Lenguaje | Función | Se aplica en | No se aplica en |
|---|---|---|---|
| **Minimalismo** | Base de todo el portal: claridad y jerarquía | Todas las pantallas | — |
| **Spatial UI** | Profundidad: elevación por capas, paneles flotantes | Modales, paneles laterales, menús contextuales, detalle de cita | Contenido de lectura largo |
| **Liquid Glass** | Superficies flotantes translúcidas | Barra de navegación, menús, notificaciones, selectores de fecha, ventanas emergentes | Formularios médicos, tablas y texto principal (deben ir sobre superficie sólida) |
| **Brutalismo** | Cifras y encabezados contundentes | Estadísticas, resúmenes de actividad y encabezados especiales de administración y recepción | Formularios, agenda y calendario |
| **Maximalismo** | Identidad y confianza | Solo la página pública | Paneles administrativos |
| **Claymorphism** | Calidez en detalles | Estados vacíos, bienvenida, ilustraciones e iconos destacados | Botones y tarjetas en general |

### Riesgos a vigilar

- **Legibilidad del vidrio**: cada superficie translúcida se mide con prueba de contraste y tiene un fondo sólido de respaldo.
- **Rendimiento**: `backdrop-filter` y las sombras grandes son costosos en celulares de gama baja; se limitan a elementos flotantes. Sin WebGL ni Three.js.
- **Datos clínicos**: los componentes compartidos (Tooltip, Drawer, Toast) no reciben información sensible por defecto; la vista del dentista se prueba con usuarios de cada rol.
- **Disponibilidad de citas**: el calendario solo muestra lo que devuelve el servidor; nunca se calcula disponibilidad "de adorno" en el navegador.

---

## 3. LifeOS — mejoras de diseño (M, después del bloque 2 o entre etapas)

Basado en `lifeos/DESIGN.md`. Puede avanzar mientras esperas a revisar etapas del portal.

| # | Tarea | Herramienta | Tamaño |
|---|---|---|---|
| 3.1 | ✅ Tendencia de ingresos y gastos por mes y calendario de constancia de hábitos | Skill dataviz | M |
| 3.2 | Pantalla de bienvenida para usuarios nuevos | Figma + frontend-design | M |
| 3.3 | Ilustraciones para bienvenida y estados vacíos | Higgsfield | S |
| 3.4 | Kit de marca y capturas para compartir | Canva | S |
| 3.5 | Pruebas de regresión visual automáticas | Playwright en CI | S |

## 4. LifeOS — funciones pendientes (cuando se necesiten)

- Sincronizar Salud elemento por elemento (hoy gana el bloque completo más reciente).
- Notificaciones push con la app cerrada (requiere un servidor de push).
