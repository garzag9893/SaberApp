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
