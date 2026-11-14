import { addDaysToKey, normalizeTime, isValidDateParts, makeKey, weekdayOf } from './dates.js';

// Nota: \b en JS no reconoce letras acentuadas ni "ñ" como parte de palabra,
// por eso los límites alrededor de esas letras se expresan con (?:^|\s) y (?=\s|$).

const MONEY_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?/;
// "4:30 pm", "4pm", "16:00". El \b final evita capturar "2 am" dentro de "2 amigos".
const TIME_RE = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b/i;
const DAY_AFTER_RE = /\bpasado\s+ma[ñn]ana(?=\s|$)/i;
// "la mañana" / "esta mañana" es la parte del día, no el día siguiente.
const TOMORROW_RE = /(?:\b(la|esta|cada|toda)\s+)?\bma[ñn]ana(?=\s|$)/i;
const TODAY_RE = /\bhoy\b/i;
const IN_DAYS_RE = /(?:^|\s)en\s+(\d{1,3}|una?|dos|tres)\s+(d[íi]as?|semanas?)(?=\s|$)/i;
const WEEKDAY_RE = /(?:^|\s)(?:el\s+|este\s+|pr[óo]ximo\s+)?(domingo|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado)(?=\s|$)/i;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const LONG_DATE_RE = /(?:^|\s)(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|sep?tiembre|octubre|noviembre|diciembre)(?:\s+(?:de\s+)?(\d{4}))?(?=\s|$)/i;
const SHORT_DATE_RE = /(?:^|\s)(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?=\s|$)/;
const WATER_RE = /(?:^|\s)(?:tomar|tom[ée]|beber|beb[íi]|vasos?)(?=\s).*\bagua\b/i;
const INCOME_RE = /\b(?:ingreso|cobro|sueldo)\b|(?:^|\s)n[óo]mina(?=\s|$)/i;

const WORD_NUMBERS = { un: 1, una: 1, dos: 2, tres: 3 };
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const plain = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const detectCategory = (desc) => {
  const lower = desc.toLowerCase();
  if (/café|comida|super/.test(lower)) return 'Alimentación';
  if (/uber|gasolina|taxi/.test(lower)) return 'Transporte';
  if (/cine|cena/.test(lower)) return 'Ocio';
  return 'General';
};

const tidy = (s) => s.replace(/\s+/g, ' ').trim();

// Fecha absoluta sin año: si ya pasó este año, se toma la del año siguiente.
const resolveDate = (day, month, year, todayKey) => {
  const todayYear = Number(todayKey.slice(0, 4));
  let y = year ? (year < 100 ? 2000 + year : year) : todayYear;
  if (!isValidDateParts(y, month, day)) return null;
  let key = makeKey(y, month, day);
  if (!year && key < todayKey) {
    y += 1;
    if (!isValidDateParts(y, month, day)) return null;
    key = makeKey(y, month, day);
  }
  return key;
};

// Busca la fecha en el texto. Devuelve { date, match } o null.
const findDate = (text, todayKey) => {
  const dayAfter = text.match(DAY_AFTER_RE);
  if (dayAfter) return { date: addDaysToKey(todayKey, 2), match: dayAfter[0] };

  const tomorrow = text.match(TOMORROW_RE);
  if (tomorrow && !tomorrow[1]) return { date: addDaysToKey(todayKey, 1), match: tomorrow[0] };

  const inDays = text.match(IN_DAYS_RE);
  if (inDays) {
    const n = WORD_NUMBERS[inDays[1].toLowerCase()] ?? parseInt(inDays[1], 10);
    const days = /^semana/i.test(inDays[2]) ? n * 7 : n;
    if (days > 0) return { date: addDaysToKey(todayKey, days), match: inDays[0] };
  }

  const longDate = text.match(LONG_DATE_RE);
  if (longDate) {
    const month = MONTHS.indexOf(longDate[2].toLowerCase().replace('setiembre', 'septiembre')) + 1;
    const date = resolveDate(Number(longDate[1]), month, longDate[3] && Number(longDate[3]), todayKey);
    if (date) return { date, match: longDate[0] };
  }

  const shortDate = text.match(SHORT_DATE_RE);
  if (shortDate) {
    const date = resolveDate(Number(shortDate[1]), Number(shortDate[2]), shortDate[3] && Number(shortDate[3]), todayKey);
    if (date) return { date, match: shortDate[0] };
  }

  const weekday = text.match(WEEKDAY_RE);
  if (weekday) {
    const target = WEEKDAYS.indexOf(plain(weekday[1]));
    // Siempre la próxima ocurrencia; si hoy es ese día, la de la semana siguiente.
    const offset = ((target - weekdayOf(todayKey) + 7) % 7) || 7;
    return { date: addDaysToKey(todayKey, offset), match: weekday[0] };
  }

  const today = text.match(TODAY_RE);
  if (today) return { date: todayKey, match: today[0] };

  return null;
};

// Interpreta el texto del Quick-Add. Devuelve uno de:
//   { kind: 'transaction', desc, amount, type, category }
//   { kind: 'water', glasses }
//   { kind: 'task', title, date, time }
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

  const time = title.match(TIME_RE);
  const normalizedTime = time ? normalizeTime(time[0]) : '';
  if (time && normalizedTime) title = title.replace(time[0], ' ');

  const found = findDate(title, todayKey);
  if (found) title = title.replace(found.match, ' ');

  return {
    kind: 'task',
    title: tidy(title) || 'Nueva tarea',
    date: found ? found.date : todayKey,
    time: normalizedTime,
  };
}
