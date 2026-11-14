import { getTodayKey, isTime } from './dates.js';
import { sanitizeBudgets } from './finance.js';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './categories.js';
import { REPEAT_IDS } from './recurrence.js';
import { plain } from './text.js';

export const DATA_KEY = 'lifeos_data_v6';
export const PREFS_KEY = 'lifeos_prefs_v6';

// Claves de la versión 5 (se leen una vez para migrar los datos).
const LEGACY_KEYS = {
  tasks: 'lifeos_tasks_v5',
  transactions: 'lifeos_finances_v5',
  health: 'lifeos_health_v5',
  budgets: 'lifeos_budgets_v5',
  updatedAt: 'lifeos_updated_v5',
};

// --- Datos iniciales ---
export const defaultTasks = () => [
  { id: 1, title: 'Revisar presupuesto mensual', date: getTodayKey(), time: '09:00', priority: 'high', completed: true },
  { id: 2, title: 'Entrenamiento de fuerza', date: getTodayKey(), time: '13:00', endTime: '13:45', priority: 'medium', completed: false, repeat: 'weekdays' },
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

export const defaultSettings = () => ({
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c })),
  incomeCategories: DEFAULT_INCOME_CATEGORIES.map((c) => ({ ...c })),
  recurringTx: [],
});

export const defaultPrefs = () => ({
  theme: 'dark',
  reminders: { enabled: false, minutesBefore: 10 },
  simOffset: 0,
});

// --- Validación: datos corruptos, respaldos ajenos o versiones anteriores no deben tumbar la app ---
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDateKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isMonth = (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);
const str = (v) => (typeof v === 'string' ? v : '');

export const sanitizeTasks = (value, stamp = '') => {
  if (!Array.isArray(value)) return null;
  return value
    .filter((t) => isObj(t) && typeof t.title === 'string')
    .map((t, i) => ({
      id: t.id ?? `imp-${i}`,
      title: t.title,
      date: isDateKey(t.date) ? t.date : '',
      time: isTime(t.time) ? t.time : '',
      endTime: isTime(t.endTime) ? t.endTime : '',
      priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      completed: Boolean(t.completed),
      repeat: REPEAT_IDS.includes(t.repeat) ? t.repeat : 'none',
      repeatAnchor: Number.isInteger(t.repeatAnchor) && t.repeatAnchor >= 1 && t.repeatAnchor <= 31 ? t.repeatAnchor : null,
      spawnedId: t.spawnedId ?? null,
      updatedAt: str(t.updatedAt) || stamp,
    }));
};

export const sanitizeTransactions = (value, stamp = '') => {
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
      recurringId: t.recurringId ?? null,
      updatedAt: str(t.updatedAt) || stamp,
    }));
};

// null = aún no registrado hoy; undefined = valor inválido.
const nullableNumber = (v, min, max) => {
  if (v === null) return null;
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};

export const sanitizeHealth = (value) => {
  if (!isObj(value)) return null;
  const base = defaultHealth();
  const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  const sleep = nullableNumber(value.sleepHours, 0, 24);
  const mood = nullableNumber(value.mood, 1, 5);
  return {
    lastActiveDate: isDateKey(value.lastActiveDate) ? value.lastActiveDate : base.lastActiveDate,
    water: Math.max(0, num(value.water, 0)),
    waterGoal: Math.min(15, Math.max(1, num(value.waterGoal, base.waterGoal))),
    sleepHours: sleep === undefined ? base.sleepHours : sleep,
    mood: mood === undefined ? base.mood : mood,
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

const sanitizeCategoryList = (value, fallback) => {
  if (!Array.isArray(value)) return fallback();
  const seen = new Set();
  const list = [];
  for (const c of value) {
    if (!isObj(c) || typeof c.name !== 'string' || !c.name.trim()) continue;
    const key = plain(c.name.trim());
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ name: c.name.trim(), color: isColor(c.color) ? c.color : '#64748b' });
  }
  return list.length ? list : fallback();
};

const sanitizeRules = (value) => (Array.isArray(value) ? value : [])
  .filter((r) => isObj(r) && typeof r.desc === 'string' && Number(r.amount) > 0)
  .map((r, i) => ({
    id: String(r.id ?? `r${i}`),
    desc: r.desc,
    amount: Number(r.amount),
    type: r.type === 'income' ? 'income' : 'expense',
    category: String(r.category ?? 'General'),
    day: Math.min(31, Math.max(1, Math.trunc(Number(r.day)) || 1)),
    startMonth: isMonth(r.startMonth) ? r.startMonth : getTodayKey().slice(0, 7),
    lastPosted: isMonth(r.lastPosted) ? r.lastPosted : null,
  }));

export const sanitizeSettings = (value) => {
  if (!isObj(value)) return null;
  return {
    expenseCategories: sanitizeCategoryList(value.expenseCategories, () => defaultSettings().expenseCategories),
    incomeCategories: sanitizeCategoryList(value.incomeCategories, () => defaultSettings().incomeCategories),
    recurringTx: sanitizeRules(value.recurringTx),
  };
};

const sanitizeTombstones = (value) => (isObj(value)
  ? Object.fromEntries(Object.entries(value).filter(([, ts]) => typeof ts === 'string'))
  : {});

// Construye un objeto de datos completo. Lo que falte se toma de `base`.
// `stamp` se usa como fecha de edición para datos de versiones que no la guardaban.
export function sanitizeData(raw, base = null, stamp = '') {
  const src = isObj(raw) ? raw : {};
  const fallback = base || {
    tasks: [], transactions: [], health: defaultHealth(), budgets: {}, settings: defaultSettings(),
    stamps: { health: '', budgets: '', settings: '' },
  };
  const stamps = isObj(src.stamps) ? src.stamps : {};
  const stampFor = (key) => str(stamps[key]) || (src[key] !== undefined ? stamp : fallback.stamps?.[key] || '');
  return {
    version: 6,
    tasks: sanitizeTasks(src.tasks, stamp) ?? fallback.tasks,
    transactions: sanitizeTransactions(src.transactions, stamp) ?? fallback.transactions,
    health: sanitizeHealth(src.health) ?? fallback.health,
    budgets: sanitizeBudgets(src.budgets) ?? fallback.budgets,
    settings: sanitizeSettings(src.settings) ?? fallback.settings,
    deleted: {
      tasks: sanitizeTombstones(src.deleted?.tasks),
      transactions: sanitizeTombstones(src.deleted?.transactions),
    },
    stamps: { health: stampFor('health'), budgets: stampFor('budgets'), settings: stampFor('settings') },
  };
}

export const defaultData = () => sanitizeData({
  tasks: defaultTasks(),
  transactions: defaultTransactions(),
  health: defaultHealth(),
  budgets: {},
  settings: defaultSettings(),
});

// Datos que llegan de la nube. Las copias de la versión 5 no tenían fecha de edición por
// elemento: se usa la fecha general de esa copia.
export const normalizeRemote = (payload) => {
  if (!isObj(payload)) return null;
  return sanitizeData(payload, null, payload.version >= 6 ? '' : str(payload.updatedAt));
};

// --- localStorage ---
const readJSON = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const loadData = () => {
  const current = readJSON(DATA_KEY);
  if (isObj(current)) return sanitizeData(current, defaultData());

  // Migración desde la versión 5.
  const legacy = {
    tasks: readJSON(LEGACY_KEYS.tasks),
    transactions: readJSON(LEGACY_KEYS.transactions),
    health: readJSON(LEGACY_KEYS.health),
    budgets: readJSON(LEGACY_KEYS.budgets),
  };
  if (Object.values(legacy).some((v) => v !== null)) {
    let stamp = '';
    try { stamp = localStorage.getItem(LEGACY_KEYS.updatedAt) || ''; } catch { /* sin almacenamiento */ }
    const raw = Object.fromEntries(Object.entries(legacy).filter(([, v]) => v !== null));
    return sanitizeData(raw, defaultData(), stamp);
  }
  return defaultData();
};

export const saveData = (data) => writeJSON(DATA_KEY, data);

export const loadPrefs = () => {
  const base = defaultPrefs();
  const saved = readJSON(PREFS_KEY);
  if (!isObj(saved)) return base;
  return {
    theme: ['dark', 'light', 'system'].includes(saved.theme) ? saved.theme : base.theme,
    reminders: {
      enabled: Boolean(saved.reminders?.enabled),
      minutesBefore: [0, 5, 10, 15, 30, 60].includes(saved.reminders?.minutesBefore) ? saved.reminders.minutesBefore : 10,
    },
    simOffset: Math.max(0, Math.trunc(Number(saved.simOffset)) || 0),
  };
};

export const savePrefs = (prefs) => writeJSON(PREFS_KEY, prefs);
