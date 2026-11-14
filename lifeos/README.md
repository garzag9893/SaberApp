# LifeOS v5.0

Panel personal para organizar el día: agenda, finanzas, salud y hábitos en una sola app. Los datos se guardan en el navegador (localStorage) y, de forma opcional, se respaldan en Supabase.

## Funciones

- **Agenda avanzada**: pestañas Hoy / Mañana / Todas, selector de calendario, orden cronológico automático (las tareas sin hora van al final), edición en línea y prioridades. Las tareas pendientes de días anteriores siguen en "Hoy" marcadas como atrasadas.
- **Entrada rápida**: una sola barra que entiende tareas, gastos y agua.
  - `Dentista mañana 16:00` → tarea para mañana a las 16:00
  - `Junta 4:30 pm`, `Entrega pasado mañana 9:00`
  - `Comida $180`, `Ingreso freelance $3,000`
  - `Tomar agua`, `2 vasos de agua`
- **Finanzas**: ingresos, gastos, distribución por categoría y exportación a CSV compatible con Excel.
- **Salud y hábitos**: agua, sueño, energía y hábitos, con archivo automático al cambiar de día.
- **Respaldo**: exportar e importar todos los datos en JSON.

## Uso

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # pruebas del intérprete de entrada rápida y de fechas
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
- Al entrar, al volver a la pestaña y al recuperar la conexión, la app descarga los datos de la nube si son más recientes que los locales; cada cambio local se sube un segundo después.
- Si dos dispositivos editan a la vez, gana el cambio más reciente completo (no se mezclan cambios tarea por tarea).

## Estructura

```
src/
  App.jsx            interfaz y estado
  lib/dates.js       fechas, normalización de hora y orden cronológico
  lib/quickAdd.js    intérprete de la entrada rápida
  lib/storage.js     datos iniciales, validación y localStorage
  lib/cloud.js       inicio de sesión y sincronización con Supabase
```
