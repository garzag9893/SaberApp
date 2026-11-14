import { addDaysToKey, normalizeTime } from './dates.js';

// Nota: \b en JS no reconoce letras acentuadas ni "ñ" como parte de palabra,
// por eso los límites alrededor de esas letras se expresan con (?:^|\s) y (?=\s|$).

const MONEY_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/;
// "4:30 pm", "4pm", "16:00". El \b final evita capturar "2 am" dentro de "2 amigos".
const TIME_RE = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b/i;
const DAY_AFTER_RE = /\bpasado\s+ma[ñn]ana(?=\s|$)/i;
// "la mañana" / "esta mañana" es la parte del día, no el día siguiente.
const TOMORROW_RE = /(?:\b(la|esta|cada|toda)\s+)?\bma[ñn]ana(?=\s|$)/i;
const TODAY_RE = /\bhoy\b/i;
const WATER_RE = /(?:^|\s)(?:tomar|tom[ée]|beber|beb[íi]|vasos?)(?=\s).*\bagua\b/i;
const INCOME_RE = /\b(?:ingreso|cobro|sueldo)\b|(?:^|\s)n[óo]mina(?=\s|$)/i;

const detectCategory = (desc) => {
  const lower = desc.toLowerCase();
  if (/café|comida|super/.test(lower)) return 'Alimentación';
  if (/uber|gasolina|taxi/.test(lower)) return 'Transporte';
  if (/cine|cena/.test(lower)) return 'Ocio';
  return 'General';
};

const tidy = (s) => s.replace(/\s+/g, ' ').trim();

// Interpreta el texto del Quick-Add. Devuelve uno de:
//   { kind: 'transaction', desc, amount, type, category }
//   { kind: 'water', glasses }
//   { kind: 'task', title, date, time, dayOffset }
export function parseQuickAdd(rawText, todayKey) {
  const text = tidy(rawText);

  const money = text.match(MONEY_RE);
  if (money) {
    const amount = parseFloat(money[1].replace(/,/g, '') + (money[2] || ''));
    const desc = tidy(text.replace(money[0], '')) || 'Movimiento rápido';
    const isIncome = INCOME_RE.test(text);
    return {
      kind: 'transaction',
      desc,
      amount,
      type: isIncome ? 'income' : 'expense',
      category: isIncome ? 'Salario' : detectCategory(desc),
    };
  }

  if (/^agua$/i.test(text) || WATER_RE.test(text)) {
    const count = text.match(/\b(\d{1,2})\s+vasos?\b/i);
    return { kind: 'water', glasses: count ? Math.max(1, parseInt(count[1], 10)) : 1 };
  }

  let title = text;
  let dayOffset = 0;

  const time = title.match(TIME_RE);
  const normalizedTime = time ? normalizeTime(time[0]) : '';
  if (time && normalizedTime) title = title.replace(time[0], ' ');

  if (DAY_AFTER_RE.test(title)) {
    dayOffset = 2;
    title = title.replace(DAY_AFTER_RE, ' ');
  } else {
    const tomorrow = title.match(TOMORROW_RE);
    if (tomorrow && !tomorrow[1]) {
      dayOffset = 1;
      title = title.replace(tomorrow[0], ' ');
    } else if (TODAY_RE.test(title)) {
      title = title.replace(TODAY_RE, ' ');
    }
  }

  return {
    kind: 'task',
    title: tidy(title) || 'Nueva tarea',
    date: addDaysToKey(todayKey, dayOffset),
    time: normalizedTime,
    dayOffset,
  };
}
