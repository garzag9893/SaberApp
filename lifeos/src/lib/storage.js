import { getTodayKey } from './dates.js';

export const STORAGE_KEYS = {
  tasks: 'lifeos_tasks_v5',
  transactions: 'lifeos_finances_v5',
  health: 'lifeos_health_v5',
  updatedAt: 'lifeos_updated_v5',
};

export const defaultTasks = () => [
  { id: 1, title: 'Revisar presupuesto mensual', date: getTodayKey(), time: '09:00', priority: 'high', completed: true },
  { id: 2, title: 'Entrenamiento de fuerza 45 min', date: getTodayKey(), time: '13:00', priority: 'medium', completed: false },
  { id: 3, title: 'Preparar presentación de proyecto', date: getTodayKey(), time: '16:30', priority: 'high', completed: false },
  { id: 4, title: 'Llamada con proveedor', date: getTodayKey(1), time: '10:30', priority: 'medium', completed: false },
];

export const defaultTransactions = () => [
  { id: 1, desc: 'Nómina Quincenal', amount: 15000, type: 'income', category: 'Salario', date: getTodayKey() },
  { id: 2, desc: 'Supermercado semanal', amount: 1850, type: 'expense', category: 'Alimentación', date: getTodayKey() },
  { id: 3, desc: 'Suscripción Gimnasio', amount: 650, type: 'expense', category: 'Salud', date: getTodayKey(-1) },
  { id: 4, desc: 'Gasolina y Transporte', amount: 900, type: 'expense', category: 'Transporte', date: getTodayKey(-1) },
];

export const defaultHealth = () => ({
  lastActiveDate: getTodayKey(),
  simOffset: 0,
  water: 3,
  waterGoal: 8,
  sleepHours: 7.5,
  mood: 4,
  habits: [
    { id: 1, name: '30 min de ejercicio', done: false },
    { id: 2, name: 'Sin azúcar refinada', done: false },
    { id: 3, name: 'Leer 20 páginas', done: false },
    { id: 4, name: 'Meditación 10 min', done: false },
  ],
  dailyLogs: [
    { date: getTodayKey(-3), water: 7, waterGoal: 8, sleep: 6.5, mood: 3, habitsDone: 2, habitsTotal: 4 },
    { date: getTodayKey(-2), water: 8, waterGoal: 8, sleep: 8.0, mood: 5, habitsDone: 4, habitsTotal: 4 },
    { date: getTodayKey(-1), water: 6, waterGoal: 8, sleep: 7.0, mood: 4, habitsDone: 3, habitsTotal: 4 },
  ],
});

// --- Validación: datos corruptos o respaldos ajenos no deben tumbar la app ---
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDateKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const sanitizeTasks = (value) => {
  if (!Array.isArray(value)) return null;
  return value
    .filter((t) => isObj(t) && typeof t.title === 'string')
    .map((t, i) => ({
      id: t.id ?? `imp-${i}`,
      title: t.title,
      date: isDateKey(t.date) ? t.date : '',
      time: typeof t.time === 'string' && t.time !== 'Sin hora' ? t.time : '',
      priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      completed: Boolean(t.completed),
    }));
};

export const sanitizeTransactions = (value) => {
  if (!Array.isArray(value)) return null;
  return value
    .filter((t) => isObj(t) && Number.isFinite(Number(t.amount)))
    .map((t, i) => ({
      id: t.id ?? `imp-${i}`,
      desc: String(t.desc ?? 'Movimiento'),
      amount: Math.abs(Number(t.amount)),
      type: t.type === 'income' ? 'income' : 'expense',
      category: String(t.category ?? 'General'),
      date: isDateKey(t.date) ? t.date : getTodayKey(),
    }));
};

export const sanitizeHealth = (value) => {
  if (!isObj(value)) return null;
  const base = defaultHealth();
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    lastActiveDate: isDateKey(value.lastActiveDate) ? value.lastActiveDate : base.lastActiveDate,
    simOffset: Math.max(0, Math.trunc(num(value.simOffset, 0))),
    water: Math.max(0, num(value.water, 0)),
    waterGoal: Math.max(1, num(value.waterGoal, base.waterGoal)),
    sleepHours: num(value.sleepHours, base.sleepHours),
    mood: Math.min(5, Math.max(1, num(value.mood, base.mood))),
    habits: Array.isArray(value.habits)
      ? value.habits
          .filter((h) => isObj(h) && typeof h.name === 'string')
          .map((h, i) => ({ id: h.id ?? i + 1, name: h.name, done: Boolean(h.done) }))
      : base.habits,
    dailyLogs: Array.isArray(value.dailyLogs)
      ? value.dailyLogs.filter((l) => isObj(l) && isDateKey(l.date))
      : [],
  };
};

export const loadStored = (key, sanitize, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const clean = sanitize(JSON.parse(raw));
      if (clean) return clean;
    }
  } catch {
    // JSON corrupto o localStorage no disponible: se usan los datos iniciales.
  }
  return fallback();
};

export const saveStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
