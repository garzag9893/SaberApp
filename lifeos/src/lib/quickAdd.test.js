import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quickAdd.js';
import { normalizeTime, addDaysToKey, sortTasksChronologically } from './dates.js';

const TODAY = '2026-01-31';

describe('parseQuickAdd', () => {
  it('agenda para mañana con hora 24h', () => {
    expect(parseQuickAdd('Dentista mañana 16:00', TODAY)).toEqual({
      kind: 'task', title: 'Dentista', date: '2026-02-01', time: '16:00', dayOffset: 1,
    });
  });

  it('entiende "4:30 pm" completo', () => {
    const r = parseQuickAdd('Junta 4:30 pm', TODAY);
    expect(r.time).toBe('16:30');
    expect(r.title).toBe('Junta');
  });

  it('entiende "4pm" y "12am"', () => {
    expect(parseQuickAdd('Gym 4pm', TODAY).time).toBe('16:00');
    expect(parseQuickAdd('Vuelo 12am', TODAY).time).toBe('00:00');
  });

  it('no confunde "2 amigos" con una hora', () => {
    const r = parseQuickAdd('Cenar con 2 amigos', TODAY);
    expect(r.time).toBe('');
    expect(r.title).toBe('Cenar con 2 amigos');
  });

  it('"por la mañana" no es el día siguiente', () => {
    const r = parseQuickAdd('Correr por la mañana', TODAY);
    expect(r.date).toBe(TODAY);
    expect(r.title).toBe('Correr por la mañana');
  });

  it('"pasado mañana" suma dos días', () => {
    const r = parseQuickAdd('Entrega pasado mañana 9:00', TODAY);
    expect(r.date).toBe('2026-02-02');
    expect(r.time).toBe('09:00');
    expect(r.title).toBe('Entrega');
  });

  it('ignora horas imposibles', () => {
    const r = parseQuickAdd('Marcador 25:99', TODAY);
    expect(r.time).toBe('');
    expect(r.title).toBe('Marcador 25:99');
  });

  it('registra gastos con categoría automática', () => {
    expect(parseQuickAdd('Comida $180', TODAY)).toEqual({
      kind: 'transaction', desc: 'Comida', amount: 180, type: 'expense', category: 'Alimentación',
    });
  });

  it('acepta montos con comas y decimales', () => {
    expect(parseQuickAdd('Renta $1,500.50', TODAY).amount).toBe(1500.5);
  });

  it('detecta ingresos', () => {
    const r = parseQuickAdd('Ingreso freelance $3000', TODAY);
    expect(r.type).toBe('income');
    expect(r.category).toBe('Salario');
  });

  it('registra agua solo cuando es consumo', () => {
    expect(parseQuickAdd('Tomar agua', TODAY)).toEqual({ kind: 'water', glasses: 1 });
    expect(parseQuickAdd('2 vasos de agua', TODAY)).toEqual({ kind: 'water', glasses: 2 });
    expect(parseQuickAdd('Comprar agua mineral', TODAY).kind).toBe('task');
    expect(parseQuickAdd('Pagar agua $300', TODAY).kind).toBe('transaction');
  });
});

describe('fechas', () => {
  it('normalizeTime', () => {
    expect(normalizeTime('9:00')).toBe('09:00');
    expect(normalizeTime('12 pm')).toBe('12:00');
    expect(normalizeTime('13pm')).toBe('');
    expect(normalizeTime('')).toBe('');
  });

  it('addDaysToKey cruza meses y años', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('ordena por fecha y hora, sin hora al final', () => {
    const sorted = sortTasksChronologically([
      { id: 1, date: TODAY, time: '' },
      { id: 2, date: TODAY, time: '14:00' },
      { id: 3, date: TODAY, time: '08:30' },
      { id: 4, date: '2026-01-30', time: '' },
    ], TODAY);
    expect(sorted.map(t => t.id)).toEqual([4, 3, 2, 1]);
  });
});
