import { addDaysToKey } from './dates.js';

// Cierra el día activo: lo archiva en el historial y reinicia agua, sueño, energía y hábitos.
// Guarda qué hábitos se cumplieron para poder calcular rachas.
export const rollDay = (prev, newDateStr) => {
  if (prev.lastActiveDate === newDateStr) return prev;

  const done = prev.habits.filter((h) => h.done);
  const closedDayRecord = {
    date: prev.lastActiveDate,
    water: prev.water,
    waterGoal: prev.waterGoal,
    sleep: prev.sleepHours,
    mood: prev.mood,
    habitsDone: done.length,
    habitsTotal: prev.habits.length,
    habitsDoneIds: done.map((h) => h.id),
  };
  const otherLogs = (prev.dailyLogs || []).filter((log) => log.date !== prev.lastActiveDate);

  return {
    ...prev,
    lastActiveDate: newDateStr,
    water: 0,
    // Sueño y energía se registran de nuevo cada día.
    sleepHours: null,
    mood: null,
    habits: prev.habits.map((h) => ({ ...h, done: false })),
    dailyLogs: [closedDayRecord, ...otherLogs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60),
  };
};

// Días seguidos cumpliendo un hábito: los días archivados consecutivos hasta ayer, más hoy si ya se hizo.
// Si hoy aún no se hace, la racha sigue viva mientras ayer sí se haya cumplido.
export const habitStreak = (habit, health) => {
  const logsByDate = new Map((health.dailyLogs || []).map((log) => [log.date, log]));
  let streak = habit.done ? 1 : 0;
  let day = addDaysToKey(health.lastActiveDate, -1);
  for (;;) {
    const log = logsByDate.get(day);
    if (!log || !Array.isArray(log.habitsDoneIds) || !log.habitsDoneIds.includes(habit.id)) break;
    streak += 1;
    day = addDaysToKey(day, -1);
  }
  return streak;
};

export const nextHabitId = (habits) => habits.reduce((max, h) => (typeof h.id === 'number' && h.id > max ? h.id : max), 0) + 1;

// Nivel de un día en el calendario de constancia:
// null = sin registro · 0 = ningún hábito · 1–3 = parcial (por tercios) · 4 = todos.
export const habitLevel = (done, total) => {
  if (!(total > 0)) return null;
  const ratio = done / total;
  if (ratio === 0) return 0;
  if (ratio >= 1) return 4;
  if (ratio < 1 / 3) return 1;
  if (ratio < 2 / 3) return 2;
  return 3;
};

// Calendario de las últimas `weeks` semanas (lunes a domingo) que termina en la semana de hoy.
// Devuelve columnas (semanas) de 7 días: { date, done, total, level, isToday, future }.
export const habitCalendar = (health, weeks = 12) => {
  const today = health.lastActiveDate;
  const weekday = (new Date(`${today}T12:00:00`).getDay() + 6) % 7; // 0 = lunes
  const start = addDaysToKey(today, -weekday - (weeks - 1) * 7);
  const logs = new Map((health.dailyLogs || []).map((l) => [l.date, l]));
  const todayDone = health.habits.filter((h) => h.done).length;

  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = addDaysToKey(start, w * 7 + d);
    if (date > today) return { date, done: 0, total: 0, level: null, isToday: false, future: true };
    const isToday = date === today;
    const log = logs.get(date);
    const done = isToday ? todayDone : log?.habitsDone ?? 0;
    const total = isToday ? health.habits.length : log?.habitsTotal ?? 0;
    return { date, done, total, level: isToday || log ? habitLevel(done, total) : null, isToday, future: false };
  }));
};
