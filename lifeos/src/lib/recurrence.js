import { addDaysToKey, weekdayOf, makeKey, daysInMonth } from './dates.js';

export const REPEAT_OPTIONS = [
  { id: 'none', label: 'No se repite' },
  { id: 'daily', label: 'Diaria' },
  { id: 'weekdays', label: 'Lunes a viernes' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
];
export const REPEAT_IDS = REPEAT_OPTIONS.map((o) => o.id);
export const REPEAT_LABEL = Object.fromEntries(REPEAT_OPTIONS.map((o) => [o.id, o.label]));

const dayOfMonth = (key) => Number(key.slice(8, 10));

const addMonthsAnchored = (key, months, anchor) => {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeKey(ny, nm, Math.min(anchor, daysInMonth(ny, nm)));
};

const step = (key, repeat, anchor) => {
  switch (repeat) {
    case 'daily': return addDaysToKey(key, 1);
    case 'weekly': return addDaysToKey(key, 7);
    case 'monthly': return addMonthsAnchored(key, 1, anchor);
    case 'weekdays': {
      let next = addDaysToKey(key, 1);
      while (weekdayOf(next) === 0 || weekdayOf(next) === 6) next = addDaysToKey(next, 1);
      return next;
    }
    default: return null;
  }
};

// Próxima fecha de una tarea que se repite: posterior a su fecha y nunca antes de hoy.
export const nextOccurrence = (task, todayKey) => {
  if (!task.repeat || task.repeat === 'none') return null;
  const base = task.date || todayKey;
  const anchor = task.repeatAnchor || dayOfMonth(base);
  let next = step(base, task.repeat, anchor);
  for (let guard = 0; next < todayKey && guard < 2000; guard += 1) next = step(next, task.repeat, anchor);
  return next;
};

// Marca o desmarca una tarea. Al completar una tarea que se repite se crea la siguiente;
// al desmarcarla se quita esa siguiente si nadie la ha tocado.
// Devuelve { tasks, removedIds }.
export const toggleTask = (tasks, id, todayKey, { newId, now }) => {
  const task = tasks.find((t) => t.id === id);
  if (!task) return { tasks, removedIds: [] };

  if (!task.completed) {
    let list = tasks.map((t) => (t.id === id ? { ...t, completed: true, updatedAt: now } : t));
    if (task.repeat && task.repeat !== 'none' && !task.spawnedId) {
      const next = {
        id: newId(),
        title: task.title,
        date: nextOccurrence(task, todayKey),
        time: task.time,
        endTime: task.endTime,
        priority: task.priority,
        completed: false,
        repeat: task.repeat,
        repeatAnchor: task.repeatAnchor || dayOfMonth(task.date || todayKey),
        spawnedId: null,
        updatedAt: now,
      };
      list = [next, ...list.map((t) => (t.id === id ? { ...t, spawnedId: next.id } : t))];
    }
    return { tasks: list, removedIds: [] };
  }

  let list = tasks.map((t) => (t.id === id ? { ...t, completed: false, spawnedId: null, updatedAt: now } : t));
  const removedIds = [];
  if (task.spawnedId) {
    const spawned = list.find((t) => t.id === task.spawnedId);
    if (spawned && !spawned.completed && spawned.updatedAt === task.updatedAt) {
      list = list.filter((t) => t.id !== spawned.id);
      removedIds.push(spawned.id);
    }
  }
  return { tasks: list, removedIds };
};
