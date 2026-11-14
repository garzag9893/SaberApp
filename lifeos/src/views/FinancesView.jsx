import { useState, useMemo } from 'react';
import {
  PieChart, TrendingUp, TrendingDown, Trash2, Pencil, Target, FileSpreadsheet,
  Repeat, Search, X, Settings,
} from 'lucide-react';
import { formatReadableDate } from '../lib/dates.js';
import { monthOf, formatMonth, listMonths, filterByMonth, summarize, budgetStatus, sanitizeBudgets } from '../lib/finance.js';
import { categoryNames, categoryColor } from '../lib/categories.js';
import { ruleStartMonth, describeRule } from '../lib/recurringTx.js';
import { matchesQuery } from '../lib/text.js';
import { ui, money, EditActions, Field, SectionTitle } from '../components/ui.jsx';
import { MonthlyTrend } from '../components/TrendCharts.jsx';
import { monthlySeries } from '../lib/trends.js';

function TypeToggle({ value, onChange }) {
  const btn = (type, label, on) => (
    <button
      type="button"
      onClick={() => onChange(type)}
      aria-pressed={value === type}
      className={`py-2 rounded-xl text-xs font-semibold border ${value === type ? on : 'bg-slate-800 border-slate-700 text-slate-400'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {btn('expense', 'Gasto (-)', 'bg-rose-500/20 border-rose-500 text-rose-300')}
      {btn('income', 'Ingreso (+)', 'bg-emerald-500/20 border-emerald-500 text-emerald-300')}
    </div>
  );
}

function CategorySelect({ settings, type, value, onChange, className, label = 'Categoría' }) {
  const names = categoryNames(settings, type);
  const options = names.includes(value) || !value ? names : [...names, value];
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {options.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

function Donut({ data, total, active, setActive }) {
  let cumulative = 0;
  const gap = data.length > 1 ? 0.8 : 0; // separación entre segmentos (en % de la circunferencia)
  const shown = data.find((d) => d.name === active);
  return (
    <div className="relative w-40 h-40 shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" role="img" aria-label="Gráfica de distribución de gastos por categoría">
        {data.map((seg) => {
          const start = cumulative;
          cumulative += seg.percentage;
          const len = Math.max(seg.percentage - gap, 0.3);
          return (
            <circle
              key={seg.name}
              cx="18" cy="18" r="15.915" fill="none" stroke={seg.color}
              strokeWidth={active === seg.name ? 4.6 : 3.8}
              strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-(start + gap / 2)}
              className="transition-all duration-200 cursor-pointer"
              style={{ opacity: active && active !== seg.name ? 0.35 : 1, pointerEvents: 'stroke' }}
              onMouseEnter={() => setActive(seg.name)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${seg.name}: $${money(seg.value)} (${seg.percentage.toFixed(0)}%)`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{shown ? shown.name : 'Total gasto'}</span>
        <span className="num text-sm font-semibold text-slate-50">${money(shown ? shown.value : total)}</span>
        {shown && <span className="num text-[10px] text-slate-400">{shown.percentage.toFixed(0)}%</span>}
      </div>
    </div>
  );
}

export default function FinancesView({
  data, todayKey, onAddTx, onUpdateTx, onDeleteTx, onSetBudgets, onAddRule, onRemoveRule,
  onExportCSV, onOpenSettings, showToast,
}) {
  const { transactions, budgets, settings } = data;
  const firstOf = (type) => categoryNames(settings, type)[0];
  const defaultExpense = () => (categoryNames(settings, 'expense').includes('General') ? 'General' : firstOf('expense'));

  const [month, setMonth] = useState(() => monthOf(todayKey)); // 'YYYY-MM' | 'all'
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(() => ({ type: 'expense', desc: '', amount: '', category: categoryNames(settings, 'expense')[0], date: todayKey }));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editingBudgets, setEditingBudgets] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});
  const [ruleForm, setRuleForm] = useState(null);
  const [activeCat, setActiveCat] = useState(null);

  const currentMonth = monthOf(todayKey);
  const expenseCats = settings.expenseCategories;
  const months = [...new Set([...listMonths(transactions, currentMonth), ...(month === 'all' ? [] : [month])])].sort((a, b) => b.localeCompare(a));

  const periodTx = useMemo(
    () => [...filterByMonth(transactions, month)].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, month],
  );
  const shownTx = query.trim() ? periodTx.filter((t) => matchesQuery(`${t.desc} ${t.category}`, query)) : periodTx;
  const summary = summarize(periodTx);
  const budgetMonth = month === 'all' ? currentMonth : month;
  const budgetSummary = summarize(filterByMonth(transactions, budgetMonth));
  const budgetRows = expenseCats
    .map((c) => ({ ...c, status: budgetStatus(budgetSummary.byCategory[c.name] || 0, budgets[c.name]) }))
    .filter((row) => row.status);

  const categoryData = Object.entries(summary.byCategory)
    .map(([name, value]) => ({
      name,
      value,
      percentage: summary.expense > 0 ? (value / summary.expense) * 100 : 0,
      color: categoryColor(settings, 'expense', name),
    }))
    .sort((a, b) => b.value - a.value);

  const setType = (type, setter, current) => setter({
    ...current,
    type,
    category: type === 'income' ? firstOf('income') : defaultExpense(),
  });

  const handleAdd = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.desc.trim()) {
      showToast('⚠️ Escribe un concepto');
      return;
    }
    if (!(amount > 0)) {
      showToast('⚠️ El monto debe ser mayor a $0');
      return;
    }
    // Si la categoría elegida se renombró o eliminó mientras tanto, se usa la predeterminada.
    const category = categoryNames(settings, form.type).includes(form.category)
      ? form.category
      : (form.type === 'income' ? firstOf('income') : defaultExpense());
    onAddTx({ desc: form.desc.trim(), amount, type: form.type, category, date: form.date || todayKey });
    setForm((f) => ({ ...f, desc: '', amount: '' }));
    showToast('✅ Movimiento guardado correctamente');
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const amount = parseFloat(editForm.amount);
    if (!editForm.desc.trim()) {
      showToast('⚠️ El movimiento necesita un concepto');
      return;
    }
    if (!(amount > 0)) {
      showToast('⚠️ El monto debe ser mayor a $0');
      return;
    }
    onUpdateTx(editingId, { desc: editForm.desc.trim(), amount, type: editForm.type, category: editForm.category, date: editForm.date || todayKey });
    setEditingId(null);
    showToast('✅ Movimiento actualizado');
  };

  const saveBudgets = (e) => {
    e.preventDefault();
    const names = new Set(expenseCats.map((c) => c.name));
    const others = Object.fromEntries(Object.entries(budgets).filter(([c]) => !names.has(c)));
    onSetBudgets({ ...others, ...(sanitizeBudgets(budgetDraft) || {}) });
    setEditingBudgets(false);
    showToast('🎯 Presupuestos guardados');
  };

  const saveRule = (e) => {
    e.preventDefault();
    const amount = parseFloat(ruleForm.amount);
    const day = Math.trunc(Number(ruleForm.day));
    if (!ruleForm.desc.trim() || !(amount > 0) || !(day >= 1 && day <= 31)) {
      showToast('⚠️ Completa concepto, monto y un día entre 1 y 31');
      return;
    }
    onAddRule({
      desc: ruleForm.desc.trim(), amount, type: ruleForm.type, category: ruleForm.category, day,
      startMonth: ruleStartMonth(day, todayKey), lastPosted: null,
    });
    setRuleForm(null);
    showToast(`🔁 Se registrará el día ${day} de cada mes`);
  };

  const inputSm = ui.inputSm;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Finanzas</h2>
          <p className="text-xs text-slate-400">{month === 'all' ? 'Todo el historial' : formatMonth(month)}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Periodo
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setEditingId(null);
              setEditingBudgets(false);
            }}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          >
            {months.map((m) => <option key={m} value={m}>{formatMonth(m)}{m === currentMonth ? ' (actual)' : ''}</option>)}
            <option value="all">Todo el historial</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${ui.card} p-5`}>
          <span className="text-xs text-slate-400">INGRESOS</span>
          <p className="num text-2xl font-semibold text-emerald-400 mt-1">+${money(summary.income)}</p>
        </div>
        <div className={`${ui.card} p-5`}>
          <span className="text-xs text-slate-400">GASTOS</span>
          <p className="num text-2xl font-semibold text-rose-400 mt-1">-${money(summary.expense)}</p>
        </div>
        <div className={`${ui.card} p-5`}>
          <span className="text-xs text-slate-400">{month === 'all' ? 'BALANCE NETO' : 'AHORRO DEL PERIODO'}</span>
          <p className={`num text-2xl font-semibold mt-1 ${summary.balance < 0 ? 'text-rose-400' : 'text-slate-50'}`}>
            {summary.balance < 0 ? '-' : ''}${money(Math.abs(summary.balance))}
          </p>
        </div>
      </div>

      <div className={`${ui.card} p-6`}>
        <SectionTitle icon={TrendingUp} sub="Ingresos y gastos de los últimos 6 meses. Toca un mes para verlo completo.">Tendencia</SectionTitle>
        <div className="mt-4">
          <MonthlyTrend
            series={monthlySeries(transactions, currentMonth, 6)}
            selected={month}
            onSelect={(m) => {
              setMonth(m);
              setEditingId(null);
              setEditingBudgets(false);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${ui.card} p-6`}>
          <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-400" /> Distribución de Gastos
          </h3>
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">No hay gastos en este periodo.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Donut data={categoryData} total={summary.expense} active={activeCat} setActive={setActiveCat} />
              <div className="flex-1 w-full space-y-2.5">
                {categoryData.map((cat) => (
                  <div
                    key={cat.name}
                    className={`space-y-1 rounded-lg -mx-1.5 px-1.5 py-0.5 transition-opacity ${activeCat && activeCat !== cat.name ? 'opacity-40' : ''}`}
                    onMouseEnter={() => setActiveCat(cat.name)}
                    onMouseLeave={() => setActiveCat(null)}
                  >
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                      <span className="num text-slate-200">${money(cat.value)} <span className="text-slate-500">{cat.percentage.toFixed(0)}%</span></span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`${ui.card} p-6`}>
          <h3 className="font-semibold text-base mb-4">Registrar Movimiento</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <TypeToggle value={form.type} onChange={(type) => setType(type, setForm, form)} />
            <input type="text" placeholder="Concepto (ej. Pago de luz)" aria-label="Concepto" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className={ui.input} />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Monto ($)" aria-label="Monto" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={ui.input} />
              <CategorySelect settings={settings} type={form.type} value={form.category} onChange={(category) => setForm({ ...form, category })} className={ui.input} />
            </div>
            <input type="date" aria-label="Fecha del movimiento" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={ui.input} />
            <button type="submit" className={`${ui.primary} w-full py-2.5 text-sm`}>Guardar Transacción</button>
          </form>
        </div>
      </div>

      <div className={`${ui.card} p-6`}>
        <div className="flex justify-between items-center gap-3 mb-4">
          <SectionTitle icon={Target} iconClass="text-amber-400" sub={`Límite mensual por categoría · ${formatMonth(budgetMonth)}`}>Presupuestos</SectionTitle>
          {!editingBudgets && (
            <button
              onClick={() => {
                setBudgetDraft(Object.fromEntries(expenseCats.map((c) => [c.name, budgets[c.name] ? String(budgets[c.name]) : ''])));
                setEditingBudgets(true);
              }}
              className={ui.link}
            >
              <Pencil className="w-3.5 h-3.5" /> {budgetRows.length ? 'Editar' : 'Definir'}
            </button>
          )}
        </div>
        {editingBudgets ? (
          <form onSubmit={saveBudgets} onKeyDown={(e) => { if (e.key === 'Escape') setEditingBudgets(false); }} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {expenseCats.map((c) => (
                <label key={c.name} className="text-xs text-slate-400 space-y-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.name}
                  </span>
                  <input
                    type="number" min="0" step="1" inputMode="decimal" placeholder="Sin límite"
                    value={budgetDraft[c.name] ?? ''}
                    onChange={(e) => setBudgetDraft((d) => ({ ...d, [c.name]: e.target.value }))}
                    className={ui.inputSm}
                  />
                </label>
              ))}
            </div>
            <EditActions onCancel={() => setEditingBudgets(false)} saveLabel="Guardar Presupuestos" />
          </form>
        ) : budgetRows.length === 0 ? (
          <p className="text-sm text-slate-500">Define cuánto quieres gastar al mes en cada categoría y te avisaremos al acercarte al límite.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {budgetRows.map(({ name, status }) => {
              const tone = status.level === 'over' ? 'bg-rose-500' : status.level === 'warn' ? 'bg-amber-400' : 'bg-emerald-500';
              return (
                <div key={name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{name}</span>
                    <span className="num text-slate-400"><span className="text-slate-200">${money(status.spent)}</span> / ${money(status.limit)}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(status.pct, 100)}%` }} />
                  </div>
                  <p className={`text-[11px] ${status.level === 'over' ? 'text-rose-300' : status.level === 'warn' ? 'text-amber-300' : 'text-slate-500'}`}>
                    {status.level === 'over' ? `Excedido por $${money(-status.remaining)}` : `Quedan $${money(status.remaining)} (${Math.round(status.pct)}% usado)`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`${ui.card} p-6`}>
        <div className="flex justify-between items-center gap-3 mb-4">
          <SectionTitle icon={Repeat} iconClass="text-sky-400" sub="Se registran solos cada mes: renta, suscripciones, sueldo…">Gastos e ingresos fijos</SectionTitle>
          {!ruleForm && (
            <button onClick={() => setRuleForm({ type: 'expense', desc: '', amount: '', category: defaultExpense(), day: String(Number(todayKey.slice(8))) })} className={ui.link}>
              + Agregar
            </button>
          )}
        </div>
        {ruleForm && (
          <form onSubmit={saveRule} onKeyDown={(e) => { if (e.key === 'Escape') setRuleForm(null); }} className="p-4 mb-4 rounded-xl bg-slate-800 border border-indigo-500/50 space-y-3">
            <TypeToggle value={ruleForm.type} onChange={(type) => setType(type, setRuleForm, ruleForm)} />
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <Field label="Concepto" className="col-span-2 sm:col-span-2">
                <input type="text" autoFocus placeholder="Ej. Renta, Netflix" value={ruleForm.desc} onChange={(e) => setRuleForm({ ...ruleForm, desc: e.target.value })} className={inputSm} />
              </Field>
              <Field label="Monto">
                <input type="number" min="0.01" step="0.01" inputMode="decimal" value={ruleForm.amount} onChange={(e) => setRuleForm({ ...ruleForm, amount: e.target.value })} className={inputSm} />
              </Field>
              <Field label="Categoría" className="sm:col-span-2">
                <CategorySelect settings={settings} type={ruleForm.type} value={ruleForm.category} onChange={(category) => setRuleForm({ ...ruleForm, category })} className={inputSm} />
              </Field>
              <Field label="Día del mes">
                <input type="number" min="1" max="31" step="1" value={ruleForm.day} onChange={(e) => setRuleForm({ ...ruleForm, day: e.target.value })} className={inputSm} />
              </Field>
            </div>
            <p className="text-[11px] text-slate-400">Si el mes tiene menos días, se registra el último día del mes.</p>
            <EditActions onCancel={() => setRuleForm(null)} saveLabel="Guardar" />
          </form>
        )}
        {settings.recurringTx.length === 0 ? (
          !ruleForm && <p className="text-sm text-slate-500">Aún no tienes movimientos fijos.</p>
        ) : (
          <div className="space-y-2">
            {settings.recurringTx.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words">{rule.desc}</p>
                  <p className="text-xs text-slate-400">{rule.category} • {describeRule(rule)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`num text-sm ${rule.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {rule.type === 'income' ? '+' : '-'}${money(rule.amount)}
                  </span>
                  <button
                    onClick={() => {
                      onRemoveRule(rule.id);
                      showToast(`🗑️ "${rule.desc}" ya no se registrará automáticamente (los movimientos anteriores se conservan)`);
                    }}
                    className={`${ui.iconBtn} hover:text-rose-400`}
                    aria-label={`Eliminar movimiento fijo: ${rule.desc}`}
                    title="Dejar de registrar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${ui.card} p-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-base">Historial de Transacciones</h3>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar movimiento…" aria-label="Buscar movimientos"
                className="w-full bg-slate-800/70 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label="Limpiar búsqueda">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => onExportCSV(shownTx, month === 'all' ? todayKey : month)}
              disabled={shownTx.length === 0}
              title="Exporta los movimientos mostrados"
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>
        {shownTx.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">{query ? 'Ningún movimiento coincide con la búsqueda.' : 'No hay movimientos en este periodo.'}</p>
        ) : (
          <div className="space-y-2">
            {shownTx.map((tr) => (editingId === tr.id ? (
              <form key={tr.id} onSubmit={saveEdit} onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }} className="p-4 rounded-xl bg-slate-800 border border-indigo-500/50 space-y-3">
                <TypeToggle value={editForm.type} onChange={(type) => setType(type, setEditForm, editForm)} />
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <input type="text" autoFocus aria-label="Concepto del movimiento" value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} className={`${inputSm} col-span-2 sm:col-span-2`} />
                  <input type="number" min="0.01" step="0.01" inputMode="decimal" aria-label="Monto del movimiento" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} className={inputSm} />
                  <CategorySelect settings={settings} type={editForm.type} value={editForm.category} onChange={(category) => setEditForm({ ...editForm, category })} className={`${inputSm} sm:col-span-1`} label="Categoría del movimiento" />
                  <input type="date" aria-label="Fecha del movimiento" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className={`${inputSm} col-span-2 sm:col-span-2`} />
                </div>
                <EditActions onCancel={() => setEditingId(null)} />
              </form>
            ) : (
              <div key={tr.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/40">
                <div className="flex items-center gap-3 min-w-0">
                  {tr.type === 'income' ? <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" /> : <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">
                      {tr.desc}
                      {tr.recurringId && <Repeat className="inline w-3 h-3 ml-1.5 text-sky-400" aria-label="Movimiento fijo" />}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor(settings, tr.type, tr.category) }} />
                      {tr.category} • {formatReadableDate(tr.date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`num text-sm mr-1 ${tr.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tr.type === 'income' ? '+' : '-'}${money(tr.amount)}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(tr.id);
                      setEditForm({ desc: tr.desc, amount: String(tr.amount), type: tr.type, category: tr.category, date: tr.date });
                    }}
                    className={`${ui.iconBtn} hover:text-indigo-400`} aria-label={`Editar movimiento: ${tr.desc}`} title="Editar movimiento"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDeleteTx(tr.id)} className={`${ui.iconBtn} hover:text-rose-400`} aria-label={`Eliminar movimiento: ${tr.desc}`} title="Eliminar movimiento">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )))}
          </div>
        )}
      </div>

      <button onClick={onOpenSettings} className={`${ui.link} mx-auto`}>
        <Settings className="w-3.5 h-3.5" /> Administrar categorías
      </button>
    </div>
  );
}
