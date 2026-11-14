import { describe, it, expect } from 'vitest';
import { nextOccurrence, toggleTask } from './recurrence.js';
import { findConflicts, formatTimeRange, isForToday } from './agenda.js';
import { addCategory, renameCategory, removeCategory } from './categories.js';
import { applyRecurringTx, ruleStartMonth } from './recurringTx.js';
import { mergeData, stableStringify } from './merge.js';
import { sanitizeData, normalizeRemote, defaultSettings } from './storage.js';
import { startOfWeek } from './dates.js';

const T = '2026-01-31'; // sábado
let n = 0;
const opts = { newId: () => `n${++n}`, now: '2026-01-31T10:00:00.000Z' };

const base = (extra = {}) => sanitizeData({
  tasks: [], transactions: [], health: {}, budgets: {}, settings: defaultSettings(), ...extra,
});

describe('tareas que se repiten', () => {
  it('siguiente fecha', () => {
    expect(nextOccurrence({ date: T, repeat: 'daily' }, T)).toBe('2026-02-01');
    expect(nextOccurrence({ date: '2026-01-30', repeat: 'weekdays' }, T)).toBe('2026-02-02');
    expect(nextOccurrence({ date: T, repeat: 'weekly' }, T)).toBe('2026-02-07');
    expect(nextOccurrence({ date: '2026-01-31', repeat: 'monthly' }, T)).toBe('2026-02-28');
    expect(nextOccurrence({ date: '2026-02-28', repeat: 'monthly', repeatAnchor: 31 }, '2026-02-28')).toBe('2026-03-31');
  });

  it('una tarea atrasada no genera otra atrasada', () => {
    expect(nextOccurrence({ date: '2026-01-20', repeat: 'daily' }, T)).toBe(T);
    expect(nextOccurrence({ date: '2026-01-20', repeat: 'weekly' }, T)).toBe('2026-02-03');
  });

  it('completar crea la siguiente y desmarcar la quita', () => {
    const tasks = [{ id: 'a', title: 'Gym', date: T, time: '07:00', endTime: '', priority: 'medium', completed: false, repeat: 'daily', repeatAnchor: null, spawnedId: null, updatedAt: '' }];
    const done = toggleTask(tasks, 'a', T, opts);
    expect(done.tasks).toHaveLength(2);
    const next = done.tasks.find((t) => t.id !== 'a');
    expect(next).toMatchObject({ title: 'Gym', date: '2026-02-01', time: '07:00', completed: false, repeat: 'daily' });
    expect(done.tasks.find((t) => t.id === 'a')).toMatchObject({ completed: true, spawnedId: next.id });

    const undone = toggleTask(done.tasks, 'a', T, { ...opts, now: 'later' });
    expect(undone.tasks).toHaveLength(1);
    expect(undone.removedIds).toEqual([next.id]);
  });

  it('si la siguiente ya se editó, no se borra al desmarcar', () => {
    const tasks = [{ id: 'a', title: 'Gym', date: T, completed: false, repeat: 'daily', updatedAt: '' }];
    const done = toggleTask(tasks, 'a', T, opts).tasks;
    const edited = done.map((t) => (t.id !== 'a' ? { ...t, title: 'Gym largo', updatedAt: 'z' } : t));
    expect(toggleTask(edited, 'a', T, opts).tasks).toHaveLength(2);
  });
});

describe('agenda', () => {
  it('choques de horario', () => {
    const c = findConflicts([
      { id: 1, title: 'A', date: T, time: '09:00', endTime: '10:00' },
      { id: 2, title: 'B', date: T, time: '09:30', endTime: '' },
      { id: 3, title: 'C', date: T, time: '10:00', endTime: '11:00' },
      { id: 4, title: 'D', date: T, time: '09:30', completed: true },
    ]);
    expect(c).toEqual({ 1: ['B'], 2: ['A'] });
  });

  it('rango de hora y semana', () => {
    expect(formatTimeRange({ time: '09:00', endTime: '10:30' })).toBe('09:00–10:30');
    expect(formatTimeRange({ time: '' })).toBe('Sin hora');
    expect(startOfWeek(T)).toBe('2026-01-26');
    expect(isForToday({ date: '2026-01-01', completed: false }, T)).toBe(true);
  });
});

describe('categorías', () => {
  const data = base({
    transactions: [{ id: 1, desc: 'Cine', amount: 100, type: 'expense', category: 'Ocio', date: T }],
    budgets: { Ocio: 500 },
  });

  it('renombrar actualiza movimientos y presupuestos', () => {
    const r = renameCategory(data, 'expense', 'Ocio', 'Diversión', 'ts');
    expect(r.error).toBeUndefined();
    expect(r.data.transactions[0].category).toBe('Diversión');
    expect(r.data.budgets).toEqual({ 'Diversión': 500 });
  });

  it('no permite duplicados ni nombres vacíos', () => {
    expect(renameCategory(data, 'expense', 'Ocio', 'salud', 'ts').error).toMatch(/Ya existe/);
    expect(addCategory(data, 'expense', '  ', 'ts').error).toMatch(/vacío/);
    expect(addCategory(data, 'expense', 'Mascotas', 'ts').data.settings.expenseCategories.at(-1).name).toBe('Mascotas');
  });

  it('eliminar mueve los movimientos a General', () => {
    const r = removeCategory(data, 'expense', 'Ocio', 'ts');
    expect(r).toMatchObject({ moved: 1, fallback: 'General' });
    expect(r.data.transactions[0].category).toBe('General');
    expect(r.data.budgets).toEqual({});
  });
});

describe('gastos fijos', () => {
  it('primer mes de una regla', () => {
    expect(ruleStartMonth(31, T)).toBe('2026-01');
    expect(ruleStartMonth(15, T)).toBe('2026-02');
  });

  it('registra los meses pendientes una sola vez', () => {
    const data = base({ settings: { ...defaultSettings(), recurringTx: [
      { id: 'r1', desc: 'Renta', amount: 8000, type: 'expense', category: 'General', day: 5, startMonth: '2025-11', lastPosted: null },
    ] } });
    const once = applyRecurringTx(data, T, 'ts');
    expect(once.transactions.map((t) => t.id)).toEqual(['rec-r1-2026-01', 'rec-r1-2025-12', 'rec-r1-2025-11']);
    expect(once.settings.recurringTx[0].lastPosted).toBe('2026-01');
    expect(applyRecurringTx(once, T, 'ts')).toBe(once);
  });

  it('no vuelve a crear un movimiento fijo que se borró', () => {
    const data = base({
      settings: { ...defaultSettings(), recurringTx: [{ id: 'r1', desc: 'Renta', amount: 1, type: 'expense', category: 'General', day: 1, startMonth: '2026-01' }] },
      deleted: { tasks: {}, transactions: { 'rec-r1-2026-01': 'ts' } },
    });
    expect(applyRecurringTx(data, T, 'ts').transactions).toHaveLength(0);
  });
});

describe('sincronización por elemento', () => {
  const task = (id, title, updatedAt) => ({ id, title, date: T, time: '', endTime: '', priority: 'medium', completed: false, repeat: 'none', repeatAnchor: null, spawnedId: null, updatedAt });

  it('combina cambios de dos dispositivos', () => {
    const local = base({ tasks: [task('a', 'A local', '2'), task('b', 'B', '1')] });
    const remote = base({ tasks: [task('a', 'A remota', '1'), task('b', 'B remota', '3'), task('c', 'C nueva', '1')] });
    const merged = mergeData(local, remote);
    expect(merged.tasks.map((t) => t.title)).toEqual(['C nueva', 'A local', 'B remota']);
  });

  it('un borrado gana sobre una versión anterior', () => {
    const local = base({ tasks: [task('a', 'A', '1')] });
    const remote = { ...base({ tasks: [] }), deleted: { tasks: { a: '2' }, transactions: {} } };
    expect(mergeData(local, remote).tasks).toHaveLength(0);
    const edited = base({ tasks: [task('a', 'A editada', '3')] });
    expect(mergeData(edited, remote).tasks).toHaveLength(1);
  });

  it('salud y presupuestos: gana el bloque más reciente', () => {
    const local = { ...base({ budgets: { Ocio: 1 } }), stamps: { health: '', budgets: '5', settings: '' } };
    const remote = { ...base({ budgets: { Ocio: 2 } }), stamps: { health: '', budgets: '4', settings: '' } };
    expect(mergeData(local, remote).budgets).toEqual({ Ocio: 1 });
  });

  it('copias de la versión 5 usan su fecha general', () => {
    const remote = normalizeRemote({ tasks: [{ id: 'a', title: 'Vieja' }], updatedAt: '2026-01-01' });
    expect(remote.tasks[0].updatedAt).toBe('2026-01-01');
    expect(remote.stamps.health).toBe('');
  });

  it('stableStringify ignora el orden de las claves', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }));
  });
});
