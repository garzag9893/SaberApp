# LifeOS v5.0

Panel personal para organizar el día: agenda, finanzas, salud y hábitos en una sola app. Los datos se guardan en el navegador (localStorage) y, de forma opcional, se respaldan en Supabase.

## Funciones

- **Agenda avanzada**
  - Pestañas Hoy / Mañana / Semana / Todas y selector de calendario.
  - Orden cronológico automático; las tareas sin hora van al final.
  - Hora de inicio y de fin, con aviso cuando dos tareas chocan.
  - Tareas que se repiten: diaria, lunes a viernes, semanal o mensual. Al completarla se crea la siguiente.
  - Las tareas pendientes de días anteriores siguen en "Hoy" marcadas como atrasadas.
  - Vista semanal tipo calendario y buscador en todas las tareas.
- **Entrada rápida**: una sola barra que entiende tareas, gastos y agua.
  - `Dentista mañana 16:00`, `Junta 4:30 pm`, `Entrega pasado mañana 9:00`
  - `Junta el viernes 10:00`, `Revisar contrato en 3 días`, `Posada 15 de diciembre 8pm`, `Pagar tarjeta 15/02`
  - `Gym cada lunes 7am`, `Vitaminas todos los días 8:00`, `Revisar correo entre semana`, `Pagar renta el día 15 de cada mes`
  - `Comida $180`, `Ingreso freelance $3,000`, `Croquetas mascotas $450` (usa tus propias categorías)
  - `Tomar agua`, `2 vasos de agua`
- **Finanzas**
  - Vista por mes o de todo el historial, con buscador.
  - Edición de movimientos y categorías de ingreso.
  - Presupuestos mensuales por categoría, con avisos al 80 % y al excederse.
  - Gastos e ingresos fijos (renta, suscripciones, sueldo) que se registran solos cada mes.
  - Exportación a CSV compatible con Excel.
- **Salud y hábitos**
  - Hábitos editables con rachas de días seguidos.
  - Meta de agua ajustable.
  - Sueño y energía se registran de nuevo cada día; el historial guarda cada día cerrado.
- **Ajustes**
  - Tema oscuro, claro o según el dispositivo.
  - Recordatorios antes de cada tarea.
  - Categorías de gastos e ingresos editables: nombre y color. Al renombrar o eliminar se actualizan movimientos, presupuestos y gastos fijos.
- **Deshacer**: al borrar una tarea, un movimiento o un hábito aparece un botón para recuperarlo.
- **Instalable**: se puede instalar como app en el celular o la computadora y abrir sin conexión.
- **Respaldo**: exportar e importar todos los datos en JSON.

Los datos de la versión 5 se migran automáticamente la primera vez que se abre esta versión.

## Diseño

La identidad visual, los colores, la tipografía y las reglas de las gráficas están en [DESIGN.md](DESIGN.md), junto con una guía de cómo usar las herramientas de diseño (Figma, Canva, skills de diseño y visualización) en el proyecto.

## Uso

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas de la lógica (entrada rápida, fechas, finanzas, hábitos, repetición, sincronización…)
npm run build    # versión de producción en dist/
```

## Sincronización con Supabase (opcional)

Sin configurar nada, la app guarda todo en el navegador. Para respaldar y sincronizar entre dispositivos:

1. Copia `.env.example` a `.env.local` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. En el editor SQL de Supabase, crea la tabla con seguridad por usuario:

```sql
create table lifeos_data (
  id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null
);

alter table lifeos_data enable row level security;

create policy "Cada usuario solo ve y modifica su fila"
  on lifeos_data for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

3. Abre la app, pulsa **Entrar** junto al logo y crea tu cuenta con correo y contraseña.

Cómo funciona:

- Cada persona inicia sesión y solo puede leer y escribir su propia fila. La clave anónima por sí sola no da acceso a los datos de nadie.
- Al entrar, al volver a la pestaña, al recuperar la conexión y después de cada cambio, la app descarga lo de la nube, lo **combina** con lo local y sube el resultado.
- Tareas y movimientos se combinan uno por uno: si en el celular agregas una tarea y en la computadora otra, se conservan las dos. Si el mismo elemento se editó en dos lugares, gana la edición más reciente. Lo que borras en un dispositivo se borra también en los demás.
- Salud, presupuestos y ajustes se guardan como un bloque: gana el bloque editado más recientemente.

## Estructura

```
.github/workflows/   pruebas automáticas (ci.yml) y publicación en GitHub Pages (pages.yml)
public/              manifiesto, iconos y service worker (app instalable)
src/
  App.jsx            une las piezas: estado global, cambio de día, entrada rápida y respaldos
  components/        barra lateral, entrada rápida, avisos y estilos compartidos
  views/             una vista por sección: Resumen, Finanzas, Salud, Agenda y Ajustes
  hooks/             datos (useLifeData), nube, recordatorios, tema e instalación
  lib/               lógica sin interfaz, con pruebas: fechas, entrada rápida, agenda, repetición,
                     finanzas, categorías, gastos fijos, hábitos, almacenamiento y fusión de datos
```

## Instalar como app

La versión de producción (`npm run build`, servida por HTTPS) se puede instalar:

- **Android / Chrome**: botón "Instalar como app" en la barra lateral o el menú del navegador.
- **iPhone / Safari**: Compartir → "Agregar a pantalla de inicio".

Una vez abierta por primera vez, funciona sin conexión; los cambios se sincronizan con la nube al recuperar la red.

## Recordatorios

Se activan en **Ajustes → Recordatorios**. Avisan antes de cada tarea con hora del día, dentro de la app y con notificación del sistema si el navegador lo permite.

Funcionan mientras LifeOS está abierta, también instalada como app y en segundo plano. Con la app cerrada por completo el navegador no puede avisar; para eso haría falta un servidor de notificaciones push.

## Publicar en GitHub Pages

El repositorio incluye `.github/workflows/pages.yml`. GitHub solo lo ejecuta cuando la carpeta `.github` está en la raíz del repositorio, es decir, cuando LifeOS vive en su propio repositorio.

1. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
2. Opcional, para la nube: en **Settings → Secrets and variables → Actions** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Cada cambio en `main` corre las pruebas y publica la app en `https://<usuario>.github.io/<repositorio>/`.
