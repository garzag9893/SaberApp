import { Zap, Wallet, HeartPulse, Calendar, Clock, CheckCircle2, Circle, Repeat } from 'lucide-react';
import { formatReadableDate } from '../lib/dates.js';
import { todayTasks, isOverdue, formatTimeRange } from '../lib/agenda.js';
import { monthOf, filterByMonth, summarize, budgetStatus } from '../lib/finance.js';
import { ui, money } from '../components/ui.jsx';

export default function DashboardView({ data, todayKey, onNavigate, onToggleTask }) {
  const { tasks, transactions, health, budgets, settings } = data;
  const today = todayTasks(tasks, todayKey);
  const doneToday = today.filter((t) => t.completed).length;
  const overdueCount = tasks.filter((t) => isOverdue(t, todayKey)).length;
  const completedHabits = health.habits.filter((h) => h.done).length;

  const all = summarize(transactions);
  const month = summarize(filterByMonth(transactions, monthOf(todayKey)));
  const overBudget = settings.expenseCategories
    .map((c) => c.name)
    .filter((name) => budgetStatus(month.byCategory[name] || 0, budgets[name])?.level === 'over');
  const recentTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const insight = (() => {
    if (health.sleepHours != null && health.sleepHours < 6.5) return 'Dormiste menos de 6.5h. Prioriza tus 2 tareas más importantes y evita compras impulsivas hoy.';
    if (overBudget.length) return `Ya superaste tu presupuesto de ${overBudget.join(', ')} este mes. Revisa tus gastos en Finanzas antes de seguir comprando.`;
    if (all.balance < 1000) return 'Tu balance disponible está ajustado. Mantén tus gastos variables al mínimo esta semana.';
    if (completedHabits >= 3) return '¡Excelente racha de hábitos hoy! Tu nivel de energía es óptimo para avanzar en tus metas.';
    const pending = today.length - doneToday;
    const late = overdueCount ? ` (${overdueCount} ${overdueCount === 1 ? 'atrasada' : 'atrasadas'})` : '';
    const missing = health.sleepHours == null || health.mood == null ? ' Registra cómo dormiste y tu energía en Salud.' : '';
    return `Hoy es ${formatReadableDate(todayKey)}. Tienes ${pending} ${pending === 1 ? 'tarea pendiente' : 'tareas pendientes'} hoy${late}.${missing}`;
  })();

  const cardBtn = `${ui.card} text-left cursor-pointer hover:border-slate-700 p-5 transition-all`;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-500/30 p-4 rounded-2xl flex items-start gap-3">
        <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Análisis Inteligente del Día</h3>
          <p className="text-sm text-slate-200 mt-0.5">{insight}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button type="button" onClick={() => onNavigate('finances')} className={cardBtn}>
          <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
            <span>BALANCE DISPONIBLE</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-50">{all.balance < 0 ? '-' : ''}${money(Math.abs(all.balance))}</div>
          <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-emerald-400">+${money(all.income)}</span>
            <span className="text-rose-400">-${money(all.expense)}</span>
            <span>· Gastos del mes: ${money(month.expense)}</span>
          </div>
          {overBudget.length > 0 && <p className="text-[11px] text-rose-300 mt-1.5">Presupuesto excedido: {overBudget.join(', ')}</p>}
        </button>

        <button type="button" onClick={() => onNavigate('health')} className={cardBtn}>
          <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
            <span>SALUD Y HÁBITOS (HOY)</span>
            <HeartPulse className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-slate-50">{completedHabits}/{health.habits.length} <span className="text-sm font-normal text-slate-400">hábitos</span></div>
          <div className="text-xs text-slate-400 mt-2 flex gap-3">
            <span>💧 {health.water}/{health.waterGoal} vasos</span>
            <span>🌙 {health.sleepHours == null ? 'sin registrar' : `${health.sleepHours}h sueño`}</span>
          </div>
        </button>

        <button type="button" onClick={() => onNavigate('agenda')} className={cardBtn}>
          <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
            <span>AGENDA DE HOY</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-50">{doneToday}/{today.length} <span className="text-sm font-normal text-slate-400">tareas</span></div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-500 h-full transition-all" style={{ width: `${today.length ? (doneToday / today.length) * 100 : 0}%` }} />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${ui.card} p-5`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" /> Enfoque de Hoy (Ordenado)</h3>
            <button onClick={() => onNavigate('agenda')} className="text-xs text-indigo-400 hover:underline">Ver todo</button>
          </div>
          {today.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No hay tareas programadas para hoy.</p>
          ) : (
            <div className="space-y-2.5">
              {today.slice(0, 5).map((task) => (
                <button
                  type="button" key={task.id} onClick={() => onToggleTask(task.id)} aria-pressed={task.completed}
                  className="w-full text-left flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {task.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-slate-500 shrink-0" />}
                    <span className={`text-sm break-words min-w-0 ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {task.title}
                      {task.repeat !== 'none' && <Repeat className="inline w-3 h-3 ml-1.5 text-sky-400" aria-label="Se repite" />}
                    </span>
                  </div>
                  {isOverdue(task, todayKey) ? (
                    <span className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-md shrink-0">Atrasada</span>
                  ) : (
                    <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded-md shrink-0">{formatTimeRange(task)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`${ui.card} p-5`}>
          <h3 className="font-semibold text-sm text-slate-200 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-400" /> Últimos Movimientos</h3>
          {recentTx.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Aún no hay movimientos registrados.</p>
          ) : (
            <div className="space-y-2.5">
              {recentTx.map((tr) => (
                <div key={tr.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-800/40">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 break-words">{tr.desc}</p>
                    <p className="text-xs text-slate-500">{tr.category} • {formatReadableDate(tr.date)}</p>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${tr.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tr.type === 'income' ? '+' : '-'}${money(tr.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
