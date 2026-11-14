import { describe, it, expect } from 'vitest';
import { rollDay, habitStreak, nextHabitId } from './habits.js';

const base = {
  lastActiveDate: '2026-11-14',
  water: 5, waterGoal: 8, sleepHours: 7, mood: 4,
  habits: [{ id: 1, name: 'Leer', done: true }, { id: 2, name: 'Correr', done: false }],
  dailyLogs: [
    { date: '2026-11-13', habitsDoneIds: [1, 2] },
    { date: '2026-11-12', habitsDoneIds: [1] },
    { date: '2026-11-11', habitsDoneIds: [2] },
  ],
};

describe('hábitos', () => {
  it('racha incluye hoy y los días seguidos anteriores', () => {
    expect(habitStreak(base.habits[0], base)).toBe(3);
  });

  it('racha sigue viva si hoy aún no se cumple', () => {
    expect(habitStreak(base.habits[1], base)).toBe(1);
  });

  it('un día sin registro corta la racha', () => {
    const gap = { ...base, dailyLogs: [{ date: '2026-11-12', habitsDoneIds: [1] }] };
    expect(habitStreak(base.habits[0], gap)).toBe(1);
  });

  it('al cerrar el día guarda qué hábitos se cumplieron', () => {
    const next = rollDay(base, '2026-11-15');
    expect(next.dailyLogs[0]).toMatchObject({ date: '2026-11-14', habitsDone: 1, habitsDoneIds: [1] });
    expect(next.habits.every(h => !h.done)).toBe(true);
    expect(next.water).toBe(0);
    expect(habitStreak({ id: 1, done: false }, next)).toBe(3);
  });

  it('nextHabitId', () => {
    expect(nextHabitId(base.habits)).toBe(3);
    expect(nextHabitId([])).toBe(1);
  });
});
