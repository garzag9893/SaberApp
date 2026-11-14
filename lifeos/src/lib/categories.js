import { plain } from './text.js';

// Paleta de categorías validada para daltonismo (protanopia, deuteranopia y tritanopia)
// sobre los fondos claro y oscuro de LifeOS. El ORDEN es parte de la validación:
// colores vecinos siempre se distinguen. Ver DESIGN.md.
export const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Alimentación', color: PALETTE[0] },
  { name: 'Transporte', color: PALETTE[1] },
  { name: 'Salud', color: PALETTE[2] },
  { name: 'Ocio', color: PALETTE[3] },
  { name: 'General', color: PALETTE[4] },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salario', color: PALETTE[5] },
  { name: 'Freelance', color: PALETTE[2] },
  { name: 'Otros ingresos', color: PALETTE[0] },
];

export const listKey = (type) => (type === 'income' ? 'incomeCategories' : 'expenseCategories');

export const categoryNames = (settings, type) => settings[listKey(type)].map((c) => c.name);

export const categoryColor = (settings, type, name) =>
  settings[listKey(type)].find((c) => c.name === name)?.color || '#64748b';

const nextColor = (list) => PALETTE.find((c) => !list.some((x) => x.color === c)) || PALETTE[list.length % PALETTE.length];

const validateName = (list, name, ignore) => {
  const clean = String(name ?? '').trim();
  if (!clean) return { error: 'El nombre no puede quedar vacío' };
  if (clean.length > 30) return { error: 'Usa un nombre de máximo 30 caracteres' };
  if (list.some((c) => c.name !== ignore && plain(c.name) === plain(clean))) return { error: `Ya existe la categoría "${clean}"` };
  return { name: clean };
};

const withSettings = (data, settings, now) => ({ ...data, settings, stamps: { ...data.stamps, settings: now } });

export const addCategory = (data, type, rawName, now) => {
  const key = listKey(type);
  const list = data.settings[key];
  const { name, error } = validateName(list, rawName);
  if (error) return { data, error };
  return { data: withSettings(data, { ...data.settings, [key]: [...list, { name, color: nextColor(list) }] }, now) };
};

export const recolorCategory = (data, type, name, color, now) => {
  const key = listKey(type);
  const list = data.settings[key].map((c) => (c.name === name ? { ...c, color } : c));
  return withSettings(data, { ...data.settings, [key]: list }, now);
};

// Renombra la categoría y actualiza movimientos, presupuestos y gastos fijos que la usan.
export const renameCategory = (data, type, oldName, rawName, now) => {
  const key = listKey(type);
  const list = data.settings[key];
  const { name, error } = validateName(list, rawName, oldName);
  if (error) return { data, error };
  if (name === oldName) return { data };

  const renameTx = (t) => (t.type === type && t.category === oldName ? { ...t, category: name, updatedAt: now } : t);
  let budgets = data.budgets;
  let budgetsStamp = data.stamps.budgets;
  if (type === 'expense' && oldName in budgets) {
    budgets = Object.fromEntries(Object.entries(budgets).map(([k, v]) => [k === oldName ? name : k, v]));
    budgetsStamp = now;
  }
  const settings = {
    ...data.settings,
    [key]: list.map((c) => (c.name === oldName ? { ...c, name } : c)),
    recurringTx: data.settings.recurringTx.map(renameTx),
  };
  return {
    data: {
      ...data,
      transactions: data.transactions.map(renameTx),
      budgets,
      settings,
      stamps: { ...data.stamps, settings: now, budgets: budgetsStamp },
    },
  };
};

// Elimina la categoría; sus movimientos pasan a "General" (o a la primera que quede).
export const removeCategory = (data, type, name, now) => {
  const key = listKey(type);
  const list = data.settings[key];
  if (list.length <= 1) return { data, error: 'Debe quedar al menos una categoría' };
  const remaining = list.filter((c) => c.name !== name);
  const fallback = (type === 'expense' && remaining.find((c) => c.name === 'General')?.name) || remaining[0].name;

  let moved = 0;
  const reassign = (t) => {
    if (t.type !== type || t.category !== name) return t;
    moved += 1;
    return { ...t, category: fallback, updatedAt: now };
  };
  const transactions = data.transactions.map(reassign);
  const count = moved;
  const recurringTx = data.settings.recurringTx.map((r) => (r.type === type && r.category === name ? { ...r, category: fallback } : r));

  let { budgets } = data;
  let budgetsStamp = data.stamps.budgets;
  if (type === 'expense' && name in budgets) {
    budgets = { ...budgets };
    delete budgets[name];
    budgetsStamp = now;
  }
  return {
    data: {
      ...data,
      transactions,
      budgets,
      settings: { ...data.settings, [key]: remaining, recurringTx },
      stamps: { ...data.stamps, settings: now, budgets: budgetsStamp },
    },
    moved: count,
    fallback,
  };
};
