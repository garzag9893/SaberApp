import { test as base, expect } from '@playwright/test';

// Fecha y hora fijas para que cada ejecución vea exactamente lo mismo.
export const TODAY = '2026-11-14'; // sábado
export const NOW = new Date('2026-11-14T10:30:00-06:00');

const key = (offset) => {
  const d = new Date(`${TODAY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const STAMP = '2026-11-14T08:00:00.000Z';

// Datos de ejemplo deterministas (sin Math.random ni la fecha real).
export function demoData() {
  const tasks = [
    { id: 't1', title: 'Revisar presupuesto mensual', date: TODAY, time: '09:00', priority: 'high', completed: true },
    { id: 't2', title: 'Entrenamiento de fuerza', date: TODAY, time: '13:00', endTime: '13:45', priority: 'medium', repeat: 'weekdays' },
    { id: 't3', title: 'Dentista', date: TODAY, time: '13:15', priority: 'high' },
    { id: 't4', title: 'Preparar presentación de proyecto', date: TODAY, time: '16:30', endTime: '18:00', priority: 'high' },
    { id: 't5', title: 'Comprar regalo de cumpleaños', date: TODAY, priority: 'low' },
    { id: 't6', title: 'Pagar tarjeta de crédito', date: key(-2), time: '12:00', priority: 'high' },
    { id: 't7', title: 'Llamada con proveedor', date: key(1), time: '10:30', priority: 'medium' },
    { id: 't8', title: 'Junta de equipo', date: key(2), time: '09:00', endTime: '10:00', priority: 'medium', repeat: 'weekly' },
  ].map((t) => ({ completed: false, endTime: '', repeat: 'none', updatedAt: STAMP, ...t }));

  const months = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const transactions = [];
  months.forEach((m, i) => {
    transactions.push({ id: `in-${m}`, desc: 'Nómina', amount: 15000, type: 'income', category: 'Salario', date: `${m}-01` });
    if (i % 2 === 0) transactions.push({ id: `fr-${m}`, desc: 'Proyecto freelance', amount: 4000 + i * 500, type: 'income', category: 'Freelance', date: `${m}-10` });
    transactions.push({ id: `su-${m}`, desc: 'Supermercado', amount: 3200 + i * 150, type: 'expense', category: 'Alimentación', date: `${m}-04` });
    transactions.push({ id: `ga-${m}`, desc: 'Gasolina', amount: 1100 + (i % 3) * 200, type: 'expense', category: 'Transporte', date: `${m}-06` });
    transactions.push({ id: `ci-${m}`, desc: 'Cine y cena', amount: 650 + (i % 2) * 900, type: 'expense', category: 'Ocio', date: `${m}-08` });
    transactions.push({ id: `rec-netflix-${m}`, desc: 'Netflix', amount: 219, type: 'expense', category: 'Ocio', date: `${m}-05`, recurringId: 'netflix' });
  });
  transactions.push({ id: 'far', desc: 'Farmacia', amount: 480, type: 'expense', category: 'Salud', date: '2026-11-12' });
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const habits = [
    { id: 1, name: '30 min de ejercicio', done: true },
    { id: 2, name: 'Sin azúcar refinada', done: false },
    { id: 3, name: 'Leer 20 páginas', done: true },
    { id: 4, name: 'Meditación 10 min', done: false },
  ];
  const dailyLogs = [];
  for (let i = 1; i <= 60; i += 1) {
    if (i % 11 === 0) continue; // algunos días sin registro
    const done = [1, 2, 3, 4].filter((id) => (i * id) % 3 !== 0 || (i % 5 === 0 && id === 4));
    dailyLogs.push({
      date: key(-i), water: 4 + (i % 5), waterGoal: 8, sleep: 6 + (i % 4) * 0.5, mood: 2 + (i % 4),
      habitsDone: done.length, habitsTotal: 4, habitsDoneIds: done,
    });
  }

  return {
    version: 6,
    tasks,
    transactions: transactions.map((t) => ({ recurringId: null, updatedAt: STAMP, ...t })),
    health: { lastActiveDate: TODAY, water: 3, waterGoal: 8, sleepHours: 7.5, mood: 4, habits, dailyLogs },
    budgets: { 'Alimentación': 6000, Ocio: 1500, Transporte: 1500 },
    settings: {
      expenseCategories: [
        { name: 'Alimentación', color: '#3987e5' },
        { name: 'Transporte', color: '#d95926' },
        { name: 'Salud', color: '#199e70' },
        { name: 'Ocio', color: '#c98500' },
        { name: 'General', color: '#d55181' },
      ],
      incomeCategories: [
        { name: 'Salario', color: '#0ca30c' },
        { name: 'Freelance', color: '#199e70' },
        { name: 'Otros ingresos', color: '#3987e5' },
      ],
      recurringTx: [
        { id: 'netflix', desc: 'Netflix', amount: 219, type: 'expense', category: 'Ocio', day: 5, startMonth: '2026-06', lastPosted: '2026-11' },
      ],
    },
    deleted: { tasks: {}, transactions: {} },
    stamps: { health: STAMP, budgets: STAMP, settings: STAMP },
  };
}

// `theme`: tema guardado en las preferencias ('dark' | 'light').
// `seed`: false para empezar sin datos guardados (p. ej. para probar la migración).
export const test = base.extend({
  theme: ['dark', { option: true }],
  seed: [true, { option: true }],
  page: async ({ page, theme, seed }, use) => {
    await page.clock.setFixedTime(NOW);
    await page.addInitScript(({ data, theme: t, seed: s }) => {
      // Solo en la primera carga de la pestaña: así una recarga conserva lo que la prueba cambió.
      if (sessionStorage.getItem('lifeos-e2e')) return;
      sessionStorage.setItem('lifeos-e2e', '1');
      localStorage.clear();
      localStorage.setItem('lifeos_prefs_v6', JSON.stringify({ theme: t, reminders: { enabled: false, minutesBefore: 10 }, simOffset: 0 }));
      if (s) localStorage.setItem('lifeos_data_v6', JSON.stringify(data));
    }, { data: demoData(), theme, seed });
    await use(page);
  },
});

export { expect };

// Abre la app y espera a que carguen las fuentes (las capturas dependen de ellas).
export async function openApp(page) {
  await page.goto('/');
  await page.getByRole('heading', { name: 'LifeOS' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

export const nav = (page, name) => page.locator('aside nav').getByRole('button', { name });
