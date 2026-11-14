import { describe, it, expect } from 'vitest';
import { monthlySeries, niceMax, compactMoney, shortMonth } from './trends.js';
import { habitLevel, habitCalendar } from './habits.js';

describe('serie mensual', () => {
  const tx = [
    { amount: 1000, type: 'income', category: 'Salario', date: '2026-11-01' },
    { amount: 300, type: 'expense', category: 'Ocio', date: '2026-11-05' },
    { amount: 200, type: 'expense', category: 'Ocio', date: '2026-09-20' },
    { amount: 999, type: 'expense', category: 'Ocio', date: '2025-01-01' },
  ];

  it('incluye meses sin movimientos y cruza el año', () => {
    const s = monthlySeries(tx, '2026-11', 3);
    expect(s.map((m) => m.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(s.map((m) => m.expense)).toEqual([200, 0, 300]);
    expect(s[2]).toMatchObject({ income: 1000, balance: 700 });
    expect(monthlySeries([], '2026-02', 3).map((m) => m.month)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('ejes y etiquetas', () => {
    expect(niceMax(13400)).toBe(15000);
    expect(niceMax(15000)).toBe(15000);
    expect(niceMax(1800)).toBe(2000);
    expect(niceMax(0)).toBe(1);
    expect(compactMoney(15000)).toBe('$15k');
    expect(compactMoney(1500)).toBe('$1.5k');
    expect(compactMoney(950)).toBe('$950');
    expect(compactMoney(1200000)).toBe('$1.2M');
    expect(shortMonth('2026-11')).toBe('nov');
  });
});

describe('calendario de hábitos', () => {
  it('niveles', () => {
    expect(habitLevel(0, 0)).toBeNull();
    expect(habitLevel(0, 4)).toBe(0);
    expect(habitLevel(1, 4)).toBe(1);
    expect(habitLevel(2, 4)).toBe(2);
    expect(habitLevel(3, 4)).toBe(3);
    expect(habitLevel(4, 4)).toBe(4);
  });

  it('semanas de lunes a domingo terminando en la semana de hoy', () => {
    const health = {
      lastActiveDate: '2026-11-14', // sábado
      habits: [{ id: 1, done: true }, { id: 2, done: false }],
      dailyLogs: [
        { date: '2026-11-13', habitsDone: 2, habitsTotal: 2 },
        { date: '2026-11-10', habitsDone: 0, habitsTotal: 2 },
      ],
    };
    const cal = habitCalendar(health, 2);
    expect(cal).toHaveLength(2);
    expect(cal[0][0].date).toBe('2026-11-02');
    const week = cal[1];
    expect(week[0].date).toBe('2026-11-09');
    expect(week[1]).toMatchObject({ date: '2026-11-10', level: 0 });
    expect(week[2]).toMatchObject({ date: '2026-11-11', level: null });
    expect(week[4]).toMatchObject({ date: '2026-11-13', level: 4 });
    expect(week[5]).toMatchObject({ date: '2026-11-14', isToday: true, done: 1, total: 2, level: 2 });
    expect(week[6]).toMatchObject({ date: '2026-11-15', future: true });
  });
});
