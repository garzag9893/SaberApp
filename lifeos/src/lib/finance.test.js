import { describe, it, expect } from 'vitest';
import { listMonths, filterByMonth, summarize, budgetStatus, sanitizeBudgets, formatMonth } from './finance.js';

const tx = [
  { id: 1, amount: 1000, type: 'income', category: 'Salario', date: '2026-11-01' },
  { id: 2, amount: 300, type: 'expense', category: 'Ocio', date: '2026-11-05' },
  { id: 3, amount: 200, type: 'expense', category: 'Ocio', date: '2026-10-20' },
  { id: 4, amount: 50, type: 'expense', category: 'Salud', date: '2026-11-07' },
];

describe('finanzas', () => {
  it('lista meses con el actual aunque no tenga movimientos', () => {
    expect(listMonths(tx, '2026-12')).toEqual(['2026-12', '2026-11', '2026-10']);
  });

  it('filtra por mes y resume', () => {
    expect(summarize(filterByMonth(tx, '2026-11'))).toEqual({
      income: 1000, expense: 350, balance: 650, byCategory: { Ocio: 300, Salud: 50 },
    });
    expect(filterByMonth(tx, 'all')).toHaveLength(4);
  });

  it('estado del presupuesto', () => {
    expect(budgetStatus(300, 1000).level).toBe('ok');
    expect(budgetStatus(800, 1000).level).toBe('warn');
    expect(budgetStatus(1200, 1000)).toMatchObject({ level: 'over', remaining: -200 });
    expect(budgetStatus(100, 0)).toBeNull();
  });

  it('limpia presupuestos inválidos', () => {
    expect(sanitizeBudgets({ Ocio: '500', Salud: -1, General: 'x' })).toEqual({ Ocio: 500 });
    expect(sanitizeBudgets([])).toBeNull();
  });

  it('nombre del mes', () => {
    expect(formatMonth('2026-11')).toBe('Noviembre 2026');
  });
});
