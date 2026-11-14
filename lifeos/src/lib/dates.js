// Utilidades de fecha y hora. Las fechas se manejan como claves locales 'YYYY-MM-DD'.

const toKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const fromKey = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const getTodayKey = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toKey(d);
};

export const addDaysToKey = (dateStr, days) => {
  const date = fromKey(dateStr);
  date.setDate(date.getDate() + days);
  return toKey(date);
};

export const getShortDayName = (dateStr) =>
  ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][fromKey(dateStr).getDay()];

export const formatReadableDate = (dateStr) => {
  if (!dateStr) return '';
  const text = fromKey(dateStr).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Normaliza "4pm", "4:30 pm", "9:00" a "16:00", "16:30", "09:00".
// Devuelve '' si no es una hora válida, para que la tarea quede "Sin hora".
export const normalizeTime = (rawTime) => {
  if (!rawTime || rawTime === 'Sin hora') return '';
  const match = rawTime.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return '';
  let hours = parseInt(match[1], 10);
  const minutes = match[2] || '00';
  const period = match[3]?.toLowerCase();

  if (period && (hours < 1 || hours > 12)) return '';
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  if (hours > 23 || parseInt(minutes, 10) > 59) return '';

  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

// Orden cronológico: primero fecha, luego hora (las tareas sin hora van al final).
export const sortTasksChronologically = (taskList, fallbackDate) =>
  [...taskList].sort((a, b) => {
    const dateA = a.date || fallbackDate;
    const dateB = b.date || fallbackDate;
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.time && a.time !== 'Sin hora' ? a.time : '99:99';
    const timeB = b.time && b.time !== 'Sin hora' ? b.time : '99:99';
    return timeA.localeCompare(timeB);
  });

// Días de diferencia entre dos claves 'YYYY-MM-DD' (positivo si `to` es posterior).
export const dayDiff = (from, to) => {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
};

export const isValidDateParts = (y, m, d) => {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export const makeKey = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const weekdayOf = (dateStr) => fromKey(dateStr).getDay();

// Lunes de la semana que contiene la fecha.
export const startOfWeek = (dateStr) => addDaysToKey(dateStr, -((weekdayOf(dateStr) + 6) % 7));

export const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export const timeToMinutes = (value) => {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
};

export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
