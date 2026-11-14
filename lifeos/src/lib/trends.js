import { filterByMonth, summarize } from './finance.js';

const addMonths = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

// Ingresos, gastos y ahorro de los últimos `count` meses, del más antiguo al más reciente.
export const monthlySeries = (transactions, endMonth, count = 6) =>
  Array.from({ length: count }, (_, i) => {
    const month = addMonths(endMonth, i - count + 1);
    const { income, expense, balance } = summarize(filterByMonth(transactions, month));
    return { month, income, expense, balance };
  });

const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const shortMonth = (month) => SHORT_MONTHS[Number(month.slice(5, 7)) - 1];

// Tope "redondo" para un eje, ajustado al valor para no dejar la gráfica medio vacía
// (13,400 → 15,000 · 1,800 → 2,000).
export const niceMax = (value) => {
  if (!(value > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * exp >= value - 1e-9);
  return step * exp;
};

// 950 → "$950" · 1500 → "$1.5k" · 15000 → "$15k" · 1200000 → "$1.2M"
export const compactMoney = (n) => {
  const abs = Math.abs(n);
  const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, ''));
  if (abs >= 1e6) return `$${fmt(n / 1e6)}M`;
  if (abs >= 1e3) return `$${fmt(n / 1e3)}k`;
  return `$${Math.round(n)}`;
};
