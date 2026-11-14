import { makeKey, daysInMonth } from './dates.js';

// Gastos e ingresos fijos: se registran solos cada mes en el día indicado.
// Los movimientos generados tienen id "rec-<regla>-<mes>", así nunca se duplican
// aunque se calculen en varios dispositivos.

const addMonth = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

const dateInMonth = (month, day) => {
  const [y, m] = month.split('-').map(Number);
  return makeKey(y, m, Math.min(day, daysInMonth(y, m)));
};

// Primer mes en que se registra una regla nueva: este mes si el día aún no pasa, si no el siguiente.
export const ruleStartMonth = (day, todayKey) => {
  const month = todayKey.slice(0, 7);
  return dateInMonth(month, day) >= todayKey ? month : addMonth(month, 1);
};

export const applyRecurringTx = (data, todayKey, now) => {
  const rules = data.settings.recurringTx;
  if (!rules.length) return data;

  const currentMonth = todayKey.slice(0, 7);
  const existing = new Set(data.transactions.map((t) => t.id));
  const tombstones = data.deleted.transactions;
  const created = [];
  let rulesChanged = false;

  const nextRules = rules.map((rule) => {
    let month = rule.lastPosted ? addMonth(rule.lastPosted, 1) : rule.startMonth;
    let lastPosted = rule.lastPosted;
    for (let guard = 0; month <= currentMonth && guard < 24; guard += 1) {
      const date = dateInMonth(month, rule.day);
      if (date > todayKey) break;
      const id = `rec-${rule.id}-${month}`;
      if (!existing.has(id) && !tombstones[id]) {
        created.push({
          id, desc: rule.desc, amount: rule.amount, type: rule.type, category: rule.category,
          date, recurringId: rule.id, updatedAt: now,
        });
        existing.add(id);
      }
      lastPosted = month;
      month = addMonth(month, 1);
    }
    if (lastPosted === rule.lastPosted) return rule;
    rulesChanged = true;
    return { ...rule, lastPosted };
  });

  if (!created.length && !rulesChanged) return data;
  return {
    ...data,
    transactions: [...created.sort((a, b) => b.date.localeCompare(a.date)), ...data.transactions],
    settings: { ...data.settings, recurringTx: nextRules },
    stamps: rulesChanged ? { ...data.stamps, settings: now } : data.stamps,
  };
};

export const describeRule = (rule) => `Día ${rule.day} de cada mes`;
