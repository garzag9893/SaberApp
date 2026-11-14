// Cálculos de finanzas: filtro por mes, totales y presupuestos.

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const monthOf = (dateStr) => (dateStr || '').slice(0, 7);

export const formatMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

// Meses con movimientos más el mes actual, del más reciente al más antiguo.
export const listMonths = (transactions, currentMonth) =>
  [...new Set([currentMonth, ...transactions.map((t) => monthOf(t.date)).filter(Boolean)])]
    .sort((a, b) => b.localeCompare(a));

export const filterByMonth = (transactions, month) =>
  month === 'all' ? transactions : transactions.filter((t) => monthOf(t.date) === month);

export const summarize = (transactions) => {
  let income = 0;
  let expense = 0;
  const byCategory = {};
  for (const t of transactions) {
    if (t.type === 'income') income += t.amount;
    else {
      expense += t.amount;
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    }
  }
  return { income, expense, balance: income - expense, byCategory };
};

// Estado de un presupuesto mensual: 'ok', 'warn' (80 % o más) u 'over' (excedido).
export const budgetStatus = (spent, limit) => {
  if (!(limit > 0)) return null;
  const pct = (spent / limit) * 100;
  return {
    spent,
    limit,
    pct,
    remaining: limit - spent,
    level: pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok',
  };
};

export const sanitizeBudgets = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const clean = {};
  for (const [category, limit] of Object.entries(value)) {
    const n = Number(limit);
    if (typeof category === 'string' && Number.isFinite(n) && n > 0) clean[category] = n;
  }
  return clean;
};
