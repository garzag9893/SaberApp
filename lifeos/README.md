# LifeOS v5.0

Panel personal para organizar el día: agenda, finanzas, salud y hábitos en una sola app. Los datos se guardan en el navegador (localStorage) y, de forma opcional, se respaldan en Supabase.

## Funciones

- **Agenda avanzada**: pestañas Hoy / Mañana / Todas, selector de calendario, orden cronológico automático (las tareas sin hora van al final), edición en línea y prioridades.
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

1. Copia `.env.example` a `.env.local` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. Crea la tabla:

```sql
create table lifeos_data (
  id text primary key,
  payload jsonb not null
);
```

Limitaciones actuales de la sincronización:

- Solo **sube** datos; no los descarga en otro dispositivo. Sirve como respaldo, no como sincronización entre equipos.
- La clave anónima viaja en el código del navegador. Sin autenticación ni políticas RLS, cualquiera que tenga la clave puede leer y sobrescribir la fila. No la uses con datos sensibles hasta agregar Supabase Auth y RLS por usuario.

## Estructura

```
src/
  App.jsx            interfaz y estado
  lib/dates.js       fechas, normalización de hora y orden cronológico
  lib/quickAdd.js    intérprete de la entrada rápida
  lib/storage.js     datos iniciales, validación y localStorage
```
