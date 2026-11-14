import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quickAdd.js';
import { normalizeTime, addDaysToKey, sortTasksChronologically, dayDiff } from './dates.js';

const TODAY = '2026-01-31';

describe('parseQuickAdd', () => {
  it('agenda para mañana con hora 24h', () => {
    expect(parseQuickAdd('Dentista mañana 16:00', TODAY)).toEqual({
      kind: 'task', title: 'Dentista', date: '2026-02-01', time: '16:00', repeat: 'none', repeatAnchor: null,
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

// 2026-01-31 es sábado.
describe('parseQuickAdd: fechas', () => {
  it('día de la semana: la próxima ocurrencia', () => {
    expect(parseQuickAdd('Junta el viernes 10:00', TODAY)).toMatchObject({ title: 'Junta', date: '2026-02-06', time: '10:00' });
    expect(parseQuickAdd('Mercado el lunes', TODAY).date).toBe('2026-02-02');
    expect(parseQuickAdd('Correr miércoles', TODAY).date).toBe('2026-02-04');
  });

  it('el mismo día de la semana es la semana siguiente', () => {
    expect(parseQuickAdd('Limpieza el sábado', TODAY).date).toBe('2026-02-07');
  });

  it('"el lunes por la mañana" es el lunes, no mañana', () => {
    const r = parseQuickAdd('Gym el lunes por la mañana', TODAY);
    expect(r.date).toBe('2026-02-02');
    expect(r.title).toBe('Gym por la mañana');
  });

  it('"en N días" y "en una semana"', () => {
    expect(parseQuickAdd('Revisar en 3 días', TODAY)).toMatchObject({ title: 'Revisar', date: '2026-02-03' });
    expect(parseQuickAdd('Seguimiento en una semana', TODAY).date).toBe('2026-02-07');
    expect(parseQuickAdd('Vacuna en 2 semanas', TODAY).date).toBe('2026-02-14');
  });

  it('fecha con nombre de mes', () => {
    expect(parseQuickAdd('Cumpleaños de Ana 15 de marzo', TODAY)).toMatchObject({ title: 'Cumpleaños de Ana', date: '2026-03-15' });
    expect(parseQuickAdd('Aniversario el 10 de enero', TODAY).date).toBe('2027-01-10');
    expect(parseQuickAdd('Viaje 5 de mayo de 2028', TODAY).date).toBe('2028-05-05');
  });

  it('fecha corta día/mes', () => {
    expect(parseQuickAdd('Pagar tarjeta 15/02', TODAY)).toMatchObject({ title: 'Pagar tarjeta', date: '2026-02-15' });
    expect(parseQuickAdd('Dato 31/02', TODAY)).toMatchObject({ title: 'Dato 31/02', date: TODAY });
  });

  it('"hoy" se quita del título', () => {
    expect(parseQuickAdd('Llamar a mamá hoy 6pm', TODAY)).toMatchObject({ title: 'Llamar a mamá', date: TODAY, time: '18:00' });
  });
});

describe('parseQuickAdd: repetición', () => {
  it('todos los días', () => {
    expect(parseQuickAdd('Tomar vitaminas todos los días 8am', TODAY)).toMatchObject({ title: 'Tomar vitaminas', date: TODAY, time: '08:00', repeat: 'daily' });
    expect(parseQuickAdd('Correr diario', TODAY).repeat).toBe('daily');
  });

  it('entre semana empieza el lunes si hoy es fin de semana', () => {
    expect(parseQuickAdd('Revisar correo entre semana 9:00', TODAY)).toMatchObject({ title: 'Revisar correo', date: '2026-02-02', repeat: 'weekdays' });
  });

  it('cada lunes / los sábados', () => {
    expect(parseQuickAdd('Junta de equipo cada lunes 10:00', TODAY)).toMatchObject({ title: 'Junta de equipo', date: '2026-02-02', repeat: 'weekly' });
    expect(parseQuickAdd('Mercado todos los sábados', TODAY)).toMatchObject({ title: 'Mercado', date: TODAY, repeat: 'weekly' });
    expect(parseQuickAdd('Misa cada domingo', TODAY).date).toBe('2026-02-01');
  });

  it('el día 15 de cada mes', () => {
    expect(parseQuickAdd('Pagar renta el día 15 de cada mes', TODAY)).toMatchObject({ title: 'Pagar renta', date: '2026-02-15', repeat: 'monthly', repeatAnchor: 15 });
  });

  it('cada mes con fecha', () => {
    expect(parseQuickAdd('Corte de pelo cada mes el viernes', TODAY)).toMatchObject({ title: 'Corte de pelo', date: '2026-02-06', repeat: 'monthly', repeatAnchor: 6 });
  });

  it('"cada mañana" no es el día siguiente ni repetición', () => {
    expect(parseQuickAdd('Estirar cada mañana', TODAY)).toMatchObject({ date: TODAY, repeat: 'none' });
  });
});

describe('parseQuickAdd: categorías del usuario', () => {
  const categories = { expense: ['Comida', 'Mascotas', 'General'], income: ['Honorarios'] };
  it('usa la categoría propia que aparece en el texto', () => {
    expect(parseQuickAdd('Croquetas mascotas $450', TODAY, { categories }).category).toBe('Mascotas');
  });
  it('si la sugerencia no existe, usa General', () => {
    expect(parseQuickAdd('Uber $90', TODAY, { categories }).category).toBe('General');
  });
  it('ingresos van a la primera categoría de ingreso', () => {
    expect(parseQuickAdd('Cobro cliente $5000', TODAY, { categories }).category).toBe('Honorarios');
  });
});

describe('fechas', () => {
  it('dayDiff', () => {
    expect(dayDiff('2026-01-31', '2026-03-01')).toBe(29);
    expect(dayDiff('2026-03-01', '2026-01-31')).toBe(-29);
  });

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
